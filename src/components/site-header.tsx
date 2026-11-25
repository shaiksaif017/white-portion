import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X, ChevronDown, ShoppingBag, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { useCartCount } from "@/lib/cart";
import { SERVICES } from "@/lib/services-data";
import { DEFAULT_CATEGORIES } from "@/lib/shop-types";

type SiteHeaderProps = {
  isSolid?: boolean;
};

// Matches the CSS breakpoint where the menu becomes the phone menu (max-width: 640px).
function isDesktopNav() {
  return window.matchMedia("(min-width: 641px)").matches;
}

export function SiteHeader({ isSolid = false }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesDropdown, setServicesDropdown] = useState(false);
  const cartCount = useCartCount();

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
          className={`nav-dropdown-wrap${servicesDropdown ? " is-open" : ""}`}
          // Hover opens it on desktop; in the phone menu only the arrow button toggles it.
          onPointerEnter={(e) => e.pointerType === "mouse" && isDesktopNav() && setServicesDropdown(true)}
          onPointerLeave={(e) => e.pointerType === "mouse" && isDesktopNav() && setServicesDropdown(false)}
        >
          <div className="dropdown-trigger-row">
            <Link
              to="/services-products"
              onClick={closeMenu}
              className="dropdown-trigger"
              activeProps={{ className: "nav-active" }}
            >
              <span>Services & Products</span>
            </Link>
            <button
              type="button"
              className="dropdown-toggle"
              aria-label="Show Services & Products pages"
              aria-expanded={servicesDropdown}
              onClick={() => setServicesDropdown((v) => !v)}
            >
              <ChevronDown className="dropdown-chevron" aria-hidden="true" />
            </button>
          </div>
          <div className={`nav-dropdown-menu nav-mega ${servicesDropdown ? "is-visible" : ""}`}>
            <div className="nav-mega-group">
              <Link to="/services" onClick={closeMenu} className="nav-mega-title">
                Coaching Services
              </Link>
              {SERVICES.map((s) => (
                <Link key={s.slug} to={s.slug} onClick={closeMenu}>
                  {s.title}
                </Link>
              ))}
            </div>
            <div className="nav-mega-group">
              <Link to="/products" onClick={closeMenu} className="nav-mega-title">
                Products
              </Link>
              {DEFAULT_CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  to="/products/$category"
                  params={{ category: c.slug }}
                  onClick={closeMenu}
                >
                  {c.name}
                </Link>
              ))}
              <Link to="/services-products" onClick={closeMenu} className="nav-mega-all">
                View all Services & Products →
              </Link>
            </div>
          </div>
        </div>
        <Link to="/approach" onClick={closeMenu} activeProps={{ className: "nav-active" }}>
          The Approach
        </Link>
        <Link to="/stories" onClick={closeMenu} activeProps={{ className: "nav-active" }}>
          Client Stories
        </Link>
        <Link to="/book-appointment" onClick={closeMenu} className="font-bold text-gold-accent" activeProps={{ className: "nav-active" }}>
          BOOK AN APPOINTMENT
        </Link>
      </nav>

      <div className="header-actions">
      <Link to="/account" className="header-cart" aria-label="My account" title="My account">
        <UserRound aria-hidden="true" />
      </Link>
      {cartCount > 0 && (
        <Link to="/cart" className="header-cart" aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}>
          <ShoppingBag aria-hidden="true" />
          <span className="header-cart-count">{cartCount > 99 ? "99+" : cartCount}</span>
        </Link>
      )}

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
      </div>
    </header>
  );
}
