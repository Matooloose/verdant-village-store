import React, { Suspense, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { AppStateProvider } from "./contexts/AppStateContext";
import { WishlistProvider } from "./contexts/WishlistContext";

// Lazy load pages for better performance
const Index = React.lazy(() => import("./pages/Index"));
const AllFarms = React.lazy(() => import("./pages/AllFarms"));
const Welcome = React.lazy(() => import("./pages/Welcome"));
const Login = React.lazy(() => import("./pages/Login"));
const Register = React.lazy(() => import("./pages/Register"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Cart = React.lazy(() => import("./pages/Cart"));
const TrackOrder = React.lazy(() => import("./pages/TrackOrder"));
const BrowseProducts = React.lazy(() => import("./pages/BrowseProducts"));
const ProductDetail = React.lazy(() => import("./pages/ProductDetail"));
const FarmDetail = React.lazy(() => import("./pages/FarmDetail"));
const Checkout = React.lazy(() => import("./pages/Checkout"));
const UpdateProfile = React.lazy(() => import("./pages/UpdateProfile"));
const Subscriptions = React.lazy(() => import("./pages/Subscriptions"));
const Messages = React.lazy(() => import("./pages/Messages"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const HowItWorks = React.lazy(() => import("./pages/HowItWorks"));
const ContactSupport = React.lazy(() => import("./pages/ContactSupport"));
const CustomerSupport = React.lazy(() => import("./pages/CustomerSupport"));
const Wishlist = React.lazy(() => import("./pages/Wishlist"));
const OrderHistory = React.lazy(() => import("./pages/OrderHistory"));
const FAQ = React.lazy(() => import("./pages/FAQ"));
const PaymentSuccess = React.lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancelled = React.lazy(() => import("./pages/PaymentCancelled"));
const PayFastTest = React.lazy(() => import("./pages/PayFastTest"));
const ProductReviews = React.lazy(() => import("./pages/ProductReviews"));
const FarmerProfile = React.lazy(() => import("./pages/FarmerProfile"));
const PasswordReset = React.lazy(() => import("./pages/PasswordReset"));
const AuthCallback = React.lazy(() => import("./pages/AuthCallback"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const MobilePayReturn = React.lazy(() => import("./pages/MobilePayReturn"));

const queryClient = new QueryClient();

// Deep link handler component that uses useNavigate inside Router context
const DeepLinkHandler = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    let listener: { remove?: () => void } | null = null;
    const handler = async ({ url }: { url: string }) => {
      if (url.startsWith('farmersbracket://payment-success')) {
        try { 
          await Browser.close(); 
        } catch {
          // Ignore browser close errors
        }
        navigate('/payment-success');
      }
    };
    
    CapApp.addListener('appUrlOpen', handler).then(l => {
      listener = l;
    });
    
    return () => {
      if (listener && listener.remove) listener.remove();
    };
  }, [navigate]);

  return null; // This component doesn't render anything
};

const App = () => {
  // Apply persisted theme on app mount so dark mode survives redirects/reloads
  React.useEffect(() => {
    try {
      const theme = localStorage.getItem('theme');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      }
      // if theme is 'system' or null, do nothing and allow CSS prefers-color-scheme to handle it
    } catch (e) {
      console.warn('Could not apply persisted theme', e);
    }
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AppStateProvider>
          <CartProvider>
            <WishlistProvider>
              <Toaster />
              <Sonner />
              <ErrorBoundary>
                  <DeepLinkHandler />
                  <Suspense fallback={
                    <div className="min-h-screen bg-background flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading...</p>
                      </div>
                    </div>
                  }>
                    <Routes>
                      <Route path="/" element={<Login />} />
                      <Route path="/welcome" element={<Welcome />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/reset-password" element={<PasswordReset />} />
                      <Route path="/forgot-password" element={<PasswordReset />} />
                      <Route path="/auth/reset" element={<ResetPassword />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      <Route path="/dashboard" element={<Dashboard />} />

                      <Route path="/home" element={<Dashboard />} />
                      <Route path="/cart" element={<Cart />} />
                      <Route path="/track-order" element={<TrackOrder />} />
                      <Route path="/track-order/:orderId" element={<TrackOrder />} />
                      <Route path="/browse-products" element={<BrowseProducts />} />
                      <Route path="/all-farms" element={<AllFarms />} />
                      <Route path="/farms/:farmId" element={<FarmDetail />} />
                      <Route path="/product/:productId" element={<ProductDetail />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/profile" element={<UpdateProfile />} />
                      <Route path="/update-profile" element={<UpdateProfile />} />
                      <Route path="/subscriptions" element={<Subscriptions />} />
                      <Route path="/messages" element={<Messages />} />
                      <Route path="/wishlist" element={<Wishlist />} />
                      <Route path="/order-history" element={<OrderHistory />} />
                      <Route path="/how-it-works" element={<HowItWorks />} />
                      <Route path="/contact-support" element={<ContactSupport />} />
                      <Route path="/customer-support" element={<CustomerSupport />} />
                      <Route path="/faq" element={<FAQ />} />
                      <Route path="/product/:productId/reviews" element={<ProductReviews />} />
                      <Route path="/farmer/:farmerId" element={<FarmerProfile />} />
                      <Route path="/payment-success" element={<PaymentSuccess />} />
                      <Route path="/payment-cancelled" element={<PaymentCancelled />} />
                      <Route path="/mobile-pay-return" element={<MobilePayReturn />} />
                      <Route path="/payfast-test" element={<PayFastTest />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
              </ErrorBoundary>
            </WishlistProvider>
          </CartProvider>
        </AppStateProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;