import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import athleteImage from "@/assets/white-portion-editorial.jpg";
import nutritionImage from "@/assets/white-portion-nutrition.jpg";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `About Us | ${brand.name}` },
      {
        name: "description",
        content: `Learn about ${brand.name}'s philosophy, high-performance coaching ethos, and scientifically structured approach to nutrition and physique development.`,
      },
      { property: "og:title", content: `About Us | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: AboutPage,
});

const principles = [
  {
    number: "01",
    title: "Bio-Individuality Above All",
    desc: "No two metabolisms, hormonal profiles, or daily schedules are identical. We reject cookie-cutter templates in favour of custom-calculated macronutrient targets and food selections tailored strictly to your physiology.",
  },
  {
    number: "02",
    title: "Evidence-Based Rigour",
    desc: "Every recommendation we make is grounded in peer-reviewed clinical nutrition science, exercise physiology, and real-world empirical coaching outcomes.",
  },
  {
    number: "03",
    title: "Relentless Accountability",
    desc: "True transformation demands consistent evaluation. Through structured weekly biofeedback reviews and metabolic monitoring, we eliminate guesswork and ensure forward momentum.",
  },
  {
    number: "04",
    title: "Longevity & Peak Health",
    desc: "Whether preparing for the competitive bodybuilding stage or reversing insulin resistance, metabolic health and long-term vitality remain non-negotiable foundations.",
  },
];

function AboutPage() {
  return (
    <main>
      <SiteHeader isSolid />

      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge">01 · About The Practice</span>
          <h1>
            NOT JUST A DIET.<br />
            A <em>standard</em> built around you.
          </h1>
          <p className="page-hero-desc">
            {brand.name} was founded on a simple conviction: transformative physique results and true metabolic vitality require ruthless precision, scientific discipline, and personalized guidance.
          </p>
          <div className="page-hero-actions">
            <Button asChild variant="hero">
              <Link to="/contact">
                Begin your enquiry <ArrowUpRight aria-hidden="true" />
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

      <section className="page-section section-wrap bg-cream">
        <div className="editorial-grid">
          <div>
            <div className="section-label mb-6">
              <span>01.1</span>
              <span>Our Philosophy</span>
            </div>
            <div className="prose-editorial">
              <h2>PRECISION OVER<br /><em>guesswork.</em></h2>
              <p>
                In an industry overflowing with unsustainable fad diets and arbitrary restrictions, {brand.name} provides an intelligent, structured antidote. We believe your physique is a direct reflection of your daily habits, metabolic health, and nutritional strategy.
              </p>
              <p>
                Whether our clients are elite physique competitors striving for single-digit body fat or busy professionals navigating hormonal conditions like PCOS/PCOD, our protocols are engineered for clear, repeatable results without compromising well-being.
              </p>
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Custom macronutrient & micronutrient periodization</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Weekly biofeedback audits (energy, digestion, sleep, mood)</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Hormonal optimization & clinical bloodwork analysis</span>
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
            <span className="image-number">WPW — 02</span>
          </div>
        </div>
      </section>

      <section className="page-section section-wrap bg-secondary">
        <div className="section-label mb-10">
          <span>01.2</span>
          <span>Core Principles</span>
        </div>
        <div className="page-grid-2">
          {principles.map((item) => (
            <div key={item.number} className="page-card">
              <span className="text-xs font-bold text-primary">{item.number}</span>
              <h3 className="page-card-title">{item.title}</h3>
              <p className="page-card-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="belief-section">
        <img
          src={athleteImage}
          alt="Athlete focused on long-term discipline — White Portion Wellness"
          width={1440}
          height={1152}
          loading="lazy"
        />
        <div className="belief-overlay" />
        <div className="belief-content">
          <p className="eyebrow">The standard is yours to set</p>
          <h2>THE WORK<br />SPEAKS<br /><em>for itself.</em></h2>
          <p>
            We don't sell shortcuts. We design comprehensive, unshakeable blueprints and support you through every stage of execution.
          </p>
          <Link to="/contact" className="light-link">
            Speak with our coaching team <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        <span className="belief-aside">EARNED, NOT GIVEN — {brand.nameUpper}</span>
      </section>

      <SiteFooter />
    </main>
  );
}
