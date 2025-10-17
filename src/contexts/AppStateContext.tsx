import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface CheckoutData {
  address: string;
  paymentMethod: string;
  bankingDetails: string;
  deliveryFee: number;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'farmer' | 'admin';
  read: boolean;
  timestamp: Date;
  action_url?: string;
  action_label?: string;
}

interface AppStateContextType {
  // Checkout state
  checkoutData: CheckoutData;
  updateCheckoutData: (data: Partial<CheckoutData>) => void;
  clearCheckoutData: () => void;
  
  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  getUnreadCount: () => number;
  
  // Navigation state
  hasCompletedWelcome: boolean;
  setHasCompletedWelcome: (completed: boolean) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

interface AppStateProviderProps {
  children: ReactNode;
}

  export const AppStateProvider: React.FC<AppStateProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const userId = user?.id || "guest";
    const [checkoutData, setCheckoutData] = useState<CheckoutData>(() => {
      const saved = localStorage.getItem(`checkoutData_${userId}`);
      return saved ? JSON.parse(saved) : {
        address: '',
        paymentMethod: '',
        bankingDetails: '',
        deliveryFee: 0
      };
    });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem(`notifications_${userId}`);
    let loaded: Notification[] = saved
      ? JSON.parse(saved).map((n: Omit<Notification, 'timestamp'> & { timestamp: string }) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }))
      : [];

    // Check if welcome notification has been seen
    const hasSeenWelcome = localStorage.getItem(`hasCompletedWelcome_${userId}`) === 'true';
    if (!hasSeenWelcome) {
      // Only add welcome notification if not seen
      const welcomeExists = loaded.some(n => n.id === '1' || n.title === 'Welcome!');
      if (!welcomeExists) {
        loaded = [
          {
            id: '1',
            title: 'Welcome!',
            message: 'Welcome to Fresh Market. Start exploring fresh products from local farms.',
            type: 'order' as const,
            read: false,
            timestamp: new Date()
          },
          ...loaded
        ];
      }
    } else {
      // If welcome has been seen, remove it from notifications
      loaded = loaded.filter(n => n.id !== '1' && n.title !== 'Welcome!');
    }
    return loaded;
  });

  const [hasCompletedWelcome, setHasCompletedWelcome] = useState(() => {
    return localStorage.getItem(`hasCompletedWelcome_${userId}`) === 'true';
  });

  // Persist checkout data
  useEffect(() => {
    localStorage.setItem(`checkoutData_${userId}`, JSON.stringify(checkoutData));
  }, [checkoutData, userId]);

  // Persist notifications
  useEffect(() => {
    localStorage.setItem(`notifications_${userId}`, JSON.stringify(notifications));
  }, [notifications, userId]);

  // Persist welcome completion
  useEffect(() => {
    localStorage.setItem(`hasCompletedWelcome_${userId}`, hasCompletedWelcome.toString());
  }, [hasCompletedWelcome, userId]);

  const updateCheckoutData = (data: Partial<CheckoutData>) => {
    setCheckoutData(prev => ({ ...prev, ...data }));
  };

  const clearCheckoutData = () => {
    setCheckoutData({
      address: '',
      paymentMethod: '',
      bankingDetails: '',
      deliveryFee: 0
    });
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
    // If welcome notification is marked as read, persist seen status
    if (id === '1') {
      setHasCompletedWelcome(true);
    }
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    // Also persist welcome as seen if it exists
    const hasWelcome = notifications.some(n => n.id === '1');
    if (hasWelcome) setHasCompletedWelcome(true);
  };

  const getUnreadCount = () => {
    return notifications.filter(n => !n.read).length;
  };

  const value: AppStateContextType = {
    checkoutData,
    updateCheckoutData,
    clearCheckoutData,
    notifications,
    addNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadCount,
    hasCompletedWelcome,
    setHasCompletedWelcome,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};