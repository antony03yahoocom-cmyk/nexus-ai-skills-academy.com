import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Send, Lightbulb } from "lucide-react";

const CATEGORIES = [
  { value: "general", label: "General Feedback" },
  { value: "course", label: "Course Content" },
  { value: "technical", label: "Technical Issue" },
  { value: "suggestion", label: "Feature Suggestion" },
  { value: "pricing", label: "Pricing" },
  { value: "other", label: "Other" },
];

const FeedbackSection = () => {
  const [form, setForm] = useState({ name: "", email: "", category: "general", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!form.message.trim()) { toast.error("Please enter your message"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("site_feedback" as any).insert({
        name: form.name || null,
        email: form.email || null,
        category: form.category,
        message: form.message,
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success("Thank you for your feedback! We'll review it soon.");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="feedback" className="py-24 relative" aria-label="Feedback form">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent/30 bg-accent/5 mb-6">
            <Lightbulb className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">We're listening</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Share Your <span className="gradient-text">Feedback</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Help us build Africa's best learning platform. Your ideas and suggestions shape our roadmap.
          </p>
        </div>

        {submitted ? (
          <div className="glass-card p-10 text-center">
            <MessageSquare className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Thank You! 🙏</h3>
            <p className="text-muted-foreground mb-4">
              Your feedback has been received. Our team reviews every submission and uses it to improve the platform.
            </p>
            <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", category: "general", message: "" }); }}>
              Submit Another
            </Button>
          </div>
        ) : (
          <div className="glass-card p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Your Name (optional)</Label>
                <Input
                  placeholder="John Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email (optional)</Label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="bg-secondary border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5 mb-4">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 mb-6">
              <Label className="text-xs">Your Message *</Label>
              <Textarea
                placeholder="Tell us what you think, what you'd like to see, or report an issue..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="bg-secondary border-border min-h-[140px]"
              />
            </div>

            <Button
              variant="hero"
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || !form.message.trim()}
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? "Sending..." : "Send Feedback"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default FeedbackSection;
