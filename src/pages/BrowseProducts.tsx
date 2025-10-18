import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useMemoizedSearch, useDebounce } from "@/hooks/usePerformance";
import { supabase } from "@/integrations/supabase/client";
import {
ArrowLeft,
Search,
Grid,
List,
Heart,
Star,
Award,
Leaf,
MapPin,
Package,
Eye,
ShoppingCart
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import BottomNavBar from "@/components/BottomNavBar";
import ProductQuickView from "@/components/ProductQuickView";

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
created_at: string;
farmName?: string;
farmLocation?: string;
distance?: number;
contactMethod?: 'email' | 'phone' | 'whatsapp';
contactValue?: string;
}

interface Review {
id: string;
product_id: string;
rating: number;
comment: string | null;
profiles: {
  name: string | null;
};
created_at: string;
}

function BrowseProducts() {
const navigate = useNavigate();
const { toast } = useToast();
const { addToCart } = useCart();
const { wishlistItems, addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'rating' | 'distance'>('name');
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
// Geolocation fetch
useEffect(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => setUserLocation(null),
      { enableHighAccuracy: true }
    );
  }
}, []);
// Helper: Calculate distance (Haversine formula)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{ priceRange: [number, number]; organicOnly: boolean; featuredOnly: boolean; categories: string[] }>({ priceRange: [0, 100], organicOnly: false, featuredOnly: false, categories: [] });

// Review modal state and product reviews
const [reviewModalOpen, setReviewModalOpen] = useState(false);
const [reviewProductId, setReviewProductId] = useState<string | null>(null);
const [reviewRating, setReviewRating] = useState(0);
const [reviewComment, setReviewComment] = useState("");
const [productReviews, setProductReviews] = useState<{ [key: string]: Review[] }>({});
const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Unified filter logic
  const filteredProducts = useMemo(() => {
    let result = products;
    // Search
    if (debouncedSearchTerm) {
      result = result.filter(product =>
        product.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (product.description || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (product.farmName || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }
    // Category
    if (selectedCategory !== 'all') {
      result = result.filter(product => product.category === selectedCategory);
    }
    // Advanced filters
    if (activeFilters.categories.length > 0) {
      result = result.filter(product => activeFilters.categories.includes(product.category));
    }
    result = result.filter(product =>
      product.price >= activeFilters.priceRange[0] && product.price <= activeFilters.priceRange[1]
    );
    if (activeFilters.organicOnly) {
      result = result.filter(product => product.is_organic);
    }
    if (activeFilters.featuredOnly) {
      result = result.filter(product => product.is_featured);
    }
    return result;
  }, [products, debouncedSearchTerm, selectedCategory, activeFilters]);

const getAverageRating = useCallback((productId: string): number => {
  const reviews = productReviews[productId] || [];
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return sum / reviews.length;
}, [productReviews]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return a.price - b.price;
      case 'name':
        return a.name.localeCompare(b.name);
      case 'rating': {
        const aRating = getAverageRating(a.id);
        const bRating = getAverageRating(b.id);
        if (bRating === aRating) {
          const aReviews = productReviews[a.id]?.length || 0;
          const bReviews = productReviews[b.id]?.length || 0;
          return bReviews - aReviews;
        }
        return bRating - aRating;
      }
      default:
        return 0;
    }
  });
}, [filteredProducts, sortBy, productReviews, getAverageRating]);

const handleAddToCart = useCallback((product: Product) => {
  addToCart({
    id: product.id,
    name: product.name,
    price: product.price,
    unit: product.unit,
    image: product.images[0] || undefined,
    farmName: product.farmName || "Unknown Farm"
  });
  toast({
    title: "Added to cart!",
    description: `${product.name} has been added to your cart.`,
  });
}, [addToCart, toast]);

