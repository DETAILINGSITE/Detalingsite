/**
 * Seed content. There are deliberately NO sample reviews or gallery photos: add real ones in
 * /admin/content as they come in (the site hides those sections until then). FAQs and city pages
 * are plain, factual starting text the owner can edit in admin.
 */

export const seedTestimonials: {
  authorName: string;
  vehicle: string;
  rating: number;
  body: string;
  source: "google";
  sort: number;
}[] = [];

export const seedGallery: {
  title: string;
  vehicle: string;
  service: string;
  n: number;
  beforeSrc: string;
  afterSrc: string;
  altBefore: string;
  altAfter: string;
}[] = [];

export const seedFaqs = [
  {
    category: "Booking",
    featured: true,
    question: "How do I book, and do I need an account?",
    answerMd:
      "Pick your package, vehicle and a time online. It takes a few minutes and you don't need an account. Save your booking page to manage it later, and we'll contact you to confirm.",
  },
  {
    category: "Booking",
    featured: true,
    question: "Do you take a deposit?",
    answerMd:
      "Yes. A $50 non-refundable deposit holds your appointment and goes toward your total, so you pay the rest when the work is done. If you need a different time, reschedule instead of cancelling and the deposit moves with your booking.",
  },
  {
    category: "Booking",
    featured: false,
    question: "Can I reschedule or cancel?",
    answerMd:
      "Yes, use the link on your booking page or call us. Please give us at least 24 hours' notice so we can offer the time to someone else.",
  },
  {
    category: "Mobile service",
    featured: true,
    question: "Do I need to provide water or power?",
    answerMd:
      "No. We bring our own water, power and equipment. We just need a spot to park where we can open all the doors, and permission to work there.",
  },
  {
    category: "Mobile service",
    featured: true,
    question: "Where do you work?",
    answerMd:
      "We're 100% mobile — we come to you in Houston and the surrounding areas, at your home, office or wherever you park. Check your ZIP code on the home page to confirm we cover your area.",
  },
  {
    category: "Mobile service",
    featured: false,
    question: "What if it rains?",
    answerMd:
      "For exterior work we'll contact you to move your appointment at no charge. Interior-only jobs usually go ahead as planned.",
  },
  {
    category: "Services",
    featured: true,
    question: "What's the difference between Bronze, Silver, Gold and VIP?",
    answerMd:
      "Each package includes everything in the one before it. Bronze is a maintenance wash. Silver adds a deep interior refresh. Gold is a full interior and exterior detail with a premium paint sealant. VIP adds one-step paint correction, a 1-year ceramic coating, an engine bay detail and a free maintenance wash within 30 days.",
  },
  {
    category: "Services",
    featured: false,
    question: "How long does a ceramic coating last?",
    answerMd:
      "Our ceramic coating is a 1-year coating, and it's included in the VIP package. How well it holds up depends on how the car is washed and stored.",
  },
  {
    category: "Services",
    featured: false,
    question: "Do you price by vehicle size?",
    answerMd:
      "Yes. Prices are set for cars and for trucks, SUVs and vans, because larger vehicles take longer and use more product. The booking flow shows your exact price before you pay.",
  },
  {
    category: "Services",
    featured: false,
    question: "Is there a satisfaction guarantee?",
    answerMd:
      "Yes — every detail is backed by our satisfaction guarantee. If something isn't right, let us know and we'll make it right.",
  },
  {
    category: "Services",
    featured: false,
    question: "Do you offer a membership?",
    answerMd:
      "Yes: the VIP Maintenance Membership is $1,200–$1,500 per year and includes up to 4 maintenance details per month (one per week), priority scheduling and discounted add-on services. Get in touch and we'll set it up for your vehicles.",
  },
];

export const seedCityPages = [
  { slug: "houston", city: "Houston", region: "TX", zoneIndex: 0 },
  { slug: "katy", city: "Katy", region: "TX", zoneIndex: 1 },
  { slug: "sugar-land", city: "Sugar Land", region: "TX", zoneIndex: 1 },
  { slug: "the-woodlands", city: "The Woodlands", region: "TX", zoneIndex: 2 },
].map((c) => ({
  ...c,
  introMd: `MJ Elite Detailing brings professional mobile car detailing to homes and offices in ${c.city}, TX. Choose a Bronze, Silver, Gold or VIP package and we'll come to you.`,
}));

export const seedPromos = [
  { code: "FIRSTDETAIL", kind: "percent" as const, value: 10, firstBookingOnly: true },
];
