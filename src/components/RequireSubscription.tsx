import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const RequireSubscription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!user) {
        // If not authenticated, redirect to login and preserve the intended location
        navigate('/login', { state: { next: location.pathname } });
        return;
      }

      try {
        const { data, error } = await supabase.rpc('has_active_subscription', { _user_id: user.id });
        if (error) throw error;
        // Supabase RPC returns boolean-like values; guard against falsy/undefined
        const has = Boolean((data as unknown) === true || data === 't' || data === 1 || data === 'true');
        if (!has) {
          // Redirect user to Subscriptions page and keep intended full URL (path + search + hash)
          const intended = `${location.pathname}${location.search || ''}${location.hash || ''}`;
          navigate(`/subscriptions?next=${encodeURIComponent(intended)}`);
          if (mounted) setChecking(false);
          return;
        }
      } catch (err) {
        console.error('Subscription check failed', err);
        toast({ title: 'Error', description: 'Failed to verify subscription. Please try again.', variant: 'destructive' });
  // On error, send user to subscriptions page as a safe fallback
  const intendedFallback = `${location.pathname}${location.search || ''}${location.hash || ''}`;
  navigate(`/subscriptions?next=${encodeURIComponent(intendedFallback)}`);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    check();
    return () => { mounted = false; };
  }, [user, navigate, location.pathname, location.search, location.hash, toast]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking subscription...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireSubscription;
