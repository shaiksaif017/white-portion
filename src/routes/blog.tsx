import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import nutritionImage from "@/assets/white-portion-nutrition.jpg";
import athleteImage from "@/assets/white-portion-editorial.jpg";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: `Journal & Nutrition Insights | ${brand.name}` },
      {
        name: "description",
        content: `Scientific articles, evidence-based nutrition analysis, hypertrophy science, and metabolic health insights from ${brand.name}.`,
      },
      { property: "og:title", content: `Journal | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: BlogPage,
});

const articles = [
  {
    category: "Metabolic Health & PCOS",
    readTime: "7 min read",
    title: "Why Severe Calorie Cutting Backfires for Women with PCOS",
    excerpt:
      "When a female body struggling with insulin resistance is subjected to chronic caloric starvation, cortisol spikes, thyroid function slows, and fat storage is prioritized. Here is how cellular insulin sensitivity is rebuilt.",
    date: "November 2026",
    author: "White Portion Wellness Scientific Advisory",
  },
  {
    category: "Hypertrophy Science",
    readTime: "9 min read",
    title: "Beyond Raw Protein: The Three Anabolic Levers of Muscle Accretion",
    excerpt:
      "Hitting a daily gram target is only the initial layer. Leucine threshold signaling, carbohydrate-driven glycogen supercompensation, and digestive absorption rates dictate actual tissue remodeling.",
    date: "October 2026",
    author: "Head Physique Director",
  },
  {
    category: "Contest Preparation",
    readTime: "8 min read",
    title: "The Peak Week Sodium Myth: Why Complete Depletion Flattens Athletes",
    excerpt:
      "Cutting sodium before stepping on stage is one of the most persistent and damaging bro-science relics. Understanding aldosterone and sodium-potassium ATPase pumps is essential for full, dry muscle bellies.",
    date: "October 2026",
    author: "Contest Prep Director",
  },
  {
    category: "Metabolic Recovery",
    readTime: "6 min read",
    title: "Reverse Dieting Decoded: Escaping Chronic 1,200-Calorie Plateaus",
    excerpt:
      "A step-by-step breakdown on how we incrementally restore thyroid T3 conversion, elevate leptin sensitivity, and rehabilitate your metabolic rate after years of chronic dieting.",
    date: "September 2026",
    author: "Clinical Nutrition Team",
  },
  {
    category: "Physiology & Recovery",
    readTime: "5 min read",
    title: "Sleep Architecture, Cortisol Spikes, and Visceral Adipose Tissue",
    excerpt:
      "How slow-wave delta sleep influences nocturnal human growth hormone release, insulin sensitivity the following morning, and stubborn visceral fat mobilization.",
    date: "August 2026",
    author: "Metabolic Health Team",
  },
];

function BlogPage() {
  return (
    <main>
      <SiteHeader isSolid />

      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge">05 · The White Portion Journal</span>
          <h1>
            NUTRITION SCIENCE.<br />
            CLINICAL EVIDENCE.<br />
            <em>Unfiltered truth.</em>
          </h1>
          <p className="page-hero-desc">
            Evidence-based perspectives on metabolic biochemistry, hypertrophy periodization, endocrine health, and the realities of high-standard physique development.
          </p>
        </div>
      </section>

      <section className="page-section section-wrap bg-cream">
        <div className="editorial-grid !p-0 mb-16 border-b border-border pb-16">
          <div>
            <div className="flex items-center gap-3 text-xs font-bold text-primary tracking-widest uppercase mb-4">
              <span>FEATURED ARTICLE</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 7 min read</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-medium text-charcoal mb-4 leading-tight">
              Why Severe Calorie Cutting Backfires for Women with PCOS
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              When a female body struggling with insulin resistance is subjected to chronic caloric starvation, cortisol spikes, thyroid conversion slows, and fat storage is prioritized. In this clinical guide, we break down why restoring cellular insulin sensitivity through strategic meal sequencing and whole food nutrition is the true path forward.
            </p>
            <Button asChild variant="hero">
              <Link to="/contact">
                Read full research & inquire <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>

          <div className="intro-image-wrap">
            <img
              src={nutritionImage}
              alt="Scientific approach to nutrition — White Portion Wellness"
              width={1440}
              height={1024}
              loading="lazy"
            />
            <span className="image-caption">Evidence-based clinical perspectives.</span>
            <span className="image-number">JOURNAL — 01</span>
          </div>
        </div>

        <div className="section-label mb-10">
          <span>05.1</span>
          <span>Recent Publications</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {articles.slice(1).map((art, idx) => (
            <article key={idx} className="page-card !p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-primary font-bold tracking-wider mb-3">
                  <span>{art.category}</span>
                  <span className="flex items-center gap-1 font-normal text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" /> {art.readTime}
                  </span>
                </div>
                <h3 className="text-2xl font-display font-medium text-charcoal mb-3">
                  {art.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                  {art.excerpt}
                </p>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>By {art.author}</span>
                <span className="font-semibold text-primary">{art.date}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
