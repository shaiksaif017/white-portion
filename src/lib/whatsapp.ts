// Single source of truth for the business WhatsApp number. Change it here only.
export const WHATSAPP_DISPLAY = "+91 90001 93486";
export const WHATSAPP_DIGITS = "919000193486"; // country code + number, no "+" or spaces

export const WHATSAPP_DEFAULT_MESSAGE =
  "Hello White Portion Wellness! I'd like to know more about your coaching programs.";

// https://wa.me/<number>?text=<prefilled message>
export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_DIGITS}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
