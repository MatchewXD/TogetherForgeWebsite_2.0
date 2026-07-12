import { Link } from 'react-router-dom';

const Footer = () => {
    return (
        <footer className="border-t border-white/10 bg-cyber-surface py-12 text-sm">
            <div className="container-custom max-w-7xl mx-auto px-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-y-6 text-center md:text-left">

                    {/* Logo + Tagline */}
                    <div>
                        <div className="font-mono tracking-[3px] text-white">TOGETHERFORGE</div>
                        <div className="text-xs text-text-muted mt-1">
                            Community-first independent game studio • Est. 2026
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-text-secondary font-mono text-xs tracking-widest">
                        <Link to="/" className="hover:text-neon-cyan transition-colors">HOME</Link>
                        <Link to="/about" className="hover:text-neon-cyan transition-colors">ABOUT</Link>
                        <Link to="/projects" className="hover:text-neon-cyan transition-colors">PROJECTS</Link>
                        <Link to="/ideas" className="hover:text-neon-cyan transition-colors">GAME IDEAS</Link>
                        <Link to="/get-involved" className="hover:text-neon-cyan transition-colors">GET INVOLVED</Link>
                    </div>

                    {/* Right side message + Trademark */}
                    <div className="text-xs text-text-muted max-w-[260px] md:text-right">
                        Building games worth playing.<br />
                        Building communities worth belonging to.
                        <div className="mt-4 text-[10px] opacity-60">
                            © 2026 Together Forge. All Rights Reserved.<br />
                            "Together Forge" is a trademark of Together Forge Community.
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;