import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Leaf, Check, X, Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // live password requirement checks
  const pw = form.password || '';
  const pwChecks = {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number: /\d/.test(pw),
  special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw),
  };
  const pwPassedCount = Object.values(pwChecks).filter(Boolean).length;
  const allPwOk = pwPassedCount === 4;
  const confirmMatch = form.password === form.confirm && form.confirm.length > 0;

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
    // Password policy: min 8 chars, at least one uppercase, one number, one special
    const pw = form.password || '';
    const pwPolicy = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    if (!pwPolicy.test(pw)) {
      const msg = 'Password must be at least 8 characters and include an uppercase letter, a number and a special character';
      setPasswordError(msg);
      toast({ title: 'Weak password', description: msg, variant: 'destructive' });
      return false;
    }
    setPasswordError(null);
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
                <div className="relative">
                  <Input id="password" name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} className="h-11 pr-10" />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordError && <p className="text-xs text-red-600 mt-1">{passwordError}</p>}

                {/* Password requirements checklist */}
                <div className="mt-2 text-sm" aria-live="polite">
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2">
                      {pwChecks.length ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-red-500" />}
                      <span className={pwChecks.length ? 'text-sm text-green-600' : 'text-sm text-red-500'}>At least 8 characters</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {pwChecks.uppercase ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-red-500" />}
                      <span className={pwChecks.uppercase ? 'text-sm text-green-600' : 'text-sm text-red-500'}>One uppercase letter (A–Z)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {pwChecks.number ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-red-500" />}
                      <span className={pwChecks.number ? 'text-sm text-green-600' : 'text-sm text-red-500'}>One number (0–9)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {pwChecks.special ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-red-500" />}
                      <span className={pwChecks.special ? 'text-sm text-green-600' : 'text-sm text-red-500'}>One special character (!@#$...)</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div>
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input id="confirm" name="confirm" type={showPassword ? 'text' : 'password'} value={form.confirm} onChange={handleChange} className="h-11" />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || !allPwOk || !confirmMatch}
                  aria-describedby="register-password-hint"
                >
                  {loading ? 'Creating...' : 'Create account'}
                </Button>
              </div>
              {/* Helper text shown when CTA is disabled to explain why */}
              {!loading && (!allPwOk || !confirmMatch) && (
                <p id="register-password-hint" className="text-xs text-muted-foreground mt-2">
                  {(!allPwOk) ? 'Meet all password requirements' : (!confirmMatch ? 'Passwords must match' : '')}
                </p>
              )}

              {/* Screen-reader live summary of password checklist */}
              <div className="sr-only" aria-live="polite">{`Password requirements met ${pwPassedCount} of 4. ${confirmMatch ? 'Passwords match.' : 'Passwords do not match.'}`}</div>
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

  useEffect(() => {
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