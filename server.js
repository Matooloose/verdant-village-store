import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const stripe = new Stripe('pk_test_51Rh5koISjXpxVHMtTSZ6Vuenl5Lc5a3TuXReTolFVgS9ZaFSr2gixcGR6Vqmr2n6O0PPAN0lFvLW7b3Q2ojQXklN009xJ9kZBm'); // Replace with your Stripe secret key

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Replace with your sandbox credentials
const PAYFAST_MERCHANT_ID = '10000100';
const PAYFAST_MERCHANT_KEY = '46f0cd694581a';
const PAYFAST_SANDBOX_URL = 'https://sandbox.payfast.co.za/eng/process';

app.post('/api/create-payment-intent', async (req, res) => {
  const { amount, currency } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // amount in cents
      currency,
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PayFast payment URL generation endpoint
app.post('/payfast-url', (req, res) => {
  try {
    const { amount, item_name, return_url, cancel_url, notify_url, custom_str1 } = req.body;
    
    // Validate required fields
    if (!amount || !item_name || !return_url || !cancel_url || !notify_url) {
      return res.status(400).json({ 
        error: 'Missing required fields: amount, item_name, return_url, cancel_url, notify_url' 
      });
    }
    
    const params = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      amount,
      item_name,
      return_url,
      cancel_url,
      notify_url,
    };
    
    // Add custom_str1 if provided (for order ID tracking)
    if (custom_str1) {
      params.custom_str1 = custom_str1;
    }
    // Pass subscription parameters through if provided (for recurring payments)
    const subscriptionParams = ['subscription_type','billing_date','recurring_amount','frequency','cycles','subscription_notify_email','subscription_notify_webhook','subscription_notify_buyer'];
    subscriptionParams.forEach(key => {
      if (req.body[key] !== undefined && req.body[key] !== null) {
        params[key] = req.body[key];
      }
    });
    
    const query = Object.entries(params)
      .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
      .join('&');
    const paymentUrl = `${PAYFAST_SANDBOX_URL}?${query}`;
    
    console.log('Generated PayFast URL:', paymentUrl);
    res.json({ url: paymentUrl });
  } catch (error) {
    console.error('PayFast URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate PayFast URL' });
  }
});

// PayFast ITN webhook endpoint
app.post('/payfast-webhook', (req, res) => {
  console.log('PayFast ITN received:', req.body);
  if (req.body.payment_status === 'COMPLETE') {
    console.log('Payment completed for:', req.body.pf_payment_id);
  }
  res.status(200).send('OK');
});

// Mock PayFast initiate endpoint
app.post('/api/payfast-initiate', (req, res) => {
  res.json({
    success: true,
    message: 'Mock PayFast payment initiated successfully.',
    paymentUrl: 'https://sandbox.payfast.co.za/mock-payment',
    transactionId: 'MOCK1234567890'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`PayFast server running on port ${PORT}`);
});

