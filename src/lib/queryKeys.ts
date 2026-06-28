/**
 * src/lib/queryKeys.ts
 *
 * Single source of truth for every React Query cache key in the app.
 *
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────
 * Before this file, the same logical key appeared as a raw string
 * literal in multiple files:
 *
 *   ["all-completions"]   — appeared in LessonViewerPage × 3,
 *                           StudentDashboard, useDashboardData
 *   ["employer-opportunities", user?.id] — appeared 4 times across
 *                           EmployerDashboard + AdminOpportunitiesPage
 *
 * The result: invalidating a query after a mutation required knowing
 * every file that used that string. A typo silently broke cache
 * coordination — no TypeScript error, just stale UI.
 *
 * USAGE
 * ─────────────────────────────────────────────────────────────────
 * import { queryKeys } from "@/lib/queryKeys";
 *
 * // In useQuery:
 * queryKey: queryKeys.lesson.completions(userId, courseId)
 *
 * // In invalidateQueries:
 * qc.invalidateQueries({ queryKey: queryKeys.lesson.completions(userId, courseId) })
 *
 * // To invalidate ALL queries under a namespace:
 * qc.invalidateQueries({ queryKey: queryKeys.lesson.all })
 */

export const queryKeys = {
  // ── Auth / Profile ────────────────────────────────────────────────
  auth: {
    all:       ["auth"]                           as const,
    profile:   (uid: string) => ["auth", "profile",   uid] as const,
    purchases: (uid: string) => ["auth", "purchases", uid] as const,
    roles:     (uid: string) => ["auth", "roles",     uid] as const,
  },

  // ── Lessons / Courses ─────────────────────────────────────────────
  lesson: {
    all:        ["lesson"]                                           as const,
    detail:     (id: string)                => ["lesson", "detail", id]                      as const,
    // lessons + modules for a course — replaces the two separate queries
    courseContent: (courseId: string)       => ["lesson", "course-content", courseId]        as const,
    completions:  (uid: string, cid: string) => ["lesson", "completions",   uid, cid]       as const,
    // assignments + submissions bundled together to avoid N+1
    assignmentsAndSubs: (uid: string, cid: string) => ["lesson", "assignments-subs", uid, cid] as const,
  },

  // ── Dashboard ─────────────────────────────────────────────────────
  dashboard: {
    all:        ["dashboard"]                       as const,
    data:       (uid: string) => ["dashboard", "data",         uid] as const,
    unread:     (uid: string) => ["dashboard", "unread-counts", uid] as const,
  },

  // ── Community ─────────────────────────────────────────────────────
  community: {
    all:        ["community"]                                               as const,
    posts:      ()             => ["community", "posts"]                   as const,
    likes:      (uid: string)  => ["community", "likes",    uid]           as const,
    members:    ()             => ["community", "members"]                 as const,
  },

  // ── Marketplace / Employer ─────────────────────────────────────────
  employer: {
    all:          ["employer"]                                                     as const,
    profile:      (uid: string)  => ["employer", "profile",       uid]            as const,
    analytics:    (uid: string)  => ["employer", "analytics",     uid]            as const,
    opportunities:(uid: string)  => ["employer", "opportunities", uid]            as const,
    applications: (oppIds: string) => ["employer", "applications", oppIds]        as const,
    shortlists:   (uid: string)  => ["employer", "shortlists",    uid]            as const,
  },

  // ── Student marketplace profile ────────────────────────────────────
  marketplace: {
    all:            ["marketplace"]                                                    as const,
    studentProfile: (uid: string)  => ["marketplace", "student-profile", uid]         as const,
    opportunities:  ()             => ["marketplace", "opportunities"]                 as const,
    opportunity:    (id: string)   => ["marketplace", "opportunity",     id]          as const,
    savedOpps:      (uid: string)  => ["marketplace", "saved-opps",      uid]         as const,
    myApplications: (uid: string)  => ["marketplace", "my-applications", uid]         as const,
    myApplication:  (uid: string, oppId: string) => ["marketplace", "my-application", uid, oppId] as const,
    myProjects:     (uid: string)  => ["marketplace", "my-projects",     uid]         as const,
    studentPublicProfiles: ()      => ["marketplace", "student-public-profiles"]      as const,
  },

  // ── Messaging ─────────────────────────────────────────────────────
  messages: {
    all:       ["messages"]                                         as const,
    inbox:     (uid: string)  => ["messages", "inbox",  uid]       as const,
    thread:    (uid: string, otherId: string) => ["messages", "thread", uid, otherId] as const,
    unread:    (uid: string)  => ["messages", "unread", uid]       as const,
  },

  // ── Discussions / Groups ───────────────────────────────────────────
  discussions: {
    all:         ["discussions"]                                           as const,
    groups:      ()            => ["discussions", "groups"]               as const,
    group:       (id: string)  => ["discussions", "group",    id]         as const,
    memberships: (uid: string) => ["discussions", "memberships", uid]     as const,
    unreadMsgs:  (uid: string) => ["discussions", "unread-msgs", uid]     as const,
  },

  // ── Admin ─────────────────────────────────────────────────────────
  admin: {
    all:           ["admin"]                                                      as const,
    students:      ()  => ["admin", "students"]                                  as const,
    enrollments:   ()  => ["admin", "enrollments"]                               as const,
    courses:       ()  => ["admin", "courses"]                                   as const,
    submissions:   ()  => ["admin", "submissions"]                               as const,
    announcements: ()  => ["admin", "announcements"]                             as const,
    opportunities: ()  => ["admin", "opportunities"]                             as const,
    employers:     ()  => ["admin", "employers"]                                 as const,
    projects:      ()  => ["admin", "projects"]                                  as const,
    certificates:  ()  => ["admin", "certificates"]                              as const,
    groups:        ()  => ["admin", "groups"]                                    as const,
    reports:       ()  => ["admin", "reports"]                                   as const,
    feedback:      ()  => ["admin", "feedback"]                                  as const,
    blog:          ()  => ["admin", "blog"]                                      as const,
    testimonials:  ()  => ["admin", "testimonials"]                              as const,
  },

  // ── Public / Landing ──────────────────────────────────────────────
  public: {
    all:           ["public"]                                                    as const,
    platformStats: ()  => ["public", "platform-stats"]                          as const,
    courses:       ()  => ["public", "courses"]                                 as const,
    blogPosts:     ()  => ["public", "blog-posts"]                              as const,
    testimonials:  ()  => ["public", "testimonials"]                            as const,
    leaderboard:   ()  => ["public", "leaderboard"]                             as const,
    portfolio:     (uid?: string) => ["public", "portfolio", uid ?? "all"]      as const,
  },

  // ── Notifications ─────────────────────────────────────────────────
  notifications: {
    all:    ["notifications"]                                              as const,
    list:   (uid: string) => ["notifications", "list",   uid]            as const,
    unread: (uid: string) => ["notifications", "unread", uid]            as const,
  },
} as const;
