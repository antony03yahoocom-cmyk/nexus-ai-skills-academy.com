import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, BookOpen, Bell, Settings, LogOut, Cpu, CreditCard, FolderOpen, Award, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const studentLinks = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/courses", icon: BookOpen, label: "Browse Courses" },
  { to: "/dashboard/projects", icon: FolderOpen, label: "My Projects" },
  { to: "/dashboard/certificates", icon: Award, label: "Certificates" },
  { to: "/dashboard/messages", icon: Mail, label: "Messages" },
  { to: "/dashboard/notifications", icon: Bell, label: "Notifications" },
  { to: "/subscribe", icon: CreditCard, label: "Subscription" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

const DashboardSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 hidden lg:flex">
      <div className="p-5 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2">
          <Cpu className="w-6 h-6 text-primary" />
          <span className="font-display font-bold">NEXUS AI ACADEMY</span>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {studentLinks.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link key={link.to} to={link.to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}>
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
