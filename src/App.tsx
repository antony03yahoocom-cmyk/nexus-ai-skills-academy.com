import { lazy, Suspense, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, AdminRoute } from "@/components/auth/ProtectedRoute";
import StudentChatbot from "@/components/chatbot/StudentChatbot";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import SignupPage from "./pages/SignupPage.tsx";

// ── Lazy-loaded pages ──────────────────────────────────────────────
const CoursesPage              = lazy(() => import("./pages/CoursesPage"));
const CourseDetailPage         = lazy(() => import("./pages/CourseDetailPage"));
const CourseAboutPage          = lazy(() => import("./pages/CourseAboutPage"));
const LessonViewerPage         = lazy(() => import("./pages/LessonViewerPage"));
const StudentDashboard         = lazy(() => import("./pages/StudentDashboard"));
const StudentProjectsPage      = lazy(() => import("./pages/StudentProjectsPage"));
const StudentCertificatesPage  = lazy(() => import("./pages/StudentCertificatesPage"));
const AdminDashboard           = lazy(() => import("./pages/AdminDashboard"));
const AdminSubscriptionsPage   = lazy(() => import("./pages/AdminSubscriptionsPage"));
const AdminCoursesPage         = lazy(() => import("./pages/AdminCoursesPage"));
const AdminStudentsPage        = lazy(() => import("./pages/AdminStudentsPage"));
const AdminSubmissionsPage     = lazy(() => import("./pages/AdminSubmissionsPage"));
const AdminAnnouncementsPage   = lazy(() => import("./pages/AdminAnnouncementsPage"));
const AdminSettingsPage        = lazy(() => import("./pages/AdminSettingsPage"));
const AdminProjectsPage        = lazy(() => import("./pages/AdminProjectsPage"));
const AdminCertificatesPage    = lazy(() => import("./pages/AdminCertificatesPage"));
const AdminEnrollmentsPage     = lazy(() => import("./pages/AdminEnrollmentsPage"));
const AdminTestimonialsPage    = lazy(() => import("./pages/AdminTestimonialsPage"));
const AdminFeedbackPage        = lazy(() => import("./pages/AdminFeedbackPage"));
const AdminDeletionFeedbackPage = lazy(() => import("./pages/AdminDeletionFeedbackPage"));
const AdminBlogPage            = lazy(() => import("./pages/AdminBlogPage"));
const AdminWhatsAppPage        = lazy(() => import("./pages/AdminWhatsAppPage"));
const AdminEmployersPage       = lazy(() => import("./pages/AdminEmployersPage"));
const AdminOpportunitiesPage   = lazy(() => import("./pages/AdminOpportunitiesPage"));
const AdminReportsPage         = lazy(() => import("./pages/AdminReportsPage"));
const AdminGroupsPage          = lazy(() => import("./pages/AdminGroupsPage"));
const AdminMessagesPage        = lazy(() => import("./pages/AdminMessagesPage"));
const BannedPage               = lazy(() => import("./pages/BannedPage"));
const SubscribePage            = lazy(() => import("./pages/SubscribePage"));
const PortfolioPage            = lazy(() => import("./pages/PortfolioPage"));
const CommunityPage            = lazy(() => import("./pages/CommunityPage"));
const DiscussionGroupsPage     = lazy(() => import("./pages/DiscussionGroupsPage"));
const GroupChatPage            = lazy(() => import("./pages/GroupChatPage"));
const ProfileSettingsPage      = lazy(() => import("./pages/ProfileSettingsPage"));
const MessagesPage             = lazy(() => import("./pages/MessagesPage"));
const BlogPage                 = lazy(() => import("./pages/BlogPage"));
const LeaderboardPage          = lazy(() => import("./pages/LeaderboardPage"));
const PrivacyPolicyPage        = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage       = lazy(() => import("./pages/TermsOfServicePage"));
const NotificationsPage        = lazy(() => import("./pages/NotificationsPage"));
const ClassmatesPage           = lazy(() => import("./pages/ClassmatesPage"));
const MarketplaceHubPage       = lazy(() => import("./pages/MarketplaceHubPage"));
const OpportunitiesBoardPage   = lazy(() => import("./pages/OpportunitiesBoardPage"));
const OpportunityDetailPage    = lazy(() => import("./pages/OpportunityDetailPage"));
const EmployerSignupPage       = lazy(() => import("./pages/EmployerSignupPage"));
const EmployerDashboard        = lazy(() => import("./pages/EmployerDashboard"));

// ── Loading skeleton ───────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
      <p className="text-muted-foreground text-sm">Loading…</p>
    </div>
  </div>
);

// ── Error boundary — catches render/import errors ──────────────────
// Without this, any component throw = silent blank screen.
interface EBState { hasError: boolean; message: string }
class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, message: err?.message ?? "Unknown error" };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary] Caught:", err, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center glass-card p-8">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-6">
            The page couldn't load. This is usually a temporary issue.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Reload page
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, message: "" }); window.location.href = "/"; }}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/30 transition-colors"
            >
              Go home
            </button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-4 text-left text-xs bg-muted/30 rounded-lg p-3 overflow-auto text-destructive">
              {this.state.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

// ── QueryClient — configured for resilience ────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:         5 * 60_000,   // 5 min
      gcTime:            10 * 60_000,  // 10 min
      retry:             1,            // one retry on failure (was unlimited)
      refetchOnWindowFocus: false,     // prevents cascade on tab switch
    },
    mutations: {
      retry: 0,
    },
  },
});

