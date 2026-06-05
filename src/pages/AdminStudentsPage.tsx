import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminStudentsPage = () => {
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["admin-all-purchases"],
    queryFn: async () => {
      const { data } = await supabase.from("course_purchases").select("user_id, course_id, status, amount").eq("status", "paid");
      return data ?? [];
    },
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["admin-all-completions"],
    queryFn: async () => {
      const { data } = await supabase.from("lesson_completions").select("user_id");
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-1">All Students</h1>
          <p className="text-muted-foreground mb-8">{profiles.length} registered users</p>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Name</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Purchases</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Lessons</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {profiles.map((p: any) => {
                    const trialDays = Math.max(0, 7 - Math.floor((Date.now() - new Date(p.trial_start_date).getTime()) / (1000 * 60 * 60 * 24)));
                    const userPurchases = purchases.filter((pu: any) => pu.user_id === p.user_id).length;
                    const userCompletions = completions.filter((c: any) => c.user_id === p.user_id).length;
                    return (
                      <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="p-4 text-sm font-medium">{p.full_name || "—"}</td>
                        <td className="p-4">
                          <Badge className={
                            p.is_premium ? "bg-primary/10 text-primary border-primary/20" :
                            p.subscription_status === "paid" ? "bg-success/10 text-success border-success/20" :
                            trialDays > 0 ? "bg-accent/10 text-accent border-accent/20" :
                            "bg-destructive/10 text-destructive border-destructive/20"
                          }>
                            {p.is_premium ? "Premium" : p.subscription_status === "paid" ? "Paid" : trialDays > 0 ? `Trial (${trialDays}d)` : "Expired"}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm">{userPurchases}</td>
                        <td className="p-4 text-sm">{userCompletions}</td>
                        <td className="p-4 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminStudentsPage;
