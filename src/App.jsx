import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import GameIdeas from './pages/GameIdeas';
import IdeaSubmit from './pages/IdeaSubmit';
import IdeaWizard from './pages/IdeaWizard';
import IdeaDetail from './pages/IdeaDetail';
import Projects from './pages/Projects';
import GetInvolved from './pages/GetInvolved';
import HowItWorks from './pages/HowItWorks';
import EducationApprenticeship from './pages/EducationApprenticeship';
import FAQ from './pages/FAQ';
import BugTracker from './pages/BugTracker';
import ReportBug from './pages/ReportBug';
import Donations from './pages/Donations';
import Contact from './pages/Contact';
import TransparencyHub from './pages/TransparencyHub';
import FoundersThoughts from './pages/FoundersThoughts';
import SupportRunway from './pages/SupportRunway';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import EditProfile from './pages/EditProfile';
import EmailConfirmation from './pages/EmailConfirmation';
import PublicProfile from './pages/PublicProfile';
import IdeaEdit from './pages/IdeaEdit';
import ProjectsEarly from './pages/ProjectsEarly';
import ProjectsMid from './pages/ProjectsMid';
import ProjectsLate from './pages/ProjectsLate';
import ProjectsEarlyDetail from './pages/ProjectsEarlyDetail';
import ProjectsEdit from './pages/ProjectsEdit';
import ProjectsEarlyEdit from './pages/ProjectsEarlyEdit';
import ProjectWorkspace from './pages/ProjectWorkspace';
import ModeratorDashboard from './pages/ModeratorDashboard';
import MechanicLab from './pages/MechanicLab';
import Footer from './components/layout/Footer';

function App() {
    return (
        <Router>
            <ScrollToTop />
            <div className="min-h-screen bg-cyber-bg text-text-primary font-display flex flex-col">
                <Navbar />

                <div className="scanline-overlay" />

                <main className="flex-1">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/ideas" element={<GameIdeas />} />
                        <Route path="/ideas/submit" element={<IdeaSubmit />} />
                        <Route path="/ideas/wizard" element={<IdeaWizard />} />
                        <Route path="/ideas/:id" element={<IdeaDetail />} />
                        <Route path="/ideas/:id/edit" element={<IdeaEdit />} />
                        <Route path="/projects" element={<Projects />} />
                        <Route path="/projects/early" element={<ProjectsEarly />} />
                        <Route path="/projects/early/:id" element={<ProjectsEarlyDetail />} />
                        <Route path="/projects/edit" element={<ProjectsEdit />} />
                        <Route path="/projects/early/edit" element={<ProjectsEarlyEdit />} />
                        <Route path="/projects/mid" element={<ProjectsMid />} />
                        <Route path="/projects/late" element={<ProjectsLate />} />
                        {/* Generic workspace — after static phase routes so early/mid/late are not captured */}
                        <Route path="/projects/:id" element={<ProjectWorkspace />} />
                        <Route path="/get-involved" element={<GetInvolved />} />
                        <Route path="/demos" element={<MechanicLab />} />
                        <Route path="/mechanic-lab" element={<MechanicLab />} />
                        <Route path="/how-it-works" element={<HowItWorks />} />
                        <Route path="/education" element={<EducationApprenticeship />} />
                        <Route path="/apprenticeships" element={<EducationApprenticeship />} />
                        <Route path="/faq" element={<FAQ />} />
                        <Route path="/bugs" element={<BugTracker />} />
                        <Route path="/bugs/report" element={<ReportBug />} />
                        <Route path="/report-bug" element={<ReportBug />} />
                        <Route path="/support" element={<Donations />} />
                        <Route path="/donations" element={<Donations />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/transparency" element={<TransparencyHub />} />
                        <Route path="/founders-thoughts" element={<FoundersThoughts />} />
                        <Route path="/support-runway" element={<SupportRunway />} />
                        <Route path="/moderator" element={<ModeratorDashboard />} />
                        {/* Private hub (claims, requests, shortcuts) */}
                        <Route path="/dashboard" element={<Dashboard />} />
                        {/* Own account: login + light profile editing */}
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/profile/edit" element={<EditProfile />} />
                        {/* Public profiles: /u/:username (canonical) and /profile/:username */}
                        <Route path="/u/:username" element={<PublicProfile />} />
                        <Route path="/profile/:username" element={<PublicProfile />} />
                        <Route path="/confirm-email" element={<EmailConfirmation />} />
                    </Routes>
                </main>
                <Footer />
            </div>
        </Router>
    );
}

export default App;