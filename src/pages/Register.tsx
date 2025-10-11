import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Leaf } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const SIMPLE_REGISTER_STORAGE_KEY = 'pending_profile';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, signIn } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showCheckEmail, setShowCheckEmail] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    if (!form.username || form.username.length < 3) {
      toast({ title: 'Invalid username', description: 'Username must be at least 3 characters', variant: 'destructive' });
      return false;
    }
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address', variant: 'destructive' });
      return false;
    }
    if (!form.password || form.password.length < 8) {
      toast({ title: 'Weak password', description: 'Password should be at least 8 characters', variant: 'destructive' });
      return false;
    }
    if (form.password !== form.confirm) {
      toast({ title: 'Passwords do not match', description: 'Please confirm your password', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Save minimal pending profile so AuthContext can upsert after verification
      localStorage.setItem(SIMPLE_REGISTER_STORAGE_KEY, JSON.stringify({ username: form.username, email: form.email }));
      // Temporarily store the password in sessionStorage to allow automatic sign-in after verification
      try { sessionStorage.setItem('pending_password', form.password); } catch (err) { /* best-effort */ }

      // Call existing signUp (will trigger email verification in most setups)
      const { error } = await signUp(form.email, form.password, form.username);
      if (error) {
        // signUp already shows a toast in AuthContext, but show one here as well
        toast({ title: 'Registration failed', description: error.message || 'Unable to register', variant: 'destructive' });
        setLoading(false);
        return;
      }

      setShowCheckEmail(true);
      toast({ title: 'Verification Sent', description: 'Check your email and click the verification link.' });
    } catch (err) {
      console.error('Register error', err);
      toast({ title: 'Registration failed', description: 'Unexpected error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyClicked = () => {
    // User clicked "I've verified" - navigate to login to sign in normally
    navigate('/login');
  };

  if (showCheckEmail) {
    return (
      <CheckEmailScreen
        email={form.email}
        onManualSignIn={() => navigate('/login')}
        attemptAutoSignIn={async () => {
          const pwd = sessionStorage.getItem('pending_password');
          if (!pwd) return false;
          const res = await signIn(form.email, pwd);
          if (!res?.error) {
            // clear temporary credentials
            try { sessionStorage.removeItem('pending_password'); } catch (e) { console.error('clear pending_password failed', e); }
            try { localStorage.removeItem(SIMPLE_REGISTER_STORAGE_KEY); } catch (e) { console.error('clear pending_profile failed', e); }
            navigate('/dashboard');
            return true;
          }
          return false;
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-primary-light rounded-full flex items-center justify-center mb-2">
            <Leaf className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">FarmersBracket</h1>
          <p className="text-muted-foreground">Create an account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Simple signup — verify by email to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" value={form.username} onChange={handleChange} className="h-11" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} className="h-11" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" value={form.password} onChange={handleChange} className="h-11" />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input id="confirm" name="confirm" type="password" value={form.confirm} onChange={handleChange} className="h-11" />
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</Button>
              </div>
            </form>

            <div className="text-center text-sm mt-4">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;

// Helper component: polls attemptAutoSignIn every 3s for up to ~60s
const CheckEmailScreen: React.FC<{
  email: string;
  onManualSignIn: () => void;
  attemptAutoSignIn: () => Promise<boolean>;
}> = ({ email, onManualSignIn, attemptAutoSignIn }) => {
  const [status, setStatus] = useState<'waiting' | 'attempting' | 'signed_in' | 'failed'>('waiting');

  React.useEffect(() => {
    let attempts = 0;
    let cancelled = false;

    const trySignIn = async () => {
      setStatus('attempting');
      const ok = await attemptAutoSignIn();
      if (cancelled) return;
      if (ok) {
        setStatus('signed_in');
        return;
      }
      attempts += 1;
      if (attempts >= 20) {
        setStatus('failed');
        return;
      }
      setTimeout(trySignIn, 3000);
    };

    const timer = setTimeout(trySignIn, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [attemptAutoSignIn]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <div className="mx-auto w-12 h-12 bg-gradient-to-br from-primary to-primary-light rounded-full flex items-center justify-center">
              <Leaf className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-center">Check your email</CardTitle>
            <CardDescription className="text-center">We've sent a verification link to {email}. After verifying, this screen will attempt to sign you in automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-center">
                {status === 'waiting' && <p className="text-sm text-muted-foreground">Waiting for verification...</p>}
                {status === 'attempting' && <p className="text-sm text-muted-foreground">Attempting to sign you in automatically...</p>}
                {status === 'signed_in' && <p className="text-sm text-green-600">Signed in successfully. Redirecting...</p>}
                {status === 'failed' && <p className="text-sm text-red-600">Automatic sign-in failed. Please sign in manually.</p>}
              </div>

              <Button onClick={onManualSignIn} className="w-full">Sign in manually</Button>
              <div className="text-center text-sm">
                <Link to="/login" className="text-primary">Or go to login</Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};