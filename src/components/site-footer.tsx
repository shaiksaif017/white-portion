import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { brand } from "@/lib/brand";
import { whatsappUrl, WHATSAPP_DEFAULT_MESSAGE, WHATSAPP_DISPLAY } from "@/lib/whatsapp";

export function SiteFooter() {
  function scrollToTop(e: React.MouseEvent) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <footer className="site-footer">
      <div className="footer-top">
        <Wordmark className="footer-wordmark" variant="stacked" />
        <p>
          Precision Nutrition.<br />
          <em>Powerful Transformation.</em>
        </p>
        <a className="footer-top-link" href="#top" onClick={scrollToTop}>
          Back to top <ArrowUpRight aria-hidden="true" />
        </a>
      </div>

      <div className="footer-nav-grid">
        <div className="footer-col">
          <span className="footer-col-title">Specialised Coaching</span>
          <ul className="footer-links">
            <li><Link to="/services">All Coaching Services</Link></li>
            <li><Link to="/mens-coaching">Men's Coaching & Hypertrophy</Link></li>
            <li><Link to="/womens-wellness">Women's Wellness & Hormones</Link></li>
            <li><Link to="/pcos-nutrition">PCOS / PCOD Clinical Nutrition</Link></li>
            <li><Link to="/bodybuilding-prep">Bodybuilding & Contest Prep</Link></li>
            <li><Link to="/personalised-diet">Personalised Diet Planning</Link></li>
            <li><Link to="/sports-nutrition">Sports Performance Nutrition</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <span className="footer-col-title">The Practice</span>
          <ul className="footer-links">
            <li><Link to="/about">Our Philosophy & Team</Link></li>
            <li><Link to="/approach">The 4-Stage Methodology</Link></li>
            <li><Link to="/stories">Client Transformations</Link></li>
            <li><Link to="/services-products">Services & Products</Link></li>
            <li><Link to="/products">Shop Products</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <span className="footer-col-title">Consultation</span>
          <ul className="footer-links">
            <li><Link to="/book-appointment">Book an Appointment</Link></li>
            <li><Link to="/admin">Admin Portal</Link></li>
            <li><a href={whatsappUrl(WHATSAPP_DEFAULT_MESSAGE)} target="_blank" rel="noopener noreferrer">WhatsApp {WHATSAPP_DISPLAY}</a></li>
            <li><a href="mailto:care@officialwhiteportion.com">care@officialwhiteportion.com</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} {brand.nameUpper}</span>
        <span>Nutrition · Physique · Performance</span>
        <Link to="/book-appointment">
          Book an Appointment <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <div className="footer-display" aria-hidden="true">
        {brand.nameUpper}
      </div>
    </footer>
  );
}
