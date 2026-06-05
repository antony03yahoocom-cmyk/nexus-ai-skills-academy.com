import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageCircle, Plus, Users, LogIn, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const DiscussionGroupsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["discussion-groups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("discussion_groups")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: myMemberships = [] } = useQuery({
    queryKey: ["my-group-memberships", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id, role")
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: memberCounts = {} } = useQuery({
    queryKey: ["group-member-counts"],
    queryFn: async () => {
      // Get counts for all groups the user can see
      const groupIds = groups.map((g: any) => g.id);
      if (groupIds.length === 0) return {};
      const { data } = await supabase
        .from("group_members")
        .select("group_id");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((m: any) => {
        counts[m.group_id] = (counts[m.group_id] || 0) + 1;
      });
      return counts;
    },
    enabled: groups.length > 0,
  });

  const createGroup = useMutation({
    mutationFn: async () => {
      // Create group
      const { data: group, error } = await supabase
        .from("discussion_groups")
        .insert({ name, description: description || null, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      // Add creator as admin member
      await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: user!.id,
        role: "admin",
      });
      return group;
    },
    onSuccess: () => {
      toast.success("Group created!");
      setCreateOpen(false);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["discussion-groups"] });
      queryClient.invalidateQueries({ queryKey: ["my-group-memberships"] });
    },
    onError: () => toast.error("Failed to create group"),
  });

  const joinGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase
        .from("group_members")
        .insert({ group_id: groupId, user_id: user!.id, role: "member" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Joined group!");
      queryClient.invalidateQueries({ queryKey: ["my-group-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["group-member-counts"] });
    },
    onError: () => toast.error("Failed to join group"),
  });

  const isMember = (groupId: string) => myMemberships.some((m: any) => m.group_id === groupId);
  const isGroupAdmin = (groupId: string) => myMemberships.some((m: any) => m.group_id === groupId && m.role === "admin");

  return (
    <div className="min-h-screen bg-background">
      <DashboardTopNav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Discussion Groups</h1>
            <p className="text-muted-foreground text-sm mt-1">Join or create groups to discuss topics with fellow students.</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm">
                <Plus className="w-4 h-4 mr-2" /> Create Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Discussion Group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <Input placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} />
                <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                <Button onClick={() => createGroup.mutate()} disabled={!name.trim() || createGroup.isPending} className="w-full">
                  {createGroup.isPending ? "Creating..." : "Create Group"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No discussion groups yet. Be the first to create one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group: any) => {
              const joined = isMember(group.id);
              const isAdmin = isGroupAdmin(group.id);
              const count = (memberCounts as any)[group.id] || 0;

              return (
                <div key={group.id} className="glass-card p-5 flex flex-col justify-between hover:border-primary/20 transition-all">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg flex-1 truncate">{group.name}</h3>
                      {isAdmin && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]"><Crown className="w-3 h-3 mr-1" />Admin</Badge>}
                      {group.status === "suspended" && <Badge variant="destructive" className="text-[10px]">Suspended</Badge>}
                    </div>
                    {group.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{group.description}</p>}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="w-3.5 h-3.5" /> {count} member{count !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {joined ? (
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link to={`/discussions/${group.id}`}>
                          <MessageCircle className="w-4 h-4 mr-2" /> Open Chat
                        </Link>
                      </Button>
                    ) : group.status === "active" ? (
                      <Button size="sm" onClick={() => joinGroup.mutate(group.id)} disabled={joinGroup.isPending} className="flex-1">
                        <LogIn className="w-4 h-4 mr-2" /> Join Group
                      </Button>
                    ) : (
                      <Button size="sm" disabled className="flex-1">Suspended</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default DiscussionGroupsPage;
