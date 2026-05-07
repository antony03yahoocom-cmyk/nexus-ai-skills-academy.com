import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, BookOpen, FolderOpen, Award, CreditCard, LogOut, Cpu, Menu, X, MessageCircle, Settings, Mail, Bell, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_URL = "https://chat.whatsapp.com/GdHfJutCYlX7xitn3gC71o";

const DashboardTopNav = () => {
  const location = useLocation();
  const { signOut, profile, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["unread-messages", user?.id],
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
    queryKey: ["unread-group-msgs", user?.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id);
      const groupIds = (memberships ?? []).map((m: any) => m.group_id);
      if (groupIds.length === 0) return 0;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("group_messages")
        .select("*", { count: "exact", head: true })
        .in("group_id", groupIds)
        .neq("user_id", user!.id)
        .gte("created_at", since);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const navLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/courses", icon: BookOpen, label: "Courses" },
    { to: "/dashboard/projects", icon: FolderOpen, label: "Projects" },
    { to: "/dashboard/certificates", icon: Award, label: "Certificates" },
    { to: "/dashboard/classmates", icon: Users, label: "Classmates" },
    { to: "/discussions", icon: MessageCircle, label: "Discussions", badge: unreadGroups },
    { to: "/dashboard/messages", icon: Mail, label: "Messages", badge: unreadMessages },
    { to: "/subscribe", icon: CreditCard, label: "Premium" },
  ];

  const totalUnread = unreadMessages + unreadGroups;

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Cpu className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-lg">NEXUS AI ACADEMY</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to || (link.to !== "/dashboard" && location.pathname.startsWith(link.to));
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                  {link.badge && link.badge > 0 ? (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                      {link.badge > 9 ? "9+" : link.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-2">
            {/* WhatsApp community */}
            
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Join our WhatsApp Community"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#25D366] bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Community
            </a>

            {/* Notifications */}
            <Link
              to="/dashboard/notifications"
              className="relative flex items-center px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {totalUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </Link>

            {/* Settings */}
            <Link
              to="/dashboard/settings"
              className="flex items-center px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <span className="text-sm text-muted-foreground hidden lg:block">{profile?.full_name || "Student"}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-foreground p-1"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl px-4 py-3 space-y-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
                {link.badge && link.badge > 0 ? (
                  <span className="ml-auto h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                    {link.badge > 9 ? "9+" : link.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}

          {/* Mobile: Settings, Notifications, WhatsApp */}
          <div className="border-t border-border/50 pt-2 mt-1 space-y-1">
            <Link
              to="/dashboard/settings"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground"
            >
              <Settings className="w-4 h-4" /> Settings
            </Link>
            <Link
              to="/dashboard/notifications"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground"
            >
              <Bell className="w-4 h-4" /> Notifications
              {totalUnread > 0 && (
                <span className="ml-auto h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </Link>
            
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#25D366]"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Join WhatsApp Community
            </a>
          </div>

          <button
            onClick={() => { signOut(); setMobileOpen(false); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground w-full"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      )}
    </nav>
  );
};

export default DashboardTopNav;
