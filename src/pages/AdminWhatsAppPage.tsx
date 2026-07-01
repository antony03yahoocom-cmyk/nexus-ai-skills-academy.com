/**
 * AdminWhatsAppPage.tsx — WhatsApp Business Communications Center
 * Tabs: Overview | Templates | Send | Inbox | Automations | Scheduled | Logs
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  LayoutDashboard, RefreshCw, Send, MessageCircle, Zap, Clock, FileText,
  Search, Filter, CheckCircle, XCircle, AlertCircle, Eye, Users, TrendingUp,
  BarChart3, ChevronRight, Plus, Trash2, Play, Pause, Phone, Check, CheckCheck,
  ArrowLeft, X, Calendar, MessageSquare, Settings, Bell, Globe,
} from "lucide-react";

const WA_ADMIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-admin`;

// ── Types ──────────────────────────────────────────────────────────
type Tab = "overview" | "templates" | "send" | "inbox" | "automations" | "scheduled" | "logs";

type Template = {
  id: string; meta_id: string; name: string; category: string;
  language: string; status: string; header_type: string | null;
  header_text: string | null; body_text: string | null;
  body_variables: string[]; footer_text: string | null;
  buttons: any[]; last_synced_at: string;
};

type Conversation = {
  id: string; phone_number: string; display_name: string | null;
  last_message_text: string | null; last_message_at: string | null;
  unread_count: number; window_expires_at: string | null;
  status: string; student_user_id: string | null;
};

type WaMessage = {
  id: string; direction: "inbound" | "outbound"; message_type: string;
  body: string | null; template_name: string | null; status: string;
  created_at: string; sent_by_user_id: string | null;
};

type Automation = {
  id: string; name: string; event_trigger: string;
  template_id: string | null; template_vars: Record<string, string>;
  delay_minutes: number; enabled: boolean;
  runs_count: number; last_run_at: string | null;
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  sent:      <Check className="w-3 h-3 text-muted-foreground" />,
  delivered: <CheckCheck className="w-3 h-3 text-blue-500" />,
  read:      <CheckCheck className="w-3 h-3 text-primary" />,
  failed:    <XCircle className="w-3 h-3 text-destructive" />,
};

const STATUS_COLOR: Record<string, string> = {
  APPROVED: "bg-success/10 text-success border-success/20",
  PENDING:  "bg-accent/10 text-accent border-accent/20",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/20",
  DISABLED: "bg-muted/20 text-muted-foreground border-muted/30",
};

const TRIGGER_LABELS: Record<string, string> = {
  student_registered:    "Student Registered",
  course_enrolled:       "Course Enrolled",
  payment_success:       "Payment Success",
  payment_failed:        "Payment Failed",
  certificate_generated: "Certificate Generated",
  course_completed:      "Course Completed",
  lesson_completed:      "Lesson Completed",
  assignment_graded:     "Assignment Graded",
  subscription_expiring: "Subscription Expiring",
  new_notification:      "New Notification",
  new_message:           "New Private Message",
  student_inactive:      "Student Inactive (7 days)",
  welcome:               "Welcome Message",
};

function callAdmin(session: any, action: string, body?: object) {
  return fetch(`${WA_ADMIN_URL}?action=${action}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());
}

// ── Analytics card ─────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <div className="glass-card p-5">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold gradient-text">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
const AdminWhatsAppPage = () => {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [sendVars, setSendVars] = useState<Record<string, string>>({});
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<any[]>([]);
  const [bulkMode, setBulkMode] = useState("selected");
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [freeformText, setFreeformText] = useState("");
  const [newAuto, setNewAuto] = useState<Partial<Automation> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sendProgress, setSendProgress] = useState<null | { total: number; sent: number; failed: number }>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Analytics ──────────────────────────────────────────────────
  const { data: analytics } = useQuery({
    queryKey: ["wa-analytics"],
    queryFn: async () => {
      const res = await callAdmin(session, "get_analytics");
      return res.analytics ?? {};
    },
    enabled: !!session,
    refetchInterval: 60_000,
  });

  // ── Templates ──────────────────────────────────────────────────
  const { data: templates = [] } = useQuery({
    queryKey: ["wa-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_templates" as any).select("*").order("name");
      return (data ?? []) as unknown as Template[];
    },
    staleTime: 5 * 60_000,
  });

  const filteredTemplates = templates.filter((t) => {
    const matchSearch = !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()) || (t.body_text ?? "").toLowerCase().includes(templateSearch.toLowerCase());
    const matchFilter = templateFilter === "all" || t.status === templateFilter || t.category === templateFilter;
    return matchSearch && matchFilter;
  });

  // ── Students for recipient picker ─────────────────────────────
  const { data: students = [] } = useQuery({
    queryKey: ["wa-students"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles_public" as any)
        .select("user_id, full_name, avatar_url")
        .limit(200);
      // join whatsapp_number from profiles
      const { data: phones } = await supabase
        .from("profiles")
        .select("user_id, whatsapp_number, whatsapp_opted_in");
      const phoneMap = Object.fromEntries((phones ?? []).map((p: any) => [p.user_id, p]));
      return (data ?? []).map((s: any) => ({
        ...s,
        whatsapp_number: phoneMap[s.user_id]?.whatsapp_number ?? null,
        opted_in: phoneMap[s.user_id]?.whatsapp_opted_in ?? false,
      }));
    },
  });

  const filteredStudents = students.filter((s: any) =>
    !recipientSearch || s.full_name?.toLowerCase().includes(recipientSearch.toLowerCase())
  ).filter((s: any) => s.whatsapp_number);

  // ── Conversations ──────────────────────────────────────────────
  const { data: conversations = [] } = useQuery({
    queryKey: ["wa-conversations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_conversations" as any)
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(100);
      return (data ?? []) as unknown as Conversation[];
    },
    refetchInterval: 15_000,
  });

  // ── Messages for active conversation ──────────────────────────
  const { data: convMessages = [] } = useQuery({
    queryKey: ["wa-messages", activeConv?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_messages" as any)
        .select("*")
        .eq("conversation_id", activeConv!.id)
        .order("created_at", { ascending: true })
        .limit(100);
      return (data ?? []) as unknown as WaMessage[];
    },
    enabled: !!activeConv,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [convMessages]);

  // ── Automations ─────────────────────────────────────────────────
  const { data: automations = [] } = useQuery({
    queryKey: ["wa-automations"],
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_automations" as any).select("*").order("created_at", { ascending: false });
      return (data ?? []) as unknown as Automation[];
    },
  });

  // ── Scheduled ───────────────────────────────────────────────────
  const { data: scheduled = [] } = useQuery({
    queryKey: ["wa-scheduled"],
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_scheduled" as any).select("*, whatsapp_templates(name)").order("scheduled_at");
      return data ?? [];
    },
  });

  // ── Logs ────────────────────────────────────────────────────────
  const { data: logs = [] } = useQuery({
    queryKey: ["wa-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_automation_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  // ── Mutations ────────────────────────────────────────────────────

  const syncTemplates = async () => {
    setSyncing(true);
    try {
      const res = await callAdmin(session, "sync_templates");
      if (res.success) {
        toast.success(`Synced ${res.synced} templates from Meta`);
        qc.invalidateQueries({ queryKey: ["wa-templates"] });
      } else {
        toast.error(res.error ?? "Sync failed");
      }
    } catch (e: any) { toast.error(e.message); }
    setSyncing(false);
  };

  const doSend = async () => {
    if (!selectedTemplate) return;
    let recipients: { user_id?: string; phone: string; name?: string }[] = [];

    if (bulkMode === "selected") {
      recipients = selectedRecipients.map((s) => ({ user_id: s.user_id, phone: s.whatsapp_number, name: s.full_name }));
    } else {
      recipients = students.filter((s: any) => s.whatsapp_number).map((s: any) => ({ user_id: s.user_id, phone: s.whatsapp_number, name: s.full_name }));
    }

    if (!recipients.length) { toast.error("No recipients with WhatsApp numbers"); return; }

    setSendProgress({ total: recipients.length, sent: 0, failed: 0 });
    try {
      const res = await callAdmin(session, "send_template", {
        template_id: selectedTemplate.id,
        recipients,
        vars: sendVars,
      });
      if (res.success) {
        toast.success(`Sent: ${res.sent} ✓  Failed: ${res.failed}`);
        setSendProgress({ total: recipients.length, sent: res.sent, failed: res.failed });
        qc.invalidateQueries({ queryKey: ["wa-conversations"] });
        qc.invalidateQueries({ queryKey: ["wa-analytics"] });
      } else {
        toast.error(res.error ?? "Send failed");
        setSendProgress(null);
      }
    } catch (e: any) { toast.error(e.message); setSendProgress(null); }
  };

  const sendFreeform = async () => {
    if (!activeConv || !freeformText.trim()) return;
    const windowActive = activeConv.window_expires_at && new Date(activeConv.window_expires_at) > new Date();
    if (!windowActive) { toast.error("24-hour window expired — use a template instead"); return; }
    const res = await callAdmin(session, "send_freeform", {
      phone: activeConv.phone_number,
      text: freeformText,
      conversation_id: activeConv.id,
    });
    if (res.success) {
      setFreeformText("");
      qc.invalidateQueries({ queryKey: ["wa-messages", activeConv.id] });
    } else { toast.error(res.error ?? "Send failed"); }
  };

  const toggleAutomation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("whatsapp_automations" as any).update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-automations"] }),
  });

  const saveAutomation = useMutation({
    mutationFn: async (data: Partial<Automation>) => {
      const { error } = await supabase.from("whatsapp_automations" as any).upsert({
        name:          data.name,
        event_trigger: data.event_trigger,
        template_id:   data.template_id ?? null,
        delay_minutes: data.delay_minutes ?? 0,
        enabled:       data.enabled ?? true,
        template_vars: data.template_vars ?? {},
        id:            data.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewAuto(null);
      qc.invalidateQueries({ queryKey: ["wa-automations"] });
      toast.success("Automation saved");
    },
  });

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "overview",    label: "Overview",    icon: LayoutDashboard },
    { id: "templates",   label: "Templates",   icon: FileText },
    { id: "send",        label: "Send",        icon: Send },
    { id: "inbox",       label: "Inbox",       icon: MessageCircle },
    { id: "automations", label: "Automations", icon: Zap },
    { id: "scheduled",   label: "Scheduled",   icon: Clock },
    { id: "logs",        label: "Logs",        icon: BarChart3 },
  ];

  const readRate = analytics?.total_outbound
    ? Math.round((analytics.read / analytics.total_outbound) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardTopNav />
        <main className="flex-1 p-4 md:p-6 overflow-auto">

          {/* ── Page header ───────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-green-500"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">WhatsApp Business</h1>
                <p className="text-sm text-muted-foreground">Communications Center</p>
              </div>
            </div>
            <Button onClick={syncTemplates} disabled={syncing} variant="outline" size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync Templates"}
            </Button>
          </div>

          {/* ── Tabs ──────────────────────────────────────────────── */}
          <div className="flex gap-1 overflow-x-auto pb-1 mb-6 border-b border-border/40">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg border-b-2 -mb-px transition-all ${
                  tab === t.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}>
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════
              OVERVIEW
          ══════════════════════════════════════════════════════════ */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Sent Today"          value={analytics?.sent_today ?? 0}      icon={Send}         color="bg-green-500/10 text-green-500" />
                <StatCard label="Templates Sent"      value={analytics?.templates_sent ?? 0}  icon={FileText}     color="bg-primary/10 text-primary" />
                <StatCard label="Delivered"           value={analytics?.delivered ?? 0}       icon={CheckCheck}   color="bg-blue-500/10 text-blue-500" />
                <StatCard label="Students Contacted"  value={analytics?.students_contacted ?? 0} icon={Users}     color="bg-accent/10 text-accent" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Read Rate"           value={`${readRate}%`}                 icon={Eye}          color="bg-success/10 text-success" />
                <StatCard label="Failed"              value={analytics?.failed ?? 0}         icon={XCircle}      color="bg-destructive/10 text-destructive" />
                <StatCard label="Conversations"       value={analytics?.conversations ?? 0}  icon={MessageCircle} color="bg-muted/30 text-muted-foreground" />
                <StatCard label="Automation Runs"     value={analytics?.automation_runs ?? 0} icon={Zap}         color="bg-accent/10 text-accent" />
              </div>

              <div className="glass-card p-5">
                <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Read Rate</h3>
                <Progress value={readRate} className="h-2 mb-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{analytics?.read ?? 0} read</span>
                  <span>{analytics?.total_outbound ?? 0} sent</span>
                </div>
              </div>

              <div className="glass-card p-5">
                <h3 className="font-semibold mb-3 text-sm">Active Automations</h3>
                {automations.filter(a => a.enabled).length === 0
                  ? <p className="text-sm text-muted-foreground">No active automations. <button onClick={() => setTab("automations")} className="text-primary hover:underline">Set one up →</button></p>
                  : automations.filter(a => a.enabled).map(a => (
                      <div key={a.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <div>
                          <p className="text-sm font-medium">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{TRIGGER_LABELS[a.event_trigger] ?? a.event_trigger} · {a.runs_count} runs</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-xs">Active</span>
                      </div>
                    ))
                }
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TEMPLATES
          ══════════════════════════════════════════════════════════ */}
          {tab === "templates" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search templates…" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} />
                </div>
                <select value={templateFilter} onChange={e => setTemplateFilter(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="all">All</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="UTILITY">Utility</option>
                  <option value="MARKETING">Marketing</option>
                </select>
                <Button onClick={syncTemplates} disabled={syncing} variant="outline" size="sm">
                  <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} /> Sync
                </Button>
              </div>

              {filteredTemplates.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium mb-1">No templates found</p>
                  <p className="text-sm text-muted-foreground">Click "Sync Templates" to pull your approved templates from Meta.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredTemplates.map(t => (
                    <div key={t.id} className="glass-card p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{t.name}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] border ${STATUS_COLOR[t.status] ?? ""}`}>{t.status}</span>
                            <span className="px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground text-[10px]">{t.category}</span>
                            <span className="px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground text-[10px]">{t.language}</span>
                          </div>
                        </div>
                      </div>

                      {t.body_text && (
                        <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/20 rounded-lg p-2">{t.body_text}</p>
                      )}

                      {t.body_variables.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {t.body_variables.map((v, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono">{v}</span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Synced {formatDistanceToNow(new Date(t.last_synced_at))} ago</span>
                      </div>

                      {t.status === "APPROVED" && (
                        <Button size="sm" variant="hero" className="w-full" onClick={() => { setSelectedTemplate(t); setSendVars({}); setTab("send"); }}>
                          <Send className="w-3.5 h-3.5 mr-1" /> Use Template
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              SEND
          ══════════════════════════════════════════════════════════ */}
          {tab === "send" && (
            <div className="max-w-3xl space-y-5">
              {/* Template picker */}
              <div className="glass-card p-5">
                <h3 className="font-semibold mb-3">1. Choose Template</h3>
                {selectedTemplate ? (
                  <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <div>
                      <p className="font-medium text-sm">{selectedTemplate.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedTemplate.body_text}</p>
                    </div>
                    <button onClick={() => setSelectedTemplate(null)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {templates.filter(t => t.status === "APPROVED").map(t => (
                      <button key={t.id} onClick={() => { setSelectedTemplate(t); setSendVars({}); }}
                        className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground">{t.category}</p>
                        </div>
                      </button>
                    ))}
                    {templates.filter(t => t.status === "APPROVED").length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-2">No approved templates. Sync first.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Template variables */}
              {selectedTemplate && selectedTemplate.body_variables.length > 0 && (
                <div className="glass-card p-5">
                  <h3 className="font-semibold mb-3">2. Fill Template Variables</h3>
                  <p className="text-xs text-muted-foreground mb-3">Use <code className="bg-muted px-1 rounded">{"{{student_name}}"}</code> to auto-fill from recipient data.</p>
                  <div className="space-y-3">
                    {selectedTemplate.body_variables.map((v, i) => (
                      <div key={i}>
                        <label className="text-xs text-muted-foreground mb-1 block font-mono">{v}</label>
                        <Input
                          value={sendVars[String(i + 1)] ?? ""}
                          onChange={e => setSendVars(prev => ({ ...prev, [String(i + 1)]: e.target.value }))}
                          placeholder={`Value for ${v}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recipients */}
              {selectedTemplate && (
                <div className="glass-card p-5">
                  <h3 className="font-semibold mb-3">3. Choose Recipients</h3>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {[
                      { value: "selected",   label: "Selected Students" },
                      { value: "all",        label: "All Students with WhatsApp" },
                    ].map(m => (
                      <button key={m.value} onClick={() => setBulkMode(m.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${bulkMode === m.value ? "bg-primary/10 border-primary/40 text-primary font-medium" : "border-border/40 text-muted-foreground hover:border-primary/20"}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {bulkMode === "selected" && (
                    <>
                      <div className="relative mb-3">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Search students with WhatsApp…" value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                        {filteredStudents.map((s: any) => {
                          const isSelected = selectedRecipients.some(r => r.user_id === s.user_id);
                          return (
                            <div key={s.user_id} onClick={() => setSelectedRecipients(prev => isSelected ? prev.filter(r => r.user_id !== s.user_id) : [...prev, s])}
                              className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/30 border border-transparent"}`}>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <Avatar className="w-7 h-7"><AvatarImage src={s.avatar_url} /><AvatarFallback className="text-xs">{s.full_name?.[0]}</AvatarFallback></Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{s.full_name}</p>
                                <p className="text-xs text-muted-foreground">{s.whatsapp_number}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {selectedRecipients.length > 0 && (
                        <p className="text-xs text-primary font-medium">{selectedRecipients.length} recipient{selectedRecipients.length > 1 ? "s" : ""} selected</p>
                      )}
                    </>
                  )}

                  {bulkMode === "all" && (
                    <p className="text-sm text-muted-foreground">{students.filter((s: any) => s.whatsapp_number).length} students with WhatsApp numbers will receive this message.</p>
                  )}
                </div>
              )}

              {/* Send button + progress */}
              {selectedTemplate && (
                <div className="glass-card p-5">
                  {sendProgress ? (
                    <div className="space-y-3">
                      <p className="font-semibold text-sm">Sending…</p>
                      <Progress value={(sendProgress.sent + sendProgress.failed) / sendProgress.total * 100} className="h-2" />
                      <div className="flex gap-4 text-xs">
                        <span className="text-success">✓ {sendProgress.sent} sent</span>
                        <span className="text-destructive">✗ {sendProgress.failed} failed</span>
                        <span className="text-muted-foreground">of {sendProgress.total}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setSendProgress(null)}>Reset</Button>
                    </div>
                  ) : (
                    <Button variant="hero" className="w-full" onClick={doSend}
                      disabled={bulkMode === "selected" && !selectedRecipients.length}>
                      <Send className="w-4 h-4 mr-2" />
                      Send {bulkMode === "all" ? "to All Students" : `to ${selectedRecipients.length} Student${selectedRecipients.length !== 1 ? "s" : ""}`}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              INBOX
          ══════════════════════════════════════════════════════════ */}
          {tab === "inbox" && (
            <div className="flex gap-4 h-[calc(100vh-16rem)]">
              {/* Conversation list */}
              <div className="w-80 shrink-0 glass-card overflow-y-auto">
                <div className="p-3 border-b border-border/40">
                  <p className="font-semibold text-sm">Conversations <span className="text-muted-foreground font-normal">({conversations.length})</span></p>
                </div>
                {conversations.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No conversations yet</div>
                ) : (
                  conversations.map(conv => (
                    <button key={conv.id} onClick={() => { setActiveConv(conv); setFreeformText(""); }}
                      className={`w-full flex items-start gap-3 p-3 border-b border-border/20 hover:bg-muted/30 transition-colors text-left ${activeConv?.id === conv.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
                      <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 text-green-600 font-semibold text-sm">
                        {(conv.display_name ?? conv.phone_number)?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{conv.display_name ?? conv.phone_number}</p>
                          {conv.unread_count > 0 && (
                            <span className="w-4 h-4 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">{conv.unread_count}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{conv.last_message_text ?? "No messages"}</p>
                        {conv.last_message_at && <p className="text-[10px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(conv.last_message_at))} ago</p>}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Message thread */}
              {activeConv ? (
                <div className="flex-1 glass-card flex flex-col overflow-hidden">
                  {/* Header */}
                  <div className="p-4 border-b border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 font-semibold text-sm">
                        {(activeConv.display_name ?? activeConv.phone_number)?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{activeConv.display_name ?? activeConv.phone_number}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {activeConv.phone_number}
                          {activeConv.window_expires_at && new Date(activeConv.window_expires_at) > new Date()
                            ? <span className="text-success ml-2">● Window active</span>
                            : <span className="text-destructive ml-2">● Window closed</span>
                          }
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setActiveConv(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>

                  {/* Messages */}
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {convMessages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${msg.direction === "outbound" ? "bg-green-600 text-white rounded-br-sm" : "bg-muted/70 border border-border/40 rounded-bl-sm"}`}>
                          {msg.template_name && <p className="text-[10px] opacity-70 mb-1 font-mono">Template: {msg.template_name}</p>}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body ?? `[${msg.message_type}]`}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] opacity-60">{format(new Date(msg.created_at), "HH:mm")}</span>
                            {msg.direction === "outbound" && STATUS_ICON[msg.status]}
                          </div>
                        </div>
                      </div>
                    ))}
                    {convMessages.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No messages yet</p>}
                  </div>

                  {/* Reply area */}
                  <div className="p-3 border-t border-border/40">
                    {activeConv.window_expires_at && new Date(activeConv.window_expires_at) > new Date() ? (
                      <div className="flex gap-2">
                        <Textarea className="resize-none min-h-[40px] text-sm" rows={1} value={freeformText}
                          onChange={e => setFreeformText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFreeform(); }}}
                          placeholder="Type a reply… (Enter to send)" />
                        <Button size="icon" onClick={sendFreeform} disabled={!freeformText.trim()} className="h-10 w-10 shrink-0 bg-green-600 hover:bg-green-700">
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-2">24-hour window expired — use a template</p>
                        <Button size="sm" variant="outline" onClick={() => setTab("send")}>
                          <FileText className="w-4 h-4 mr-1" /> Send Template
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 glass-card flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Select a conversation</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              AUTOMATIONS
          ══════════════════════════════════════════════════════════ */}
          {tab === "automations" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Automation Engine</h2>
                <Button variant="hero" size="sm" onClick={() => setNewAuto({ name: "", event_trigger: "student_registered", enabled: true, delay_minutes: 0, template_vars: {} })}>
                  <Plus className="w-4 h-4 mr-1" /> New Automation
                </Button>
              </div>

              {/* New automation form */}
              {newAuto && (
                <div className="glass-card p-5 border-primary/20 space-y-4">
                  <h3 className="font-semibold text-sm">New Automation</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                      <Input value={newAuto.name ?? ""} onChange={e => setNewAuto(p => ({ ...p!, name: e.target.value }))} placeholder="e.g. Welcome new students" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Trigger Event</label>
                      <select value={newAuto.event_trigger ?? ""} onChange={e => setNewAuto(p => ({ ...p!, event_trigger: e.target.value }))}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                        {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Template</label>
                      <select value={newAuto.template_id ?? ""} onChange={e => setNewAuto(p => ({ ...p!, template_id: e.target.value || undefined }))}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">— select template —</option>
                        {templates.filter(t => t.status === "APPROVED").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Delay (minutes)</label>
                      <Input type="number" min={0} value={newAuto.delay_minutes ?? 0} onChange={e => setNewAuto(p => ({ ...p!, delay_minutes: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="hero" size="sm" onClick={() => saveAutomation.mutate(newAuto as any)} disabled={!newAuto.name || !newAuto.event_trigger}>
                      Save Automation
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setNewAuto(null)}>Cancel</Button>
                  </div>
                </div>
              )}

              {automations.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Zap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium mb-1">No automations yet</p>
                  <p className="text-sm text-muted-foreground">Automations send WhatsApp messages automatically when platform events happen.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {automations.map(a => (
                    <div key={a.id} className="glass-card p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm">{a.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${a.enabled ? "bg-success/10 text-success" : "bg-muted/20 text-muted-foreground"}`}>
                            {a.enabled ? "Active" : "Paused"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Trigger: <span className="text-foreground">{TRIGGER_LABELS[a.event_trigger] ?? a.event_trigger}</span>
                          {a.delay_minutes > 0 && ` · After ${a.delay_minutes}min`}
                          {" · "}{a.runs_count} runs
                          {a.last_run_at && ` · Last run ${formatDistanceToNow(new Date(a.last_run_at))} ago`}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => toggleAutomation.mutate({ id: a.id, enabled: !a.enabled })}>
                          {a.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                          await supabase.from("whatsapp_automations" as any).delete().eq("id", a.id);
                          qc.invalidateQueries({ queryKey: ["wa-automations"] });
                        }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              SCHEDULED
          ══════════════════════════════════════════════════════════ */}
          {tab === "scheduled" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Scheduled Messages</h2>
                <Button variant="hero" size="sm" onClick={() => setTab("send")}><Plus className="w-4 h-4 mr-1" /> Schedule New</Button>
              </div>
              {scheduled.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium mb-1">No scheduled messages</p>
                  <p className="text-sm text-muted-foreground">Use the Send tab to schedule a template message.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduled.map((s: any) => (
                    <div key={s.id} className="glass-card p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center"><Calendar className="w-4 h-4 text-accent" /></div>
                        <div>
                          <p className="font-medium text-sm">{s.whatsapp_templates?.name ?? "Template"}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(s.scheduled_at), "d MMM yyyy, HH:mm")} · {s.schedule_type} · {Array.isArray(s.recipients) ? s.recipients.length : 0} recipients</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${s.status === "queued" ? "bg-accent/10 text-accent border-accent/20" : s.status === "sent" ? "bg-success/10 text-success border-success/20" : "bg-muted/20 text-muted-foreground border-muted"}`}>{s.status}</span>
                        {s.status === "queued" && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                            await supabase.from("whatsapp_scheduled" as any).update({ status: "cancelled" }).eq("id", s.id);
                            qc.invalidateQueries({ queryKey: ["wa-scheduled"] });
                          }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              LOGS
          ══════════════════════════════════════════════════════════ */}
          {tab === "logs" && (
            <div className="space-y-4">
              <h2 className="font-bold">Automation Logs</h2>
              {logs.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No automation logs yet. Logs appear here when automations fire.</p>
                </div>
              ) : (
                <div className="glass-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/40 bg-muted/20">
                      <tr>
                        {["Trigger", "Phone", "Template", "Status", "Time"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log: any) => (
                        <tr key={log.id} className="border-b border-border/20 hover:bg-muted/10">
                          <td className="px-4 py-3 text-xs">{TRIGGER_LABELS[log.event_trigger] ?? log.event_trigger}</td>
                          <td className="px-4 py-3 text-xs font-mono">{log.phone_number ?? "—"}</td>
                          <td className="px-4 py-3 text-xs">{log.template_name ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${log.status === "sent" ? "bg-success/10 text-success" : log.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted/20 text-muted-foreground"}`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.created_at))} ago</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default AdminWhatsAppPage;
