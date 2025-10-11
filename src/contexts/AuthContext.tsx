/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { notificationService } from "@/lib/notificationService";
// Removed unused import for useAuth as it is not used in this file.

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: Error | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error?: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: Error | null }>;
  resendVerification: (email: string) => Promise<{ error?: Error | null }>;
  deleteAccount: () => Promise<{ error?: Error | null }>;
  exportUserData: () => Promise<{ data?: unknown; error?: Error | null }>;
  isEmailVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const { toast } = useToast();

  // Shape used to upsert into the profiles table
  type ProfileUpsert = {
    id: string;
    email?: string | null;
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    bio?: string | null;
  };

  useEffect(() => {
    // Get initial session
    console.time('auth.getSession');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.timeEnd('auth.getSession');
      setUser(session?.user ?? null);
      setLoading(false);

      // Initialize notifications for authenticated user
      if (session?.user) {
        // measure notification initialization time
        console.time('initializeNotifications');
        initializeNotifications(session.user.id).finally(() => console.timeEnd('initializeNotifications'));
        setIsEmailVerified(session.user.email_confirmed_at !== null);
      }
    }).catch(err => {
      console.timeEnd('auth.getSession');
      console.error('getSession error', err);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.time('auth.onAuthStateChange');
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        // Update email verified flag
        setIsEmailVerified(session.user.email_confirmed_at !== null);

        // Initialize notifications when user logs in
        console.time('initializeNotifications');
        await initializeNotifications(session.user.id).finally(() => console.timeEnd('initializeNotifications'));

        // If there's a pending profile (saved during simplified signup), upsert it now
        try {
              const pendingRaw = localStorage.getItem('pending_profile');
              if (pendingRaw) {
                const pending = JSON.parse(pendingRaw);
                if (pending && (pending.username || pending.email)) {
                  const profilePayload: ProfileUpsert = {
                    id: session.user.id,
                    email: pending.email || session.user.email || null,
                    name: pending.username || session.user.user_metadata?.name || null,
                    first_name: pending.firstName || null,
                    last_name: pending.lastName || null,
                    phone: pending.phone || null,
                    bio: pending.bio || null,
                  };

                  // Attempt upsert and provide richer logging on failure to diagnose 400 errors
                  console.time('pending_profile_upsert');
                  type SupabaseUpsertResult = { data?: unknown; error?: { message?: string; details?: unknown } };
                  let upsertResult: SupabaseUpsertResult | undefined;
                  try {
                    upsertResult = await supabase.from('profiles').upsert(profilePayload) as unknown as SupabaseUpsertResult;
                  } finally {
                    console.timeEnd('pending_profile_upsert');
                  }
                  const { error } = upsertResult ?? {};
                  if (!error) {
                    try { localStorage.removeItem('pending_profile'); } catch (err) { console.error('clear pending_profile failed', err); }
                    toast({ title: 'Profile created', description: 'Your profile has been completed.' });
                  } else {
                    // Log payload and full error object for debugging
                    console.error('Failed to upsert pending profile. Payload:', profilePayload);
                    console.error('Supabase upsert error object:', error);

                    // Try to show more actionable details in a destructive toast
                    const errObj = error as unknown as Record<string, unknown>;
                    const details = typeof errObj?.details === 'string' ? (errObj.details as string) : undefined;
                    toast({ title: 'Profile creation failed', description: details || error.message || 'Unable to create profile', variant: 'destructive' });
                  }
                }
              }
        } catch (err) {
          console.error('Failed parsing or upserting pending profile:', err);
          try { localStorage.removeItem('pending_profile'); } catch (e) { console.error('clear pending_profile failed', e); }
        }
      } else {
        // Clean up when user logs out
        await notificationService.unsubscribe();
      }

      console.timeEnd('auth.onAuthStateChange');
    });

    return () => subscription.unsubscribe();
  }, [toast]);

  const initializeNotifications = async (userId: string) => {
    try {
      await notificationService.initialize();
      await notificationService.subscribeToRealTimeUpdates(userId);
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    console.time('auth.signIn');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.timeEnd('auth.signIn');

      if (error) {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return { error };
      }

      toast({
        title: "Welcome back!",
        description: "Successfully logged in to FarmersBracket",
      });

      setLoading(false);
      return {};
    } catch (error) {
      console.timeEnd('auth.signIn');
      setLoading(false);
      return { error: error instanceof Error ? error : new Error('Unknown error') };
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: username },
          // Ensure verification and recovery links returned by Supabase redirect
          // to our application callback so we can call setSession and finish onboarding
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      
      if (error) {
        toast({
          title: "Registration Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }
      
      toast({
        title: "Welcome to FarmersBracket!",
        description: "Your account has been created successfully. Please check your email for verification.",
      });
      
      return {};
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Unknown error') };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      toast({
        title: "Goodbye!",
        description: "You have been logged out successfully",
      });
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      
      if (error) {
        toast({
          title: "Password Reset Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }
      
      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for password reset instructions",
      });
      
      return {};
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Unknown error') };
    }
  };

  const resendVerification = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      
      if (error) {
        toast({
          title: "Verification Email Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }
      
      toast({
        title: "Verification Email Sent",
        description: "Check your email for verification instructions",
      });
      
      return {};
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Unknown error') };
    }
  };

  const deleteAccount = async () => {
    try {
      if (!user) {
        return { error: new Error('No user logged in') };
      }

      // First, delete user data from our tables
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
      }

      // Delete the user account
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      
      if (error) {
        toast({
          title: "Account Deletion Failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }
      
      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted",
      });
      
      return {};
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Unknown error') };
    }
  };

  const exportUserData = async () => {
    try {
      if (!user) {
        return { error: new Error('No user logged in') };
      }

      // Collect user data from various tables
      const [
        { data: profile },
        { data: orders },
        { data: reviews }
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('orders').select('*').eq('user_id', user.id),
        supabase.from('reviews').select('*').eq('user_id', user.id)
      ]);

      const userData = {
        account: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          email_confirmed_at: user.email_confirmed_at,
        },
        profile,
        orders: orders || [],
        reviews: reviews || [],
        exportedAt: new Date().toISOString(),
      };

      return { data: userData };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Unknown error') };
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    resendVerification,
    deleteAccount,
    exportUserData,
    isEmailVerified,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};