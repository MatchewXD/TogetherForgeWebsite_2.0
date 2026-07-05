import { motion } from 'framer-motion';
import { ArrowRight, Play, Users } from 'lucide-react';

const HeroSection = () => {
  return (
    <section className="relative min-h-[100dvh] flex items-center justify-center pt-20 overflow-hidden">
      {/* Animated Cyber Grid Background */}
      <div className="absolute inset-0 cyber-grid" />
      
      {/* Subtle radial glow in center */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#00f9ff10_0%,transparent_70%)]" />

      <div className="container-custom relative z-10 text-center px-6">
        <div className="max-w-5xl mx-auto">
          {/* Status indicator */}
          <div className="flex justify-center mb-8">
            <div className="status-bar text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse-neon" />
              PROTOCOL ACTIVE // COMMUNITY FUNDING OPEN // DEBUT BUILD v0.4
            </div>
          </div>

          {/* Main Headline */}
          <div className="mb-6">
            <h1 className="font-mono text-[72px] md:text-[92px] leading-[0.92] tracking-[-4.5px] font-bold text-white mb-2">
              FORGE THE<br />FUTURE.<br />
              <span className="neon-magenta">TOGETHER.</span>
            </h1>
          </div>

          {/* Tagline */}
          <p className="max-w-2xl mx-auto text-xl md:text-2xl text-text-secondary mb-10 tracking-tight">
            We build cooperative survival-builder games that train us for 
            real connection — and the intentional communities that will follow.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a 
              href="#vision" 
              className="btn-primary btn-neon group w-full sm:w-auto text-base px-10 py-4 flex items-center justify-center gap-3"
            >
              ENTER THE FORGE
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
            </a>
            
            <a 
              href="https://www.youtube.com/@MXDGameGuides" 
              target="_blank"
              rel="noopener noreferrer"
              className="btn-neon w-full sm:w-auto text-base px-8 py-4 flex items-center justify-center gap-3"
            >
              <Play className="w-4 h-4" /> WATCH DEVLOGS
            </a>

            <a 
              href="#join" 
              className="btn-neon btn-neon-magenta w-full sm:w-auto text-base px-8 py-4 flex items-center justify-center gap-3"
            >
              <Users className="w-4 h-4" /> JOIN COMMUNITY
            </a>
          </div>

          {/* Trust / Stats bar */}
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-xs font-mono tracking-[2px] text-text-secondary/70">
            <div>COMMUNITY SUPPORTED</div>
            <div>NO VENTURE CAPITAL</div>
            <div>TRANSPARENT DEVELOPMENT</div>
            <div>PIXELS → PEOPLE</div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div 
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center text-[10px] tracking-[3px] text-text-secondary/50 font-mono"
      >
        SCROLL TO BEGIN
        <div className="h-px w-6 bg-white/30 mt-2" />
      </motion.div>
    </section>
  );
};

export default HeroSection;
