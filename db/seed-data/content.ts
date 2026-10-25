/**
 * Seed content. Testimonials, gallery items and city pages are SAMPLES — they render
 * with a visible "Sample" tag and `pnpm launch-check` fails until they're replaced or
 * unpublished in /admin/content.
 */

export const seedTestimonials = [
  {
    authorName: "Sample customer A.",
    vehicle: "SUV",
    rating: 5,
    body: "Sample review — replace with a real review from your Google Business Profile. Real reviews only.",
    source: "google" as const,
    sort: 1,
  },
  {
    authorName: "Sample customer B.",
    vehicle: "Pickup truck",
    rating: 5,
    body: "Sample review — the site labels this as a sample until you replace it in Admin → Content.",
    source: "google" as const,
    sort: 2,
  },
  {
    authorName: "Sample customer C.",
    vehicle: "Sedan",
    rating: 5,
    body: "Sample review — never publish invented reviews; copy real ones with the reviewer's first name and initial.",
    source: "google" as const,
    sort: 3,
  },
];

export const seedGallery = [
  { title: "Sample — paint correction", vehicle: "Sample vehicle", service: "paint-correction-2-stage", n: 1 },
  { title: "Sample — interior detail", vehicle: "Sample vehicle", service: "silver-deep-interior-refresh", n: 2 },
  { title: "Sample — ceramic coating", vehicle: "Sample vehicle", service: "ceramic-coating", n: 3 },
  { title: "Sample — headlight restoration", vehicle: "Sample vehicle", service: "headlight-restoration", n: 4 },
  { title: "Sample — full detail", vehicle: "Sample vehicle", service: "gold-full-detail", n: 5 },
  { title: "Sample — engine bay", vehicle: "Sample vehicle", service: "engine-bay", n: 6 },
].map((g) => ({
  ...g,
  beforeSrc: `/images/samples/gallery-${g.n}-before.svg`,
  afterSrc: `/images/samples/gallery-${g.n}-after.svg`,
  altBefore: `Sample placeholder image — before ${g.title.replace("Sample — ", "")}`,
  altAfter: `Sample placeholder image — after ${g.title.replace("Sample — ", "")}`,
}));

export const seedFaqs = [
  {
    category: "Booking",
    featured: true,
    question: "How do I book, and do I need an account?",
    answerMd:
      "Pick your service, vehicle, location and a time online — it takes a few minutes and you don't need an account. You'll get a confirmation by email (and text, if you opt in) with a link to manage your booking.",
  },
  {
    category: "Booking",
    featured: true,
    question: "Do you take a deposit?",
    answerMd:
      "We take a small deposit when you book to hold your time. It's applied to your total, and the balance is due when the work is done. The exact amount is shown before you pay.",
  },
  {
    category: "Booking",
    featured: false,
    question: "Can I reschedule or cancel?",
    answerMd:
      "Yes — use the link in your confirmation. Changes made outside the cancellation window are free. Late cancellations may forfeit the deposit; see our cancellation policy for the details.",
  },
  {
    category: "Mobile service",
    featured: true,
    question: "What do you need from me for a mobile detail?",
    answerMd:
      "A parking spot with room to open all doors, and permission to work there. We bring our own water and power for most jobs; let us know in the booking notes if access is tricky.",
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
    question: "How long does a ceramic coating last?",
    answerMd:
      "Our ceramic coating is a 1-year coating, and it's included in the VIP package. How well it holds up depends on how the car is washed and stored.",
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
    question: "Do you price by vehicle size?",
    answerMd:
      "Yes. Prices are set for cars and for trucks & SUVs, because larger vehicles take longer and use more product. The booking flow shows your exact price before you pay.",
  },
];

export const seedCityPages = [
  { slug: "downtown", city: "Downtown", region: "TX", zoneIndex: 0 },
  { slug: "midtown", city: "Midtown", region: "TX", zoneIndex: 0 },
  { slug: "northside", city: "Northside", region: "TX", zoneIndex: 1 },
].map((c) => ({
  ...c,
  introMd: `Sample city page — replace this with genuinely local content for ${c.city} (neighbourhoods you serve, parking/HOA notes, nearby landmarks). Thin, copy-pasted city pages can hurt search rankings.`,
}));

export const seedPromos = [
  { code: "FIRSTDETAIL", kind: "percent" as const, value: 10, firstBookingOnly: true },
];
