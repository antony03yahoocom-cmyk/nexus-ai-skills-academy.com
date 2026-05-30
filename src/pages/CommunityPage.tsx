import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Cpu, Sparkles, Heart, MessageCircle, ArrowLeft, UserPlus, UserMinus, Trophy, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";

const POST_CATEGORIES = [
  "Design",
  "Website",
  "AI Project",
  "Video",
  "Progress Update",
  "Achievement",
] as const;

const categoryBadgeStyle: Record<string, string> = {
  Design: "bg-pink-100 text-pink-700",
  Website: "bg-sky-100 text-sky-700",
  "AI Project": "bg-violet-100 text-violet-700",
  Video: "bg-orange-100 text-orange-700",
  "Progress Update": "bg-emerald-100 text-emerald-700",
  Achievement: "bg-yellow-100 text-yellow-700",
};

const parseMediaUrls = (value: string) =>
  value
    .split(/[,\n]+/)
    .map((url) => url.trim())
    .filter(Boolean);

const formatMediaLabel = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "") + parsed.pathname;
  } catch {
    return url;
  }
};

const CommunityPage = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"feed" | "trending">("feed");
  const [postTitle, setPostTitle] = useState("");
  const [postCategory, setPostCategory] = useState<typeof POST_CATEGORIES[number]>("Progress Update");
  const [postDescription, setPostDescription] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});

  const { data: profiles = [] } = useQuery({
    queryKey: ["community-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url");
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["community-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_posts")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const postIds = useMemo(() => posts.map((post: any) => post.id), [posts]);
  const authorIds = useMemo(() => [...new Set(posts.map((post: any) => post.user_id))], [posts]);

  const { data: comments = [] } = useQuery({
    queryKey: ["community-comments", postIds.join(",")],
    queryFn: async () => {
      if (!postIds.length) return [];
      const { data } = await supabase
        .from("community_post_comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: postIds.length > 0 && !!user,
  });

  const { data: likes = [] } = useQuery({
    queryKey: ["community-likes", postIds.join(",")],
    queryFn: async () => {
      if (!postIds.length) return [];
      const { data } = await supabase.from("community_post_likes").select("*").in("post_id", postIds);
      return data ?? [];
    },
    enabled: postIds.length > 0 && !!user,
  });

  const { data: myFollows = [] } = useQuery({
    queryKey: ["my-follows", authorIds.join(",")],
    queryFn: async () => {
      if (!user || !authorIds.length) return [];
      const { data } = await supabase
        .from("user_follows")
        .select("*")
        .eq("follower_id", user.id)
        .in("followee_id", authorIds);
      return data ?? [];
    },
    enabled: !!user && authorIds.length > 0,
  });

  const { data: followCounts = [] } = useQuery({
    queryKey: ["follow-counts", authorIds.join(",")],
    queryFn: async () => {
      if (!authorIds.length) return [];
      const { data } = await supabase.from("user_follows").select("*").in("followee_id", authorIds);
      return data ?? [];
    },
    enabled: authorIds.length > 0,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["public-projects-for-community"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, courses(title)")
        .eq("public_visibility", true)
        .eq("status", "Approved" as any)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const projectIds = useMemo(() => projects.map((project: any) => project.id), [projects]);

  const { data: projectLikes = [] } = useQuery({
    queryKey: ["project-likes", projectIds.join(",")],
    queryFn: async () => {
      if (!projectIds.length) return [];
      const { data } = await supabase.from("project_likes").select("*").in("project_id", projectIds);
      return data ?? [];
    },
    enabled: projectIds.length > 0,
  });

  const { data: projectComments = [] } = useQuery({
    queryKey: ["project-comments", projectIds.join(",")],
    queryFn: async () => {
      if (!projectIds.length) return [];
      const { data } = await supabase.from("project_comments").select("*").in("project_id", projectIds).order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: projectIds.length > 0,
  });


  // FIX: Realtime — new posts, likes, comments appear without page refresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("community-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_posts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_post_likes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["community-likes"] });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_post_likes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["community-likes"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_post_comments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["community-comments"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const createPost = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to share a community post.");
      if (!postTitle.trim()) throw new Error("Give your post a title.");
      const urls = parseMediaUrls(mediaUrls);
      const { error } = await supabase.from("community_posts").insert({
        user_id: user.id,
        title: postTitle.trim(),
        description: postDescription.trim(),
        category: postCategory,
        media_urls: urls,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Your post is live in the community feed.");
      setPostTitle("");
      setPostDescription("");
      setMediaUrls("");
      setPostCategory("Progress Update");
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (error: any) => toast.error(error.message || "Unable to post right now."),
  });

  const toggleLikePost = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error("Sign in to like posts.");
      const existing = likes.find((like: any) => like.post_id === postId && like.user_id === user.id);
      if (existing) {
        await supabase.from("community_post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      } else {
        await supabase.from("community_post_likes").insert({ post_id: postId, user_id: user.id });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["community-likes"] }),
    onError: (error: any) => toast.error(error.message || "Unable to update like."),
  });

  const addComment = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!user) throw new Error("Sign in to comment.");
      if (!content.trim()) throw new Error("Enter a comment first.");
      await supabase.from("community_post_comments").insert({ post_id: postId, user_id: user.id, content: content.trim() });
    },
    onSuccess: (_, vars) => {
      setCommentInput((prev) => ({ ...prev, [vars.postId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["community-comments"] });
    },
    onError: (error: any) => toast.error(error.message || "Unable to add comment."),
  });

  const toggleFollow = useMutation({
    mutationFn: async (authorId: string) => {
      if (!user) throw new Error("Sign in to follow creators.");
      const existing = myFollows.find((follow: any) => follow.followee_id === authorId && follow.follower_id === user.id);
      if (existing) {
        await supabase.from("user_follows").delete().eq("followee_id", authorId).eq("follower_id", user.id);
      } else {
        await supabase.from("user_follows").insert({ followee_id: authorId, follower_id: user.id });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-follows"] }),
    onError: (error: any) => toast.error(error.message || "Unable to update follow."),
  });

  const filteredPosts = posts.filter((post: any) => {
    return filterCategory === "all" || post.category === filterCategory;
  });

  const authorFor = (userId: string) => profiles.find((profileItem: any) => profileItem.user_id === userId) || { full_name: "Student", avatar_url: null };

  const likesByPost = (postId: string) => likes.filter((like: any) => like.post_id === postId);
  const commentsByPost = (postId: string) => comments.filter((comment: any) => comment.post_id === postId);
  const trendingPosts = [...posts].sort((a: any, b: any) => likesByPost(b.id).length - likesByPost(a.id).length).slice(0, 4);
  const trendingProjects = [...projects]
    .sort((a: any, b: any) =>
      projectLikes.filter((like: any) => like.project_id === b.id).length -
      projectLikes.filter((like: any) => like.project_id === a.id).length
    )
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <DashboardTopNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary text-sm font-medium uppercase tracking-[0.2em] mb-2">
              <Sparkles className="w-4 h-4" /> Community
            </div>
            <h1 className="text-3xl font-bold">Community Hub</h1>
            <p className="text-muted-foreground max-w-2xl">Share your work, celebrate progress, follow creators, and discover trending student showcases.</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <section className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Create a post</h2>
                  <p className="text-sm text-muted-foreground">Share designs, websites, AI builds, videos, progress updates, or achievements.</p>
                </div>
              </div>

              <div className="grid gap-4">
                <Input
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Post title"
                  className="bg-secondary border-border"
                />
                <Select value={postCategory} onValueChange={(value) => setPostCategory(value as typeof POST_CATEGORIES[number])}>
                  <SelectTrigger className="bg-secondary border-border w-full">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {POST_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  placeholder="Tell the community what you built or what progress you’re celebrating."
                  className="bg-secondary border-border h-28"
                />
                <Textarea
                  value={mediaUrls}
                  onChange={(e) => setMediaUrls(e.target.value)}
                  placeholder="Links to designs, websites, videos, or screenshots (comma or line separated)."
                  className="bg-secondary border-border h-24"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">Add at least one supporting link or screenshot to help your peers engage.</p>
                  <Button variant="hero" onClick={() => createPost.mutate()}>
                    Post to community
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant={activeTab === "feed" ? "hero" : "outline"} size="sm" onClick={() => setActiveTab("feed")}>Feed</Button>
              <Button variant={activeTab === "trending" ? "hero" : "outline"} size="sm" onClick={() => setActiveTab("trending")}>Trending</Button>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="bg-secondary border-border min-w-[12rem]">
                  <SelectValue placeholder="Filter category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {POST_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeTab === "feed" ? (
              filteredPosts.length === 0 ? (
                <div className="glass-card p-8 text-center text-muted-foreground">
                  No community posts yet. Publish your first showcase or progress update.
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredPosts.map((post: any) => {
                    const author = authorFor(post.user_id);
                    const postLikes = likesByPost(post.id);
                    const postComments = commentsByPost(post.id);
                    const liked = !!user && postLikes.some((like: any) => like.user_id === user.id);
                    const followingAuthor = !!user && myFollows.some((follow: any) => follow.followee_id === post.user_id && follow.follower_id === user.id);
                    const authorFollowers = followCounts.filter((follow: any) => follow.followee_id === post.user_id).length;

                    return (
                      <article key={post.id} className="glass-card p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={categoryBadgeStyle[post.category] || "bg-secondary text-foreground"}>{post.category}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                            </div>
                            <h3 className="text-xl font-semibold">{post.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{post.description}</p>
                          </div>
                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            <div className="flex items-center gap-2">
                              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">{author.full_name?.[0] || "S"}</div>
                              <div className="text-sm">
                                <p className="font-medium">{author.full_name || "Student"}</p>
                                <p className="text-muted-foreground text-[11px]">{authorFollowers} followers</p>
                              </div>
                            </div>
                            {post.user_id !== user?.id && (
                              <Button
                                size="sm"
                                variant={followingAuthor ? "outline" : "secondary"}
                                onClick={() => toggleFollow.mutate(post.user_id)}
                              >
                                {followingAuthor ? <><UserMinus className="w-3.5 h-3.5" /> Unfollow</> : <><UserPlus className="w-3.5 h-3.5" /> Follow</>}
                              </Button>
                            )}
                          </div>
                        </div>

                        {Array.isArray(post.media_urls) && post.media_urls.length > 0 && (
                          <div className="grid gap-3 sm:grid-cols-2 mb-4">
                            {post.media_urls.map((url: string, index: number) => {
                              const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.split("?")[0]);
                              const isVideo = /\.(mp4|webm|mov)$/i.test(url.split("?")[0]);
                              const isYouTube = /youtu\.be|youtube\.com/.test(url);
                              return (
                                <div key={index} className="rounded-2xl border border-border overflow-hidden bg-secondary">
                                  {isImage ? (
                                    <img src={url} alt={`Media ${index + 1}`} className="h-40 w-full object-cover" />
                                  ) : isVideo ? (
                                    <video controls src={url} className="h-40 w-full object-cover" />
                                  ) : (
                                    <a href={url} target="_blank" rel="noreferrer" className="block p-4 text-sm text-primary hover:underline">
                                      {formatMediaLabel(url)}
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="border-t border-border/80 pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <button
                              onClick={() => toggleLikePost.mutate(post.id)}
                              className={`flex items-center gap-2 ${liked ? "text-destructive" : "hover:text-foreground"}`}
                            >
                              <Heart className="w-4 h-4" /> {postLikes.length}
                            </button>
                            <button
                              onClick={() => setOpenComments(openComments === post.id ? null : post.id)}
                              className="flex items-center gap-2 hover:text-foreground"
                            >
                              <MessageCircle className="w-4 h-4" /> {postComments.length}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">Shared by {author.full_name || "Student"}</p>
                        </div>

                        {openComments === post.id && (
                          <div className="mt-4 border-t border-border/80 pt-4 space-y-4">
                            {postComments.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No comments yet — start the conversation.</p>
                            ) : (
                              <div className="space-y-3">
                                {postComments.map((comment: any) => {
                                  const commentAuthor = authorFor(comment.user_id);
                                  return (
                                    <div key={comment.id} className="rounded-2xl bg-secondary p-3">
                                      <div className="flex items-center justify-between gap-3 mb-2">
                                        <span className="text-sm font-medium">{commentAuthor.full_name || "Student"}</span>
                                        <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                                      </div>
                                      <p className="text-sm text-foreground">{comment.content}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                              <Input
                                value={commentInput[post.id] ?? ""}
                                onChange={(e) => setCommentInput((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder="Write a supportive comment..."
                                className="bg-secondary border-border"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && commentInput[post.id]?.trim()) {
                                    addComment.mutate({ postId: post.id, content: commentInput[post.id].trim() });
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="hero"
                                onClick={() => commentInput[post.id]?.trim() && addComment.mutate({ postId: post.id, content: commentInput[post.id].trim() })}
                                disabled={!commentInput[post.id]?.trim()}
                              >
                                Comment
                              </Button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="space-y-4">
                {trendingPosts.length === 0 ? (
                  <div className="glass-card p-8 text-center text-muted-foreground">Nothing trending yet — start by sharing a post.</div>
                ) : (
                  trendingPosts.map((post: any) => {
                    const postLikes = likesByPost(post.id);
                    return (
                      <div key={post.id} className="glass-card p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={categoryBadgeStyle[post.category] || "bg-secondary text-foreground"}>{post.category}</Badge>
                              <span className="text-xs text-muted-foreground">{postLikes.length} likes</span>
                            </div>
                            <h3 className="text-lg font-semibold">{post.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">{post.description}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Trending projects</h2>
              </div>
              <div className="space-y-4">
                {trendingProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No trending projects yet. Encourage students to publish to the portfolio.</p>
                ) : (
                  trendingProjects.map((project: any) => {
                    const projectLikeCount = projectLikes.filter((like: any) => like.project_id === project.id).length;
                    const projectCommentCount = projectComments.filter((comment: any) => comment.project_id === project.id).length;
                    return (
                      <div key={project.id} className="rounded-3xl border border-border/70 p-4 bg-secondary">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{project.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs">{projectLikeCount} ❤️</Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <p>{projectCommentCount} comments</p>
                          <p>{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-foreground" />
                <h2 className="text-lg font-semibold">Community highlights</h2>
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl border border-border/70 bg-secondary p-4">
                  <p className="text-sm font-medium">Showcases</p>
                  <p className="text-xs text-muted-foreground">Designs, websites, and AI builds shared by active students.</p>
                </div>
                <div className="rounded-3xl border border-border/70 bg-secondary p-4">
                  <p className="text-sm font-medium">Achievement posts</p>
                  <p className="text-xs text-muted-foreground">Celebrate milestones, certificate wins, and course progress.</p>
                </div>
                <div className="rounded-3xl border border-border/70 bg-secondary p-4">
                  <p className="text-sm font-medium">Follow creators</p>
                  <p className="text-xs text-muted-foreground">Keep up with students who publish frequently and inspire others.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default CommunityPage;
