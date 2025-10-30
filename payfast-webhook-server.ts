import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3002;

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// PayFast configuration
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || 'jt7NOE43FZPn';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Helper to build PayFast-style signature from headers+body and passphrase
function buildPayfastSignature(values: Record<string, unknown>, passphrase = ''): string {
  // Alphabetise keys
  const keys = Object.keys(values).sort();
  let out = '';
  for (const k of keys) {
    const v = values[k];
    if (v === undefined || v === null || v === '') continue;
    out += `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}&`;
  }
  if (passphrase) {
    out += `passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`;
  } else {
    // remove trailing & when no passphrase appended
    out = out.replace(/&$/, '');
  }
  return crypto.createHash('md5').update(out).digest('hex').toLowerCase();
}

// Proxy helper: forward request to PayFast subscriptions endpoints with required headers
async function forwardToPayfast(req: express.Request, res: express.Response, action: string) {
  try {
    const token = req.params.token;
    const pfBase = process.env.PAYFAST_API_BASE || 'https://api.payfast.co.za';
    // Build target URL (append ?testing=true for sandbox convenience)
    const targetUrl = `${pfBase}/subscriptions/${token}/${action}?testing=true`;

    // Collect header params expected by PayFast
    const merchantId = (req.headers['merchant-id'] as string) || process.env.PAYFAST_MERCHANT_ID || process.env.PAYFAST_MERCHANT_ID || '';
    const version = (req.headers['version'] as string) || process.env.PAYFAST_API_VERSION || 'v1';
    const timestamp = (req.headers['timestamp'] as string) || new Date().toISOString();
    const passphrase = process.env.PAYFAST_PASSPHRASE || '';

    // Build signature from headers + body params
    const signatureInputs: Record<string, unknown> = {
      'merchant-id': merchantId,
      version,
      timestamp,
      // include body props if present
      ...(req.method !== 'GET' && req.body && typeof req.body === 'object' ? req.body : {}),
    };

    const signature = buildPayfastSignature(signatureInputs, passphrase);

    // Build outgoing headers
    const outHeaders: Record<string, string> = {
      'merchant-id': merchantId,
      version,
      timestamp,
      signature,
      'Content-Type': req.method === 'GET' ? 'application/json' : (req.headers['content-type'] as string) || 'application/json',
    };

    // Forward request using fetch
    const fetchOptions: Record<string, unknown> = {
      method: req.method,
      headers: outHeaders,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // PayFast expects form-encoded or JSON depending on API; send JSON for simplicity
      fetchOptions.body = JSON.stringify(req.body || {});
    }

    const resp = await fetch(targetUrl, fetchOptions);
    const text = await resp.text();
    // Try to parse as JSON when possible
    try {
      const json = JSON.parse(text);
      res.status(resp.status).json(json);
    } catch (e) {
      res.status(resp.status).type('text').send(text);
    }
  } catch (err) {
    console.error('PayFast proxy error:', err);
    res.status(502).json({ error: 'Bad gateway', details: String(err) });
  }
}

// Supported subscription actions
const subscriptionActions = new Set(['fetch', 'pause', 'unpause', 'cancel', 'update', 'adhoc']);

// Route that proxies various subscription actions to PayFast sandbox
app.all('/subscriptions/:token/:action', async (req, res) => {
  const action = req.params.action;
  if (!subscriptionActions.has(action)) return res.status(404).json({ error: 'unknown action' });
  return forwardToPayfast(req, res, action);
});

// Function to verify PayFast signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function verifySignature(data: Record<string, any>, signature: string, passPhrase: string = '') {
  // Create parameter string
  let pfOutput = '';
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key) && key !== 'signature' && data[key] !== '') {
      pfOutput += `${key}=${encodeURIComponent(data[key]).replace(/%20/g, '+')}&`;
    }
  }
  
  // Remove last ampersand
  pfOutput = pfOutput.slice(0, -1);
  
  if (passPhrase !== '') {
    pfOutput += `&passphrase=${encodeURIComponent(passPhrase).replace(/%20/g, '+')}`;
  }
  
  const calculatedSignature = crypto.createHash('md5').update(pfOutput).digest('hex');
  return calculatedSignature === signature;
}

