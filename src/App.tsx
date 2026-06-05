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
import LessonViewerPage from "./pages/LessonViewerPage.tsx";
import StudentDashboard from "./pages/StudentDashboard.tsx";
import StudentProjectsPage from "./pages/StudentProjectsPage.tsx";
import StudentCertificatesPage from "./pages/StudentCertificatesPage.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import AdminCoursesPage from "./pages/AdminCoursesPage.tsx";
import AdminStudentsPage from "./pages/AdminStudentsPage.tsx";
import AdminSubmissionsPage from "./pages/AdminSubmissionsPage.tsx";
import AdminAnnouncementsPage from "./pages/AdminAnnouncementsPage.tsx";
import AdminSettingsPage from "./pages/AdminSettingsPage.tsx";
import AdminProjectsPage from "./pages/AdminProjectsPage.tsx";
import AdminCertificatesPage from "./pages/AdminCertificatesPage.tsx";
import SubscribePage from "./pages/SubscribePage.tsx";
import PortfolioPage from "./pages/PortfolioPage.tsx";
import DiscussionGroupsPage from "./pages/DiscussionGroupsPage.tsx";
import GroupChatPage from "./pages/GroupChatPage.tsx";
import AdminGroupsPage from "./pages/AdminGroupsPage.tsx";
import ProfileSettingsPage from "./pages/ProfileSettingsPage.tsx";
import MessagesPage from "./pages/MessagesPage.tsx";
import AdminMessagesPage from "./pages/AdminMessagesPage.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/:courseId" element={<CourseDetailPage />} />
            <Route path="/subscribe" element={<SubscribePage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/lesson/:lessonId" element={<ProtectedRoute><LessonViewerPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/projects" element={<ProtectedRoute><StudentProjectsPage /></ProtectedRoute>} />
            <Route path="/dashboard/certificates" element={<ProtectedRoute><StudentCertificatesPage /></ProtectedRoute>} />
            <Route path="/discussions" element={<ProtectedRoute><DiscussionGroupsPage /></ProtectedRoute>} />
            <Route path="/discussions/:groupId" element={<ProtectedRoute><GroupChatPage /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><ProfileSettingsPage /></ProtectedRoute>} />
            <Route path="/dashboard/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
            <Route path="/dashboard/*" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/courses" element={<AdminRoute><AdminCoursesPage /></AdminRoute>} />
            <Route path="/admin/students" element={<AdminRoute><AdminStudentsPage /></AdminRoute>} />
            <Route path="/admin/submissions" element={<AdminRoute><AdminSubmissionsPage /></AdminRoute>} />
            <Route path="/admin/announcements" element={<AdminRoute><AdminAnnouncementsPage /></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
            <Route path="/admin/projects" element={<AdminRoute><AdminProjectsPage /></AdminRoute>} />
            <Route path="/admin/certificates" element={<AdminRoute><AdminCertificatesPage /></AdminRoute>} />
            <Route path="/admin/groups" element={<AdminRoute><AdminGroupsPage /></AdminRoute>} />
            <Route path="/admin/messages" element={<AdminRoute><AdminMessagesPage /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <StudentChatbot />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
