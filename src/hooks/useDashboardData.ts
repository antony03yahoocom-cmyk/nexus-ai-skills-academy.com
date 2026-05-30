import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardData {
  enrollments: any[];
  completions: any[];
  certificates: any[];
  projects: any[];
  submissions: any[];
  announcements: any[];
  unreadCount: number;
  openOpportunitiesCount: number;
  myMarketplaceProfile: any;
}

/**
 * Consolidated hook to batch multiple dashboard queries.
 * Reduces network requests and waterfall loading.
 */
export function useDashboardData(userId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard-data', userId],
    queryFn: async (): Promise<DashboardData> => {
      if (!userId) throw new Error('User ID required');

      // Batch queries with Promise.all
      const [
        enrollmentsRes,
        completionsRes,
        certificatesRes,
        projectsRes,
        submissionsRes,
        announcementsRes,
        unreadRes,
        opportunitiesRes,
        marketplaceRes,
      ] = await Promise.all([
        supabase
          .from('enrollments')
          .select('*, courses(*)')
          .eq('user_id', userId)
          .order('enrolled_at', { ascending: false })
          .limit(50),
        supabase
          .from('lesson_completions')
          .select('*')
          .eq('user_id', userId)
          .order('completed_at', { ascending: false })
          .limit(100),
        supabase
          .from('certificates')
          .select('*')
          .eq('student_id', userId)
          .eq('status', 'Issued')
          .limit(10),
        supabase
          .from('projects')
          .select('*, courses(title)')
          .eq('student_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('submissions')
          .select('*, assignments(title, lesson_id)')
          .eq('user_id', userId)
          .order('submitted_at', { ascending: false })
          .limit(10),
        supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('private_messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', userId)
          .eq('is_read', false),
        supabase
          .from('marketplace_opportunities')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),
        supabase
          .from('marketplace_student_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      return {
        enrollments: enrollmentsRes.data ?? [],
        completions: completionsRes.data ?? [],
        certificates: certificatesRes.data ?? [],
        projects: projectsRes.data ?? [],
        submissions: submissionsRes.data ?? [],
        announcements: announcementsRes.data ?? [],
        unreadCount: unreadRes.count ?? 0,
        openOpportunitiesCount: opportunitiesRes.count ?? 0,
        myMarketplaceProfile: marketplaceRes.data ?? null,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
