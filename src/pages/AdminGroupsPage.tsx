import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ban, Trash2, CheckCircle, Users, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const AdminGroupsPage = () => {
  const queryClient = useQueryClient();

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("discussion_groups")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: memberCounts = {} } = useQuery({
    queryKey: ["admin-group-member-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("group_members").select("group_id");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((m: any) => { counts[m.group_id] = (counts[m.group_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: messageCounts = {} } = useQuery({
    queryKey: ["admin-group-message-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("group_messages").select("group_id");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((m: any) => { counts[m.group_id] = (counts[m.group_id] || 0) + 1; });
      return counts;
    },
  });

  const suspendGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("discussion_groups").update({ status: "suspended" as any }).eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Group suspended"); queryClient.invalidateQueries({ queryKey: ["admin-groups"] }); },
    onError: () => toast.error("Failed to suspend group"),
  });

  const reactivateGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("discussion_groups").update({ status: "active" as any }).eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Group reactivated"); queryClient.invalidateQueries({ queryKey: ["admin-groups"] }); },
    onError: () => toast.error("Failed to reactivate group"),
  });

  const deleteGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("discussion_groups").delete().eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Group deleted"); queryClient.invalidateQueries({ queryKey: ["admin-groups"] }); },
    onError: () => toast.error("Failed to delete group"),
  });

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-8">
        <h1 className="text-3xl font-bold mb-2">Discussion Groups</h1>
        <p className="text-muted-foreground text-sm mb-8">Manage student discussion groups. Suspend or delete groups that violate policies.</p>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : groups.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">No groups created yet.</div>
        ) : (
          <div className="space-y-3">
            {groups.map((g: any) => (
              <div key={g.id} className="glass-card p-4 flex items-center justify-between flex-wrap gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{g.name}</h3>
                    <Badge className={g.status === "active" ? "bg-success/10 text-success border-success/20 text-[10px]" : "bg-destructive/10 text-destructive border-destructive/20 text-[10px]"}>
                      {g.status}
                    </Badge>
                  </div>
                  {g.description && <p className="text-xs text-muted-foreground line-clamp-1">{g.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(memberCounts as any)[g.id] || 0} members</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{(messageCounts as any)[g.id] || 0} messages</span>
                    <span>Created {new Date(g.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {g.status === "active" ? (
                    <Button variant="outline" size="sm" onClick={() => suspendGroup.mutate(g.id)} className="text-destructive border-destructive/30">
                      <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => reactivateGroup.mutate(g.id)} className="text-success border-success/30">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Reactivate
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => { if (confirm("Delete this group and all its messages?")) deleteGroup.mutate(g.id); }} className="text-destructive border-destructive/30">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminGroupsPage;
