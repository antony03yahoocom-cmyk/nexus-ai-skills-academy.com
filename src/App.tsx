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
import CoursesPage from "./pages/CoursesPage.tsx";
import CourseDetailPage from "./pages/CourseDetailPage.tsx";
import CourseAboutPage from "./pages/CourseAboutPage.tsx";
import LessonViewerPage from "./pages/LessonViewerPage.tsx";
import StudentDashboard from "./pages/StudentDashboard.tsx";
import StudentProjectsPage from "./pages/StudentProjectsPage.tsx";
import StudentCertificatesPage from "./pages/StudentCertificatesPage.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import AdminSubscriptionsPage from "./pages/AdminSubscriptionsPage.tsx";
import AdminCoursesPage from "./pages/AdminCoursesPage.tsx";
import AdminStudentsPage from "./pages/AdminStudentsPage.tsx";
import AdminSubmissionsPage from "./pages/AdminSubmissionsPage.tsx";
import AdminAnnouncementsPage from "./pages/AdminAnnouncementsPage.tsx";
import AdminSettingsPage from "./pages/AdminSettingsPage.tsx";
import AdminProjectsPage from "./pages/AdminProjectsPage.tsx";
import AdminCertificatesPage from "./pages/AdminCertificatesPage.tsx";
import AdminEnrollmentsPage from "./pages/AdminEnrollmentsPage.tsx";
import AdminTestimonialsPage from "./pages/AdminTestimonialsPage.tsx";
import AdminFeedbackPage from "./pages/AdminFeedbackPage.tsx";
import AdminDeletionFeedbackPage from "./pages/AdminDeletionFeedbackPage.tsx";
import AdminBlogPage from "./pages/AdminBlogPage.tsx";
import AdminEmployersPage from "./pages/AdminEmployersPage.tsx";
import AdminOpportunitiesPage from "./pages/AdminOpportunitiesPage.tsx";
import AdminReportsPage from "./pages/AdminReportsPage.tsx";
import AdminGroupsPage from "./pages/AdminGroupsPage.tsx";
import AdminMessagesPage from "./pages/AdminMessagesPage.tsx";
import BannedPage from "./pages/BannedPage.tsx";
import SubscribePage from "./pages/SubscribePage.tsx";
import PortfolioPage from "./pages/PortfolioPage.tsx";
import CommunityPage from "./pages/CommunityPage.tsx";
import OpportunitiesBoardPage from "./pages/OpportunitiesBoardPage.tsx";
import OpportunityDetailPage from "./pages/OpportunityDetailPage.tsx";
import MarketplaceHubPage from "./pages/MarketplaceHubPage.tsx";
import EmployerSignupPage from "./pages/EmployerSignupPage.tsx";
import EmployerDashboard from "./pages/EmployerDashboard.tsx";
import BlogPage from "./pages/BlogPage.tsx";
import LeaderboardPage from "./pages/LeaderboardPage.tsx";
import NotificationsPage from "./pages/NotificationsPage.tsx";
import ClassmatesPage from "./pages/ClassmatesPage.tsx";
import DiscussionGroupsPage from "./pages/DiscussionGroupsPage.tsx";
import GroupChatPage from "./pages/GroupChatPage.tsx";
import ProfileSettingsPage from "./pages/ProfileSettingsPage.tsx";
import MessagesPage from "./pages/MessagesPage.tsx";
import AdminMessagesPageAlias from "./pages/AdminMessagesPage.tsx";

// ── Global QueryClient with sensible defaults ─────────────────────────────────
// staleTime: 60s   — prevents refetching on every focus/mount for stable data
// retry: 1         — one retry on failure instead of the default 3
// gcTime: 5 min    — keep unused cache for 5 minutes (was cacheTime in v4)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* ── Public ── */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/:courseId" element={<CourseDetailPage />} />
            <Route path="/courses/:courseId/about" element={<CourseAboutPage />} />
            <Route path="/subscribe" element={<SubscribePage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/opportunities" element={<OpportunitiesBoardPage />} />
            <Route path="/opportunities/:opportunityId" element={<OpportunityDetailPage />} />
            <Route path="/employer/signup" element={<EmployerSignupPage />} />
            <Route path="/banned" element={<BannedPage />} />

            {/* ── Protected student ── */}
            <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
            <Route path="/lesson/:lessonId" element={<ProtectedRoute><LessonViewerPage /></ProtectedRoute>} />
            <Route path="/discussions" element={<ProtectedRoute><DiscussionGroupsPage /></ProtectedRoute>} />
            <Route path="/discussions/:groupId" element={<ProtectedRoute><GroupChatPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/projects" element={<ProtectedRoute><StudentProjectsPage /></ProtectedRoute>} />
            <Route path="/dashboard/certificates" element={<ProtectedRoute><StudentCertificatesPage /></ProtectedRoute>} />
            {/* Canonical marketplace route — /dashboard/marketing alias kept for backward compat */}
            <Route path="/dashboard/marketplace" element={<ProtectedRoute><MarketplaceHubPage /></ProtectedRoute>} />
            <Route path="/dashboard/marketing" element={<ProtectedRoute><MarketplaceHubPage /></ProtectedRoute>} />
            <Route path="/dashboard/opportunities" element={<ProtectedRoute><OpportunitiesBoardPage /></ProtectedRoute>} />
            <Route path="/dashboard/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/dashboard/classmates" element={<ProtectedRoute><ClassmatesPage /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><ProfileSettingsPage /></ProtectedRoute>} />
            <Route path="/dashboard/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
            <Route path="/dashboard/*" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />

            {/* ── Employer ── */}
            <Route path="/employer/dashboard" element={<ProtectedRoute><EmployerDashboard /></ProtectedRoute>} />

            {/* ── Admin ── */}
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/courses" element={<AdminRoute><AdminCoursesPage /></AdminRoute>} />
            <Route path="/admin/students" element={<AdminRoute><AdminStudentsPage /></AdminRoute>} />
            <Route path="/admin/enrollments" element={<AdminRoute><AdminEnrollmentsPage /></AdminRoute>} />
            <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptionsPage /></AdminRoute>} />
            <Route path="/admin/submissions" element={<AdminRoute><AdminSubmissionsPage /></AdminRoute>} />
            <Route path="/admin/announcements" element={<AdminRoute><AdminAnnouncementsPage /></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
            <Route path="/admin/employers" element={<AdminRoute><AdminEmployersPage /></AdminRoute>} />
            <Route path="/admin/opportunities" element={<AdminRoute><AdminOpportunitiesPage /></AdminRoute>} />
            <Route path="/admin/reports" element={<AdminRoute><AdminReportsPage /></AdminRoute>} />
            <Route path="/admin/projects" element={<AdminRoute><AdminProjectsPage /></AdminRoute>} />
            <Route path="/admin/certificates" element={<AdminRoute><AdminCertificatesPage /></AdminRoute>} />
            <Route path="/admin/groups" element={<AdminRoute><AdminGroupsPage /></AdminRoute>} />
            <Route path="/admin/messages" element={<AdminRoute><AdminMessagesPage /></AdminRoute>} />
            <Route path="/admin/testimonials" element={<AdminRoute><AdminTestimonialsPage /></AdminRoute>} />
            <Route path="/admin/feedback" element={<AdminRoute><AdminFeedbackPage /></AdminRoute>} />
            <Route path="/admin/deletion-feedback" element={<AdminRoute><AdminDeletionFeedbackPage /></AdminRoute>} />
            <Route path="/admin/blog" element={<AdminRoute><AdminBlogPage /></AdminRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          <StudentChatbot />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
