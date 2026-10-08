import { motion } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { HeroVideoDialog } from '@/components/ui/hero-video-dialog';

export default function WalkthroughSection() {
  const { theme } = useTheme();

  return (
    <section id="walkthrough" className={cn(
      "min-h-[90vh] md:min-h-screen flex flex-col justify-center py-24 md:py-32 rounded-[1.5rem] md:rounded-[2.5rem] mt-4 px-6 md:px-16 w-full overflow-hidden relative transition-colors duration-300",
      theme === 'dark' ? "bg-zinc-950/80 border border-white/10" : "bg-white border border-zinc-200"
    )}>
      <div className="w-full max-w-[1200px] mx-auto flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className={cn("text-3xl md:text-5xl font-sans tracking-tight mb-6", theme === 'dark' ? "text-white" : "text-zinc-900")}>
            See Qrious in action.
          </h2>
          <p className={cn("text-lg max-w-2xl mx-auto", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
            Watch a quick walkthrough of how you can build quantum circuits, visualize states, and learn from our AI tutor in just a few minutes.
          </p>
        </motion.div>

        <div className="w-full max-w-4xl relative aspect-video rounded-xl overflow-hidden shadow-2xl bg-zinc-900 border border-zinc-800">
          <HeroVideoDialog
            animationStyle="top-in-bottom-out"
            videoSrc="https://www.youtube.com/embed/3Swa555nqso?si=ZqKgSWZkdGNLCU19"
            thumbnailSrc="https://startup-template-sage.vercel.app/hero-light.png"
            thumbnailAlt="Hero Video"
            className="w-full h-full [&>button]:w-full [&>button]:h-full [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:rounded-xl"
          />
        </div>
      </div>
    </section>
  );
}
