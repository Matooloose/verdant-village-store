import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BottomNavBar from '@/components/BottomNavBar';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Mail, 
  Star, 
  ShoppingCart,
  Plus,
  Eye,
  Heart,
  Share2,
  Calendar,
  Package,
  Leaf,
  Users,
  Map,
  Navigation,
  Clock,
  Award
} from 'lucide-react';

interface Farm {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  farmer_id: string;
  rating: number | null;
  review_count: number | null;
  farm_size: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
}

interface FarmerProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  bio: string | null;
  role: string | null;
  address: string | null;
  location: string | null;
  company: string | null;
  website: string | null;
  created_at: string;
}

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
  farm_name?: string;
}

const FarmDetail: React.FC = () => {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toast } = useToast();
  
  const [farm, setFarm] = useState<Farm | null>(null);
  const [farmerProfile, setFarmerProfile] = useState<FarmerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);

  // Support both Vite and legacy env var names; prefer VITE_ prefix used by Vite
  const googleApiKey = (import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined) ?? (import.meta.env.REACT_APP_GOOGLE_PLACES_API_KEY as string | undefined);

  useEffect(() => {
    if (farmId) {
      fetchFarmDetails();
      fetchFarmProducts();
    }
  }, [farmId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFarmDetails = async () => {
    if (!farmId) return;

    try {
      setLoading(true);
      // First fetch farm details from farms table
      const { data: farmData, error: farmError } = await supabase
        .from('farms')
        .select('*')
        .eq('id', farmId)
        .single();

      if (farmError) {
        console.error('Error fetching farm:', farmError);
        toast({
          title: "Error",
          description: "Failed to load farm details.",
          variant: "destructive",
        });
        return;
      }

      setFarm(farmData);

      // Then fetch farmer profile using farmer_id
      if (farmData.farmer_id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', farmData.farmer_id)
          .single();

        if (profileError) {
          console.error('Error fetching farmer profile:', profileError);
        } else {
          setFarmerProfile(profileData);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFarmProducts = async () => {
    if (!farmId) return;

    try {
      setProductsLoading(true);
      // First get the farm to get the farmer_id
      const { data: farmData, error: farmError } = await supabase
        .from('farms')
        .select('farmer_id, name')
        .eq('id', farmId)
        .single();

      if (farmError || !farmData) {
        console.error('Error fetching farm for products:', farmError);
        return;
      }

      // Then get products using the farmer_id
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('farmer_id', farmData.farmer_id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      // Add farm name to products for cart context
      const productsWithFarmName = data?.map(product => ({
        ...product,
        farm_name: farmData.name || 'Unknown Farm'
      })) || [];

      setProducts(productsWithFarmName);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    const cartItem = {
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.images[0] || '/placeholder.svg',
      farmName: farm?.name || 'Unknown Farm',
      category: product.category
    };

    addToCart(cartItem);
    toast({
      title: "Added to Cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const handleShare = () => {
    if (navigator.share && farm) {
      navigator.share({
        title: farm.name,
        text: farm.description || `Check out ${farm.name}`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "Farm page link copied to clipboard.",
      });
    }
  };

  const openMapLocation = () => {
    const location = farm?.location || farmerProfile?.address;
    
    if (location) {
      // Use Google Maps with the location/address
      const encodedLocation = encodeURIComponent(location);
      const url = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
      window.open(url, '_blank');
    } else {
      toast({
        title: "Location not available",
        description: "This farm's location is not available.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading farm details...</p>
        </div>
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Farm Not Found</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Farm Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The farm you're looking for doesn't exist or has been removed.
              </p>
              <Button onClick={() => navigate('/all-farms')}>
                Browse All Farms
              </Button>
            </CardContent>
          </Card>
        </div>
        <BottomNavBar />
      </div>
    );
  }

    function toggleMap(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
        event.preventDefault();
        setShowMap((prev) => !prev);
    }

    function openInGoogleMaps() {
        openMapLocation();
    }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold truncate">{farm.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Heart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 pb-24">
        {/* Enhanced Farm Profile Section */}
        <div className="p-4">
          {/* Farm Hero Image */}
          <div className="relative h-48 sm:h-64 rounded-xl overflow-hidden mb-6 bg-gradient-to-br from-green-100 to-green-200">
            {farmerProfile?.image_url || farm.image_url ? (
              <img 
                src={farmerProfile?.image_url || farm.image_url} 
                alt={farm.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Leaf className="h-16 w-16 text-green-600 opacity-50" />
              </div>
            )}
            {/* Overlay with farm name */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{farm.name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                {farm.rating && (
                  <div className="flex items-center gap-1 bg-card/20 backdrop-blur-sm rounded-full px-3 py-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-white font-medium">{farm.rating.toFixed(1)}</span>
                    {farm.review_count && (
                      <span className="text-white/80 text-sm">({farm.review_count})</span>
                    )}
                  </div>
                )}
                {farm.farm_size && (
                  <Badge variant="secondary" className="bg-card/20 backdrop-blur-sm text-card-foreground border-border/30">
                    {farm.farm_size}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Farm Information Card */}
          <Card className="mb-6">
            <CardContent className="p-6">
              {/* Farm Bio/Description */}
              {(farm.description || farmerProfile?.bio) && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-green-600" />
                    About {farm.name}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {farm.description || farmerProfile?.bio}
                  </p>
                </div>
              )}

              {/* Farm Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {(farm.location || farmerProfile?.address) && (
                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Location</p>
                      <p className="text-sm text-muted-foreground">{farm.location || farmerProfile?.address}</p>
                    </div>
                  </div>
                )}

                {farmerProfile?.name && (
                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <Users className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Farm Owner</p>
                      <p className="text-sm text-muted-foreground">{farmerProfile.name}</p>
                    </div>
                  </div>
                )}

                {(farm.contact_phone || farmerProfile?.phone) && (
                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Phone</p>
                      <p className="text-sm text-muted-foreground">{farm.contact_phone || farmerProfile?.phone}</p>
                    </div>
                  </div>
                )}

                {(farm.contact_email || farmerProfile?.email) && (
                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Email</p>
                      <p className="text-sm text-muted-foreground">{farm.contact_email || farmerProfile?.email}</p>
                    </div>
                  </div>
                )}

                {farm.farm_size && (
                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <Package className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Farm Size</p>
                      <p className="text-sm text-muted-foreground">{farm.farm_size}</p>
                    </div>
                  </div>
                )}

                {farmerProfile?.website && (
                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <Award className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Website</p>
                      <a 
                        href={farmerProfile.website.startsWith('http') ? farmerProfile.website : `https://${farmerProfile.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {farmerProfile.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                <Button 
                  onClick={toggleMap}
                  variant={showMap ? "default" : "outline"}
                  className="flex items-center gap-2 flex-1 sm:flex-none"
                >
                  <Map className="h-4 w-4" />
                  {showMap ? "Hide Map" : "See on Map"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleShare}
                  className="flex items-center gap-2 flex-1 sm:flex-none"
                >
                  <Share2 className="h-4 w-4" />
                  Share Farm
                </Button>
                <Button variant="outline" size="icon" className="flex-shrink-0">
                  <Heart className="h-4 w-4" />
                </Button>
              </div>

              {/* Embedded Map Section */}
              {showMap && (
                <div className="mt-6 border-t pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-green-600" />
                        Farm Location
                      </h4>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={openInGoogleMaps}
                        className="flex items-center gap-2"
                      >
                        <Navigation className="h-4 w-4" />
                        Open in Google Maps
                      </Button>
                    </div>
                    
                    <div className="bg-muted/30 rounded-lg p-3 mb-4">
                      <p className="text-sm text-muted-foreground font-medium mb-1">Address:</p>
                      <p className="text-sm">{farm?.location || farmerProfile?.address}</p>
                    </div>

                    {/* Google Map Embed */}
                    <div className="w-full h-64 sm:h-80 rounded-lg overflow-hidden border border-border">
                      {googleApiKey ? (
                        <iframe
                          width="100%"
                          height="100%"
                          className="border-0"
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://www.google.com/maps/embed/v1/place?key=${googleApiKey}&q=${encodeURIComponent(farm?.location || farmerProfile?.address || '')}`}
                          title="Farm Location Map"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                          <p className="text-sm text-muted-foreground mb-3">Map unavailable — Google Maps API key is not configured.</p>
                          <Button onClick={openInGoogleMaps}>Open in Google Maps</Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>📍</span>
                      <span>Click and drag to explore the area • Scroll to zoom</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Products Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">Products from {farm.name}</h3>
                <p className="text-muted-foreground">Fresh, quality produce directly from the farm</p>
              </div>
              <Badge variant="outline" className="flex items-center gap-2 px-3 py-2">
                <Package className="h-4 w-4" />
                <span className="font-medium">{products.length} products</span>
              </Badge>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="aspect-square bg-muted rounded-lg mb-3"></div>
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-3 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-6 bg-muted rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => (
                  <Card key={product.id} className="group hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      {/* Product Image */}
                      <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-muted relative">
                        <img 
                          src={product.images[0] || '/placeholder.svg'} 
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        {product.is_organic && (
                          <Badge className="absolute top-2 left-2 bg-green-600">
                            Organic
                          </Badge>
                        )}
                        {product.is_featured && (
                          <Badge className="absolute top-2 right-2 bg-yellow-600">
                            Featured
                          </Badge>
                        )}
                        {/* Quick view icon */}
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => navigate(`/product/${product.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Product Info */}
                      <div className="space-y-2">
                        <h4 className="font-semibold truncate" title={product.name}>
                          {product.name}
                        </h4>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold text-primary">
                              R{product.price.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              per {product.unit}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {product.category}
                          </Badge>
                        </div>

                        {product.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {product.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-muted-foreground">
                            Stock: {product.quantity}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handleAddToCart(product)}
                            disabled={product.quantity <= 0}
                            className="flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add to Cart
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Products Available</h3>
                  <p className="text-muted-foreground">
                    This farm doesn't have any products listed yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavBar />
    </div>
  );
};

export default FarmDetail;