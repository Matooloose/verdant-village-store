import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Heart, Star, Share2, ShoppingCart, MapPin, Package, Shield, Clock, Plus, Minus, MessageCircle } from "lucide-react";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nutritional_info: any;
  storage_instructions: string | null;
  harvest_date: string | null;
  expiry_date: string | null;
  minimum_order_quantity: number;
  created_at: string;
  farmName?: string;
  farmLocation?: string;
  farmDescription?: string;
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

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    if (productId) {
      fetchProduct();
      fetchReviews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const fetchProduct = async () => {
    if (!productId) return;
    try {
      setLoading(true);
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError) throw productError;

      const { data: farmData } = await supabase
        .from('farms')
        .select('name, location, description')
        .eq('farmer_id', productData.farmer_id)
        .single();

      // Map database row to the Product type explicitly to avoid `any` casts
  const pd = productData as Record<string, unknown>;

      const combinedData: Product = {
        id: String(pd.id ?? ''),
        name: String(pd.name ?? ''),
        description: typeof pd.description === 'string' ? pd.description : null,
        price: typeof pd.price === 'number' ? pd.price : Number(pd.price ?? 0),
        unit: String(pd.unit ?? 'each'),
        category: String(pd.category ?? 'General'),
        images: Array.isArray(pd.images) ? (pd.images as string[]) : (pd.images ? [String(pd.images)] : []),
        is_organic: Boolean(pd.is_organic),
        is_featured: Boolean(pd.is_featured),
        farmer_id: String(pd.farmer_id ?? ''),
        quantity: typeof pd.quantity === 'number' ? pd.quantity : Number(pd.quantity ?? 0),
        // keep this flexible — can be object or null
        nutritional_info: (pd.nutritional_info as unknown) ?? null,
        storage_instructions: typeof pd.storage_instructions === 'string' ? pd.storage_instructions : null,
        harvest_date: typeof pd.harvest_date === 'string' ? pd.harvest_date : null,
        expiry_date: typeof pd.expiry_date === 'string' ? pd.expiry_date : null,
        minimum_order_quantity: typeof pd.minimum_order_quantity === 'number' ? pd.minimum_order_quantity : Number(pd.minimum_order_quantity ?? 1),
        created_at: String(pd.created_at ?? new Date().toISOString()),
        farmName: farmData?.name || 'Unknown Farm',
        farmLocation: farmData?.location || undefined,
        farmDescription: farmData?.description || undefined,
      };

      setProduct(combinedData);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not load product', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    if (!productId) return;
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`*, profiles ( name )`)
        .eq('product_id', productId);
      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    setAddingToCart(true);
    try {
      await addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        image: product.images?.[0] || '/placeholder.svg',
        farmName: product.farmName || 'Unknown Farm',
        category: product.category,
      });
      toast({ title: 'Added to cart', description: `${quantity} × ${product.name} added` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to add to cart', variant: 'destructive' });
    } finally {
      setAddingToCart(false);
    }
  };

  const handleWishlistToggle = () => {
    if (!product) return;
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
      toast({ title: 'Removed', description: `${product.name} removed from wishlist` });
    } else {
      addToWishlist({ id: product.id, name: product.name, price: product.price, unit: product.unit, image: product.images?.[0] || '/placeholder.svg', farmName: product.farmName || 'Unknown Farm', category: product.category });
      toast({ title: 'Added', description: `${product.name} added to wishlist` });
    }
  };

  const submitReview = async () => {
    if (!product || !user || reviewRating === 0) return;
    try {
      const { error } = await supabase.from('reviews').insert({ product_id: product.id, rating: reviewRating, comment: reviewComment, user_id: user.id });
      if (error) throw error;
      toast({ title: 'Thanks', description: 'Review submitted' });
      setReviewModalOpen(false);
      setReviewRating(0);
      setReviewComment('');
      fetchReviews();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not submit review', variant: 'destructive' });
    }
  };

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" /><p className="mt-4 text-muted-foreground">Loading...</p></div></div>
  );

  if (!product) return (
    <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h2 className="text-2xl font-bold text-card-foreground mb-2">Product not found</h2><Button onClick={() => navigate('/browse-products')}>Browse</Button></div></div>
  );

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="container mx-auto max-w-6xl px-4">
        <header className="page-topbar sticky top-0 z-50 bg-card border-b shadow-sm">
          <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="-ml-4" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-5 w-5"/></Button>
              <h2 className="text-lg font-semibold truncate">{product.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  try {
                    if (navigator.share) {
                      navigator.share({ title: product.name, url: window.location.href });
                    } else if (navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.href);
                      toast({ title: 'Link copied' });
                    }
                  } catch (err) {
                    console.error('Share failed', err);
                    toast({ title: 'Share failed', variant: 'destructive' });
                  }
                }}
                aria-label="Share"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-card">
              <img src={product.images?.[selectedImage] || '/placeholder.svg'} alt={product.name} className="w-full h-full object-cover" />
            </div>
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)} className={`aspect-square rounded-lg overflow-hidden border-2 ${selectedImage === i ? 'border-green-500' : 'border-gray-200'}`}>
                    <img src={img} alt={`${product.name} ${i+1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6 lg:relative">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {product.is_organic && <Badge variant="secondary" className="text-xs">🌱 Organic</Badge>}
                  {product.is_featured && <Badge variant="default" className="text-xs">⭐ Featured</Badge>}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground font-medium">
                    <div>{product.farmName}</div>
                    {product.farmLocation && <div className="text-xs text-muted-foreground">{product.farmLocation}</div>}
                  </div>
                </div>

                {reviews.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className={`h-5 w-5 ${i < avgRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />)}</div>
                    <span className="text-lg font-medium text-card-foreground">{avgRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({reviews.length} reviews)</span>
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  <h3 className="text-base font-semibold">About this product</h3>
                  <p className="text-sm text-muted-foreground">{product.description || 'No description available.'}</p>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="space-y-1"><p className="text-xs text-muted-foreground">Category</p><p className="font-medium">{product.category}</p></div>
                    <div className="space-y-1"><p className="text-xs text-muted-foreground">Stock</p><p className="font-medium">{product.quantity} items available</p></div>
                  </div>
                </div>
              </div>

              <aside className="lg:sticky lg:top-20 bg-card p-4 rounded-lg shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-2xl font-bold text-primary">R{product.price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">per {product.unit}</p>
                    </div>
                    <div className="text-sm text-muted-foreground">{product.minimum_order_quantity > 1 ? `Min ${product.minimum_order_quantity}` : ''}</div>
                  </div>

                  <div className="lg:hidden bg-card rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-4">
                <label className="font-medium">Quantity:</label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setQuantity(Math.max(product.minimum_order_quantity, quantity - 1))} disabled={quantity <= product.minimum_order_quantity}><Minus className="h-4 w-4" /></Button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <Button variant="outline" size="sm" onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))} disabled={quantity >= product.quantity}><Plus className="h-4 w-4"/></Button>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleAddToCart} disabled={addingToCart || product.quantity === 0} className="flex-1">{addingToCart ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>Adding...</>) : (<><ShoppingCart className="h-4 w-4 mr-2"/>Add to Cart</>)}</Button>
                <Button variant="outline" onClick={handleWishlistToggle}><Heart className={`h-4 w-4 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : ''}`} /></Button>
              </div>
            </div>

                  

                  
                </div>
              </aside>
            </div>

            

            <div className="grid grid-cols-2 gap-4">
              {product.harvest_date && (<div className="bg-card rounded-lg p-3"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-green-600" /><div><p className="text-sm font-medium">Harvested</p><p className="text-xs text-gray-600">{new Date(product.harvest_date).toLocaleDateString()}</p></div></div></div>)}
              {product.expiry_date && (<div className="bg-card rounded-lg p-3"><div className="flex items-center gap-2"><Shield className="h-4 w-4 text-yellow-600" /><div><p className="text-sm font-medium">Best Before</p><p className="text-xs text-gray-600">{new Date(product.expiry_date).toLocaleDateString()}</p></div></div></div>)}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2">
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>

            </TabsList>

            <TabsContent value="description" className="mt-6">
              <Card><CardContent className="pt-6"><p className="text-muted-foreground leading-relaxed">{product.description || 'No description available for this product.'}</p>{product.farmDescription && (<div className="mt-4 pt-4 border-t"><h4 className="font-semibold mb-2 text-card-foreground">About {product.farmName}</h4><p className="text-muted-foreground">{product.farmDescription}</p></div>)}</CardContent></Card>
            </TabsContent>

            <TabsContent value="nutrition" className="mt-6">
              <Card><CardContent className="pt-6">{product.nutritional_info ? (<pre className="text-sm text-muted-foreground">{JSON.stringify(product.nutritional_info, null, 2)}</pre>) : (<p className="text-muted-foreground">Nutritional information not available for this product.</p>)}</CardContent></Card>
            </TabsContent>

            <TabsContent value="storage" className="mt-6">
              <Card><CardContent className="pt-6"><div className="space-y-4">{product.storage_instructions ? (<p className="text-muted-foreground">{product.storage_instructions}</p>) : (<p className="text-muted-foreground">Storage instructions not available.</p>)}{product.expiry_date && (<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"><div className="flex items-center gap-2"><Shield className="h-4 w-4 text-yellow-600" /><div><p className="text-sm font-medium text-yellow-800">Best Before</p><p className="text-xs text-yellow-600">{new Date(product.expiry_date).toLocaleDateString()}</p></div></div></div>)}</div></CardContent></Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Customer Reviews</CardTitle><Button onClick={() => setReviewModalOpen(true)} variant="outline" size="sm"><MessageCircle className="h-4 w-4 mr-2"/>Write Review</Button></CardHeader>
                <CardContent>
                  {reviews.length === 0 ? (<p className="text-muted-foreground text-center py-8">No reviews yet. Be the first to review this product!</p>) : (
                    <div className="space-y-4">{reviews.map((review) => (<div key={review.id} className="border-b pb-4 last:border-b-0"><div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2"><div className="flex items-center gap-2 min-w-0"><div className="flex flex-shrink-0">{[...Array(5)].map((_, i) => (<Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />))}</div><span className="font-medium text-card-foreground truncate max-w-xs">{review.profiles?.name || 'Anonymous'}</span></div><span className="text-sm text-muted-foreground whitespace-nowrap">{new Date(review.created_at).toLocaleDateString()}</span></div>{review.comment && <p className="text-muted-foreground break-words">{review.comment}</p>}</div>))}</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Write a Review</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Rating</label>
                <div className="flex gap-1 mt-1">{[1,2,3,4,5].map(star => (<Button key={star} variant="ghost" size="sm" onClick={() => setReviewRating(star)}><Star className={`h-5 w-5 ${star <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} /></Button>))}</div>
              </div>

              <div>
                <label className="text-sm font-medium">Comment (optional)</label>
                <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Share your thoughts about this product..." className="mt-1" />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReviewModalOpen(false)}>Cancel</Button>
                <Button onClick={submitReview} disabled={reviewRating === 0}>Submit Review</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}