const handleToggleWishlist = useCallback((product: Product) => {
  if (isInWishlist(product.id)) {
    removeFromWishlist(product.id);
    toast({
      title: "Removed from wishlist",
      description: `${product.name} has been removed from your wishlist.`,
    });
  } else {
    addToWishlist({
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.images[0] || "/placeholder.svg",
      farmName: product.farmName || "Unknown Farm",
      category: product.category
    });
    toast({
      title: "Added to wishlist!",
      description: `${product.name} has been added to your wishlist.`,
    });
  }
}, [isInWishlist, addToWishlist, removeFromWishlist, toast]);

useEffect(() => {
  fetchProducts();
  fetchCategories();
  // eslint-disable-next-line
}, []);

const fetchProducts = async () => {
  try {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .gt('quantity', 0);

    if (error) throw error;

    const enhancedProducts: Product[] = [];
    if (data && data.length > 0) {
      for (const product of data) {
        let farmName = "Unknown Farm";
        let farmLocation: string | null = null;
        const { data: farmData } = await supabase
          .from('farms')
          .select('name, location')
          .eq('farmer_id', product.farmer_id)
          .single();
        if (farmData) {
          farmName = farmData.name;
          farmLocation = farmData.location;
        }
        enhancedProducts.push({
          ...product,
          farmName,
          farmLocation: farmLocation || undefined
        });
      }
    }
    setProducts(enhancedProducts);

    if (enhancedProducts.length > 0) {
      const productIds = enhancedProducts.map(p => p.id);
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select(`*, profiles (name)`)
        .in('product_id', productIds);
      if (!reviewsError && reviewsData) {
        const reviewsByProduct = reviewsData.reduce((acc, review) => {
          if (!acc[review.product_id]) {
            acc[review.product_id] = [];
          }
          acc[review.product_id].push(review);
          return acc;
        }, {} as { [key: string]: Review[] });
        setProductReviews(reviewsByProduct);
      }
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    toast({
      title: "Error Loading Products",
      description: "Failed to load products. Please try again.",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};

const fetchCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .not('category', 'is', null);

    if (error) throw error;

    const uniqueCategories = [...new Set(data?.map(p => p.category) || [])];
    setCategories(uniqueCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
  }
};

const submitReview = async () => {
  if (!reviewProductId || reviewRating === 0) return;

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      toast({
        title: "Please Sign In",
        description: "You need to sign in to leave a review",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('reviews')
      .insert({
        product_id: reviewProductId,
        rating: reviewRating,
        comment: reviewComment,
        user_id: user.user.id
      });

    if (error) throw error;

    toast({
      title: "Review Submitted",
      description: "Thank you for your review!",
    });

    setReviewModalOpen(false);
    setReviewRating(0);
    setReviewComment("");
    fetchProducts();
  } catch (error) {
    console.error('Error submitting review:', error);
    toast({
      title: "Error",
      description: "Failed to submit review",
      variant: "destructive",
    });
  }
};

const ProductCardView = ({ product }: { product: Product }) => {
  const avgRating = getAverageRating(product.id);
  const reviewCount = productReviews[product.id]?.length || 0;

  if (viewMode === 'list') {
    return (
      <Card
        className="group hover:shadow-lg transition-shadow duration-200 cursor-pointer overflow-hidden"
        onClick={() => navigate(`/product/${product.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex gap-4 min-h-[140px]">
            <div className="relative flex-shrink-0 w-32 h-32">
              <img
                src={product.images?.[0] || "/placeholder.svg"}
                alt={product.name}
                className="w-full h-full object-cover rounded-lg"
              />
              <div className="absolute top-1 left-1 flex flex-col gap-1">
                {product.is_organic && (
                  <Badge variant="secondary" className="bg-green-500/20 text-green-400 dark:bg-green-500/30 dark:text-green-300 text-xs">
                    <Leaf className="h-2 w-2 mr-1" />
                    Organic
                  </Badge>
                )}
                {product.is_featured && (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 dark:bg-yellow-500/30 dark:text-yellow-300 text-xs">
                    <Award className="h-2 w-2 mr-1" />
                    Featured
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1 mr-2">
                    <h3 className="font-semibold text-lg truncate text-foreground">{product.name}</h3>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{product.farmName} • {product.farmLocation}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="bg-background/90 hover:bg-accent flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleWishlist(product);
                    }}
                  >
                    <Heart
                      className={`h-4 w-4 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : ''}`}
                    />
                  </Button>
                </div>
                {reviewCount > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < avgRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">({reviewCount})</span>
                  </div>
                )}
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                )}
              </div>
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xl font-bold text-green-600">R{product.price.toFixed(2)}</span>
                      <span className="text-sm text-muted-foreground ml-1">/ {product.unit}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {product.quantity} items available
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product);
                    }}
                    disabled={product.quantity === 0}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1 h-8"
                  >
                    <ShoppingCart className="h-3 w-3" />
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-2 py-1 h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReviewProductId(product.id);
                      setReviewModalOpen(true);
                    }}
                  >
                    <Star className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-2 py-1 h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickViewProduct(product);
                    }}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-md hover:scale-[1.02]"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <CardContent className="p-0">
        <div className="relative mb-4">
          <img
            src={product.images?.[0] || "/placeholder.svg"}
            alt={product.name}
            className="w-full h-56 object-cover rounded-t-lg"
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 bg-background/90 hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleWishlist(product);
            }}
          >
            <Heart
              className={`h-4 w-4 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : ''}`}
            />
          </Button>
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.is_organic && (
              <Badge variant="secondary" className="bg-green-500/20 text-green-400 dark:bg-green-500/30 dark:text-green-300">
                <Leaf className="h-3 w-3 mr-1" />
                Organic
              </Badge>
            )}
            {product.is_featured && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 dark:bg-yellow-500/30 dark:text-yellow-300">
                <Award className="h-3 w-3 mr-1" />
                Featured
              </Badge>
            )}
          </div>
        </div>
        <div className="p-3 space-y-2">
          <h3 className="font-bold text-lg line-clamp-1 text-foreground">{product.name}</h3>
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
            <span className="line-clamp-1">{product.farmName} • {product.farmLocation}</span>
            {typeof product.distance === 'number' && (
              <span className="ml-2 text-xs text-primary whitespace-nowrap">{product.distance.toFixed(1)} km</span>
            )}
          </div>
          {product.contactMethod && product.contactValue && (
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={e => {
                e.stopPropagation();
                if (product.contactMethod === 'email') {
                  window.location.href = `mailto:${product.contactValue}`;
                } else if (product.contactMethod === 'phone') {
                  window.location.href = `tel:${product.contactValue}`;
                } else if (product.contactMethod === 'whatsapp') {
                  window.open(`https://wa.me/${product.contactValue}`);
                }
              }}
            >
              Contact Farmer
            </Button>
          )}
          {reviewCount > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < avgRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">({reviewCount})</span>
            </div>
          )}
          {product.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
          )}
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xl font-bold text-green-600">R{product.price.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground ml-1">/ {product.unit}</span>
            </div>
            <div className="flex items-center text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              <Package className="h-3 w-3 mr-1" />
              <span className="font-medium">{product.quantity}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleAddToCart(product);
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-xs px-2 py-1 h-8"
              disabled={product.quantity === 0}
            >
              <ShoppingCart className="h-3 w-3" />
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-2 py-1 h-8"
              onClick={(e) => {
                e.stopPropagation();
                setReviewProductId(product.id);
                setReviewModalOpen(true);
              }}
            >
              <Star className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-2 py-1 h-8"
              onClick={(e) => {
                e.stopPropagation();
                setQuickViewProduct(product);
              }}
            >
              <Eye className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

