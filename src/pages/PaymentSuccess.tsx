import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAny } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errorUtils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle, Loader2, Package, ArrowLeft, Receipt, Download, Mail,
  Zap, ShoppingCart, ChevronRight, Repeat, MessageCircle, Sparkles,
  Timer, Heart, Info, Star, Share2, Facebook, Twitter, Instagram,
  Calendar, Clock, DollarSign, MapPin, Phone, Globe
} from "lucide-react";
import { PaymentStatus } from "@/lib/payfast";
import confetti from 'canvas-confetti';
import { addDays, addWeeks } from 'date-fns';

// Enhanced interfaces
interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  farmName: string;
  category: string;
  image?: string;
}

interface OrderSummary {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  tax: number;
  total: number;
  estimatedDelivery: string;
  farmDetails: FarmDetail[];
  paymentMethod: string;
  transactionId: string;
}

interface FarmDetail {
  id: string;
  name: string;
  image?: string;
  items: OrderItem[];
  estimatedPreparation: string;
  distance: number;
}

interface RecommendedProduct {
  id: string;
  name: string;
  price: number;
  image?: string;
  farmName: string;
  category: string;
  rating: number;
  inSeason: boolean;
  complementsOrder: boolean;
}

interface DeliveryTip {
  id: string;
  title: string;
  description: string;
  category: 'preparation' | 'storage' | 'nutrition' | 'usage';
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

interface RecurringOrderSuggestion {
  frequency: 'weekly' | 'biweekly' | 'monthly';
  discount: number;
  nextDelivery: string;
  savings: number;
}

// Minimal Supabase row shapes to avoid `any`
type SupabaseProductRow = {
  id: string;
  name?: string;
  price?: number;
  images?: string[];
  category?: string;
  farmer_id?: string;
};

type SupabaseOrderItemRow = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products?: SupabaseProductRow;
};

type SupabaseOrderRow = {
  id: string;
  order_items?: SupabaseOrderItemRow[];
  total: number;
};

