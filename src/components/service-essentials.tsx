import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { serviceBySlug } from "@/lib/services-data";
import { whatsappUrl } from "@/lib/whatsapp";

// "Who it's for / What you receive / Benefits" block shared by the six service pages.
export function ServiceEssentialsSection({ slug }: { slug: string }) {
  const s = serviceBySlug(slug);
  if (!s) return null;
  const columns = [
    { title: "Who it's for", items: s.whoFor },
    { title: "What you receive", items: s.receive },
    { title: "Benefits", items: s.benefits },
  ];
  return (
    <section className="page-section section-wrap bg-cream">
      <div className="mb-10 max-w-2xl">
        <span className="text-xs font-bold text-primary tracking-widest uppercase block mb-2">
          Programme at a glance
        </span>
        <h2 className="text-3xl md:text-4xl font-display font-medium text-charcoal">{s.title}</h2>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{s.tagline}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((col) => (
          <div key={col.title} className="page-card !p-7">
            <h3 className="text-xs font-bold tracking-widest text-primary uppercase mb-4">
              {col.title}
            </h3>
            <ul className="space-y-3">
              {col.items.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-charcoal leading-relaxed">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="hero">
          <Link to="/book-appointment">
            Book a consultation <ArrowUpRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <a
            href={whatsappUrl(
              `Hello White Portion Wellness! I'd like to know more about ${s.title}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Enquire on WhatsApp
          </a>
        </Button>
      </div>
      <p className="mt-6 text-[11px] text-muted-foreground max-w-2xl leading-relaxed">
        Coaching provides nutrition and lifestyle guidance and does not replace medical advice.
        Individual results vary.
      </p>
    </section>
  );
}
