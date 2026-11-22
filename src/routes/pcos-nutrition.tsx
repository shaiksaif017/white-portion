import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  Activity,
  HeartPulse,
  Leaf,
  ChevronDown,
  Sparkles,
  Layers,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import nutritionImage from "@/assets/white-portion-nutrition.jpg";
import { brand } from "@/lib/brand";
import { ServiceEssentialsSection } from "@/components/service-essentials";

export const Route = createFileRoute("/pcos-nutrition")({
  head: () => ({
    meta: [
      { title: `PCOS / PCOD Clinical Nutrition Support | ${brand.name}` },
      {
        name: "description",
        content: `Science-backed, personalized clinical nutrition protocols to reverse insulin resistance, balance ovarian androgens, resolve inflammation, and regain cycle regularity with ${brand.name}.`,
      },
      { property: "og:title", content: `PCOS / PCOD Nutrition Support | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: PcosNutritionPage,
});

const phenotypes = [
  {
    type: "TYPE 01",
    name: "Insulin-Resistant PCOS (~70% of cases)",
    desc: "Elevated fasting insulin triggers the theca cells in the ovaries to oversecrete testosterone, while suppressing Sex Hormone-Binding Globulin (SHBG). Leads to rapid midsection weight gain, intense sugar cravings, and acanthosis nigricans.",
    solution: "Low-glycemic meal sequencing, protein-fat buffering, inositol optimization, and slow-burning complex carbohydrates.",
  },
  {
    type: "TYPE 02",
    name: "Chronic Inflammatory PCOS",
    desc: "Underlying systemic inflammation—often triggered by gut permeability, food sensitivities, or environmental toxins—prevents regular ovulation and elevates inflammatory cytokines like hs-CRP and TNF-alpha.",
    solution: "Elimination of digestive irritants, high polyphenol-dense whole foods, omega-3 EPA/DHA titration, and gut lining repair.",
  },
  {
    type: "TYPE 03",
    name: "Adrenal PCOS (~10% of cases)",
    desc: "Unlike ovarian PCOS where ovarian testosterone is high, adrenal PCOS is characterized by elevated DHEA-S produced by the adrenal glands during chronic psychological or physiological stress.",
    solution: "HPA-axis calming protocols, adrenal adaptogen support, strict avoidance of severe caloric deficits, and nervous system regulation.",
  },
  {
    type: "TYPE 04",
    name: "Post-Pill PCOS",
    desc: "Occurs when birth control pills are discontinued, causing a temporary androgen rebound while the communication between the pituitary gland and ovaries struggles to restart naturally.",
    solution: "Nutrient replenishment (B-complex, zinc, magnesium), liver phase II clearance support, and ovarian receptor awakening.",
  },
];

const clinicalStrategies = [
  {
    title: "Glycemic Curve Flattening",
    desc: "By sequencing your meals strategically—consuming dietary fiber and high-quality protein before carbohydrates—we blunt postprandial glucose spikes by up to 45%, preventing the insulin surges that cause ovarian androgen production.",
  },
  {
    title: "Hepatic Estrogen Clearence",
    desc: "The liver is responsible for metabolizing and eliminating used hormones. We incorporate sulfur-rich cruciferous vegetables, calcium d-glucarate rich foods, and prebiotic fibers to prevent estrogen recirculation.",
  },
  {
    title: "Targeted Inositol & Micronutrient Synergy",
    desc: "We evaluate the role of research-validated myo-inositol and d-chiro inositol in physiological 40:1 ratios, alongside magnesium glycinate, vitamin D3/K2, and zinc to support cellular glucose uptake without pharmaceuticals.",
  },
  {
    title: "Stress-Free, Sustainable Fat Loss",
    desc: "Starvation diets elevate cortisol, which further exacerbates insulin resistance. We construct comfortable, nutrient-dense caloric frameworks that allow your body to release body fat without triggering metabolic panic.",
  },
];

const faqs = [
  {
    q: "Do I have to eliminate all carbohydrates to heal PCOS?",
    a: "No. Carbohydrates are not the enemy; erratic blood sugar spikes are. Severe low-carb or keto diets can actually elevate cortisol and impair thyroid conversion in women. We teach you how to choose nutrient-dense complex carbohydrates and pair them with protein and healthy fats so your blood sugar remains flat and stable.",
  },
  {
    q: "Will this coaching replace my medical prescriptions?",
    a: "Our clinical nutrition protocols are complementary to your medical care. While many of our clients find their blood sugar and hormonal markers improve so dramatically that their physicians reduce or discontinue medications like Metformin or Spironolactone, all medication changes are made in consultation with your doctor.",
  },
  {
    q: "Can I achieve weight loss with PCOS even if my scale hasn't moved in years?",
    a: "Yes. When insulin levels are chronically elevated, the enzyme Lipoprotein Lipase (LPL) keeps fat locked inside fat cells, making fat loss biochemically nearly impossible regardless of calorie restriction. Once we restore cellular insulin sensitivity and lower systemic inflammation, fat loss proceeds steadily.",
  },
  {
    q: "How long before I see improvements in cycle regularity or acne?",
    a: "Most clients experience a noticeable surge in daily energy and reduced sugar cravings within the first 14-21 days. Noticeable improvements in skin clarity, reduced bloating, and ovulatory menstrual cycle return typically occur within 8 to 16 weeks, which mirrors the ovarian follicular maturation cycle.",
  },
  {
    q: "Do I need to submit blood tests before starting?",
    a: "While not strictly mandatory, we strongly encourage recent lab panels (Fasting Glucose, Fasting Insulin, HbA1c, Total/Free Testosterone, DHEA-S, Lipid Profile, Thyroid TSH/FT3/FT4, and Vitamin D3). Our directorate will review your results to pinpoint your exact phenotype.",
  },
];

function PcosNutritionPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="bg-background text-foreground">
      <SiteHeader isSolid />

      {/* Hero Section */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge flex items-center gap-2">
            <HeartPulse className="w-3.5 h-3.5 text-gold-accent" />
            Clinical Protocol · Specialised Endocrine Care
          </span>
          <h1>
            PCOS / PCOD NUTRITION.<br />
            TARGET THE ROOT CAUSE.<br />
            <em>Reclaim your vitality.</em>
          </h1>
          <p className="page-hero-desc">
            You don't need another generic 1,200-calorie starvation diet. You need a scientifically structured, clinical nutritional strategy designed specifically for the unique metabolic landscape of PCOS.
          </p>
          <div className="page-hero-actions">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Schedule a PCOS Consultation <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/stories">
                Read client recovery journeys
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Key Metric Highlights Bar */}
      <div className="bg-charcoal text-paper border-b border-rule-light py-6 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">4 Phenotypes</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Root-Cause Diagnostic Analysis</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">85%+</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Restored Regular 28-32 Day Cycles</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">Zero</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Starvation or Extreme Deprivation</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-display font-medium text-gold-accent block">Clinical</span>
            <span className="text-[11px] text-paper-muted uppercase tracking-wider">Insulin & Biomarker Optimization</span>
          </div>
        </div>
      </div>

      {/* Section 1: The Clinical Reality */}
      <section className="page-section section-wrap bg-cream">
        <div className="editorial-grid !p-0">
          <div>
            <div className="section-label mb-6">
              <span>01</span>
              <span>The Biochemical Reality</span>
            </div>
            <div className="prose-editorial">
              <h2>PCOS IS A METABOLIC CONDITION,<br /><em>not a personal failure.</em></h2>
              <p>
                Too many women with PCOS are dismissed with generic advice to "just lose weight and cut carbs." Yet nobody explains why their body stores energy as visceral fat so readily, why they battle overpowering 3:00 PM sugar crashes, or why their ovaries produce excess androgens.
              </p>
              <p>
                In 70% of PCOS cases, the master driver is hyperinsulinemia. When cells become resistant to insulin, the pancreas compensates by pumping out massive surges of insulin. Excess insulin acts directly on the ovaries, causing them to convert estrogen into testosterone and preventing mature egg release (anovulation).
              </p>
              <p>
                At {brand.name}, our clinical protocols target the root drivers: cellular insulin sensitivity, gut barrier integrity, and liver hormone clearance. By calming systemic inflammation, we help you reverse hirsutism and acne, melt away stubborn weight, and restore regular, predictable cycles.
              </p>
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Clinical low-glycemic, anti-inflammatory food architecture</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Strategic meal sequencing blunting post-meal insulin spikes</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Lab work & blood marker audit (Fasting Glucose, Fasting Insulin, DHEA-S, Lipid Profile)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="intro-image-wrap">
            <img
              src={nutritionImage}
              alt="Clinical anti-inflammatory whole food nutrition — White Portion Wellness"
              width={1440}
              height={1024}
              loading="lazy"
            />
            <span className="image-caption">Clinical nutrition calibrated for cellular insulin sensitivity.</span>
            <span className="image-number">WPW — PCOS</span>
          </div>
        </div>
      </section>

      {/* Section 2: The 4 Distinct Phenotypes */}
      <section className="page-section section-wrap bg-secondary">
        <div className="max-w-3xl mb-12">
          <div className="section-label mb-4">
            <span>02</span>
            <span>Targeted Diagnostics</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-medium text-charcoal">
            The 4 Distinct Phenotypes of PCOS
          </h2>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            One size never fits all in hormonal care. We diagnose which specific biological mechanism is driving your symptoms and apply the exact nutritional antidote.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {phenotypes.map((pt, idx) => (
            <div key={idx} className="page-card !p-8 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-primary tracking-widest block mb-2">{pt.type}</span>
                <h3 className="text-xl md:text-2xl font-display font-medium text-charcoal mb-3">
                  {pt.name}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                  {pt.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-border">
                <span className="text-[10px] font-bold text-charcoal uppercase tracking-wider block mb-1">
                  Our Nutritional Solution:
                </span>
                <p className="text-xs text-primary font-medium leading-relaxed">
                  {pt.solution}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Clinical Protocols */}
      <section className="page-section section-wrap bg-cream">
        <div className="section-label mb-10">
          <span>03</span>
          <span>Core Clinical Strategies</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {clinicalStrategies.map((cs, idx) => (
            <div key={idx} className="page-card !p-6 space-y-3">
              <span className="text-xs font-bold text-primary">STRATEGY 0{idx + 1}</span>
              <h4 className="text-lg font-display font-medium text-charcoal">{cs.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{cs.desc}</p>
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
            Clinical PCOS Questions Answered
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
      <ServiceEssentialsSection slug="/pcos-nutrition" />

      <section className="page-section section-wrap bg-olive-deep text-paper text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <ShieldCheck className="w-12 h-12 text-gold-accent mx-auto" />
          <h2 className="text-4xl md:text-5xl font-display font-medium">
            Take control of your hormones with clinical precision.
          </h2>
          <p className="text-sm text-paper-soft leading-relaxed max-w-xl mx-auto">
            Book an in-depth consultation with our specialized clinical nutrition coaches. We will analyze your symptoms and craft your tailored road to recovery.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Schedule PCOS Consultation <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/approach">
                View our clinical approach
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
