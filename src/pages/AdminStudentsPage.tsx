import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Ban, Star, CheckCircle, XCircle } from "lucide-react";

const statusColor = (profile: any) => {
  if (profile.is_banned) return "bg-destructive/10 text-destructive border-destructive/20";
  if (profile.is_premium) return "bg-primary/10 text-primary border-primary/20";
  if (profile.subscription_status === "paid") return "bg-success/10 text-success border-success/20";
  return "bg-accent/10 text-accent border-accent/20";
};

const AdminStudentsPage = () => {
  const queryClient = useQueryClient();

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

  const { data: studentProfiles = [] } = useQuery({
    queryKey: ["admin-marketplace-students"],
    queryFn: async () => {
      const { data } = await supabase.from("marketplace_student_profiles").select("user_id, featured");
      return data ?? [];
    },
  });

  const banMutation = useMutation({
    mutationFn: async ({ id, is_banned }: { id: string; is_banned: boolean }) => {
      const { error } = await (supabase.from("profiles") as any).update({ is_banned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-profiles"] });
      toast.success("User status updated.");
    },
    onError: (error: any) => toast.error(error.message || "Could not update user status."),
  });

  const featureMutation = useMutation({
    mutationFn: async ({ user_id, featured }: { user_id: string; featured: boolean }) => {
      const { error } = await supabase.from("marketplace_student_profiles").update({ featured }).eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-marketplace-students"] });
      toast.success("Student featured status updated.");
    },
    onError: (error: any) => toast.error(error.message || "Could not update student feature status."),
  });

  const studentProfileMap = useMemo(
    () => new Map((studentProfiles as any[]).map((item: any) => [item.user_id, item])),
    [studentProfiles],
  );

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
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
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Featured</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {profiles.map((p: any) => {
                    const trialDays = Math.max(0, 7 - Math.floor((Date.now() - new Date(p.trial_start_date).getTime()) / (1000 * 60 * 60 * 24)));
                    const userPurchases = purchases.filter((pu: any) => pu.user_id === p.user_id).length;
                    const userCompletions = completions.filter((c: any) => c.user_id === p.user_id).length;
                    const marketplaceProfile = studentProfileMap.get(p.user_id);
                    return (
                      <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="p-4 text-sm font-medium">{p.full_name || "—"}</td>
                        <td className="p-4">
                          <Badge className={statusColor(p)}>
                            {p.is_banned ? "Banned" : p.is_premium ? "Premium" : p.subscription_status === "paid" ? "Paid" : trialDays > 0 ? `Trial (${trialDays}d)` : "Expired"}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm">{userPurchases}</td>
                        <td className="p-4 text-sm">{userCompletions}</td>
                        <td className="p-4 text-sm">
                          {marketplaceProfile ? (
                            <Badge className={marketplaceProfile.featured ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/10 text-muted-foreground border-border"}>
                              {marketplaceProfile.featured ? "Featured" : "Standard"}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">No marketplace profile</span>
                          )}
                        </td>
                        <td className="p-4 text-sm">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={p.is_banned ? "outline" : "destructive"}
                              onClick={() => banMutation.mutate({ id: p.id, is_banned: !p.is_banned })}
                            >
                              <Ban className="w-4 h-4 mr-1" /> {p.is_banned ? "Unban" : "Ban"}
                            </Button>
                            {marketplaceProfile && (
                              <Button
                                size="sm"
                                variant={marketplaceProfile.featured ? "outline" : "hero"}
                                onClick={() => featureMutation.mutate({ user_id: p.user_id, featured: !marketplaceProfile.featured })}
                              >
                                <Star className="w-4 h-4 mr-1" /> {marketplaceProfile.featured ? "Unfeature" : "Feature"}
                              </Button>
                            )}
                          </div>
                        </td>
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
