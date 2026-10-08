import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import InteractiveButton from './InteractiveButton';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { theme } = useTheme();
  const { currentUser } = useAuth();

  useEffect(() => {
    const sentinel = document.createElement('div');
    sentinel.style.position = 'absolute';
    sentinel.style.top = '0';
    sentinel.style.left = '0';
    sentinel.style.height = '20px';
    sentinel.style.width = '1px';
    sentinel.style.pointerEvents = 'none';
    document.body.appendChild(sentinel);

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      { root: null, threshold: 0 }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      if (document.body.contains(sentinel)) {
        document.body.removeChild(sentinel);
      }
    };
  }, []);

  const getTextColor = () => {
    if (!isScrolled) return `text-white/80 hover:text-white hover:bg-white/10`;
    return theme === 'dark' 
      ? `text-white/80 hover:text-white hover:bg-white/10` 
      : `text-black/70 hover:text-black hover:bg-black/5`;
  };

  return (
    <nav 
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-50 flex items-center justify-between transition-all duration-500",
        isScrolled 
          ? cn(
              "top-4 px-6 md:px-6 py-2 rounded-full w-[92%] md:w-[85%] max-w-[1100px]",
              theme === 'dark' 
                ? "bg-black/40 backdrop-blur-2xl shadow-2xl" 
                : "bg-white/40 backdrop-blur-2xl shadow-lg"
            )
          : "top-12 px-6 md:px-12 py-4 w-[96%] max-w-[1500px] bg-transparent"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <img src="/apple-touch-icon.png" alt="Qrious" className={cn("w-8 h-8 rounded-full opacity-90 transition-all", (!isScrolled || theme === 'dark') ? "grayscale" : "")} />
        <span className={cn("font-sans text-xl tracking-tight transition-colors", (!isScrolled || theme === 'dark') ? "text-white" : "text-black")}>Qrious</span>
      </div>

      {/* Center Links */}
      <div className="hidden md:flex items-center gap-1 px-1.5 py-1.5 rounded-full shadow-sm transition-colors"
        style={{
          background: isScrolled ? (theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)') : 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(24px)',
          border: isScrolled ? (theme === 'dark' ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)') : '1px solid rgba(255,255,255,0.15)'
        }}
      >
        {[
          { label: 'Playground', href: '#features' },
          { label: 'Visualizer', href: '#features' },
          { label: 'AI Tutor', href: '#features' },
          { label: 'Learning Hub', href: '#features' },
        ].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            className={cn(
              "px-5 py-2 rounded-full transition-all text-sm font-medium",
              getTextColor()
            )}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 sm:gap-6">
        {!currentUser && (
          <Link 
            to="/login" 
            className={cn(
              "hidden sm:block text-sm font-medium transition-colors",
              (!isScrolled || theme === 'dark') ? "text-white/80 hover:text-white" : "text-black/70 hover:text-black"
            )}
          >
            Sign In
          </Link>
        )}
        <Link to={currentUser ? "/dashboard" : "/login"}>
          <InteractiveButton className="text-sm py-1.5 px-4 h-9" showArrow={false}>
            <span className="hidden sm:inline">
              {currentUser ? "Dashboard" : "Launch Playground"}
            </span>
            <span className="sm:hidden">
              {currentUser ? "Dashboard" : "Launch"}
            </span>
          </InteractiveButton>
        </Link>
      </div>
    </nav>
  );
}
