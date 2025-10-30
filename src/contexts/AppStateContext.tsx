import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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
  // Notification click lifecycle: set when user clicks a notification with an action_url; App can mark read after navigation
  lastClickedNotificationId?: string | null;
  setLastClickedNotificationId?: (id: string | null) => void;
  clearLastClickedNotificationId?: () => void;
  
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
    // Notifications: will be loaded from Supabase when user is available; fall back to localStorage for guest
    const [notifications, setNotifications] = useState<Notification[]>(() => []);
    // last clicked notification id (for route-change -> mark-as-read semantics)
    const [lastClickedNotificationId, setLastClickedNotificationId] = useState<string | null>(null);

  const [hasCompletedWelcome, setHasCompletedWelcome] = useState(() => {
    return localStorage.getItem(`hasCompletedWelcome_${userId}`) === 'true';
  });

  // Persist checkout data
  useEffect(() => {
    localStorage.setItem(`checkoutData_${userId}`, JSON.stringify(checkoutData));
  }, [checkoutData, userId]);
  // Persist welcome completion (keep this local)
  useEffect(() => {
    localStorage.setItem(`hasCompletedWelcome_${userId}`, hasCompletedWelcome.toString());
  }, [hasCompletedWelcome, userId]);

  // Load notifications for authenticated user from Supabase and subscribe to realtime changes
  useEffect(() => {
    let channel: any = null;
    let mounted = true;

    async function loadNotifications() {
      if (!user) {
        // load local fallback for guests (keep previous welcome behaviour)
        const saved = localStorage.getItem(`notifications_${userId}`);
        let loaded: Notification[] = saved
          ? JSON.parse(saved).map((n: Omit<Notification, 'timestamp'> & { timestamp: string }) => ({
              ...n,
              timestamp: new Date(n.timestamp)
            }))
          : [];

        const hasSeenWelcome = localStorage.getItem(`hasCompletedWelcome_${userId}`) === 'true';
        if (!hasSeenWelcome) {
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
          loaded = loaded.filter(n => n.id !== '1' && n.title !== 'Welcome!');
        }

        if (mounted) setNotifications(loaded);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, user_id, title, message, type, action_url, read, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading notifications from Supabase:', error);
        } else if (mounted && data) {
          const mapped = (data || []).map((r: any) => ({
            id: r.id,
            title: r.title,
            message: r.message,
            type: r.type,
            read: r.read,
            timestamp: new Date(r.created_at),
            action_url: r.action_url
          }));
          setNotifications(mapped);
        }

        // Subscribe to realtime notifications for this user
        channel = supabase.channel(`public:notifications:user:${user.id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload: any) => {
            const r = payload.new;
            const newNotif: Notification = {
              id: r.id,
              title: r.title,
              message: r.message,
              type: r.type,
              read: r.read,
              timestamp: new Date(r.created_at),
              action_url: r.action_url
            };
            setNotifications(prev => [newNotif, ...prev]);
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload: any) => {
            const r = payload.new;
            setNotifications(prev => prev.map(n => (n.id === r.id ? { ...n, read: r.read, title: r.title, message: r.message, action_url: r.action_url, timestamp: new Date(r.created_at) } : n)));
          })
          .subscribe();
      } catch (e) {
        console.error('Failed to load/subscribe notifications:', e);
      }
    }

    loadNotifications();

    return () => {
      mounted = false;
      try {
        if (channel && channel.unsubscribe) channel.unsubscribe();
      } catch (e) {
        // ignore
      }
    };
  }, [user, userId]);

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
    // If user is authenticated, insert into Supabase so it persists for that user
    if (user) {
      supabase.from('notifications').insert({
        user_id: user.id,
        title: newNotification.title,
        message: newNotification.message,
        type: newNotification.type,
        action_url: newNotification.action_url
      }).catch(err => console.error('Failed to insert notification', err));
    }
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(notification => notification.id === id ? { ...notification, read: true } : notification));
    if (user) {
      supabase.from('notifications').update({ read: true }).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to mark notification read on server', error);
      });
    } else {
      // persist local for guests
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(notifications));
    }
    if (id === '1') setHasCompletedWelcome(true);
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (user) {
      supabase.from('notifications').update({ read: true }).eq('user_id', user.id).then(({ error }) => {
        if (error) console.error('Failed to mark all notifications read on server', error);
      });
    } else {
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(notifications.map(n => ({ ...n, read: true }))));
    }
    if (notifications.some(n => n.id === '1')) setHasCompletedWelcome(true);
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
    lastClickedNotificationId,
    setLastClickedNotificationId,
    clearLastClickedNotificationId: () => setLastClickedNotificationId(null),
    hasCompletedWelcome,
    setHasCompletedWelcome,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};