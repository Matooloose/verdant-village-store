 import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// This page is used as an HTTPS landing page for payment gateways that
// do not accept custom scheme return URLs. The gateway will redirect
// the browser here, and this page will immediately forward to the
// app deep link (farmersbracket://...) which opens the native app.

const MobilePayReturn: React.FC = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const orderId = searchParams.get('order_id');
    const pfPaymentId = searchParams.get('pf_payment_id');
    const err = searchParams.get('error') || searchParams.get('status');
    const errDesc = searchParams.get('error_description');

    // Build app deep link with available params
    let deepLink = 'farmersbracket://payment-success';
    const params: string[] = [];
    if (orderId) params.push(`order_id=${encodeURIComponent(orderId)}`);
    if (pfPaymentId) params.push(`pf_payment_id=${encodeURIComponent(pfPaymentId)}`);
    if (err) params.push(`error=${encodeURIComponent(err)}`);
    if (errDesc) params.push(`error_description=${encodeURIComponent(errDesc)}`);
    if (params.length) deepLink += `?${params.join('&')}`;

    // Try to redirect to the native app via custom scheme
    try {
      window.location.href = deepLink;
    } catch (e) {
      // Ignore
    }

    // As a fallback, after a short timeout show the success/cancel page
    // in web (the app should have handled the deep link). We don't render UI here.
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-lg font-semibold">Redirecting to the app…</h2>
        <p className="text-sm text-muted-foreground mt-2">If you are not redirected, please open the FarmersBracket app.</p>
      </div>
    </div>
  );
};

export default MobilePayReturn;
