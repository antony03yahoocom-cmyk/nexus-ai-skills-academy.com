import { useAuth } from "@/contexts/AuthContext";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Award, Download, Loader2, Lock, CheckCircle, Share2, Printer } from "lucide-react";
import { useState } from "react";

// ── Consistent KES formatting ──────────────────────────────────────
const formatKES = (amount: number) =>
  `KES ${Number(amount).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Social share helper ────────────────────────────────────────────
const shareCertificate = (courseName: string, certLink: string | null) => {
  const text = `🎓 I just earned my certificate in "${courseName}" from NEXUS AI Skills Academy! Africa's premier online learning platform. #NexusAI #LearnAI`;
  const url = certLink || "https://nexusaiskillsacademy.com";
  if (navigator.share) {
    navigator.share({ title: "My NEXUS AI Certificate", text, url }).catch(() => {});
  } else {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
  }
};

// ── Print-to-PDF helper ────────────────────────────────────────────
const printCertificate = (certLink: string) => {
  const win = window.open("", "_blank");
  if (!win) { toast.error("Pop-up blocked. Please allow pop-ups for this site."); return; }
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>NEXUS AI Certificate</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        img, object { max-width: 100%; width: 800px; height: auto; display: block; }
        @media print {
          body { background: #0f172a; }
          @page { size: A4 landscape; margin: 0; }
        }
      </style>
    </head>
    <body>
      <img src="${certLink}" alt="Certificate" onload="setTimeout(()=>window.print(),300)" />
      <p style="color:#94a3b8;text-align:center;margin-top:12px;font-family:sans-serif;font-size:12px;">
        Use your browser's Print → Save as PDF for the best quality.
      </p>
    </body>
    </html>
  `);
  win.document.close();
};

const StudentCertificatesPage = () => {
  const { user } = useAuth();
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: certificates = [], refetch } = useQuery({
    queryKey: ["my-certificates", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("*, courses(title)")
        .eq("student_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments-certs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("*, courses(id, title, price)")
        .eq("user_id", user!.id)
        .order("enrolled_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: lessonCounts = {} } = useQuery({
    queryKey: ["cert-lesson-counts", user?.id, enrollments.length],
    queryFn: async () => {
      if (enrollments.length === 0) return {};
      const courseIds = enrollments.map((e: any) => e.course_id);
      const { data: modules } = await supabase.from("modules").select("id, course_id").in("course_id", courseIds);
      if (!modules?.length) return {};
      const moduleIds = modules.map((m: any) => m.id);
      const { data: lessons } = await supabase.from("lessons").select("id, module_id").in("module_id", moduleIds);
      const { data: completions } = await supabase.from("lesson_completions").select("lesson_id").eq("user_id", user!.id);
      const completedSet = new Set(completions?.map((c: any) => c.lesson_id) ?? []);
      const moduleMap: Record<string, string> = {};
      modules.forEach((m: any) => { moduleMap[m.id] = m.course_id; });
      const counts: Record<string, { total: number; completed: number }> = {};
      courseIds.forEach((id: string) => { counts[id] = { total: 0, completed: 0 }; });
      lessons?.forEach((l: any) => {
        const cId = moduleMap[l.module_id];
        if (cId && counts[cId]) {
          counts[cId].total++;
          if (completedSet.has(l.id)) counts[cId].completed++;
        }
      });
      return counts;
    },
    enabled: !!user && enrollments.length > 0,
  });

  const requestCertificate = async (courseId: string) => {
    setGenerating(courseId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-certificate", {
        body: { course_id: courseId },
      });
      if (error) {
        let msg = "Failed to generate certificate";
        try {
          const parsed = typeof error.context === "string" ? JSON.parse(error.context) : error.context;
          msg = parsed?.error || parsed?.message || error.message || msg;
        } catch { msg = error.message || msg; }
        toast.error(msg);
        return;
      }
      if (data?.error) { toast.error(data.error); return; }
      toast.success("🎓 Certificate generated successfully!");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to generate certificate");
    } finally {
      setGenerating(null);
    }
  };

  const hasCert = (courseId: string) =>
    certificates.some((c: any) => c.course_id === courseId && c.status === "Issued");

  return (
    <div className="min-h-screen bg-background">
      <DashboardTopNav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold mb-1">My Certificates</h1>
        <p className="text-muted-foreground mb-8">
          Complete 100% of all lessons in a course to earn your certificate. Download as PDF or share on social media.
        </p>

        {/* ── Earned certificates ── */}
        {certificates.length > 0 && (
          <div className="space-y-4 mb-10">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Award className="w-5 h-5 text-success" /> Earned Certificates
            </h2>
            {certificates.map((cert: any) => {
              const courseName = cert.courses?.title ?? "Course";

              // ── Pre-compute all share URLs (fixes nested template literal build crash) ──
              const encodedCertLink   = encodeURIComponent(cert.certificate_link ?? "");
              const whatsappText      = encodeURIComponent(
                "🎓 I just earned my certificate in \"" + courseName + "\" from NEXUS AI Academy! " + (cert.certificate_link ?? "")
              );
              const linkedInTitle    = encodeURIComponent("I earned a certificate in " + courseName);
              const linkedInSummary  = encodeURIComponent(
                "Completed at NEXUS AI Skills Academy \u2014 Africa's premier online learning platform."
              );
              const whatsappHref  = "https://wa.me/?text=" + whatsappText;
              const linkedInHref  =
                "https://www.linkedin.com/shareArticle?mini=true" +
                "&url=" + encodedCertLink +
                "&title=" + linkedInTitle +
                "&summary=" + linkedInSummary;

              return (
                <div key={cert.id} className="glass-card p-5 border-success/20">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                        <Award className="w-6 h-6 text-success" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{courseName}</h3>
                        <p className="text-sm text-muted-foreground">
                          Issued: {new Date(cert.issued_date).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          ID: {cert.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-success/10 text-success border-success/20">
                        <CheckCircle className="w-3 h-3 mr-1" /> {cert.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
                    {cert.certificate_link ? (
                      <>
                        {/* Download SVG */}
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={cert.certificate_link}
                            download={"NEXUS_Certificate_" + cert.id.slice(0, 8) + ".svg"}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download className="w-4 h-4 mr-1" /> Download SVG
                          </a>
                        </Button>

                        {/* Print / Save as PDF */}
                        <Button
                          size="sm"
                          variant="hero"
                          onClick={() => printCertificate(cert.certificate_link)}
                        >
                          <Printer className="w-4 h-4 mr-1" /> Save as PDF
                        </Button>

                        {/* Share */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => shareCertificate(courseName, cert.certificate_link)}
                        >
                          <Share2 className="w-4 h-4 mr-1" /> Share
                        </Button>

                        {/* WhatsApp — FIX: was missing opening <a tag */}
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-colors text-xs font-medium"
                        >
                          💬 WhatsApp
                        </a>

                        {/* LinkedIn — FIX: was missing opening <a tag + had nested template literal */}
                        <a
                          href={linkedInHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0A66C2]/10 text-[#0A66C2] border border-[#0A66C2]/30 hover:bg-[#0A66C2]/20 transition-colors text-xs font-medium"
                        >
                          in LinkedIn
                        </a>
                      </>
                    ) : (
                      <Badge className="bg-secondary text-muted-foreground text-xs">
                        Processing — contact admin for download link
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Request certificate ── */}
        <h2 className="text-xl font-bold mb-2">Request Certificate</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Complete all lessons to unlock your certificate for each course.
        </p>
        <div className="space-y-4">
          {enrollments.map((e: any) => {
            const already = hasCert(e.course_id);
            const counts = (lessonCounts as any)[e.course_id] ?? { total: 0, completed: 0 };
            const prog = counts.total > 0
              ? Math.round((counts.completed / counts.total) * 100)
              : (e.progress ?? 0);
            const isComplete = counts.total > 0 ? counts.completed >= counts.total : prog >= 100;
            const noLessons = counts.total === 0;
            const price = e.courses?.price ?? 0;

            return (
              <div key={e.id} className="glass-card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-0.5">{e.courses?.title ?? "Course"}</h3>
                    {price > 0 && (
                      <p className="text-xs text-muted-foreground mb-1">{formatKES(price)}</p>
                    )}
                    {counts.total > 0 && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {counts.completed} of {counts.total} lessons completed
                      </p>
                    )}
                    <div className="flex items-center gap-2 max-w-xs">
                      <Progress value={prog} className="h-2 flex-1 bg-secondary" />
                      <span className={"text-xs font-semibold shrink-0 " + (isComplete ? "text-success" : "text-muted-foreground")}>
                        {prog}%
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {already ? (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <Award className="w-3 h-3 mr-1" /> Earned
                      </Badge>
                    ) : isComplete || noLessons ? (
                      <Button
                        size="sm"
                        variant="hero"
                        disabled={generating === e.course_id}
                        onClick={() => requestCertificate(e.course_id)}
                      >
                        {generating === e.course_id
                          ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating...</>
                          : <><Award className="w-4 h-4 mr-1" /> Get Certificate</>}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Complete all lessons first</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {enrollments.length === 0 && certificates.length === 0 && (
            <div className="glass-card p-10 text-center">
              <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-semibold text-muted-foreground mb-1">No courses yet</p>
              <p className="text-sm text-muted-foreground">Enroll in courses and complete all lessons to earn certificates.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentCertificatesPage;