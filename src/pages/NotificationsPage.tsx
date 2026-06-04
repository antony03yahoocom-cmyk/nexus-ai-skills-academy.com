import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Bell, CheckCircle, XCircle, Megaphone, Mail, Clock, ArrowRight, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

interface NotificationItem {
  id: string;
  type: "approved" | "rejected" | "announcement" | "message" | "opportunity" | "application" | "shortlisted" | "hired" | "profile" | "social";
  title: string;
  body: string;
  time: string;
  link?: string;
  isRead?: boolean;
}

const NotificationsPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openNotif, setOpenNotif] = useState<NotificationItem | null>(null);

  // Submissions that have been reviewed (have feedback or non-pending status)
  const { data: reviewedSubmissions = [] } = useQuery({
    queryKey: ["notif-submissions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select("id, status, feedback, submitted_at, assignment_id, assignments(title, lesson_id)")
        .eq("user_id", user!.id)
        .in("status", ["Approved", "Rejected"])
        .order("submitted_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Recent announcements
  const { data: announcements = [] } = useQuery({
    queryKey: ["notif-announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, content, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Unread private messages count + senders
  const { data: unreadMessages = [] } = useQuery({
    queryKey: ["notif-unread-messages", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("private_messages")
        .select("id, content, created_at, sender_id")
        .eq("receiver_id", user!.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!data || data.length === 0) return [];

      const senderIds = [...new Set(data.map((m: any) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles_public" as any)
        .select("user_id, full_name")
        .in("user_id", senderIds);

      const nameMap: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || "Someone"; });

      return data.map((m: any) => ({ ...m, sender_name: nameMap[m.sender_id] || "Someone" }));
    },
    enabled: !!user,
  });

  const { data: systemNotifications = [] } = useQuery({
    queryKey: ["system-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("id, event_type, title, message, metadata, created_at, is_read")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        if (/Could not find the table/.test(error.message)) return [];
        throw error;
      }
      return data ?? [];
    },
  });

  const notifications: NotificationItem[] = [];
  for (const sub of reviewedSubmissions) {
    const assignment = (sub as any).assignments;
    const lessonId = assignment?.lesson_id;
    notifications.push({
      id: `sub-${sub.id}`,
      type: sub.status === "Approved" ? "approved" : "rejected",
      title: sub.status === "Approved"
        ? `Assignment Approved ✅`
        : `Assignment Needs Revision ❌`,
      body: sub.feedback
        ? sub.feedback
        : sub.status === "Approved"
          ? `Your submission for "${assignment?.title ?? "an assignment"}" has been approved.`
          : `Your submission for "${assignment?.title ?? "an assignment"}" needs revision.`,
      time: sub.submitted_at,
      link: lessonId ? `/lesson/${lessonId}` : undefined,
    });
  }
  for (const n of systemNotifications as any[]) {
    const mappedType: NotificationItem["type"] =
      n.event_type === "new_opportunity" ? "opportunity" :
      n.event_type === "application_update" ? "application" :
      n.event_type === "shortlisted" ? "shortlisted" :
      n.event_type === "hired" ? "hired" :
      n.event_type === "profile_view" ? "profile" :
      n.event_type === "comment" || n.event_type === "like" ? "social" :
      n.event_type === "new_message" ? "message" :
      "announcement";
    notifications.push({
      id: `sys-${n.id}`,
      type: mappedType,
      title: n.title,
      body: n.message ?? "You have a new update.",
      time: n.created_at,
      link: n.metadata?.link ?? undefined,
      isRead: n.is_read,
    });
  }

  for (const msg of unreadMessages) {
    notifications.push({
      id: `msg-${msg.id}`,
      type: "message",
      title: `New message from ${(msg as any).sender_name}`,
      body: msg.content,
      time: msg.created_at,
      link: "/dashboard/messages",
    });
  }

  for (const ann of announcements) {
    notifications.push({
      id: `ann-${ann.id}`,
      type: "announcement",
      title: ann.title,
      body: ann.content,
      time: ann.created_at,
    });
  }

  // Sort all by time descending
  notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const totalUnread = useMemo(
    () => notifications.filter((n) => !n.isRead && n.id.startsWith("sys-")).length + unreadMessages.length,
    [notifications, unreadMessages.length]
  );
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["system-notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const iconFor = (type: NotificationItem["type"]) => {
    if (type === "approved") return <CheckCircle className="w-5 h-5 text-success shrink-0" />;
    if (type === "rejected") return <XCircle className="w-5 h-5 text-destructive shrink-0" />;
    if (type === "announcement") return <Megaphone className="w-5 h-5 text-primary shrink-0" />;
    if (type === "opportunity") return <Bell className="w-5 h-5 text-primary shrink-0" />;
    if (type === "application" || type === "shortlisted") return <CheckCircle className="w-5 h-5 text-success shrink-0" />;
    if (type === "hired") return <CheckCircle className="w-5 h-5 text-success shrink-0" />;
    if (type === "profile" || type === "social") return <Mail className="w-5 h-5 text-accent shrink-0" />;
    return <Mail className="w-5 h-5 text-accent shrink-0" />;
  };

  const bgFor = (type: NotificationItem["type"]) => {
    if (type === "approved") return "bg-success/10 border-success/20";
    if (type === "rejected") return "bg-destructive/10 border-destructive/20";
    if (type === "announcement") return "bg-primary/10 border-primary/20";
    return "bg-accent/10 border-accent/20";
  };

  const badgeFor = (type: NotificationItem["type"]) => {
    if (type === "approved") return "bg-success/10 text-success border-success/20";
    if (type === "rejected") return "bg-destructive/10 text-destructive border-destructive/20";
    if (type === "announcement") return "bg-primary/10 text-primary border-primary/20";
    return "bg-accent/10 text-accent border-accent/20";
  };

  const labelFor = (type: NotificationItem["type"]) => {
    if (type === "approved") return "Approved";
    if (type === "rejected") return "Revision";
    if (type === "announcement") return "Announcement";
    return "Message";
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardTopNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Bell className="w-7 h-7 text-primary" />
              Notifications
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {notifications.length === 0
                ? "You're all caught up."
                : `${notifications.length} update${notifications.length > 1 ? "s" : ""} · ${totalUnread > 0 ? `${totalUnread} unread message${totalUnread > 1 ? "s" : ""}` : "All messages read"}`}
            </p>
          </div>
          {totalUnread > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/messages">
                <Mail className="w-4 h-4 mr-2" />
                Go to Messages
                <ArrowRight className="w-3 h-3 ml-2" />
              </Link>
            </Button>
          )}
        </div>

        {/* Empty state */}
        {notifications.length === 0 && (
          <div className="glass-card p-12 text-center">
            <Inbox className="w-14 h-14 mx-auto text-muted-foreground/40 mb-4" />
            <p className="font-semibold text-muted-foreground mb-1">Nothing here yet</p>
            <p className="text-sm text-muted-foreground">
              When your assignments are reviewed, announcements are posted, or you receive messages, they'll appear here.
            </p>
          </div>
        )}

        {/* Notification list */}
        <div className="space-y-3">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => setOpenNotif(n)}
              className={`w-full text-left glass-card p-4 sm:p-5 border ${bgFor(n.type)} flex items-start gap-4 transition-all hover:brightness-110`}
            >
              <div className="mt-0.5">{iconFor(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-sm">{n.title}</p>
                  <Badge className={`${badgeFor(n.type)} text-[10px] shrink-0`}>{labelFor(n.type)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{n.body}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground/70">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(n.time), { addSuffix: true })}
                  <span className="ml-2 text-primary">· Tap to view →</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <Dialog open={!!openNotif} onOpenChange={(o) => !o && setOpenNotif(null)}>
          <DialogContent className="max-w-lg">
            {openNotif && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-2">
                    {iconFor(openNotif.type)}
                    <Badge className={`${badgeFor(openNotif.type)} text-[10px]`}>{labelFor(openNotif.type)}</Badge>
                  </div>
                  <DialogTitle>{openNotif.title}</DialogTitle>
                  <DialogDescription className="text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(openNotif.time), { addSuffix: true })}
                  </DialogDescription>
                </DialogHeader>
                <div className="text-sm leading-relaxed whitespace-pre-wrap py-2">{openNotif.body}</div>
                {openNotif.link && (
                  <Button asChild variant="hero" className="w-full mt-2">
                    <Link to={openNotif.link} onClick={() => setOpenNotif(null)}>
                      Open <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
};

export default NotificationsPage;
