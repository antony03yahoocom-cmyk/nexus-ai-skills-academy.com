import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink, Clock, ArrowRight, Cpu, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ARTICLES = [
  {
    id: 1,
    title: "How Generative AI is Transforming Jobs Across Africa",
    excerpt: "From Nairobi to Lagos, AI tools are reshaping the workplace. Here's what skills you need to stay ahead and how NEXUS AI Academy can help you get there.",
    category: "AI Trends",
    readTime: "5 min read",
    date: "April 2025",
    emoji: "🤖",
  },
  {
    id: 2,
    title: "Top 10 Prompting Techniques Every AI User Should Know",
    excerpt: "Mastering prompt engineering can 10x your productivity with tools like ChatGPT, Gemini, and Claude. Learn the patterns the pros use every day.",
    category: "AI Tips",
    readTime: "7 min read",
    date: "March 2025",
    emoji: "⚡",
  },
  {
    id: 3,
    title: "Why Data Analysis Is the #1 Skill African Employers Want in 2025",
    excerpt: "A deep dive into the East African job market data — and why learning Python and SQL could be the best career move you make this year.",
    category: "Career Growth",
    readTime: "6 min read",
    date: "March 2025",
    emoji: "📊",
  },
  {
    id: 4,
    title: "Build a Personal Portfolio That Gets You Hired",
    excerpt: "A portfolio isn't just a collection of projects. It's your professional identity. Here's a step-by-step guide to building one that stands out.",
    category: "Career Growth",
    readTime: "8 min read",
    date: "February 2025",
    emoji: "💼",
  },
  {
    id: 5,
    title: "Machine Learning Without a PhD: A Beginner's Roadmap",
    excerpt: "You don't need a computer science degree to understand machine learning. This practical roadmap shows you exactly where to start and what to build.",
    category: "Tutorials",
    readTime: "10 min read",
    date: "February 2025",
    emoji: "🧠",
  },
  {
    id: 6,
    title: "The Future of Graphic Design in the Age of AI Tools",
    excerpt: "Canva AI, Adobe Firefly, Midjourney — AI design tools are here. Designers who embrace them will thrive. Here's how to make the transition.",
    category: "Design",
    readTime: "5 min read",
    date: "January 2025",
    emoji: "🎨",
  },
];

