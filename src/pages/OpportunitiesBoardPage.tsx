import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const OpportunitiesBoardPage = () => {
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["opportunities-board", search],
    queryFn: async () => {
      const q = supabase.from("marketplace_opportunities" as any).select("*").eq("status", "open").order("created_at", { ascending: false }).limit(50);
      const { data, error } = search ? await q.ilike("title", `%${search}%`) : await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const nav = useNavigate();

  return <main className="min-h-screen bg-background p-4 md:p-8 space-y-6">
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold">Opportunities Hub</h1>
      </div>
      <Input placeholder="Search jobs, gigs, internships..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {isLoading ? <p>Loading opportunities...</p> : (
        <div className="grid gap-4">
          {data.length === 0 ? <Card><CardContent className="p-6">No opportunities yet.</CardContent></Card> : data.map((op: any) => (
            <Card key={op.id}>
              <CardHeader><CardTitle className="text-xl">{op.title}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-muted-foreground line-clamp-2">{op.description}</p>
                <div className="flex flex-wrap gap-2">{(op.required_skills || []).map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
                <div className="text-sm">Budget: {op.currency} {op.budget_min ?? 0} - {op.budget_max ?? 0}</div>
                <Button asChild><a href={`/opportunities/${op.id}`}>View & Apply</a></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  </main>
};

export default OpportunitiesBoardPage;
