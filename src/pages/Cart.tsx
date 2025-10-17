import React, { useState, useEffect, useCallback } from "react";
import BottomNavBar from "@/components/BottomNavBar";
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Home,
  Package,
  MessageCircle,
  Search,
  Bookmark,
  Share2,
  Clock,
  MapPin,
  Calendar,
  Leaf,
  Star,
  TrendingUp,
  Users,
  Bell,
  Settings,
  CheckCircle,
  AlertCircle,
  Truck,
  Target,
  Recycle
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { useCart, FarmGroup } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/use-toast";
import { supabase } from "../integrations/supabase/client";

interface SmartSuggestion {
  id: string;
  name: string;
  price: number;
  unit: string;
  image?: string;
  farmName: string;
  reason: string;
  confidence: number;
  bundleDiscount?: number;
}

const Cart = () => {
  // ...all Cart logic and hooks...
  const navigate = useNavigate();
  const { cartItems, removeItem, updateQuantity, clearCart, getFarmGroups, clearFarmCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();

  // Example state for promo code
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [discount, setDiscount] = useState(0);

  // Get farm groups using the new context method
  const farmGroups = getFarmGroups();

  // Calculate minimum order validation
  const farmsBelowMinimum = farmGroups.filter(group => !group.canCheckout);
  const minimumOrderError = farmsBelowMinimum.length > 0
    ? `Minimum order per farm is R${farmGroups[0]?.minimumOrder || 100}. Farms below minimum: ${farmsBelowMinimum.map(group => group.farmName).join(", ")}`
    : "";

  // Delivery fee logic (match Checkout.tsx)
  const BASE_FEE = 30; // R30 covers first 5km and 5kg
  const BASE_DISTANCE = 5; // km
  const BASE_WEIGHT = 5; // kg
  const DISTANCE_RATE = 5; // R5 per km over base
  const WEIGHT_RATE = 5; // R5 per kg over base
  const totalDistance = React.useMemo(() => cartItems.reduce((sum, item) => sum + (item.distance || 0), 0), [cartItems]);
  const totalWeight = React.useMemo(() => cartItems.reduce((sum, item) => sum + (item.weight || 0), 0), [cartItems]);
  const distanceFee = Math.max(0, totalDistance - BASE_DISTANCE) * DISTANCE_RATE;
  const weightFee = Math.max(0, totalWeight - BASE_WEIGHT) * WEIGHT_RATE;
  const deliveryFee = BASE_FEE + distanceFee + weightFee;

  // Memoized derived values for performance
  const totalItems = React.useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems]);
  const totalPrice = React.useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [cartItems]);
  const promoDiscount = promoApplied ? totalPrice * discount : 0;
  const finalTotal = React.useMemo(() => totalPrice + deliveryFee - promoDiscount, [totalPrice, deliveryFee, promoDiscount]);

  // Promo code validation
  const isPromoValid = promoCode.length === 5 && /^FARM\d{2}$/.test(promoCode);

  // useCallback for handlers
  const handleApplyPromo = React.useCallback(() => {
    if (promoCode === "FARM10") {
      setDiscount(0.1);
      setPromoApplied(true);
      toast({ title: "Promo applied!", description: "10% discount applied." });
    } else {
      toast({ title: "Invalid promo code", description: "Promo code must be 'FARM10'." });
    }
  }, [promoCode, toast]);

  // Example: suggestions (empty for now)
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const loadSmartSuggestions = useCallback(() => {
    // Placeholder for loading suggestions
    setSmartSuggestions([]);
  }, []);

  useEffect(() => {
    loadSmartSuggestions();
  }, [loadSmartSuggestions]);


  // Fixed JSX structure
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-soft">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">Smart Cart</h1>
            <p className="text-sm text-muted-foreground">
              {totalItems} item{totalItems !== 1 ? 's' : ''} • R{totalPrice.toFixed(2)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Share cart dialog removed */}
          </div>
        </div>
      </header>
      {/* Cart Items */}
      <div className="px-4 py-2 pb-24 flex-1">
        {cartItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="mx-auto mb-4 w-12 h-12 opacity-50" />
            <div>Your cart is empty.</div>
            <Button className="mt-4" onClick={() => navigate("/browse-products")}>Browse Products</Button>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {farmGroups.map((farmGroup) => (
                <Card key={farmGroup.farmName} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
                        <CardTitle className="text-lg truncate" title={farmGroup.farmName}>{farmGroup.farmName}</CardTitle>
                        <Badge variant={farmGroup.canCheckout ? "default" : "destructive"} className="flex-shrink-0">
                          {farmGroup.canCheckout ? "Ready" : "Below Minimum"}
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => clearFarmCart(farmGroup.farmName)}
                        className="text-destructive hover:text-destructive self-start sm:self-center flex-shrink-0"
                      >
                        Clear Farm
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{farmGroup.totalItems} items</span>
                      <span>Total: R{farmGroup.totalPrice.toFixed(2)}</span>
                      {!farmGroup.canCheckout && (
                        <span className="text-destructive">
                          Need R{((farmGroup.minimumOrder || 100) - farmGroup.totalPrice).toFixed(2)} more
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {farmGroup.items.map((item) => (
                      <div key={item.id} className="p-3 bg-muted/30 rounded-lg space-y-3">
                        {/* Mobile: Stacked Layout */}
                        <div className="flex sm:hidden flex-col space-y-2">
                          <div className="flex items-center gap-3">
                            <img src={item.image} alt={item.name} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate" title={item.name}>{item.name}</div>
                              <div className="text-sm text-muted-foreground">R{item.price.toFixed(2)} each</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-medium">{item.quantity}</span>
                              <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-lg">R{(item.price * item.quantity).toFixed(2)}</div>
                              <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-destructive hover:text-destructive p-1">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Desktop: Horizontal Layout */}
                        <div className="hidden sm:flex items-center gap-4">
                          <img src={item.image} alt={item.name} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate" title={item.name}>{item.name}</div>
                            <div className="text-sm text-muted-foreground">R{item.price.toFixed(2)} each</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-right flex-shrink-0 min-w-[100px]">
                            <div className="font-bold text-lg">R{(item.price * item.quantity).toFixed(2)}</div>
                            <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-destructive hover:text-destructive p-1">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {farmGroup.canCheckout && (
                      <div className="pt-3 border-t">
                        <Button 
                          className="w-full" 
                          onClick={() => navigate(`/checkout?farm=${encodeURIComponent(farmGroup.farmName)}`)}
                          title={`Checkout ${farmGroup.farmName} - R${farmGroup.totalPrice.toFixed(2)}`}
                        >
                          <span className="flex flex-col sm:flex-row sm:items-center sm:gap-1 text-center">
                            <span className="font-medium">Checkout {farmGroup.farmName}</span>
                            <span className="text-sm sm:text-base">R{farmGroup.totalPrice.toFixed(2)}</span>
                          </span>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Overall Summary */}
            <Card className="mt-6 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="text-lg">Cart Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Farms:</span>
                  <span className="font-medium">{farmGroups.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Items:</span>
                  <span className="font-medium">{farmGroups.reduce((sum, group) => sum + group.totalItems, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Grand Total:</span>
                  <span className="font-semibold text-lg">R{farmGroups.reduce((sum, group) => sum + group.totalPrice, 0).toFixed(2)}</span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Farms Ready for Checkout:</span>
                    <span className="font-medium">{farmGroups.filter(g => g.canCheckout).length}</span>
                  </div>
                  {farmsBelowMinimum.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-destructive">Farms Below Minimum:</span>
                      <span className="font-medium">{farmsBelowMinimum.length}</span>
                    </div>
                  )}
                </div>
                {minimumOrderError && (
                  <div className="text-sm text-destructive mt-2 p-3 bg-destructive/10 rounded-lg">
                    <AlertCircle className="inline mr-2 h-4 w-4" />
                    {minimumOrderError}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-3 p-2 bg-muted/30 rounded">
                  <strong>Note:</strong> Each farm requires separate checkout and payment. 
                  Only farms that meet the minimum order requirement can be checked out.
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      <BottomNavBar />
    </div>
  );
}

export default Cart;


