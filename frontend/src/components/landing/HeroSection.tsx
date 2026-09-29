import { Link } from 'react-router-dom';
import BlochSphereCanvas from './BlochSphereCanvas';
import InteractiveButton from './InteractiveButton';
import GlassStatCard from './GlassStatCard';
import NoiseOverlay from './NoiseOverlay';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

export default function HeroSection() {
  const { currentUser } = useAuth();

  return (
    <section className="relative w-full h-[92vh] min-h-[600px] max-h-[1000px] rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden bg-black flex items-center mt-4">
      {/* 3D Background */}
      <div className="absolute inset-0 z-0 opacity-60">
        <BlochSphereCanvas />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-zinc-950/40 to-zinc-950/90" />

      {/* Noise Overlay */}
      <div className="absolute inset-0 z-20">
        <NoiseOverlay />
      </div>

      {/* Content Container */}
      <div className="relative z-30 w-full max-w-[1600px] mx-auto px-6 md:px-16 flex flex-col lg:flex-row items-center justify-between gap-12">

        {/* Left Typography Block */}
        <motion.div
          className="flex-1 max-w-2xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="text-[10px] font-bold tracking-[0.2em] text-emerald-500 uppercase mb-6">
            Quantum Computing, Visualized
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.05em] leading-[1.05] text-white mb-6">
            Build circuits. Watch qubits think.
          </h1>

          <p className="text-zinc-400 font-light text-lg sm:text-xl mb-10 leading-relaxed max-w-xl">
            A browser-based quantum playground with real Qiskit Aer simulation, a live 3D Bloch sphere, and an AI tutor that explains every gate — no install, no setup.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Link to={currentUser ? "/dashboard" : "/login"}>
              <InteractiveButton>
                {currentUser ? "Go to Dashboard" : "Launch Playground"}
              </InteractiveButton>
            </Link>
            <a href="#walkthrough" className="text-white/70 hover:text-white transition-colors text-sm font-medium flex items-center gap-2 group">
              Watch the walkthrough <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </motion.div>

        {/* Right Glass Stat Cards */}
        <motion.div
          className="hidden lg:flex flex-col gap-4"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        >
          <GlassStatCard
            metric="Live"
            description="Qiskit Aer simulation, not mocked"
            className="w-72"
          />
          <GlassStatCard
            metric="3D"
            description="Real-time Bloch sphere explorer"
            className="w-72"
          />
          <GlassStatCard
            metric="0 installs"
            description="Runs entirely in your browser"
            className="w-72"
          />
        </motion.div>

      </div>
    </section>
  );
}
