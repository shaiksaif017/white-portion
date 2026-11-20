import { useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Calendar,
  Clock,
  Video,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BookingCalendar } from "@/components/booking-calendar";
import {
  SERVICES_LIST,
  FITNESS_GOALS,
  type AppointmentType,
  type BookingInput,
  type AppointmentRecord,
} from "@/lib/booking-types";
import { getPublicBookingSettings, submitBooking } from "@/lib/booking-api";
import { generateWhatsAppUrl } from "@/lib/notifications";
import { brand } from "@/lib/brand";
import nutritionImage from "@/assets/white-portion-nutrition.jpg";
import athleteImage from "@/assets/white-portion-editorial.jpg";

export const Route = createFileRoute("/book-appointment")({
  loader: () => getPublicBookingSettings(),
  head: () => ({
    meta: [
      { title: `Book a Nutrition & Fitness Consultation | ${brand.name}` },
      {
        name: "description",
        content:
          "Book a personalised consultation with White Portion Wellness for nutrition planning, bodybuilding preparation, muscle building, weight management, and wellness support.",
      },
      { property: "og:title", content: `Book a Consultation | ${brand.name}` },
      {
        property: "og:description",
        content:
          "Book a personalised consultation with White Portion Wellness for nutrition planning, bodybuilding preparation, and wellness support.",
      },
    ],
  }),
  component: BookAppointmentPage,
});

