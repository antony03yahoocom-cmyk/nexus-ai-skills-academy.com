import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, BookOpen, Bell, Settings, LogOut, Cpu, CreditCard, FolderOpen, Award, Mail, BriefcaseBusiness, Handshake } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DashboardSidebar = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["unread-messages-sidebar", user?.id],
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

  const studentLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/courses", icon: BookOpen, label: "Browse Courses" },
    { to: "/dashboard/projects", icon: FolderOpen, label: "My Projects" },
    { to: "/dashboard/certificates", icon: Award, label: "Certificates" },
    { to: "/dashboard/marketing", icon: Handshake, label: "Marketplace Hub" },
    { to: "/dashboard/opportunities", icon: BriefcaseBusiness, label: "Opportunities" },
    { to: "/dashboard/messages", icon: Mail, label: "Messages", badge: unreadMessages },
    { to: "/dashboard/notifications", icon: Bell, label: "Notifications" },
    { to: "/subscribe", icon: CreditCard, label: "Subscription" },
    { to: "/dashboard/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <aside className="w-64 h-screen sticky top-0 bg-[#1A3A5F] text-white border-r border-[#102A47] flex flex-col shrink-0 hidden lg:flex shadow-2xl shadow-[#1A3A5F]/20">
      <div className="p-5 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2">
          <Cpu className="w-6 h-6 text-[#00C896]" />
          <span className="font-display font-bold text-white">NEXUS AI ACADEMY</span>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {studentLinks.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? "bg-[#00C896] text-[#1A3A5F] font-semibold shadow-sm shadow-[#00C896]/25" : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <link.icon className="w-4 h-4" />
              <span className="flex-1">{link.label}</span>
              {link.badge && link.badge > 0 ? (
                <span className="h-5 min-w-5 px-1 rounded-full bg-[#FFB400] text-[#1A3A5F] text-[10px] flex items-center justify-center font-bold">
                  {link.badge > 9 ? "9+" : link.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/75 hover:bg-white/10 hover:text-white transition-colors w-full">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
