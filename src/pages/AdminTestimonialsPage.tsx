import { useState } from "react";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Star, Eye, EyeOff } from "lucide-react";

const AdminTestimonialsPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", content: "", rating: 5 });

  const { data: testimonials = [] } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: async () => {
      const { data } = await supabase.from("testimonials" as any).select("*").order("created_at", { ascending: false }).limit(100);
      return (data ?? []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("testimonials" as any).insert({
        name: form.name,
        role: form.role || null,
        content: form.content,
        rating: form.rating,
        is_published: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
      queryClient.invalidateQueries({ queryKey: ["public-testimonials"] });
      toast.success("Testimonial added!");
      setShowForm(false);
      setForm({ name: "", role: "", content: "", rating: 5 });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("testimonials" as any).update({ is_published: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
      queryClient.invalidateQueries({ queryKey: ["public-testimonials"] });
      toast.success("Updated!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("testimonials" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
      queryClient.invalidateQueries({ queryKey: ["public-testimonials"] });
      toast.success("Deleted!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Testimonials</h1>
              <p className="text-muted-foreground">Manage student success stories shown on the homepage.</p>
            </div>
            <Button variant="hero" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Testimonial
            </Button>
          </div>

          {showForm && (
            <div className="glass-card p-6 mb-8">
              <h3 className="font-semibold mb-4">New Testimonial</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Student Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Wanjiku Muthoni" className="bg-secondary border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Role / Company</Label>
                  <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="AI Engineer at Safaricom" className="bg-secondary border-border" />
                </div>
              </div>
              <div className="space-y-1.5 mb-4">
                <Label className="text-xs">Testimonial Text *</Label>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write the student's testimonial here..." className="bg-secondary border-border" rows={4} />
              </div>
              <div className="space-y-1.5 mb-6">
                <Label className="text-xs">Rating (1-5)</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button key={r} type="button" onClick={() => setForm({ ...form, rating: r })}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${form.rating >= r ? "text-primary bg-primary/10" : "text-muted-foreground bg-secondary"}`}>
                      <Star className="w-4 h-4" fill={form.rating >= r ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="hero" onClick={() => create.mutate()} disabled={!form.name || !form.content || create.isPending}>
                  {create.isPending ? "Adding..." : "Add Testimonial"}
                </Button>
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {testimonials.map((t: any) => (
              <div key={t.id} className={`glass-card p-5 ${!t.is_published ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                      <Badge className={t.is_published ? "bg-success/10 text-success border-success/20 text-[10px]" : "bg-secondary text-muted-foreground text-[10px]"}>
                        {t.is_published ? "Published" : "Hidden"}
                      </Badge>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: t.rating ?? 5 }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">"{t.content}"</p>
                    <p className="text-xs text-muted-foreground mt-2">{new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8"
                      onClick={() => togglePublish.mutate({ id: t.id, value: !t.is_published })}>
                      {t.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove.mutate(t.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {testimonials.length === 0 && (
              <div className="glass-card p-10 text-center">
                <Star className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No testimonials yet. Add your first one above.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminTestimonialsPage;
