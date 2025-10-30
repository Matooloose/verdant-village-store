import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabaseAny } from '@/integrations/supabase/client';
// Draggable FAB helper
function useDraggableFAB(defaultPos = { x: 0, y: 0 }) {
  const [fabPos, setFabPos] = useState(() => {
    const saved = localStorage.getItem('fab-pos');
    return saved ? JSON.parse(saved) : defaultPos;
  });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return;
      let clientX, clientY;
      if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const x = clientX - offset.current.x;
      const y = clientY - offset.current.y;
      setFabPos({ x, y });
    }
    function onUp() {
      dragging.current = false;
      localStorage.setItem('fab-pos', JSON.stringify(fabPos));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    }
    if (dragging.current) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove);
      window.addEventListener('touchend', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [fabPos]);

  function startDrag(e) {
    dragging.current = true;
    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    offset.current = {
      x: clientX - fabPos.x,
      y: clientY - fabPos.y,
    };
  }
  return [fabPos, startDrag];
}
import { motion } from "framer-motion";
import { fadeIn } from "@/lib/animations";
import {
  Menu,
  Home,
  ShoppingCart,
  Package,
  MessageCircle,
  Search,
  User,
  Moon,
  Sun,
  LogOut,
  Leaf,
  Bell,
  MapPin,
  Plus,
  Info,
  Headphones,
  CreditCard,
  Grid3X3,
  List,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Filter,
  Heart,
  Star,
  TrendingUp,
  Sparkles,
  Clock,
  ArrowRight,
  Zap,
  X,
  Calendar,
  Target,
  Award,
  ThumbsUp,
  MoreHorizontal,
  RefreshCw,
  CheckCircle,
  Truck,
  Bug
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useDebounce } from "@/hooks/useDebounce";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { supabase } from "../integrations/supabase/client";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useNetworkStatus } from "@/hooks/useNetworkStatus.capacitor";
import { useCapacitorLocation } from "@/hooks/useCapacitorLocation";
import ErrorBoundary from "@/components/ErrorBoundary";
import { NotificationIcon } from "@/components/NotificationIcon";
import AdvancedFilters, { FilterOptions } from "@/components/AdvancedFilters";
import { ProductCardSkeleton, ProductListSkeleton, QuickActionSkeleton } from "@/components/SkeletonLoaders";
import ProductQuickView from "@/components/ProductQuickView";
import AvailableFarms from "@/components/AvailableFarms";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";
import { ProductRating } from "@/components/ProductRating";

import BottomNavBar from "@/components/BottomNavBar";
import MovableQuickSearch from "@/components/MovableQuickSearch";

interface Product {
id: string;
name: string;
description: string | null;
price: number;
unit: string;
category: string;
images: string[];
is_organic: boolean;
is_featured: boolean;
farmer_id: string;
quantity: number;
rating?: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  createdAt: string;
  itemCount: number;
}

interface Farm {
  farmer_id: string;
  name: string;
  description: string | null;
  location: string | null;
  specialties: string[];
  rating: number;
  total_orders: number;
  distance?: number;
  reason?: string;
}

interface RecommendedProduct extends Product {
  reason: string;
  confidence: number;
}

interface UserActivity {
  recently_viewed: Product[];
  purchase_history: Product[];
  wishlist_items: Product[];
  preferred_categories: string[];
  location: { latitude: number; longitude: number } | null;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  primary?: boolean;
  disabled?: boolean;
}

const Dashboard: React.FC = () => {
// Navigation & Auth
const navigate = useNavigate();
const { signOut, user } = useAuth();
const { toast } = useToast();
const { addToCart, cartItems, getTotalItems } = useCart();
const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

// UI State
const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
const [isDrawerOpen, setIsDrawerOpen] = useState(false);
const [isGridView, setIsGridView] = useState(true);
const [showFAB, setShowFAB] = useState(false);
const [fabExpanded, setFabExpanded] = useState(false);
const [showMovableSearch, setShowMovableSearch] = useState(false);

// Data State
const [products, setProducts] = useState<Product[]>([]);
const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
const [recommendedProducts, setRecommendedProducts] = useState<RecommendedProduct[]>([]);
const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<Product[]>([]);
const [personalizedFarms, setPersonalizedFarms] = useState<Farm[]>([]);
const [userActivity, setUserActivity] = useState<UserActivity>({
  recently_viewed: [],
  purchase_history: [],
  wishlist_items: [],
  preferred_categories: [],
  location: null
});
const [loading, setLoading] = useState(true);
const [searchTerm, setSearchTerm] = useState("");
const [addingToCart, setAddingToCart] = useState<string | null>(null);
const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
// Collapsible Recent Orders
const [recentOrdersCollapsed, setRecentOrdersCollapsed] = useState(true);
  const [farmNames, setFarmNames] = useState<Record<string, string>>({});
	
  // Track Orders Modal State
  const [trackOrdersOpen, setTrackOrdersOpen] = useState(false);
  // Local types for Dashboard orders (avoid colliding with other files' OrderItem interfaces)
  interface DashboardOrderItem { id?: string; quantity?: number; unit_price?: number; products?: Partial<Product> | null }
  interface DashboardOrder { id: string; status: string; total?: number; created_at?: string; order_items?: DashboardOrderItem[] }
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
	
  // Helper: undelivered order statuses
  const undeliveredStatuses = ['pending', 'processing', 'shipped', 'out_for_delivery', 'preparing', 'ready', 'confirmed'];
  const undeliveredOrders = orders.filter(order => undeliveredStatuses.includes(order.status));
	
  const getStatusProgress = (status: string) => {
    switch (status?.toLowerCase()) {
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
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      case 'out_for_delivery': case 'shipped': return 'bg-blue-500';
      case 'processing': case 'preparing': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };
  const getStatusIconTrack = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return CheckCircle;
      case 'out_for_delivery': case 'shipped': return Truck;
      case 'processing': case 'preparing': return Package;
      default: return Clock;
    }
  };
	
  // Fetch orders for modal
  useEffect(() => {
    if (trackOrdersOpen && user?.id) {
      setOrdersLoading(true);
      supabase
        .from('orders')
        .select('id, status, total, created_at, order_items (products (name, images)), payment_status, shipping_address')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          setOrders((data || []) as DashboardOrder[]);
          setOrdersLoading(false);
        });
    }
  }, [trackOrdersOpen, user]);

