import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, Users, Settings, LogOut, Cpu, Megaphone,
  FolderOpen, Award, FileText, MessageCircle, Mail, GraduationCap, Star,
  MessageSquare, UserX, Newspaper, Menu, X, CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_URL = "https://chat.whatsapp.com/GdHfJutCYlX7xitn3gC71o";

const WaIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// Shared nav links + badge data — used by both desktop sidebar and mobile drawer
const useAdminNav = () => {
  const { user } = useAuth();

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["admin-unread-messages", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("private_messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user!.id).eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: unreadGroups = 0 } = useQuery({
    queryKey: ["admin-unread-groups", user?.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase.from("group_messages")
        .select("*", { count: "exact", head: true })
        .neq("user_id", user!.id).gte("created_at", since);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: unreadFeedback = 0 } = useQuery({
    queryKey: ["admin-unread-feedback"],
    queryFn: async () => {
      const { count } = await supabase.from("site_feedback" as any)
        .select("*", { count: "exact", head: true }).eq("is_read", false);
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  const links = [
    { to: "/admin", icon: LayoutDashboard, label: "Overview" },
    { to: "/admin/courses", icon: BookOpen, label: "Manage Courses" },
    { to: "/admin/students", icon: Users, label: "Students" },
    { to: "/admin/enrollments", icon: GraduationCap, label: "Enrollments" },
    { to: "/admin/subscriptions", icon: CreditCard, label: "Subscriptions" },
    { to: "/admin/submissions", icon: FileText, label: "Submissions" },
    { to: "/admin/projects", icon: FolderOpen, label: "Projects" },
    { to: "/admin/certificates", icon: Award, label: "Certificates" },
    { to: "/admin/announcements", icon: Megaphone, label: "Announcements" },
    { to: "/admin/testimonials", icon: Star, label: "Testimonials" },
    { to: "/admin/blog", icon: Newspaper, label: "Blog" },
    { to: "/admin/feedback", icon: MessageSquare, label: "Feedback", badge: unreadFeedback },
    { to: "/admin/deletion-feedback", icon: UserX, label: "Deletion Feedback" },
    { to: "/admin/groups", icon: MessageCircle, label: "Groups", badge: unreadGroups },
    { to: "/admin/messages", icon: Mail, label: "Messages", badge: unreadMessages },
    { to: "/admin/settings", icon: Settings, label: "Settings" },
  ];

  return links;
};

// Single link row — used in both sidebar and drawer
const NavLink = ({ link, isActive, onClick }: { link: any; isActive: boolean; onClick?: () => void }) => {
  const Icon = link.icon;
  return (
    <Link
      to={link.to}
      onClick={onClick}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{link.label}</span>
      {link.badge && link.badge > 0 ? (
        <span className="h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
          {link.badge > 9 ? "9+" : link.badge}
        </span>
      ) : null}
    </Link>
  );
};

const AdminSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const adminLinks = useAdminNav();
  const [mobileOpen, setMobileOpen] = useState(false);

  const brandBar = (
    <div className="p-5 border-b border-sidebar-border shrink-0">
      <Link to="/" className="flex items-center gap-2">
        <Cpu className="w-6 h-6 text-primary" />
        <span className="font-display font-bold">NEXUS AI ACADEMY</span>
      </Link>
      <span className="text-xs text-primary font-medium mt-1 block">Admin Panel</span>
    </div>
  );

  const navContent = (onLinkClick?: () => void) => (
    <>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {adminLinks.map((link) => (
          <NavLink
            key={link.to}
            link={link}
            isActive={location.pathname === link.to}
            onClick={onLinkClick}
          />
        ))}
      </nav>

      {/* WhatsApp */}
      <div className="px-3 py-2 border-t border-sidebar-border shrink-0">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onLinkClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#25D366] hover:bg-[#25D366]/10 transition-colors w-full"
        >
          <WaIcon />
          <span className="flex-1">WhatsApp Community</span>
        </a>
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <button
          onClick={() => { signOut(); onLinkClick?.(); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="w-64 h-screen sticky top-0 bg-sidebar border-r border-sidebar-border flex-col shrink-0 hidden lg:flex">
        {brandBar}
        {navContent()}
      </aside>

      {/* ── Mobile top bar (below lg) ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 h-14 shadow-sm">
        <Link to="/" className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" />
          <span className="font-display font-bold text-sm">NEXUS ADMIN</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-2 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer panel */}
          <div className="relative w-72 max-w-[85vw] h-full bg-sidebar flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-sidebar-border shrink-0">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                <span className="font-display font-bold text-sm">NEXUS AI ACADEMY</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <span className="text-xs text-primary font-medium px-5 pb-2 pt-1 border-b border-sidebar-border/40 shrink-0">
              Admin Panel
            </span>
            {navContent(() => setMobileOpen(false))}
          </div>
        </div>
      )}
    </>
  );
};

export default AdminSidebar;
