import { useState } from "react";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, Newspaper, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  content: string | null;
  category: string;
  read_time: string;
  published_at: string;
  emoji: string;
  external_url: string | null;
  is_published: boolean;
};

const emptyForm = {
  title: "",
  excerpt: "",
  content: "",
  category: "AI Tips",
  read_time: "5 min read",
  emoji: "📝",
  external_url: "",
  is_published: true,
};

const AdminBlogPage = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts" as any)
        .select("id, title, excerpt, content, category, read_time, published_at, emoji, external_url, is_published")
        .order("published_at", { ascending: false });

      if (error) throw error;
      return ((data ?? []) as unknown) as BlogPost[];
    },
  });

  const savePost = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.excerpt.trim()) {
        throw new Error("Title and excerpt are required");
      }

      const payload = {
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        content: form.content.trim() || null,
        category: form.category.trim() || "AI Tips",
        read_time: form.read_time.trim() || "5 min read",
        emoji: form.emoji.trim() || "📝",
        external_url: form.external_url.trim() || null,
        is_published: form.is_published,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from("blog_posts" as any).update(payload).eq("id", editingId);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("blog_posts" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["published-blog-posts"] });
      toast.success(editingId ? "Blog post updated" : "Blog post published");
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_posts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["published-blog-posts"] });
      toast.success("Blog post deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content ?? "",
      category: post.category,
      read_time: post.read_time,
      emoji: post.emoji,
      external_url: post.external_url ?? "",
      is_published: post.is_published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                <Newspaper className="w-7 h-7 text-primary" /> Blog Manager
              </h1>
              <p className="text-muted-foreground mt-1">Create, publish, hide, or delete blog posts shown on the public blog page.</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">{posts.length} posts</Badge>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {editingId ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingId ? "Edit Blog Post" : "Add New Blog Post"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Blog title" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="emoji">Emoji</Label>
                    <Input id="emoji" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="category">Category</Label>
                    <Input id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="readTime">Read Time</Label>
                  <Input id="readTime" value={form.read_time} onChange={(e) => setForm({ ...form, read_time: e.target.value })} placeholder="5 min read" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="externalUrl">External URL (optional)</Label>
                  <Input id="externalUrl" value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} placeholder="https://..." />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt / Summary</Label>
                <Textarea id="excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={3} placeholder="Short summary shown on the blog card" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Full Content / Notes (optional)</Label>
                <Textarea id="content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={7} placeholder="Paste or write the full blog content here for your records" />
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_published} onCheckedChange={(checked) => setForm({ ...form, is_published: checked })} />
                  <span className="text-sm">Published on public blog page</span>
                </div>
                <div className="flex gap-2">
                  {editingId && (
                    <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel Edit</Button>
                  )}
                  <Button onClick={() => savePost.mutate()} disabled={savePost.isPending} variant="hero">
                    <Save className="w-4 h-4 mr-2" /> {savePost.isPending ? "Saving..." : "Save Blog Post"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {isLoading ? (
              <div className="glass-card p-8 text-center text-muted-foreground">Loading blog posts...</div>
            ) : posts.length === 0 ? (
              <div className="glass-card p-8 text-center text-muted-foreground">No manual blog posts yet.</div>
            ) : posts.map((post) => (
              <article key={post.id} className="glass-card p-5 flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-2xl">{post.emoji}</span>
                    <h2 className="font-semibold">{post.title}</h2>
                    <Badge className={post.is_published ? "bg-success/10 text-success border-success/20" : "bg-secondary text-muted-foreground"}>
                      {post.is_published ? "Published" : "Hidden"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3 flex-wrap">
                    <span>{post.category}</span>
                    <span>{post.read_time}</span>
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {new Date(post.published_at).toLocaleDateString()}</span>
                    {post.external_url && <a href={post.external_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">Open <ExternalLink className="w-3 h-3" /></a>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => startEdit(post)}>Edit</Button>
                  <Button variant="ghost" size="icon" onClick={() => deletePost.mutate(post.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminBlogPage;
