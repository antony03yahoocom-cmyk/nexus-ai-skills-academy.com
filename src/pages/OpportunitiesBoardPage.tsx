import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Search, Briefcase, Clock, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { useAuth } from "@/contexts/AuthContext";

const typeColor: Record<string, string> = {
  freelance: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  job: "bg-green-500/10 text-green-400 border-green-500/20",
  internship: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  collaboration: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  contest: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  ai_task: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  remote_task: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const OpportunitiesBoardPage = () => {
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const nav = useNavigate();

  const { data = [], isLoading } = useQuery({
    queryKey: ["opportunities-board", search],
    queryFn: async () => {
      // FIX: cast as any because marketplace_opportunities is not in generated types yet
      const q = (supabase as any)
        .from("marketplace_opportunities")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      const { data, error } = search ? await q.ilike("title", `%${search}%`) : await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <DashboardTopNav />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            onClick={() => nav(-1)}
            className="text-muted-foreground hover:text-foreground self-start"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Opportunities Hub</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Browse gigs, jobs, internships, and collaborations posted by employers.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs, gigs, internships..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-card p-6 animate-pulse space-y-3">
                <div className="h-4 bg-secondary rounded w-2/3" />
                <div className="h-3 bg-secondary rounded w-full" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-medium">No opportunities found.</p>
            {search && (
              <p className="text-sm text-muted-foreground mt-1">
                Try a different search term.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.map((op: any) => (
              <Card key={op.id} className="glass-card hover:border-primary/30 transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight">{op.title}</CardTitle>
                    <Badge className={`shrink-0 text-[10px] uppercase ${typeColor[op.opportunity_type] ?? ""}`}>
                      {op.opportunity_type?.replace("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-muted-foreground text-sm line-clamp-2">{op.description}</p>

                  {(op.required_skills ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(op.required_skills as string[]).slice(0, 4).map((s) => (
                        <Badge key={s} variant="secondary" className="text-[11px]">{s}</Badge>
                      ))}
                      {op.required_skills.length > 4 && (
                        <Badge variant="secondary" className="text-[11px]">
                          +{op.required_skills.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {op.location_type ?? "remote"}
                    </span>
                    {op.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {op.duration}
                      </span>
                    )}
                    <span className="ml-auto font-medium text-foreground">
                      {op.currency} {op.budget_min ?? 0}
                      {op.budget_max ? ` – ${op.budget_max}` : "+"}
                    </span>
                  </div>

                  {/* FIX: was <a href=...> causing full page reload. Now uses <Link> */}
                  <Button asChild className="w-full mt-1">
                    <Link to={`/opportunities/${op.id}`}>View & Apply</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default OpportunitiesBoardPage;
