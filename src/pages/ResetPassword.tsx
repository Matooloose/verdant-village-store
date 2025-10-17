import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// This page expects to be reached via a link from Supabase that may include
// access_token/refresh_token in either the query string or fragment (#).
// If tokens are present we call supabase.auth.setSession(...) and then
// render the reset form which calls updateUser({ password }).

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    type ParseResult =
      | { access_token: string; refresh_token: string }
      | { error?: string | null; error_code?: string | null; error_description?: string | null }
      | null;

    const parseParams = (): ParseResult => {
      const url = new URL(window.location.href);
      const search = url.searchParams;

      // Check query params first
      const access_token = search.get('access_token');
      const refresh_token = search.get('refresh_token');

  if (access_token && refresh_token) return { access_token, refresh_token };

  // Also detect Supabase error params in query
  const err = search.get('error') || null;
  const errCode = search.get('error_code') || null;
  const errDesc = search.get('error_description') || null;
  if (err || errCode) return { error: err, error_code: errCode, error_description: errDesc };

      // Fallback to fragment
      if (window.location.hash) {
        const hash = window.location.hash.replace(/^#/, '');
        const hparams = new URLSearchParams(hash);
        const a = hparams.get('access_token');
        const r = hparams.get('refresh_token');
        if (a && r) return { access_token: a, refresh_token: r };
      }

      return null;
    };

    (async () => {
      const tokens = parseParams();
      if (tokens) {
        // If parseParams returned an error object instead of tokens, show friendly message
        if ('error' in tokens || 'error_code' in tokens) {
          const desc = (tokens as { error_description?: string | null }).error_description || 'The reset link is invalid or has expired.';
          setLinkError(desc ?? 'The reset link is invalid or has expired.');
          setReady(true);
          return;
        }
        try {
          // Set session so updateUser works
          type MinimalSession = { access_token: string; refresh_token: string };
          const sessionObj: MinimalSession = { access_token: tokens.access_token, refresh_token: tokens.refresh_token };
          const { error } = await supabase.auth.setSession(sessionObj as unknown as Record<string, string>);
          if (error) {
            console.error('setSession error on reset callback', error);
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
            return;
          }

          // Clear fragment/query to avoid reprocessing if reloaded
          try {
            const u = new URL(window.location.href);
            u.hash = '';
            u.searchParams.delete('access_token');
            u.searchParams.delete('refresh_token');
            window.history.replaceState({}, '', u.toString());
          } catch (e) {
            // ignore
          }

          setReady(true);
          return;
        } catch (err) {
          console.error('Failed to set session from reset link', err);
          toast({ title: 'Error', description: 'Failed to process reset link', variant: 'destructive' });
          return;
        }
      }

      // If no tokens were present, still allow the user to reach this page
      setReady(true);
    })();
  }, [toast]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password Reset Successful', description: 'Your password has been updated. You can now sign in.' });
      navigate('/login');
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to reset password', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Processing reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md mx-auto">
        {/* Header like sign-in / sign-up */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-primary-light rounded-full flex items-center justify-center mb-2">
            {/* Logo SVG or image — reuse existing Leaf icon if available */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary-foreground">
              <path d="M12 2C12 2 16 6 12 10C8 14 4 12 4 12C4 12 6 8 12 2Z" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">FarmersBracket</h1>
          <p className="text-muted-foreground">Buy fresh. Support local farmers.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
          </CardHeader>
          <CardContent>
            {linkError ? (
              <div className="space-y-4 text-center">
                <p className="text-red-600">{linkError}</p>
                <div className="flex gap-2">
                  <Button onClick={() => navigate('/forgot-password')} className="flex-1">Request new link</Button>
                  <Button variant="secondary" onClick={() => navigate('/login')}>Back to login</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
