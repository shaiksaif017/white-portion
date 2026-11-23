import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { ProductCategoriesGrid } from "@/components/product-categories-grid";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { SERVICES } from "@/lib/services-data";
import { getShopCategories } from "@/lib/shop-api";

export const Route = createFileRoute("/services-products")({
  loader: () => getShopCategories(),
  head: () => ({
    meta: [
      { title: `Services & Products | ${brand.name}` },
      {
        name: "description",
        content: `Coaching services, supplements, e-books, online courses and healthcare products from ${brand.name}.`,
      },
      { property: "og:title", content: `Services & Products | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: ServicesProductsPage,
});

function ServicesProductsPage() {
  const { categories } = Route.useLoaderData();

  return (
    <main>
      <SiteHeader isSolid />

      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge">05 · Services & Products</span>
          <h1>
            EVERYTHING YOU NEED,
            <br />
            <em>held to one standard.</em>
          </h1>
          <p className="page-hero-desc">
            Work one-to-one with our coaches, or support your progress with carefully selected
            supplements, guides, courses and healthcare products.
          </p>
          <div className="page-hero-actions">
            <Button asChild variant="hero">
              <a href="#services">
                Coaching services <ArrowUpRight aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="heroOutline">
              <a href="#products">Shop products</a>
            </Button>
          </div>
        </div>
      </section>

      {/* A. SERVICES */}
      <section id="services" className="page-section section-wrap bg-cream scroll-mt-24">
        <div className="mb-10 max-w-2xl">
          <span className="text-xs font-bold text-primary tracking-widest uppercase block mb-2">
            A · Services
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-medium text-charcoal">
            One-to-one coaching programmes
          </h2>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            Personalised coaching with regular check-ins and direct support from your coach.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((s) => (
            <Link
              key={s.slug}
              to={s.slug}
              className="group page-card !p-7 flex flex-col gap-3 hover:border-primary transition-colors"
            >
              <span className="text-xs font-bold text-primary tracking-widest">
                {s.number} · PROGRAMME
              </span>
              <h3 className="text-2xl font-display font-medium text-charcoal leading-tight">
                {s.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.tagline}</p>
              <span className="mt-auto pt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary">
                Explore programme
                <ArrowRight
                  className="w-4 h-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* B. PRODUCTS */}
      <section id="products" className="page-section section-wrap bg-secondary scroll-mt-24">
        <div className="mb-10 max-w-2xl">
          <span className="text-xs font-bold text-primary tracking-widest uppercase block mb-2">
            B · Products
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-medium text-charcoal">
            Shop by category
          </h2>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            Supplements, digital guides, online courses and healthcare essentials.
          </p>
        </div>
        <ProductCategoriesGrid categories={categories} />
      </section>

      <section className="page-section section-wrap bg-olive-deep text-paper">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <p className="text-xs font-bold tracking-widest text-gold-accent uppercase">
            Not sure where to start?
          </p>
          <h2 className="text-4xl md:text-5xl font-display font-medium">Talk to our team first.</h2>
          <p className="text-sm text-paper-soft leading-relaxed max-w-xl mx-auto">
            Book a consultation and we'll recommend the right programme or products for your goals.
          </p>
          <div className="pt-4">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Book a consultation <ArrowUpRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
