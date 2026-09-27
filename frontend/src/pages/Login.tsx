import { useState, useRef } from 'react';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider, githubProvider } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FaGithub } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { isStaff, onboardingPath } from '@/lib/roles';
import { Eye, EyeOff, GraduationCap, Presentation, FlaskConical, ShieldCheck } from 'lucide-react';

const DEMO_PASSWORD = 'Demo@1234';
const DEMO_ADMIN_EMAIL = 'demo-admin@gmail.com';
const DEMO_ACCOUNTS = [
  { label: 'Student', email: 'demo-student@gmail.com', icon: GraduationCap },
  { label: 'Educator', email: 'demo-educator@gmail.com', icon: Presentation },
  { label: 'Researcher', email: 'demo-researcher@gmail.com', icon: FlaskConical },
  { label: 'Admin', email: DEMO_ADMIN_EMAIL, icon: ShieldCheck, note: 'UI mockup' },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('learner');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();
  const isAuthenticating = useRef(false);

  useEffect(() => {
    if (currentUser && !isAuthenticating.current) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  const handleLoginSuccess = async (user: any) => {
    try {
      await user.reload(); // Refresh the user to get the latest emailVerified status
      if (!user.emailVerified) {
        await auth.signOut(); // We don't want auth context carrying an unverified user
        setLoading(false);
        navigate('/verify-email');
        return;
      }

      const token = await user.getIdToken(true);
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API_URL}/api/user/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.role === 'admin') navigate('/admin');
        else if (isStaff(data.role) && data.verification?.status !== 'approved') navigate('/verification');
        else navigate('/dashboard');
      } else if (response.status === 404) {
        navigate(onboardingPath(role));
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || "Authentication failed. Please try again later.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch user data", error);
      setError("Unable to connect to the server. Please ensure the backend is running.");
      setLoading(false);
    }
  };

  const loginWithEmail = async (loginEmail: string, loginPassword: string) => {
    setError('');
    // Admin demo is a read-only UI mockup, never a real account (a real admin could edit the whole site)
    if (loginEmail.trim().toLowerCase() === DEMO_ADMIN_EMAIL && loginPassword === DEMO_PASSWORD) {
      navigate('/admin-demo');
      return;
    }
    isAuthenticating.current = true;
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      await handleLoginSuccess(result.user);
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please check your credentials.");
      setLoading(false);
      isAuthenticating.current = false;
    }
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginWithEmail(email, password);
  };

  const handleDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    loginWithEmail(demoEmail, DEMO_PASSWORD);
  };

  const handleGoogleLogin = async () => {
    isAuthenticating.current = true;
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Google Auth inherently verifies email, but our logic in handleLoginSuccess will check it anyway
      await handleLoginSuccess(result.user);
    } catch (error) {
      console.error("Google login failed", error);
      setLoading(false);
      isAuthenticating.current = false;
    }
  };

  const handleGithubLogin = async () => {
    isAuthenticating.current = true;
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, githubProvider);
      await handleLoginSuccess(result.user);
    } catch (error) {
      console.error("Github login failed", error);
      setLoading(false);
      isAuthenticating.current = false;
    }
  };

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white text-lg font-medium animate-pulse">Authenticating...</p>
        </div>
      )}
      <div className="min-h-screen w-full flex">
      {/* Left Column - Image & Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden bg-black text-white">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/bloch_sphere.png" 
            alt="Quantum Bloch Sphere" 
            className="w-full h-full object-cover opacity-90 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
          <div className="absolute inset-0 bg-emerald-900/20 mix-blend-overlay"></div>
        </div>
        
        {/* Foreground Content */}
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3 text-2xl font-sans">
            <img src="/apple-touch-icon.png" alt="Qrious Logo" className="w-10 h-10 rounded-full" />
            Qrious
          </Link>
        </div>

        <div className="relative z-10 max-w-lg mt-auto">
          <h2 className="text-5xl font-sans leading-tight mb-6">
            Master the quantum realm.
          </h2>
          <p className="text-lg text-white/80">
            Join thousands of developers, researchers, and enthusiasts exploring the fundamentals of quantum computing through interactive visualizations.
          </p>
        </div>
      </div>

      {/* Right Column - Login Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="text-center">
            <h1 className="text-4xl font-sans tracking-tight mb-2">Welcome back</h1>
            <p className="text-muted-foreground text-lg">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4 mt-8">
            <ToggleGroup 
              type="single" 
              value={role} 
              onValueChange={(val) => { if (val) setRole(val) }} 
              className="mb-6 w-full flex bg-muted p-1 rounded-md"
            >
              <ToggleGroupItem value="learner" className="flex-1 rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm h-10">
                Learner
              </ToggleGroupItem>
              <ToggleGroupItem value="educator" className="flex-1 rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm h-10">
                Educator
              </ToggleGroupItem>
              <ToggleGroupItem value="researcher" className="flex-1 rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm h-10">
                Researcher
              </ToggleGroupItem>
            </ToggleGroup>

            {error && (
              <div className="p-3 rounded-md bg-destructive/15 text-destructive text-sm font-medium">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email"
                type="email" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input 
                  id="password"
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-12 w-12 text-muted-foreground hover:text-foreground hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="rounded-xl border border-border/50 bg-muted/40 p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Demo accounts</p>
              <p className="text-xs text-muted-foreground">
                Password: <span className="font-mono text-foreground">{DEMO_PASSWORD}</span>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(({ label, email: demoEmail, icon: Icon, note }) => (
                <button
                  key={demoEmail}
                  type="button"
                  onClick={() => handleDemoLogin(demoEmail)}
                  disabled={loading}
                  className="flex items-start gap-2 rounded-lg border border-border/50 bg-card p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50"
                >
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {label}
                      {note && (
                        <span className="rounded bg-primary/10 px-1.5 py-px text-[10px] uppercase tracking-wide text-primary">{note}</span>
                      )}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">{demoEmail}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click an account to sign in. Researchers get every educator feature plus mentorship from verified professors. The Admin demo is a read-only UI mockup showing what admins can access.
            </p>
          </div>

          {role === 'learner' && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <div className="space-y-4">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full h-12 text-md bg-card hover:bg-accent border-border/50 shadow-sm transition-all flex items-center justify-center gap-3" 
                  onClick={handleGoogleLogin}
                >
                  <FcGoogle className="text-xl" />
                  Google
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full h-12 text-md bg-card hover:bg-accent border-border/50 shadow-sm transition-all flex items-center justify-center gap-3" 
                  onClick={handleGithubLogin}
                >
                  <FaGithub className="text-xl" /> 
                  GitHub
                </Button>
              </div>
            </>
          )}

          <p className="text-center text-sm text-muted-foreground mt-8">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
