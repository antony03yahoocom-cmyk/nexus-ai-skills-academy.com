import { BookOpen, Users, DollarSign, TrendingUp, Award, FolderOpen, FileText, CreditCard } from "lucide-react";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const { data: courses = [] } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => { const { data } = await supabase.from("courses").select("*"); return data ?? []; },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => { const { data } = await supabase.from("profiles").select("*"); return data ?? []; },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin-enrollments"],
    queryFn: async () => { const { data } = await supabase.from("enrollments").select("*"); return data ?? []; },
  });

  // Extended query: join profiles + courses for the subscriptions table
  const { data: purchases = [] } = useQuery({
    queryKey: ["admin-purchases-detailed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_purchases")
        .select("*, courses(title), profiles!course_purchases_user_id_fkey(full_name, email)")
        .eq("status", "paid")
        .order("purchased_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["admin-certs-count"],
    queryFn: async () => { const { data } = await supabase.from("certificates").select("id").eq("status", "Issued" as any); return data ?? []; },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["admin-projects-count"],
    queryFn: async () => { const { data } = await supabase.from("projects").select("id, status"); return data ?? []; },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["admin-submissions-pending"],
    queryFn: async () => { const { data } = await supabase.from("submissions").select("id, status"); return data ?? []; },
  });

  const premiumCount = profiles.filter((p: any) => p.is_premium).length;
  const pendingSubmissions = submissions.filter((s: any) => s.status === "Pending").length;
  const pendingProjects = projects.filter((p: any) => p.status === "Submitted").length;

  const stats = [
    { label: "Total Courses", value: String(courses.length), icon: BookOpen, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Students", value: String(profiles.length), icon: Users, color: "text-accent", bg: "bg-accent/10" },
    { label: "Premium Users", value: String(premiumCount), icon: DollarSign, color: "text-success", bg: "bg-success/10" },
    { label: "Enrollments", value: String(enrollments.length), icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Certificates", value: String(certificates.length), icon: Award, color: "text-accent", bg: "bg-accent/10" },
    { label: "Total Purchases", value: String(purchases.length), icon: CreditCard, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
          <p className="text-muted-foreground mb-8">Overview of your academy.</p>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="glass-card p-5 hover:border-primary/20 transition-all duration-300">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Action items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {pendingSubmissions > 0 && (
              <Link to="/admin/submissions" className="glass-card p-5 border-accent/30 hover:border-accent/50 transition-all flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{pendingSubmissions} Pending Submissions</p>
                  <p className="text-xs text-muted-foreground">Review student assignment submissions</p>
                </div>
              </Link>
            )}
            {pendingProjects > 0 && (
              <Link to="/admin/projects" className="glass-card p-5 border-primary/30 hover:border-primary/50 transition-all flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{pendingProjects} Projects Awaiting Review</p>
                  <p className="text-xs text-muted-foreground">Approve or reject student projects</p>
                </div>
              </Link>
            )}
          </div>

          {/* ── SUBSCRIPTIONS SECTION ── */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Recent Subscriptions</h2>
              <Badge className="bg-success/10 text-success border-success/20">{purchases.length} paid</Badge>
            </div>
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground p-4">Student</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-4">Course Purchased</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-4">Amount (KES)</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-4">Date &amp; Time Paid</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {purchases.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                          No subscriptions yet
                        </td>
                      </tr>
                    ) : (
                      purchases.slice(0, 20).map((p: any) => {
                        const studentName = p.profiles?.full_name || "Unknown Student";
                        const courseName = p.courses?.title || "Unknown Course";
                        const paidAt = p.purchased_at
                          ? new Date(p.purchased_at).toLocaleString("en-KE", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—";
                        const amount = p.amount ? `KES ${Number(p.amount).toLocaleString()}` : "—";
                        return (
                          <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="p-4 text-sm font-medium">{studentName}</td>
                            <td className="p-4 text-sm">{courseName}</td>
                            <td className="p-4 text-sm font-semibold text-success">{amount}</td>
                            <td className="p-4 text-sm text-muted-foreground">{paidAt}</td>
                            <td className="p-4">
                              <Badge className="bg-success/10 text-success border-success/20 text-xs">Paid</Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── RECENT STUDENTS ── */}
          <h2 className="text-xl font-bold mb-4">Recent Students</h2>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Name</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Purchases</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {profiles.slice(0, 10).map((p: any) => {
                    const userPurchases = purchases.filter((pu: any) => pu.user_id === p.user_id).length;
                    return (
                      <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="p-4 text-sm font-medium">{p.full_name || "—"}</td>
                        <td className="p-4">
                          <Badge className={
                            p.is_premium ? "bg-primary/10 text-primary border-primary/20" :
                            p.subscription_status === "paid" ? "bg-success/10 text-success border-success/20" :
                            "bg-accent/10 text-accent border-accent/20"
                          }>
                            {p.is_premium ? "Premium" : p.subscription_status === "paid" ? "Paid" : "Free Trial"}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm">{userPurchases}</td>
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

export default AdminDashboard;