// Filter State
const [filters, setFilters] = useState<FilterOptions>({
  categories: [],
  isOrganic: null,
  isFeatured: null,
  priceRange: [0, 1000],
  availability: 'all'
});
const [filtersOpen, setFiltersOpen] = useState(false);

// Settings State
const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
const [notifications, setNotifications] = useState(() => localStorage.getItem('notifications') !== 'false');

// Bug report state
const [isBugReportOpen, setIsBugReportOpen] = useState(false);
const [bugDescription, setBugDescription] = useState('');
const [isSubmittingBug, setIsSubmittingBug] = useState(false);

// Refs
const scrollRef = useRef<HTMLDivElement>(null);

// Debounced search term
const debouncedSearchTerm = useDebounce(searchTerm, 300);

// Fetch products with retry logic and infinite scroll
const fetchProducts = useCallback(async () => {
  try {
    setLoading(true);
    
    let query = supabase
      .from('products')
      .select('id, name, description, price, unit, category, images, is_organic, is_featured, farmer_id, quantity')
      .gt('quantity', 0);

    // Apply search filter
    if (debouncedSearchTerm) {
      query = query.or(`name.ilike.%${debouncedSearchTerm}%,description.ilike.%${debouncedSearchTerm}%`);
    }

    // Apply filters
    if (filters.categories.length > 0) {
      query = query.in('category', filters.categories as ('vegetables' | 'fruits' | 'dairy' | 'meat' | 'grains' | 'herbs' | 'other')[]);
    }
    if (filters.isOrganic !== null) {
      query = query.eq('is_organic', filters.isOrganic);
    }
    if (filters.isFeatured !== null) {
      query = query.eq('is_featured', filters.isFeatured);
    }
    query = query.gte('price', filters.priceRange[0]).lte('price', filters.priceRange[1]);
    
    if (filters.availability === 'inStock') {
      query = query.gt('quantity', 10);
    } else if (filters.availability === 'lowStock') {
      query = query.gte('quantity', 1).lte('quantity', 10);
    }

    const { data: productsData, error: productsError } = await query
      .order('created_at', { ascending: false })
      .limit(50); // Get more products for manual scrolling

    if (productsError) throw productsError;

    const newProducts = productsData || [];
    setProducts(newProducts);
    
    // Fetch farm names for new products
    const farmerIds = newProducts.map(p => p.farmer_id).filter(Boolean);
    if (farmerIds.length > 0) {
      const { data: farms } = await supabase
        .from('farms')
        .select('farmer_id, name')
        .in('farmer_id', farmerIds);
      
      if (farms) {
        const farmNameMap: Record<string, string> = {};
        farms.forEach(farm => {
          farmNameMap[farm.farmer_id] = farm.name;
        });
        setFarmNames(farmNameMap);
      }
    }
    
  } catch (error) {
    console.error('Error loading products:', error);
    toast({
      title: "Error loading products",
      description: "Please try again later",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
}, [debouncedSearchTerm, filters, toast]);

// Fetch recent orders
const fetchRecentOrders = useCallback(async () => {
  if (!user) return;
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`id, status, total, created_at, order_items (id, quantity)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) {
      console.warn('Error fetching recent orders:', error);
      return;
    }

    const transformedOrders: RecentOrder[] = (data || []).map(order => ({
      id: order.id,
      orderNumber: `ORD${order.id.slice(-6).toUpperCase()}`,
      status: order.status as RecentOrder['status'],
      total: order.total,
      createdAt: order.created_at,
      itemCount: order.order_items?.reduce((sum: number, item: DashboardOrderItem | undefined) => sum + (item?.quantity || 0), 0) || 0
    }));

    setRecentOrders(transformedOrders);
  } catch (error) {
    console.warn('Error fetching recent orders:', error);
  }
}, [user]);

// (fetchData useEffect moved below where dependent callbacks are declared)

// Pull to refresh
const handleRefresh = async () => {
  try {
  await fetchProducts();
  await fetchRecentOrders();

  await fetchRecommendations();
  await fetchRecentlyViewed();
  await fetchPersonalizedFarms();
  toast({
    title: "Refreshed",
    description: "Data updated successfully",
  });
} catch (error) {
  toast({
    title: "Refresh failed",
    description: "Could not refresh products",
    variant: "destructive",
  });
}
}

const pullToRefresh = usePullToRefresh({
  onRefresh: handleRefresh,
  threshold: 80
});

// Scroll detection for FAB
useEffect(() => {
  const handleScroll = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    setShowFAB(scrollTop > 200);
  };

  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

// Load user activity on mount - will be invoked after loadUserActivity is declared

// Smart recommendation system
const generateRecommendations = useCallback(async (activity: UserActivity): Promise<RecommendedProduct[]> => {
  if (!activity.purchase_history?.length && !activity.recently_viewed?.length) {
    // New user - show popular products
    const popularProducts = products
      .filter(p => p.rating && p.rating >= 4.0)
      .slice(0, 6)
      .map(p => ({
        ...p,
        reason: "Popular choice",
        confidence: 0.8
      }));
    return popularProducts;
  }

  const recommendations: RecommendedProduct[] = [];
  const seenIds = new Set<string>();

  // Recommendation based on purchase history
  if (activity.purchase_history?.length) {
    const purchasedCategories = [...new Set(activity.purchase_history.map(p => p.category))];
    
    for (const category of purchasedCategories) {
      const categoryProducts = products
        .filter(p => p.category === category && !seenIds.has(p.id))
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 2);

      categoryProducts.forEach(p => {
        recommendations.push({
          ...p,
          reason: `More ${category.toLowerCase()} products`,
          confidence: 0.9
        });
        seenIds.add(p.id);
      });
    }
  }

  // Recommendation based on recently viewed
  if (activity.recently_viewed?.length) {
    const viewedCategories = [...new Set(activity.recently_viewed.map(p => p.category))];
    
    for (const category of viewedCategories) {
      const similarProducts = products
        .filter(p => p.category === category && !seenIds.has(p.id))
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 1);

      similarProducts.forEach(p => {
        recommendations.push({
          ...p,
          reason: "Similar to recently viewed",
          confidence: 0.7
        });
        seenIds.add(p.id);
      });
    }
  }

  // Location-based recommendations
  if (activity.location) {
    const nearbyProducts = products
      .filter(p => !seenIds.has(p.id))
      .slice(0, 2);

    nearbyProducts.forEach(p => {
      recommendations.push({
        ...p,
        reason: "Popular in your area",
        confidence: 0.6
      });
      seenIds.add(p.id);
    });
  }

  // Fill remaining slots with trending products
  const trending = products
    .filter(p => !seenIds.has(p.id) && p.rating && p.rating >= 4.0)
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.max(0, 8 - recommendations.length));

  trending.forEach(p => {
    recommendations.push({
      ...p,
      reason: "Trending now",
      confidence: 0.5
    });
  });

  return recommendations.slice(0, 8);
}, [products]);

// Load user activity from various sources
const loadUserActivity = useCallback(async () => {
  if (!user) return;

  try {
    const activity: UserActivity = {
      recently_viewed: JSON.parse(localStorage.getItem(`recently_viewed_${user.id}`) || '[]'),
      purchase_history: [],
      wishlist_items: [],
      preferred_categories: [],
      location: null
    };

    // Get purchase history from orders
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          unit_price,
          products (*)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (orders) {
      activity.purchase_history = orders.flatMap(order => 
        order.order_items?.map((item: DashboardOrderItem | undefined) => item?.products) || []
      ).filter(Boolean) as Product[];
    }

    // Get wishlist items - using a different approach since wishlist table doesn't exist
    // For now, we'll get this from local storage or context
    const wishlistFromContext = []; // This would come from WishlistContext
    activity.wishlist_items = wishlistFromContext;

    // Calculate preferred categories
    const allProducts = [...activity.purchase_history, ...activity.wishlist_items];
    const categoryCount = allProducts.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    // You may want to use categoryCount for further logic here
    setUserActivity(activity);
  } catch (error) {
    console.error('Error loading user activity:', error);
  }
}, [user]);

// Track product view
const trackProductView = useCallback((product: Product) => {
  if (!user || !product || !product.id) return;

  const storageKey = `recently_viewed_${user.id}`;
  const raw = localStorage.getItem(storageKey) || '[]';
  let recentlyViewed: Product[] = [];
  try {
    recentlyViewed = JSON.parse(raw) || [];
  } catch (e) {
    recentlyViewed = [];
  }

  // Normalize product shape to avoid accidental object identity or nested issues
  const normalized: Product = {
    id: String(product.id),
    name: String(product.name ?? ''),
    description: product.description ?? null,
    price: typeof product.price === 'number' ? product.price : Number(product.price ?? 0),
    unit: String(product.unit ?? 'each'),
    category: String(product.category ?? 'General'),
    images: Array.isArray(product.images) ? product.images : (product.images ? [String(product.images)] : []),
    is_organic: Boolean(product.is_organic),
    is_featured: Boolean(product.is_featured),
    farmer_id: String(product.farmer_id ?? ''),
    quantity: typeof product.quantity === 'number' ? product.quantity : Number(product.quantity ?? 0),
  };

  // Remove existing occurrence of same id
  const filtered = recentlyViewed.filter((p: Product) => String(p.id) !== String(normalized.id));

  // Prepend and cap to 5 most recent
  const updated = [normalized, ...filtered].slice(0, 5);

  try {
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to persist recently viewed', e);
  }

  // Update local state (both activity and recentlyViewedProducts) so UI reflects change immediately
  setUserActivity(prev => ({ ...prev, recently_viewed: updated }));
  setRecentlyViewedProducts(updated);
}, [user]);

// Fetch functions
const fetchRecommendations = useCallback(async () => {
  const recommendations = await generateRecommendations(userActivity);
  setRecommendedProducts(recommendations);
}, [userActivity, generateRecommendations]);

const fetchRecentlyViewed = useCallback(() => {
  if (!user) return;
  const storageKey = `recently_viewed_${user.id}`;
  let recentlyViewed: Product[] = [];
  try {
    recentlyViewed = JSON.parse(localStorage.getItem(storageKey) || '[]') || [];
  } catch (e) {
    recentlyViewed = [];
  }
  // Ensure we only show up to 5 most recent products
  setRecentlyViewedProducts(recentlyViewed.slice(0, 5));
}, [user]);

const fetchPersonalizedFarms = useCallback(async () => {
  if (!user) return;
  try {
    // Dummy implementation to avoid missing reference error
    // Replace with actual logic as needed
    setPersonalizedFarms([]);
  } catch (error) {
    console.error('Error fetching personalized farms:', error);
  }
}, [user]);

// Fetch products when search term or filters change
// Debounced fetch
useEffect(() => {
  const timer = setTimeout(() => {
    fetchProducts();
  }, 300);
  
  return () => clearTimeout(timer);
}, [debouncedSearchTerm, filters, fetchProducts]);

// Load user activity on mount; loadUserActivity is stable via useCallback
useEffect(() => {
  loadUserActivity();
}, [user, loadUserActivity]);

// Initial data load: products, recent orders, recommendations and personalized farms
// NOTE: we intentionally depend only on `user` here to avoid re-running this effect
// when internal fetch callbacks (which may depend on `products` / other state)
// change identity — that caused an infinite refresh loop. We call the stable
// callbacks directly inside the effect. If you modify fetch* callbacks to be
// stable across renders, you can remove the eslint-disable below.
useEffect(() => {
  if (!user) return;

  let mounted = true;

  (async () => {
    try {
      setLoading(true);
      // call the fetchers directly; their identities may change but we only
      // want this effect to run once when the user becomes available
      await fetchProducts();
      await fetchRecentOrders();
      await fetchRecommendations();
      fetchRecentlyViewed();
      await fetchPersonalizedFarms();
    } catch (e) {
      // errors handled in individual fetchers
    } finally {
      if (mounted) setLoading(false);
    }
  })();

  return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user]);

// Theme sync
useEffect(() => {
  if (darkMode) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
}, [darkMode]);

// Draggable FAB hook must be called at top-level of component (not inside callbacks)
const [fabPos, startDrag] = useDraggableFAB({ x: window.innerWidth - 88, y: window.innerHeight - 120 });

// Handlers
const handleNavigation = (path: string) => {
  navigate(path);
  setIsDrawerOpen(false);
};

const handleLogout = async () => {
  await signOut();
  setLogoutDialogOpen(false);
  navigate('/login');
};

// Bug report handler
const handleBugReport = async () => {
  if (!user || !bugDescription.trim()) {
    toast({
      title: "Error",
      description: "Please enter a bug description.",
      variant: "destructive",
    });
    return;
  }

  try {
    setIsSubmittingBug(true);
    
    const { error } = await supabaseAny
      .from('bug_reports')
      .insert({
        user_id: user.id,
        description: bugDescription.trim(),
        status: 'open'
      });

    if (error) throw error;

    toast({
      title: "Bug Report Submitted",
      description: "Thank you for reporting this issue. We'll look into it!",
    });

    setBugDescription('');
    setIsBugReportOpen(false);
  } catch (error) {
    console.error('Error submitting bug report:', error);
    toast({
      title: "Error",
      description: "Failed to submit bug report. Please try again.",
      variant: "destructive",
    });
  } finally {
    setIsSubmittingBug(false);
  }
};

const handleNotificationsChange = (value: boolean) => {
  setNotifications(value);
  localStorage.setItem('notifications', value ? 'true' : 'false');
};

const handleDarkModeChange = (value: boolean) => setDarkMode(value);

const addProductToCart = async (productId: string, quantity: number = 1) => {
  const product = products.find(p => p.id === productId);
  if (!product || addingToCart === productId) return;
  
  setAddingToCart(productId);
  
  try {
    const farmName = farmNames[product.farmer_id] || 'Local Farm';
    
    for (let i = 0; i < quantity; i++) {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        image: product.images[0] || '',
        farmName,
        category: product.category
      });
    }
    
    toast({
      title: "Added to Cart",
      description: `${quantity} x ${product.name} added to your cart`,
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    toast({
      title: "Error",
      description: "Failed to add item to cart",
      variant: "destructive",
    });
  } finally {
    setAddingToCart(null);
  }
};

const handleWishlistToggle = (productId: string) => {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (isInWishlist(productId)) {
    removeFromWishlist(productId);
    toast({
      title: "Removed from Wishlist",
      description: `${product.name} removed from wishlist`,
    });
  } else {
    const farmName = farmNames[product.farmer_id] || 'Local Farm';
    addToWishlist({
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.images[0] || '',
      farmName,
      category: product.category
    });
    toast({
      title: "Added to Wishlist",
      description: `${product.name} added to wishlist`,
    });
  }
};

const handleQuickView = (product: Product) => {
  navigate(`/product/${product.id}`);
};

// Helper function to convert Product to WishlistItem
type WishlistItem = { id: string; name: string; price: number; unit: string; image: string; farmName: string; category: string };
const productToWishlistItem = (product: Product): WishlistItem => ({
  id: product.id,
  name: product.name,
  price: product.price,
  unit: product.unit,
  image: product.images?.[0] || "/placeholder.svg",
  farmName: farmNames[product.farmer_id] || "Local Farm",
  category: product.category
});

// Add to cart handler
const handleAddToCart = async (product: Product | RecommendedProduct) => {
  setAddingToCart(product.id);
  try {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.images?.[0] || "/placeholder.svg",
      farmName: farmNames[product.farmer_id] || "Local Farm",
      category: product.category
    });
    
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart`,
    });
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to add item to cart",
      variant: "destructive",
    });
  } finally {
    setAddingToCart(null);
  }
};

// Get unique categories and price range for filters
const availableCategories = useMemo(() => Array.from(new Set(products.map(p => p.category))), [products]);
const priceRange = useMemo<[number, number]>(() => {
  if (products.length === 0) return [0, 1000];
  const prices = products.map(p => p.price);
  return [Math.min(...prices), Math.max(...prices)];
}, [products]);

// Quick Actions for FAB
const quickActions: QuickAction[] = [
  {
    id: 'search',
    label: 'Search Products',
    icon: <Search className="h-4 w-4" />,
    action: () => {
      setShowMovableSearch(true);
    },
    primary: true
  },
  {
    id: 'cart',
    label: 'View Cart',
    icon: <ShoppingCart className="h-4 w-4" />,
    action: () => navigate('/cart')
  },
  {
    id: 'orders',
    label: 'Order History',
    icon: <Calendar className="h-4 w-4" />,
    action: () => navigate('/order-history')
  },
  {
    id: 'wishlist',
    label: 'Wishlist',
    icon: <Heart className="h-4 w-4" />,
    action: () => navigate('/wishlist')
  },
  {
    id: 'refresh',
    label: 'Refresh',
    icon: <RefreshCw className="h-4 w-4" />,
    action: handleRefresh
  }
];

// Enhanced filtering with memoization
const filteredProducts = useMemo(() => {
  return products.filter(product => {
    // Search filter
    const matchesSearch = debouncedSearchTerm === '' || 
      product.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));

    return matchesSearch;
  });
}, [products, debouncedSearchTerm]);

