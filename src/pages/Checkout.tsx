import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getStripe, confirmStripePayment, createPaymentIntent } from "../lib/stripePayment";
import { payFastService, PAYFAST_CONFIG } from "../lib/payfast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { scaleButton } from "@/lib/animations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  ArrowLeft, 
  MapPin, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  ShieldCheck,
  Clock,
  Truck,
  Edit,
  Plus,
  CheckCircle,
  AlertCircle,
  Wallet,
  Building,
  Phone,
  Calendar as CalendarIcon,
  Heart,
  DollarSign,
  Zap,
  Save,
  Star,
  User,
  CopyCheck,
  Repeat,
  ShoppingCart
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useCart, FarmGroup } from "@/contexts/CartContext";
import { useAppState } from "@/contexts/AppStateContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, supabaseAny } from "@/integrations/supabase/client";
import PaymentMethodDialog from "@/components/PaymentMethodDialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import ErrorBoundary from "../components/ErrorBoundary";

// Promo code interface
interface PromoCode {
  id: string;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value?: number;
  max_discount_cap?: number;
  start_date: string;
  end_date: string;
  usage_limit?: number;
  used_count: number;
  is_active: boolean;
  applicable_categories?: string[];
}

const Checkout = () => {
  const { cartItems, getTotalPrice, clearCart, getFarmGroups, clearFarmCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get farm name from URL params for farm-specific checkout
  const farmName = searchParams.get('farm');
  
  // Get the specific farm group or all farms if no farm specified
  const farmGroups = getFarmGroups();
  const selectedFarmGroup = farmName 
    ? farmGroups.find(group => group.farmName === farmName)
    : null;
  
  // Use farm-specific items or all items
  const checkoutItems = selectedFarmGroup ? selectedFarmGroup.items : cartItems;
  const checkoutTotal = selectedFarmGroup ? selectedFarmGroup.totalPrice : getTotalPrice();
  
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    address: '',
    email: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Delivery method selection
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'collection'>('delivery');
  
  // Promo code system
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [showPromoSection, setShowPromoSection] = useState(false);
  
  // Use geocoding result for delivery distance
  const userDeliveryDistance = 0; // TODO: set this from your actual geocoding integration
  const deliveryDistance = userDeliveryDistance;

  // Smart Delivery fee logic
  const calculateDeliveryFee = (distance: number, orderTotal: number, totalWeight: number, specialItemsFee: number) => {
    // Free delivery for orders over R500
    if (orderTotal >= 500) {
      return 0;
    }

    // Distance-based pricing
    let distanceFee = 0;
    if (distance <= 7) {
      distanceFee = 30;
    } else if (distance <= 14) {
      distanceFee = 50;
    } else if (distance <= 21) {
      distanceFee = 80;
    } else if (distance <= 70) {
      distanceFee = 100;
    } else {
      // Distance over 70km - delivery not available
      return -1; // Special value to indicate delivery not available
    }

    // Weight-based charges (free under 7kg, R7 per kg over 7kg)
    let weightFee = 0;
    if (totalWeight > 7) {
      weightFee = Math.ceil(totalWeight - 7) * 7;
    }

    return distanceFee + weightFee + specialItemsFee;
  };

  // Calculate total weight of cart items (assuming 1kg per item for now)
  const calculateTotalWeight = (items: typeof checkoutItems) => {
    // TODO: Add weight field to products and use actual weight
    // For now, estimate 1kg per item
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  // Calculate special items fee (TODO: Add special item categories to products)
  const calculateSpecialItemsFee = (items: typeof checkoutItems) => {
    // TODO: Implement based on product categories
    // For now, return 0 - you can add special item logic later
    return 0;
  };

  // Promo code validation function
  const validatePromoCode = async (code: string) => {
    if (!code.trim()) {
      setPromoError('Please enter a promo code');
      return false;
    }

    setIsValidatingPromo(true);
    setPromoError('');

    try {
      // TODO: Fix promo_codes table integration - temporarily disabled
      setPromoError('Promo code system is temporarily disabled');
      return false;
      
      /*
      const { data: promoData, error } = await supabaseAny
        .from('promo_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !promoData) {
        setPromoError('Invalid promo code');
        return false;
      }

      // Check if promo code is still valid (dates)
      const now = new Date();
      const startDate = new Date(promoData.start_date);
      const endDate = new Date(promoData.end_date);

      if (now < startDate) {
        setPromoError('This promo code is not yet active');
        return false;
      }

      if (now > endDate) {
        setPromoError('This promo code has expired');
        return false;
      }

      // Check usage limit
      if (promoData.usage_limit && promoData.used_count >= promoData.usage_limit) {
        setPromoError('This promo code has reached its usage limit');
        return false;
      }

      // Check minimum order value
      if (promoData.min_order_value && checkoutTotal < promoData.min_order_value) {
        setPromoError(`Minimum order value of R${promoData.min_order_value} required`);
        return false;
      }

      // Valid promo code
      setAppliedPromo(promoData);
      toast({ 
        title: "Promo Code Applied!", 
        description: `${promoData.description} applied to your order`,
        variant: "default"
      });
      return true;
      */

    } catch (error) {
      const msg = getErrorMessage(error);
      console.error('Promo validation error:', msg);
      setPromoError(msg || 'Error validating promo code');
      return false;
    } finally {
      setIsValidatingPromo(false);
    }
  };

  // Calculate discount amount
  const calculateDiscount = () => {
    if (!appliedPromo) return 0;

    let discountAmount = 0;
    
    if (appliedPromo.discount_type === 'percentage') {
      discountAmount = (checkoutTotal * appliedPromo.discount_value) / 100;
    } else if (appliedPromo.discount_type === 'fixed') {
      discountAmount = appliedPromo.discount_value;
    }

    // Apply maximum discount cap if set
    if (appliedPromo.max_discount_cap && discountAmount > appliedPromo.max_discount_cap) {
      discountAmount = appliedPromo.max_discount_cap;
    }

    // Don't let discount exceed subtotal
    return Math.min(discountAmount, checkoutTotal);
  };

  // Handle promo code application
  const handleApplyPromo = async () => {
    const isValid = await validatePromoCode(promoCode);
    if (!isValid) {
      setAppliedPromo(null);
    }
  };

  // Handle promo code removal
  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
    toast({ 
      title: "Promo Code Removed", 
      description: "Discount has been removed from your order"
    });
  };

  const totalWeight = calculateTotalWeight(checkoutItems);
  const specialItemsFee = calculateSpecialItemsFee(checkoutItems);
  // Only calculate delivery fee if delivery method is selected
  const deliveryFee = deliveryMethod === 'collection' ? 0 : calculateDeliveryFee(deliveryDistance, checkoutTotal, totalWeight, specialItemsFee);
  
  // Calculate what delivery would cost (for display purposes, regardless of selected method)
  const potentialDeliveryFee = calculateDeliveryFee(deliveryDistance, checkoutTotal, totalWeight, specialItemsFee);
  
  // Calculate discount and final totals
  const discountAmount = calculateDiscount();
  const subtotalAfterDiscount = checkoutTotal - discountAmount;
  const finalTotal = deliveryFee === -1 ? subtotalAfterDiscount : subtotalAfterDiscount + deliveryFee;

  // Delivery fee breakdown for display
  const getDeliveryBreakdown = () => {
    if (checkoutTotal >= 500) {
      return { 
        isFree: true, 
        reason: "Free delivery for orders over R500",
        breakdown: []
      };
    }

    const breakdown: Array<{ label: string; amount: number }> = [];
    
    // Distance fee (calculated but not shown in breakdown)
    let distanceFee = 0;
    if (deliveryDistance <= 2) {
      distanceFee = 30;
    } else if (deliveryDistance <= 5) {
      distanceFee = 50;
    } else if (deliveryDistance <= 10) {
      distanceFee = 80;
    } else {
      distanceFee = 100;
    }

    // Only show base delivery fee without distance details
    if (distanceFee > 0) {
      breakdown.push({ label: "Base delivery", amount: distanceFee });
    }

    // Weight fee
    if (totalWeight > 7) {
      const weightFee = Math.ceil(totalWeight - 7) * 7;
      breakdown.push({ label: `Weight (${totalWeight}kg, ${Math.ceil(totalWeight - 7)}kg extra)`, amount: weightFee });
    }

    // Special items fee
    if (specialItemsFee > 0) {
      breakdown.push({ label: "Special items handling", amount: specialItemsFee });
    }

    return { isFree: false, breakdown };
  };

  // Example cart total (replace with your actual cart logic)
  const cartTotal = getTotalPrice ? getTotalPrice() : 0;
  const totalWithDelivery = finalTotal;

  // Payment methods
  const paymentMethods = [
    { value: "payfast", label: "PayFast" },
    { value: "card", label: "Card" },
    { value: "cash", label: "Cash on Delivery" },
  ];
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(paymentMethods[0].value);
  const [showCardFields, setShowCardFields] = useState(false);

  // Trigger relevant logic when payment method changes
  useEffect(() => {
    if (selectedPaymentMethod === 'card') {
      setShowCardFields(true);
    } else {
      setShowCardFields(false);
    }
  }, [selectedPaymentMethod]);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: user.email?.split('@')[0] || '',
        email: user.email || '',
        phoneNumber: '',
      }));
    }
  }, [user]);

  const validateCheckout = () => {
    const errors: Record<string, string> = {};
    if (!formData.fullName) errors.fullName = "Full name is required.";
    if (!formData.phoneNumber) errors.phoneNumber = "Phone number is required.";
    // Address is only required for delivery, not collection
    if (deliveryMethod === 'delivery' && !formData.address) errors.address = "Delivery address is required.";
    if (!formData.email) errors.email = "Email is required.";
    return errors;
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    const errors = validateCheckout();
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast({ title: "Validation Error", description: "Please fix errors before submitting.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }
    try {
      // Validate cart items before saving order_items
      for (const item of cartItems) {
        if (!item.id || typeof item.id !== 'string' || !/^([0-9a-fA-F-]{36})$/.test(item.id)) {
          toast({ title: "Cart Error", description: `Product ID missing or invalid for item: ${JSON.stringify(item)}`, variant: "destructive" });
          setIsProcessing(false);
          return;
        }
        if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
          toast({ title: "Cart Error", description: `Invalid quantity for item: ${JSON.stringify(item)}`, variant: "destructive" });
          setIsProcessing(false);
          return;
        }
        if (typeof item.price !== 'number' || item.price < 0) {
          toast({ title: "Cart Error", description: `Invalid price for item: ${JSON.stringify(item)}`, variant: "destructive" });
          setIsProcessing(false);
          return;
        }
      }
      
      // 1. Save order to Supabase
      if (!user?.id) {
        toast({ title: "Error", description: "User not authenticated", variant: "destructive" });
        setIsProcessing(false);
        return;
      }
      
      const orderInsertRes = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          total: totalWithDelivery,
          payment_method: selectedPaymentMethod === 'payfast' ? 'PayFast' : selectedPaymentMethod,
          status: 'pending', // All orders start as pending until payment is confirmed
          shipping_address: formData.address,
        })
        .select()
        .single();
      
      if (orderInsertRes.error) {
        toast({ title: "Order Error", description: orderInsertRes.error.message, variant: "destructive" });
        setIsProcessing(false);
        return;
      }
      
      const createdOrder = orderInsertRes.data;
      
      // 2. Save order items to Supabase
      const orderItems = checkoutItems.map(item => ({
        order_id: createdOrder.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
      }));
      
      // Debug: Log the order items to see what's being sent
      console.log('Order items to insert:', orderItems);
      
      // Ensure we only send the exact fields that exist in the table
      const cleanOrderItems = orderItems.map(item => ({
        order_id: item.order_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));
      
      const orderItemsInsertRes = await supabase
        .from('order_items')
        .insert(cleanOrderItems);
      
      if (orderItemsInsertRes.error) {
        console.error('Order items insert error:', orderItemsInsertRes.error);
        
        // Handle specific database trigger errors
        if (orderItemsInsertRes.error.message?.includes('stock_quantity')) {
          toast({ 
            title: "Database Configuration Error", 
            description: "There's a database configuration issue. Please contact support or try again later.", 
            variant: "destructive" 
          });
        } else {
          toast({ 
            title: "Order Items Error", 
            description: orderItemsInsertRes.error.message, 
            variant: "destructive" 
          });
        }
        setIsProcessing(false);
        return;
      }

      // 3. Handle payment based on method
      if (selectedPaymentMethod === 'payfast') {
        try {
          // Use an HTTPS landing page for mobile return/cancel URLs so PayFast accepts them.
          // That landing page will forward to the native app scheme (farmersbracket://...) to open the app.
          const isMobile = Capacitor.isNativePlatform();
          const mobileLanding = `${window.location.origin}/mobile-pay-return`;

          const baseReturnUrl = isMobile
            ? mobileLanding
            : window.location.origin + '/payment-success';

          // Add order ID to return URL as a fallback since server might not support custom_str1 yet
          const returnUrl = `${baseReturnUrl}?order_id=${createdOrder.id}`;

          const baseCancelUrl = isMobile
            ? mobileLanding
            : window.location.origin + '/payment-cancelled';

          const cancelUrl = `${baseCancelUrl}?order_id=${createdOrder.id}&status=cancelled`;
          
          console.log('Initiating PayFast payment with data:', {
            amount: totalWithDelivery.toFixed(2),
            item_name: `Order for ${formData.fullName}`,
            return_url: returnUrl,
            custom_str1: createdOrder.id,
          });
          
          console.log('Making request to:', 'https://paying-project.onrender.com/payfast-url');
          
          const payfastRes = await fetch('https://paying-project.onrender.com/payfast-url', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            mode: 'cors', // Explicitly handle CORS
            body: JSON.stringify({
              amount: totalWithDelivery.toFixed(2),
              item_name: `Order for ${formData.fullName}`,
              return_url: returnUrl,
              cancel_url: cancelUrl,
              notify_url: 'https://paying-project.onrender.com/payfast-webhook',
              custom_str1: createdOrder.id, // Pass the order ID for payment success handling
            }),
          });
          
          if (!payfastRes.ok) {
            const errorText = await payfastRes.text();
            console.error('PayFast server error response:', errorText);
            throw new Error(`PayFast server error: ${payfastRes.status} ${payfastRes.statusText}. Response: ${errorText}`);
          }
          
          const data = await payfastRes.json();
          console.log('PayFast response data:', data);
          
          // Check if the PayFast URL was generated successfully
          if (!data.url) {
            throw new Error('PayFast URL generation failed - no URL returned');
          }
          
          console.log('PayFast URL generated:', data.url);
          
          // Use Capacitor Browser for mobile, window.open for web
          if (isMobile) {
            await Browser.open({ url: data.url });
          } else {
            window.location.href = data.url;
          }
          
          // Reset processing state after opening payment
          setIsProcessing(false);
          
          // Show success message
          toast({ 
            title: "Processing Payment", 
            description: "Your order has been created. Please complete payment in the new window.",
            variant: "default"
          });
        } catch (unknownErr) {
          console.error('PayFast integration error:', unknownErr);
          const getErrorMessage = (e: unknown) => {
            if (!e) return '';
            if (typeof e === 'string') return e;
            if (e instanceof Error) return e.message;
            // Try property access in a type-safe way
            const maybe = e as { message?: unknown; name?: unknown };
            if (typeof maybe.message === 'string') return maybe.message;
            if (typeof maybe.name === 'string') return String(maybe.name);
            return '';
          };

          const rawMessage = getErrorMessage(unknownErr);
          let errorMessage = 'Failed to initiate PayFast payment';
          if (rawMessage.includes('Failed to fetch')) {
            errorMessage = 'Network error: Unable to connect to payment server. Please check your internet connection and try again.';
          } else if (rawMessage.includes('CORS')) {
            errorMessage = 'Payment server configuration error. Please contact support.';
          } else if (rawMessage) {
            errorMessage = `Payment error: ${rawMessage}`;
          }
          
          toast({ 
            title: "Payment Error", 
            description: errorMessage, 
            variant: "destructive" 
          });
          setIsProcessing(false);
          return;
  }
      } else if (selectedPaymentMethod === 'card') {
        toast({ title: "Coming Soon", description: "Card payment integration coming soon.", variant: "destructive" });
        setIsProcessing(false);
        return;
      } else {
        // Cash on delivery - Order was already created with pending status
        toast({ title: "Order Created!", description: "Your order is confirmed. You'll pay upon delivery." });
        
        // Clear cart and navigate to order confirmation
        if (selectedFarmGroup) {
          clearFarmCart(selectedFarmGroup.farmName);
        } else {
          clearCart();
        }
        navigate(`/order-confirmation?order_id=${createdOrder.id}`);
      }
    } catch (error) {
      const msg = getErrorMessage(error);
      console.error('Checkout error:', msg);
      toast({ title: "Error", description: msg || "An error occurred during checkout.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl p-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            {selectedFarmGroup 
              ? `Checkout - ${selectedFarmGroup.farmName}` 
              : "Checkout"
            }
          </h1>
        </div>

        {/* Check if cart is empty */}
        {checkoutItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground mb-4">Add some products to continue with checkout</p>
              <Button onClick={() => navigate('/browse-products')}>
                Continue Shopping
              </Button>
            </CardContent>
          </Card>
        ) : deliveryFee === -1 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Delivery Not Available</h3>
              <p className="text-muted-foreground mb-4">
                Sorry, we don't deliver to your area yet. This farm is outside our 70km delivery zone. 
                Try exploring farms closer to you!
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate('/browse-products')}>
                  Find Nearby Farms
                </Button>
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Checkout Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* 0. Delivery Method Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Fulfillment Method
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Choose how you'd like to receive your order</p>
                </CardHeader>
                <CardContent>
                  <RadioGroup 
                    value={deliveryMethod} 
                    onValueChange={(value: 'delivery' | 'collection') => setDeliveryMethod(value)}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent">
                      <RadioGroupItem value="delivery" id="delivery" />
                      <Label htmlFor="delivery" className="flex items-center gap-3 cursor-pointer flex-1">
                        <Truck className="h-5 w-5 text-blue-600" />
                        <div className="flex-1">
                          <span className="font-medium">Delivery</span>
                          <p className="text-sm text-muted-foreground">Get your order delivered to your address</p>
                        </div>
                        <Badge variant="secondary" className="ml-auto">
                          {potentialDeliveryFee === -1 ? 'Unavailable' : potentialDeliveryFee === 0 ? 'Free' : 'Pay'}
                        </Badge>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent">
                      <RadioGroupItem value="collection" id="collection" />
                      <Label htmlFor="collection" className="flex items-center gap-3 cursor-pointer flex-1">
                        <MapPin className="h-5 w-5 text-green-600" />
                        <div className="flex-1">
                          <span className="font-medium">Collection</span>
                          <p className="text-sm text-muted-foreground">Collect your order from the farm</p>
                        </div>
                        <Badge variant="secondary" className="ml-auto text-green-600">
                          Free
                        </Badge>
                      </Label>
                    </div>
                  </RadioGroup>
                  
                  {deliveryMethod === 'collection' && (
                    <div className="mt-4 p-4 bg-card border border-border rounded-lg">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-800 dark:text-green-200">Collection Information</h4>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                            {selectedFarmGroup ? 
                              `Collect your order from ${selectedFarmGroup.farmName}. Collection hours: 8AM - 5PM daily.` :
                              'Collect your order from the farm. Collection hours: 8AM - 5PM daily.'
                            }
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                            💡 Save on delivery costs by collecting your fresh produce directly!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {deliveryMethod === 'delivery' && deliveryFee === -1 && (
                    <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-orange-800 dark:text-orange-200">Delivery Unavailable</h4>
                          <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                            This farm is outside our 70km delivery zone. Please choose collection instead.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 1. Delivery Details Section */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    1
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {deliveryMethod === 'delivery' ? 'Delivery Details' : 'Contact Details'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        value={formData.fullName}
                        onChange={e => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                        placeholder="Enter your full name"
                        className={validationErrors.fullName ? "border-destructive" : ""}
                      />
                      {validationErrors.fullName && (
                        <p className="text-sm text-destructive mt-1">{validationErrors.fullName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="phoneNumber">Phone Number *</Label>
                      <Input
                        id="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={e => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        placeholder="Enter your phone number"
                        className={validationErrors.phoneNumber ? "border-destructive" : ""}
                      />
                      {validationErrors.phoneNumber && (
                        <p className="text-sm text-destructive mt-1">{validationErrors.phoneNumber}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter your email"
                      className={validationErrors.email ? "border-destructive" : ""}
                    />
                    {validationErrors.email && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.email}</p>
                    )}
                  </div>
                  
                  {/* Only show address field for delivery */}
                  {deliveryMethod === 'delivery' && (
                    <div>
                      <Label htmlFor="address">Delivery Address *</Label>
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Enter your full delivery address"
                        className={validationErrors.address ? "border-destructive" : ""}
                        rows={3}
                      />
                      {validationErrors.address && (
                        <p className="text-sm text-destructive mt-1">{validationErrors.address}</p>
                      )}
                    </div>
                  )}
                  
                  {deliveryDistance > 0 && deliveryMethod === 'delivery' && (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Delivery distance: <strong>{deliveryDistance} km</strong>
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 2. Payment Method Section */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    2
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment Method
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <RadioGroup 
                    value={selectedPaymentMethod} 
                    onValueChange={setSelectedPaymentMethod}
                    className="space-y-3"
                  >
                    {paymentMethods.map((method) => (
                      <div key={method.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent">
                        <RadioGroupItem value={method.value} id={method.value} />
                        <Label htmlFor={method.value} className="flex items-center gap-3 cursor-pointer flex-1">
                          {method.value === 'payfast' && <Wallet className="h-5 w-5 text-blue-600" />}
                          {method.value === 'card' && <CreditCard className="h-5 w-5 text-green-600" />}
                          {method.value === 'cash' && <Banknote className="h-5 w-5 text-orange-600" />}
                          <span className="font-medium">{method.label}</span>
                          {method.value === 'cash' && (
                            <Badge variant="secondary" className="ml-auto">Pay on delivery</Badge>
                          )}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  
                  {showCardFields && (
                    <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                      <h4 className="font-medium mb-3">Card Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <Label htmlFor="cardNumber">Card Number</Label>
                          <Input id="cardNumber" placeholder="1234 5678 9012 3456" disabled />
                        </div>
                        <div>
                          <Label htmlFor="cardExpiry">Expiry Date</Label>
                          <Input id="cardExpiry" placeholder="MM/YY" disabled />
                        </div>
                        <div>
                          <Label htmlFor="cardCVC">CVC</Label>
                          <Input id="cardCVC" placeholder="123" disabled />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Card payment integration coming soon
                      </p>
                    </div>
                  )}
                  
                  {selectedPaymentMethod === 'cash' && (
                    <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Cash payment unavailable. Coming soon.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                  {selectedFarmGroup && (
                    <div className="text-sm text-muted-foreground">
                      {selectedFarmGroup.totalItems} items from {selectedFarmGroup.farmName}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Cart Items */}
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {checkoutItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-2 border rounded">
                        <img
                          src={item.image || "/placeholder.svg"}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{item.name}</h4>
                          <p className="text-xs text-muted-foreground">{item.farmName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × R{item.price.toFixed(2)}
                          </p>
                        </div>
                        <span className="font-medium text-sm">
                          R{(item.quantity * item.price).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Promo Code Section */}
                  <div className="space-y-3">
                    <Button
                      variant="ghost"
                      onClick={() => setShowPromoSection(!showPromoSection)}
                      className="w-full justify-between p-0 h-auto font-normal text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Save className="h-4 w-4" />
                        Have a promo code?
                      </span>
                      <span className={`transform transition-transform ${showPromoSection ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </Button>
                    
                    {showPromoSection && (
                      <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                        {!appliedPromo ? (
                          <>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter promo code"
                                value={promoCode}
                                onChange={(e) => {
                                  setPromoCode(e.target.value.toUpperCase());
                                  setPromoError('');
                                }}
                                className="flex-1"
                                disabled={isValidatingPromo}
                              />
                              <Button
                                onClick={handleApplyPromo}
                                disabled={isValidatingPromo || !promoCode.trim()}
                                size="sm"
                              >
                                {isValidatingPromo ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  'Apply'
                                )}
                              </Button>
                            </div>
                            {promoError && (
                              <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {promoError}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <div>
                                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                  {appliedPromo.code}
                                </p>
                                <p className="text-xs text-green-600 dark:text-green-400">
                                  {appliedPromo.description}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleRemovePromo}
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                            >
                              ×
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Price Breakdown */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>R{checkoutTotal.toFixed(2)}</span>
                    </div>
                    
                    {/* Show discount if applied */}
                    {appliedPromo && discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span className="flex items-center gap-1">
                          <Save className="h-3 w-3" />
                          Discount ({appliedPromo.code})
                        </span>
                        <span>-R{discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1">
                        {deliveryMethod === 'delivery' ? (
                          <><Truck className="h-3 w-3" />Delivery Fee</>
                        ) : (
                          <><MapPin className="h-3 w-3" />Collection</>
                        )}
                      </span>
                      <span className={deliveryMethod === 'collection' ? 'text-green-600 font-medium' : ''}>
                        {deliveryMethod === 'collection' ? 'Free' : 
                         deliveryFee === -1 ? 'Unavailable' : 
                         deliveryFee === 0 ? 'Free' : `R${deliveryFee.toFixed(2)}`}
                      </span>
                    </div>
                    
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>R{finalTotal.toFixed(2)}</span>
                    </div>
                    
                    {/* Show savings if discount applied */}
                    {appliedPromo && discountAmount > 0 && (
                      <div className="text-xs text-green-600 text-center pt-1">
                        🎉 You saved R{discountAmount.toFixed(2)} with {appliedPromo.code}!
                      </div>
                    )}
                    
                    {/* Fulfillment method indicator */}
                    <div className="text-xs text-muted-foreground text-center pt-2">
                      {deliveryMethod === 'delivery' ? (
                        <span className="flex items-center justify-center gap-1">
                          <Truck className="h-3 w-3" />
                          Items will be delivered to your address
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Items ready for collection from farm
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Place Order Button */}
                  <Button 
                    onClick={handleCheckout} 
                    className="w-full h-12 text-base"
                    disabled={isProcessing}
                    size="lg"
                  >
                    {isProcessing ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5" />
                        {selectedPaymentMethod === 'payfast' ? 'Pay with PayFast' :
                         selectedPaymentMethod === 'card' ? 'Pay with Card' :
                         deliveryMethod === 'collection' ? 'Place Order for Collection' : 'Place Order for Delivery'}
                      </div>
                    )}
                  </Button>

                  {/* Security Notice */}
                  <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Secure checkout powered by industry-standard encryption
                  </div>

                  {/* Test button for Capacitor Browser */}
                  <Button
                    type="button"
                    className="w-full mt-2 bg-primary text-primary-foreground"
                    onClick={async () => {
                      try {
                        await Browser.open({ url: 'https://google.com' });
                      } catch (err) {
                        alert('Failed to open Capacitor Browser: ' + err);
                      }
                    }}
                  >
                    Test Capacitor Browser (Google)
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const WrappedCheckout = () => (
  <ErrorBoundary>
    <Checkout />
  </ErrorBoundary>
);

export default WrappedCheckout;