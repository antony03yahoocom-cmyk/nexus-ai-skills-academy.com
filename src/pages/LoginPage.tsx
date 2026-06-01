import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cpu, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); const { error } = await supabase.auth.signInWithPassword({ email, password }); setLoading(false); if (error) toast.error(error.message); else { toast.success("Logged in successfully!"); navigate("/dashboard"); } };
  
  const handleGoogleSignIn = async () => { const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/dashboard`, queryParams: { prompt: "select_account" } } }); if (error) toast.error(error.message || "Google sign-in failed"); };

  return (<div className="min-h-screen bg-background mesh-gradient flex items-center justify-center px-4"><div className="w-full max-w-md"><div className="text-center mb-8"><Link to="/" className="inline-flex items-center gap-2 mb-6"><Cpu className="w-8 h-8 text-primary" /><span className="font-display font-bold text-xl">NEXUS AI ACADEMY</span></Link><h1 className="text-3xl font-bold mb-2">Welcome back</h1><p className="text-muted-foreground">Sign in to continue learning</p></div><div className="glass-card p-8"><Button variant="outline" className="w-full mb-6" onClick={handleGoogleSignIn}>Continue with Google</Button><div className="relative mb-6"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div></div><form onSubmit={handleSubmit} className="space-y-4"><div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary border-border" required /></div><div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-secondary border-border" required /></div><Button variant="hero" className="w-full" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign In"}<ArrowRight className="w-4 h-4 ml-1" /></Button></form><p className="text-center text-sm text-muted-foreground mt-6">Don't have an account? <Link to="/signup" className="text-primary hover:underline">Start free trial</Link></p></div></div></div>);
};

export default LoginPage;
