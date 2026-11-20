export const brand = {
  name: "White Portion Wellness",
  nameUpper: "WHITE PORTION WELLNESS",
  tagline: "Precision Nutrition. Powerful Transformation.",
  title: "White Portion Wellness | Nutrition, Bodybuilding & Wellness Coaching",
  description:
    "Discover personalised nutrition, bodybuilding preparation, women's wellness, PCOS/PCOD nutrition support, and physique coaching with White Portion Wellness.",
  shareDescription:
    "Discover personalised nutrition, bodybuilding preparation, women's wellness, PCOS/PCOD nutrition support, and physique coaching with White Portion Wellness.",
} as const;

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: brand.name,
  legalName: brand.nameUpper,
  description: brand.description,
  slogan: brand.tagline,
  url: "https://white-portion-pixel-portrait.lovable.app",
  brand: {
    "@type": "Brand",
    name: brand.name,
    slogan: brand.tagline,
  },
} as const;
