import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  UtensilsCrossed,
  Activity,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Plane,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import nutritionImage from "@/assets/white-portion-nutrition.jpg";
import { brand } from "@/lib/brand";
import { ServiceEssentialsSection } from "@/components/service-essentials";

export const Route = createFileRoute("/personalised-diet")({
  head: () => ({
    meta: [
      { title: `Personalised Diet & Nutrition Planning | ${brand.name}` },
      {
        name: "description",
        content: `Bespoke nutrition planning and dietary strategy built strictly around your lifestyle, metabolic rate, work schedule, and culinary preferences with ${brand.name}.`,
      },
      { property: "og:title", content: `Personalised Diet Planning | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: PersonalisedDietPage,
});

const pillars = [
  {
    title: "Exact Caloric & Macronutrient Architecture",
    desc: "Calculated strictly around your basal metabolic rate, total daily energy expenditure (TDEE), and body composition targets. No generic online calculators or arbitrary restrictions.",
  },
  {
    title: "Lifestyle & Executive Travel Integration",
    desc: "Engineered specifically for busy professionals who dine out with clients, travel through airports, and navigate demanding work schedules. You receive modular restaurant and travel protocols.",
  },
  {
    title: "Micronutrient Density & Cellular Vitality",
    desc: "Beyond macros, we evaluate your intake of essential fatty acids, polyphenols, electrolytes, and bioavailable vitamins to eliminate brain fog, optimize digestive motility, and elevate afternoon focus.",
  },
  {
    title: "Ongoing Bi-Weekly Calibration",
    desc: "Metabolism is adaptive. We monitor your weekly weight trends, digestive biofeedback, and energy levels to make subtle, proactive adjustments that prevent plateaus.",
  },
];

const faqs = [
  {
    q: "Do I have to weigh my food with a kitchen scale?",
    a: "While kitchen scales are helpful initially for understanding portion sizes, we also provide intuitive visual portion guides, hand-measure frameworks, and pre-calculated restaurant templates so you can succeed without being tethered to a scale.",
  },
  {
    q: "Can this accommodate vegetarian, vegan, or culturally specific foods?",
    a: "Yes. Our directorate has coached clients worldwide across Mediterranean, South Asian, East Asian, and plant-based diets. We build your meal frameworks entirely around foods you genuinely enjoy.",
  },
  {
    q: "How does this differ from buying a meal plan from a nutritionist?",
    a: "Static meal plans fail because real life is unpredictable. We don't just hand you a piece of paper; we coach you continuously. When unexpected travel, dinners, or cravings arise, you have direct concierge access to adjust your plan in real time.",
  },
];

function PersonalisedDietPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="bg-background text-foreground">
      <SiteHeader isSolid />

      {/* Hero Section */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge flex items-center gap-2">
            <UtensilsCrossed className="w-3.5 h-3.5 text-gold-accent" />
            Specialised Program · Precision Nutrition Architecture
          </span>
          <h1>
            PERSONALISED DIET.<br />
            METABOLIC STRATEGY.<br />
            <em>Bespoke for life.</em>
          </h1>
          <p className="page-hero-desc">
            A considered, scientifically calibrated nutrition roadmap built strictly around your individual physiology, schedule, culinary tastes, and long-term physique ambitions.
          </p>
          <div className="page-hero-actions">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Book Consultation <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/approach">
                Explore our approach
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
              <span>The Tailored Reality</span>
            </div>
            <div className="prose-editorial">
              <h2>NOT JUST A DIET.<br /><em>A strategy built around you.</em></h2>
              <p>
                Every human metabolism, daily routine, and digestive system is completely distinct. When you force a generic diet into a complex life, failure is inevitable.
              </p>
              <p>
                At {brand.name}, our personalized diet planning begins by understanding your lifestyle. Whether you are managing demanding 60-hour workweeks, family dinners, or frequent business travel, we design an exact, flexible framework that delivers repeatable results.
              </p>
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Custom protein, carbohydrate, and dietary fat ratios</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Comprehensive dining out, social event, and travel guides</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Weekly biofeedback reviews ensuring steady, sustainable body recomposition</span>
                </div>
              </div>
            </div>
          </div>

          <div className="intro-image-wrap">
            <img
              src={nutritionImage}
              alt="Artisanal, nutrient-dense nutrition preparation — White Portion Wellness"
              width={1440}
              height={1024}
              loading="lazy"
            />
            <span className="image-caption">Bespoke nutrition protocols crafted for the individual.</span>
            <span className="image-number">WPW — DIET</span>
          </div>
        </div>
      </section>

      {/* Strategic Pillars */}
      <section className="page-section section-wrap bg-secondary">
        <div className="section-label mb-10">
          <span>02</span>
          <span>Four Pillars of Bespoke Planning</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {pillars.map((pillar, idx) => (
            <div key={idx} className="page-card !p-8 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-primary tracking-widest block mb-2">
                  PILLAR 0{idx + 1}
                </span>
                <h3 className="text-xl md:text-2xl font-display font-medium text-charcoal mb-3">
                  {pillar.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {pillar.desc}
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
            Common Inquiries About Personalized Nutrition
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
      <ServiceEssentialsSection slug="/personalised-diet" />

      <section className="page-section section-wrap bg-olive-deep text-paper text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <Sparkles className="w-12 h-12 text-gold-accent mx-auto" />
          <h2 className="text-4xl md:text-5xl font-display font-medium">
            Take the first step toward lasting nutritional clarity.
          </h2>
          <p className="text-sm text-paper-soft leading-relaxed max-w-xl mx-auto">
            Book an initial consultation to discover how a tailored nutrition strategy can transform your energy, physique, and daily productivity.
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
