import { Cpu, Twitter, Linkedin, Facebook, Youtube, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import WhatsAppButton from "@/components/shared/WhatsAppButton";

const Footer = () => (
  <footer className="border-t border-border bg-background/50">
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">

        {/* Brand */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-5 h-5 text-primary" />
            <span className="font-display font-bold text-sm">NEXUS AI ACADEMY</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            Africa's premier platform for AI, programming, data science and digital skills. Where Skills Meet Opportunities.
          </p>
          {/* Social links */}
          <div className="flex items-center gap-3">
            <a href="https://twitter.com/NexusAIAcademy" target="_blank" rel="noopener noreferrer" aria-label="X / Twitter"
              className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors">
              <Twitter className="w-4 h-4" />
            </a>
            <a href="https://www.linkedin.com/company/nexus-ai-academy" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
              className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors">
              <Linkedin className="w-4 h-4" />
            </a>
            <a href="https://www.facebook.com/NexusAIAcademy" target="_blank" rel="noopener noreferrer" aria-label="Facebook"
              className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="https://www.youtube.com/@NexusAIAcademy" target="_blank" rel="noopener noreferrer" aria-label="YouTube"
              className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors">
              <Youtube className="w-4 h-4" />
            </a>
            <a href="https://www.instagram.com/nexusaiacademy" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
              className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Learning */}
        <div>
          <h4 className="text-sm font-semibold mb-4">Learning</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><Link to="/courses" className="hover:text-foreground transition-colors">All Courses</Link></li>
            <li><Link to="/blog" className="hover:text-foreground transition-colors">Blog & Resources</Link></li>
            <li><Link to="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</Link></li>
            <li><a href="https://sites.google.com/view/nexus-ai-pdf-hub?usp=sharing" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">PDF Resource Hub</a></li>
          </ul>
        </div>

        {/* Platform */}
        <div>
          <h4 className="text-sm font-semibold mb-4">Platform</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><Link to="/subscribe" className="hover:text-foreground transition-colors">Pricing</Link></li>
            <li><Link to="/portfolio" className="hover:text-foreground transition-colors">Portfolio</Link></li>
            <li><a href="#feedback" className="hover:text-foreground transition-colors">Feedback</a></li>
            <li><a href="#testimonials" className="hover:text-foreground transition-colors">Student Stories</a></li>
          </ul>
        </div>

        {/* Account */}
        <div>
          <h4 className="text-sm font-semibold mb-4">Account</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><Link to="/login" className="hover:text-foreground transition-colors">Login</Link></li>
            <li><Link to="/signup" className="hover:text-foreground transition-colors">Sign Up</Link></li>
            <li><Link to="/dashboard" className="hover:text-foreground transition-colors">Student Dashboard</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} NEXUS AI Skills Academy. All rights reserved. · Made in Africa 🌍
        </p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Secured by Paystack</span>
          <span>·</span>
          <span>M-Pesa Supported</span>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
