/**
 * src/contexts/AuthContext.tsx
 *
 * CHANGES FROM ORIGINAL
 * ──────────────────────────────────────────────────────────────────
 * 1. ROLES CONSOLIDATED FROM 2-3 QUERIES → 1
 *    loadAdminRole + loadEmployerRole (could fire 2 queries) are replaced
 *    by a single loadRoles() that queries user_roles once with
 *    .in('role', ['admin', 'employer']).
 *
 * 2. EMPLOYER PROFILE FALLBACK REMOVED
 *    The fallback that checked marketplace_employer_profiles when no
 *    user_role row existed was a band-aid. EmployerSignupPage now
 *    owns inserting the user_role row — that is the source of truth.
 *
 * 3. DB CALLS ON SIGN-IN: 4-5 → 2 (parallel)
 *    Promise.all([loadProfile, loadRoles]) — loadProfile itself runs
 *    profiles + course_purchases in parallel, so total parallel calls = 3.
 *
 * 4. PUBLIC API UNCHANGED — no consumer changes required.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────

type Profile = {
  user_id: string;
  full_name?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  is_premium?: boolean | null;
  subscription_status?: string | null;
  trial_start_date?: string | null;
  trial_course_id?: string | null;
  is_banned?: boolean | null;
};

type CoursePurchase = {
  course_id: string;
  status: string;
};

type UserRoles = { isAdmin: boolean; isEmployer: boolean };

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isEmployer: boolean;
  isBanned: boolean;
  purchases: CoursePurchase[];
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
  const [session,    setSession]    = useState<Session | null>(null);
  const [user,       setUser]       = useState<User | null>(null);
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [purchases,  setPurchases]  = useState<CoursePurchase[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [isAdmin,    setIsAdmin]    = useState(false);
  const [isEmployer, setIsEmployer] = useState(false);

  // ── ONE query for both roles ───────────────────────────────────────
  const loadRoles = useCallback(async (userId: string): Promise<UserRoles> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "employer"] as any[]);

      if (error && error.code !== "PGRST116") throw error;
      const roles = new Set((data ?? []).map((r: any) => r.role as string));
      return { isAdmin: roles.has("admin"), isEmployer: roles.has("employer") };
    } catch (err) {
      console.error("[AuthContext] Failed to load roles:", err);
      return { isAdmin: false, isEmployer: false };
    }
  }, []);

  // ── Profile + purchases in parallel ───────────────────────────────
  const loadProfile = useCallback(async (authUser: User): Promise<Profile | null> => {
    try {
      const userId = authUser.id;
      const [{ data: existingProfile, error: profError }, { data: paid, error: paidError }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("course_purchases").select("course_id, status").eq("user_id", userId).eq("status", "paid"),
        ]);

      if (profError && profError.code !== "PGRST116") throw profError;
      if (paidError) throw paidError;

      let resolvedProfile = existingProfile as Profile | null;
      if (!resolvedProfile) {
        const fullName =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split("@")[0] ||
          "Student";
        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .upsert({ user_id: userId, full_name: fullName }, { onConflict: "user_id" })
          .select("*")
          .single();
        if (insertError) throw insertError;
        resolvedProfile = inserted as Profile;
      }

      setProfile(resolvedProfile);
      setPurchases((paid ?? []) as CoursePurchase[]);
      return resolvedProfile;
    } catch (err) {
      console.error("[AuthContext] Failed to load profile/purchases:", err);
      setProfile(null);
      setPurchases([]);
      return null;
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
          // 2 top-level Promise.all entries, 3 DB queries total (profile runs 2 in parallel)
          const [profileResult, rolesResult] = await Promise.all([
            loadProfile(nextSession.user),
            loadRoles(nextSession.user.id),
          ]);
          if (mounted) {
            setIsAdmin(rolesResult.isAdmin && !!profileResult);
            setIsEmployer(rolesResult.isEmployer);
          }
        } else {
          setProfile(null);
          setPurchases([]);
          setIsAdmin(false);
          setIsEmployer(false);
        }
      } catch (err) {
        console.error("[AuthContext] syncSession error:", err);
        setProfile(null);
        setPurchases([]);
        setIsAdmin(false);
        setIsEmployer(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => void syncSession(session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => void syncSession(nextSession));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadProfile, loadRoles]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try { await loadProfile(user); }
    catch (err) { console.error("[AuthContext] Failed to refresh profile:", err); }
  }, [user, loadProfile]);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  const trialDaysLeft = useMemo(() => {
    if (!profile?.trial_start_date) return 0;
    const elapsed = Math.floor((Date.now() - new Date(profile.trial_start_date).getTime()) / 86_400_000);
    return Math.max(0, 7 - elapsed);
  }, [profile?.trial_start_date]);

  const trialActive = trialDaysLeft > 0;

  const hasCourseAccess = useCallback(
    (courseId?: string | null) => {
      if (!user) return false;
      if (isAdmin || profile?.is_premium || profile?.subscription_status === "paid") return true;
      if (!courseId) return false;
      return purchases.some((p) => p.course_id === courseId && p.status === "paid");
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

  const selectTrialCourse = useCallback(async (courseId: string) => {
    if (!user) return;
    await supabase.from("profiles").update({ trial_course_id: courseId }).eq("user_id", user.id);
    await refreshProfile();
  }, [user, refreshProfile]);

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      isAdmin, isEmployer,
      isBanned: !!profile?.is_banned,
      purchases, trialActive, trialDaysLeft,
      refreshProfile, signOut,
      hasCourseAccess, canAccessLesson, selectTrialCourse,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
