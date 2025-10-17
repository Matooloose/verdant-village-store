import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
  image?: string;
  farmName?: string;
  category?: string;
  distance?: number; // km
  weight?: number; // kg
  farmId?: string; // Add farm ID for better grouping
}

export interface FarmGroup {
  farmName: string;
  farmId?: string;
  items: CartItem[];
  totalPrice: number;
  totalItems: number;
  minimumOrder?: number; // Minimum order amount for this farm
  canCheckout: boolean; // Whether this farm group meets minimum order
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Omit<CartItem, 'quantity'>) => void;
  updateQuantity: (id: string, newQuantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  clearFarmCart: (farmName: string) => void; // Clear specific farm's items
  getTotalPrice: () => number;
  getTotalItems: () => number;
  getFarmGroups: () => FarmGroup[]; // Get items grouped by farm
  getFarmTotal: (farmName: string) => number; // Get total for specific farm
  getFarmItemCount: (farmName: string) => number; // Get item count for specific farm
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Load cart from localStorage on component mount
  useEffect(() => {
    const savedCart = localStorage.getItem('farmersCart');
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setCartItems(parsedCart);
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
        localStorage.removeItem('farmersCart');
      }
    }
  }, []);

  // Save cart to localStorage whenever cartItems changes
  useEffect(() => {
    localStorage.setItem('farmersCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product: Omit<CartItem, 'quantity'>) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      
      if (existingItem) {
        return prevItems.map(item =>
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevItems, { ...product, quantity: 1 }];
      }
    });
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(id);
      return;
    }
    
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeItem = (id: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const clearFarmCart = (farmName: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.farmName !== farmName));
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const getFarmGroups = (): FarmGroup[] => {
    const farmMap = new Map<string, CartItem[]>();
    
    // Group items by farm
    cartItems.forEach(item => {
      const farmName = item.farmName || 'Unknown Farm';
      if (!farmMap.has(farmName)) {
        farmMap.set(farmName, []);
      }
      farmMap.get(farmName)!.push(item);
    });

    // Convert to FarmGroup array
    return Array.from(farmMap.entries()).map(([farmName, items]) => {
      const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      const minimumOrder = 100; // Default minimum order - you can make this dynamic
      
      return {
        farmName,
        farmId: items[0]?.farmId,
        items,
        totalPrice,
        totalItems,
        minimumOrder,
        canCheckout: totalPrice >= minimumOrder
      };
    });
  };

  const getFarmTotal = (farmName: string): number => {
    return cartItems
      .filter(item => item.farmName === farmName)
      .reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getFarmItemCount = (farmName: string): number => {
    return cartItems
      .filter(item => item.farmName === farmName)
      .reduce((total, item) => total + item.quantity, 0);
  };

  const value: CartContextType = {
    cartItems,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    clearFarmCart,
    getTotalPrice,
    getTotalItems,
    getFarmGroups,
    getFarmTotal,
    getFarmItemCount,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};