// Count active filters
const activeFiltersCount = useMemo(() => {
  let count = 0;
  if (filters.categories.length > 0) count += filters.categories.length;
  if (filters.isOrganic !== null) count++;
  if (filters.isFeatured !== null) count++;
  if (filters.priceRange[0] !== priceRange[0] || filters.priceRange[1] !== priceRange[1]) count++;
  if (filters.availability !== 'all') count++;
  return count;
}, [filters, priceRange]);

// Bottom nav config
const bottomNavItems = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: ShoppingCart, label: "Cart", path: "/cart" },
  { icon: Package, label: "Track", path: "/track-order" },
  { icon: Search, label: "Browse", path: "/all-farms" },
  { icon: MessageCircle, label: "Messages", path: "/messages" },
];

// Location and Network (Capacitor)
const { location, error: locationError } = useCapacitorLocation();
const isOnline = useNetworkStatus();
const [locationLabel, setLocationLabel] = useState<string>("Fetching location...");

useEffect(() => {
  if (location) {
    // Try to get city/region using a free reverse geocoding API
    (async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}`);
        const data = await res.json();
        if (data.address) {
          setLocationLabel(
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.state ||
            `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`
          );
        } else {
          setLocationLabel(`${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`);
        }
      } catch {
        setLocationLabel(`${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`);
      }
    })();
  } else if (locationError) {
    setLocationLabel("Location unavailable");
  }
}, [location, locationError]);

  return (
    <ErrorBoundary>
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="min-h-screen bg-background">
      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator
        isVisible={pullToRefresh.shouldShowIndicator}
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        shouldTrigger={pullToRefresh.shouldTrigger}
        transformY={Math.min(pullToRefresh.pullDistance * 0.5, 50)}
        opacity={Math.min(pullToRefresh.pullDistance / 80, 1)}
      />
      
      {/* Top App Bar */}
  <header className="page-topbar sticky top-0 z-50 bg-card border-b shadow-soft" role="banner">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  aria-label="Open navigation menu"
                  aria-expanded={isDrawerOpen}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-light rounded-full flex items-center justify-center">
                      <Leaf className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <SheetTitle className="text-lg">FarmersBracket</SheetTitle>
                      <p className="text-sm text-muted-foreground">shopleft</p>
                    </div>
                  </div>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-4rem)] pr-2">
                  <div className="mt-8 space-y-6">
                    {/* Profile */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-foreground">Profile</h3>
                      <Button variant="ghost" className="w-full justify-start"
                        onClick={() => handleNavigation('/profile')}>
                        <User className="h-4 w-4 mr-3" />
                        Update Profile
                      </Button>
                      <Button variant="ghost" className="w-full justify-start"
                        onClick={() => handleNavigation('/wishlist')}>
                        <Heart className="h-4 w-4 mr-3" />
                        My Wishlist
                      </Button>
                      <Button variant="ghost" className="w-full justify-start"
                        onClick={() => handleNavigation('/order-history')}>
                        <Package className="h-4 w-4 mr-3" />
                        Order History
                      </Button>
                    </div>
                    <Separator />
                    {/* Help & Support */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-foreground">Help & Support</h3>
                      <Button variant="ghost" className="w-full justify-start"
                        onClick={() => setIsBugReportOpen(true)}>
                        <Bug className="h-4 w-4 mr-3" />
                        Report Bug/Problem
                      </Button>
                    </div>
                    <Separator />
                    {/* Settings */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-foreground">Settings</h3>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                          <Label htmlFor="dark-mode">Dark Mode</Label>
                        </div>
                        <Switch id="dark-mode" checked={darkMode} onCheckedChange={handleDarkModeChange} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Bell className="h-4 w-4" />
                          <Label htmlFor="notifications">Notifications</Label>
                        </div>
                        <Switch id="notifications" checked={notifications} onCheckedChange={handleNotificationsChange} />
                      </div>
                    </div>
                    <Separator />
                    {/* Logout */}
                    <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={() => setLogoutDialogOpen(true)}>
                      <LogOut className="h-4 w-4 mr-3" />
                      Logout
                    </Button>
                    <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Are you sure you want to logout?</DialogTitle>
                          <DialogDescription>
                            This will sign you out of your account and return you to the login page.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setLogoutDialogOpen(false)}>No</Button>
                          <Button variant="destructive" onClick={handleLogout}>Yes</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            {/* Bug Report Modal - Moved outside of Sheet to show immediately */}
            <Dialog open={isBugReportOpen} onOpenChange={setIsBugReportOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report Bug/Problem</DialogTitle>
                  <DialogDescription>
                    Help us improve the app by reporting any bugs or problems you've encountered.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bug-description">Describe the issue</Label>
                    <Textarea
                      id="bug-description"
                      placeholder="Please describe the bug or problem you encountered..."
                      value={bugDescription}
                      onChange={(e) => setBugDescription(e.target.value)}
                      rows={4}
                      className="mt-2"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBugReportOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleBugReport}
                    disabled={isSubmittingBug || !bugDescription.trim()}
                  >
                    {isSubmittingBug ? 'Submitting...' : 'Submit Report'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          <div>
            <h1 className="text-lg font-semibold text-foreground">FarmersBracket</h1>
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mr-1" />
              <span>{locationLabel}</span>
            </div>
          </div>
        </div>
        <NotificationIcon />
      </div>
      {/* Search Bar */}
      <div className="px-4 pb-2">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products, farms..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
              aria-label="Search products and farms"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={() => setShowMovableSearch(true)}
            title="Open movable search"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pb-4">
        <AdvancedFilters
          filters={filters}
          onFiltersChange={setFilters}
          categories={[
            'vegetables', 'fruits', 'dairy', 'meat', 'grains', 'herbs', 'other'
          ]}
          priceRange={[0, 1000]}
          activeFiltersCount={activeFiltersCount}
        />
      </div>
    </header>
    {/* Main Content */}
    <main className="p-4 pb-20 space-y-6 safe-area-bottom" role="main">
      {loading ? (
        <div className="space-y-6">
          {/* Welcome Card Skeleton */}
          <Card className="bg-gradient-to-r from-primary to-primary-light text-primary-foreground">
            <CardHeader>
              <div className="h-6 bg-primary-foreground/20 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-primary-foreground/20 rounded animate-pulse w-1/2" />
            </CardHeader>
          </Card>
          
          {/* Products Section Skeleton */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-6 bg-muted rounded animate-pulse w-32" />
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <div className="h-8 w-8 bg-muted-foreground/20 rounded animate-pulse" />
                <div className="h-8 w-8 bg-muted-foreground/20 rounded animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </section>
          
          {/* Quick Actions Skeleton */}
          <section className="space-y-4">
            <div className="h-6 bg-muted rounded animate-pulse w-32" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <QuickActionSkeleton key={i} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <>
          {/* Welcome Card */}
          <Card className="bg-gradient-to-r from-primary to-primary-light text-primary-foreground">
            <CardHeader>
              <CardTitle>Welcome to FarmersBracket!</CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Discover fresh produce from local farms
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Smart Recommendations Section */}
          {recommendedProducts.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Just for You</h2>
              </div>
              <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                <div className="flex w-max space-x-4 p-4">
                  {recommendedProducts.map((product) => (
                    <Card 
                      key={product.id} 
                      className="w-[280px] cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="aspect-square relative mb-3 overflow-hidden rounded-lg">
                          <img
                            src={product.images?.[0] || "/placeholder.svg"}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 right-2">
                            <Button
                              size="sm"
                              variant={isInWishlist(product.id) ? "default" : "secondary"}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isInWishlist(product.id)) {
                                  removeFromWishlist(product.id);
                                } else {
                                  addToWishlist(productToWishlistItem(product));
                                }
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Heart className={`h-4 w-4 ${isInWishlist(product.id) ? 'fill-current' : ''}`} />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            <span className="text-sm text-muted-foreground">{product.reason}</span>
                          </div>
                          <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-primary">R{product.price.toFixed(2)}</span>
                            <span className="text-sm text-muted-foreground">per {product.unit}</span>
                          </div>
                          <Progress value={product.confidence * 100} className="h-1" />
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(product);
                              trackProductView(product);
                            }}
                            disabled={addingToCart === product.id}
                          >
                            {addingToCart === product.id ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Adding...</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <ShoppingCart className="h-4 w-4" />
                                <span>Add to Cart</span>
                              </div>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          )}

          {/* Recently Viewed Section */}
          {recentlyViewedProducts.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold text-foreground">Recently Viewed</h2>
              </div>
              <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                <div className="flex w-max space-x-4 p-4">
                  {recentlyViewedProducts.map((product) => (
                    <Card 
                      key={`recent-${product.id}`} 
                      className="w-[200px] cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      <CardContent className="p-3">
                        <div className="aspect-square relative mb-2 overflow-hidden rounded-lg">
                          <img
                            src={product.images?.[0] || "/placeholder.svg"}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <h3 className="font-medium line-clamp-1 text-sm">{product.name}</h3>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm font-bold text-primary">R{product.price.toFixed(2)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(product);
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          )}

          {/* Personalized Farms Section */}
          {personalizedFarms.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h2 className="text-xl font-semibold text-foreground">Recommended Farms</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {personalizedFarms.map((farm) => (
                  <Card 
                    key={farm.farmer_id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/farmer/${farm.farmer_id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <Leaf className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold line-clamp-1">{farm.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">{farm.description || "Fresh local produce"}</p>
                          <div className="flex items-center space-x-4 mt-2">
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{farm.location || "Location not set"}</span>
                            </div>
                            {farm.rating && farm.rating >= 4.5 ? (
                              <span className="text-xs text-primary font-medium">Highly rated</span>
                            ) : farm.reason ? (
                              <span className="text-xs text-primary font-medium">{farm.reason}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
          
          {/* Recent Orders (Collapsible) */}
          {recentOrders.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-foreground">Recent Orders</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={recentOrdersCollapsed ? "Expand recent orders" : "Collapse recent orders"}
                    onClick={() => setRecentOrdersCollapsed(v => !v)}
                    className="ml-2"
                  >
                    {recentOrdersCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/order-history')}
                  className="text-primary hover:text-primary/80"
                >
                  View All
                </Button>
              </div>
              {!recentOrdersCollapsed && (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <Card key={order.id} className="cursor-pointer hover:shadow-medium transition-shadow"
                      onClick={() => navigate('/order-history')}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-foreground">{order.orderNumber}</h3>
                              <Badge 
                                variant={
                                  order.status === 'delivered' ? 'default' :
                                  order.status === 'shipped' ? 'secondary' :
                                  order.status === 'processing' ? 'outline' :
                                  order.status === 'cancelled' ? 'destructive' : 'outline'
                                }
                                className="text-xs"
                              >
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()} • {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">R{order.total.toFixed(2)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Fresh Products */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Available Products</h2>
              </div>
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <Button
                  variant={isGridView ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setIsGridView(true)}
                  className="h-8 w-8 p-0"
                  aria-label="Switch to grid view"
                  aria-pressed={isGridView}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={!isGridView ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setIsGridView(false)}
                  className="h-8 w-8 p-0"
                  aria-label="Switch to list view"
                  aria-pressed={!isGridView}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Grid View */}
            {isGridView ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {filteredProducts.slice(0, 16).map(product => (
                  <Card 
                    key={product.id} 
                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex flex-col"
                    onClick={() => handleQuickView(product)}
                  >
                    <div className="aspect-square bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-between relative overflow-hidden rounded-t-lg">
                      {product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-12 w-12 text-primary/40" />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-1 right-1 h-6 w-6 p-0 bg-background/90 hover:bg-background border border-border/20 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickViewProduct(product);
                        }}
                        aria-label={`Quick view ${product.name}`}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                    <CardContent className="p-3 flex-1 flex flex-col">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-sm text-foreground line-clamp-1">{product.name}</h3>
                          {product.is_organic && (
                            <Badge variant="secondary" className="text-xs ml-1 flex-shrink-0">Organic</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-primary text-sm">
                                R{product.price}/{product.unit}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {product.quantity} items available
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleWishlistToggle(product.id);
                                }}
                                aria-label={`${isInWishlist(product.id) ? 'Remove from' : 'Add to'} wishlist`}
                              >
                                <Heart 
                                  className={`h-4 w-4 ${isInWishlist(product.id) 
                                    ? 'fill-red-500 text-red-500' 
                                    : 'text-muted-foreground hover:text-red-500'
                                  }`} 
                                />
                              </Button>
                              <Button 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addProductToCart(product.id);
                                }}
                                disabled={addingToCart === product.id}
                                aria-label={`Add ${product.name} to cart`}
                              >
                                {addingToCart === product.id ? (
                                  <div 
                                    className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"
                                    aria-label="Adding to cart"
                                  />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          {/* Product Rating - Now with better visibility */}
                          <div className="pt-1 border-t border-border/50">
                            <ProductRating productId={product.id} compact={true} showReviews={false} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              /* List View */
              <div className="space-y-3">
                {filteredProducts.slice(0, 16).map(product => (
                  <Card 
                    key={product.id} 
                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleQuickView(product)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                          {product.images.length > 0 ? (
                            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="h-8 w-8 text-primary/40" />
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-0.5 right-0.5 h-5 w-5 p-0 bg-background/90 hover:bg-background border border-border/20 shadow-sm rounded-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickViewProduct(product);
                            }}
                            aria-label={`Quick view ${product.name}`}
                          >
                            <Eye className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <p className="font-semibold text-primary">
                                  R{product.price}/{product.unit}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {product.quantity} items available
                                </p>
                                {product.is_organic && (
                                  <Badge variant="secondary" className="text-xs">Organic</Badge>
                                )}
                              </div>
                              {/* Product Rating for List View - Enhanced visibility */}
                              <div className="mt-2 pt-2 border-t border-border/50">
                                <ProductRating productId={product.id} compact={true} showReviews={false} />
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleWishlistToggle(product.id);
                                }}
                                aria-label={`${isInWishlist(product.id) ? 'Remove from' : 'Add to'} wishlist`}
                              >
                                <Heart 
                                  className={`h-4 w-4 ${isInWishlist(product.id) 
                                    ? 'fill-red-500 text-red-500' 
                                    : 'text-muted-foreground hover:text-red-500'
                                  }`} 
                                />
                              </Button>
                              <Button 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addProductToCart(product.id);
                                }}
                                disabled={addingToCart === product.id}
                                aria-label={`Add ${product.name} to cart`}
                              >
                                {addingToCart === product.id ? (
                                  <div 
                                    className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"
                                    aria-label="Adding to cart"
                                  />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            {filteredProducts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No products found</p>
              </div>
            )}
            
            {/* View All Products Link - only show if there are more than 16 products */}
            {filteredProducts.length > 16 && (
              <div className="flex justify-center pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => handleNavigation('/browse-products')}
                  className="flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                  View All Products
                </Button>
              </div>
            )}
          </section>
          {/* Available Farms Component */}
          <AvailableFarms />
          {/* Additional Quick Actions */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Quick Actions</h2>
            <div className="grid grid-cols-3 gap-3">
              <Card className="cursor-pointer hover:shadow-medium transition-shadow"
                onClick={() => handleNavigation('/wishlist')}>
                <CardContent className="p-3 text-center">
                  <Heart className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="font-medium text-xs">My Wishlist</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-medium transition-shadow"
                onClick={() => handleNavigation('/order-history')}>
                <CardContent className="p-3 text-center">
                  <Package className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="font-medium text-xs">Order History</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-medium transition-shadow"
                onClick={() => setIsBugReportOpen(true)}>
                <CardContent className="p-3 text-center">
                  <Bug className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="font-medium text-xs">Report Bug</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-medium transition-shadow"
                onClick={() => handleNavigation('/subscriptions')}>
                <CardContent className="p-3 text-center">
                  <CreditCard className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="font-medium text-xs">Subscriptions</p>
                </CardContent>
              </Card>
              <Dialog>
                <DialogTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-medium transition-shadow">
                    <CardContent className="p-3 text-center">
                      <Headphones className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <p className="font-medium text-xs">Contact Support</p>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Contact Support</DialogTitle>
                    <DialogDescription>Choose how you'd like to get help</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Live Chat</p>
                        <p className="text-sm text-muted-foreground">Chat with our support team</p>
                      </div>
                      <Button variant="outline" onClick={() => navigate('/messages?support=true')}>Open Chat</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Phone</p>
                        <p className="text-sm text-muted-foreground">Call our support line</p>
                      </div>
                      <Button variant="outline" onClick={() => window.open('tel:+27123456789')}>Call</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Email</p>
                        <p className="text-sm text-muted-foreground">Send us an email</p>
                      </div>
                      <Button variant="outline" onClick={() => window.location.href = 'mailto:support@verdantvillage.com'}>Email</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Card className="cursor-pointer hover:shadow-medium transition-shadow"
                onClick={() => handleNavigation('/profile')}>
                <CardContent className="p-3 text-center">
                  <User className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="font-medium text-xs">My Profile</p>
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      )}
    </main>
    <BottomNavBar />

    {/* Track Orders Modal */}
    <Dialog open={trackOrdersOpen} onOpenChange={setTrackOrdersOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Track Orders</DialogTitle>
          <DialogDescription>View and track your undelivered orders</DialogDescription>
        </DialogHeader>
        {ordersLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : undeliveredOrders.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No undelivered orders to track.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {undeliveredOrders.map(order => {
              const StatusIcon = getStatusIconTrack(order.status);
              return (
                <Card key={order.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`p-2 rounded-full ${getStatusColor(order.status)}`}> <StatusIcon className="h-6 w-6 text-white" /> </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">Order #{order.id.slice(0,8)}</h3>
                      <p className="text-sm text-muted-foreground">{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
                      <Progress value={getStatusProgress(order.status)} className="h-1 mt-2" />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setTrackOrdersOpen(false); navigate(`/track-order?orderId=${order.id}`); }}>View Details</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setTrackOrdersOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Product Quick View Dialog */}
    {quickViewProduct && (
      <ProductQuickView
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={(productId, quantity) => {
          for (let i = 0; i < (quantity || 1); i++) {
            addToCart({
              id: quickViewProduct.id,
              name: quickViewProduct.name,
              price: quickViewProduct.price,
              unit: quickViewProduct.unit,
              image: quickViewProduct.images[0] || '',
              farmName: farmNames[quickViewProduct.farmer_id] || 'Local Farm',
              category: quickViewProduct.category
            });
          }
        }}
        onAddToWishlist={(productId) => addToWishlist({
          id: quickViewProduct.id,
          name: quickViewProduct.name,
          price: quickViewProduct.price,
          unit: quickViewProduct.unit,
          image: quickViewProduct.images[0] || '',
          farmName: farmNames[quickViewProduct.farmer_id] || 'Local Farm',
          category: quickViewProduct.category
        })}
        isInWishlist={isInWishlist(quickViewProduct.id)}
        isAddingToCart={addingToCart === quickViewProduct.id}
        farmName={farmNames[quickViewProduct.farmer_id]}
      />
    )}

    {/* Floating Action Button */}
    {showFAB && (
        <div className="fixed right-6 bottom-28 z-50 touch-none">
          <div className="relative">
          {/* FAB Menu */}
          {fabExpanded && (
            <div className="absolute bottom-16 right-0 flex flex-col-reverse space-y-reverse space-y-3 mb-2">
              {quickActions.filter(action => !action.primary).map((action) => (
                <div key={action.id} className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-foreground bg-card px-3 py-1 rounded-full shadow-lg border">
                    {action.label}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      action.action();
                      setFabExpanded(false);
                    }}
                    className="h-10 w-10 rounded-full shadow-lg"
                  >
                    {action.icon}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Main FAB Button (draggable) */}
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-all duration-200 cursor-move"
            onClick={() => setFabExpanded(!fabExpanded)}
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            style={{ userSelect: 'none' }}
          >
            <div className={`transition-transform duration-200 ${fabExpanded ? 'rotate-45' : 'rotate-0'}`}>
              {fabExpanded ? <X className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
            </div>
          </Button>

          {/* Primary Action Button */}
          {!fabExpanded && quickActions.find(action => action.primary) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => quickActions.find(action => action.primary)?.action()}
              className="absolute -top-12 left-1/2 transform -translate-x-1/2 h-8 px-3 rounded-full shadow-lg"
            >
              <div className="flex items-center space-x-1">
                {quickActions.find(action => action.primary)?.icon}
                <span className="text-xs">Quick Search</span>
              </div>
            </Button>
          )}
          </div>
        </div>
      )}

    {/* Movable Quick Search */}
    {showMovableSearch && (
      <MovableQuickSearch
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search products, farms..."
        onClose={() => setShowMovableSearch(false)}
      />
    )}
      </motion.div>
    </ErrorBoundary>
  );
};

export default Dashboard;