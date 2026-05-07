import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
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

interface FreeCourseEnrollment {
  course_id: string;
  courses: { price: number | null } | null;
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

const resetUserScopedState = (
  setProfile: (profile: Profile | null) => void,
  setIsAdmin: (isAdmin: boolean) => void,
  setPurchases: (purchases: CoursePurchase[]) => void,
  setFreeCourseIds: (courseIds: string[]) => void,
) => {
  setProfile(null);
  setIsAdmin(false);
  setPurchases([]);
  setFreeCourseIds([]);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<CoursePurchase[]>([]);
  const [freeCourseIds, setFreeCourseIds] = useState<string[]>([]);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profileData) {
        setProfile({
          id: profileData.id,
          user_id: profileData.user_id,
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url ?? null,
          subscription_status: profileData.subscription_status,
          trial_start_date: profileData.trial_start_date,
          trial_course_id: profileData.trial_course_id ?? null,
          is_premium: profileData.is_premium ?? false,
        });
      } else {
        setProfile(null);
      }

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (rolesError) throw rolesError;

      setIsAdmin(roles?.some((roleRow) => roleRow.role === "admin") ?? false);

      const { data: purchaseData, error: purchaseError } = await supabase
        .from("course_purchases")
        .select("course_id, status")
        .eq("user_id", userId)
        .eq("status", "paid");

      if (purchaseError) throw purchaseError;

      setPurchases(purchaseData ?? []);

      const { data: enrolledCourses, error: enrolledError } = await supabase
        .from("enrollments")
        .select("course_id, courses!inner(price)")
        .eq("user_id", userId)
        .returns<FreeCourseEnrollment[]>();

      if (enrolledError) throw enrolledError;

      const freeIds = (enrolledCourses ?? [])
        .filter((enrollment) => enrollment.courses?.price === 0)
        .map((enrollment) => enrollment.course_id);

      setFreeCourseIds(freeIds);
    } catch (err) {
      console.error("fetchProfile error:", err);
      resetUserScopedState(setProfile, setIsAdmin, setPurchases, setFreeCourseIds);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [fetchProfile, user]);

  useEffect(() => {
    let mounted = true;
    let requestId = 0;

    const applySession = async (nextSession: Session | null) => {
      const currentRequest = ++requestId;

      if (mounted) setLoading(true);

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        resetUserScopedState(setProfile, setIsAdmin, setPurchases, setFreeCourseIds);

        if (mounted && currentRequest === requestId) {
          setLoading(false);
        }

        return;
      }

      await fetchProfile(nextSession.user.id);

      if (mounted && currentRequest === requestId) {
        setLoading(false);
      }
    };

    const initAuth = async () => {
      try {
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;
        if (!mounted) return;

        await applySession(initialSession);
      } catch (err) {
        console.error("initAuth error:", err);

        if (mounted) {
          resetUserScopedState(setProfile, setIsAdmin, setPurchases, setFreeCourseIds);
          setLoading(false);
        }
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      void applySession(nextSession);
    });

    return () => {
      mounted = false;
      requestId += 1;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const trialDaysLeft = profile
    ? Math.max(
        0,
        7 - Math.floor((Date.now() - new Date(profile.trial_start_date).getTime()) / (1000 * 60 * 60 * 24)),
      )
    : 0;

  const trialActive = trialDaysLeft > 0;

  const hasAccess = profile
    ? profile.is_premium || profile.subscription_status === "paid" || purchases.length > 0 || trialActive
    : false;

  const hasCourseAccess = useCallback(
    (courseId: string): boolean => {
      if (!profile) return false;
      if (isAdmin) return true;
      if (profile.is_premium) return true;
      if (purchases.some((purchase) => purchase.course_id === courseId)) return true;
      if (freeCourseIds.includes(courseId)) return true;
      if (trialActive && profile.trial_course_id === courseId) return true;
      return false;
    },
    [profile, isAdmin, purchases, freeCourseIds, trialActive],
  );

  const canAccessLesson = useCallback(
    (courseId: string, lessonIndex: number): boolean => {
      if (!profile) return false;
      if (isAdmin) return true;
      if (profile.is_premium) return true;
      if (purchases.some((purchase) => purchase.course_id === courseId)) return true;
      if (freeCourseIds.includes(courseId)) return true;
      if (trialActive && profile.trial_course_id === courseId && lessonIndex < 7) return true;
      return false;
    },
    [profile, isAdmin, purchases, freeCourseIds, trialActive],
  );

  const selectTrialCourse = async (courseId: string) => {
    if (!user || !profile) return;
    if (profile.trial_course_id && profile.trial_course_id !== courseId) return;

    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("price")
      .eq("id", courseId)
      .single();

    if (courseError) throw courseError;
    if (courseData?.price === 0) return;

    const { error } = await supabase
      .from("profiles")
      .update({ trial_course_id: courseId })
      .eq("user_id", user.id);

    if (error) throw error;

    setProfile({ ...profile, trial_course_id: courseId });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    resetUserScopedState(setProfile, setIsAdmin, setPurchases, setFreeCourseIds);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        loading,
        hasAccess,
        trialDaysLeft,
        trialActive,
        purchases,
        signOut,
        refreshProfile,
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

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
