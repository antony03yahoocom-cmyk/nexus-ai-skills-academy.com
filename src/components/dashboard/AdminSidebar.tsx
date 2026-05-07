import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, Users, Settings, LogOut, Cpu, Megaphone,
  FolderOpen, Award, FileText, MessageCircle, Mail, GraduationCap, Star, MessageSquare
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_URL = "https://chat.whatsapp.com/GdHfJutCYlX7xitn3gC71o";

const AdminSidebar = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["admin-unread-messages", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("private_messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user!.id)
        .eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: unreadGroups = 0 } = useQuery({
    queryKey: ["admin-unread-groups", user?.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("group_messages")
        .select("*", { count: "exact", head: true })
        .neq("user_id", user!.id)
        .gte("created_at", since);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: unreadFeedback = 0 } = useQuery({
    queryKey: ["admin-unread-feedback"],
    queryFn: async () => {
      const { count } = await supabase
        .from("site_feedback" as any)
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  const adminLinks = [
    { to: "/admin", icon: LayoutDashboard, label: "Overview" },
    { to: "/admin/courses", icon: BookOpen, label: "Manage Courses" },
    { to: "/admin/students", icon: Users, label: "Students" },
    { to: "/admin/enrollments", icon: GraduationCap, label: "Enrollments" },
    { to: "/admin/submissions", icon: FileText, label: "Submissions" },
    { to: "/admin/projects", icon: FolderOpen, label: "Projects" },
    { to: "/admin/certificates", icon: Award, label: "Certificates" },
    { to: "/admin/announcements", icon: Megaphone, label: "Announcements" },
    { to: "/admin/testimonials", icon: Star, label: "Testimonials" },
    { to: "/admin/feedback", icon: MessageSquare, label: "Feedback", badge: unreadFeedback },
    { to: "/admin/groups", icon: MessageCircle, label: "Groups", badge: unreadGroups },
    { to: "/admin/messages", icon: Mail, label: "Messages", badge: unreadMessages },
    { to: "/admin/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <aside className="w-64 h-screen sticky top-0 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 hidden lg:flex">
      <div className="p-5 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2">
          <Cpu className="w-6 h-6 text-primary" />
          <span className="font-display font-bold">NEXUS AI ACADEMY</span>
        </Link>
        <span className="text-xs text-primary font-medium mt-1 block">Admin Panel</span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {adminLinks.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              <link.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{link.label}</span>
              {link.badge && link.badge > 0 ? (
                <span className="h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                  {link.badge > 9 ? "9+" : link.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* WhatsApp community button */}
      <div className="px-3 py-2 border-t border-sidebar-border">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#25D366] hover:bg-[#25D366]/10 transition-colors w-full"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.76[...]" />
          </svg>
          <span className="flex-1">WhatsApp Community</span>
        </a>
      </div>

      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
