import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, supabaseAny } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Order } from "@/types/order";
import { ArrowLeft, Package, Truck, CheckCircle, Clock, Phone, MessageCircle, MapPin, Calendar, Info, Package2, ShoppingCart, Printer } from "lucide-react";
import BottomNavBar from "@/components/BottomNavBar";
import InvoiceReceipt from "@/components/InvoiceReceipt";

const TrackOrder = () => {
  const { orderId: paramOrderId } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = paramOrderId || searchParams.get('orderId');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  type TrackProduct = {
    id: string;
    name?: string | null;
    description?: string | null;
    images?: string[] | null;
    farmer_id?: string | null;
    unit?: string | null;
    price?: number | null;
  };

  type TrackOrderItem = {
    id: string;
    quantity: number;
    unit_price: number;
    products?: TrackProduct | null;
    created_at?: string;
    product_id?: string;
    order_id?: string;
  };

  type TrackOrder = {
    id: string;
    order_items?: TrackOrderItem[];
    status?: string;
    total?: number;
    created_at?: string;
    updated_at?: string;
    payment_status?: string;
    farmName?: string;
    delivery_method?: string;
    estimated_delivery?: string;
    delivery_instructions?: string;
    payment_method?: string;
    payment_method_selected?: string;
    payment_reference?: string;
    pricing?: {
      subtotal: number;
      shipping: number;
      tax: number;
      discount: number;
      grandTotal: number;
    };
  } & Record<string, unknown> | null;

  type RecurringInfo = { frequency?: string; next_delivery?: string; is_active?: boolean } | null;

  const [order, setOrder] = useState<TrackOrder>(null);
  const [recurring, setRecurring] = useState<RecurringInfo>(null);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<{ name?: string; email?: string; phone?: string; shippingAddress?: string } | null>(null);

  const loadOrder = useCallback(async () => {
    if (!orderId || !user?.id) return;
    try {
      setLoading(true);
      // Fetch order with items and product details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`*, order_items (*, products (id, name, description, images, price, category, farmer_id, unit))`)
        .eq("id", orderId)
        .eq("user_id", user.id)
        .single();
      if (orderError || !orderData) {
        toast({ title: "Error", description: orderError?.message || "Order not found.", variant: "destructive" });
        setOrder(null);
        setLoading(false);
        navigate('/order-history');
        return;
      }
      // Fetch farm name
      let farmName = "Unknown Farm";
      const firstItem = orderData.order_items?.[0];
      const farmerId = firstItem?.products?.farmer_id;
      if (farmerId) {
        const { data: farmData } = await supabase
          .from("farms")
          .select("name")
          .eq("farmer_id", farmerId)
          .single();
        if (farmData?.name) farmName = farmData.name;
      }
      // Fetch customer profile from 'profiles' table
      const customerObj = {
        name: "",
        email: user?.email || "",
        phone: "",
        shippingAddress: orderData.shipping_address || "",
      };
      const { data: profileData } = await supabase
        .from("profiles")
        .select("name, phone")
        .eq("id", user.id)
        .single();
      if (profileData) {
        customerObj.name = profileData.name || "";
        customerObj.phone = profileData.phone || "";
      }
      setCustomer(customerObj);
      // Calculate pricing breakdown
      const subtotal = (orderData.order_items || []).reduce((sum: number, item: TrackOrderItem) => sum + ((item.unit_price || 0) * (item.quantity || 0)), 0) || 0;
      const shipping = 0; // Add logic if available
      const tax = 0; // Add logic if available
      const discount = 0; // Add logic if available
      const grandTotal = orderData.total || subtotal;
      // Prepare products list
      const products = (orderData.order_items || []).map((item: TrackOrderItem) => ({
        name: item.products?.name || "Unknown Product",
        description: item.products?.description || "",
        image: (Array.isArray(item.products?.images) ? item.products!.images[0] : undefined) || "/placeholder.svg",
        quantity: item.quantity || 0,
        price: item.unit_price || 0,
        unit: item.products?.unit || "",
      }));
      setOrder({
        ...orderData,
        farmName,
        products,
        pricing: { subtotal, shipping, tax, discount, grandTotal },
      } as unknown as TrackOrder);
      // Fetch recurring order info (optional table, may not exist)
      try {
        // recurring_orders may be an optional table in some deployments; use untyped client
        const { data: recurringData } = await supabaseAny
          .from('recurring_orders')
          .select('frequency, next_delivery, is_active')
          .eq('order_id', orderId)
          .single();
        if (recurringData) setRecurring(recurringData as RecurringInfo);
      } catch (recurringError) {
        console.log('Recurring orders table not available:', recurringError);
        // This is fine, recurring orders is an optional feature
      }
    } catch (error) {
      console.error('Error loading order:', error);
      toast({ title: "Error", description: "Failed to load order details", variant: "destructive" });
      navigate('/order-history');
    } finally {
      setLoading(false);
    }
  }, [orderId, user?.id, user?.email, toast, navigate]);

  useEffect(() => {
    if (user && orderId) {
      loadOrder();
    } else if (!orderId) {
      setLoading(false);
    }
  }, [orderId, user, loadOrder]);
  

  const getStatusProgress = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 25;
      case 'confirmed': case 'processing': return 50;
      case 'preparing': case 'ready': return 75;
      case 'out_for_delivery': case 'shipped': return 90;
      case 'delivered': return 100;
      case 'cancelled': return 0;
      default: return 25;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      case 'out_for_delivery': case 'shipped': return 'bg-blue-500';
      case 'processing': case 'preparing': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered': return CheckCircle;
      case 'out_for_delivery': case 'shipped': return Truck;
      case 'processing': case 'preparing': return Package;
      default: return Clock;
    }
  };

  const handlePrintInvoice = () => {
    if (!order) {
      toast({
        title: "Print Error",
        description: "Order data not available for printing",
        variant: "destructive"
      });
      return;
    }
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Print Error",
        description: "Please allow popups to print the invoice",
        variant: "destructive"
      });
      return;
    }

    // Get the invoice HTML content
    const invoiceElement = document.getElementById('invoice-content');
    if (invoiceElement) {
      const invoiceHTML = invoiceElement.innerHTML;
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice - ${order.id?.slice(0,8)?.toUpperCase() || 'INVOICE'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Arial', sans-serif; 
              line-height: 1.6; 
              color: #333;
              background: white;
            }
            .invoice-printable { 
              max-width: 210mm; 
              margin: 0 auto; 
              padding: 20px;
              background: white;
            }
            .grid { display: flex; flex-wrap: wrap; gap: 1rem; }
            .grid-cols-2 > * { flex: 1; min-width: 45%; }
            .bg-green-600 { background-color: #059669 !important; }
            .text-white { color: white !important; }
            .bg-gray-50 { background-color: #f9fafb; }
            .bg-green-50 { background-color: #f0fdf4; }
            .bg-blue-50 { background-color: #eff6ff; }
            .border { border: 1px solid #e5e7eb; }
            .border-green-600 { border-color: #059669; }
            .border-green-200 { border-color: #bbf7d0; }
            .border-blue-200 { border-color: #bfdbfe; }
            .border-gray-200 { border-color: #e5e7eb; }
            .border-gray-300 { border-color: #d1d5db; }
            .rounded { border-radius: 0.375rem; }
            .rounded-full { border-radius: 50%; }
            .rounded-lg { border-radius: 0.5rem; }
            .p-3 { padding: 0.75rem; }
            .p-4 { padding: 1rem; }
            .p-6 { padding: 1.5rem; }
            .px-4 { padding-left: 1rem; padding-right: 1rem; }
            .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
            .pt-2 { padding-top: 0.5rem; }
            .pt-4 { padding-top: 1rem; }
            .pt-6 { padding-top: 1.5rem; }
            .pb-2 { padding-bottom: 0.5rem; }
            .pb-6 { padding-bottom: 1.5rem; }
            .mt-2 { margin-top: 0.5rem; }
            .mt-8 { margin-top: 2rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-3 { margin-bottom: 0.75rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mb-8 { margin-bottom: 2rem; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            .space-y-2 > * + * { margin-top: 0.5rem; }
            .text-xs { font-size: 0.75rem; }
            .text-sm { font-size: 0.875rem; }
            .text-lg { font-size: 1.125rem; }
            .text-xl { font-size: 1.25rem; }
            .text-2xl { font-size: 1.5rem; }
            .text-3xl { font-size: 1.875rem; }
            .font-medium { font-weight: 500; }
            .font-semibold { font-weight: 600; }
            .font-bold { font-weight: 700; }
            .text-gray-400 { color: #9ca3af; }
            .text-gray-500 { color: #6b7280; }
            .text-gray-600 { color: #4b5563; }
            .text-gray-800 { color: #1f2937; }
            .text-green-700 { color: #047857; }
            .text-blue-700 { color: #1d4ed8; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .flex { display: flex; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            .w-16 { width: 4rem; }
            .h-16 { height: 4rem; }
            .object-cover { object-fit: cover; }
            .overflow-hidden { overflow: hidden; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 0.75rem; border: 1px solid #e5e7eb; }
            thead th { background-color: #059669; color: white; font-weight: 600; }
            tbody tr:nth-child(even) { background-color: #f9fafb; }
            .border-t { border-top: 1px solid #e5e7eb; }
            .border-b { border-bottom: 1px solid #e5e7eb; }
            .border-t-2 { border-top: 2px solid; }
            .border-b-2 { border-bottom: 2px solid; }
            @media print {
              body { print-color-adjust: exact; }
              .invoice-printable { margin: 0; padding: 15px; }
            }
          </style>
        </head>
        <body>
          ${invoiceHTML}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      
      // Small delay to ensure content is loaded before printing
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    } else {
      toast({
        title: "Print Error",
        description: "Invoice content not found. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
          <div className="p-4 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/order-history')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-semibold">Track Order</h1>
          </div>
        </header>
        <main className="p-4">
          <Card className="text-center py-12">
            <CardContent>
              <Package2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Order Not Found</h3>
              <p className="text-muted-foreground mb-6">
                The order you're looking for doesn't exist or you don't have permission to view it.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => navigate('/order-history')}>
                  View Order History
                </Button>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(order.status);
  const statusProgress = getStatusProgress(order.status);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="p-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/order-history')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Track Order</h1>
            <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6 pb-24">
        {/* Order Summary */}
        {recurring && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Recurring Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div><strong>Frequency:</strong> {recurring.frequency}</div>
                <div><strong>Next Delivery:</strong> {recurring.next_delivery ? new Date(recurring.next_delivery).toLocaleDateString() : 'N/A'}</div>
                <div><strong>Status:</strong> {recurring.is_active ? 'Active' : 'Inactive'}</div>
              </div>
              <Button variant="outline" className="mt-3">Manage Recurring Order</Button>
            </CardContent>
          </Card>
        )}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Order ID</span>
                  <span className="font-medium">{order.id}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="font-medium">{order.created_at}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="font-medium">{order.status}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Payment</span>
                  <span className="font-medium">{order.payment_status}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Farm</span>
                  <span className="font-medium">{order.farmName}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Customer</span>
                  <span className="font-medium">{customer?.name || 'N/A'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="font-medium">{customer?.email || 'N/A'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <span className="font-medium">{customer?.phone || 'N/A'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Shipping Address</span>
                  <span className="font-medium break-words">{customer?.shippingAddress || 'N/A'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tracking Progress */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className={`p-3 rounded-full ${getStatusColor(order.status)}`}>
                <StatusIcon className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">
              {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ')}
            </CardTitle>
            <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="mt-2">
              {order.payment_status === 'completed' ? 'Paid' : 'Pending Payment'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Order Progress</span>
                <span>{statusProgress}%</span>
              </div>
              <Progress value={statusProgress} className="h-2" />
            </div>

            {order.estimated_delivery && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Estimated Delivery</p>
                  <p className="text-sm text-muted-foreground">{order.estimated_delivery}</p>
                </div>
              </div>
            )}

            {/* Only show delivery address if delivery method is not collection */}
            {order.delivery_method !== 'collection' && order.delivery_method !== 'collect' && (
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Delivery Address</p>
                  <p className="text-sm text-muted-foreground">{customer?.shippingAddress || 'No address provided'}</p>
                  {order.delivery_instructions && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Instructions: {order.delivery_instructions}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Show collection info if collection is selected */}
            {(order.delivery_method === 'collection' || order.delivery_method === 'collect') && (
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Collection Point</p>
                  <p className="text-sm text-muted-foreground">Farm Collection - Please contact the farm for collection details</p>
                  {order.delivery_instructions && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Instructions: {order.delivery_instructions}
                    </p>
                  )}
                </div>
              </div>
            )}

            {customer?.phone && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Contact Number</p>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(order.order_items || []).map((oi: TrackOrderItem, idx: number) => {
                const p = oi.products || {};
                const quantity = oi.quantity || 0;
                const unitPrice = oi.unit_price || 0;
                return (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      {Array.isArray(p.images) && p.images[0] && (
                        <img src={p.images[0]} alt={p.name || ''} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm">{p.name || 'Unknown Product'}</h4>
                        <p className="text-xs text-muted-foreground break-words">{p.description || ''}</p>
                      </div>
                    </div>
                    <div className="flex justify-between sm:justify-end gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground">Qty</p>
                        <p className="font-medium">{quantity}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Unit Price</p>
                        <p className="font-medium">R{unitPrice.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium">R{p.total.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Pricing Breakdown */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Pricing Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">R{order.pricing.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping:</span>
                <span className="font-medium">R{order.pricing.shipping.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span className="font-medium">R{order.pricing.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount:</span>
                <span className="font-medium text-green-600">-R{order.pricing.discount.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total:</span>
                <span>R{order.pricing.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping & Delivery */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Shipping & Delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Delivery Method:</span>
                <span className="font-medium capitalize">
                  {order.delivery_method === 'collection' || order.delivery_method === 'collect' 
                    ? 'Farm Collection' 
                    : order.delivery_method || 'Standard Delivery'
                  }
                </span>
              </div>
              {order.delivery_method !== 'collection' && order.delivery_method !== 'collect' && (
                <div className="flex justify-between">
                  <span>Estimated Delivery:</span>
                  <span className="font-medium">{order.estimated_delivery || order.updated_at || 'TBD'}</span>
                </div>
              )}
              {(order.delivery_method === 'collection' || order.delivery_method === 'collect') && (
                <div className="flex justify-between">
                  <span>Collection Time:</span>
                  <span className="font-medium">Contact farm for availability</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <span className="font-medium capitalize">
                  {order.payment_method_selected || order.payment_method || 'PayFast'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Payment Status:</span>
                <span className={`font-medium capitalize ${
                  order.payment_status === 'completed' || order.payment_status === 'paid' 
                    ? 'text-green-600' 
                    : order.payment_status === 'failed' 
                    ? 'text-red-600' 
                    : 'text-yellow-600'
                }`}>
                  {order.payment_status || 'Pending'}
                </span>
              </div>
              {order.payment_reference && (
                <div className="flex justify-between">
                  <span>Reference:</span>
                  <span className="font-medium text-sm">{order.payment_reference}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {order.status === "delivered" && (
                <>
                  <Button variant="outline">Request Return</Button>
                  <Button variant="outline">Request Refund</Button>
                </>
              )}
              <Button variant="default" onClick={handlePrintInvoice} className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Print Invoice
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help & Navigation */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <Button variant="outline" className="flex items-center gap-2" onClick={() => navigate('/contact-support')}>
                <Phone className="h-4 w-4" />
                Call Support
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons - with proper spacing for bottom nav */}
        <div className="flex gap-3 mb-6 px-2">
          <Button 
            variant="outline" 
            onClick={() => navigate('/order-history')}
            className="flex-1 h-12 text-sm font-medium border-2 border-gray-300 hover:border-gray-400 shadow-sm"
          >
            📋 View All Orders
          </Button>
          <Button 
            onClick={() => navigate('/dashboard')}
            className="flex-1 h-12 text-sm font-medium bg-green-600 hover:bg-green-700 text-white shadow-md"
          >
            🛒 Start Shopping
          </Button>
        </div>

        {/* Bottom Navigation Bar */}
        <BottomNavBar />

        {/* Hidden Invoice for Printing */}
        <div id="invoice-content" className="hidden">
          {order && (
            <InvoiceReceipt 
              order={order} 
              user={customer ? { 
                name: customer?.name || customer?.email?.split('@')?.[0] || 'Customer',
                email: customer?.email || ''
              } : { 
                name: 'Customer',
                email: ''
              }} 
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default TrackOrder;