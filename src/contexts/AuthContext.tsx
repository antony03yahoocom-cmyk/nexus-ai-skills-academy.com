import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  subscription_status: string;
  trial_start_date: string;
  trial_course_id: string | null;
  is_premium: boolean;
}

interface CoursePurchase {
  course_id: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  hasAccess: boolean;
  trialDaysLeft: number;
  trialActive: boolean;
  purchases: CoursePurchase[];
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasCourseAccess: (courseId: string) => boolean;
  canAccessLesson: (courseId: string, lessonIndex: number) => boolean;
  selectTrialCourse: (courseId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<CoursePurchase[]>([]);
  const [freeCourseIds, setFreeCourseIds] = useState<string[]>([]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (data) {
        setProfile({
          id: data.id,
          user_id: data.user_id,
          full_name: data.full_name,
          avatar_url: data.avatar_url ?? null,
          subscription_status: data.subscription_status,
          trial_start_date: data.trial_start_date,
          trial_course_id: data.trial_course_id ?? null,
          is_premium: data.is_premium ?? false,
        });
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      setIsAdmin(roles?.some((r) => r.role === "admin") ?? false);

      const { data: purchaseData } = await supabase
        .from("course_purchases")
        .select("course_id, status")
        .eq("user_id", userId)
        .eq("status", "paid");
      setPurchases(purchaseData ?? []);

      // Fetch enrolled free courses (price = 0)
      const { data: enrolledCourses } = await supabase
        .from("enrollments")
        .select("course_id, courses!inner(price)")
        .eq("user_id", userId);
      const freeIds = (enrolledCourses ?? [])
        .filter((e: any) => (e.courses as any)?.price === 0)
        .map((e: any) => e.course_id);
      setFreeCourseIds(freeIds);
    } catch (err) {
      console.error("fetchProfile error:", err);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    let mounted = true;

    // ✅ FIX: Use getSession first (synchronous path) and await fetchProfile
    // before setting loading=false so AdminRoute never sees isAdmin=false prematurely
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
        }
      } catch (err) {
        console.error("initAuth error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // ✅ FIX: onAuthStateChange also awaits fetchProfile before setting loading=false
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
          setIsAdmin(false);
          setPurchases([]);
          setFreeCourseIds([]);
        }
        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const trialDaysLeft = profile
    ? Math.max(0, 7 - Math.floor((Date.now() - new Date(profile.trial_start_date).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const trialActive = trialDaysLeft > 0;

  const hasAccess = profile
    ? profile.is_premium || profile.subscription_status === "paid" || purchases.length > 0 || trialActive
    : false;

  const hasCourseAccess = useCallback((courseId: string): boolean => {
    if (!profile) return false;
    if (isAdmin) return true;
    if (profile.is_premium) return true;
    if (purchases.some((p) => p.course_id === courseId)) return true;
    if (freeCourseIds.includes(courseId)) return true;
    if (trialActive && profile.trial_course_id === courseId) return true;
    return false;
  }, [profile, isAdmin, purchases, freeCourseIds, trialActive]);

  const canAccessLesson = useCallback((courseId: string, lessonIndex: number): boolean => {
    if (!profile) return false;
    if (isAdmin) return true;
    if (profile.is_premium) return true;
    if (purchases.some((p) => p.course_id === courseId)) return true;
    if (freeCourseIds.includes(courseId)) return true;
    if (trialActive && profile.trial_course_id === courseId && lessonIndex < 7) return true;
    return false;
  }, [profile, isAdmin, purchases, freeCourseIds, trialActive]);

  const selectTrialCourse = async (courseId: string) => {
    if (!user || !profile) return;
    if (profile.trial_course_id && profile.trial_course_id !== courseId) return;
    const { data: courseData } = await supabase.from("courses").select("price").eq("id", courseId).single();
    if (courseData?.price === 0) return;
    const { error } = await supabase
      .from("profiles")
      .update({ trial_course_id: courseId })
      .eq("user_id", user.id);
    if (!error) {
      setProfile({ ...profile, trial_course_id: courseId });
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setPurchases([]);
    setFreeCourseIds([]);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, isAdmin, loading, hasAccess, trialDaysLeft, trialActive,
      purchases, signOut, refreshProfile, hasCourseAccess, canAccessLesson, selectTrialCourse,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
