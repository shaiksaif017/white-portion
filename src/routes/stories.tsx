import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Quote, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import athleteImage from "@/assets/white-portion-editorial.jpg";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/stories")({
  head: () => ({
    meta: [
      { title: `Client Transformations & Stories | ${brand.name}` },
      {
        name: "description",
        content: `Read real transformation stories, testimonials, and case studies from athletes and clients coached by ${brand.name}.`,
      },
      { property: "og:title", content: `Client Stories | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: StoriesPage,
});

const caseStudies = [
  {
    client: "Marcus V.",
    focus: "Men's Coaching & Hypertrophy",
    duration: "24 Weeks",
    achievement: "+6.8 kg Lean Mass · Body Fat Reduced to 9.2%",
    quote:
      "I had been lifting for five years without making noticeable progress. White Portion Wellness completely overhauled my carbohydrate timing, dialed in my digestive health, and gave me an exact roadmap. The physical and mental difference is night and day.",
    breakdown: "Overcame chronic digestive bloating by removing identified intolerances; instituted carb cycling around heavy compound lifting days.",
  },
  {
    client: "Elena R.",
    focus: "PCOS Nutrition & Women's Wellness",
    duration: "20 Weeks",
    achievement: "Restored 28-Day Natural Cycle · -11.5 kg Fat Loss",
    quote:
      "My doctor told me I would always struggle with my weight because of PCOS. The White Portion Wellness team proved otherwise. For the first time in years, my blood sugar is stable, my acne cleared up, and I have boundless daily energy without starving myself.",
    breakdown: "Flattened glucose spikes via targeted meal sequencing; addressed adrenal fatigue and elevated DHEA with anti-inflammatory whole foods.",
  },
  {
    client: "David K.",
    focus: "Contest Preparation (Classic Physique)",
    duration: "18 Weeks",
    achievement: "1st Place Class Champion · Peak Week Perfection",
    quote:
      "Peak week was the calmest and most scientific experience of my competitive career. No dangerous dehydrating protocols or guessing games. Stepped on stage full, shredded, and vascular. Unbeatable standard of coaching.",
    breakdown: "Staged 18-week linear deficit; preserved maximum lean tissue using leucine thresholds; executed scientific sodium and glycogen supercompensation.",
  },
  {
    client: "Sarah M.",
    focus: "Lifestyle Recomposition & Executive Wellness",
    duration: "16 Weeks",
    achievement: "18% Body Fat Recomposition · Built Lifelong Autonomy",
    quote:
      "As a corporate executive traveling 2 weeks a month, I assumed coaching wouldn't work for my lifestyle. White Portion Wellness taught me how to navigate business dinners, hotel dining, and busy weeks without falling off track.",
    breakdown: "Designed flexible modular meal frameworks that accommodate high-stress work and international business travel.",
  },
];

function StoriesPage() {
  return (
    <main>
      <SiteHeader isSolid />

      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge">04 · Transformation Journeys</span>
          <h1>
            REAL WORK.<br />
            REAL PEOPLE.<br />
            <em>Unquestionable proof.</em>
          </h1>
          <p className="page-hero-desc">
            Behind every transformation is a client who made the commitment, and a strategy that eliminated the guesswork. Here are some of the journeys we have had the privilege to direct.
          </p>
          <div className="page-hero-actions">
            <Button asChild variant="hero">
              <Link to="/contact">
                Start your transformation <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="page-section section-wrap bg-cream">
        <div className="section-label mb-12">
          <span>04.1</span>
          <span>Featured Case Studies</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {caseStudies.map((study, idx) => (
            <div key={idx} className="page-card !p-8 md:!p-10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div>
                    <h3 className="text-xl font-bold font-sans text-charcoal">{study.client}</h3>
                    <p className="text-xs text-primary font-semibold">{study.focus}</p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 bg-secondary rounded text-olive-deep">
                    {study.duration}
                  </span>
                </div>

                <div className="my-6">
                  <div className="flex items-center gap-1 text-gold-accent mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current text-primary" />
                    ))}
                  </div>
                  <div className="relative">
                    <Quote className="w-8 h-8 text-primary/20 absolute -top-4 -left-2 -z-10" />
                    <p className="text-sm font-display text-charcoal italic leading-relaxed pl-2">
                      "{study.quote}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border mt-4">
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                  Key Result:
                </div>
                <div className="text-sm font-bold text-charcoal mb-3">
                  {study.achievement}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-charcoal">Strategy:</span> {study.breakdown}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="belief-section">
        <img
          src={athleteImage}
          alt="Focused athlete preparing for high performance — White Portion Wellness"
          width={1440}
          height={1152}
          loading="lazy"
        />
        <div className="belief-overlay" />
        <div className="belief-content">
          <p className="eyebrow">Your story is next</p>
          <h2>THE WORK<br />SPEAKS<br /><em>for itself.</em></h2>
          <p>
            Whether your goal is stepping on the competitive stage or stepping into vibrant health and confidence, we build your strategy together.
          </p>
          <Link to="/contact" className="light-link">
            Schedule your consultation <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        <span className="belief-aside">EARNED, NOT GIVEN — {brand.nameUpper}</span>
      </section>

      <SiteFooter />
    </main>
  );
}
