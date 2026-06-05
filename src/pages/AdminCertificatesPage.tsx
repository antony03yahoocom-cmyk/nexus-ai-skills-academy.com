import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Trash2 } from "lucide-react";

const AdminCertificatesPage = () => {
  const queryClient = useQueryClient();

  const { data: certificates = [] } = useQuery({
    queryKey: ["admin-certificates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("*, courses(title)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-cert-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const getStudentName = (studentId: string) => {
    return profiles.find((p: any) => p.user_id === studentId)?.full_name || "Student";
  };

  const revokeCert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("certificates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-certificates"] });
      toast.success("Certificate revoked!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-1">Certificates Management</h1>
          <p className="text-muted-foreground mb-8">{certificates.length} total certificates</p>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Student</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Course</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Issued</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {certificates.map((cert: any) => (
                    <tr key={cert.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="p-4 text-sm font-medium">{getStudentName(cert.student_id)}</td>
                      <td className="p-4 text-sm">{(cert as any).courses?.title ?? "—"}</td>
                      <td className="p-4">
                        <Badge className={cert.status === "Issued" ? "bg-success/10 text-success border-success/20" : "bg-accent/10 text-accent border-accent/20"}>
                          {cert.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{cert.issued_date ? new Date(cert.issued_date).toLocaleDateString() : "—"}</td>
                      <td className="p-4">
                        <Button size="icon" variant="ghost" onClick={() => revokeCert.mutate(cert.id)} title="Revoke">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminCertificatesPage;
