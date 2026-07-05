import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import GameIdeas from './pages/GameIdeas';
import IdeaSubmit from './pages/IdeaSubmit';
import Projects from './pages/Projects';
import GetInvolved from './pages/GetInvolved';
import HowItWorks from './pages/HowItWorks';
import FAQ from './pages/FAQ';
import Donations from './pages/Donations';
import Contact from './pages/Contact';

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-cyber-bg text-text-primary font-display">
                <Navbar />

                <div className="scanline-overlay" />

                <main>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/ideas" element={<GameIdeas />} />
                        <Route path="/ideas/submit" element={<IdeaSubmit />} />
                        <Route path="/projects" element={<Projects />} />
                        <Route path="/get-involved" element={<GetInvolved />} />
                        <Route path="/how-it-works" element={<HowItWorks />} />
                        <Route path="/faq" element={<FAQ />} />
                        <Route path="/donations" element={<Donations />} />
                        <Route path="/contact" element={<Contact />} />
                    </Routes>
                </main>

                <footer className="border-t border-white/10 bg-cyber-surface py-12 text-sm">
                    <div className="container-custom">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-y-6 text-center md:text-left">
                            <div>
                                <div className="font-mono tracking-[3px] text-white">TOGETHERFORGE</div>
                                <div className="text-xs text-text-muted mt-1">Community-first independent game studio • Est. 2026</div>
                            </div>

                            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-text-secondary font-mono text-xs tracking-widest">
                                <Link to="/" className="footer-link">HOME</Link>
                                <Link to="/about" className="footer-link">ABOUT</Link>
                                <Link to="/ideas" className="footer-link">GAME IDEAS</Link>
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