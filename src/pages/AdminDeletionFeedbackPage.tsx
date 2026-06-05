import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CalendarDays, Mail, UserX } from "lucide-react";

type DeletionFeedback = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  reason: string;
  created_at: string;
};

const formatDate = (date: string) =>
  new Date(date).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const AdminDeletionFeedbackPage = () => {
  const { data: feedbackList = [], isLoading } = useQuery({
    queryKey: ["admin-account-deletion-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_deletion_feedback")
        .select("id, user_id, email, full_name, reason, created_at")
        .order("created_at", { ascending: false }).limit(100);

      if (error) throw error;
      return data satisfies DeletionFeedback[];
    },
  });

  const totalFeedback = feedbackList.length;
  const thisMonthCount = feedbackList.filter((feedback) => {
    const feedbackDate = new Date(feedback.created_at);
    const now = new Date();
    return feedbackDate.getFullYear() === now.getFullYear() && feedbackDate.getMonth() === now.getMonth();
  }).length;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <UserX className="w-7 h-7 text-destructive" /> Account Deletion Feedback
              </h1>
              <p className="text-muted-foreground mt-1">
                Review the reasons students and visitors gave before permanently deleting their accounts.
              </p>
            </div>
            <Badge className="bg-destructive/10 text-destructive border-destructive/20">
              {totalFeedback} total responses
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card className="glass-card">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <UserX className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">All deletion reasons</p>
                  <p className="text-2xl font-bold">{totalFeedback}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Submitted this month</p>
                  <p className="text-2xl font-bold">{thisMonthCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <div className="glass-card p-10 text-center text-muted-foreground">Loading account deletion feedback...</div>
          ) : feedbackList.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">No account deletion feedback yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                When users delete their accounts and leave a reason, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbackList.map((feedback) => (
                <article key={feedback.id} className="glass-card p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <p className="font-semibold text-sm">{feedback.full_name || "Deleted user"}</p>
                        {feedback.email && (
                          <a href={`mailto:${feedback.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {feedback.email}
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground break-all">User ID: {feedback.user_id}</p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{formatDate(feedback.created_at)}</p>
                  </div>

                  <div className="mt-4 rounded-xl border border-border/60 bg-secondary/30 p-4">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{feedback.reason}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDeletionFeedbackPage;
