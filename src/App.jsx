import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-cyber-bg text-text-primary font-display">
        {/* Fixed Navbar */}
        <Navbar />

        {/* Subtle persistent scanline effect for cyberpunk atmosphere */}
        <div className="scanline-overlay" />

        {/* Page Content */}
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>

        {/* Global Footer */}
        <footer className="border-t border-white/10 bg-cyber-surface py-12 text-sm">
          <div className="container-custom">
            <div className="flex flex-col md:flex-row justify-between items-center gap-y-6 text-center md:text-left">
              <div>
                <div className="font-mono tracking-[3px] text-white">TOGETHERFORGE</div>
                <div className="text-xs text-text-muted mt-1">Community-supported indie game studio • Est. 2026</div>
              </div>

              <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-text-secondary font-mono text-xs tracking-widest">
                <a href="#" className="footer-link">DISCORD</a>
                <a href="https://www.youtube.com/@MXDGameGuides" target="_blank" rel="noopener noreferrer" className="footer-link">YOUTUBE</a>
                <a href="#" className="footer-link">MANIFESTO</a>
                <a href="#" className="footer-link">ROADMAP</a>
                <a href="#" className="footer-link">SUPPORT</a>
              </div>

              <div className="text-xs text-text-muted max-w-[220px] md:text-right">
                Building games worth playing.<br />Building communities worth belonging to.
              </div>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
