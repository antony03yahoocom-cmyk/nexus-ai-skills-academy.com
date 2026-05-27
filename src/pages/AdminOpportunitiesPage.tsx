import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FolderOpen, Star, Trash2, CheckCircle, XCircle } from "lucide-react";

const statusColor = (status: string) => {
  if (status === "open") return "bg-success/10 text-success border-success/20";
  if (status === "closed") return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-accent/10 text-accent border-accent/20";
};

const AdminOpportunitiesPage = () => {
  const queryClient = useQueryClient();

  const { data: opportunities = [] } = useQuery({
    queryKey: ["admin-opportunities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_opportunities")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: employers = [] } = useQuery({
    queryKey: ["admin-employers-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_employer_profiles")
        .select("user_id, company_name, verification_status");
      return data ?? [];
    },
  });

  const updateOpportunity = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Record<string, any> }) => {
      const { error } = await supabase.from("marketplace_opportunities").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-opportunities"] });
      toast.success("Opportunity updated.");
    },
    onError: (error: any) => toast.error(error.message || "Could not update opportunity."),
  });

  const deleteOpportunity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketplace_opportunities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-opportunities"] });
      toast.success("Opportunity removed.");
    },
    onError: (error: any) => toast.error(error.message || "Could not delete opportunity."),
  });

  const employerMap = new Map((employers as any[]).map((employer: any) => [employer.user_id, employer]));

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-1">Marketplace Opportunities</h1>
            <p className="text-muted-foreground">Moderate opportunity listings, feature top roles, and remove spam.</p>
          </div>

          {opportunities.length === 0 ? (
            <div className="glass-card p-10 text-center text-muted-foreground">No opportunities found.</div>
          ) : (
            <div className="space-y-4">
              {opportunities.map((opportunity: any) => {
                const employer = employerMap.get(opportunity.employer_user_id) || {};
                return (
                  <div key={opportunity.id} className="glass-card p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <FolderOpen className="w-5 h-5 text-primary" />
                          <h2 className="text-lg font-semibold truncate">{opportunity.title}</h2>
                          <Badge className={statusColor(opportunity.status)}>{opportunity.status}</Badge>
                          {opportunity.featured && (
                            <Badge className="bg-primary/10 text-primary border-primary/20">Featured</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">By: {employer.company_name || "Unknown Employer"}</p>
                        <p className="text-sm text-muted-foreground">Type: {opportunity.opportunity_type || "—"} · Category: {opportunity.category || "—"}</p>
                        <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{opportunity.description || "No description provided."}</p>
                        <div className="mt-3 text-xs text-muted-foreground flex flex-wrap gap-2">
                          <span>{opportunity.applicants_count || 0} applicants</span>
                          <span>{opportunity.currency} {opportunity.budget_min || "—"} - {opportunity.budget_max || "—"}</span>
                          {opportunity.deadline && <span>Deadline {new Date(opportunity.deadline).toLocaleDateString()}</span>}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateOpportunity.mutate({ id: opportunity.id, changes: { status: opportunity.status === "open" ? "closed" : "open" } })}
                        >
                          {opportunity.status === "open" ? <XCircle className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />} 
                          {opportunity.status === "open" ? "Close" : "Reopen"}
                        </Button>
                        <Button
                          size="sm"
                          variant={opportunity.featured ? "outline" : "hero"}
                          onClick={() => updateOpportunity.mutate({ id: opportunity.id, changes: { featured: !opportunity.featured } })}
                        >
                          <Star className="w-4 h-4 mr-1" /> {opportunity.featured ? "Unfeature" : "Feature"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Delete this opportunity listing?")) deleteOpportunity.mutate(opportunity.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">Posted {new Date(opportunity.created_at).toLocaleDateString()}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminOpportunitiesPage;
