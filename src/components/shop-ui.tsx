// Small shared pieces for the Services & Products pages, styled with the site's existing tokens.
import { Link } from "@tanstack/react-router";
import { BookOpen, Dumbbell, PlayCircle, Pill, Package, ShieldCheck } from "lucide-react";

import {
  type CategoryKind,
  type ProductSummary,
  AVAILABILITY_LABEL,
  formatINR,
  KIND_LABEL,
} from "@/lib/shop-types";

export function KindIcon({
  kind,
  className = "w-6 h-6",
}: {
  kind: CategoryKind;
  className?: string;
}) {
  const Icon =
    { physical: Dumbbell, ebook: BookOpen, course: PlayCircle, pharma: Pill }[kind] ?? Package;
  return <Icon className={className} aria-hidden="true" />;
}

export function Price({
  pricePaise,
  compareAtPaise,
  from = false,
}: {
  pricePaise: number;
  compareAtPaise: number | null;
  from?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="font-semibold text-charcoal">
        {from && <span className="text-[11px] font-normal text-muted-foreground mr-1">From</span>}
        {formatINR(pricePaise)}
      </span>
      {compareAtPaise !== null && compareAtPaise > pricePaise && (
        <>
          <span className="text-xs text-muted-foreground line-through">
            {formatINR(compareAtPaise)}
          </span>
          <span className="text-[10px] font-bold text-primary">
            SAVE {Math.round((1 - pricePaise / compareAtPaise) * 100)}%
          </span>
        </>
      )}
    </span>
  );
}

export function ProductImage({
  imageId,
  alt,
  kind,
  className = "",
}: {
  imageId: number | null;
  alt: string;
  kind: CategoryKind;
  className?: string;
}) {
  if (imageId) {
    return (
      <img
        src={`/media/${imageId}`}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`w-full h-full flex items-center justify-center bg-secondary text-primary/50 ${className}`}
    >
      <KindIcon kind={kind} className="w-10 h-10" />
    </div>
  );
}

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group page-card !p-0 overflow-hidden flex flex-col hover:border-primary transition-colors"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {(product.isFeatured || product.isSample) && (
          <div className="absolute top-2 left-2 z-10 flex gap-1.5">
            {product.isFeatured && (
              <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-bold tracking-widest">
                FEATURED
              </span>
            )}
            {product.isSample && <SampleBadge />}
          </div>
        )}
        <ProductImage
          imageId={product.imageId}
          alt={product.name}
          kind={product.kind}
          className="transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-5 flex flex-col gap-2 flex-1">
        <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
          {product.categoryName}
        </span>
        <h3 className="font-display text-xl text-charcoal leading-tight">{product.name}</h3>
        {product.shortDescription && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {product.shortDescription}
          </p>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          {product.availability === "enquiry_only" ? (
            <span className="text-xs font-semibold text-charcoal">On enquiry</span>
          ) : (
            <Price
              pricePaise={product.pricePaise}
              compareAtPaise={product.compareAtPaise}
              from={product.hasVariants}
            />
          )}
          <span
            className={`text-[10px] font-semibold ${product.availability === "out_of_stock" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {product.availability === "digital"
              ? KIND_LABEL[product.kind]
              : AVAILABILITY_LABEL[product.availability]}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function TrustRow() {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> Secure payments
      </span>
      <span className="inline-flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> Digital products
        delivered after verified payment
      </span>
    </div>
  );
}

// Marks demo content so it is never mistaken for a real product or order.
export function SampleBadge() {
  return (
    <span
      title="Sample data for testing. Remove it from Admin → Products → Sample data."
      className="px-2 py-0.5 rounded bg-gold-accent text-charcoal text-[9px] font-bold tracking-widest"
    >
      SAMPLE
    </span>
  );
}