// PayFast ITN (Instant Transaction Notification) webhook
app.post('/payfast/webhook', async (req, res) => {
  try {
    console.log('PayFast webhook received:', req.body);
    
    const {
      signature,
      payment_status,
      pf_payment_id,
      amount_gross,
      amount_fee,
      amount_net,
      custom_str1, // This should contain our order ID
      custom_str2, // This should contain user ID
      ...otherData
    } = req.body;

    // Verify signature
    if (!verifySignature(req.body, signature, PAYFAST_PASSPHRASE)) {
      console.error('Invalid PayFast webhook signature');
      return res.status(400).send('Invalid signature');
    }

    const orderId = custom_str1;
    const userId = custom_str2;

    if (!orderId || !userId) {
      console.error('Missing order ID or user ID in webhook');
      return res.status(400).send('Missing required data');
    }

    // Update order status based on payment status
    let orderStatus = 'pending';
    let paymentStatusEnum = 'PENDING';

    switch (payment_status) {
      case 'COMPLETE':
        orderStatus = 'confirmed';
        paymentStatusEnum = 'COMPLETED';
        break;
      case 'FAILED':
        orderStatus = 'cancelled';
        paymentStatusEnum = 'FAILED';
        break;
      case 'CANCELLED':
        orderStatus = 'cancelled';
        paymentStatusEnum = 'CANCELLED';
        break;
      default:
        orderStatus = 'pending';
        paymentStatusEnum = 'PENDING';
    }

    // Update order status
    const { error: orderError } = await supabase
      .from('orders')
      .update({ 
        status: orderStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('user_id', userId);

    if (orderError) {
      console.error('Failed to update order:', orderError);
      return res.status(500).send('Failed to update order');
    }

    // Create/update payment record
  try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: paymentError } = await (supabase as any)
        .from('payments')
        .upsert({
          order_id: orderId,
          user_id: userId,
          amount: parseFloat(amount_gross),
          currency: 'ZAR',
          status: paymentStatusEnum,
          payment_method: 'payfast',
          transaction_id: pf_payment_id,
          metadata: {
            payfast_payment_id: pf_payment_id,
            amount_fee: parseFloat(amount_fee || '0'),
            amount_net: parseFloat(amount_net || '0'),
            payment_status,
            webhook_data: otherData,
            updated_at: new Date().toISOString()
          }
        }, {
          onConflict: 'order_id'
        });

      if (paymentError) {
        console.warn('Failed to create/update payment record:', paymentError);
      }
    } catch (err) {
      console.warn('Payment table not yet deployed:', err);
    }

    // If this webhook contains a subscription intent, handle it (chat subscription)
    try {
      const subscriptionType = req.body.subscription_type || otherData.subscription_type;
      const subscriptionOption = req.body.subscription_option || otherData.subscription_option || null;
      if (payment_status === 'COMPLETE' && subscriptionType === 'chat') {
        console.log('Processing chat subscription for user:', userId, 'option:', subscriptionOption);

        // Map subscription_option to duration_months
        const optionToMonths: Record<string, number> = {
          'one_time': 0,
          'monthly': 1,
          'annual': 12,
        };
        const desiredMonths = subscriptionOption && optionToMonths[subscriptionOption] !== undefined ? optionToMonths[subscriptionOption] : null;

        interface SubscriptionPlan { id: string; duration_months: number; name?: string; }
        let plan: SubscriptionPlan | null = null;

        if (desiredMonths !== null) {
          const { data: selectedPlan, error: selErr } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('duration_months', desiredMonths)
            .ilike('name', '%chat%')
            .limit(1);
          if (selErr) console.warn('Error fetching selected chat plan:', selErr);
          if (selectedPlan && selectedPlan.length > 0) plan = selectedPlan[0];
        }

        // If no specific plan found (or no option supplied), fall back to any chat plan (one_time first)
        if (!plan) {
          const { data: fallbackOne, error: fallbackErr } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('duration_months', 0)
            .ilike('name', '%chat%')
            .limit(1);
          if (!fallbackErr && fallbackOne && fallbackOne.length > 0) plan = fallbackOne[0];
          else {
            const { data: fallbackMonthly, error: fallbackMonthlyErr } = await supabase
              .from('subscription_plans')
              .select('*')
              .eq('duration_months', 1)
              .ilike('name', '%chat%')
              .limit(1);
            if (!fallbackMonthlyErr && fallbackMonthly && fallbackMonthly.length > 0) plan = fallbackMonthly[0];
          }
        }

        if (!plan) {
          console.warn('No chat subscription plan found; skipping subscription provisioning');
        } else {
          // If webhook provided a pending subscription id (custom_str1), try to activate that
          const pendingSubId = custom_str1 || null;
          if (pendingSubId) {
            try {
              const { data: pendingRows, error: pendingErr } = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('id', pendingSubId)
                .eq('user_id', userId)
                .eq('status', 'pending')
                .limit(1);

              if (!pendingErr && pendingRows && pendingRows.length > 0) {
                // Activate the existing pending subscription
                const { error: activateErr } = await supabase
                  .from('user_subscriptions')
                  .update({
                    status: 'active',
                    start_date: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    payment_method: 'payfast'
                  })
                  .eq('id', pendingSubId);

                if (activateErr) console.error('Failed to activate pending subscription:', activateErr);
                else console.log('Activated pending subscription id:', pendingSubId);

                // done
                plan = null; // prevent double-insert below
              }
            } catch (err) {
              console.warn('Error while activating pending subscription:', err);
            }
          }

          if (plan) {
            // Check for existing active subscription for this user and plan
            const { data: existingSubs, error: existingErr } = await supabase
              .from('user_subscriptions')
              .select('*')
              .eq('user_id', userId)
              .eq('subscription_plan_id', plan.id)
              .eq('status', 'active')
              .limit(1);

            if (existingErr) {
              console.warn('Error checking existing subscriptions:', existingErr);
            }

            if (existingSubs && existingSubs.length > 0) {
              console.log('User already has active subscription for plan, skipping insert');
            } else {
              // Compute end_date if duration_months > 0
              let endDate: string | null = null;
              if (plan.duration_months && Number(plan.duration_months) > 0) {
                const d = new Date();
                d.setMonth(d.getMonth() + Number(plan.duration_months));
                endDate = d.toISOString();
              }

              const { error: subInsertErr } = await supabase
                .from('user_subscriptions')
                .insert({
                  user_id: userId,
                  subscription_plan_id: plan.id,
                  status: 'active',
                  start_date: new Date().toISOString(),
                  end_date: endDate,
                  payment_method: 'payfast',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });

              if (subInsertErr) {
                console.error('Failed to insert user subscription:', subInsertErr);
              } else {
                console.log('User subscription created for user:', userId, 'plan:', plan.id);
              }
            }
          }
        }
      }
    } catch (subErr) {
      console.error('Error while handling subscription provisioning:', subErr);
    }

    console.log(`Order ${orderId} updated with status: ${orderStatus}`);
    res.status(200).send('OK');

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Error processing webhook');
  }
});