function BookAppointmentPage() {
  const { bookingEnabled, settings } = Route.useLoaderData();
  const [slotsRefreshKey, setSlotsRefreshKey] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<AppointmentRecord | null>(null);

  // Form State
  const [selectedService, setSelectedService] = useState<string>(SERVICES_LIST[0].title);
  const [appointmentType, setAppointmentType] = useState<AppointmentType>("Online Consultation");
  const [appointmentDate, setAppointmentDate] = useState<string>("");
  const [appointmentTime, setAppointmentTime] = useState<string>("");

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    whatsappNumber: "",
    email: "",
    age: "",
    gender: "",
    fitnessGoal: FITNESS_GOALS[0],
    currentWeight: "",
    height: "",
    trainingExperience: "",
    dietaryPreferences: "",
    additionalInformation: "",
    privacyConsent: false,
  });

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  }

  // Step Validation
  function canProceedStep(step: number): boolean {
    if (step === 1) return !!selectedService;
    if (step === 2) return !!appointmentType;
    if (step === 3) return !!appointmentDate && !!appointmentTime;
    if (step === 4) {
      return (
        formData.fullName.trim().length >= 2 &&
        formData.phone.trim().length >= 6 &&
        formData.email.includes("@") &&
        !!formData.fitnessGoal &&
        formData.privacyConsent === true
      );
    }
    return true;
  }

  function handleNext() {
    setErrorMessage(null);
    if (!canProceedStep(currentStep)) {
      if (currentStep === 3) {
        setErrorMessage("Please select both an appointment date and an available time slot.");
      } else if (currentStep === 4) {
        if (!formData.privacyConsent) {
          setErrorMessage("Please accept the privacy consent to proceed.");
        } else {
          setErrorMessage("Please complete all required fields (Name, Phone, Email, Fitness Goal).");
        }
      }
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 5));
    scrollToForm();
  }

  function handlePrev() {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    scrollToForm();
  }

  async function handleSubmitBooking() {
    setIsSubmitting(true);
    setErrorMessage(null);

    const bookingPayload: BookingInput = {
      fullName: formData.fullName,
      phone: formData.phone,
      whatsappNumber: formData.whatsappNumber || formData.phone,
      email: formData.email,
      age: formData.age || undefined,
      gender: formData.gender || undefined,
      service: selectedService,
      fitnessGoal: formData.fitnessGoal,
      currentWeight: formData.currentWeight || undefined,
      height: formData.height || undefined,
      trainingExperience: formData.trainingExperience || undefined,
      dietaryPreferences: formData.dietaryPreferences || undefined,
      additionalInformation: formData.additionalInformation || undefined,
      appointmentType,
      appointmentDate,
      appointmentTime,
      timezone: settings.businessTimezone,
      privacyConsent: formData.privacyConsent,
    };

    let result: Awaited<ReturnType<typeof submitBooking>>;
    try {
      result = await submitBooking({ data: bookingPayload });
    } catch {
      result = { ok: false, error: "Could not reach the server. Please check your connection and try again." };
    }

    if (!result.ok) {
      setIsSubmitting(false);
      setErrorMessage(result.error);
      if (/slot/i.test(result.error)) {
        // The slot was taken meanwhile: send the client back to pick another one.
        setAppointmentTime("");
        setSlotsRefreshKey((k) => k + 1);
        setCurrentStep(3);
      }
      return;
    }

    setIsSubmitting(false);
    setConfirmedBooking(result.appointment);
    setCurrentStep(6); // Step 6 = Confirmation View
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="bg-background text-foreground min-h-screen">
      <SiteHeader isSolid />

      {/* 2. BOOKING PAGE HERO */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-gold-accent" />
            PERSONALISED COACHING STARTS HERE
          </span>
          <h1>
            YOUR GOALS<br />
            DESERVE <em>a plan.</em>
          </h1>
          <p className="page-hero-desc">
            Whether you're working towards a stronger physique, better nutritional habits, weight management, or personalised wellness support, let's begin by understanding your goals.
          </p>
          <div className="page-hero-actions">
            <Button onClick={scrollToForm} variant="hero">
              BOOK YOUR CONSULTATION <ArrowUpRight className="w-4 h-4 ml-2" />
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/approach">
                Explore our approach
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Editorial Trust Badges Bar */}
      <div className="bg-olive-deep text-paper border-b border-rule-light py-5 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-around gap-6 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-gold-accent" />
            <span>1-on-1 Direct Coach Assessment</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gold-accent" />
            <span>Strict Client Confidentiality</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold-accent" />
            <span>Fast 24-Hour Review Turnaround</span>
          </div>
        </div>
      </div>

      {/* Main Booking Interface Container */}
      <div ref={formRef} id="booking-form" className="section-wrap py-16 md:py-24">
        {/* If appointment is completed and confirmed */}
        {confirmedBooking && currentStep === 6 ? (
          <div className="max-w-3xl mx-auto bg-charcoal text-paper p-8 md:p-14 rounded border border-rule-light shadow-2xl animate-fade-in">
            <div className="text-center space-y-4 mb-10 pb-8 border-b border-rule-light">
              <div className="w-16 h-16 bg-primary/20 text-gold-accent rounded-full flex items-center justify-center mx-auto mb-4 border border-gold-accent/40">
                <Check className="w-8 h-8" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-gold-accent block">
                Appointment Request Received
              </span>
              <h2 className="text-3xl md:text-5xl font-display font-medium text-paper">
                YOUR REQUEST HAS BEEN RECEIVED.
              </h2>
              <p className="text-sm text-paper-soft max-w-lg mx-auto leading-relaxed">
                Thank you for choosing {brand.name}. Your consultation request has been submitted successfully. We will contact you to confirm your appointment.
              </p>
            </div>

            {/* Booking Details Ticket */}
            <div className="bg-paper/5 border border-rule-light p-6 md:p-8 rounded space-y-6 mb-10">
              <div className="flex items-center justify-between pb-4 border-b border-rule-light">
                <span className="text-xs text-paper-muted uppercase tracking-wider">Booking Reference:</span>
                <span className="text-base md:text-lg font-mono font-bold text-gold-accent">
                  {confirmedBooking.booking_reference}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div>
                  <span className="text-paper-muted block mb-1">Selected Service:</span>
                  <span className="font-semibold text-paper text-sm">{confirmedBooking.service}</span>
                </div>
                <div>
                  <span className="text-paper-muted block mb-1">Appointment Format:</span>
                  <span className="font-semibold text-paper text-sm">{confirmedBooking.appointment_type}</span>
                </div>
                <div>
                  <span className="text-paper-muted block mb-1">Requested Date:</span>
                  <span className="font-semibold text-paper text-sm">
                    {new Date(`${confirmedBooking.appointment_date}T00:00:00`).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-paper-muted block mb-1">Requested Time:</span>
                  <span className="font-semibold text-paper text-sm">
                    {confirmedBooking.appointment_time} ({confirmedBooking.timezone})
                  </span>
                </div>
                <div>
                  <span className="text-paper-muted block mb-1">Client Name:</span>
                  <span className="font-semibold text-paper text-sm">{confirmedBooking.full_name}</span>
                </div>
                <div>
                  <span className="text-paper-muted block mb-1">Contact Email / Phone:</span>
                  <span className="font-semibold text-paper text-sm">
                    {confirmedBooking.email} · {confirmedBooking.phone}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-rule-light text-xs text-paper-muted">
                {confirmedBooking.appointment_type === "In-Person Consultation" ? (
                  <p>
                    <strong className="text-gold-accent">Studio Location:</strong> {settings.businessLocation}
                  </p>
                ) : (
                  <p>
                    <strong className="text-gold-accent">Meeting Access:</strong> Private encrypted video conference link will be sent upon consultation verification.
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild variant="hero" className="w-full sm:w-auto">
                <a
                  href={generateWhatsAppUrl(confirmedBooking, settings)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  CONTACT US ON WHATSAPP
                </a>
              </Button>

              <Button asChild variant="heroOutline" className="w-full sm:w-auto">
                <Link to="/">
                  RETURN TO HOME
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {!bookingEnabled && (
              <div className="mb-8 p-4 rounded border border-destructive/40 bg-destructive/10 text-sm text-charcoal">
                Online booking is temporarily unavailable. Please{" "}
                <a
                  className="underline font-semibold"
                  href={`https://wa.me/${settings.businessWhatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  message us on WhatsApp
                </a>{" "}
                to book your consultation.
              </div>
            )}
            {/* Step Progress Tracker */}
            <div className="mb-12">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                <span className={currentStep >= 1 ? "text-primary" : ""}>01 Service</span>
                <span className={currentStep >= 2 ? "text-primary" : ""}>02 Type</span>
                <span className={currentStep >= 3 ? "text-primary" : ""}>03 Date & Time</span>
                <span className={currentStep >= 4 ? "text-primary" : ""}>04 Information</span>
                <span className={currentStep >= 5 ? "text-primary" : ""}>05 Review</span>
              </div>
              <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(currentStep / 5) * 100}%` }}
                />
              </div>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-3 animate-shake">
                <HelpCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* STEP 01 — SELECT YOUR SERVICE */}
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <div className="mb-6">
                    <span className="text-xs font-bold text-primary tracking-widest uppercase block">
                      Step 01 of 05
                    </span>
                    <h3 className="text-2xl md:text-3xl font-display font-medium text-charcoal mt-1">
                      Select Your Consultation Focus
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose the primary coaching program you wish to discuss with our directorate.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SERVICES_LIST.map((srv) => {
                      const isSelected = selectedService === srv.title;
                      return (
                        <div
                          key={srv.id}
                          onClick={() => setSelectedService(srv.title)}
                          className={`p-6 rounded border transition-all cursor-pointer flex flex-col justify-between
                            ${
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                                : "border-border bg-card hover:border-primary/50 hover:bg-secondary/30"
                            }
                          `}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <h4 className="font-display font-medium text-lg text-charcoal">
                                {srv.title}
                              </h4>
                              {isSelected ? (
                                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <Check className="w-3.5 h-3.5" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-border flex-shrink-0 mt-0.5" />
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-primary block mb-2">
                              {srv.tagline}
                            </span>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {srv.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* STEP 02 — SELECT APPOINTMENT TYPE */}
              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <div className="mb-6">
                    <span className="text-xs font-bold text-primary tracking-widest uppercase block">
                      Step 02 of 05
                    </span>
                    <h3 className="text-2xl md:text-3xl font-display font-medium text-charcoal mt-1">
                      Select Appointment Format
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose whether you prefer a remote video consultation or an in-person studio visit.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Option 1: Online */}
                    <div
                      onClick={() => setAppointmentType("Online Consultation")}
                      className={`p-8 rounded border transition-all cursor-pointer space-y-4
                        ${
                          appointmentType === "Online Consultation"
                            ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                            : "border-border bg-card hover:border-primary/50 hover:bg-secondary/30"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded bg-primary/10 text-primary flex items-center justify-center">
                          <Video className="w-6 h-6" />
                        </div>
                        {appointmentType === "Online Consultation" && (
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <h4 className="text-xl font-display font-medium text-charcoal">
                        Online Consultation
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        High-definition 1-on-1 private video conference. Ideal for domestic and international clients. You will receive private meeting credentials upon booking review.
                      </p>
                      <div className="pt-2 text-[11px] font-semibold text-primary">
                        ✓ Accessible worldwide · Encrypted video conference
                      </div>
                    </div>

                    {/* Option 2: In-Person */}
                    <div
                      onClick={() => setAppointmentType("In-Person Consultation")}
                      className={`p-8 rounded border transition-all cursor-pointer space-y-4
                        ${
                          appointmentType === "In-Person Consultation"
                            ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                            : "border-border bg-card hover:border-primary/50 hover:bg-secondary/30"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded bg-primary/10 text-primary flex items-center justify-center">
                          <MapPin className="w-6 h-6" />
                        </div>
                        {appointmentType === "In-Person Consultation" && (
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <h4 className="text-xl font-display font-medium text-charcoal">
                        In-Person Consultation
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Meet directly with our directorate at our private assessment facility for caliper body composition analysis and in-depth strategy review.
                      </p>
                      <div className="pt-2 text-[11px] font-semibold text-olive-deep bg-secondary/80 p-2.5 rounded border border-border">
                        <strong>Studio Location:</strong> {settings.businessLocation}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 03 — SELECT DATE & TIME */}
              {currentStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <div className="mb-6">
                    <span className="text-xs font-bold text-primary tracking-widest uppercase block">
                      Step 03 of 05
                    </span>
                    <h3 className="text-2xl md:text-3xl font-display font-medium text-charcoal mt-1">
                      Choose Date & Time Slot
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Our booking calendar displays real-time slot availability based on current coaching schedules.
                    </p>
                  </div>

                  <BookingCalendar
                    settings={settings}
                    refreshKey={slotsRefreshKey}
                    selectedDate={appointmentDate}
                    selectedTime={appointmentTime}
                    onSelectDate={setAppointmentDate}
                    onSelectTime={setAppointmentTime}
                  />
                </motion.div>
              )}

              {/* STEP 04 — CLIENT INFORMATION */}
              {currentStep === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6 bg-card border border-border p-8 md:p-10 rounded shadow-sm"
                >
                  <div className="mb-6 pb-4 border-b border-border">
                    <span className="text-xs font-bold text-primary tracking-widest uppercase block">
                      Step 04 of 05
                    </span>
                    <h3 className="text-2xl md:text-3xl font-display font-medium text-charcoal mt-1">
                      Client Background & Details
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please supply accurate contact details and goals so our coaches can review your profile in advance.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        required
                        value={formData.fullName}
                        onChange={handleInputChange}
                        placeholder="e.g. Eleanor Vance"
                        className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="you@domain.com"
                        className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+91 98765 00000"
                        className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-2">
                        WhatsApp Number (Optional, if different)
                      </label>
                      <input
                        type="tel"
                        name="whatsappNumber"
                        value={formData.whatsappNumber}
                        onChange={handleInputChange}
                        placeholder="WhatsApp contact"
                        className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-2">
                        Primary Fitness Goal *
                      </label>
                      <select
                        name="fitnessGoal"
                        value={formData.fitnessGoal}
                        onChange={handleInputChange}
                        className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                      >
                        {FITNESS_GOALS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-2">
                        Age (Optional)
                      </label>
                      <input
                        type="text"
                        name="age"
                        value={formData.age}
                        onChange={handleInputChange}
                        placeholder="e.g. 32"
                        className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-2">
                        Gender (Optional)
                      </label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="">Prefer not to say</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Non-binary / Other">Non-binary / Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-2">
                        Current Weight (Optional)
                      </label>
                      <input
                        type="text"
                        name="currentWeight"
                        value={formData.currentWeight}
                        onChange={handleInputChange}
                        placeholder="e.g. 74 kg"
                        className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-2">
                        Height (Optional)
                      </label>
                      <input
                        type="text"
                        name="height"
                        value={formData.height}
                        onChange={handleInputChange}
                        placeholder="e.g. 175 cm"
                        className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-2">
                        Training Experience (Optional)
                      </label>
                      <input
                        type="text"
                        name="trainingExperience"
                        value={formData.trainingExperience}
                        onChange={handleInputChange}
                        placeholder="e.g. 2 years lifting"
                        className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal mb-2">
                      Dietary Preferences / Restrictions (Optional)
                    </label>
                    <input
                      type="text"
                      name="dietaryPreferences"
                      value={formData.dietaryPreferences}
                      onChange={handleInputChange}
                      placeholder="e.g. Vegetarian, High Protein, Dairy Sensitive, Gluten Free..."
                      className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal mb-2">
                      Additional Information / Specific Questions (Optional)
                    </label>
                    <textarea
                      name="additionalInformation"
                      rows={3}
                      value={formData.additionalInformation}
                      onChange={handleInputChange}
                      placeholder="Share any past diet history, metabolic challenges, or specific questions..."
                      className="w-full p-3 rounded border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  {/* Privacy Consent (Explicitly not preselected) */}
                  <div className="pt-4 border-t border-border">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="privacyConsent"
                        checked={formData.privacyConsent}
                        onChange={handleInputChange}
                        className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        I agree to be contacted by White Portion Wellness regarding my consultation request and understand that my information will be handled according to the privacy policy. *
                      </span>
                    </label>
                  </div>
                </motion.div>
              )}

              {/* STEP 05 — REVIEW & SUBMIT */}
              {currentStep === 5 && (
                <motion.div
                  key="step-5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <div className="mb-6">
                    <span className="text-xs font-bold text-primary tracking-widest uppercase block">
                      Step 05 of 05
                    </span>
                    <h3 className="text-2xl md:text-3xl font-display font-medium text-charcoal mt-1">
                      Review Appointment Summary
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please verify your consultation parameters. You can click Edit on any section to adjust your details before final dispatch.
                    </p>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm divide-y divide-border">
                    {/* Block 1: Service */}
                    <div className="p-6 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                          Selected Service
                        </span>
                        <h4 className="text-lg font-display font-medium text-charcoal mt-0.5">
                          {selectedService}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-xs font-semibold text-primary underline hover:text-olive-deep cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>

                    {/* Block 2: Format & Location */}
                    <div className="p-6 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                          Format & Location
                        </span>
                        <h4 className="text-lg font-display font-medium text-charcoal mt-0.5">
                          {appointmentType}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {appointmentType === "In-Person Consultation"
                            ? settings.businessLocation
                            : "Private video conference link sent upon confirmation"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-xs font-semibold text-primary underline hover:text-olive-deep cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>

                    {/* Block 3: Date & Time */}
                    <div className="p-6 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                          Requested Date & Time
                        </span>
                        <h4 className="text-lg font-display font-medium text-charcoal mt-0.5">
                          {new Date(`${appointmentDate}T00:00:00`).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          at {appointmentTime}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          Timezone: {settings.businessTimezone} ({settings.slotDurationMinutes} min session)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="text-xs font-semibold text-primary underline hover:text-olive-deep cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>

                    {/* Block 4: Client Details */}
                    <div className="p-6 flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                          Client Information
                        </span>
                        <h4 className="text-lg font-display font-medium text-charcoal">
                          {formData.fullName}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {formData.email} · {formData.phone}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-charcoal">Primary Goal:</span> {formData.fitnessGoal}
                        </p>
                        {formData.dietaryPreferences && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-charcoal">Diet:</span> {formData.dietaryPreferences}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(4)}
                        className="text-xs font-semibold text-primary underline hover:text-olive-deep cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stepper Navigation Buttons */}
            <div className="mt-10 pt-6 border-t border-border flex items-center justify-between">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrev}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              ) : (
                <div />
              )}

              {currentStep < 5 ? (
                <Button
                  type="button"
                  variant="hero"
                  onClick={handleNext}
                  className="flex items-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="hero"
                  disabled={isSubmitting}
                  onClick={handleSubmitBooking}
                  className="flex items-center gap-2 !px-8"
                >
                  {isSubmitting ? (
                    <span>Processing Request...</span>
                  ) : (
                    <>
                      CONFIRM APPOINTMENT REQUEST <Check className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editorial Photography Section */}
      <section className="page-section section-wrap bg-secondary">
        <div className="editorial-grid !p-0">
          <div>
            <div className="section-label mb-6">
              <span>02</span>
              <span>The Consultation Experience</span>
            </div>
            <div className="prose-editorial">
              <h2>A PRIVATE AUDIT OF<br /><em>your biological baseline.</em></h2>
              <p>
                Your initial consultation is not a high-pressure sales pitch. It is an objective, in-depth strategic assessment designed to understand your physiological history, metabolic rate, lifestyle pressures, and exact physique ambitions.
              </p>
              <p>
                Whether conducted virtually across time zones or in our private studio, you will walk away with crystalline clarity regarding the nutritional architecture required to unlock your next standard.
              </p>
            </div>
          </div>

          <div className="intro-image-wrap">
            <img
              src={athleteImage}
              alt="Disciplined athlete in focused training — White Portion Wellness"
              width={1440}
              height={1152}
              loading="lazy"
            />
            <span className="image-caption">Precision diagnostics. Bespoke consultation.</span>
            <span className="image-number">WPW — CONSULT</span>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
