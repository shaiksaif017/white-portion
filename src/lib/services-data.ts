// The six coaching services, shared by the Services & Products hub and the
// service pages. Wording avoids medical claims: coaching supports, it does not treat.
export interface ServiceEssentials {
  slug: string;
  number: string;
  title: string;
  tagline: string;
  whoFor: string[];
  receive: string[];
  benefits: string[];
}

export const SERVICES: ServiceEssentials[] = [
  {
    slug: "/mens-coaching",
    number: "01",
    title: "Men's Coaching & Hypertrophy",
    tagline: "Structured nutrition and training support for building muscle and strength.",
    whoFor: [
      "Men who want to build muscle, gain strength or improve body composition",
      "Lifters who have plateaued and want a structured, measurable plan",
      "Beginners who want to start resistance training with clear guidance",
    ],
    receive: [
      "An initial consultation and goal assessment",
      "Personalised calorie and macronutrient targets",
      "A nutrition plan built around your training schedule",
      "Regular check-ins with plan adjustments based on your progress",
      "Direct WhatsApp support from your coach",
    ],
    benefits: [
      "A clear plan instead of guesswork",
      "Progress tracked with measurements, photos and training data",
      "Habits you can keep after the programme ends",
    ],
  },
  {
    slug: "/womens-wellness",
    number: "02",
    title: "Women's Wellness & Lifestyle",
    tagline: "Sustainable nutrition coaching designed around women's lives and goals.",
    whoFor: [
      "Women who want to improve body composition, energy or eating habits",
      "Anyone coming off restrictive diets who wants a balanced approach",
      "Busy professionals and mothers who need a plan that fits their routine",
    ],
    receive: [
      "An initial consultation covering goals, lifestyle and food preferences",
      "A personalised, flexible nutrition plan",
      "Training guidance suited to your experience level",
      "Regular check-ins and plan adjustments",
      "Direct WhatsApp support from your coach",
    ],
    benefits: [
      "A sustainable approach without extreme restriction",
      "Practical meal strategies for home, work and travel",
      "Support and accountability throughout",
    ],
  },
  {
    slug: "/pcos-nutrition",
    number: "03",
    title: "PCOS / PCOD Clinical Nutrition",
    tagline: "Nutrition and lifestyle coaching for women living with PCOS or PCOD.",
    whoFor: [
      "Women with a PCOS or PCOD diagnosis who want nutrition support",
      "Anyone looking for a structured, non-restrictive eating plan alongside their medical care",
    ],
    receive: [
      "An in-depth consultation covering your history, goals and current routine",
      "A personalised nutrition plan focused on balanced, whole-food meals",
      "Lifestyle guidance on activity, sleep and stress",
      "Regular check-ins and plan adjustments",
      "Direct WhatsApp support from your coach",
    ],
    benefits: [
      "A clear, manageable plan you can follow day to day",
      "Education on how food choices can support your wellbeing",
      "Coaching that works alongside, not instead of, your doctor's advice",
    ],
  },
  {
    slug: "/bodybuilding-prep",
    number: "04",
    title: "Bodybuilding & Contest Prep",
    tagline: "Detailed preparation coaching for physique competitors.",
    whoFor: [
      "Athletes preparing for a bodybuilding, physique or bikini competition",
      "First-time competitors who want experienced guidance",
      "Experienced competitors looking for a more structured prep",
    ],
    receive: [
      "A full prep timeline planned back from your show date",
      "Phased nutrition plans with regular adjustments",
      "Peak-week planning tailored to you",
      "Posing and presentation feedback",
      "A structured post-show recovery plan",
    ],
    benefits: [
      "A planned, step-by-step approach to stage day",
      "Frequent check-ins so the plan adapts to your progress",
      "A recovery plan to help you transition well after the show",
    ],
  },
  {
    slug: "/personalised-diet",
    number: "05",
    title: "Personalised Diet Planning",
    tagline: "A nutrition plan built around your goals, preferences and schedule.",
    whoFor: [
      "Anyone who wants a nutrition plan tailored to them, not a generic template",
      "Busy professionals who travel or eat out often",
      "Vegetarians, vegans and people with specific food preferences",
    ],
    receive: [
      "A consultation covering your goals, preferences and routine",
      "Personalised calorie and macronutrient targets",
      "A meal plan with practical options and swaps",
      "Strategies for eating out and travelling",
      "Regular reviews to adjust your plan",
    ],
    benefits: [
      "Meals that fit your taste, culture and schedule",
      "Flexibility without losing track of your goals",
      "Skills to make good food choices on your own",
    ],
  },
  {
    slug: "/sports-nutrition",
    number: "06",
    title: "Sports Performance Nutrition",
    tagline: "Nutrition coaching to support training, competition and recovery.",
    whoFor: [
      "Competitive and recreational athletes across sports",
      "Athletes with demanding training loads or competition schedules",
      "Anyone wanting to fuel training and recovery more effectively",
    ],
    receive: [
      "An assessment of your sport, training load and goals",
      "Daily nutrition targets matched to your training",
      "Pre-, during- and post-training fuelling guidance",
      "Hydration guidance",
      "Regular check-ins around your training and competition calendar",
    ],
    benefits: [
      "A fuelling plan built around your sport",
      "Practical routines for training and match or race days",
      "Support adjusting nutrition as your season changes",
    ],
  },
];

export function serviceBySlug(slug: string): ServiceEssentials | undefined {
  return SERVICES.find((s) => s.slug === slug);
}
