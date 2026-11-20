import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import nutritionImage from "@/assets/white-portion-nutrition.jpg";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/approach")({
  head: () => ({
    meta: [
      { title: `The Approach & Methodology | ${brand.name}` },
      {
        name: "description",
        content: `Discover ${brand.name}'s proprietary 4-stage coaching methodology: Assess, Plan, Monitor, and Refine. Precision nutrition engineered for repeatable progress.`,
      },
      { property: "og:title", content: `The Approach | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: ApproachPage,
});

const detailedStages = [
  {
    number: "01",
    name: "Assess",
    tagline: "Metabolic Profiling & Lifestyle Audit",
    desc: "Before a single gram of food is prescribed, we conduct an exhaustive diagnostic audit of your physiological baseline, previous diet history, metabolic rate, bloodwork markers, digestive tolerances, and daily routines.",
    details: [
      "Current caloric intake & metabolic adaptation history",
      "Digestive health, allergies, and gut barrier integrity",
      "Work schedule, stress environment & sleep efficiency",
      "Hormonal considerations (thyroid, cortisol, sex hormones)",
    ],
  },
  {
    number: "02",
    name: "Plan",
    tagline: "Custom Architectural Strategy",
    desc: "We construct a bespoke nutrition and supplementation blueprint engineered strictly around your physiology. Every macronutrient ratio, meal timing frequency, and hydration target is calculated with precision.",
    details: [
      "Exact caloric targets with high-protein sparing buffers",
      "Strategic carbohydrate placement around training windows",
      "Targeted micronutrient, electrolyte & fiber targets",
      "Real-world dining out and travel navigation protocols",
    ],
  },
  {
    number: "03",
    name: "Monitor",
    tagline: "Weekly Biofeedback & Data Collection",
    desc: "Transformation is an ongoing dialogue between your physiology and our strategy. Through structured weekly check-ins, we measure subjective and objective indicators to ensure steady progress.",
    details: [
      "Comprehensive weight trends, girth measurements & photo check-ins",
      "Sleep quality, morning resting heart rate & HRV metrics",
      "Digestion, bloat, satiety, and energy continuity analysis",
      "Gym performance, recovery latency, and training log reviews",
    ],
  },
  {
    number: "04",
    name: "Refine",
    tagline: "Continuous Adaptation & Peak Execution",
    desc: "Metabolisms are adaptive. When progress stalls or lifestyle variables shift, we respond immediately with proactive dietary recalibrations—eliminating plateaus before they begin.",
    details: [
      "Dynamic calorie cycling, refeeds, and planned diet breaks",
      "Incremental deficit or surplus adjustments",
      "Strategic supplement adjustments based on evolving feedback",
      "Long-term exit strategy and sustainable reverse dieting",
    ],
  },
];

function ApproachPage() {
  return (
    <main>
      <SiteHeader isSolid />

      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge">03 · The Methodology</span>
          <h1>
            PRECISION IN<br />
            EVERY <em>portion.</em>
          </h1>
          <p className="page-hero-desc">
            Our 4-stage systematic methodology replaces erratic guesswork with predictable, evidence-based results. Every client receives an evolving strategy engineered for their individual biology.
          </p>
          <div className="page-hero-actions">
            <Button asChild variant="hero">
              <Link to="/contact">
                Start with an assessment <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/services">
                View coaching programs
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="page-section section-wrap bg-cream">
        <div className="max-w-3xl mb-16">
          <div className="section-label mb-6">
            <span>03.1</span>
            <span>The 4-Stage Architecture</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-medium text-charcoal leading-tight">
            A framework designed to evolve with your progress.
          </h2>
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
            Unlike cookie-cutter PDF meal plans that remain static for months, the {brand.name} system is a living, responsive partnership. Here is how your transformation unfolds:
          </p>
        </div>

        <div className="space-y-16">
          {detailedStages.map((stage) => (
            <div key={stage.number} className="page-card !p-8 md:!p-12 border-l-4 border-l-primary">
              <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 border-b border-border pb-6 mb-6">
                <div>
                  <span className="text-xs font-bold text-primary tracking-widest">STAGE {stage.number}</span>
                  <h3 className="text-3xl md:text-4xl font-display font-medium text-charcoal mt-1">
                    {stage.name}
                  </h3>
                </div>
                <span className="text-xs font-semibold text-primary">{stage.tagline}</span>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-3xl">
                {stage.desc}
              </p>

              <div>
                <span className="text-xs font-bold text-charcoal uppercase tracking-wider block mb-4">
                  Key Actionable Components:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stage.details.map((detail, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-xs text-charcoal bg-secondary/70 p-3 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="page-section section-wrap bg-olive-deep text-paper">
        <div className="editorial-grid !p-0">
          <div>
            <span className="text-xs font-bold text-gold-accent tracking-widest uppercase">Ongoing Partnership</span>
            <h2 className="text-4xl md:text-5xl font-display font-medium text-paper mt-3 mb-6">
              Accountability that creates lasting autonomy.
            </h2>
            <p className="text-sm text-paper-soft leading-relaxed mb-6">
              Our ultimate victory as coaches is not just that you achieve a striking physique or resolve distressing metabolic symptoms—it is that you gain a lifelong understanding of your nutrition, your biofeedback, and your capabilities.
            </p>
            <Button asChild variant="hero">
              <Link to="/contact">
                Apply for coaching <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>

          <div className="intro-image-wrap">
            <img
              src={nutritionImage}
              alt="Structured precision nutrition meal — White Portion Wellness"
              width={1440}
              height={1024}
              loading="lazy"
            />
            <span className="image-caption">Structure creates freedom. Freedom creates consistency.</span>
            <span className="image-number">WPW — STAGE</span>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
