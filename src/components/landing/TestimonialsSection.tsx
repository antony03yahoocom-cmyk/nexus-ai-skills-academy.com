import { Star, Quote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FALLBACK = [
  { name: "Wanjiku Muthoni", role: "AI Engineer at Safaricom", content: "NEXUS AI Academy gave me the exact skills I needed to transition into machine learning. The course quality is unmatched and truly world-class.", rating: 5 },
  { name: "Kwame Asante", role: "Full-Stack Developer, Lagos", content: "The project-based approach helped me build a real portfolio. I landed my dream job within 3 months of completing the web dev track.", rating: 5 },
  { name: "Amina Osei", role: "Data Analyst at Andela", content: "Crystal clear explanations and hands-on assignments. The data analysis course transformed my career prospects entirely.", rating: 5 },
];

const TestimonialsSection = () => {
  const { data: testimonials = [] } = useQuery({
    queryKey: ["public-testimonials"],
    queryFn: async () => {
      const { data } = await supabase
        .from("testimonials" as any)
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(6);
      return (data ?? []) as any[];
    },
  });

  const display = testimonials.length > 0 ? testimonials : FALLBACK;

  return (
    <section id="testimonials" className="py-24 relative" aria-label="Student testimonials">
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            What Our <span className="gradient-text">Students</span> Say
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Join thousands of learners who have transformed their careers across Africa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {display.map((t: any, i: number) => (
            <div
              key={t.id || t.name}
              className="glass-card p-6 flex flex-col relative hover:border-primary/30 transition-all duration-300"
            >
              <Quote className="w-6 h-6 text-primary/30 mb-3" />
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating ?? 5 }).map((_, si) => (
                  <Star key={si} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 flex-1 leading-relaxed text-sm">
                "{t.content || t.text}"
              </p>
              <div>
                <p className="font-semibold text-foreground">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Social share prompt */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground mb-4">
            Completed a course? Share your achievement and inspire others.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            {/* FIX: was missing opening <a tag */}
            <a
              href="https://twitter.com/intent/tweet?text=I%20just%20completed%20a%20course%20on%20%40NexusAIAcademy%20and%20earned%20my%20certificate!%20%F0%9F%8E%93%20Africa%27s%20best%20online%20learning%20platform.%20Join%20me%20at%20nexusaiskillsacademy.com%20%23NexusAI%20%23LearnAI"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1DA1F2]/10 text-[#1DA1F2] border border-[#1DA1F2]/30 hover:bg-[#1DA1F2]/20 transition-colors text-sm font-medium"
            >
              𝕏 Share on X
            </a>
            {/* FIX: was missing opening <a tag */}
            <a
              href="https://www.linkedin.com/shareArticle?mini=true&url=https://nexusaiskillsacademy.com&title=I%20just%20earned%20a%20certificate%20from%20NEXUS%20AI%20Academy!&summary=Africa%27s%20premier%20online%20learning%20platform%20for%20AI%20and%20digital%20skills."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A66C2]/10 text-[#0A66C2] border border-[#0A66C2]/30 hover:bg-[#0A66C2]/20 transition-colors text-sm font-medium"
            >
              in Share on LinkedIn
            </a>
            {/* FIX: was missing opening <a tag */}
            <a
              href="https://wa.me/?text=I%20just%20earned%20a%20certificate%20on%20NEXUS%20AI%20Academy!%20Join%20me%20at%20https://nexusaiskillsacademy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-colors text-sm font-medium"
            >
              💬 Share on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;