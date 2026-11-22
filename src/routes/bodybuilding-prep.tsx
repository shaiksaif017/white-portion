import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  Trophy,
  Activity,
  Flame,
  ShieldCheck,
  ChevronDown,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import athleteImage from "@/assets/white-portion-editorial.jpg";
import { brand } from "@/lib/brand";
import { ServiceEssentialsSection } from "@/components/service-essentials";

export const Route = createFileRoute("/bodybuilding-prep")({
  head: () => ({
    meta: [
      { title: `Bodybuilding & Contest Preparation | ${brand.name}` },
      {
        name: "description",
        content: `Stage conditioning, surgical peak week protocols, posing audits, and complete athlete coaching with ${brand.name}'s Bodybuilding & Contest Preparation program.`,
      },
      { property: "og:title", content: `Bodybuilding & Contest Prep | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: BodybuildingPrepPage,
});

const prepPhases = [
  {
    phase: "PHASE 01",
    timeline: "24 — 36 Weeks Out",
    title: "Off-Season Symmetry & Metabolic Elevation",
    desc: "A strictly controlled anabolic surplus designed to bring up structural weak points, correct muscular imbalances, and elevate your metabolic baseline to 3,000+ kcal before dieting begins.",
    deliverables: [
      "Targeted lagging body-part specialization split",
      "Controlled weekly rate of gain (0.25% body weight/week max)",
      "High baseline carbohydrate tolerance establishing peak insulin sensitivity",
      "Off-season bloodwork audit and organ health safeguarding",
    ],
  },
  {
    phase: "PHASE 02",
    timeline: "16 — 24 Weeks Out",
    title: "The Staged Caloric Deficit",
    desc: "A methodical, phased fat-loss protocol. We strip away adipose tissue at an exact pace of 0.5% to 0.8% of body weight weekly, preserving every gram of skeletal muscle tissue.",
    deliverables: [
      "Staged step-down caloric deficits coupled with high protein sparing",
      "Structured 48-hour carbohydrate refeeds to maintain thyroid T3 output",
      "Cardiovascular volume titration tied to neat and metabolic adaptation",
      "Weekly mandatory posing photo check-ins (front, side, rear mandatories)",
    ],
  },
  {
    phase: "PHASE 03",
    timeline: "Peak Week (Days -7 to Day 0)",
    title: "Peak Week Surgical Science",
    desc: "No dangerous dehydrating diuretics or blind starvation. We utilize the precise physics of sodium-potassium ATPase pumps, water loading/tapering, and glycogen supercompensation so you step on stage full, dry, and vascular.",
    deliverables: [
      "Carbohydrate depletion (Mon-Wed) followed by calculated hyper-loading (Thu-Fri)",
      "Continuous sodium & water titration keeping vascular pressure elevated",
      "Daily (and show-day hourly) video check-ins for carb and electrolyte adjustments",
      "Backstage pump-up protocols, rice cakes & simple sugar timing",
    ],
  },
  {
    phase: "PHASE 04",
    timeline: "Post-Show Recovery (Weeks 1 — 12)",
    title: "Post-Show Endocrine Reverse Diet",
    desc: "The critical period most competitors neglect. We guide you through a tightly controlled reverse diet that restores suppressed thyroid and sex hormones, prevents 10kg rebound binges, and locks in long-term health.",
    deliverables: [
      "Immediate structured post-show recovery meal guidelines",
      "Incremental weekly caloric increases restoring leptin and ghrelin satiety",
      "Transition from extreme conditioning back into productive off-season growth",
      "Complete psychological support and endocrine rehabilitation",
    ],
  },
];

const divisions = [
  {
    division: "Men's Physique",
    focus: "V-Taper & Board Short Aesthetics",
    desc: "Dramatic shoulder width, tiny waist, deep ab striations, and polished stage presence. Conditioning must be skin-tight without being overly vascular.",
  },
  {
    division: "Classic Physique",
    focus: "Golden Era Symmetry & Proportion",
    desc: "Strict weight-to-height limits demanding perfect balance between chest, back, quadriceps, and vacuum waistline. Deep muscle separation and classical poses.",
  },
  {
    division: "Open Bodybuilding",
    focus: "Maximum Muscular Density & Conditioning",
    desc: "Extreme muscular mass, striations on glutes and hamstrings, paper-thin skin, and commanding stage presentation across 8 mandatory poses.",
  },
  {
    division: "Bikini & Wellness",
    focus: "Glute-Hamstring Tie-In & Flow",
    desc: "Full, rounded glutes with clear separation into hamstrings, toned shoulders, feminine lines, and charismatic stage presence.",
  },
];

const faqs = [
  {
    q: "How many weeks out should I begin my contest prep?",
    a: "We recommend a minimum of 16 to 24 weeks for most competitors. Starting early ensures the caloric deficit can be gradual, preserving maximum muscle tissue and keeping energy high enough to train with true intensity.",
  },
  {
    q: "Do you coach drug-tested / natural athletes?",
    a: "Yes. The vast majority of our roster competes in tested natural federations (WNBF, INBA/PNBA, OCB, NPC Natural). Our protocols are rooted in natural human biochemistry and strict legal compliance.",
  },
  {
    q: "How does peak week coaching work?",
    a: "During peak week, communication increases from weekly to daily (and hourly on show day). You will send morning photos and weight metrics, and your director will calibrate your water, sodium, and carbohydrate intake in real time.",
  },
  {
    q: "Do you provide posing critiques and stage presentation guidance?",
    a: "Yes. Conditioning without posing is useless on stage. We audit your mandatory poses, transitions, quarter turns, and individual routine weekly via video review to ensure you present your physique with flawless poise.",
  },
  {
    q: "What if I experience severe post-show food cravings?",
    a: "This is a universal biological response to low body fat and suppressed leptin. Our structured post-show reverse diet is specifically designed to manage this window, giving you clear boundaries and planned treat meals that prevent dangerous binging.",
  },
];

function BodybuildingPrepPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="bg-background text-foreground">
      <SiteHeader isSolid />

      {/* Hero Section */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-gold-accent" />
            Elite Competitive Tier · Stage Preparation & Conditioning
          </span>
          <h1>
            BODYBUILDING PREP.<br />
            SURGICAL CONDITIONING.<br />
            <em>Stage victory.</em>
          </h1>
          <p className="page-hero-desc">
            For competitive physique athletes who refuse to leave their outcome to chance. Every calorie, macro ratio, water volume, and posing angle audited with relentless scientific precision.
          </p>
          <div className="page-hero-actions">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Apply for Contest Prep <ArrowUpRight className="w-4 h-4 ml-2" />
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
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">16 — 24 Weeks</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Methodical Staged Deficit</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">Sub-5% / Sub-10%</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Men / Women Stage Leanness</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">Zero Guesswork</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Surgical Peak Week Protocol</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">100% Guaranteed</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Post-Show Reverse Diet Program</span>
          </div>
        </div>
      </div>

      {/* Section 1: The Competitive Standard */}
      <section className="page-section section-wrap bg-cream">
        <div className="editorial-grid !p-0">
          <div>
            <div className="section-label mb-6">
              <span>01</span>
              <span>The Competitive Standard</span>
            </div>
            <div className="prose-editorial">
              <h2>CONDITIONING IS WON<br /><em>in the final millimeter.</em></h2>
              <p>
                Stepping onto a bodybuilding stage requires an extreme standard of conditioning: paper-thin skin, deep striations through the glutes and lower back, vascularity, and 3-dimensional muscle fullness. Achieving this while preserving every gram of hard-earned muscle demands complete mastery over human biochemistry.
              </p>
              <p>
                At {brand.name}, our contest preparation protocols cater to Men's Physique, Classic Physique, Bodybuilding, Bikini, Figure, and Wellness athletes. We reject dangerous dehydrating bro-science and reckless starvation. Instead, we utilize high-protein sparing protocols, structured refeeds, and scientific peak week manipulation of sodium, potassium, and glycogen.
              </p>
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Daily check-ins during final 4 weeks and hourly peak week adjustments</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Individualized sodium, water, and carbohydrate loading blueprints</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Mandatory video posing critiques and stage presence choreography</span>
                </div>
              </div>
            </div>
          </div>

          <div className="intro-image-wrap">
            <img
              src={athleteImage}
              alt="Physique competitor in peak condition — White Portion Wellness"
              width={1440}
              height={1152}
              loading="lazy"
            />
            <span className="image-caption">Surgical conditioning. Flawless stage presentation.</span>
            <span className="image-number">WPW — BB01</span>
          </div>
        </div>
      </section>

      {/* Section 2: The 4 Prep Phases */}
      <section className="page-section section-wrap bg-secondary">
        <div className="max-w-3xl mb-12">
          <div className="section-label mb-4">
            <span>02</span>
            <span>The Competitive Journey</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-medium text-charcoal">
            The 4 Phases of Stage Preparation
          </h2>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            From the off-season building phase through peak week execution and post-show recovery, our athlete prep is a comprehensive full-cycle partnership.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {prepPhases.map((phase, idx) => (
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

      {/* Section 3: Divisions Coached */}
      <section className="page-section section-wrap bg-cream">
        <div className="section-label mb-10">
          <span>03</span>
          <span>Competitive Divisions Coached</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {divisions.map((div, idx) => (
            <div key={idx} className="page-card !p-6 space-y-3">
              <span className="text-xs font-bold text-primary">DIVISION 0{idx + 1}</span>
              <h4 className="text-lg font-display font-medium text-charcoal">{div.division}</h4>
              <span className="text-[11px] font-semibold text-primary block">{div.focus}</span>
              <p className="text-xs text-muted-foreground leading-relaxed">{div.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Frequently Asked Questions */}
      <section className="page-section section-wrap bg-secondary">
        <div className="max-w-3xl mx-auto">
          <div className="section-label mb-6 text-center justify-center">
            <span>04</span>
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-medium text-charcoal text-center mb-10">
            Athlete Preparation Questions
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
      <ServiceEssentialsSection slug="/bodybuilding-prep" />

      <section className="page-section section-wrap bg-olive-deep text-paper text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <Trophy className="w-12 h-12 text-gold-accent mx-auto" />
          <h2 className="text-4xl md:text-5xl font-display font-medium">
            Step on stage at your absolute best.
          </h2>
          <p className="text-sm text-paper-soft leading-relaxed max-w-xl mx-auto">
            Athlete roster spots are strictly limited per season to ensure comprehensive daily supervision and peak week precision.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Apply for Athlete Coaching <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/stories">
                View contest champions
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
