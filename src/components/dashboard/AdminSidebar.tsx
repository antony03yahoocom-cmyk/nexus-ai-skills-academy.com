import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  LayoutDashboard,
  BookOpen,
  Users,
  Settings,
  LogOut,
  Cpu,
  Megaphone,
  FolderOpen,
  Award,
  FileText,
  MessageCircle,
  Mail,
  GraduationCap,
  Star,
  MessageSquare,
  UserX,
  Newspaper,
  Menu,
  X,
  CreditCard,
  Briefcase,
  Flag,
  ArrowLeft,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_URL =
  "https://chat.whatsapp.com/GdHfJutCYlX7xitn3gC71o";

const WaIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-4 h-4 fill-current shrink-0"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-1.859-.173-.099-.299-.148-.47.15-.171.297-.615.966-.751 1.164-.137.198-.273.223-.464.071-.19-.152-..8-.572-.572 0 0 1-.036-1.004z" />
  </svg>
);

// Shared nav links + badge data
const useAdminNav = () => {
  const { user } = useAuth();

  const { data: unreadMessages = 0 } =
    useQuery({
      queryKey: [
        "admin-unread-messages",
        user?.id,
      ],

      queryFn: async () => {
        const { count } = await supabase
          .from("private_messages")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("receiver_id", user!.id)
          .eq("is_read", false);

        return count ?? 0;
      },

      enabled: !!user,

      refetchInterval: 30000,
    });

  const { data: unreadGroups = 0 } =
    useQuery({
      queryKey: [
        "admin-unread-groups",
        user?.id,
      ],

      queryFn: async () => {
        const since = new Date(
          Date.now() -
            24 * 60 * 60 * 1000,
        ).toISOString();

        const { count } = await supabase
          .from("group_messages")
          .select("*", {
            count: "exact",
            head: true,
          })
          .neq("user_id", user!.id)
          .gte("created_at", since);

        return count ?? 0;
      },

      enabled: !!user,

      refetchInterval: 30000,
    });

  const { data: unreadFeedback = 0 } =
    useQuery({
      queryKey: [
        "admin-unread-feedback",
      ],

      queryFn: async () => {
        const { count } = await supabase
          .from("site_feedback" as any)
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("is_read", false);

        return count ?? 0;
      },

      refetchInterval: 60000,
    });

  const links = [
    {
      to: "/admin",
      icon: LayoutDashboard,
      label: "Overview",
    },

    {
      to: "/admin/courses",
      icon: BookOpen,
      label: "Manage Courses",
    },

    {
      to: "/admin/students",
      icon: Users,
      label: "Students",
    },

    {
      to: "/admin/employers",
      icon: Briefcase,
      label: "Employers",
    },

    {
      to: "/admin/opportunities",
      icon: FolderOpen,
      label: "Opportunities",
    },

    {
      to: "/admin/reports",
      icon: Flag,
      label: "Reports",
    },

    {
      to: "/admin/enrollments",
      icon: GraduationCap,
      label: "Enrollments",
    },

    {
      to: "/admin/subscriptions",
      icon: CreditCard,
      label: "Subscriptions",
    },

    {
      to: "/admin/submissions",
      icon: FileText,
      label: "Submissions",
    },

    {
      to: "/admin/projects",
      icon: FolderOpen,
      label: "Projects",
    },

    {
      to: "/admin/certificates",
      icon: Award,
      label: "Certificates",
    },

    {
      to: "/admin/announcements",
      icon: Megaphone,
      label: "Announcements",
    },

    {
      to: "/admin/testimonials",
      icon: Star,
      label: "Testimonials",
    },

    {
      to: "/admin/blog",
      icon: Newspaper,
      label: "Blog",
    },

    {
      to: "/admin/feedback",
      icon: MessageSquare,
      label: "Feedback",
      badge: unreadFeedback,
    },

    {
      to: "/admin/deletion-feedback",
      icon: UserX,
      label: "Deletion Feedback",
    },

    {
      to: "/admin/groups",
      icon: MessageCircle,
      label: "Groups",
      badge: unreadGroups,
    },

    {
      to: "/admin/messages",
      icon: Mail,
      label: "Messages",
      badge: unreadMessages,
    },

    {
      to: "/admin/settings",
      icon: Settings,
      label: "Settings",
    },
  ];

  return links;
};

// Shared link component
const NavLink = ({
  link,
  isActive,
  onClick,
}: {
  link: any;
  isActive: boolean;
  onClick?: () => void;
}) => {
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

      <span className="flex-1">
        {link.label}
      </span>

      {link.badge &&
      link.badge > 0 ? (
        <span className="h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
          {link.badge > 9
            ? "9+"
            : link.badge}
        </span>
      ) : null}
    </Link>
  );
};

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { signOut } = useAuth();

  const adminLinks = useAdminNav();

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const showBack = location.pathname !== "/admin";
  const handleBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/admin"));

  const brandBar = (
    <div className="p-5 border-b border-sidebar-border shrink-0">
      <Link
        to="/"
        className="flex items-center gap-2"
      >
        <Cpu className="w-6 h-6 text-primary" />

        <span className="font-display font-bold">
          NEXUS AI ACADEMY
        </span>
      </Link>

      <span className="text-xs text-primary font-medium mt-1 block">
        Admin Panel
      </span>
      {showBack && (
        <button
          onClick={handleBack}
          className="mt-3 flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      )}
    </div>
  );

  const navContent = (
    onLinkClick?: () => void,
  ) => (
    <>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {adminLinks.map((link) => (
          <NavLink
            key={link.to}
            link={link}
            isActive={
              location.pathname ===
              link.to
            }
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

          <span className="flex-1">
            WhatsApp Community
          </span>
        </a>
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <button
          onClick={() => {
            signOut();

            onLinkClick?.();
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />

          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-64 h-screen sticky top-0 bg-sidebar border-r border-sidebar-border flex-col shrink-0 hidden lg:flex">
        {brandBar}

        {navContent()}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 h-14 shadow-sm">
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              onClick={handleBack}
              aria-label="Go back"
              title="Go back"
              className="p-1.5 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <Link
            to="/"
            className="flex items-center gap-2"
          >
            <Cpu className="w-5 h-5 text-primary" />

            <span className="font-display font-bold text-sm">
              NEXUS ADMIN
            </span>
          </Link>
        </div>

        <button
          onClick={() =>
            setMobileOpen(true)
          }
          aria-label="Open menu"
          className="p-2 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
      <div className="lg:hidden h-14" />

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() =>
              setMobileOpen(false)
            }
          />

          {/* Drawer panel */}
          <div className="relative w-72 max-w-[85vw] h-full bg-sidebar flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-sidebar-border shrink-0">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />

                <span className="font-display font-bold text-sm">
                  NEXUS AI ACADEMY
                </span>
              </div>

              <button
                onClick={() =>
                  setMobileOpen(false)
                }
                className="p-1.5 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <span className="text-xs text-primary font-medium px-5 pb-2 pt-1 border-b border-sidebar-border/40 shrink-0">
              Admin Panel
            </span>

            {navContent(() =>
              setMobileOpen(false),
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AdminSidebar;
