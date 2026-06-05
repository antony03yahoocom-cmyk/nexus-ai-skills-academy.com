import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const fmtKES = (n: number) =>
  `KES ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string) => new Date(d).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });

const AdminSubscriptionsPage = () => {
  const [query, setQuery] = useState("");

  const { data: purchases = [] } = useQuery({
    queryKey: ["admin-purchases-detailed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_purchases")
        .select("*, courses(title), profiles!course_purchases_user_id_fkey(full_name)")
        .eq("status", "paid")
        .order("purchased_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return purchases as any[];
    return (purchases as any[]).filter((p) => {
      const name = (p.profiles?.full_name ?? "").toLowerCase();
      const course = (p.courses?.title ?? "").toLowerCase();
      return name.includes(q) || course.includes(q) || (p.user_id ?? "").toLowerCase().includes(q);
    });
  }, [purchases, query]);

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 min-w-0 p-4 md:p-8 pt-20 lg:pt-8 space-y-6">
        <h1 className="text-3xl font-bold">Subscriptions</h1>
        <div className="relative max-w-lg">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student, course, or user id" />
        </div>
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="glass-card p-5">No subscription payments found.</div>
          ) : (
            filtered.map((p: any) => (
              <div key={p.id} className="glass-card p-5 space-y-2">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <p className="font-semibold">{p.profiles?.full_name || "Student"}</p>
                  <Badge>{p.payment_provider || "paystack"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Course: {p.courses?.title || "N/A"}</p>
                <p className="text-sm">Amount: <span className="font-medium">{fmtKES(p.amount || 0)}</span></p>
                <p className="text-xs text-muted-foreground">Paid: {p.purchased_at ? fmtDate(p.purchased_at) : "N/A"}</p>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminSubscriptionsPage;
