import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Briefcase, CheckCircle, XCircle, Trash2 } from "lucide-react";

const statusColor = (status: string) => {
  if (status === "verified") return "bg-success/10 text-success border-success/20";
  if (status === "rejected") return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-accent/10 text-accent border-accent/20";
};

const AdminEmployersPage = () => {
  const queryClient = useQueryClient();

  const { data: employers = [] } = useQuery({
    queryKey: ["admin-employers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_employer_profiles" as any)
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, verification_status }: { id: string; verification_status: string }) => {
      const { error } = await supabase
        .from("marketplace_employer_profiles" as any)
        .update({ verification_status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-employers"] });
      toast.success("Employer status updated.");
    },
    onError: (error: any) => toast.error(error.message || "Could not update employer status."),
  });

  const deleteEmployer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketplace_employer_profiles" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-employers"] });
      toast.success("Employer profile deleted.");
    },
    onError: (error: any) => toast.error(error.message || "Could not delete employer."),
  });

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-1">Employers</h1>
            <p className="text-muted-foreground">Review company verification requests and manage employer approvals.</p>
          </div>

          {employers.length === 0 ? (
            <div className="glass-card p-10 text-center text-muted-foreground">No employers have registered yet.</div>
          ) : (
            <div className="space-y-4">
              {employers.map((employer: any) => (
                <div key={employer.id} className="glass-card p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <Briefcase className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold truncate">{employer.company_name || "Company"}</h2>
                        <Badge className={statusColor(employer.verification_status)}>{employer.verification_status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">Contact: {employer.contact_email || "—"}</p>
                      {employer.website && (
                        <p className="text-sm text-muted-foreground">Website: {employer.website}</p>
                      )}
                      {employer.about && (
                        <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{employer.about}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus.mutate({ id: employer.id, verification_status: "verified" })}
                        disabled={employer.verification_status === "verified"}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus.mutate({ id: employer.id, verification_status: "rejected" })}
                        disabled={employer.verification_status === "rejected"}
                        className="text-destructive border-destructive/30"
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Delete this employer profile? This cannot be undone.")) {
                            deleteEmployer.mutate(employer.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground">Created {new Date(employer.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminEmployersPage;
