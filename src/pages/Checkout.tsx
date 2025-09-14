import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft,
  MapPin,
  CreditCard,
  Smartphone,
  Shield,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

const Checkout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    specialInstructions: ""
  });

  // Mock cart items
  const cartItems: CartItem[] = [
    { id: "1", name: "Fresh Organic Tomatoes", price: 4.99, quantity: 2, unit: "kg" },
    { id: "2", name: "Sweet Corn", price: 3.50, quantity: 1, unit: "kg" }
  ];

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = 2.99;
  const total = subtotal + deliveryFee;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handlePlaceOrder = async () => {
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.address) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    // Simulate order processing
    setTimeout(() => {
      setIsProcessing(false);
      toast({
        title: "Order Placed Successfully!",
        description: "You'll receive a confirmation email shortly",
      });
      navigate('/track-order');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-soft">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">Checkout</h1>
            <p className="text-sm text-muted-foreground">Complete your order</p>
          </div>
          <div className="w-9" />
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 pb-32 space-y-6">
        {/* Delivery Address */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-lg">
              <MapPin className="h-5 w-5 mr-2 text-primary" />
              Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="123 Main Street"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialInstructions">Special Instructions</Label>
              <Textarea
                id="specialInstructions"
                name="specialInstructions"
                value={formData.specialInstructions}
                onChange={handleInputChange}
                placeholder="Any special delivery instructions..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-lg">
              <CreditCard className="h-5 w-5 mr-2 text-primary" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="card" id="card" />
                <CreditCard className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <Label htmlFor="card" className="font-medium">Credit/Debit Card</Label>
                  <p className="text-sm text-muted-foreground">Visa, Mastercard, Amex</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="paypal" id="paypal" />
                <div className="h-5 w-5 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">P</span>
                </div>
                <div className="flex-1">
                  <Label htmlFor="paypal" className="font-medium">PayPal</Label>
                  <p className="text-sm text-muted-foreground">Pay with your PayPal account</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="stripe" id="stripe" />
                <div className="h-5 w-5 bg-purple-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">S</span>
                </div>
                <div className="flex-1">
                  <Label htmlFor="stripe" className="font-medium">Stripe</Label>
                  <p className="text-sm text-muted-foreground">Secure payment processing</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="mobile" id="mobile" />
                <Smartphone className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <Label htmlFor="mobile" className="font-medium">Mobile Payment</Label>
                  <p className="text-sm text-muted-foreground">Apple Pay, Google Pay</p>
                </div>
              </div>
            </RadioGroup>

            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-success" />
                <p className="text-sm text-muted-foreground">
                  Your payment information is secure and encrypted
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="flex justify-between">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} {item.unit} × ${item.price.toFixed(2)}
                  </p>
                </div>
                <p className="font-medium">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Delivery Fee:</span>
                <span>${deliveryFee.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Order Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-strong p-4">
        <Button 
          className="w-full h-12 bg-gradient-to-r from-primary to-primary-light text-lg font-semibold"
          onClick={handlePlaceOrder}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Place Order - ${total.toFixed(2)}</span>
            </div>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Checkout;