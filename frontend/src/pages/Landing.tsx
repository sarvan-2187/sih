import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import FeatureGrid from '@/components/landing/FeatureGrid';
import WorkflowBlock from '@/components/landing/WorkflowBlock';
import AudienceBento from '@/components/landing/AudienceBento';
import FooterCTA from '@/components/landing/FooterCTA';
import SmoothScroll from '@/components/SmoothScroll';
import { useTheme } from '@/context/ThemeContext';

export default function Landing() {
  const { theme } = useTheme();

  return (
    <SmoothScroll>
      <main className={`min-h-screen pb-4 px-4 sm:px-6 md:px-8 pt-4 transition-colors duration-300 flex flex-col items-center ${
        theme === 'dark' 
          ? 'bg-zinc-950 text-white selection:bg-emerald-500 selection:text-zinc-900' 
          : 'bg-zinc-100 text-zinc-900 selection:bg-emerald-400 selection:text-zinc-900'
      }`}>
        <Navbar />
        
        <div className="w-full max-w-[1600px] flex flex-col gap-4">
          <HeroSection />
          <FeatureGrid />
          <WorkflowBlock />
          <AudienceBento />
          <FooterCTA />
        </div>

        <footer className="w-full text-center py-8 mt-4 flex flex-col gap-2 items-center text-sm font-medium opacity-60">
          <p>&copy; {new Date().getFullYear()} Qrious. All rights reserved.</p>
        </footer>
      </main>
    </SmoothScroll>
  );
}
