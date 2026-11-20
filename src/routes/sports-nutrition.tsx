import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  Zap,
  Activity,
  Trophy,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import athleteImage from "@/assets/white-portion-editorial.jpg";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/sports-nutrition")({
  head: () => ({
    meta: [
      { title: `Sports & Performance Nutrition | ${brand.name}` },
      {
        name: "description",
        content: `Advanced athletic performance nutrition, intra-workout glycogen optimization, and rapid muscular recovery protocols with ${brand.name}.`,
      },
      { property: "og:title", content: `Sports Nutrition | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: SportsNutritionPage,
});

const performancePillars = [
  {
    title: "Peri-Workout Glycogen Fueling",
    desc: "Pre-, intra-, and post-training carbohydrate and electrolyte timing engineered to maximize cellular hydration, delay central nervous system fatigue, and elevate anaerobic power output.",
  },
  {
    title: "Accelerated Muscular Recovery Latency",
    desc: "Decreasing post-session muscle soreness (DOMS) and accelerating myofibrillar protein synthesis so you can train with higher weekly volume and intensity without systemic burnout.",
  },
  {
    title: "Electrolyte Osmolarity & Fluid Dynamics",
    desc: "Customized sodium-to-potassium ratios based on sweat rate, training environment, and sport demands, preventing cramping and preserving peak cardiac output.",
  },
  {
    title: "Body Composition for Athletic Power",
    desc: "Optimizing strength-to-weight ratios for weight-class athletes, combat sports, marathon runners, and hybrid fitness competitors.",
  },
];

const faqs = [
  {
    q: "What types of athletes do you work with?",
    a: "We work with competitive CrossFit athletes, marathoners, triathletes, combat sports competitors (MMA, BJJ, boxing), team sport athletes, and serious hybrid strength-endurance enthusiasts.",
  },
  {
    q: "Can this help me make weight for a competition?",
    a: "Yes. We design structured weight-cut and rehydration blueprints that ensure you hit weight-class cutoffs safely while preserving 100% of your power output and cognitive sharpness on competition day.",
  },
  {
    q: "Do you audit performance supplements?",
    a: "Yes. We audit all ergogenic aids (creatine, beta-alanine, caffeine titration, nitrates, tart cherry, electrolytes) to ensure informed sport compliance and measurable performance enhancement.",
  },
];

function SportsNutritionPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="bg-background text-foreground">
      <SiteHeader isSolid />

      {/* Hero Section */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-gold-accent" />
            Specialised Program · Elite Athletic Performance
          </span>
          <h1>
            SPORTS NUTRITION.<br />
            MAXIMUM OUTPUT.<br />
            <em>Rapid recovery.</em>
          </h1>
          <p className="page-hero-desc">
            Advanced nutritional architecture engineered for competitive athletes who demand peak power output, sustained endurance, and accelerated recovery between high-intensity training sessions.
          </p>
          <div className="page-hero-actions">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Book Consultation <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/approach">
                View our methodology
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Editorial Grid */}
      <section className="page-section section-wrap bg-cream">
        <div className="editorial-grid !p-0">
          <div>
            <div className="section-label mb-6">
              <span>01</span>
              <span>The Athletic Edge</span>
            </div>
            <div className="prose-editorial">
              <h2>FUELING THE VEHICLE<br /><em>for extreme performance.</em></h2>
              <p>
                Elite athletic performance is governed by substrate availability. When training volume is high, training on under-fueled glycogen stores leads to elevated cortisol, depressed immune function, joint inflammation, and early performance breakdown.
              </p>
              <p>
                At {brand.name}, our sports nutrition protocols are tuned to the precise bio-energetics of your sport. We balance intra-workout rapid-absorbing carbohydrates, essential amino acids, and tailored electrolyte solutions to sustain high power output from the first minute to the last.
              </p>
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Peri-workout carbohydrate and cyclic dextrin protocols</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Sweat rate and sodium-potassium fluid balance audits</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Anti-inflammatory nutrient periodization reducing tissue breakdown</span>
                </div>
              </div>
            </div>
          </div>

          <div className="intro-image-wrap">
            <img
              src={athleteImage}
              alt="Elite athlete training for maximum output — White Portion Wellness"
              width={1440}
              height={1152}
              loading="lazy"
            />
            <span className="image-caption">Peak power output. Accelerated muscular recovery.</span>
            <span className="image-number">WPW — SPORT</span>
          </div>
        </div>
      </section>

      {/* Strategic Pillars */}
      <section className="page-section section-wrap bg-secondary">
        <div className="section-label mb-10">
          <span>02</span>
          <span>Four Pillars of Performance Nutrition</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {performancePillars.map((p, idx) => (
            <div key={idx} className="page-card !p-8 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-primary tracking-widest block mb-2">
                  PILLAR 0{idx + 1}
                </span>
                <h3 className="text-xl md:text-2xl font-display font-medium text-charcoal mb-3">
                  {p.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {p.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="page-section section-wrap bg-cream">
        <div className="max-w-3xl mx-auto">
          <div className="section-label mb-6 text-center justify-center">
            <span>03</span>
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-medium text-charcoal text-center mb-10">
            Performance Inquiries
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="bg-card border border-border rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between text-sm font-semibold text-charcoal hover:bg-secondary/40 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-primary transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="page-section section-wrap bg-olive-deep text-paper text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <Trophy className="w-12 h-12 text-gold-accent mx-auto" />
          <h2 className="text-4xl md:text-5xl font-display font-medium">
            Elevate your competitive athletic standard.
          </h2>
          <p className="text-sm text-paper-soft leading-relaxed max-w-xl mx-auto">
            Book an initial consultation to discover how sports-specific precision nutrition can elevate your endurance, power output, and competitive rankings.
          </p>
          <div className="pt-4">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Book Consultation <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
