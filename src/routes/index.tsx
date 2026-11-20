import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import athleteImage from "@/assets/white-portion-editorial.jpg";
import nutritionImage from "@/assets/white-portion-nutrition.jpg";
import { brand, organizationJsonLd } from "@/lib/brand";

const services = [
  ["01", "Personalised diet planning", "Nutrition strategies shaped around your individual goals, training, and everyday life."],
  ["02", "Bodybuilding & contest preparation", "Structured guidance and peak week protocol for physique athletes working toward the stage."],
  ["03", "Men's coaching & muscle building", "A considered approach to progressive strength, nutrition support, and muscle retention."],
  ["04", "Women's wellness & lifestyle", "Tailored metabolic nutrition, hormonal health, body recomposition, and sustainable routines."],
  ["05", "PCOS/PCOD nutrition support", "Specialised dietary protocols focused on insulin sensitivity, inflammation management, and hormone balance."],
  ["06", "Fat loss & cutting", "Goal-focused planning designed to support progress and lean muscle definition."],
  ["07", "Sports performance nutrition", "Practical nutrition strategies to elevate training output and athletic performance."],
];

const stages = [
  ["01", "Assess", "We learn about your current routine, physique, and goals."],
  ["02", "Plan", "We build a nutrition strategy around your individual requirements."],
  ["03", "Monitor", "We follow consistency and progress as your plan takes shape."],
  ["04", "Refine", "We adapt the approach in response to your feedback and progress."],
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: brand.title },
      { name: "description", content: brand.description },
      { property: "og:site_name", content: brand.name },
      { property: "og:title", content: brand.title },
      { property: "og:description", content: brand.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: brand.title },
      { name: "twitter:description", content: brand.description },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(organizationJsonLd),
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0);
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  function submitEnquiry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const message = [
      `Hello ${brand.name}, I'm interested in starting a coaching enquiry.`,
      `Name: ${formData.get("name")}`,
      `Email: ${formData.get("email")}`,
      `Coaching focus: ${formData.get("focus")}`,
      `A little about my goals: ${formData.get("goals")}`,
    ].join("\n");
    setSubmitted(true);
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main>
      <div className="scroll-progress" style={{ transform: `scaleX(${scrollProgress / 100})` }} aria-hidden="true" />
      <SiteHeader />

      <section id="home" className="hero-section">
        <img className="hero-photo" src={athleteImage} alt="Athlete in a sunlit training studio — White Portion Wellness" width={1440} height={1152} fetchPriority="high" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow"><span className="eyebrow-mark" /> Precision nutrition. Powerful transformation.</p>
          <h1>YOUR PHYSIQUE.<br />YOUR DISCIPLINE.<br /><em>Your standard.</em></h1>
          <p className="hero-description">Personalised nutrition and professional physique preparation for those who take their goals seriously.</p>
          <Button asChild variant="hero"><a href="#coaching">Explore coaching <ArrowUpRight aria-hidden="true" /></a></Button>
        </div>
        <div className="hero-index"><span>01 / 04</span><span>Nutrition · Physique · Performance</span></div>
        <a href="#philosophy" className="scroll-cue" aria-label="Scroll to our philosophy"><span>Scroll to discover</span><ArrowDown aria-hidden="true" /></a>
      </section>

      <section id="philosophy" className="intro-section section-wrap">
        <div className="section-label"><span>01</span><span>Our philosophy</span></div>
        <div className="intro-content">
          <h2>NOT JUST A DIET.<br />A <em>strategy</em> built<br />around you.</h2>
          <div className="intro-detail">
            <p className="intro-lede">Every physique has a different requirement.</p>
            <p>At {brand.name}, we believe effective nutrition starts with understanding the individual. From muscle development to competition preparation, our approach is built around structured planning, consistency, and measurable progress.</p>
            <a className="text-link" href="#approach">Discover our approach <ArrowDownRight aria-hidden="true" /></a>
          </div>
        </div>
        <div className="intro-image-wrap">
          <img src={nutritionImage} alt="Carefully prepared salmon, greens, and rice — White Portion Wellness" width={1440} height={1024} loading="lazy" />
          <span className="image-caption">Considered nutrition. Made personal.</span>
          <span className="image-number">WPW — 01</span>
        </div>
      </section>

      <section id="coaching" className="services-section section-wrap">
        <div className="section-label"><span>02</span><span>What we do</span></div>
        <div className="services-heading">
          <h2>COACHING, WITH<br /><em>purpose.</em></h2>
          <p>Focused support for every stage of your physique journey.</p>
        </div>
        <div className="service-list">
          {services.map(([number, title, description]) => (
            <a href="#contact" className="service-row" key={number}>
              <span className="service-number">{number}</span>
              <span className="service-title">{title}</span>
              <span className="service-description">{description}</span>
              <ArrowUpRight className="service-arrow" aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      <section id="approach" className="approach-section">
        <div className="section-wrap approach-inner">
          <div className="section-label"><span>03</span><span>The {brand.name} approach</span></div>
          <div className="approach-heading">
            <h2>PRECISION IN<br />EVERY <em>portion.</em></h2>
            <p>A considered process. An individual plan. Progress that is built to last.</p>
          </div>
          <div className="stage-grid">
            {stages.map(([number, name, description]) => (
              <article className="stage-item" key={number}>
                <span className="stage-number">{number}</span>
                <span className="stage-rule" />
                <h3>{name}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="belief-section">
        <img src={athleteImage} alt="Athlete focused on a long-term training practice — White Portion Wellness" width={1440} height={1152} loading="lazy" />
        <div className="belief-overlay" />
        <div className="belief-content">
          <p className="eyebrow">The standard is yours to set</p>
          <h2>THE WORK<br />SPEAKS<br /><em>for itself.</em></h2>
          <p>Personalised nutrition. Structured coaching. A plan shaped around the person doing the work.</p>
          <Link className="light-link" to="/book-appointment">Book your consultation <ArrowUpRight aria-hidden="true" /></Link>
        </div>
        <span className="belief-aside">EARNED, NOT GIVEN — {brand.nameUpper}</span>
      </section>

      <section className="stories-section section-wrap">
        <div className="section-label"><span>04</span><span>Client stories</span></div>
        <div className="stories-content">
          <p className="eyebrow">Progress is personal</p>
          <h2>REAL WORK.<br /><em>Real stories.</em></h2>
          <p>Every transformation at {brand.name} deserves to be told in the client’s own words. We’ll share client journeys here when they’re ready to be shared.</p>
          <span className="stories-note">{brand.name} client stories coming soon</span>
        </div>
      </section>

      <section id="contact" className="contact-section">
        <div className="section-wrap contact-inner">
          <div className="section-label"><span>05</span><span>Start a conversation</span></div>
          <div className="contact-layout">
            <div className="contact-copy">
              <p className="eyebrow">Your next chapter</p>
              <h2>YOUR NEXT<br />PHYSIQUE<br />STARTS WITH<br /><em>a plan.</em></h2>
              <p>Take the first step toward a more structured approach to nutrition and physique development.</p>
              <span className="contact-prompt">Tell us where you want to go.</span>
            </div>
            <form className="enquiry-form" onSubmit={submitEnquiry}>
              <label htmlFor="name">Your name</label>
              <input id="name" name="name" autoComplete="name" placeholder="Name" required />
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              <label htmlFor="focus">Coaching focus</label>
              <select id="focus" name="focus" defaultValue="" required>
                <option value="" disabled>Select an area</option>
                <option>Personalised diet planning</option>
                <option>Bodybuilding & contest preparation</option>
                <option>Men's coaching & muscle building</option>
                <option>Women's wellness & lifestyle</option>
                <option>PCOS/PCOD nutrition support</option>
                <option>Fat loss & cutting</option>
                <option>Sports performance nutrition</option>
              </select>
              <label htmlFor="goals">What are you working toward?</label>
              <textarea id="goals" name="goals" rows={3} placeholder="Share a little about your goals" required />
              <Button type="submit" variant="hero" className="submit-button">Continue with WhatsApp <ArrowUpRight aria-hidden="true" /></Button>
              {submitted && <p className="form-note" role="status">Your message is ready in WhatsApp. Choose a contact to send your enquiry.</p>}
              <p className="form-footnote">Your details will be added to a message for you to review before sending.</p>
            </form>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}