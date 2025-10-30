import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, Heart, X } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  unit: string;
  images?: string[];
};

type Props = {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (productId: string, quantity: number) => void;
  onAddToWishlist: (productId: string) => void;
  isInWishlist?: boolean;
  isAddingToCart?: boolean;
  farmName?: string;
};

/**
 * Compact Product Quick View
 * - Fixed quantity = 1 for quick-add
 * - Small footprint, responsive, non-overlapping
 */
const ProductQuickView: React.FC<Props> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onAddToWishlist,
  isInWishlist = false,
  isAddingToCart = false,
  farmName = 'Local Farm'
}) => {
  const navigate = useNavigate();

  if (!product) return null;

  const handleAdd = () => {
    onAddToCart(product.id, 1);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent hideClose className="w-full max-w-sm sm:max-w-md max-h-[70vh] overflow-hidden">
        {/* Provide an accessible DialogTitle for Radix (screen readers). Hidden visually to avoid duplicate title UI. */}
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <div className="flex flex-col sm:flex-row gap-4 p-3">
          <div className="relative w-full sm:w-1/2 rounded-md overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center min-h-[120px]">
            {/* Quick close button positioned over image so it's always visible */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close quick view"
              className="absolute right-2 top-2 z-50 bg-background/80"
            >
              <X className="h-4 w-4" />
            </Button>
            {product.images && product.images.length > 0 ? (
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="h-12 w-12 text-primary/40" />
            )}
          </div>

          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-lg line-clamp-2">{product.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{farmName}</p>
              <p className="text-primary font-semibold mt-2">R{product.price}/{product.unit}</p>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{product.description || 'No description available'}</p>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <Button onClick={handleAdd} className="flex-1" disabled={isAddingToCart}>
                {isAddingToCart ? 'Adding...' : 'Add to Cart'}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  navigate(`/product/${product.id}`);
                }}
              >
                Details
              </Button>

              <Button variant="ghost" onClick={() => onAddToWishlist(product.id)} aria-label="Toggle wishlist">
                <Heart className={`h-4 w-4 ${isInWishlist ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductQuickView;