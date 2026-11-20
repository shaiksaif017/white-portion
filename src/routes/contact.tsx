import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, MessageSquare, Mail, Phone, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { brand } from "@/lib/brand";
import { whatsappUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: `Contact & Consultation Enquiry | ${brand.name}` },
      {
        name: "description",
        content: `Begin your coaching enquiry with ${brand.name}. Apply for personalised nutrition, bodybuilding preparation, women's wellness, or PCOS nutrition support.`,
      },
      { property: "og:title", content: `Contact & Consultation | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const message = [
      `*New Coaching Enquiry - ${brand.name}*`,
      `*Name:* ${formData.get("name")}`,
      `*Email:* ${formData.get("email")}`,
      `*Phone:* ${formData.get("phone") || "Not provided"}`,
      `*Focus Area:* ${formData.get("focus")}`,
      `*Experience Level:* ${formData.get("experience")}`,
      `*Goals & Background:* ${formData.get("goals")}`,
    ].join("\n");

    setSubmitted(true);
    window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
  }

  return (
    <main>
      <SiteHeader isSolid />

      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge">06 · Initial Consultation</span>
          <h1>
            YOUR NEXT PHYSIQUE<br />
            STARTS WITH<br />
            <em>a deliberate plan.</em>
          </h1>
          <p className="page-hero-desc">
            Take the first step toward structured, evidence-based nutrition and physique coaching. Use our real-time interactive calendar to reserve an online or studio consultation.
          </p>
          <div className="pt-2">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                BOOK AN APPOINTMENT <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="page-section section-wrap bg-cream">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-8">
            <div className="section-label">
              <span>06.1</span>
              <span>The Intake Process</span>
            </div>
            <div className="prose-editorial">
              <h2>DIRECT ACCESS.<br /><em>Considered review.</em></h2>
              <p>
                Every enquiry is personally reviewed by our coaching directors. We carefully evaluate your current baseline, goals, and schedule to ensure our coaching philosophy matches your commitment level.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4 p-4 bg-secondary/80 rounded border border-border">
                <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">Fast-Track Via WhatsApp</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Direct communication with our admissions team for immediate questions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-secondary/80 rounded border border-border">
                <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">Response Window</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    All consultation applications receive a structured reply within 24 business hours.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-secondary/80 rounded border border-border">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">Zero Obligation Assessment</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Initial intake analysis provides actionable clarity whether you proceed or not.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-charcoal text-paper p-8 md:p-12 rounded border border-rule-light">
            <div className="mb-8">
              <span className="text-xs font-bold text-gold-accent tracking-widest uppercase">Consultation Application</span>
              <h3 className="text-2xl md:text-3xl font-display font-medium mt-1">
                Tell us about your goals.
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-paper-soft mb-2">
                    Full Name *
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Your full name"
                    className="w-full bg-paper/5 border border-rule-light rounded p-3 text-xs text-paper placeholder:text-paper-faint focus:border-gold-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-paper-soft mb-2">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@domain.com"
                    className="w-full bg-paper/5 border border-rule-light rounded p-3 text-xs text-paper placeholder:text-paper-faint focus:border-gold-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-paper-soft mb-2">
                    Phone / WhatsApp Number
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-paper/5 border border-rule-light rounded p-3 text-xs text-paper placeholder:text-paper-faint focus:border-gold-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="experience" className="block text-xs font-bold uppercase tracking-wider text-paper-soft mb-2">
                    Training Experience *
                  </label>
                  <select
                    id="experience"
                    name="experience"
                    defaultValue="Intermediate (2-5 years)"
                    required
                    className="w-full bg-olive-deep border border-rule-light rounded p-3 text-xs text-paper focus:border-gold-accent focus:outline-none"
                  >
                    <option value="Beginner (< 1 year)">Beginner (&lt; 1 year)</option>
                    <option value="Intermediate (1-3 years)">Intermediate (1-3 years)</option>
                    <option value="Advanced (3-6 years)">Advanced (3-6 years)</option>
                    <option value="Competitive Physique Athlete">Competitive Physique Athlete</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="focus" className="block text-xs font-bold uppercase tracking-wider text-paper-soft mb-2">
                  Primary Coaching Focus *
                </label>
                <select
                  id="focus"
                  name="focus"
                  defaultValue=""
                  required
                  className="w-full bg-olive-deep border border-rule-light rounded p-3 text-xs text-paper focus:border-gold-accent focus:outline-none"
                >
                  <option value="" disabled>Select an area of focus</option>
                  <option value="Personalised Diet Planning">Personalised Diet Planning</option>
                  <option value="Men's Coaching & Hypertrophy">Men's Coaching & Hypertrophy</option>
                  <option value="Women's Wellness & Hormones">Women's Wellness & Hormones</option>
                  <option value="PCOS / PCOD Clinical Nutrition">PCOS / PCOD Clinical Nutrition</option>
                  <option value="Bodybuilding & Contest Preparation">Bodybuilding & Contest Preparation</option>
                  <option value="Fat Loss & Advanced Cutting">Fat Loss & Advanced Cutting</option>
                  <option value="Sports Performance Nutrition">Sports Performance Nutrition</option>
                </select>
              </div>

              <div>
                <label htmlFor="goals" className="block text-xs font-bold uppercase tracking-wider text-paper-soft mb-2">
                  What are you working toward? Any health or metabolic history? *
                </label>
                <textarea
                  id="goals"
                  name="goals"
                  rows={4}
                  required
                  placeholder="Share your goals, current training frequency, previous diets, or specific symptoms..."
                  className="w-full bg-paper/5 border border-rule-light rounded p-3 text-xs text-paper placeholder:text-paper-faint focus:border-gold-accent focus:outline-none resize-y"
                />
              </div>

              <Button type="submit" variant="hero" className="w-full !min-h-[50px] !text-xs font-bold tracking-wider">
                Send Application via WhatsApp <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>

              {submitted && (
                <div className="p-4 bg-primary/20 border border-primary text-gold-accent rounded text-xs leading-relaxed">
                  ✓ Your application has been compiled! A direct WhatsApp conversation has opened. Review your summary and tap send to connect immediately.
                </div>
              )}

              <p className="text-[10px] text-paper-faint text-center">
                Your details are strictly confidential and will never be shared. By submitting, you agree to receive direct coaching communications from {brand.name}.
              </p>
            </form>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
