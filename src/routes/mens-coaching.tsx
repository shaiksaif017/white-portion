import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  Dumbbell,
  Activity,
  Zap,
  ShieldCheck,
  ChevronDown,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import athleteImage from "@/assets/white-portion-editorial.jpg";
import nutritionImage from "@/assets/white-portion-nutrition.jpg";
import { brand } from "@/lib/brand";
import { ServiceEssentialsSection } from "@/components/service-essentials";

export const Route = createFileRoute("/mens-coaching")({
  head: () => ({
    meta: [
      { title: `Men's Physique & Hypertrophy Coaching | ${brand.name}` },
      {
        name: "description",
        content: `Master lean muscle growth, androgenic health, and body recomposition with ${brand.name}'s dedicated Men's Coaching program. Precision nutrition and progressive overload.`,
      },
      { property: "og:title", content: `Men's Coaching | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: MensCoachingPage,
});

const roadmapPhases = [
  {
    phase: "PHASE 01",
    timeline: "Weeks 1 — 4",
    title: "Diagnostic Audit & Metabolic Priming",
    desc: "We analyze your baseline caloric intake, training frequency, gut health, and hormonal landscape. We eliminate digestive bloat, establish maintenance calories, and dial in nutrient timing.",
    deliverables: [
      "Maintenance calorie & macronutrient threshold calculation",
      "Digestive tolerance & elimination of chronic bloat",
      "Baseline caliper & visual structural assessment",
      "Supplement stack optimization for energy and sleep",
    ],
  },
  {
    phase: "PHASE 02",
    timeline: "Weeks 5 — 14",
    title: "Progressive Hypertrophy & Caloric Surcharge",
    desc: "A clean, tightly monitored surplus engineered to maximize Muscle Protein Synthesis (MPS) while keeping adipose storage negligible. Training volume and recovery are audited weekly.",
    deliverables: [
      "Staged caloric surplus (+200 to +350 kcal) tied to rate of gain",
      "High-leucine meal distribution (3-4g leucine per feeding)",
      "Carbohydrate cycling: higher on heavy lifting days, controlled on rest days",
      "Bi-weekly video movement analysis & load progression tracking",
    ],
  },
  {
    phase: "PHASE 03",
    timeline: "Weeks 15 — 18",
    title: "Insulin Resensitization & Mini-Cut",
    desc: "A brief, sharp caloric deficit to strip away any accumulated subcutaneous water and superficial body fat, resensitizing cellular insulin receptors for further growth.",
    deliverables: [
      "Aggressive yet muscle-sparing caloric reduction",
      "Increased protein buffer to protect nitrogen balance",
      "Drop in resting blood glucose and improved vascularity",
      "Restoration of aggressive appetite and training drive",
    ],
  },
  {
    phase: "PHASE 04",
    timeline: "Weeks 19 — 24+",
    title: "Consolidation & Long-Term Metabolic Autonomy",
    desc: "Reverse dieting back to a new, elevated metabolic maintenance. We ensure your new lean muscle mass is permanently locked in and provide you with total nutritional independence.",
    deliverables: [
      "Gradual weekly caloric step-ups without fat rebound",
      "Intuitive macro-tracking frameworks for business & travel",
      "Sustainable lifestyle integration and social dining mastery",
      "Lifetime nutritional framework and progressive training plan",
    ],
  },
];

const biomarkers = [
  {
    title: "Total & Free Testosterone",
    desc: "Optimized via healthy saturated/monounsaturated lipid ratios, zinc/magnesium sufficiency, and deep slow-wave sleep protocols.",
  },
  {
    title: "Fasting Glucose & HbA1c",
    desc: "Maintained at optimal insulin sensitivity so ingested carbohydrates are driven directly into skeletal muscle tissue rather than adipocytes.",
  },
  {
    title: "Cortisol & DHEA-S Balance",
    desc: "Monitored to ensure chronic work-induced mental stress does not trigger catabolic muscle breakdown or central abdominal fat storage.",
  },
  {
    title: "hs-CRP & Systemic Inflammation",
    desc: "Kept low through high-polyphenol nutrition, omega-3 fatty acid titration, and targeted recovery protocols.",
  },
];

const faqs = [
  {
    q: "How does this differ from standard online fitness coaching?",
    a: "Most online coaching relies on generic PDF templates and automated algorithms. At White Portion Wellness, our directorate personally reviews your metrics, biofeedback, and bloodwork. Every calorie and macronutrient ratio is adjusted weekly based on your physiological response.",
  },
  {
    q: "I work 50-70 hours a week and travel frequently. Can I still do this?",
    a: "Yes. In fact, over 60% of our male clients are corporate executives, founders, and physicians. We design modular, high-efficiency meal frameworks and specific travel dining guides that integrate seamlessly into intense professional lifestyles.",
  },
  {
    q: "Will I have to eat repetitive bland chicken and broccoli every day?",
    a: "Never. We believe rigid, tasteless diets are the enemy of long-term adherence. We build your plan around diverse, nutrient-dense whole foods that match your culinary preferences while hitting exact nutritional thresholds.",
  },
  {
    q: "Do you supply both training programming and nutrition?",
    a: "Yes. While precision nutrition is our primary engine, we integrate full progressive overload resistance training splits, movement execution audits, and weekly volume tracking to ensure the stimulus matches the nutrition.",
  },
  {
    q: "What is the minimum commitment period?",
    a: "Because biological tissue remodeling and muscular hypertrophy require physiological adaptation, our core coaching partnerships run for 16 to 24 weeks. This guarantees tangible, permanent physical changes.",
  },
];

function MensCoachingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="bg-background text-foreground">
      <SiteHeader isSolid />

      {/* Hero Section */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge flex items-center gap-2">
            <Dumbbell className="w-3.5 h-3.5 text-gold-accent" />
            Specialised Program · Men's Health & Physique
          </span>
          <h1>
            MEN'S COACHING.<br />
            LEAN HYPERTROPHY.<br />
            <em>Unstoppable strength.</em>
          </h1>
          <p className="page-hero-desc">
            A scientifically governed coaching blueprint engineered for men who demand dense muscular hypertrophy, single-digit leanness, hormonal vitality, and supreme athletic performance.
          </p>
          <div className="page-hero-actions">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Apply for Men's Coaching <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/approach">
                Explore our 4-stage process
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Key Metric Highlights Bar */}
      <div className="bg-charcoal text-paper border-b border-rule-light py-6 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">+4 — 7 kg</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Average Lean Muscle Accretion</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">Sub-10%</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Target Conditioning Benchmark</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">Weekly</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Director Video & Biofeedback Audits</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">100%</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Bio-Individual Customization</span>
          </div>
        </div>
      </div>

      {/* Section 1: The Science of Lean Hypertrophy */}
      <section className="page-section section-wrap bg-cream">
        <div className="editorial-grid !p-0">
          <div>
            <div className="section-label mb-6">
              <span>01</span>
              <span>The Biological Methodology</span>
            </div>
            <div className="prose-editorial">
              <h2>ACCELERATED GROWTH<br /><em>without excessive fat gain.</em></h2>
              <p>
                The outdated fitness convention of "dirty bulking"—consuming massive caloric surpluses without regard for food quality or insulin sensitivity—consistently results in sluggish metabolism, systemic inflammation, elevated blood pressure, and fat gain that takes months to diet off.
              </p>
              <p>
                At {brand.name}, our men's coaching takes advantage of the molecular science of Muscle Protein Synthesis (MPS). By hitting the critical 3-gram leucine threshold across 4-5 strategically timed daily feedings, we maintain a state of continuous anabolic signaling while keeping caloric surplus tightly controlled.
              </p>
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Targeted peri-workout carbohydrate timing for glycogen fullness</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Androgenic dietary fat balance supporting free testosterone</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Gut microbiome restoration preventing protein bloat and fatigue</span>
                </div>
              </div>
            </div>
          </div>

          <div className="intro-image-wrap">
            <img
              src={athleteImage}
              alt="Physique athlete in focused training — White Portion Wellness"
              width={1440}
              height={1152}
              loading="lazy"
            />
            <span className="image-caption">Disciplined execution. Measurable hypertrophy.</span>
            <span className="image-number">WPW — M01</span>
          </div>
        </div>
      </section>

      {/* Section 2: The 4-Phase Roadmap */}
      <section className="page-section section-wrap bg-secondary">
        <div className="max-w-3xl mb-12">
          <div className="section-label mb-4">
            <span>02</span>
            <span>Structured Progression</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-medium text-charcoal">
            The 24-Week Male Physique Architecture
          </h2>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            Real physical transformation requires methodical periodization. We divide your coaching journey into four deliberate, progressive phases.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {roadmapPhases.map((phase, idx) => (
            <div key={idx} className="page-card !p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                  <span className="text-xs font-bold text-primary tracking-widest">{phase.phase}</span>
                  <span className="text-[11px] font-semibold text-olive-deep bg-background px-2.5 py-0.5 rounded border border-border">
                    {phase.timeline}
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-display font-medium text-charcoal mb-3">
                  {phase.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                  {phase.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <span className="text-[10px] font-bold text-charcoal uppercase tracking-wider block mb-2">
                  Key Deliverables:
                </span>
                {phase.deliverables.map((item, dIdx) => (
                  <div key={dIdx} className="flex items-start gap-2 text-xs text-charcoal">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Biomarkers & Endocrine Health */}
      <section className="page-section section-wrap bg-charcoal text-paper">
        <div className="max-w-3xl mb-12">
          <div className="section-label !border-rule-light !text-paper-muted mb-4">
            <span className="!text-gold-accent">03</span>
            <span>Clinical Biomarker Tracking</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-medium text-paper">
            We don't guess. <em>We measure.</em>
          </h2>
          <p className="text-xs text-paper-soft mt-3 leading-relaxed">
            Optimal muscle building and athletic vitality are inextricably linked with hormonal and metabolic health. We review bloodwork indicators to ensure your body is primed for performance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {biomarkers.map((b, idx) => (
            <div key={idx} className="p-6 rounded bg-paper/5 border border-rule-light space-y-3">
              <Activity className="w-5 h-5 text-gold-accent" />
              <h4 className="text-base font-display font-medium text-paper">{b.title}</h4>
              <p className="text-xs text-paper-soft leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: What Is Included In Your Program */}
      <section className="page-section section-wrap bg-cream">
        <div className="section-label mb-10">
          <span>04</span>
          <span>Program Inclusions</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 bg-card border border-border rounded space-y-4">
            <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <h4 className="text-xl font-display font-medium text-charcoal">Weekly 1-on-1 Audits</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every Sunday, your assigned director reviews your weight graphs, caliper body composition, training logs, and weekly check-in photos to prescribe exact adjustments.
            </p>
          </div>

          <div className="p-8 bg-card border border-border rounded space-y-4">
            <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-xl font-display font-medium text-charcoal">Real-Time Concierge Access</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Direct private messaging via WhatsApp. Have a question about a restaurant menu, need a training form critique, or facing unexpected schedule disruptions? We reply within hours.
            </p>
          </div>

          <div className="p-8 bg-card border border-border rounded space-y-4">
            <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-xl font-display font-medium text-charcoal">Travel & Dining Protocols</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pre-built nutritional blueprints for business dining, steakhouse menus, airport travel, and vacations so you maintain momentum without missing out on life.
            </p>
          </div>
        </div>
      </section>

      {/* Section 5: Frequently Asked Questions */}
      <section className="page-section section-wrap bg-secondary">
        <div className="max-w-3xl mx-auto">
          <div className="section-label mb-6 text-center justify-center">
            <span>05</span>
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-medium text-charcoal text-center mb-10">
            Answers to Common Inquiries
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

      {/* Final Call to Action */}
      <ServiceEssentialsSection slug="/mens-coaching" />

      <section className="page-section section-wrap bg-olive-deep text-paper text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <p className="text-xs font-bold tracking-widest text-gold-accent uppercase">
            Strict Enrollment Capacity
          </p>
          <h2 className="text-4xl md:text-5xl font-display font-medium">
            Build your strongest, leanest physique yet.
          </h2>
          <p className="text-sm text-paper-soft leading-relaxed max-w-xl mx-auto">
            Our 1-on-1 men's coaching rosters are strictly capped at 25 clients per director to ensure uncompromising attention to detail and daily responsiveness.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Book Initial Consultation <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/stories">
                Read client case studies
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
