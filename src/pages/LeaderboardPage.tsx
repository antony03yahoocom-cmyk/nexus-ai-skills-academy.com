import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Trophy, Medal, Crown, Flame, Award, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const rankIcon = (rank: number) => {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">#{rank}</span>;
};

const rankBg = (rank: number) => {
  if (rank === 1) return "border-yellow-400/30 bg-yellow-400/5";
  if (rank === 2) return "border-slate-400/30 bg-slate-400/5";
  if (rank === 3) return "border-amber-600/30 bg-amber-600/5";
  return "";
};

const LeaderboardPage = () => {
  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      // Get all lesson completions
      const { data: completions } = await supabase
        .from("lesson_completions")
        .select("user_id, completed_at");
      if (!completions?.length) return [];

      // Count per user
      const counts: Record<string, { count: number; lastActive: string }> = {};
      completions.forEach((c: any) => {
        if (!counts[c.user_id]) counts[c.user_id] = { count: 0, lastActive: c.completed_at };
        counts[c.user_id].count++;
        if (c.completed_at > counts[c.user_id].lastActive) counts[c.user_id].lastActive = c.completed_at;
      });

      const userIds = Object.keys(counts);
      if (!userIds.length) return [];

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles_public")
        .select("user_id, full_name, is_premium")
        .in("user_id", userIds);

      // Get certificates count per user
      const { data: certs } = await supabase
        .from("certificates")
        .select("student_id")
        .eq("status", "Issued" as any)
        .in("student_id", userIds);

      const certCounts: Record<string, number> = {};
      certs?.forEach((c: any) => {
        certCounts[c.student_id] = (certCounts[c.student_id] || 0) + 1;
      });

      const profileMap: Record<string, any> = {};
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });

      return Object.entries(counts)
        .map(([userId, data]) => ({
          userId,
          name: profileMap[userId]?.full_name || "Anonymous Learner",
          isPremium: profileMap[userId]?.is_premium || false,
          lessonsCompleted: data.count,
          certificates: certCounts[userId] || 0,
          lastActive: data.lastActive,
        }))
        .sort((a, b) => b.lessonsCompleted - a.lessonsCompleted || b.certificates - a.certificates)
        .slice(0, 25);
    },
  });

  const totalLearners = leaderboard.length;
  const totalCompletions = leaderboard.reduce((s, l) => s + l.lessonsCompleted, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-6">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Hall of Fame</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="gradient-text">Leaderboard</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Our top learners ranked by lessons completed and certificates earned. Join them on their journey to mastery.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold">{totalLearners}</p>
              <p className="text-xs text-muted-foreground">Active Learners</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold">{totalCompletions}</p>
              <p className="text-xs text-muted-foreground">Lessons Completed</p>
            </div>
            <div className="glass-card p-4 text-center sm:block hidden">
              <p className="text-2xl font-bold">{leaderboard.reduce((s, l) => s + l.certificates, 0)}</p>
              <p className="text-xs text-muted-foreground">Certificates Issued</p>
            </div>
          </div>

          {/* Top 3 podium */}
          {leaderboard.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-8">
              {/* 2nd */}
              <div className="glass-card p-4 text-center border-slate-400/30 mt-6">
                <Medal className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-400 mb-1">2nd Place</p>
                <p className="font-semibold text-sm truncate">{leaderboard[1].name}</p>
                <p className="text-xs text-muted-foreground">{leaderboard[1].lessonsCompleted} lessons</p>
              </div>
              {/* 1st */}
              <div className="glass-card p-5 text-center border-yellow-400/40 bg-yellow-400/5">
                <Crown className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-yellow-400 mb-1">🏆 Champion</p>
                <p className="font-bold truncate">{leaderboard[0].name}</p>
                <p className="text-sm text-muted-foreground">{leaderboard[0].lessonsCompleted} lessons</p>
                {leaderboard[0].certificates > 0 && (
                  <Badge className="mt-2 bg-yellow-400/10 text-yellow-400 border-yellow-400/20 text-[10px]">
                    {leaderboard[0].certificates} cert{leaderboard[0].certificates > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {/* 3rd */}
              <div className="glass-card p-4 text-center border-amber-600/30 mt-8">
                <Medal className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-amber-600 mb-1">3rd Place</p>
                <p className="font-semibold text-sm truncate">{leaderboard[2].name}</p>
                <p className="text-xs text-muted-foreground">{leaderboard[2].lessonsCompleted} lessons</p>
              </div>
            </div>
          )}

          {/* Full leaderboard */}
          {isLoading ? (
            <div className="glass-card p-10 text-center text-muted-foreground">Loading leaderboard...</div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">Top 25 Learners</h2>
              </div>
              <div className="divide-y divide-border/50">
                {leaderboard.map((learner, idx) => {
                  const rank = idx + 1;
                  const daysSince = Math.floor((Date.now() - new Date(learner.lastActive).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={learner.userId} className={`flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors ${rankBg(rank)}`}>
                      <div className="w-7 flex justify-center shrink-0">{rankIcon(rank)}</div>
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {learner.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate">{learner.name}</p>
                          {learner.isPremium && <Crown className="w-3 h-3 text-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Last active {daysSince === 0 ? "today" : `${daysSince}d ago`}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-right shrink-0">
                        <div>
                          <p className="text-sm font-bold">{learner.lessonsCompleted}</p>
                          <p className="text-[10px] text-muted-foreground">lessons</p>
                        </div>
                        {learner.certificates > 0 && (
                          <div className="flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-success" />
                            <span className="text-xs font-semibold text-success">{learner.certificates}</span>
                          </div>
                        )}
                        {daysSince === 0 && (
                          <span title="Active today"><Flame className="w-4 h-4 text-orange-400 shrink-0" /></span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {leaderboard.length === 0 && (
                  <div className="p-10 text-center text-muted-foreground">
                    <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No learners on the board yet. Be the first!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="text-center mt-10">
            <p className="text-muted-foreground mb-4">Want to see your name on the leaderboard?</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="hero" asChild><Link to="/signup">Start Learning Today</Link></Button>
              <Button variant="outline" asChild><Link to="/courses">Browse Courses</Link></Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LeaderboardPage;
