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

  const loadAdminRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return !!data;
    } catch (error) {
      console.error("[AuthContext] Failed to load admin role:", error);
      return false;
    }
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const [{ data: prof, error: profError }, { data: paid, error: paidError }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("course_purchases").select("*").eq("user_id", userId).eq("status", "paid"),
      ]);

      if (profError && profError.code !== "PGRST116") throw profError;
      if (paidError) throw paidError;

      setProfile((prof as Profile | null) ?? null);
      setPurchases(paid ?? []);
    } catch (error) {
      console.error("[AuthContext] Failed to load profile/purchases:", error);
      setProfile(null);
      setPurchases([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncSession = async (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      try {
        if (nextSession?.user) {
          await Promise.all([loadProfile(nextSession.user.id), loadAdminRole(nextSession.user.id)]);
        } else {
          setProfile(null);
          setPurchases([]);
        }
      } catch (error) {
        console.error("[AuthContext] Failed to load profile/purchases:", error);
        setProfile(null);
        setPurchases([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncSession(session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, loadAdminRole]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      await loadProfile(user.id);
    } catch (error) {
      console.error("[AuthContext] Failed to refresh profile:", error);
    }
  }, [user, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const isAdmin = useMemo(async () => {
    if (!user) return false;
    const isAdminRole = await loadAdminRole(user.id);
    return isAdminRole || (profile?.role ?? "").toLowerCase() === "admin";
  }, [user, profile?.role, loadAdminRole]);

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