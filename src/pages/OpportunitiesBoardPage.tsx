import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, BookmarkCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebounce";

const OpportunitiesBoardPage = () => {
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const debouncedSearch = useDebouncedValue(search, 350);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["opportunities-board", debouncedSearch],
    queryFn: async () => {
      const q = supabase.from("marketplace_opportunities" as any).select("*").eq("status", "open").order("created_at", { ascending: false }).limit(50);
      const { data, error } = debouncedSearch ? await q.or(`title.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`) : await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: savedRows = [] } = useQuery({
    queryKey: ["saved-opportunities", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("marketplace_saved_opportunities" as any).select("opportunity_id").eq("student_user_id", user!.id).limit(250);
      if (error) {
        if (/Could not find the table/.test(error.message)) return [];
        throw error;
      }
      return data ?? [];
    },
  });
  const savedIds = useMemo(() => new Set(savedRows.map((r: any) => r.opportunity_id)), [savedRows]);
  const toggleSave = useMutation({
    mutationFn: async ({ opportunityId, saved }: { opportunityId: string; saved: boolean }) => {
      if (!user) throw new Error("Sign in to save opportunities");
      if (saved) {
        const { error } = await supabase.from("marketplace_saved_opportunities" as any).delete().eq("student_user_id", user.id).eq("opportunity_id", opportunityId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("marketplace_saved_opportunities" as any).insert({ student_user_id: user.id, opportunity_id: opportunityId });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["saved-opportunities", user?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Unable to update saved opportunities"),
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
                <div className="flex items-center gap-2">
                  <Button asChild><a href={`/opportunities/${op.id}`}>View & Apply</a></Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!user || toggleSave.isPending}
                    onClick={() => toggleSave.mutate({ opportunityId: op.id, saved: savedIds.has(op.id) })}
                  >
                    {savedIds.has(op.id) ? <BookmarkCheck className="w-4 h-4 mr-1" /> : <Bookmark className="w-4 h-4 mr-1" />}
                    {savedIds.has(op.id) ? "Saved" : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  </main>
};

export default OpportunitiesBoardPage;
