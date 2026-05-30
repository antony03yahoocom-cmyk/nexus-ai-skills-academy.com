import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Check, Trash2, Mail } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-primary/10 text-primary border-primary/20",
  course: "bg-accent/10 text-accent border-accent/20",
  technical: "bg-destructive/10 text-destructive border-destructive/20",
  suggestion: "bg-success/10 text-success border-success/20",
  pricing: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  other: "bg-secondary text-muted-foreground",
};

const AdminFeedbackPage = () => {
  const queryClient = useQueryClient();

  const { data: feedbackList = [] } = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const { data } = await supabase.from("site_feedback" as any).select("*").order("created_at", { ascending: false }).limit(100);
      return (data ?? []) as any[];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("site_feedback" as any).update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["admin-unread-feedback"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("site_feedback" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["admin-unread-feedback"] });
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unreadCount = feedbackList.filter((f: any) => !f.is_read).length;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <MessageSquare className="w-7 h-7 text-primary" /> Visitor Feedback
              </h1>
              <p className="text-muted-foreground">Suggestions and insights from your visitors.</p>
            </div>
            {unreadCount > 0 && (
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {unreadCount} unread
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            {feedbackList.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No feedback received yet. The form is live on your homepage.</p>
              </div>
            ) : (
              feedbackList.map((f: any) => (
                <div key={f.id} className={`glass-card p-5 transition-all ${!f.is_read ? "border-primary/30 bg-primary/2" : ""}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <p className="font-semibold text-sm">{f.name || "Anonymous"}</p>
                        {f.email && (
                          <a href={`mailto:${f.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Mail className="w-3 h-3" />{f.email}
                          </a>
                        )}
                        <Badge className={`${CATEGORY_COLORS[f.category] || CATEGORY_COLORS.other} text-[10px] capitalize`}>
                          {f.category}
                        </Badge>
                        {!f.is_read && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">New</Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{f.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(f.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!f.is_read && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Mark as read" onClick={() => markRead.mutate(f.id)}>
                          <Check className="w-4 h-4 text-success" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove.mutate(f.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminFeedbackPage;
