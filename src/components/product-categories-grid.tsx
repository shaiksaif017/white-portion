// The four product categories as cards (used on /products and the Services & Products hub).
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { KindIcon } from "@/components/shop-ui";
import { Button } from "@/components/ui/button";
import type { ProductCategory } from "@/lib/shop-types";

export function ProductCategoriesGrid({ categories }: { categories: ProductCategory[] }) {
  const tops = categories.filter((c) => c.parentId === null);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {tops.map((cat) => {
        const subs = categories.filter((c) => c.parentId === cat.id);
        return (
          <div
            key={cat.id}
            className="page-card !p-7 md:!p-9 flex flex-col gap-4 hover:border-primary transition-colors"
          >
            <div className="flex items-start gap-4">
              <span className="w-12 h-12 flex-shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <KindIcon kind={cat.kind} />
              </span>
              <div>
                <h3 className="text-2xl font-display font-medium text-charcoal leading-tight">
                  {cat.name}
                </h3>
                <p className="text-[11px] font-semibold text-primary mt-1">
                  {cat.productCount > 0
                    ? `${cat.productCount} product${cat.productCount === 1 ? "" : "s"}`
                    : "Coming soon"}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{cat.description}</p>
            {subs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {subs.map((s) => (
                  <Link
                    key={s.id}
                    to="/products/$category"
                    params={{ category: cat.slug }}
                    search={{ sub: s.slug }}
                    className="text-[11px] font-medium text-charcoal bg-secondary/70 hover:bg-primary hover:text-primary-foreground px-3 py-1.5 rounded transition-colors"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-auto pt-2">
              <Button
                asChild
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Link to="/products/$category" params={{ category: cat.slug }}>
                  View {cat.name} <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
