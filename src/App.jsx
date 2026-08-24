import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import ReportConcern from './pages/ReportConcern';
import PlatformSuggestions from './pages/PlatformSuggestions';
import Donations from './pages/Donations';
import Contact from './pages/Contact';
import TransparencyHub from './pages/TransparencyHub';
import FoundersThoughts from './pages/FoundersThoughts';
import SupportRunway from './pages/SupportRunway';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import EditProfile from './pages/EditProfile';
import Account from './pages/Account';
import EmailConfirmation from './pages/EmailConfirmation';
import ResetPassword from './pages/ResetPassword';
import PublicProfile from './pages/PublicProfile';
import IdeaEdit from './pages/IdeaEdit';
import ProjectsEarly from './pages/ProjectsEarly';
import ProjectsMid from './pages/ProjectsMid';
import ProjectsLate from './pages/ProjectsLate';
import ProjectsEarlyDetail from './pages/ProjectsEarlyDetail';
import ProjectsEdit from './pages/ProjectsEdit';
import ProjectsEarlyEdit from './pages/ProjectsEarlyEdit';
import ProjectWorkspace from './pages/ProjectWorkspace';
import OpenWork from './pages/OpenWork';
import Contributors from './pages/Contributors';
import ProjectContributors from './pages/ProjectContributors';
import AllContributors from './pages/AllContributors';
import ModeratorDashboard from './pages/ModeratorDashboard';
import MechanicLab from './pages/MechanicLab';
import Media from './pages/Media';
import MediaEdit from './pages/MediaEdit';
import CommunityShowcase from './pages/CommunityShowcase';
import ShowcaseSubmit from './pages/ShowcaseSubmit';
import ShowcaseModerate from './pages/ShowcaseModerate';
import Badges from './pages/Badges';
import ReleasedGames from './pages/ReleasedGames';
import ReleasedGameDetail from './pages/ReleasedGameDetail';
import NotFound from './pages/NotFound';
import Footer from './components/layout/Footer';
import MfaSessionGate from './components/auth/MfaSessionGate';
import LegalAcceptanceGate from './components/legal/LegalAcceptanceGate';
import { ReportConcernProvider } from './context/ReportConcernContext';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Guidelines from './pages/Guidelines';

/** Old Prototype Systems URLs → /projects/tether */
function RedirectPrototypeSystems() {
  const location = useLocation();
  const next = location.pathname.replace(
    /^\/projects\/prototype-systems/i,
    '/projects/tether'
  );
  return (
    <Navigate
      to={`${next}${location.search}${location.hash}`}
      replace
    />
  );
}

function App() {
    return (
        <Router>
            <ScrollToTop />
            <MfaSessionGate>
            <LegalAcceptanceGate>
            <ReportConcernProvider>
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
                        <Route path="/open-work" element={<OpenWork />} />
                        <Route path="/task-boards" element={<OpenWork />} />
                        <Route path="/projects/early" element={<ProjectsEarly />} />
                        <Route path="/projects/early/:id" element={<ProjectsEarlyDetail />} />
                        <Route path="/projects/edit" element={<ProjectsEdit />} />
                        <Route path="/projects/early/edit" element={<ProjectsEarlyEdit />} />
                        <Route path="/projects/mid" element={<ProjectsMid />} />
                        <Route path="/projects/late" element={<ProjectsLate />} />
                        {/* Contributors + board before generic :id workspace */}
                        <Route
                          path="/projects/prototype-systems"
                          element={<RedirectPrototypeSystems />}
                        />
                        <Route
                          path="/projects/prototype-systems/*"
                          element={<RedirectPrototypeSystems />}
                        />
                        <Route
                          path="/projects/:id/contributors"
                          element={<ProjectContributors />}
                        />
                        <Route
                          path="/projects/:id/board/staging"
                          element={<ProjectWorkspace />}
                        />
                        <Route
                          path="/projects/:id/board"
                          element={<ProjectWorkspace />}
                        />
                        {/* Generic workspace - after static phase routes so early/mid/late are not captured */}
                        <Route path="/projects/:id" element={<ProjectWorkspace />} />
                        <Route path="/contributors" element={<Contributors />} />
                        <Route
                          path="/contributors/all"
                          element={<AllContributors />}
                        />
                        <Route path="/get-involved" element={<GetInvolved />} />
                        <Route path="/demos" element={<MechanicLab />} />
                        <Route path="/mechanic-lab" element={<MechanicLab />} />
                        <Route path="/how-it-works" element={<HowItWorks />} />
                        <Route path="/media" element={<Media />} />
                        <Route path="/media/edit" element={<MediaEdit />} />
                        <Route path="/videos" element={<Media />} />
                        <Route path="/showcase" element={<CommunityShowcase />} />
                        <Route
                          path="/showcase/submit"
                          element={<ShowcaseSubmit />}
                        />
                        <Route
                          path="/showcase/moderate"
                          element={<ShowcaseModerate />}
                        />
                        <Route path="/released" element={<ReleasedGames />} />
                        <Route path="/released/:slug" element={<ReleasedGameDetail />} />
                        <Route path="/education" element={<EducationApprenticeship />} />
                        <Route path="/apprenticeships" element={<EducationApprenticeship />} />
                        <Route path="/faq" element={<FAQ />} />
                        <Route path="/bugs" element={<BugTracker />} />
                        <Route path="/bugs/report" element={<ReportBug />} />
                        <Route path="/report-bug" element={<ReportBug />} />
                        <Route
                          path="/report-a-concern"
                          element={<ReportConcern />}
                        />
                        <Route
                          path="/report-concern"
                          element={<ReportConcern />}
                        />
                        <Route
                          path="/suggestions"
                          element={<PlatformSuggestions />}
                        />
                        <Route
                          path="/platform-suggestions"
                          element={<PlatformSuggestions />}
                        />
                        <Route path="/donate" element={<Donations />} />
                        {/* Legacy aliases → Donate */}
                        <Route path="/support" element={<Donations />} />
                        <Route path="/donations" element={<Donations />} />
                        <Route path="/badges" element={<Badges />} />
                        <Route path="/achievements" element={<Badges />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/guidelines" element={<Guidelines />} />
                        <Route path="/community-guidelines" element={<Guidelines />} />
                        <Route path="/code-of-conduct" element={<Guidelines />} />
                        <Route path="/transparency" element={<TransparencyHub />} />
                        <Route path="/founders-thoughts" element={<FoundersThoughts />} />
                        <Route path="/support-runway" element={<SupportRunway />} />
                        <Route path="/moderator" element={<ModeratorDashboard />} />
                        {/* Private hub (claims, requests, shortcuts) */}
                        <Route path="/dashboard" element={<Dashboard />} />
                        {/* Account / Settings (profile, linked, security, plan, billing, …) */}
                        <Route path="/account/:section?" element={<Account />} />
                        {/* Legacy private profile → Account redirects */}
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/profile/edit" element={<EditProfile />} />
                        {/* Profile: /u/:username (canonical) and /profile/:username */}
                        <Route path="/u/:username" element={<PublicProfile />} />
                        <Route path="/profile/:username" element={<PublicProfile />} />
                        <Route path="/confirm-email" element={<EmailConfirmation />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        {/* Unknown routes */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </main>
                <Footer />
            </div>
            </ReportConcernProvider>
            </LegalAcceptanceGate>
            </MfaSessionGate>
        </Router>
    );
}

export default App;