const RESOURCES = [
  {
    title: "NEXUS AI PDF Hub",
    description: "Free eBooks, whitepapers, cheat sheets and reference guides covering AI, programming, data science and more. Curated specifically for African learners.",
    link: "https://sites.google.com/view/nexus-ai-pdf-hub?usp=sharing",
    emoji: "📚",
    badge: "Free Access",
    badgeColor: "bg-success/10 text-success border-success/20",
  },
  {
    title: "AI Tools Cheat Sheet",
    description: "A comprehensive guide to 50+ AI tools organized by use case — writing, coding, design, research and productivity.",
    link: "https://sites.google.com/view/nexus-ai-pdf-hub?usp=sharing",
    emoji: "📋",
    badge: "PDF Download",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
  },
  {
    title: "Python for Data Science Starter Kit",
    description: "Everything you need to start your Python data science journey — from setup to your first real analysis.",
    link: "https://sites.google.com/view/nexus-ai-pdf-hub?usp=sharing",
    emoji: "🐍",
    badge: "PDF Download",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
  },
  {
    title: "Prompt Engineering Masterguide",
    description: "50 battle-tested prompts and templates for ChatGPT, Claude and Gemini — for business, coding, writing and research.",
    link: "https://sites.google.com/view/nexus-ai-pdf-hub?usp=sharing",
    emoji: "✍️",
    badge: "PDF Download",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "AI Trends": "bg-primary/10 text-primary border-primary/20",
  "AI Tips": "bg-accent/10 text-accent border-accent/20",
  "Career Growth": "bg-success/10 text-success border-success/20",
  "Tutorials": "bg-orange-400/10 text-orange-400 border-orange-400/20",
  "Design": "bg-purple-400/10 text-purple-400 border-purple-400/20",
};

type BlogArticle = {
  id: string | number;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  date: string;
  emoji: string;
  externalUrl?: string | null;
  source?: "admin" | "static";
};

const BlogPage = () => {
  const { data: adminArticles = [] } = useQuery({
    queryKey: ["published-blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts" as any)
        .select("id, title, excerpt, category, read_time, published_at, emoji, external_url")
        .eq("is_published", true)
        .order("published_at", { ascending: false }).limit(50);

      if (error) {
        console.error("blog_posts load error:", error);
        return [];
      }

      return (data ?? []).map((post: any): BlogArticle => ({
        id: post.id,
        title: post.title,
        excerpt: post.excerpt,
        category: post.category,
        readTime: post.read_time || "5 min read",
        date: post.published_at
          ? new Date(post.published_at).toLocaleDateString("en-KE", { month: "long", year: "numeric" })
          : "Recently",
        emoji: post.emoji || "📝",
        externalUrl: post.external_url,
        source: "admin",
      }));
    },
  });

  const articles: BlogArticle[] = [
    ...adminArticles,
    ...ARTICLES.map((article) => ({ ...article, source: "static" as const })),
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">

          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-6">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Blog & Resources</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Learn Beyond the <span className="gradient-text">Classroom</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Industry insights, AI news, tutorials and career tips — curated for African learners building their digital future.
            </p>
          </div>

          {/* ── Blog Articles ── */}
          <section className="mb-20" aria-label="Blog articles">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> Latest Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <article
                  key={`${article.source}-${article.id}`}
                  className="glass-card overflow-hidden hover:border-primary/30 transition-all duration-300 group flex flex-col"
                >
                  <div className="h-32 bg-gradient-to-br from-primary/10 to-accent/5 flex items-center justify-center text-4xl">
                    {article.emoji}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge className={`${CATEGORY_COLORS[article.category] || "bg-secondary text-muted-foreground"} text-[10px]`}>
                        {article.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {article.readTime}
                      </span>
                      <span className="text-xs text-muted-foreground">{article.date}</span>
                    </div>
                    <h3 className="font-semibold text-sm mb-2 group-hover:text-primary transition-colors leading-snug">
                      {article.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                      {article.excerpt}
                    </p>
                    <div className="mt-4 pt-3 border-t border-border/50">
                      {article.externalUrl ? (
                        <a
                          href={article.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Read full article <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <Link
                          to="/courses"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Explore related courses <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ── Resource Library ── */}
          <section aria-label="Resource library">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Download className="w-6 h-6 text-accent" /> Resource Library
              </h2>
              {/* FIX: was missing opening <a tag */}
              <a
                href="https://sites.google.com/view/nexus-ai-pdf-hub?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View Full PDF Hub <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Featured resource */}
            <div className="glass-card p-6 mb-6 border-accent/30 bg-gradient-to-r from-accent/5 to-primary/5">
              <div className="flex items-start gap-5 flex-wrap">
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center text-2xl shrink-0">
                  📚
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-bold">NEXUS AI PDF Hub</h3>
                    <Badge className="bg-success/10 text-success border-success/20 text-xs">Free Access</Badge>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Featured</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    Your one-stop library for free AI learning resources. Includes eBooks on machine learning, prompt engineering guides, Python cheat sheets, data science workbooks and much more — all completely free for NEXUS learners.
                  </p>
                  {/* FIX: was missing opening <a tag */}
                  <a
                    href="https://sites.google.com/view/nexus-ai-pdf-hub?usp=sharing"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="hero" size="sm">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open PDF Hub
                    </Button>
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RESOURCES.slice(1).map((res) => (
                <div key={res.title} className="glass-card p-5 hover:border-primary/30 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-xl shrink-0">
                      {res.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-sm">{res.title}</h4>
                        <Badge className={`${res.badgeColor} text-[10px]`}>{res.badge}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{res.description}</p>
                      {/* FIX: was missing opening <a tag */}
                      <a
                        href={res.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Access Resource <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="mt-20 glass-card p-10 text-center border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <Cpu className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Ready to put this into practice?</h3>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Browse our courses and start applying everything you've learned. 7-day free trial, no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="hero" asChild><Link to="/courses">Browse Courses</Link></Button>
              <Button variant="outline" asChild><Link to="/signup">Start Free Trial</Link></Button>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPage;