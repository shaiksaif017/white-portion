import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

type SiteHeaderProps = {
  isSolid?: boolean;
};

export function SiteHeader({ isSolid = false }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesDropdown, setServicesDropdown] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
    setServicesDropdown(false);
  }

  return (
    <header className={`site-header ${isSolid ? "is-solid" : ""}`.trim()}>
      <Wordmark href="/" />

      <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
        <Link to="/" onClick={closeMenu} activeProps={{ className: "nav-active" }} activeOptions={{ exact: true }}>
          Home
        </Link>
        <Link to="/about" onClick={closeMenu} activeProps={{ className: "nav-active" }}>
          About Us
        </Link>
        <div 
          className="nav-dropdown-wrap"
          onMouseEnter={() => setServicesDropdown(true)}
          onMouseLeave={() => setServicesDropdown(false)}
        >
          <Link to="/services" onClick={closeMenu} className="dropdown-trigger" activeProps={{ className: "nav-active" }}>
            <span>Coaching & Services</span>
            <ChevronDown className="dropdown-chevron" aria-hidden="true" />
          </Link>
          <div className={`nav-dropdown-menu ${servicesDropdown ? "is-visible" : ""}`}>
            <Link to="/services" onClick={closeMenu}>All Services Overview</Link>
            <Link to="/mens-coaching" onClick={closeMenu}>Men's Coaching & Hypertrophy</Link>
            <Link to="/womens-wellness" onClick={closeMenu}>Women's Wellness & Lifestyle</Link>
            <Link to="/pcos-nutrition" onClick={closeMenu}>PCOS / PCOD Clinical Nutrition</Link>
            <Link to="/bodybuilding-prep" onClick={closeMenu}>Bodybuilding & Contest Prep</Link>
            <Link to="/personalised-diet" onClick={closeMenu}>Personalised Diet Planning</Link>
            <Link to="/sports-nutrition" onClick={closeMenu}>Sports Performance Nutrition</Link>
          </div>
        </div>
        <Link to="/approach" onClick={closeMenu} activeProps={{ className: "nav-active" }}>
          The Approach
        </Link>
        <Link to="/stories" onClick={closeMenu} activeProps={{ className: "nav-active" }}>
          Client Stories
        </Link>
        <Link to="/blog" onClick={closeMenu} activeProps={{ className: "nav-active" }}>
          Journal
        </Link>
        <Link to="/book-appointment" onClick={closeMenu} className="font-bold text-gold-accent" activeProps={{ className: "nav-active" }}>
          BOOK AN APPOINTMENT
        </Link>
      </nav>

      <Button asChild className="header-cta !bg-primary hover:!bg-olive-deep text-paper font-bold tracking-wider">
        <Link to="/book-appointment">
          BOOK AN APPOINTMENT <ArrowUpRight aria-hidden="true" />
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="menu-toggle"
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? <X /> : <Menu />}
      </Button>
    </header>
  );
}