// Helper: cancel other active subscriptions for a user (exclude optional id)
async function cancelOtherActiveSubscriptions(userId: string, excludeId?: string) {
  try {
    const query = supabase
      .from('user_subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');
    if (excludeId) query.neq('id', excludeId);
    const { error } = await query;
    if (error) console.warn('Failed to cancel other active subscriptions:', error);
  } catch (err) {
    console.warn('cancelOtherActiveSubscriptions error:', err);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'PayFast Webhook Handler'
  });
});

// Payment return handler (success)
app.get('/payment-return', async (req, res) => {
  try {
    const orderId = String(req.query.custom_str1 || req.query.order_id || '');
    const paymentId = String(req.query.pf_payment_id || '');

    console.log('Payment return:', { orderId, paymentId, query: req.query });

    if (!orderId) {
      return res.status(400).send('Missing order ID');
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'processing',
          payment_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) console.error('Error updating order:', error);
    } catch (err) {
      console.error('Error updating order (exception):', err);
    }

    const ua = String(req.headers['user-agent'] || '');
    const isMobileRequest = ua.includes('Mobile');
    const webAppUrl = process.env.WEB_APP_URL || 'https://your-web-app.com';

    if (isMobileRequest) {
      return res.redirect(`farmersbracket://payment-success?order_id=${orderId}&pf_payment_id=${paymentId}`);
    }

    return res.redirect(`${webAppUrl}/payment-success?order_id=${orderId}&pf_payment_id=${paymentId}`);
  } catch (error) {
    console.error('Payment return error:', error);
    res.status(500).send('Error processing payment return');
  }
});

// Payment cancel handler
app.get('/payment-cancel', async (req, res) => {
  try {
    const orderId = String(req.query.custom_str1 || req.query.order_id || '');
    console.log('Payment cancelled:', { orderId, query: req.query });

    if (orderId) {
      try {
        await supabase
          .from('orders')
          .update({ status: 'cancelled', payment_status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', orderId);
      } catch (err) {
        console.error('Error updating cancelled order:', err);
      }
    }

    const ua = String(req.headers['user-agent'] || '');
    const isMobileRequest = ua.includes('Mobile');
    const webAppUrl = process.env.WEB_APP_URL || 'https://your-web-app.com';

    if (isMobileRequest) {
      return res.redirect(`farmersbracket://payment-cancelled?order_id=${orderId}`);
    }

    return res.redirect(`${webAppUrl}/payment-cancelled?order_id=${orderId}`);
  } catch (error) {
    console.error('Payment cancel error:', error);
    res.status(500).send('Error processing payment cancellation');
  }
});

// Status check endpoint for mobile app
app.get('/payment-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, status, payment_status, total')
      .eq('id', orderId)
      .single();

    if (error || !order) return res.status(404).json({ error: 'Order not found' });

    return res.json({ orderId: order.id, status: order.status, paymentStatus: order.payment_status, total: order.total });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Error checking payment status' });
  }
});

app.listen(PORT, () => {
  console.log(`PayFast webhook server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;