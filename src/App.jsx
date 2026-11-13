import { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import TrafficBeacon from './components/traffic/TrafficBeacon';
import HomePage from './pages/HomePage';
import Footer from './components/layout/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import RouteMeta from './components/RouteMeta';
import LoadingScreen from './components/ui/LoadingScreen';
import { lazyPage } from './lib/lazyPage';
import MfaSessionGate from './components/auth/MfaSessionGate';
import EmailConfirmationGate from './components/auth/EmailConfirmationGate';
import LegalAcceptanceGate from './components/legal/LegalAcceptanceGate';
import { ReportConcernProvider } from './context/ReportConcernContext';
import { UserNoticesProvider } from './context/UserNoticesContext';

const AboutPage = lazyPage(() => import('./pages/AboutPage'));
const GameIdeas = lazyPage(() => import('./pages/GameIdeas'));
const IdeaSubmit = lazyPage(() => import('./pages/IdeaSubmit'));
const IdeaWizard = lazyPage(() => import('./pages/IdeaWizard'));
const IdeaDetail = lazyPage(() => import('./pages/IdeaDetail'));
const OpenQuestions = lazyPage(() => import('./pages/OpenQuestions'));
const OpenQuestionDetail = lazyPage(() => import('./pages/OpenQuestionDetail'));
const Polls = lazyPage(() => import('./pages/Polls'));
const PollDetail = lazyPage(() => import('./pages/PollDetail'));
const Projects = lazyPage(() => import('./pages/Projects'));
const GetInvolved = lazyPage(() => import('./pages/GetInvolved'));
const HowItWorks = lazyPage(() => import('./pages/HowItWorks'));
const EducationApprenticeship = lazyPage(() => import('./pages/EducationApprenticeship'));
const FAQ = lazyPage(() => import('./pages/FAQ'));
const BugTracker = lazyPage(() => import('./pages/BugTracker'));
const ReportBug = lazyPage(() => import('./pages/ReportBug'));
const ReportConcern = lazyPage(() => import('./pages/ReportConcern'));
const PlatformSuggestions = lazyPage(() => import('./pages/PlatformSuggestions'));
const Donations = lazyPage(() => import('./pages/Donations'));
const Contact = lazyPage(() => import('./pages/Contact'));
const TransparencyHub = lazyPage(() => import('./pages/TransparencyHub'));
const FoundersThoughts = lazyPage(() => import('./pages/FoundersThoughts'));
const SupportRunway = lazyPage(() => import('./pages/SupportRunway'));
const Profile = lazyPage(() => import('./pages/Profile'));
const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const EditProfile = lazyPage(() => import('./pages/EditProfile'));
const Account = lazyPage(() => import('./pages/Account'));
const EmailConfirmation = lazyPage(() => import('./pages/EmailConfirmation'));
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'));
const PublicProfile = lazyPage(() => import('./pages/PublicProfile'));
const IdeaEdit = lazyPage(() => import('./pages/IdeaEdit'));
const ProjectsEarly = lazyPage(() => import('./pages/ProjectsEarly'));
const ProjectsMid = lazyPage(() => import('./pages/ProjectsMid'));
const ProjectsLate = lazyPage(() => import('./pages/ProjectsLate'));
const ProjectsEarlyDetail = lazyPage(() => import('./pages/ProjectsEarlyDetail'));
const ProjectsEdit = lazyPage(() => import('./pages/ProjectsEdit'));
const ProjectsEarlyEdit = lazyPage(() => import('./pages/ProjectsEarlyEdit'));
const ProjectWorkspace = lazyPage(() => import('./pages/ProjectWorkspace'));
const SuggestedTasksBoard = lazyPage(() => import('./pages/SuggestedTasksBoard'));
const OpenWork = lazyPage(() => import('./pages/OpenWork'));
const Contributors = lazyPage(() => import('./pages/Contributors'));
const ProjectContributors = lazyPage(() => import('./pages/ProjectContributors'));
const AllContributors = lazyPage(() => import('./pages/AllContributors'));
const ModeratorDashboard = lazyPage(() => import('./pages/ModeratorDashboard'));
const MechanicLab = lazyPage(() => import('./pages/MechanicLab'));
const Media = lazyPage(() => import('./pages/Media'));
const MediaEdit = lazyPage(() => import('./pages/MediaEdit'));
const CommunityShowcase = lazyPage(() => import('./pages/CommunityShowcase'));
const ShowcaseSubmit = lazyPage(() => import('./pages/ShowcaseSubmit'));
const ShowcaseModerate = lazyPage(() => import('./pages/ShowcaseModerate'));
const Badges = lazyPage(() => import('./pages/Badges'));
const ReleasedGames = lazyPage(() => import('./pages/ReleasedGames'));
const ReleasedGameDetail = lazyPage(() => import('./pages/ReleasedGameDetail'));
const NotFound = lazyPage(() => import('./pages/NotFound'));
const Terms = lazyPage(() => import('./pages/Terms'));
const Privacy = lazyPage(() => import('./pages/Privacy'));
const Guidelines = lazyPage(() => import('./pages/Guidelines'));
const Payments = lazyPage(() => import('./pages/Payments'));

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
            <TrafficBeacon />
            <RouteMeta />
            <EmailConfirmationGate>
            <MfaSessionGate>
            <LegalAcceptanceGate>
            <ReportConcernProvider>
            <UserNoticesProvider>
            <div className="min-h-screen bg-cyber-bg text-text-primary font-display flex flex-col">
                <Navbar />

                <div className="scanline-overlay" aria-hidden="true" />

                <main className="flex-1">
                    <ErrorBoundary>
                    <Suspense fallback={<LoadingScreen variant="section" />}>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/ideas" element={<GameIdeas />} />
                        <Route path="/ideas/submit" element={<IdeaSubmit />} />
                        <Route path="/ideas/wizard" element={<IdeaWizard />} />
                        <Route path="/ideas/:id" element={<IdeaDetail />} />
                        <Route path="/ideas/:id/edit" element={<IdeaEdit />} />
                        <Route path="/questions" element={<OpenQuestions />} />
                        <Route
                          path="/questions/:questionId/answers/:answerId"
                          element={<OpenQuestionDetail />}
                        />
                        <Route
                          path="/questions/:questionId"
                          element={<OpenQuestionDetail />}
                        />
                        <Route path="/polls" element={<Polls />} />
                        <Route path="/polls/:pollId" element={<PollDetail />} />
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
                          path="/projects/:id/board/suggested"
                          element={<SuggestedTasksBoard />}
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
                        <Route path="/payments" element={<Payments />} />
                        <Route
                          path="/payments-and-refunds"
                          element={<Navigate to="/payments" replace />}
                        />
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
                    </Suspense>
                    </ErrorBoundary>
                </main>
                <Footer />
            </div>
            </UserNoticesProvider>
            </ReportConcernProvider>
            </LegalAcceptanceGate>
            </MfaSessionGate>
            </EmailConfirmationGate>
        </Router>
    );
}

export default App;