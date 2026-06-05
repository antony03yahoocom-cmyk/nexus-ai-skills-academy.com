import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cpu, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAdmin } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Cpu className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-lg">NEXUS AI ACADEMY</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link to="/courses" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Courses</Link>
          <Link to="/portfolio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Portfolio</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
              {isAdmin && <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Admin</Link>}
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Log In</Link>
              <Button variant="hero" size="sm" asChild><Link to="/signup">Start Free Trial</Link></Button>
            </>
          )}
        </div>

        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl px-4 py-4 flex flex-col gap-3">
          <Link to="/courses" className="text-sm py-2 text-muted-foreground" onClick={() => setMobileOpen(false)}>Courses</Link>
          <Link to="/portfolio" className="text-sm py-2 text-muted-foreground" onClick={() => setMobileOpen(false)}>Portfolio</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm py-2 text-muted-foreground" onClick={() => setMobileOpen(false)}>Dashboard</Link>
              {isAdmin && <Link to="/admin" className="text-sm py-2 text-muted-foreground" onClick={() => setMobileOpen(false)}>Admin</Link>}
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm py-2 text-muted-foreground" onClick={() => setMobileOpen(false)}>Log In</Link>
              <Button variant="hero" size="sm" asChild><Link to="/signup" onClick={() => setMobileOpen(false)}>Start Free Trial</Link></Button>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
