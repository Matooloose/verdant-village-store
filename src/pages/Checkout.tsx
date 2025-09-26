import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, CreditCard, Banknote, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useAppState } from "@/contexts/AppStateContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import md5 from 'blueimp-md5';

interface UserProfile {
  name: string;
  address: string;
  phone: string;
}

const Checkout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cartItems, getTotalPrice, clearCart } = useCart();
  const { checkoutData, updateCheckoutData, addNotification } = useAppState();
  const { user } = useAuth();
  
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '', address: '', phone: '' });
  const [formData, setFormData] = useState({
    fullName: checkoutData.address ? checkoutData.address.split('\n')[0] : "",
    phoneNumber: "",
    address: checkoutData.address || "",
    instructions: ""
  });
  
  const [selectedPayment, setSelectedPayment] = useState(checkoutData.paymentMethod || "cash");
  const [bankingDetails, setBankingDetails] = useState(checkoutData.bankingDetails || "");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Delivery fee set by farmer - for demo, using fixed value
  const deliveryFee = checkoutData.deliveryFee || 20;
  const subtotal = getTotalPrice();
  const total = subtotal + deliveryFee;

  useEffect(() => {
    if (cartItems.length === 0) {
      navigate('/home');
      return;
    }
    
    fetchUserProfile();
  }, [cartItems.length, navigate]);

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, address, phone')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserProfile(data);
        if (data.address && !formData.address) {
          setFormData(prev => ({
            ...prev,
            fullName: data.name || "",
            phoneNumber: data.phone || "",
            address: data.address || ""
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const submitToPayFast = (postUrl: string, fields: Record<string, string>) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = postUrl;
    Object.entries(fields).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = String(value ?? '');
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  };

  const handlePlaceOrder = async () => {
    // Validate required fields
    if (!formData.fullName || !formData.phoneNumber || !formData.address) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required delivery information",
        variant: "destructive",
      });
      return;
    }

    const needsManualDetails = selectedPayment === "card" || selectedPayment === "mobile";
    if (needsManualDetails && !bankingDetails) {
      toast({
        title: "Missing Payment Details",
        description: "Please provide your payment details for this method",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Save checkout data
      updateCheckoutData({
        address: formData.address,
        paymentMethod: selectedPayment,
        bankingDetails,
        deliveryFee
      });

      // Create order in database
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user?.id,
          total,
          status: 'pending',
          payment_status: selectedPayment === 'cash' ? 'pending' : (selectedPayment === 'payfast' ? 'pending' : 'completed'),
          payment_method: selectedPayment,
          payment_method_selected: selectedPayment,
          shipping_address: formData.address
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map(item => ({
        order_id: orderData.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Handle PayFast redirect
      if (selectedPayment === 'payfast') {
        const PAYFAST_MERCHANT_ID = '10042134';
        const PAYFAST_MERCHANT_KEY = 'h1ztii0i713gg';
        const postUrl = 'https://www.payfast.co.za/eng/process';

        const [firstName, ...lastParts] = formData.fullName.trim().split(' ');
        const name_first = firstName || '';
        const name_last = lastParts.join(' ') || '';

        const fields: Record<string, string> = {
          merchant_id: PAYFAST_MERCHANT_ID,
          merchant_key: PAYFAST_MERCHANT_KEY,
          return_url: `${window.location.origin}/track-order?orderId=${orderData.id}`,
          cancel_url: `${window.location.origin}/checkout`,
          notify_url: `${window.location.origin}/checkout`,
          name_first,
          name_last,
          email_address: user?.email || '',
          m_payment_id: orderData.id,
          amount: Number(total).toFixed(2),
          item_name: `Order ${orderData.id.slice(0, 8)}`,
          item_description: 'Order payment',
          email_confirmation: '1',
          confirmation_address: user?.email || '',
        };

        const encode = (v: string) => encodeURIComponent(v);
        const sigString = Object.keys(fields)
          .filter((k) => fields[k])
          .sort()
          .map((k) => `${k}=${encode(fields[k])}`)
          .join('&');
        const signature = md5(sigString);

        submitToPayFast(postUrl, { ...fields, signature });
        return; // Stop here since we are redirecting to PayFast
      }

      // Add success notification
      addNotification({
        title: "Order Placed Successfully!",
        message: `Your order #${orderData.id.slice(0, 8)} has been placed and is being processed.`,
        type: "order",
        read: false
      });

      // Clear cart
      clearCart();

      toast({
        title: "Order Placed Successfully!",
        description: "You will receive updates about your order status",
      });

      // Navigate to track order
      navigate(`/track-order?orderId=${orderData.id}`);

    } catch (error) {
      console.error('Error placing order:', error);
      toast({
        title: "Error",
        description: "Failed to place order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (cartItems.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-soft">
        <div className="p-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/cart')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Checkout</h1>
        </div>
      </header>

      <main className="p-4 pb-24 space-y-6">
        {/* Delivery Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <MapPin className="h-5 w-5" />
              Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="fullName" className="text-foreground">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              
              <div>
                <Label htmlFor="phoneNumber" className="text-foreground">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  placeholder="Enter your phone number"
                />
              </div>
              
              <div>
                <Label htmlFor="address" className="text-foreground">Complete Address *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Enter your complete delivery address"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="instructions" className="text-foreground">Special Instructions</Label>
                <Textarea
                  id="instructions"
                  value={formData.instructions}
                  onChange={(e) => handleInputChange('instructions', e.target.value)}
                  placeholder="Any special delivery instructions (optional)"
                  rows={2}
                />
              </div>
            </div>

            {!userProfile.address && (
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <p className="text-sm text-warning-foreground">
                  💡 Add this address to your profile for faster checkout next time
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <CreditCard className="h-5 w-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment}>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="cash" id="cash" />
                  <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Banknote className="h-5 w-5 text-success" />
                    <div>
                      <p className="font-medium text-foreground">Cash on Delivery</p>
                      <p className="text-sm text-muted-foreground">Pay when you receive your order</p>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="card" id="card" />
                  <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                    <CreditCard className="h-5 w-5 text-info" />
                    <div>
                      <p className="font-medium text-foreground">Bank Transfer</p>
                      <p className="text-sm text-muted-foreground">Transfer to farmer's bank account</p>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="mobile" id="mobile" />
                  <Label htmlFor="mobile" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Smartphone className="h-5 w-5 text-warning" />
                    <div>
                      <p className="font-medium text-foreground">Mobile Money</p>
                      <p className="text-sm text-muted-foreground">Pay via mobile wallet</p>
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>

            {selectedPayment !== "cash" && (
              <div className="mt-4 space-y-3">
                <Label htmlFor="bankingDetails" className="text-foreground">Banking Details *</Label>
                <Textarea
                  id="bankingDetails"
                  value={bankingDetails}
                  onChange={(e) => setBankingDetails(e.target.value)}
                  placeholder={
                    selectedPayment === "card" 
                      ? "Enter your bank account details for transfer confirmation"
                      : "Enter your mobile money number and provider"
                  }
                  rows={3}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} {item.unit} × R{item.price}
                    </p>
                  </div>
                  <p className="font-medium text-foreground">
                    R{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">R{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span className="text-foreground">R{deliveryFee.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">R{total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-strong p-4">
        <Button 
          onClick={handlePlaceOrder}
          disabled={isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? 'Processing...' : `Place Order - R${total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
};

export default Checkout;