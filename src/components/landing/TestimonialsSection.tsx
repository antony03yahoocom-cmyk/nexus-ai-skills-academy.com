import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Wanjiku Muthoni",
    role: "AI Engineer at Safaricom",
    text: "NEXUS AI Academy gave me the exact skills I needed to transition into machine learning. The course quality is unmatched and truly world-class.",
    rating: 5,
  },
  {
    name: "Kwame Asante",
    role: "Full-Stack Developer, Lagos",
    text: "The project-based approach helped me build a real portfolio. I landed my dream job within 3 months of completing the web dev track.",
    rating: 5,
  },
  {
    name: "Amina Osei",
    role: "Data Analyst at Andela",
    text: "Crystal clear explanations and hands-on assignments. The data analysis course transformed my career prospects entirely.",
    rating: 5,
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            What Our <span className="gradient-text">Students</span> Say
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Join thousands of learners who transformed their careers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <div key={t.name} className="glass-card p-6 flex flex-col">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 flex-1 leading-relaxed">"{t.text}"</p>
              <div>
                <p className="font-semibold text-foreground">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
