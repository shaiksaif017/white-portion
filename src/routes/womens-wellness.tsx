import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  Sparkles,
  HeartHandshake,
  Activity,
  Moon,
  ChevronDown,
  Calendar,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import nutritionImage from "@/assets/white-portion-nutrition.jpg";
import { brand } from "@/lib/brand";
import { ServiceEssentialsSection } from "@/components/service-essentials";

export const Route = createFileRoute("/womens-wellness")({
  head: () => ({
    meta: [
      { title: `Women's Wellness & Metabolic Health | ${brand.name}` },
      {
        name: "description",
        content: `Hormone-supportive nutrition, cycle-synced eating, thyroid recovery, and sustainable physique transformation with ${brand.name}'s Women's Wellness coaching.`,
      },
      { property: "og:title", content: `Women's Wellness | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: WomensWellnessPage,
});

const cyclePhases = [
  {
    phase: "PHASE 01",
    name: "Follicular Phase (Days 1 — 13)",
    tagline: "Insulin Sensitivity & Estrogen Rise",
    desc: "Estrogen begins rising, boosting insulin sensitivity and carbohydrate tolerance. We leverage complex carbohydrates and moderate fats to power vigorous training and lean muscle toning.",
    nutritionFocus: "Complex whole grains, cruciferous greens, lean proteins, fermented foods.",
  },
  {
    phase: "PHASE 02",
    name: "Ovulatory Phase (Days 14 — 16)",
    tagline: "Peak Energy & Estrogen Clearence",
    desc: "Estrogen and testosterone reach their peak. Energy and strength output are highest. We focus on supporting liver detoxification pathways to clear excess used estrogens cleanly.",
    nutritionFocus: "Antioxidant berries, fiber-rich seeds (flax/chia), brassica vegetables, hydration.",
  },
  {
    phase: "PHASE 03",
    name: "Luteal Phase (Days 17 — 28)",
    tagline: "Metabolic Acceleration & Progesterone Dominance",
    desc: "Your resting metabolic rate naturally elevates by 100 to 250 calories per day, while insulin sensitivity drops. We adjust caloric intake upward with healthy fats and root vegetables to eliminate PMS cravings.",
    nutritionFocus: "Sweet potatoes, squash, dark chocolate, magnesium-rich seeds, healthy lipids.",
  },
  {
    phase: "PHASE 04",
    name: "Menstrual Phase (Days 1 — 5)",
    tagline: "Cellular Recovery & Mineral Replenishment",
    desc: "Progesterone and estrogen dip to baseline. The body requires restorative, easily digestible warm nourishment to replenish iron, zinc, and micronutrients lost through bleeding.",
    nutritionFocus: "Slow-cooked stews, bone broths, iron-dense leafy greens, gentle hydration.",
  },
];

const pillars = [
  {
    icon: Moon,
    title: "Circadian & Cortisol Regulation",
    desc: "Elevated evening cortisol directly impairs thyroid T3 conversion and stalls fat loss. We design calming evening nutrition and magnesium protocols that restore deep restorative sleep.",
  },
  {
    icon: Activity,
    title: "Reverse Dieting Out of Starvation",
    desc: "Chronically subsisting on 1,200 calories damages resting metabolic rate. We systematically step your daily caloric intake up to 1,900-2,300 kcal, creating a resilient, fat-burning metabolic engine.",
  },
  {
    icon: Zap,
    title: "Thyroid & Ovarian Vitality",
    desc: "Severe carbohydrate restriction triggers a biological emergency signal, leading to hair thinning, cold hands, and menstrual disruption. We provide the vital nutrients required for thyroid hormone activation.",
  },
  {
    icon: ShieldCheck,
    title: "Food Freedom & Sustainable Autonomy",
    desc: "Eliminating the anxiety around social dinners, vacations, and family meals. We teach you how to intuitively balance your nutrition so progress is effortless and permanent.",
  },
];

const faqs = [
  {
    q: "Will increasing my calories cause rapid body fat gain?",
    a: "No. Through our controlled reverse dieting protocol, we increase caloric intake incrementally (typically 75-125 kcal every 7-14 days). Because your metabolic rate accelerates in response to increased food availability, our clients routinely eat 500-800 more calories a day while maintaining or even reducing their waist measurements.",
  },
  {
    q: "I have had irregular periods or lost my cycle (HA). Can this help?",
    a: "Yes. Hypothalamic Amenorrhea (HA) and irregular ovulatory cycles are frequently the direct consequence of low energy availability (LEA) and elevated stress. Our specialized female nutrition blueprints are designed to restore ovarian signaling and natural menstrual rhythm.",
  },
  {
    q: "Can I follow this coaching if I am vegetarian, vegan, or have food allergies?",
    a: "Absolutely. All meal blueprints are engineered around your personal dietary preferences, cultural choices, and allergies. We ensure complete amino acid profiles and bioavailable micronutrients regardless of your dietary framework.",
  },
  {
    q: "How does the weekly check-in process work?",
    a: "Every week, you submit a detailed biofeedback audit reviewing sleep quality, digestion, mood, training performance, measurements, and menstrual cycle phase. Your assigned female wellness director provides an exhaustive video breakdown and immediate strategy updates.",
  },
  {
    q: "How does this differ from the PCOS/PCOD Nutrition Support program?",
    a: "While Women's Wellness is ideal for women addressing metabolic recovery, toning, thyroid support, and cycle syncing, our dedicated PCOS program incorporates specialized clinical insulin-sensitizing and androgen-lowering protocols for diagnosed PCOS/PCOD cases.",
  },
];

function WomensWellnessPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="bg-background text-foreground">
      <SiteHeader isSolid />

      {/* Hero Section */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-gold-accent" />
            Specialised Program · Women's Health & Vitality
          </span>
          <h1>
            WOMEN'S WELLNESS.<br />
            HORMONE HARMONY.<br />
            <em>Sustainable vitality.</em>
          </h1>
          <p className="page-hero-desc">
            A compassionate, scientifically calculated coaching program designed for women who want to sculpt a lean, toned physique without crash dieting, hormonal depletion, chronic fatigue, or endless restriction.
          </p>
          <div className="page-hero-actions">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Apply for Women's Wellness <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/pcos-nutrition">
                View PCOS Clinical Support
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Key Metric Highlights Bar */}
      <div className="bg-charcoal text-paper border-b border-rule-light py-6 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">Cycle-Synced</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Infradian Rhythm Nutrition</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">1,800 — 2,400+</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Restored Daily Caloric Capacity</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">Zero</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Arbitrary Restriction or Starvation</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">1-on-1</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Dedicated Female Wellness Director</span>
          </div>
        </div>
      </div>

      {/* Section 1: Endocrine Harmony Philosophy */}
      <section className="page-section section-wrap bg-cream">
        <div className="editorial-grid !p-0">
          <div>
            <div className="section-label mb-6">
              <span>01</span>
              <span>The Endocrine Philosophy</span>
            </div>
            <div className="prose-editorial">
              <h2>NUTRITION THAT WORKS<br /><em>with your biology, not against it.</em></h2>
              <p>
                The modern fitness industry was engineered around male hormonal biology, which follows a simple 24-hour circadian rhythm. Women, by contrast, navigate an intricate 28-day infradian rhythm that governs metabolism, carbohydrate utilization, neurotransmitter balance, and physical recovery.
              </p>
              <p>
                Subjecting the female body to chronic 1,200-calorie restriction, daily high-intensity interval training, and extreme low-carb protocols triggers a state of low energy availability. The brain perceives a famine, downregulating thyroid T3, suppressing progesterone, and stubbornly retaining midsection visceral fat.
              </p>
              <p>
                At {brand.name}, our women's coaching restores your metabolic vitality from the ground up. By supplying adequate fuel and syncing macronutrients with your menstrual cycle, we help you achieve a lean, toned physique while waking up with vibrant energy, glowing skin, and predictable, pain-free cycles.
              </p>
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Individualized macronutrient targets aligned with cycle phases</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Metabolic rehabilitation and structured reverse dieting protocols</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Empathic weekly check-ins analyzing biofeedback, digestion, and stress</span>
                </div>
              </div>
            </div>
          </div>

          <div className="intro-image-wrap">
            <img
              src={nutritionImage}
              alt="Artisanal, hormone-supportive wholesome nutrition — White Portion Wellness"
              width={1440}
              height={1024}
              loading="lazy"
            />
            <span className="image-caption">Whole food nutrition supporting feminine endocrine vitality.</span>
            <span className="image-number">WPW — W01</span>
          </div>
        </div>
      </section>

      {/* Section 2: Infradian Rhythm / Cycle-Synced Protocol */}
      <section className="page-section section-wrap bg-secondary">
        <div className="max-w-3xl mb-12">
          <div className="section-label mb-4">
            <span>02</span>
            <span>The Infradian Protocol</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-medium text-charcoal">
            The 4 Biological Phases of Female Nutrition
          </h2>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            By shifting your dietary focus across your natural menstrual cycle, cravings are eliminated, energy remains consistent, and body fat is mobilized effortlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {cyclePhases.map((phase, idx) => (
            <div key={idx} className="page-card !p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                  <span className="text-xs font-bold text-primary tracking-widest">{phase.phase}</span>
                  <span className="text-[11px] font-semibold text-primary">{phase.tagline}</span>
                </div>
                <h3 className="text-xl md:text-2xl font-display font-medium text-charcoal mb-3">
                  {phase.name}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                  {phase.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-border">
                <span className="text-[10px] font-bold text-charcoal uppercase tracking-wider block mb-1">
                  Primary Nutrition Focus:
                </span>
                <span className="text-xs font-medium text-primary">
                  {phase.nutritionFocus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Four Pillars of Female Health */}
      <section className="page-section section-wrap bg-cream">
        <div className="section-label mb-10">
          <span>03</span>
          <span>Core Strategic Pillars</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div key={idx} className="page-card !p-6 space-y-3">
                <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-display font-medium text-charcoal">{pillar.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{pillar.desc}</p>
              </div>
            );
          })}
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
            Common Inquiries About Women's Coaching
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
      <ServiceEssentialsSection slug="/womens-wellness" />

      <section className="page-section section-wrap bg-olive-deep text-paper text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <HeartHandshake className="w-12 h-12 text-gold-accent mx-auto" />
          <h2 className="text-4xl md:text-5xl font-display font-medium">
            Step into true food freedom and endocrine balance.
          </h2>
          <p className="text-sm text-paper-soft leading-relaxed max-w-xl mx-auto">
            Book an initial consultation with our women's health directorate. We will analyze your hormonal history and craft your tailored path forward.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Book Consultation <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/stories">
                Read transformation stories
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
