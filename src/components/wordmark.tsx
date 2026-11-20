import { brand } from "@/lib/brand";

type WordmarkProps = {
  className?: string;
  href?: string;
};

export function Wordmark({ className = "", href = "/" }: WordmarkProps) {
  return (
    <a className={`wordmark ${className}`.trim()} href={href} aria-label={`${brand.name} home`}>
      <span className="wordmark-line">WHITE <span>PORTION</span></span>
      <span className="wordmark-sub">WELLNESS<i>®</i></span>
    </a>
  );
}