// Local type for payments insert
type PaymentsInsert = {
  order_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  transaction_id: string;
  metadata?: Record<string, unknown>;
};

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clearCart, clearFarmCart } = useCart();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  // Core state
  const [loading, setLoading] = useState(true);
  const [orderCreated, setOrderCreated] = useState(false);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  // Prefer PayFast gross amount from URL if provided; fallback to order summary total
  const pfAmount = Number(searchParams.get('pf_amount_gross') || searchParams.get('amount_gross') || 0);

  // Enhanced features state
  const [confettiTriggered, setConfettiTriggered] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState<RecommendedProduct[]>([]);
  const [deliveryTips, setDeliveryTips] = useState<DeliveryTip[]>([]);
  const [recurringOrderSuggestion, setRecurringOrderSuggestion] = useState<RecurringOrderSuggestion | null>(null);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);

  // Dialog states
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [isRecommendationsDialogOpen, setIsRecommendationsDialogOpen] = useState(false);
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);

  const loadOrderSummary = React.useCallback(async (orderId: string) : Promise<OrderSummary | null> => {
    try {
        if (!user?.id) {
        console.error('User ID is required to load order summary');
        return null;
      }

      const { data: orderData, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              id,
              name,
              category,
              images,
              farmer_id
            )
          )
        `)
        .eq('id', orderId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (orderData) {
        // Get unique farmer IDs to fetch farm names
        const orderTyped = orderData as SupabaseOrderRow;
        const farmerIds = Array.from(new Set(
          (orderTyped.order_items || [])
            .map((item) => item.products?.farmer_id)
            .filter((v): v is string => Boolean(v))
        ));

        // Fetch farm names for the farmers
        const { data: farmsData } = await supabase
          .from('farms')
          .select('id, name, farmer_id')
          .in('farmer_id', farmerIds);

        const farmerToFarmMap = new Map<string, string>();
        (farmsData || []).forEach((farm: { farmer_id?: string; name?: string }) => {
          if (farm?.farmer_id) farmerToFarmMap.set(farm.farmer_id, farm.name || '');
        });

        // Transform order data
        const transformedOrder: OrderSummary = {
          id: orderData.id,
          orderNumber: orderData.id.substring(0, 8).toUpperCase(),
          items: (orderTyped.order_items || []).map((item) => {
            const farmerId = item.products?.farmer_id;
            const farmName = farmerId ? farmerToFarmMap.get(farmerId) || 'Unknown Farm' : 'Unknown Farm';
            
            return {
              id: item.id,
              productId: item.product_id,
              productName: item.products?.name || 'Unknown Product',
              quantity: item.quantity,
              unitPrice: item.unit_price,
              total: item.quantity * item.unit_price,
              farmName: farmName,
              category: item.products?.category || 'other',
              image: item.products?.images?.[0] || '/placeholder.svg'
            };
          }),
          subtotal: orderData.total,
          deliveryFee: 25.00, // Default delivery fee
          discount: 0,
          tax: orderData.total * 0.15, // 15% tax
          total: orderData.total,
          estimatedDelivery: addDays(new Date(), 2).toISOString(),
          farmDetails: [], // Will be populated from items
          paymentMethod: 'PayFast',
          transactionId: searchParams.get('pf_payment_id') || 'N/A'
        };

        // Group items by farm for farmDetails
  const farmMap = new Map<string, { name: string; items: OrderItem[] }>();
        transformedOrder.items.forEach(item => {
          if (!farmMap.has(item.farmName)) {
            farmMap.set(item.farmName, { name: item.farmName, items: [] });
          }
          farmMap.get(item.farmName)?.items.push(item);
        });

        transformedOrder.farmDetails = Array.from(farmMap.entries()).map(([farmName, data], index) => ({
          id: `farm_${index}`,
          name: farmName,
          items: data.items,
          estimatedPreparation: '4-8 hours',
          distance: Math.random() * 20 + 5 // Random distance between 5-25km
        }));

  setOrderSummary(transformedOrder);
  return transformedOrder;
      }
    } catch (error) {
      const msg = getErrorMessage(error);
      console.error('Error loading order summary:', msg);
      toast({
        title: "Error loading order details",
        description: msg || "Please try refreshing the page",
        variant: "destructive",
      });
      return null;
    }
    return null;
  }, [user, toast, searchParams]);

  const loadRecommendedProducts = React.useCallback(async () => {
    try {
      // Load related products from database (avoid nested relation which requires DB foreign key)
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, price, images, category, farmer_id')
        .limit(6);

      if (error) {
        console.error('Error loading recommended products:', error);
        return;
      }

      // If products were returned, fetch farmer names separately to avoid PostgREST relationship errors
      const productsTyped = products as SupabaseProductRow[] | null;
      const farmerIds = Array.from(new Set((productsTyped || [])
        .map((p) => p.farmer_id)
        .filter((v): v is string => Boolean(v))
      ));
  const farmerMap: Record<string, string> = {};
      if (farmerIds.length > 0) {
        try {
          const { data: farmsData } = await supabase
            .from('farms')
            .select('farmer_id, name')
            .in('farmer_id', farmerIds);

          (farmsData || []).forEach((f: { farmer_id?: string; name?: string }) => {
              if (f && f.farmer_id) farmerMap[f.farmer_id] = f.name || 'Unknown Farm';
            });
        } catch (e) {
          console.warn('Could not load farm names for recommendations', e);
        }
      }

      const recommendations: RecommendedProduct[] = (productsTyped || []).map((product) => ({
        id: product.id,
        name: product.name || 'Unknown',
        price: product.price || 0,
        image: Array.isArray(product.images) ? product.images[0] : product.images,
        farmName: product.farmer_id ? farmerMap[product.farmer_id] || 'Unknown Farm' : 'Unknown Farm',
        category: product.category || 'other',
        rating: 4.5, // Default rating since column doesn't exist yet
        inSeason: true,
        complementsOrder: true
      }));

      setRecommendedProducts(recommendations);
    } catch (error) {
      console.error('Error loading recommended products:', error);
    }
  }, []);

  const loadDeliveryTips = React.useCallback(() => {
    // Generate tips based on ordered products
    const staticTips: DeliveryTip[] = [
      {
        id: '1',
        title: 'Proper Storage',
        description: 'Store fresh produce in the refrigerator and dry goods in a cool, dry place',
        category: 'storage',
        icon: Package
      },
      {
        id: '2',
        title: 'Peak Freshness',
        description: 'Use leafy greens within 3-5 days and root vegetables within 1-2 weeks',
        category: 'preparation',
        icon: Timer
      },
      {
        id: '3',
        title: 'Nutritional Benefits',
        description: 'Fresh farm produce provides maximum nutritional value and flavor',
        category: 'nutrition',
        icon: Heart
      },
      {
        id: '4',
        title: 'Recipe Ideas',
        description: 'Visit our recipe section for inspiration using your fresh ingredients',
        category: 'usage',
        icon: Sparkles
      }
    ];
    setDeliveryTips(staticTips);
  }, []);

  const loadRecurringOrderSuggestion = React.useCallback(() => {
    // Generate recurring order suggestion based on order value
    const suggestion: RecurringOrderSuggestion = {
      frequency: 'weekly',
      discount: 10,
      nextDelivery: addWeeks(new Date(), 1).toISOString(),
      savings: orderSummary ? orderSummary.total * 0.1 * 52 : 0 // 10% savings annually
    };
    setRecurringOrderSuggestion(suggestion);
  }, [orderSummary]);

  const triggerConfetti = React.useCallback(() => {
    if (confettiTriggered) return;
    
    setConfettiTriggered(true);

    // Fire confetti from multiple angles
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: ReturnType<typeof setInterval> = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Fire from the left
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      
      // Fire from the right
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  }, [confettiTriggered]);

  useEffect(() => {
    const processPayment = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        // Get payment details from URL params
        const paymentId = searchParams.get('pf_payment_id');
        const orderId = searchParams.get('custom_str1') || searchParams.get('order_id'); // Fallback to order_id parameter
        const amount = searchParams.get('amount_gross');

        console.log('Payment Success URL params:', {
          paymentId,
          orderId,
          amount,
          allParams: Object.fromEntries(searchParams.entries())
        });

        // Debug: Log complete URL for PayFast parameter analysis
        console.log('Complete URL:', window.location.href);
        console.log('Search params string:', window.location.search);

        // If we have order_id but no payment_id, treat as successful payment
        // This handles PayFast sandbox which might not send all parameters
        if (orderId && !paymentId) {
          console.log('Payment completed with order_id but no PayFast payment_id - treating as successful payment from return URL');
          
          toast({
            title: "Payment Processing ⏳",
            description: "Payment completed! Confirming your order...",
          });
          
          // Continue with success flow even without PayFast payment_id
        } else if (!orderId) {
          console.log('No order ID found in payment success');
          toast({
            title: "Order Information Missing",
            description: "Unable to find order details. Please contact support.",
            variant: "destructive"
          });
          navigate('/payment-cancelled?reason=missing_order_info');
          return;
        }

        // Idempotency: avoid re-processing the same order in this browser session
        const processedKey = orderId ? `payment_processed_${orderId}` : null;
        if (processedKey && localStorage.getItem(processedKey)) {
          console.log('Order processing already handled in this session, skipping:', orderId);
          setLoading(false);
          return;
        }

        // Idempotency: check existing order status and avoid re-processing if already confirmed
        try {
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('id, status')
            .eq('id', orderId)
            .eq('user_id', user.id)
            .single();

          if (existingOrder && ['confirmed', 'delivered', 'processing'].includes(String(existingOrder.status))) {
            console.log('Order already confirmed, skipping re-processing:', orderId);
            // Ensure we still load summary and recommendations for UX
            // Clear only the cart items that belong to this order's farms
            try {
              const savedOrder = await loadOrderSummary(orderId);
              if (savedOrder) {
                const farms = Array.from(new Set(savedOrder.items.map((i: OrderItem) => i.farmName)));
                farms.forEach(farm => {
                  try { clearFarmCart(farm); } catch (e) { console.warn('clearFarmCart failed for', farm, getErrorMessage(e)); }
                });
              }
            } catch (e) { console.warn('Could not selectively clear cart for confirmed order', getErrorMessage(e)); }
            setOrderCreated(true);
            const loaded = await loadOrderSummary(orderId);
            await loadRecommendedProducts();
            loadDeliveryTips();
            // Only show recurring suggestion if order is eligible
            if (loaded && loaded.total > 100) loadRecurringOrderSuggestion();
            // Mark processed in localStorage so repeated mounts won't re-run work
            try { if (processedKey) localStorage.setItem(processedKey, '1'); } catch(e) { console.warn('Could not set processed flag', getErrorMessage(e)); }
            setLoading(false);
            return;
          }

          // Update order status in database
          const { error: orderError } = await supabase
            .from('orders')
            .update({
              status: 'processing',
              payment_method: 'PayFast',
              payment_status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .eq('user_id', user.id);

          if (orderError) throw orderError;
        } catch (e) {
          console.error('Error checking/updating order status for idempotency:', e);
          // proceed, attempt update below if possible
        }

  // Create payment record (only if we have payment ID from PayFast)
        if (paymentId) {
          try {
            const payload: PaymentsInsert = {
              order_id: orderId,
              user_id: user.id,
              amount: Number.isFinite(Number(amount)) ? parseFloat(amount || '0') : 0,
              currency: 'ZAR',
              status: PaymentStatus.COMPLETED as unknown as string,
              payment_method: 'payfast',
              transaction_id: paymentId,
              metadata: {
                payfast_payment_id: paymentId,
                payment_date: new Date().toISOString()
              }
            };

            const { error: paymentError } = await (supabaseAny)
              .from('payments')
              .insert([payload]);

            if (paymentError) {
              console.warn('Payment record creation failed:', paymentError);
              // Don't throw error as order is already updated
            }
            } catch (err) {
              console.warn('Payment table not yet deployed or insert failed:', getErrorMessage(err));
            }
        }

  // Clear cart items for the farms that were part of the order and set order data
        try {
          const loaded = await loadOrderSummary(orderId);
          if (loaded) {
            const farms = Array.from(new Set(loaded.items.map(i => i.farmName)));
            // clear only items from these farms
            farms.forEach(farm => {
              try { clearFarmCart(farm); } catch (e) { console.warn('clearFarmCart failed for', farm, e); }
            });
          } else {
            // fallback: clear entire cart if we couldn't determine farms
            clearCart();
          }
        } catch (e) {
          console.warn('Error during selective cart clear:', e);
          clearCart();
        }
        setOrderCreated(true);
        
        // Load real order data
  const loadedSummary = await loadOrderSummary(orderId);
  await loadRecommendedProducts();
  loadDeliveryTips();
  // Only suggest recurring orders for meaningful orders (e.g., > R100)
  if (loadedSummary && loadedSummary.total > 100) loadRecurringOrderSuggestion();

  // Mark processed in localStorage so repeated mounts won't re-run work
  try { if (processedKey) localStorage.setItem(processedKey, '1'); } catch(e) { console.warn('Could not set processed flag', getErrorMessage(e)); }

        // Trigger confetti after short delay
        setTimeout(() => {
          triggerConfetti();
        }, 500);

        // Show review prompt after 3 seconds
        setTimeout(() => {
          setShowReviewPrompt(true);
        }, 3000);

        toast({
          title: "Payment Confirmed! 🎉",
          description: paymentId 
            ? `Payment of ${amount ? `R${amount}` : 'your order'} has been successfully processed.`
            : "Your order has been confirmed and is being processed.",
        });

      } catch (error) {
        const msg = getErrorMessage(error);
        console.error('Payment processing error:', msg);
        toast({
          title: "Payment Verification Failed",
          description: msg || "Please contact support if your payment was deducted.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    processPayment();
  }, [user, searchParams, clearCart, clearFarmCart, toast, navigate, loadOrderSummary, loadRecommendedProducts, loadDeliveryTips, loadRecurringOrderSuggestion, triggerConfetti]);

  // triggerConfetti defined above (stable via useCallback)

  const handleDownloadReceipt = () => {
    // In real app, generate and download PDF receipt
    toast({
      title: "Receipt generated",
      description: "Your receipt has been downloaded",
    });
  };

  const handleEmailReceipt = () => {
    // In real app, send email receipt
    toast({
      title: "Receipt sent",
      description: "Receipt has been sent to your email",
    });
  };

  const handleSetupRecurring = () => {
    // In real app, navigate to subscription setup
    toast({
      title: "Recurring order setup",
      description: "Setting up your recurring order...",
    });
    setIsRecurringDialogOpen(false);
  };

  const handleAddToCart = (productId: string) => {
    // In real app, add product to cart
    toast({
      title: "Added to cart",
      description: "Product has been added to your cart",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(price);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'storage': return Package;
      case 'preparation': return Timer;
      case 'nutrition': return Heart;
      case 'usage': return Sparkles;
      default: return Info;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-lg font-semibold mb-2">Verifying Payment</h2>
            <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Payment Successful!</h1>
                <p className="text-sm text-muted-foreground">Order confirmed</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsReceiptDialogOpen(true)}>
                <Receipt className="h-4 w-4 mr-2" />
                Receipt
              </Button>
              <Button size="sm" onClick={() => navigate(`/track-order/${orderSummary?.id}`)}>
                <Package className="h-4 w-4 mr-2" />
                Track Order
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Success Celebration */}
        <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6 text-center">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">Order Confirmed! 🎉</h2>
            <p className="text-green-700 mb-4">
              Your payment has been processed successfully
            </p>
            
            {orderSummary && (
              <div className="bg-card/80 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-green-600 font-medium">Order Number:</span>
                        <p className="font-bold">{orderSummary.orderNumber}</p>
                      </div>
                      <div>
                        <span className="text-green-600 font-medium">Total Amount:</span>
                        <p className="font-bold">{formatPrice(pfAmount > 0 ? pfAmount : (orderSummary.total || 0))}</p>
                      </div>
                      <div>
                        <span className="text-green-600 font-medium">Payment Method:</span>
                        <p className="font-bold">{orderSummary.paymentMethod}</p>
                      </div>
                      <div>
                        <span className="text-green-600 font-medium">Transaction ID:</span>
                        <p className="font-bold">{orderSummary.transactionId}</p>
                      </div>
                    </div>
              </div>
            )}

            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => setIsReceiptDialogOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                Download Receipt
              </Button>
              <Button variant="outline" onClick={handleEmailReceipt}>
                <Mail className="h-4 w-4 mr-2" />
                Email Receipt
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Summary */}
            {orderSummary && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {orderSummary.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{item.productName}</h4>
                        <p className="text-xs text-muted-foreground">{item.farmName}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatPrice(item.total)}</p>
                        <p className="text-xs text-muted-foreground">{formatPrice(item.unitPrice)} each</p>
                      </div>
                    </div>
                  ))}

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatPrice(orderSummary.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Fee:</span>
                      <span>{formatPrice(orderSummary.deliveryFee)}</span>
                    </div>
                    {orderSummary.discount !== 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span>{formatPrice(orderSummary.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>{formatPrice(orderSummary.tax)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>{formatPrice(orderSummary.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Farm Details */}
            {orderSummary?.farmDetails && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Farm Partners
                  </CardTitle>
                  <CardDescription>
                    Your order includes products from these local farms
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {orderSummary.farmDetails.map((farm) => (
                    <div key={farm.id} className="p-4 border rounded-lg">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                          <Globe className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{farm.name}</h4>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Prep: {farm.estimatedPreparation}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {farm.distance}km away
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Items: {farm.items.map(item => item.productName).join(', ')}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Delivery Preparation Tips removed as requested */}
          </div>

          {/* Right Column - Actions & Recommendations */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  onClick={() => navigate(`/track-order/${orderSummary?.id}`)}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Track Your Order
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setIsRecurringDialogOpen(true)}
                >
                  <Repeat className="h-4 w-4 mr-2" />
                  Set Up Recurring Order
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setIsRecommendationsDialogOpen(true)}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Recommended Products
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/messages')}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Contact Support
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </CardContent>
            </Card>

            {/* Next Delivery Estimation */}
            {recurringOrderSuggestion && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <Calendar className="h-5 w-5" />
                    Auto-Delivery Savings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-800">
                        {recurringOrderSuggestion.discount}% OFF
                      </p>
                      <p className="text-sm text-blue-700">
                        on {recurringOrderSuggestion.frequency} deliveries
                      </p>
                    </div>
                    
                    <div className="bg-white/50 rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-blue-600">Next Delivery:</span>
                          <p className="font-semibold">
                            {new Date(recurringOrderSuggestion.nextDelivery).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-blue-600">Annual Savings:</span>
                          <p className="font-semibold">{formatPrice(recurringOrderSuggestion.savings)}</p>
                        </div>
                      </div>
                    </div>

                    <Button 
                      className="w-full"
                      onClick={() => setIsRecurringDialogOpen(true)}
                    >
                      Set Up Auto-Delivery
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Review Prompt */}
            {showReviewPrompt && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-800">
                    <Star className="h-5 w-5" />
                    Share Your Experience
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-yellow-700 mb-4">
                    Help other customers by sharing your experience with these farms
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => navigate('/product-reviews')}>
                      <Star className="h-4 w-4 mr-2" />
                      Write Review
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowReviewPrompt(false)}>
                      Later
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Share Success */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Share the Love
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Tell your friends about fresh farm products
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Facebook className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Twitter className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Instagram className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Receipt Dialog */}
      <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Receipt</DialogTitle>
          </DialogHeader>
          
          {orderSummary && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <h3 className="font-bold text-lg">{orderSummary.orderNumber}</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date().toLocaleDateString()}
                </p>
                <p className="text-lg font-bold text-primary">
                  {formatPrice(orderSummary.total)}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span>{orderSummary.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transaction ID:</span>
                  <span>{orderSummary.transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Items:</span>
                  <span>{orderSummary.items.length} items</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleDownloadReceipt}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handleEmailReceipt}>
              <Mail className="h-4 w-4 mr-2" />
              Email Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recommendations Dialog */}
      <Dialog open={isRecommendationsDialogOpen} onOpenChange={setIsRecommendationsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recommended for You</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {recommendedProducts.map((product) => (
              <div key={product.id} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{product.name}</h4>
                    {product.inSeason && (
                      <Badge variant="secondary" className="text-xs">In Season</Badge>
                    )}
                    {product.complementsOrder && (
                      <Badge variant="outline" className="text-xs">Pairs Well</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{product.farmName}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{product.rating}</span>
                    </div>
                    <span>•</span>
                    <span className="font-semibold">{formatPrice(product.price)}</span>
                  </div>
                </div>

                <Button size="sm" onClick={() => handleAddToCart(product.id)}>
                  Add to Cart
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecommendationsDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => navigate('/browse-products')}>
              Browse All Products
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recurring Order Dialog */}
      <Dialog open={isRecurringDialogOpen} onOpenChange={setIsRecurringDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Up Recurring Order</DialogTitle>
          </DialogHeader>
          
          {recurringOrderSuggestion && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <h3 className="font-bold text-blue-800">
                  Save {recurringOrderSuggestion.discount}% on Every Order
                </h3>
                <p className="text-sm text-blue-700">
                  Get your favorites delivered {recurringOrderSuggestion.frequency}
                </p>
                <p className="text-lg font-bold text-blue-800 mt-2">
                  {formatPrice(recurringOrderSuggestion.savings)} saved annually
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Delivery Frequency:</span>
                  <span className="font-semibold capitalize">{recurringOrderSuggestion.frequency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Next Delivery:</span>
                  <span className="font-semibold">
                    {new Date(recurringOrderSuggestion.nextDelivery).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discounted Price:</span>
                  <span className="font-semibold text-green-600">
                    {formatPrice(orderSummary?.total ? orderSummary.total * (1 - recurringOrderSuggestion.discount / 100) : 0)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  You can modify or cancel your subscription anytime in your account settings.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecurringDialogOpen(false)}>
              Not Now
            </Button>
            <Button onClick={handleSetupRecurring}>
              Set Up Auto-Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentSuccess;