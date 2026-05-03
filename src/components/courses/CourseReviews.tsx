import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  courseId: string;
}

const CourseReviews = ({ courseId }: Props) => {
  const { user, hasCourseAccess } = useAuth();
  const queryClient = useQueryClient();
  const access = hasCourseAccess(courseId);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  const { data: reviews = [] } = useQuery({
    queryKey: ["course-reviews", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_reviews" as any)
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const userIds = Array.from(new Set(reviews.map((r) => r.user_id)));
  const { data: profiles = [] } = useQuery({
    queryKey: ["review-profiles", userIds.join(",")],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  const myReview = reviews.find((r) => r.user_id === user?.id);

  const upsert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (myReview) {
        const { error } = await supabase
          .from("course_reviews" as any)
          .update({ rating, content })
          .eq("id", myReview.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("course_reviews" as any)
          .insert({ course_id: courseId, user_id: user.id, rating, content });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(myReview ? "Review updated" : "Review posted");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["course-reviews", courseId] });
      queryClient.invalidateQueries({ queryKey: ["course-rating-summary"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_reviews" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review removed");
      queryClient.invalidateQueries({ queryKey: ["course-reviews", courseId] });
      queryClient.invalidateQueries({ queryKey: ["course-rating-summary"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  // Pre-fill when editing
  if (myReview && !content && rating === 5 && myReview.rating !== 5) {
    setRating(myReview.rating);
    setContent(myReview.content || "");
  }

  return (
    <section className="py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Student Reviews</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`w-5 h-5 ${n <= Math.round(avg) ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
                ))}
              </div>
              <span className="font-semibold">{avg.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">({reviews.length})</span>
            </div>
          )}
        </div>

        {user && access && (
          <div className="glass-card p-5 mb-6">
            <p className="text-sm font-medium mb-3">{myReview ? "Update your review" : "Share your experience"}</p>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star className={`w-7 h-7 transition-colors ${n <= (hoverRating || rating) ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="What did you think of this course?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mb-3"
              rows={3}
            />
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
              {myReview ? "Update Review" : "Post Review"}
            </Button>
          </div>
        )}

        {user && !access && (
          <p className="text-sm text-muted-foreground mb-6">Enroll in this course to leave a review.</p>
        )}

        <div className="space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
          ) : (
            reviews.map((r) => {
              const p: any = profileMap.get(r.user_id);
              const name = p?.full_name || "Student";
              return (
                <div key={r.id} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt={name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-medium text-sm">{name}</p>
                          <div className="flex items-center gap-1.5">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                              ))}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {r.user_id === user?.id && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(r.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      {r.content && <p className="text-sm text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap">{r.content}</p>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default CourseReviews;
