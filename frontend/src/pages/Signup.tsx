import { useState, useRef} from 'react';
import { signInWithPopup, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, googleProvider, githubProvider } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FaGithub } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { Eye, EyeOff } from 'lucide-react';
import { onboardingPath, rememberSignupRole } from '@/lib/roles';

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  const ALLOWED_FACULTY_DOMAINS = ["amrita.edu", "ch.students.amrita.edu", "ch.amrita.edu"];

  const validateFacultyDomain = (emailAddress: string) => {
    const domain = emailAddress.split("@")[1]?.toLowerCase() || "";
    return ALLOWED_FACULTY_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
  };

  const handleLoginSuccess = async (user: any) => {
    try {
      const token = await user.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API_URL}/api/user/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        navigate('/dashboard');
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

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    isAuthenticating.current = true;
    setLoading(true);
    try {
      rememberSignupRole(role);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(result.user);
      
      // Sign out immediately and force email verification for all users
      await auth.signOut();
      setError('');
      setLoading(false);
      navigate('/verify-email');
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
      setLoading(false);
      isAuthenticating.current = false;
    }
  };

  const handleGoogleLogin = async () => {
    isAuthenticating.current = true;
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (role === 'educator' && result.user.email && !validateFacultyDomain(result.user.email)) {
        await auth.signOut();
        setError("Educator accounts require a verified institutional email address.");
        setLoading(false);
        isAuthenticating.current = false;
        return;
      }
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
      if (role === 'educator' && result.user.email && !validateFacultyDomain(result.user.email)) {
        await auth.signOut();
        setError("Educator accounts require a verified institutional email address.");
        setLoading(false);
        isAuthenticating.current = false;
        return;
      }
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
          <p className="text-white text-lg font-medium animate-pulse">Creating account...</p>
        </div>
      )}
      <div className="min-h-screen w-full flex">
      {/* Left Column - Image & Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden bg-black text-white">
        <div className="absolute inset-0 z-0">
          <img 
            src="/bloch_sphere.png" 
            alt="Quantum Bloch Sphere" 
            className="w-full h-full object-cover opacity-90 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
          <div className="absolute inset-0 bg-emerald-900/20 mix-blend-overlay"></div>
        </div>
        
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3 text-2xl font-sans">
            <img src="/apple-touch-icon.png" alt="Qrious Logo" className="w-10 h-10 rounded-full" />
            Qrious
          </Link>
        </div>

        <div className="relative z-10 max-w-lg mt-auto">
          <h2 className="text-5xl font-sans leading-tight mb-6">
            Begin your quantum journey.
          </h2>
          <p className="text-lg text-white/80">
            Create an account to track your progress, earn badges, and save your interactive circuit experiments.
          </p>
        </div>
      </div>

      {/* Right Column - Signup Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="text-center">
            <h1 className="text-4xl font-sans tracking-tight mb-2">Create an account</h1>
            <p className="text-muted-foreground text-lg">
              Sign up to get started with Qrious
            </p>
          </div>

          <form onSubmit={handleEmailSignup} className="space-y-4 mt-8">
            <div className="space-y-2 mb-6">
              <Label htmlFor="signup-role">I am a</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="signup-role" className="h-10">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="learner">Learner</SelectItem>
                  <SelectItem value="educator">Educator</SelectItem>
                  <SelectItem value="researcher">Researcher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role !== 'learner' && (
              <p className="text-xs text-muted-foreground -mt-3">
                {role === 'educator' ? 'Educator' : 'Researcher'} tools unlock after a quick identity verification (institutional email, ID check, and ORCID or a faculty ID document).
              </p>
            )}

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
              <Label htmlFor="password">Password</Label>
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input 
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-12 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-12 w-12 text-muted-foreground hover:text-foreground hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
              {loading ? "Creating account..." : "Sign up"}
            </Button>
          </form>

          {role === 'learner' && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-background px-2 text-muted-foreground">Or sign up with</span>
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
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
