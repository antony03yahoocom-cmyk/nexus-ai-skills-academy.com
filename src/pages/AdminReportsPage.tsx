import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, Trash2 } from "lucide-react";

const statusColor = (status: string) => {
  if (status === "reviewed") return "bg-success/10 text-success border-success/20";
  if (status === "dismissed") return "bg-muted/10 text-muted-foreground border-border";
  return "bg-accent/10 text-accent border-accent/20";
};

const AdminReportsPage = () => {
  const queryClient = useQueryClient();

  const { data: reports = [] } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("content_reports")
        .select("*")
        .order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const { data: reporters = [] } = useQuery({
    queryKey: ["admin-reporters"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name").limit(500);
      return data ?? [];
    },
  });

  const updateReport = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from("content_reports" as any) as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast.success("Report updated.");
    },
    onError: (error: any) => toast.error(error.message || "Could not update report."),
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("content_reports" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast.success("Report deleted.");
    },
    onError: (error: any) => toast.error(error.message || "Could not delete report."),
  });

  const reporterMap = new Map((reporters as any[]).map((profile: any) => [profile.user_id, profile.full_name]));

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-1">Content Reports</h1>
            <p className="text-muted-foreground">Track report activity, review flagged content, and resolve issues.</p>
          </div>

          {reports.length === 0 ? (
            <div className="glass-card p-10 text-center text-muted-foreground">No reports have been submitted yet.</div>
          ) : (
            <div className="space-y-4">
              {reports.map((report: any) => (
                <div key={report.id} className="glass-card p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        <h2 className="text-lg font-semibold truncate">{report.target_type || "Content report"}</h2>
                        <Badge className={statusColor(report.status)}>{report.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">Reporter: {reporterMap.get(report.reporter_id) || report.reporter_id}</p>
                      <p className="text-sm text-muted-foreground">Target ID: {report.target_id}</p>
                      {report.details && <p className="mt-3 text-sm text-muted-foreground">{report.details}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateReport.mutate({ id: report.id, status: "reviewed" })}
                        disabled={report.status === "reviewed"}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Mark reviewed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateReport.mutate({ id: report.id, status: "dismissed" })}
                        disabled={report.status === "dismissed"}
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Delete this report?")) {
                            deleteReport.mutate(report.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">Submitted {new Date(report.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminReportsPage;
