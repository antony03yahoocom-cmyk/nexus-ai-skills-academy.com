import { lazy, Suspense } from "react";
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

// Lazy load all pages to reduce initial bundle size
const CoursesPage = lazy(() => import("./pages/CoursesPage"));
const CourseDetailPage = lazy(() => import("./pages/CourseDetailPage"));
const CourseAboutPage = lazy(() => import("./pages/CourseAboutPage"));
const LessonViewerPage = lazy(() => import("./pages/LessonViewerPage"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const StudentProjectsPage = lazy(() => import("./pages/StudentProjectsPage"));
const StudentCertificatesPage = lazy(() => import("./pages/StudentCertificatesPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminSubscriptionsPage = lazy(() => import("./pages/AdminSubscriptionsPage"));
const AdminCoursesPage = lazy(() => import("./pages/AdminCoursesPage"));
const AdminStudentsPage = lazy(() => import("./pages/AdminStudentsPage"));
const AdminSubmissionsPage = lazy(() => import("./pages/AdminSubmissionsPage"));
const AdminAnnouncementsPage = lazy(() => import("./pages/AdminAnnouncementsPage"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));
const AdminProjectsPage = lazy(() => import("./pages/AdminProjectsPage"));
const AdminCertificatesPage = lazy(() => import("./pages/AdminCertificatesPage"));
const AdminEnrollmentsPage = lazy(() => import("./pages/AdminEnrollmentsPage"));
const AdminTestimonialsPage = lazy(() => import("./pages/AdminTestimonialsPage"));
const AdminFeedbackPage = lazy(() => import("./pages/AdminFeedbackPage"));
const AdminDeletionFeedbackPage = lazy(() => import("./pages/AdminDeletionFeedbackPage"));
const AdminBlogPage = lazy(() => import("./pages/AdminBlogPage"));
const AdminWhatsAppPage = lazy(() => import("./pages/AdminWhatsAppPage"));
const AdminEmployersPage = lazy(() => import("./pages/AdminEmployersPage"));
const AdminOpportunitiesPage = lazy(() => import("./pages/AdminOpportunitiesPage"));
const AdminReportsPage = lazy(() => import("./pages/AdminReportsPage"));
const BannedPage = lazy(() => import("./pages/BannedPage"));
const SubscribePage = lazy(() => import("./pages/SubscribePage"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const DiscussionGroupsPage = lazy(() => import("./pages/DiscussionGroupsPage"));
const GroupChatPage = lazy(() => import("./pages/GroupChatPage"));
const AdminGroupsPage = lazy(() => import("./pages/AdminGroupsPage"));
const ProfileSettingsPage = lazy(() => import("./pages/ProfileSettingsPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const AdminMessagesPage = lazy(() => import("./pages/AdminMessagesPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ClassmatesPage = lazy(() => import("./pages/ClassmatesPage"));
const MarketplaceHubPage = lazy(() => import("./pages/MarketplaceHubPage"));
const OpportunitiesBoardPage = lazy(() => import("./pages/OpportunitiesBoardPage"));
const OpportunityDetailPage = lazy(() => import("./pages/OpportunityDetailPage"));
const EmployerSignupPage = lazy(() => import("./pages/EmployerSignupPage"));
const EmployerDashboard = lazy(() => import("./pages/EmployerDashboard"));

// Loading fallback
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes (formerly cacheTime)
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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/courses/:courseId" element={<CourseDetailPage />} />
              <Route path="/courses/:courseId/about" element={<CourseAboutPage />} />
              <Route path="/subscribe" element={<SubscribePage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
              <Route path="/opportunities" element={<OpportunitiesBoardPage />} />
              <Route path="/dashboard/opportunities" element={<ProtectedRoute><OpportunitiesBoardPage /></ProtectedRoute>} />
              <Route path="/dashboard/marketing" element={<ProtectedRoute><MarketplaceHubPage /></ProtectedRoute>} />
              <Route path="/opportunities/:opportunityId" element={<OpportunityDetailPage />} />
              <Route path="/employer/signup" element={<EmployerSignupPage />} />
              <Route path="/employer/dashboard" element={<ProtectedRoute><EmployerDashboard /></ProtectedRoute>} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/lesson/:lessonId" element={<ProtectedRoute><LessonViewerPage /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/projects" element={<ProtectedRoute><StudentProjectsPage /></ProtectedRoute>} />
              <Route path="/dashboard/certificates" element={<ProtectedRoute><StudentCertificatesPage /></ProtectedRoute>} />
              <Route path="/dashboard/marketplace" element={<ProtectedRoute><MarketplaceHubPage /></ProtectedRoute>} />
              <Route path="/dashboard/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="/dashboard/classmates" element={<ProtectedRoute><ClassmatesPage /></ProtectedRoute>} />
              <Route path="/discussions" element={<ProtectedRoute><DiscussionGroupsPage /></ProtectedRoute>} />
              <Route path="/discussions/:groupId" element={<ProtectedRoute><GroupChatPage /></ProtectedRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute><ProfileSettingsPage /></ProtectedRoute>} />
              <Route path="/dashboard/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
              <Route path="/dashboard/*" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
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
              <Route path="/admin/whatsapp" element={<AdminRoute><AdminWhatsAppPage /></AdminRoute>} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms-of-service" element={<TermsOfServicePage />} />
              <Route path="/banned" element={<BannedPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <StudentChatbot />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
