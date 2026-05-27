import {
  BookOpen,
  Users,
  TrendingUp,
  Award,
  FolderOpen,
  FileText,
  CreditCard,
  Crown,
  Search,
  Briefcase,
  Activity,
  Flag,
} from "lucide-react";

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

// ── Formatting helpers ─────────────────────────────────────────────
const fmtKES = (n: number) =>
  `KES ${Number(n).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const AdminDashboard = () => {
  const [subSearch, setSubSearch] =
    useState("");

  // ── Data queries ──────────────────────────────────────────────────
  const { data: courses = [] } =
    useQuery({
      queryKey: ["admin-courses"],

      queryFn: async () => {
        const { data } =
          await supabase
            .from("courses")
            .select("*");

        return data ?? [];
      },
    });

  const { data: profiles = [] } =
    useQuery({
      queryKey: ["admin-profiles"],

      queryFn: async () => {
        const { data } =
          await supabase
            .from("profiles")
            .select("*");

        return data ?? [];
      },
    });

  const { data: enrollments = [] } =
    useQuery({
      queryKey: ["admin-enrollments"],

      queryFn: async () => {
        const { data } =
          await supabase
            .from("enrollments")
            .select("*");

        return data ?? [];
      },
    });

  // Course purchases
  const { data: purchases = [] } =
    useQuery({
      queryKey: [
        "admin-purchases-detailed",
      ],

      queryFn: async () => {
        const { data } =
          await supabase
            .from("course_purchases")
            .select(
              "*, courses(title), profiles!course_purchases_user_id_fkey(full_name)",
            )
            .eq("status", "paid")
            .order("purchased_at", {
              ascending: false,
            });

        return data ?? [];
      },
    });

  // Premium profiles
  const {
    data: premiumProfiles = [],
  } = useQuery({
    queryKey: [
      "admin-premium-profiles",
    ],

    queryFn: async () => {
      const { data } =
        await supabase
          .from("profiles")
          .select(
            "user_id, full_name, is_premium, subscription_status, created_at",
          )
          .or(
            "is_premium.eq.true,subscription_status.eq.paid",
          )
          .order("created_at", {
            ascending: false,
          });

      return data ?? [];
    },
  });

  const {
    data: certificates = [],
  } = useQuery({
    queryKey: [
      "admin-certs-count",
    ],

    queryFn: async () => {
      const { data } =
        await supabase
          .from("certificates")
          .select("id")
          .eq(
            "status",
            "Issued" as any,
          );

      return data ?? [];
    },
  });

  const { data: projects = [] } =
    useQuery({
      queryKey: [
        "admin-projects-count",
      ],

      queryFn: async () => {
        const { data } =
          await supabase
            .from("projects")
            .select("id, status");

        return data ?? [];
      },
    });

  const {
    data: employers = [],
  } = useQuery({
    queryKey: ["admin-employers-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_employer_profiles")
        .select("id");
      return data ?? [];
    },
  });

  const {
    data: opportunities = [],
  } = useQuery({
    queryKey: ["admin-opportunities-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_opportunities")
        .select("id, status, required_skills");
      return data ?? [];
    },
  });

  const {
    data: applications = [],
  } = useQuery({
    queryKey: ["admin-applications-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_applications")
        .select("id, status");
      return data ?? [];
    },
  });

  const {
    data: reports = [],
  } = useQuery({
    queryKey: ["admin-reports-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_reports")
        .select("id, status");
      return data ?? [];
    },
  });

  const {
    data: submissions = [],
  } = useQuery({
    queryKey: [
      "admin-submissions-pending",
    ],

    queryFn: async () => {
      const { data } =
        await supabase
          .from("submissions")
          .select("id, status");

      return data ?? [];
    },
  });

  // ── Derived values ────────────────────────────────────────────────
  const premiumCount = profiles.filter(
    (profile: any) =>
      profile.is_premium,
  ).length;

  const pendingSubmissions =
    submissions.filter(
      (submission: any) =>
        submission.status ===
        "Pending",
    ).length;

  const pendingProjects =
    projects.filter(
      (project: any) =>
        project.status ===
        "Submitted",
    ).length;

  const openOpportunities =
    opportunities.filter(
      (opportunity: any) =>
        opportunity.status ===
        "open",
    ).length;

  const applicationCount = applications.length;

  const acceptedApplications =
    applications.filter(
      (application: any) =>
        application.status ===
        "accepted",
    ).length;

  const pendingReports =
    reports.filter(
      (report: any) =>
        report.status ===
        "pending",
    ).length;

  const totalRevenue = useMemo(
    () =>
      purchases.reduce(
        (
          sum: number,
          purchase: any,
        ) =>
          sum +
          (purchase.amount || 0),
        0,
      ),
    [purchases],
  );

  const engagementRate = useMemo(() => {
    if (!profiles.length) return 0;
    const engagementEvents = purchases.length + applications.length + enrollments.length;
    return Math.round((engagementEvents / Math.max(profiles.length, 1)) * 100);
  }, [purchases.length, applications.length, enrollments.length, profiles.length]);

  const topSkills = useMemo(() => {
    const counts: Record<string, number> = {};
    (opportunities as any[]).forEach((opportunity: any) => {
      (opportunity.required_skills || []).forEach((skill: string) => {
        if (!skill) return;
        counts[skill] = (counts[skill] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([skill]) => skill);
  }, [opportunities]);

  // Premium-only users
  const purchasedUserIds = new Set(
    purchases.map(
      (purchase: any) =>
        purchase.user_id,
    ),
  );

  const premiumOnlyProfiles = (
    premiumProfiles as any[]
  ).filter(
    (profile: any) =>
      !purchasedUserIds.has(
        profile.user_id,
      ),
  );

  // Search
  const filteredPurchases =
    useMemo(() => {
      const q =
        subSearch.toLowerCase();

      if (!q) return purchases;

      return purchases.filter(
        (purchase: any) => {
          const name = (
            purchase.profiles
              ?.full_name || ""
          ).toLowerCase();

          const course = (
            purchase.courses
              ?.title || ""
          ).toLowerCase();

          return (
            name.includes(q) ||
            course.includes(q)
          );
        },
      );
    }, [purchases, subSearch]);

  const filteredPremiumOnly =
    useMemo(() => {
      const q =
        subSearch.toLowerCase();

      if (!q)
        return premiumOnlyProfiles;

      return premiumOnlyProfiles.filter(
        (profile: any) =>
          (
            profile.full_name || ""
          )
            .toLowerCase()
            .includes(q),
      );
    }, [
      premiumOnlyProfiles,
      subSearch,
    ]);

  const stats = [
    {
      label: "Total Courses",
      value: String(courses.length),
      icon: BookOpen,
      color: "text-primary",
      bg: "bg-primary/10",
    },

    {
      label: "Total Students",
      value: String(profiles.length),
      icon: Users,
      color: "text-accent",
      bg: "bg-accent/10",
    },

    {
      label: "Active Employers",
      value: String(employers.length),
      icon: Briefcase,
      color: "text-primary",
      bg: "bg-primary/10",
    },

    {
      label: "Open Opportunities",
      value: String(openOpportunities),
      icon: FolderOpen,
      color: "text-success",
      bg: "bg-success/10",
    },

    {
      label: "Applications",
      value: String(applications.length),
      icon: FileText,
      color: "text-accent",
      bg: "bg-accent/10",
    },

    {
      label: "Hires",
      value: String(acceptedApplications),
      icon: TrendingUp,
      color: "text-success",
      bg: "bg-success/10",
    },

    {
      label: "Pending Reports",
      value: String(pendingReports),
      icon: Flag,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },

    {
      label: "Engagement Rate",
      value: `${engagementRate}%`,
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 pt-[4.5rem] lg:p-8 lg:pt-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl lg:text-3xl font-bold mb-1">
            Admin Dashboard
          </h1>

          <p className="text-muted-foreground text-sm mb-6">
            Overview of your academy.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-8">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="glass-card p-4 lg:p-5 hover:border-primary/20 transition-all duration-300"
              >
                <div
                  className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}
                >
                  <stat.icon
                    className={`w-4 h-4 lg:w-5 lg:h-5 ${stat.color}`}
                  />
                </div>

                <p className="text-xl lg:text-2xl font-bold">
                  {stat.value}
                </p>

                <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <div className="glass-card p-5 mb-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Marketplace activity</h2>
                <p className="text-sm text-muted-foreground">Review top skills and traffic signals across the opportunity hub.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20">{opportunities.length} roles</Badge>
                <Badge className="bg-success/10 text-success border-success/20">{applicationCount} applications</Badge>
                <Badge className="bg-destructive/10 text-destructive border-destructive/20">{pendingReports} reports</Badge>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {topSkills.length > 0 ? (
                topSkills.map((skill) => (
                  <Badge key={skill} className="bg-secondary/10 text-muted-foreground border-border">{skill}</Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No marketplace skills tracked yet.</span>
              )}
            </div>
          </div>

          {/* Action items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {pendingSubmissions >
              0 && (
              <Link
                to="/admin/submissions"
                className="glass-card p-4 lg:p-5 border-accent/30 hover:border-accent/50 transition-all flex items-center gap-3 lg:gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-accent" />
                </div>

                <div>
                  <p className="font-semibold text-sm">
                    {
                      pendingSubmissions
                    }{" "}
                    Pending
                    Submissions
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Review student
                    assignment
                    submissions
                  </p>
                </div>
              </Link>
            )}

            {pendingProjects > 0 && (
              <Link
                to="/admin/projects"
                className="glass-card p-4 lg:p-5 border-primary/30 hover:border-primary/50 transition-all flex items-center gap-3 lg:gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-4 h-4 text-primary" />
                </div>

                <div>
                  <p className="font-semibold text-sm">
                    {
                      pendingProjects
                    }{" "}
                    Projects
                    Awaiting
                    Review
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Approve or
                    reject student
                    projects
                  </p>
                </div>
              </Link>
            )}
          </div>

          {/* Subscriptions */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-success" />
                  Paid
                  Subscriptions
                </h2>

                <p className="text-xs text-muted-foreground mt-0.5">
                  All students
                  who have paid
                  for courses or
                  hold Premium
                  access
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-success/10 text-success border-success/20">
                  {purchases.length}{" "}
                  course payment
                  {purchases.length !==
                  1
                    ? "s"
                    : ""}
                </Badge>

                <Badge className="bg-primary/10 text-primary border-primary/20">
                  {premiumCount}{" "}
                  premium
                </Badge>

                <Badge className="bg-accent/10 text-accent border-accent/20">
                  {fmtKES(
                    totalRevenue,
                  )}{" "}
                  total
                </Badge>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

              <Input
                placeholder="Search by student name or course…"
                value={subSearch}
                onChange={(e) =>
                  setSubSearch(
                    e.target.value,
                  )
                }
                className="pl-9 bg-secondary border-border"
              />
            </div>

            {/* Purchases table */}
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">
              Course Purchases
            </h3>

            <div className="glass-card overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4">
                        Student
                      </th>

                      <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4">
                        Course
                      </th>

                      <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4 hidden sm:table-cell">
                        Amount
                      </th>

                      <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4 hidden md:table-cell">
                        Date Paid
                      </th>

                      <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {filteredPurchases.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-8 text-center text-sm text-muted-foreground"
                        >
                          {subSearch
                            ? "No results match your search"
                            : "No course purchases yet"}
                        </td>
                      </tr>
                    ) : (
                      filteredPurchases
                        .slice(0, 30)
                        .map(
                          (
                            purchase: any,
                          ) => (
                            <tr
                              key={
                                purchase.id
                              }
                              className="hover:bg-secondary/30 transition-colors"
                            >
                              <td className="p-3 lg:p-4 text-sm font-medium">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center text-xs font-bold text-success shrink-0">
                                    {(
                                      purchase
                                        .profiles
                                        ?.full_name ||
                                      "?"
                                    )[0].toUpperCase()}
                                  </div>

                                  <span className="truncate max-w-[120px] lg:max-w-none">
                                    {purchase
                                      .profiles
                                      ?.full_name ||
                                      "Unknown"}
                                  </span>
                                </div>
                              </td>

                              <td className="p-3 lg:p-4 text-sm truncate max-w-[100px] lg:max-w-none">
                                {purchase
                                  .courses
                                  ?.title ||
                                  "Unknown Course"}
                              </td>

                              <td className="p-3 lg:p-4 text-sm font-semibold text-success hidden sm:table-cell">
                                {purchase.amount
                                  ? fmtKES(
                                      purchase.amount,
                                    )
                                  : "—"}
                              </td>

                              <td className="p-3 lg:p-4 text-sm text-muted-foreground hidden md:table-cell">
                                {purchase.purchased_at
                                  ? fmtDate(
                                      purchase.purchased_at,
                                    )
                                  : "—"}
                              </td>

                              <td className="p-3 lg:p-4">
                                <Badge className="bg-success/10 text-success border-success/20 text-xs">
                                  Paid
                                </Badge>
                              </td>
                            </tr>
                          ),
                        )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Premium users */}
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Premium
              Subscribers
            </h3>

            <div className="glass-card overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4">
                        Student
                      </th>

                      <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4">
                        Type
                      </th>

                      <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4 hidden sm:table-cell">
                        Since
                      </th>

                      <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {filteredPremiumOnly.length ===
                      0 &&
                    premiumOnlyProfiles.length ===
                      0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-8 text-center text-sm text-muted-foreground"
                        >
                          No premium-only
                          subscribers
                          yet
                        </td>
                      </tr>
                    ) : filteredPremiumOnly.length ===
                      0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-8 text-center text-sm text-muted-foreground"
                        >
                          No premium
                          subscribers
                          match your
                          search
                        </td>
                      </tr>
                    ) : (
                      filteredPremiumOnly
                        .slice(0, 30)
                        .map(
                          (
                            profile: any,
                          ) => (
                            <tr
                              key={
                                profile.user_id
                              }
                              className="hover:bg-secondary/30 transition-colors"
                            >
                              <td className="p-3 lg:p-4 text-sm font-medium">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                    <Crown className="w-3.5 h-3.5" />
                                  </div>

                                  <span>
                                    {profile.full_name ||
                                      "Unknown"}
                                  </span>
                                </div>
                              </td>

                              <td className="p-3 lg:p-4 text-sm">
                                {profile.is_premium
                                  ? "Premium"
                                  : "Paid Plan"}
                              </td>

                              <td className="p-3 lg:p-4 text-sm text-muted-foreground hidden sm:table-cell">
                                {profile.created_at
                                  ? new Date(
                                      profile.created_at,
                                    ).toLocaleDateString(
                                      "en-KE",
                                    )
                                  : "—"}
                              </td>

                              <td className="p-3 lg:p-4">
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                                  {profile.is_premium
                                    ? "Premium"
                                    : "Active"}
                                </Badge>
                              </td>
                            </tr>
                          ),
                        )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent students */}
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            Recent Students
          </h2>

          <div className="glass-card overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4">
                      Name
                    </th>

                    <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4">
                      Status
                    </th>

                    <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4 hidden sm:table-cell">
                      Purchases
                    </th>

                    <th className="text-left text-xs font-medium text-muted-foreground p-3 lg:p-4 hidden md:table-cell">
                      Joined
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {(
                    profiles as any[]
                  )
                    .slice(0, 10)
                    .map(
                      (
                        profile: any,
                      ) => {
                        const userPurchases =
                          (
                            purchases as any[]
                          ).filter(
                            (
                              purchase: any,
                            ) =>
                              purchase.user_id ===
                              profile.user_id,
                          )
                            .length;

                        return (
                          <tr
                            key={
                              profile.id
                            }
                            className="hover:bg-secondary/30 transition-colors"
                          >
                            <td className="p-3 lg:p-4 text-sm font-medium">
                              {profile.full_name ||
                                "—"}
                            </td>

                            <td className="p-3 lg:p-4">
                              <Badge
                                className={
                                  profile.is_premium
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : profile.subscription_status ===
                                      "paid"
                                    ? "bg-success/10 text-success border-success/20"
                                    : "bg-accent/10 text-accent border-accent/20"
                                }
                              >
                                {profile.is_premium
                                  ? "Premium"
                                  : profile.subscription_status ===
                                    "paid"
                                  ? "Paid"
                                  : "Free Trial"}
                              </Badge>
                            </td>

                            <td className="p-3 lg:p-4 text-sm hidden sm:table-cell">
                              {
                                userPurchases
                              }
                            </td>

                            <td className="p-3 lg:p-4 text-sm text-muted-foreground hidden md:table-cell">
                              {new Date(
                                profile.created_at,
                              ).toLocaleDateString(
                                "en-KE",
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;