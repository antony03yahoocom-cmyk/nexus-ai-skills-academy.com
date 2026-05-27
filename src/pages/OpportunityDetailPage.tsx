import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck } from "lucide-react";

export default function OpportunityDetailPage() {
  const { opportunityId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [proposal, setProposal] = useState("");

  const { data: op } = useQuery({
    queryKey: ["opportunity", opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketplace_opportunities" as any).select("*").eq("id", opportunityId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!opportunityId,
  });

  const { data: myApplication } = useQuery({
    queryKey: ["my-application", opportunityId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("marketplace_applications" as any).select("*").eq("opportunity_id", opportunityId).eq("student_user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user && !!opportunityId,
  });
  const { data: isSaved = false } = useQuery({
    queryKey: ["opportunity-saved", opportunityId, user?.id],
    enabled: !!user && !!opportunityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_saved_opportunities" as any)
        .select("id")
        .eq("student_user_id", user!.id)
        .eq("opportunity_id", opportunityId)
        .maybeSingle();
      if (error) {
        if (/Could not find the table/.test(error.message)) return false;
        throw error;
      }
      return !!data;
    },
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !opportunityId) throw new Error("Sign in required");
      if (isSaved) {
        const { error } = await supabase.from("marketplace_saved_opportunities" as any).delete().eq("student_user_id", user.id).eq("opportunity_id", opportunityId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("marketplace_saved_opportunities" as any).insert({ student_user_id: user.id, opportunity_id: opportunityId });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["opportunity-saved", opportunityId, user?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Unable to update save status"),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("marketplace_applications" as any).insert({ opportunity_id: opportunityId, student_user_id: user!.id, proposal });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Application submitted");
      await qc.invalidateQueries({ queryKey: ["my-application", opportunityId, user?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to apply"),
  });

  if (!op) return <div className="p-8">Loading...</div>;

  return <main className="min-h-screen bg-background p-4 md:p-8">
    <div className="max-w-3xl mx-auto space-y-4">
      <Card><CardHeader><CardTitle>{op.title}</CardTitle></CardHeader><CardContent className="space-y-3">
        <p>{op.description}</p>
        <p className="text-sm text-muted-foreground">{op.opportunity_type} • {op.location_type} • {op.experience_level}</p>
        <Button variant="outline" disabled={!user || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {isSaved ? <BookmarkCheck className="w-4 h-4 mr-2" /> : <Bookmark className="w-4 h-4 mr-2" />}
          {isSaved ? "Saved opportunity" : "Save opportunity"}
        </Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Apply</CardTitle></CardHeader><CardContent className="space-y-3">
        {myApplication ? <p>Your status: <strong>{myApplication.status}</strong></p> : <>
          <Textarea value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder="Cover message and proposal" />
          <Button disabled={!user || proposal.length < 20 || applyMutation.isPending} onClick={() => applyMutation.mutate()}>Submit Application</Button>
        </>}
      </CardContent></Card>
    </div>
  </main>;
}
