import { brand } from "@/lib/brand";

type WordmarkProps = {
  className?: string;
  href?: string;
  // "horizontal": hexagon + name side by side (header). "stacked": original layout (footer).
  variant?: "horizontal" | "stacked";
};

// White logo on transparent background; used on the site's dark header and footer.
const LOGOS = {
  horizontal: { src: "/brand/logo-horizontal.png", width: 388, height: 88 },
  stacked: { src: "/brand/logo-stacked.png", width: 480, height: 425 },
} as const;

export function Wordmark({ className = "", href = "/", variant = "horizontal" }: WordmarkProps) {
  const logo = LOGOS[variant];
  return (
    <a
      className={`wordmark wordmark-${variant} ${className}`.trim()}
      href={href}
      aria-label={`${brand.name} home`}
    >
      <img src={logo.src} width={logo.width} height={logo.height} alt={brand.name} decoding="async" />
    </a>
  );
}