// ── App ────────────────────────────────────────────────────────────
const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            {/* Suspense handles lazy-load *loading* states.
                AppErrorBoundary above handles any render *errors*. */}
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ── Public ──────────────────────────────────── */}
                <Route path="/"                     element={<Index />} />
                <Route path="/login"                element={<LoginPage />} />
                <Route path="/signup"               element={<SignupPage />} />
                <Route path="/courses"              element={<CoursesPage />} />
                <Route path="/courses/:courseId"    element={<CourseDetailPage />} />
                <Route path="/courses/:courseId/about" element={<CourseAboutPage />} />
                <Route path="/subscribe"            element={<SubscribePage />} />
                <Route path="/portfolio"            element={<PortfolioPage />} />
                <Route path="/opportunities"        element={<OpportunitiesBoardPage />} />
                <Route path="/opportunities/:opportunityId" element={<OpportunityDetailPage />} />
                <Route path="/employer/signup"      element={<EmployerSignupPage />} />
                <Route path="/blog"                 element={<BlogPage />} />
                <Route path="/leaderboard"          element={<LeaderboardPage />} />
                <Route path="/privacy-policy"       element={<PrivacyPolicyPage />} />
                <Route path="/terms-of-service"     element={<TermsOfServicePage />} />
                <Route path="/banned"               element={<BannedPage />} />

                {/* ── Student (protected) ──────────────────────── */}
                <Route path="/lesson/:lessonId"     element={<ProtectedRoute><LessonViewerPage /></ProtectedRoute>} />
                <Route path="/dashboard"            element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
                <Route path="/dashboard/projects"   element={<ProtectedRoute><StudentProjectsPage /></ProtectedRoute>} />
                <Route path="/dashboard/certificates" element={<ProtectedRoute><StudentCertificatesPage /></ProtectedRoute>} />
                <Route path="/dashboard/marketplace"  element={<ProtectedRoute><MarketplaceHubPage /></ProtectedRoute>} />
                <Route path="/dashboard/opportunities" element={<ProtectedRoute><OpportunitiesBoardPage /></ProtectedRoute>} />
                <Route path="/dashboard/marketing"    element={<ProtectedRoute><MarketplaceHubPage /></ProtectedRoute>} />
                <Route path="/dashboard/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="/dashboard/classmates"   element={<ProtectedRoute><ClassmatesPage /></ProtectedRoute>} />
                <Route path="/dashboard/settings"     element={<ProtectedRoute><ProfileSettingsPage /></ProtectedRoute>} />
                <Route path="/dashboard/messages"     element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                <Route path="/dashboard/*"            element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
                <Route path="/community"              element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
                <Route path="/discussions"            element={<ProtectedRoute><DiscussionGroupsPage /></ProtectedRoute>} />
                <Route path="/discussions/:groupId"   element={<ProtectedRoute><GroupChatPage /></ProtectedRoute>} />
                <Route path="/employer/dashboard"     element={<ProtectedRoute><EmployerDashboard /></ProtectedRoute>} />

                {/* ── Admin ───────────────────────────────────── */}
                <Route path="/admin"                  element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/courses"          element={<AdminRoute><AdminCoursesPage /></AdminRoute>} />
                <Route path="/admin/students"         element={<AdminRoute><AdminStudentsPage /></AdminRoute>} />
                <Route path="/admin/enrollments"      element={<AdminRoute><AdminEnrollmentsPage /></AdminRoute>} />
                <Route path="/admin/subscriptions"    element={<AdminRoute><AdminSubscriptionsPage /></AdminRoute>} />
                <Route path="/admin/submissions"      element={<AdminRoute><AdminSubmissionsPage /></AdminRoute>} />
                <Route path="/admin/announcements"    element={<AdminRoute><AdminAnnouncementsPage /></AdminRoute>} />
                <Route path="/admin/settings"         element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
                <Route path="/admin/employers"        element={<AdminRoute><AdminEmployersPage /></AdminRoute>} />
                <Route path="/admin/opportunities"    element={<AdminRoute><AdminOpportunitiesPage /></AdminRoute>} />
                <Route path="/admin/reports"          element={<AdminRoute><AdminReportsPage /></AdminRoute>} />
                <Route path="/admin/projects"         element={<AdminRoute><AdminProjectsPage /></AdminRoute>} />
                <Route path="/admin/certificates"     element={<AdminRoute><AdminCertificatesPage /></AdminRoute>} />
                <Route path="/admin/groups"           element={<AdminRoute><AdminGroupsPage /></AdminRoute>} />
                <Route path="/admin/messages"         element={<AdminRoute><AdminMessagesPage /></AdminRoute>} />
                <Route path="/admin/testimonials"     element={<AdminRoute><AdminTestimonialsPage /></AdminRoute>} />
                <Route path="/admin/feedback"         element={<AdminRoute><AdminFeedbackPage /></AdminRoute>} />
                <Route path="/admin/deletion-feedback" element={<AdminRoute><AdminDeletionFeedbackPage /></AdminRoute>} />
                <Route path="/admin/blog"             element={<AdminRoute><AdminBlogPage /></AdminRoute>} />
                <Route path="/admin/whatsapp"         element={<AdminRoute><AdminWhatsAppPage /></AdminRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <StudentChatbot />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
