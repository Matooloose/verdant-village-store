import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertCircle } from 'lucide-react';

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const type = searchParams.get('type');

    // If Supabase provided session tokens in the URL (signup/ invite / recovery flows)
    if (accessToken && refreshToken && (type === 'signup' || type === 'invite' || type === 'recovery')) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(() => {
        setStatus('success');
        // Small delay so user sees success then redirect
        setTimeout(() => navigate('/dashboard'), 1200);
      }).catch((error) => {
        console.error('Auth callback setSession error:', error);
        setStatus('error');
        toast({ title: 'Authentication failed', description: 'Unable to complete sign-in. Please sign in manually.', variant: 'destructive' });
        setTimeout(() => navigate('/login'), 2000);
      });
    } else {
      // No tokens found — show error and send to login
      setStatus('error');
      toast({ title: 'Invalid callback', description: 'Missing authentication tokens in the URL.', variant: 'destructive' });
      setTimeout(() => navigate('/login'), 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Completing sign-in</CardTitle>
            <CardDescription>Finishing your sign-in and redirecting to your dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {status === 'processing' && (
              <div>
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Processing authentication...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="inline-flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg mx-auto">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Signed in successfully</span>
              </div>
            )}

            {status === 'error' && (
              <div>
                <div className="inline-flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg mx-auto">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Sign-in failed</span>
                </div>
                <div className="mt-4">
                  <Button onClick={() => navigate('/login')}>Go to Login</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthCallback;
