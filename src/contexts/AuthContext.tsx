import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  user_id: string;
  full_name?: string | null;
  role?: string | null;
  is_premium?: boolean | null;
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_days?: number | null;
  trial_course_id?: string | null;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  purchases: any[];
  trialActive: boolean;
  trialDaysLeft: number;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  hasCourseAccess: (courseId?: string | null) => boolean;
  canAccessLesson: (courseId?: string | null, lessonIndex?: number) => boolean;
  selectTrialCourse: (courseId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const [{ data: prof }, { data: paid }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("course_purchases").select("*").eq("user_id", userId).eq("status", "paid"),
    ]);
    setProfile((prof as Profile | null) ?? null);
    setPurchases(paid ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        await loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setPurchases([]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadProfile(user.id);
  }, [user, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const isAdmin = (profile?.role ?? "").toLowerCase() === "admin";

  const trialDaysLeft = useMemo(() => {
    if (!profile?.trial_started_at) return 0;
    const totalDays = profile.trial_days ?? 7;
    const started = new Date(profile.trial_started_at).getTime();
    const elapsedDays = Math.floor((Date.now() - started) / (24 * 60 * 60 * 1000));
    return Math.max(0, totalDays - elapsedDays);
  }, [profile?.trial_started_at, profile?.trial_days]);

  const trialActive = trialDaysLeft > 0;

  const hasCourseAccess = useCallback(
    (courseId?: string | null) => {
      if (!user) return false;
      if (isAdmin || profile?.is_premium || profile?.subscription_status === "paid") return true;
      if (!courseId) return false;
      return purchases.some((p: any) => p.course_id === courseId && p.status === "paid");
    },
    [user, isAdmin, profile?.is_premium, profile?.subscription_status, purchases],
  );

  const canAccessLesson = useCallback(
    (courseId?: string | null, lessonIndex = 0) => {
      if (hasCourseAccess(courseId)) return true;
      return !!(trialActive && profile?.trial_course_id === courseId && lessonIndex < 5);
    },
    [hasCourseAccess, trialActive, profile?.trial_course_id],
  );

  const selectTrialCourse = useCallback(
    async (courseId: string) => {
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ trial_course_id: courseId, trial_started_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);
      await refreshProfile();
    },
    [user, refreshProfile],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAdmin,
        purchases,
        trialActive,
        trialDaysLeft,
        refreshProfile,
        signOut,
        hasCourseAccess,
        canAccessLesson,
        selectTrialCourse,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
