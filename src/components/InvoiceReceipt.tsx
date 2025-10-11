import React from 'react';
import { format } from 'date-fns';

interface InvoiceReceiptProps {
  order: {
    id: string;
    created_at: string;
    user_id: string;
    shipping_address: string | null;
    payment_method: string | null;
    payment_status: string;
    total: number;
    order_items?: Array<{
      id: string;
      product_id: string;
      quantity: number;
      unit_price: number;
      product?: {
        name: string;
      };
      name?: string; // Alternative field for product name
    }>;
    products?: Array<{
      name: string;
      quantity: number;
      price: number;
      total: number;
    }>;
  };
  user?: {
    name?: string;
    email?: string;
  };
}

const InvoiceReceipt: React.FC<InvoiceReceiptProps> = ({ order, user }) => {
  // Handle different data structures from TrackOrder vs other components
  const orderItems = order?.order_items || [];
  const products = order?.products || [];
  
  // Calculate subtotal from available data
  const subtotal = orderItems.length > 0 
    ? orderItems.reduce((sum, item) => sum + ((item?.unit_price || 0) * (item?.quantity || 0)), 0)
    : products.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 0)), 0);
    
  const deliveryFee = 25.00;
  const tax = subtotal * 0.15; // 15% VAT
  const total = subtotal + deliveryFee + tax;

  // Use order_items if available, otherwise use products array
  const displayItems = orderItems.length > 0 ? orderItems : products;
  
  // Early return if no order data
  if (!order) {
    return (
  <div className="invoice-printable max-w-4xl mx-auto bg-card p-8">
        <div className="text-center text-gray-500">
          <p>No order data available for invoice generation.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .invoice-printable, .invoice-printable * {
            visibility: visible;
          }
          .invoice-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white;
            font-family: Arial, sans-serif;
            color: black;
          }
          .print-hide {
            display: none !important;
          }
          .page-break {
            page-break-before: always;
          }
        }
      `}</style>
      
  <div className="invoice-printable max-w-4xl mx-auto bg-card p-8 shadow-lg print:shadow-none print:p-6">
        {/* Header with Logo and Company Info */}
        <div className="flex items-center justify-between mb-8 border-b-2 border-green-600 pb-6">
          <div className="flex items-center space-x-4">
            <img 
              src="/farmers.jpg" 
              alt="FarmersBracket Logo" 
              className="w-16 h-16 object-cover rounded-full border-2 border-green-600"
            />
            <div>
              <h1 className="text-3xl font-bold text-green-700">FarmersBracket</h1>
              <p className="text-sm text-gray-600">Fresh From Farm To Your Table</p>
              <p className="text-xs text-gray-500">support@farmersbracket.com | +27 11 123 4567</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">INVOICE</h2>
            <div className="bg-green-50 p-3 rounded border border-green-200">
              <p className="text-sm font-semibold">Invoice #: <span className="text-green-700">{order?.id?.slice(0,8)?.toUpperCase() || 'INVOICE'}</span></p>
              <p className="text-sm">Date: <span className="font-medium">{order?.created_at ? format(new Date(order.created_at), 'dd MMM yyyy') : format(new Date(), 'dd MMM yyyy')}</span></p>
              <p className="text-sm">Time: <span className="font-medium">{order?.created_at ? format(new Date(order.created_at), 'HH:mm') : format(new Date(), 'HH:mm')}</span></p>
            </div>
          </div>
        </div>

        {/* Company and Customer Information */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-50 p-4 rounded border">
            <h3 className="font-bold text-lg text-gray-800 mb-3 border-b border-gray-200 pb-2">From</h3>
            <div className="space-y-1">
              <p className="font-semibold text-green-700">FarmersBracket (Pty) Ltd</p>
              <p className="text-sm">123 Farm Market Street</p>
              <p className="text-sm">Johannesburg, Gauteng 2000</p>
              <p className="text-sm">South Africa</p>
              <p className="text-sm font-medium">VAT: 4123456789</p>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded border border-green-200">
            <h3 className="font-bold text-lg text-gray-800 mb-3 border-b border-green-200 pb-2">Bill To</h3>
            <div className="space-y-1">
              <p className="font-semibold text-green-700">{user?.name || 'Valued Customer'}</p>
              <p className="text-sm">{user?.email || 'N/A'}</p>
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-600">Delivery Address:</p>
                <p className="text-sm">{order?.shipping_address || 'Standard Delivery Address'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items Table */}
        <div className="mb-8">
          <h3 className="font-bold text-lg text-gray-800 mb-4">Order Details</h3>
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Item Description</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Quantity</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Unit Price</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                  {displayItems.map((item, index) => {
                    // Handle both order_items and products structures with null checks
                    const itemName = (item && 'product' in item) 
                      ? (item.product?.name || "Unknown Product")
                      : (item?.name || "Unknown Product");
                    const itemQuantity = item?.quantity || 0;
                    const itemPrice = (item && 'unit_price' in item) ? (item.unit_price || 0) : (item?.price || 0);
                    const itemTotal = (item && 'total' in item) ? (item.total || 0) : (itemPrice * itemQuantity);
                    const productId = (item && 'product_id' in item) ? (item.product_id || 'N/A') : 'N/A';
                  
                    return (
                      <tr key={`item-${index}`} className={index % 2 === 0 ? 'bg-card/80' : 'bg-card/95'}>
                      <td className="px-4 py-3 border-b border-gray-200">
                        <div>
                          <p className="font-medium text-gray-800">{itemName}</p>
                          <p className="text-xs text-gray-500">Product ID: {productId.toString().slice(0,8)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center border-b border-gray-200 font-medium">
                        {itemQuantity}
                      </td>
                      <td className="px-4 py-3 text-right border-b border-gray-200">
                        R{itemPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right border-b border-gray-200 font-semibold">
                        R{itemTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-blue-50 p-4 rounded border border-blue-200">
            <h3 className="font-bold text-lg text-gray-800 mb-3">Payment Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Payment Method:</span>
                <span className="font-semibold text-blue-700">{order?.payment_method || 'PayFast'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Payment Status:</span>
                <span className={`font-semibold capitalize px-2 py-1 rounded text-xs ${
                  (order?.payment_status === 'completed' || order?.payment_status === 'confirmed') 
                    ? 'bg-green-100 text-green-700' 
                    : (order?.payment_status === 'failed') 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {order?.payment_status || 'Pending'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded border">
            <h3 className="font-bold text-lg text-gray-800 mb-3">Amount Breakdown</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Subtotal:</span>
                <span className="font-medium">R{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Delivery Fee:</span>
                <span className="font-medium">R{deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">VAT (15%):</span>
                <span className="font-medium">R{tax.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-300 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-bold text-lg">Total Amount:</span>
                  <span className="font-bold text-lg text-green-700">R{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-green-600 pt-6 mt-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Terms & Conditions</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• All products are fresh and locally sourced</li>
                <li>• Delivery within 24-48 hours of order confirmation</li>
                <li>• Returns accepted within 24 hours of delivery</li>
                <li>• Contact support for any quality concerns</li>
              </ul>
            </div>
            <div className="text-right">
              <h4 className="font-semibold text-gray-800 mb-2">Thank You!</h4>
              <p className="text-sm text-gray-600 mb-2">
                Thank you for supporting local farmers and choosing fresh, quality produce.
              </p>
              <div className="text-xs text-gray-500">
                <p>Questions? Contact us:</p>
                <p>📧 support@farmersbracket.com</p>
                <p>📱 +27 11 123 4567</p>
                <p>🌐 www.farmersbracket.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Print Generated Notice */}
        <div className="text-center mt-8 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            This invoice was generated electronically on {format(new Date(), 'dd MMM yyyy \'at\' HH:mm')} | FarmersBracket &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </>
  );
};

export default InvoiceReceipt;