if (loading) {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl shadow-lg p-4 animate-pulse">
              <div className="h-48 w-full bg-muted rounded-lg mb-4" />
              <div className="h-6 w-2/3 bg-muted rounded mb-2" />
              <div className="h-4 w-1/2 bg-muted rounded mb-2" />
              <div className="h-4 w-1/3 bg-muted rounded mb-2" />
              <div className="flex gap-2 mt-4">
                <div className="h-10 w-24 bg-muted rounded" />
                <div className="h-10 w-10 bg-muted rounded" />
                <div className="h-10 w-10 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

return (
  <div className="min-h-screen bg-background p-2 sm:p-4 pb-20">
    <div className="container mx-auto max-w-full px-2 sm:px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <h1 className="text-3xl font-bold text-foreground">Browse Products</h1>
      </div>
      <div className="bg-card rounded-lg shadow-md p-4 mb-4">
        <div className="flex flex-col gap-4">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {/* Horizontal Category Bar */}
          <div className="w-full overflow-x-auto pb-2">
            <div className="flex gap-2 whitespace-nowrap">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                className="capitalize"
                onClick={() => setSelectedCategory('all')}
              >
                All
              </Button>
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  className="capitalize"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={sortBy} onValueChange={(value: 'name' | 'price' | 'rating' | 'distance') => setSortBy(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="distance">Distance</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      {sortedProducts.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No products found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className={`grid gap-3 ${
          viewMode === 'grid'
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
            : 'grid-cols-1'
        }`}>
          {sortedProducts.map(product => (
            <div key={product.id} className="transition-all duration-200">
              <ProductCardView product={product} />
            </div>
          ))}
        </div>
      )}
      {/* FilterDialog integration */}
      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
          </DialogHeader>
          {/* Use FilterDialog component here */}
          {/* You may want to move FilterDialog to pages or make it accept initial values */}
          <div className="py-2">
            {/* Inline FilterDialog logic for now */}
            <div className="space-y-4">
              {/* Price Range */}
              <div>
                <label className="text-sm font-medium">Price Range (R{activeFilters.priceRange[0]} - R{activeFilters.priceRange[1]})</label>
                <Slider
                  value={activeFilters.priceRange}
                  onValueChange={value => setActiveFilters(f => ({ ...f, priceRange: [value[0], value[1]] }))}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
              {/* Categories */}
              <div>
                <label className="text-sm font-medium">Categories</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(category => (
                    <Badge
                      key={category}
                      variant={activeFilters.categories.includes(category) ? 'default' : 'outline'}
                      className="cursor-pointer capitalize"
                      onClick={() => setActiveFilters(f => ({
                        ...f,
                        categories: f.categories.includes(category)
                          ? f.categories.filter(c => c !== category)
                          : [...f.categories, category]
                      }))}
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
              {/* Organic Only */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Organic Products Only</label>
                <Switch checked={activeFilters.organicOnly} onCheckedChange={checked => setActiveFilters(f => ({ ...f, organicOnly: checked }))} />
              </div>
              {/* Featured Only */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Featured Products Only</label>
                <Switch checked={activeFilters.featuredOnly} onCheckedChange={checked => setActiveFilters(f => ({ ...f, featuredOnly: checked }))} />
              </div>
              <Button onClick={() => setFilterDialogOpen(false)} className="w-full mt-2">Apply Filters</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave a Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Rating</label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    variant="ghost"
                    size="sm"
                    onClick={() => setReviewRating(star)}
                  >
                    <Star
                      className={`h-5 w-5 ${star <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                    />
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Comment</label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your thoughts about this product..."
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitReview} disabled={reviewRating === 0}>
                Submit Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* ProductQuickView Modal */}
      {quickViewProduct && (
        <ProductQuickView
          product={quickViewProduct}
          isOpen={!!quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          onAddToCart={(productId, qty) => {
            const p = products.find(p => p.id === productId);
            if (p) {
              handleAddToCart(p);
            }
          }}
          onAddToWishlist={(productId) => {
            const p = products.find(p => p.id === productId);
            if (p) addToWishlist({ id: p.id, name: p.name, price: p.price, unit: p.unit, image: p.images?.[0] || '/placeholder.svg', farmName: p.farmName || 'Local Farm', category: p.category });
          }}
          isInWishlist={isInWishlist(quickViewProduct.id)}
          isAddingToCart={false}
        />
      )}
    </div>
    <BottomNavBar />
  </div>
);
}

export default BrowseProducts;