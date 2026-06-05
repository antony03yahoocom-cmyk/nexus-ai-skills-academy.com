import { useAuth } from "@/contexts/AuthContext";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Award, Download, Loader2 } from "lucide-react";
import { useState } from "react";

const StudentCertificatesPage = () => {
  const { user } = useAuth();
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: certificates = [], refetch } = useQuery({
    queryKey: ["my-certificates", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("certificates").select("*, courses(title)").eq("student_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments-certs", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("*, courses(id, title)").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const requestCertificate = async (courseId: string) => {
    setGenerating(courseId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-certificate", { body: { course_id: courseId } });
      if (error) throw error;
      if (data?.error) toast.error(data.error);
      else { toast.success("Certificate generated!"); refetch(); }
    } catch (e: any) { toast.error(e.message || "Failed to generate certificate"); }
    setGenerating(null);
  };

  const hasCert = (courseId: string) => certificates.some((c: any) => c.course_id === courseId && c.status === "Issued");

  return (
    <div className="min-h-screen bg-background">
      <DashboardTopNav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold mb-1">My Certificates</h1>
        <p className="text-muted-foreground mb-8">View and download your course certificates.</p>

        {certificates.length > 0 && (
          <div className="space-y-4 mb-8">
            {certificates.map((cert: any) => (
              <div key={cert.id} className="glass-card p-5 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Award className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{(cert as any).courses?.title ?? "Course"}</h3>
                    <p className="text-sm text-muted-foreground">Issued: {new Date(cert.issued_date).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground font-mono">ID: {cert.id.slice(0, 8)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-success/10 text-success border-success/20">{cert.status}</Badge>
                  {cert.certificate_link && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={cert.certificate_link} target="_blank" rel="noreferrer"><Download className="w-4 h-4 mr-1" /> Download</a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-xl font-bold mb-4">Request Certificate</h2>
        <p className="text-sm text-muted-foreground mb-4">Complete all lessons and get all assignments approved to earn your certificate.</p>
        <div className="space-y-3">
          {enrollments.map((e: any) => {
            const already = hasCert(e.course_id);
            return (
              <div key={e.id} className="glass-card p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-medium text-sm">{(e as any).courses?.title}</h3>
                  <p className="text-xs text-muted-foreground">Progress: {e.progress}%</p>
                </div>
                {already ? (
                  <Badge className="bg-success/10 text-success border-success/20">Earned</Badge>
                ) : (
                  <Button size="sm" variant="hero" disabled={generating === e.course_id} onClick={() => requestCertificate(e.course_id)}>
                    {generating === e.course_id ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating...</> : "Request Certificate"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {enrollments.length === 0 && certificates.length === 0 && (
          <div className="glass-card p-8 text-center">
            <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Enroll in courses and complete them to earn certificates.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentCertificatesPage;
