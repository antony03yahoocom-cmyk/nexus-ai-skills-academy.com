import { Cpu } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t border-border py-12">
    <div className="container mx-auto px-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" />
          <span className="font-display font-bold">NEXUS AI ACADEMY</span>
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <Link to="/courses" className="hover:text-foreground transition-colors">Courses</Link>
          <Link to="/portfolio" className="hover:text-foreground transition-colors">Portfolio</Link>
          <Link to="/login" className="hover:text-foreground transition-colors">Login</Link>
          <Link to="/signup" className="hover:text-foreground transition-colors">Sign Up</Link>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Nexus AI Academy. All rights reserved.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
