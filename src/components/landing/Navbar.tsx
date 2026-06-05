import { Link, useNavigate } from "react-router-dom";
import { Cpu, Menu, X, LayoutDashboard, ShieldCheck, LogOut, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const WHATSAPP_URL = "https://chat.whatsapp.com/GdHfJutCYlX7xitn3gC71o";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin, loading, signOut } = useAuth();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
    navigate("/");
  };

  const links = [
    { label: "Courses", to: "/courses" },
    { label: "Blog", to: "/blog" },
    { label: "Leaderboard", to: "/leaderboard" },
    { label: "Portfolio", to: "/portfolio" },
    { label: "Community", to: "/community" },
    { label: "Pricing", to: "/subscribe" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/95 backdrop-blur-xl border-b border-border shadow-sm" : "bg-transparent"
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="NEXUS AI Academy home">
            <Cpu className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-sm sm:text-base">NEXUS AI ACADEMY</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-[#25D366] hover:text-[#25D366]">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-1" />
                WhatsApp
              </a>
            </Button>
            {!loading && user ? (
              <>
                {isAdmin && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin">
                      <ShieldCheck className="w-4 h-4 mr-1" />
                      Admin
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/dashboard">
                    <LayoutDashboard className="w-4 h-4 mr-1" />
                    Dashboard
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-1" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Login</Link>
                </Button>
                <Button variant="hero" size="sm" asChild>
                  <Link to="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-foreground p-2 rounded-lg hover:bg-secondary/50 transition-colors touch-manipulation"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-background/98 backdrop-blur-xl border-b border-border px-4 py-4 space-y-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center px-3 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors touch-manipulation"
              onClick={() => setIsOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="border-t border-border pt-3 mt-3 flex flex-col gap-2">
            <Button variant="ghost" size="sm" asChild className="justify-start text-[#25D366] hover:text-[#25D366]">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => setIsOpen(false)}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Join WhatsApp Community
              </a>
            </Button>
            {!loading && user ? (
              <>
                {isAdmin && (
                  <Button variant="ghost" size="sm" asChild className="justify-start">
                    <Link to="/admin" onClick={() => setIsOpen(false)}>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Admin Dashboard
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild className="justify-start">
                  <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Student Dashboard
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="justify-start" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild className="justify-start">
                  <Link to="/login" onClick={() => setIsOpen(false)}>Login</Link>
                </Button>
                <Button variant="hero" size="sm" asChild>
                  <Link to="/signup" onClick={() => setIsOpen(false)}>Get Started — Free Trial</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
