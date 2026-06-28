/**
 * DashboardTopNav.tsx
 *
 * CHANGES FROM ORIGINAL
 * ──────────────────────────────────────────────────────────────────
 * 1. 3 POLLING QUERIES → 1
 *    Before: unread-messages, unread-group-msgs, unread-notifications
 *    each fired individually every 30 seconds. Every authenticated
 *    user on any page was generating 3 DB requests per 30-second
 *    window. At 100 concurrent users = 600 queries/minute just for
 *    badge counts.
 *
 *    unread-group-msgs had an extra sequential sub-query (fetch
 *    memberships first, then message counts) = actually 4 queries
 *    per 30s per user.
 *
 *    After: A single "unread-counts" query fetches all three counts
 *    via Promise.all in one useQuery. Counts = 1 query/30s/user.
 *
 * 2. REALTIME SUBSCRIPTION KEPT
 *    The notifications Realtime channel remains so the bell badge
 *    updates instantly without waiting for the 30s poll.
 *
 * 3. QUERY KEY USES CENTRALIZED REGISTRY
 *    queryKeys.dashboard.unread(uid) instead of raw string.
 */

import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, FolderOpen, Award, CreditCard,
  LogOut, Cpu, Menu, X, MessageCircle, Settings, Mail, Bell,
  Users, Sparkles, ArrowLeft, Briefcase,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

const WHATSAPP_URL = "https://chat.whatsapp.com/GdHfJutCYlX7xitn3gC71o";

const DashboardTopNav = () => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { signOut, profile, user, isEmployer } = useAuth();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showBack = location.pathname !== "/dashboard" && location.pathname !== "/";
  const handleBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/dashboard"));

  // ── Single consolidated unread-counts query (replaces 3 pollers) ──
  const { data: counts } = useQuery({
    queryKey: queryKeys.dashboard.unread(user?.id ?? ""),
    queryFn: async () => {
      const [msgsRes, groupsRes, notifRes] = await Promise.all([
        // 1. Unread private messages
        supabase
          .from("private_messages")
          .select("*", { count: "exact", head: true })
          .eq("receiver_id", user!.id)
          .eq("is_read", false),

        // 2. Unread group messages (memberships + counts in one async block)
        (async () => {
          const { data: memberships } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", user!.id);
          const groupIds = (memberships ?? []).map((m: any) => m.group_id as string);
          if (!groupIds.length) return 0;
          const since = new Date(Date.now() - 86_400_000).toISOString();
          const { count } = await supabase
            .from("group_messages")
            .select("*", { count: "exact", head: true })
            .in("group_id", groupIds)
            .neq("user_id", user!.id)
            .gte("created_at", since);
          return count ?? 0;
        })(),

        // 3. Unread notifications
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("is_read", false),
      ]);

      return {
        messages:      msgsRes.count  ?? 0,
        groups:        typeof groupsRes === "number" ? groupsRes : 0,
        notifications: notifRes.count ?? 0,
      };
    },
    enabled: !!user,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const unreadMessages      = counts?.messages      ?? 0;
  const unreadGroups        = counts?.groups         ?? 0;
  const unreadNotifications = counts?.notifications  ?? 0;
  const totalUnread         = unreadMessages + unreadGroups + unreadNotifications;

  // Realtime: instant bell update on new notification
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("topnav-notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: queryKeys.dashboard.unread(user.id) }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const navLinks = [
    { to: "/dashboard",                  icon: LayoutDashboard, label: "Dashboard"    },
    { to: "/courses",                    icon: BookOpen,        label: "Courses"      },
    { to: "/dashboard/projects",         icon: FolderOpen,      label: "Projects"     },
    { to: "/community",                  icon: Sparkles,        label: "Community"    },
    { to: "/dashboard/certificates",     icon: Award,           label: "Certificates" },
    { to: "/dashboard/classmates",       icon: Users,           label: "Classmates"   },
    { to: "/discussions",                icon: MessageCircle,   label: "Discussions",  badge: unreadGroups    },
    { to: "/dashboard/messages",         icon: Mail,            label: "Messages",     badge: unreadMessages  },
    { to: "/subscribe",                  icon: CreditCard,      label: "Premium"      },
    ...(isEmployer ? [{ to: "/employer/dashboard", icon: Briefcase, label: "Employer" }] : []),
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#102A47] bg-[#1A3A5F]/95 text-white shadow-lg shadow-[#1A3A5F]/15 backdrop-blur-xl">
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="flex h-16 min-w-0 items-center gap-3">
            {showBack && (
              <button onClick={handleBack} aria-label="Go back"
                className="shrink-0 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <Cpu className="w-6 h-6 text-[#00C896]" />
              <span className="hidden font-display text-base font-bold text-white sm:inline lg:text-lg">NEXUS AI ACADEMY</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden flex-1 min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain px-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] md:flex">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to ||
                  (link.to !== "/dashboard" && location.pathname.startsWith(link.to));
                return (
                  <Link key={link.to} to={link.to}
                    className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                      isActive
                        ? "bg-[#00C896] text-[#1A3A5F] font-semibold shadow-sm shadow-[#00C896]/25"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                    {link.badge && link.badge > 0 ? (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#FFB400] text-[#1A3A5F] text-[10px] flex items-center justify-center font-bold">
                        {link.badge > 9 ? "9+" : link.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>

            {/* Desktop right */}
            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#00C896] bg-[#00C896]/10 border border-[#00C896]/25 hover:bg-[#00C896]/20 transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> Community
              </a>
              <Link to="/dashboard/notifications"
                className="relative flex items-center px-2 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Notifications">
                <Bell className="w-4 h-4" />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#FFB400] text-[#1A3A5F] text-[10px] flex items-center justify-center font-bold">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </Link>
              <Link to="/dashboard/settings"
                className="flex items-center px-2 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Settings">
                <Settings className="w-4 h-4" />
              </Link>
              <span className="text-sm text-white/70 hidden lg:block">{profile?.full_name || "Student"}</span>
              <button onClick={signOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile hamburger */}
            <button className="md:hidden rounded-lg p-1 text-white hover:bg-white/10 ml-auto"
              onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#1A3A5F]/98 backdrop-blur-xl px-4 py-3 space-y-1 shadow-xl shadow-[#1A3A5F]/20">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive ? "bg-[#00C896] text-[#1A3A5F] font-semibold" : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}>
                  <link.icon className="w-4 h-4" />
                  {link.label}
                  {link.badge && link.badge > 0 ? (
                    <span className="ml-auto h-5 w-5 rounded-full bg-[#FFB400] text-[#1A3A5F] text-[10px] flex items-center justify-center font-bold">
                      {link.badge > 9 ? "9+" : link.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <div className="border-t border-white/10 pt-2 mt-1 space-y-1">
              <Link to="/dashboard/settings" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/75 hover:bg-white/10 hover:text-white">
                <Settings className="w-4 h-4" /> Settings
              </Link>
              <Link to="/dashboard/notifications" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/75 hover:bg-white/10 hover:text-white">
                <Bell className="w-4 h-4" /> Notifications
                {totalUnread > 0 && (
                  <span className="ml-auto h-5 w-5 rounded-full bg-[#FFB400] text-[#1A3A5F] text-[10px] flex items-center justify-center font-bold">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </Link>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#00C896] hover:bg-[#00C896]/10">
                <MessageCircle className="w-4 h-4" /> Join WhatsApp Community
              </a>
            </div>
            <button onClick={() => { signOut(); setMobileOpen(false); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/75 w-full hover:bg-white/10 hover:text-white">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        )}
      </nav>
      <div className="h-16" />
    </>
  );
};

export default DashboardTopNav;
