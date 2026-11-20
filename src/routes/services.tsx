import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: `Coaching & Services | ${brand.name}` },
      {
        name: "description",
        content: `Explore the complete suite of coaching services at ${brand.name}: Men's Physique, Women's Wellness, PCOS/PCOD Nutrition Support, Bodybuilding Preparation, and Sports Performance.`,
      },
      { property: "og:title", content: `Coaching & Services | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: ServicesPage,
});

const serviceList = [
  {
    number: "01",
    slug: "/mens-coaching",
    title: "Men's Coaching & Hypertrophy",
    tagline: "Progressive overload, hormone support, and muscular density.",
    desc: "Engineered specifically for men seeking significant muscular development, optimal testosterone support, body recomposition, and disciplined strength progression.",
    features: ["Bespoke caloric surplus & reverse dieting", "Hormonal & androgenic support protocols", "Targeted training split integration", "Weekly visual & caliper analysis"],
    linkText: "Explore Men's Coaching",
  },
  {
    number: "02",
    slug: "/womens-wellness",
    title: "Women's Wellness & Lifestyle",
    tagline: "Hormone harmony, metabolic resilience, and body recomposition.",
    desc: "A compassionate, scientifically calculated methodology designed to help women tone their physique, balance endocrine health, regulate cortisol, and cultivate food freedom.",
    features: ["Menstrual cycle-synced nutrition", "Metabolic recovery & reverse dieting", "Thyroid & adrenal support", "Sustainable lifestyle nutrition"],
    linkText: "Explore Women's Wellness",
  },
  {
    number: "03",
    slug: "/pcos-nutrition",
    title: "PCOS / PCOD Clinical Nutrition",
    tagline: "Insulin sensitivity, inflammation control, and hormonal balance.",
    desc: "Clinical nutrition guidance specifically formulated to address the root drivers of Polycystic Ovary Syndrome without destructive starvation or extreme deprivation.",
    features: ["Low-glycemic insulin regulation", "Anti-inflammatory nutrient dense meal plans", "Ovarian health & androgen balancing", "Digestive & gut microbiome repair"],
    linkText: "Explore PCOS Support",
  },
  {
    number: "04",
    slug: "/bodybuilding-prep",
    title: "Bodybuilding & Contest Preparation",
    tagline: "Peak conditioning, stage readiness, and precision peaking.",
    desc: "The gold standard in competitive physique prep. Every gram, water cycle, sodium manipulation, and peak week protocol calculated with surgical accuracy.",
    features: ["Staged fat-loss deficit phases", "Peak week sodium, water & carb depletion/loading", "Posing, condition & stage presentation audits", "Structured post-show recovery plan"],
    linkText: "Explore Contest Prep",
  },
  {
    number: "05",
    slug: "/personalised-diet",
    title: "Personalised Diet Planning",
    tagline: "Custom nutrition built strictly around your lifestyle and preferences.",
    desc: "For high-performing individuals and executives who require an exact nutritional roadmap tailored around busy schedules, travel, and bespoke dietary preferences.",
    features: ["Exact macronutrient & calorie targets", "Dining out & travel strategies", "Micronutrient sufficiency audit", "Bi-weekly strategy calibrations"],
    linkText: "Explore Diet Planning",
  },
  {
    number: "06",
    slug: "/sports-nutrition",
    title: "Sports Performance Nutrition",
    tagline: "Fueling speed, endurance, power output, and rapid recovery.",
    desc: "Advanced nutrition protocols tailored for competitive athletes seeking enhanced power output, glycogen replenishment, and rapid post-training recovery.",
    features: ["Intra-workout & peri-workout nutrition", "Hydration & electrolyte balance", "Muscle glycogen optimization", "Endurance & anaerobic support"],
    linkText: "Explore Sports Nutrition",
  },
];

function ServicesPage() {
  return (
    <main>
      <SiteHeader isSolid />

      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge">02 · Coaching Programs</span>
          <h1>
            COACHING, WITH<br />
            <em>uncompromising purpose.</em>
          </h1>
          <p className="page-hero-desc">
            At {brand.name}, we don't believe in generic advice. Every physique goal demands its own specialised architecture, meticulous monitoring, and clinical strategy.
          </p>
          <div className="page-hero-actions">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Book Consultation <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/approach">
                View our 4-stage process
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="page-section section-wrap bg-cream">
        <div className="space-y-12">
          {serviceList.map((service) => (
            <div key={service.number} className="page-card !p-8 md:!p-12 hover:border-primary">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-border">
                <div>
                  <span className="text-xs font-bold text-primary tracking-widest">{service.number} · PROGRAM</span>
                  <h2 className="text-3xl md:text-4xl font-display font-medium text-charcoal mt-2 mb-2">
                    {service.title}
                  </h2>
                  <p className="text-xs font-semibold text-primary">{service.tagline}</p>
                </div>
                <Button asChild variant="outline" className="self-start border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                  <Link to={service.slug}>
                    {service.linkText} <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>

              <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {service.desc}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {service.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-medium text-charcoal bg-secondary/60 p-2.5 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Program Comparison Matrix Section */}
      <section className="page-section section-wrap bg-secondary">
        <div className="max-w-4xl mx-auto mb-10 text-center">
          <span className="text-xs font-bold text-primary tracking-widest uppercase block mb-2">
            02.1 · Direct Comparison
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-medium text-charcoal">
            Find the Exact Architecture for Your Goals
          </h2>
          <p className="text-xs text-muted-foreground mt-2 max-w-xl mx-auto leading-relaxed">
            Every tier delivers 100% bio-individual coaching, but each specializes in distinct physiological and lifestyle requirements.
          </p>
        </div>

        <div className="bg-card border border-border rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/70 border-b border-border text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Program</th>
                  <th className="py-3.5 px-4">Primary Target</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Training Integration</th>
                  <th className="py-3.5 px-4">Check-in Cadence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-4 font-bold text-charcoal">
                    <Link to="/mens-coaching" className="text-primary hover:underline">
                      Men's Coaching
                    </Link>
                  </td>
                  <td className="py-4 px-4 text-muted-foreground">Lean Hypertrophy & Recomposition</td>
                  <td className="py-4 px-4 font-mono">16 — 24 wks</td>
                  <td className="py-4 px-4 font-medium text-charcoal">Full Hypertrophy Split</td>
                  <td className="py-4 px-4 font-semibold text-primary">Weekly 1-on-1</td>
                </tr>

                <tr className="hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-4 font-bold text-charcoal">
                    <Link to="/womens-wellness" className="text-primary hover:underline">
                      Women's Wellness
                    </Link>
                  </td>
                  <td className="py-4 px-4 text-muted-foreground">Hormone Harmony & Reverse Dieting</td>
                  <td className="py-4 px-4 font-mono">16 — 24 wks</td>
                  <td className="py-4 px-4 font-medium text-charcoal">Cycle-Synced Training</td>
                  <td className="py-4 px-4 font-semibold text-primary">Weekly 1-on-1</td>
                </tr>

                <tr className="hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-4 font-bold text-charcoal">
                    <Link to="/pcos-nutrition" className="text-primary hover:underline">
                      PCOS / PCOD Support
                    </Link>
                  </td>
                  <td className="py-4 px-4 text-muted-foreground">Insulin & Androgen Regulation</td>
                  <td className="py-4 px-4 font-mono">16 — 20 wks</td>
                  <td className="py-4 px-4 font-medium text-charcoal">Cortisol-Friendly Movement</td>
                  <td className="py-4 px-4 font-semibold text-primary">Weekly 1-on-1</td>
                </tr>

                <tr className="hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-4 font-bold text-charcoal">
                    <Link to="/bodybuilding-prep" className="text-primary hover:underline">
                      Bodybuilding Prep
                    </Link>
                  </td>
                  <td className="py-4 px-4 text-muted-foreground">Stage Conditioning & Peak Week</td>
                  <td className="py-4 px-4 font-mono">20 — 32 wks</td>
                  <td className="py-4 px-4 font-medium text-charcoal">Strict Periodized Splits</td>
                  <td className="py-4 px-4 font-semibold text-primary">Daily in Peak Week</td>
                </tr>

                <tr className="hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-4 font-bold text-charcoal">
                    <Link to="/personalised-diet" className="text-primary hover:underline">
                      Personalised Diet
                    </Link>
                  </td>
                  <td className="py-4 px-4 text-muted-foreground">Executive Recomposition & Travel</td>
                  <td className="py-4 px-4 font-mono">12 — 16 wks</td>
                  <td className="py-4 px-4 font-medium text-charcoal">Flexible Resistance Plan</td>
                  <td className="py-4 px-4 font-semibold text-primary">Bi-Weekly Review</td>
                </tr>

                <tr className="hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-4 font-bold text-charcoal">
                    <Link to="/sports-nutrition" className="text-primary hover:underline">
                      Sports Performance
                    </Link>
                  </td>
                  <td className="py-4 px-4 text-muted-foreground">Power Output & Glycogen Fueling</td>
                  <td className="py-4 px-4 font-mono">12 — 24 wks</td>
                  <td className="py-4 px-4 font-medium text-charcoal">Sport-Specific Loading</td>
                  <td className="py-4 px-4 font-semibold text-primary">Weekly 1-on-1</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="page-section section-wrap bg-olive-deep text-paper">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <p className="text-xs font-bold tracking-widest text-gold-accent uppercase">Tailored Consultation</p>
          <h2 className="text-4xl md:text-5xl font-display font-medium">
            Not sure which program matches your goals?
          </h2>
          <p className="text-sm text-paper-soft leading-relaxed max-w-xl mx-auto">
            Our coaching directors review every applicant individually to recommend the exact nutritional and coaching protocol suited to your lifestyle and metabolism.
          </p>
          <div className="pt-4">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Schedule a consultation <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
