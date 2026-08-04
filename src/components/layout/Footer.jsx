import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-cyber-surface py-12 text-sm">
      <div className="container-custom max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-y-8 text-center md:text-left">
          {/* Logo + Tagline */}
          <div className="w-full md:w-auto">
            <div className="font-mono tracking-[3px] text-white">
              TOGETHERFORGE
            </div>
            <div className="text-xs text-text-muted mt-1">
              Community-first independent game studio • Est. 2026
            </div>
          </div>

          {/* Navigation — mirrors top-level + key groups */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-text-secondary font-mono text-xs tracking-widest w-full md:w-auto max-w-2xl">
            <Link to="/" className="hover:text-neon-cyan transition-colors">
              HOME
            </Link>
            <Link
              to="/projects"
              className="hover:text-neon-cyan transition-colors"
            >
              PROJECTS
            </Link>
            <Link to="/ideas" className="hover:text-neon-cyan transition-colors">
              IDEAS
            </Link>
            <Link
              to="/get-involved"
              className="hover:text-neon-cyan transition-colors"
            >
              GET INVOLVED
            </Link>
            <Link to="/media" className="hover:text-neon-cyan transition-colors">
              MEDIA
            </Link>
            <Link
              to="/about"
              className="hover:text-neon-cyan transition-colors"
            >
              ABOUT
            </Link>
            <Link
              to="/released"
              className="hover:text-neon-cyan transition-colors"
            >
              RELEASED
            </Link>
            <Link
              to="/contributors"
              className="hover:text-neon-cyan transition-colors"
            >
              CONTRIBUTORS
            </Link>
            <Link
              to="/donate"
              className="hover:text-neon-cyan transition-colors"
            >
              DONATE
            </Link>
            <Link
              to="/transparency"
              className="hover:text-neon-cyan transition-colors"
            >
              TRANSPARENCY
            </Link>
            <Link
              to="/contact"
              className="hover:text-neon-cyan transition-colors"
            >
              CONTACT
            </Link>
          </div>

          {/* Right side message + Trademark */}
          <div className="text-xs text-text-muted max-w-[260px] md:text-right w-full md:w-auto mx-auto md:mx-0">
            Building games worth playing.
            <br />
            Building communities worth belonging to.
            <div className="mt-4 text-[10px] opacity-60">
              © 2026 Together Forge. All Rights Reserved.
              <br />
              &quot;Together Forge&quot; is a trademark of Together Forge
              Community.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
