// The building blocks of a company website. Each block type lists its editable fields, which the
// editor (Marketing → Website → Pages) turns into a form and the public site renders.
// Shared by the editor (client) and the site (server): no server-only imports here.

export type Field =
  | { key: string; label: string; type: "text" | "textarea" | "url" | "image" | "video" | "number"; hint?: string; placeholder?: string }
  | { key: string; label: string; type: "select"; options: [string, string][]; hint?: string }
  | { key: string; label: string; type: "toggle"; hint?: string }
  | { key: string; label: string; type: "list"; item: Exclude<Field, { type: "list" }>[]; itemLabel: string; max?: number; hint?: string };

export type BlockData = Record<string, unknown>;

export type BlockDef = {
  label: string;
  description: string;
  /** What this block takes from the rest of Marine OS (shown in the editor). */
  fromApp?: string;
  fields: Field[];
  defaults: BlockData;
};

const button = (prefix: string, label: string): Field[] => [
  { key: `${prefix}Label`, label: `${label}: text`, type: "text" },
  { key: `${prefix}Link`, label: `${label}: link`, type: "url", hint: "A page (/about, /contact, /account, /book) or a full address" },
];
const heading: Field[] = [
  { key: "eyebrow", label: "Small title above", type: "text" },
  { key: "title", label: "Title", type: "text" },
  { key: "intro", label: "Text under the title", type: "textarea" },
];
const tone: Field = { key: "tone", label: "Background", type: "select", options: [["light", "Light (cream)"], ["white", "White"], ["dark", "Deep navy"]] };

export const BLOCKS = {
  hero: {
    label: "Hero",
    description: "The big opening: title, text, buttons, photo or video, animated waves.",
    fields: [
      { key: "size", label: "Size", type: "select", options: [["full", "Full screen (home)"], ["page", "Page banner"]] },
      { key: "eyebrow", label: "Small title above", type: "text" },
      { key: "title", label: "Title", type: "textarea", hint: "Use a new line to break the title" },
      { key: "text", label: "Text", type: "textarea" },
      { key: "image", label: "Background photo", type: "image" },
      { key: "video", label: "Background video (link to an MP4)", type: "video", hint: "Plays silently in a loop; the photo shows while it loads" },
      ...button("primary", "Main button"),
      ...button("secondary", "Second button"),
      { key: "waves", label: "Animated waves at the bottom", type: "toggle" },
      { key: "propeller", label: "Turning propeller behind the title", type: "toggle" },
    ],
    defaults: { size: "page", title: "", waves: true, propeller: false },
  },
  stats: {
    label: "Key numbers",
    description: "Numbers that count up when they appear: years, boats, propellers repaired…",
    fields: [tone, { key: "items", label: "Numbers", type: "list", itemLabel: "Number", max: 6, item: [
      { key: "value", label: "Number", type: "number" },
      { key: "suffix", label: "After the number (+, %, h…)", type: "text" },
      { key: "label", label: "What it is", type: "text" },
    ] }],
    defaults: { tone: "dark", items: [] },
  },
  services: {
    label: "Services",
    description: "Your services, as cards or a numbered list.",
    fromApp: "The services from the Services tab",
    fields: [...heading, tone, { key: "layout", label: "Layout", type: "select", options: [["cards", "Cards with photos"], ["list", "Numbered list"]] }, ...button("button", "Button")],
    defaults: { tone: "light", layout: "cards", title: "What we do" },
  },
  products: {
    label: "Products",
    description: "Products from your stock, with “Ask for a quote”.",
    fromApp: "Your products (Stock), as set in the Products tab: photo, description, featured, hidden",
    fields: [...heading, tone, { key: "count", label: "How many to show (0 = all)", type: "number" }, { key: "featuredOnly", label: "Only featured products", type: "toggle" }, ...button("button", "Button")],
    defaults: { tone: "white", count: 6, featuredOnly: false, title: "Selected for your boat" },
  },
  split: {
    label: "Photo and text",
    description: "A photo beside a text, for your story, a service or a promise.",
    fields: [...heading.slice(0, 2), { key: "text", label: "Text", type: "textarea" }, { key: "image", label: "Photo", type: "image" }, { key: "side", label: "Photo on the", type: "select", options: [["left", "Left"], ["right", "Right"]] }, tone, { key: "points", label: "Bullet points", type: "list", itemLabel: "Point", max: 8, item: [{ key: "text", label: "Point", type: "text" }] }, ...button("button", "Button")],
    defaults: { side: "right", tone: "light" },
  },
  steps: {
    label: "How it works",
    description: "Numbered steps, e.g. from drop-off to a balanced propeller.",
    fields: [...heading, tone, { key: "items", label: "Steps", type: "list", itemLabel: "Step", max: 6, item: [{ key: "title", label: "Step", type: "text" }, { key: "text", label: "Details", type: "textarea" }] }],
    defaults: { tone: "white", items: [] },
  },
  gallery: {
    label: "Gallery",
    description: "Your project photos with titles, opening large on click.",
    fromApp: "The photos from the Gallery tab",
    fields: [...heading, tone, { key: "count", label: "How many to show (0 = all)", type: "number" }, ...button("button", "Button")],
    defaults: { tone: "dark", count: 0, title: "Our work" },
  },
  testimonials: {
    label: "Testimonials",
    description: "What your customers say.",
    fields: [...heading.slice(0, 2), tone, { key: "items", label: "Testimonials", type: "list", itemLabel: "Testimonial", max: 12, item: [{ key: "quote", label: "Quote", type: "textarea" }, { key: "name", label: "Name", type: "text" }, { key: "boat", label: "Boat or role", type: "text" }] }],
    defaults: { tone: "light", items: [] },
  },
  faq: {
    label: "Questions & answers",
    description: "Frequently asked questions that open on click.",
    fields: [...heading.slice(0, 2), tone, { key: "items", label: "Questions", type: "list", itemLabel: "Question", max: 20, item: [{ key: "q", label: "Question", type: "text" }, { key: "a", label: "Answer", type: "textarea" }] }],
    defaults: { tone: "white", items: [] },
  },
  portal: {
    label: "Customer app",
    description: "Invites customers to their own app: boats, work in progress, invoices, messages.",
    fromApp: "Opens the customer portal (My account)",
    fields: [...heading.slice(0, 2), { key: "text", label: "Text", type: "textarea" }, { key: "image", label: "Photo (optional)", type: "image" }, { key: "items", label: "What they can do", type: "list", itemLabel: "Feature", max: 6, item: [{ key: "title", label: "Feature", type: "text" }, { key: "text", label: "Details", type: "text" }] }],
    defaults: { items: [] },
  },
  charter: {
    label: "Yacht charter",
    description: "Your charter fleet. Placeholder until bookings open: visitors join the waiting list.",
    fields: [
      ...heading,
      { key: "status", label: "Status label", type: "text", hint: "e.g. Coming summer 2027" },
      { key: "image", label: "Background photo", type: "image" },
      { key: "items", label: "Yachts", type: "list", itemLabel: "Yacht", max: 12, item: [
        { key: "name", label: "Name", type: "text" },
        { key: "image", label: "Photo", type: "image" },
        { key: "length", label: "Length", type: "text" },
        { key: "guests", label: "Guests", type: "text" },
        { key: "text", label: "Short description", type: "textarea" },
      ] },
      { key: "buttonLabel", label: "Button text", type: "text" },
    ],
    defaults: { status: "Coming summer", buttonLabel: "Join the waiting list", items: [] },
  },
  cta: {
    label: "Call to action",
    description: "A strong band that asks the visitor to act: book, write, sign in.",
    fields: [{ key: "title", label: "Title", type: "text" }, { key: "text", label: "Text", type: "textarea" }, { key: "image", label: "Background photo (optional)", type: "image" }, ...button("primary", "Main button"), ...button("secondary", "Second button")],
    defaults: {},
  },
  contact: {
    label: "Contact & map",
    description: "Phone, WhatsApp, email, address, opening hours, a map and the contact form.",
    fromApp: "Your details from the Texts & contact tab",
    fields: [...heading.slice(0, 2), { key: "showForm", label: "Contact form", type: "toggle" }, { key: "showMap", label: "Map", type: "toggle" }],
    defaults: { showForm: true, showMap: true, title: "Talk to us" },
  },
  booking: {
    label: "Book an appointment",
    description: "The booking form; customers with an account book from their app.",
    fromApp: "Creates an appointment in Workshop → Appointments",
    fields: [...heading.slice(0, 2), { key: "text", label: "Text", type: "textarea" }],
    defaults: { title: "Book an appointment" },
  },
  text: {
    label: "Text",
    description: "A free text section: a title and paragraphs.",
    fields: [...heading.slice(0, 2), { key: "text", label: "Text", type: "textarea", hint: "An empty line starts a new paragraph" }, tone, { key: "align", label: "Alignment", type: "select", options: [["left", "Left"], ["center", "Centred"]] }],
    defaults: { tone: "white", align: "left" },
  },
  video: {
    label: "Video",
    description: "A YouTube, Vimeo or MP4 video.",
    fields: [...heading.slice(0, 2), { key: "url", label: "Video link", type: "video", hint: "YouTube, Vimeo or an MP4 address" }, tone],
    defaults: { tone: "dark" },
  },
  logos: {
    label: "Brands & partners",
    description: "A sliding band of logos.",
    fields: [{ key: "title", label: "Title", type: "text" }, tone, { key: "items", label: "Logos", type: "list", itemLabel: "Logo", max: 24, item: [{ key: "image", label: "Logo", type: "image" }, { key: "name", label: "Name", type: "text" }] }],
    defaults: { tone: "white", items: [] },
  },
} satisfies Record<string, BlockDef>;

export type BlockType = keyof typeof BLOCKS;
export const isBlockType = (t: string): t is BlockType => t in BLOCKS;

/** A block's data with its defaults filled in. */
export function blockData(type: BlockType, data: unknown): BlockData {
  return { ...BLOCKS[type].defaults, ...(data && typeof data === "object" ? (data as BlockData) : {}) };
}

/** Image ids used by a block (top-level and inside lists), so the editor can show them. */
export function blockImageIds(type: BlockType, data: BlockData): string[] {
  const ids: string[] = [];
  for (const f of BLOCKS[type].fields as Field[]) {
    if (f.type === "image" && typeof data[f.key] === "string") ids.push(data[f.key] as string);
    if (f.type === "list" && Array.isArray(data[f.key]))
      for (const row of data[f.key] as BlockData[]) for (const sub of f.item) if (sub.type === "image" && typeof row[sub.key] === "string") ids.push(row[sub.key] as string);
  }
  return ids.filter(Boolean);
}

type PageSeed = { slug: string; title: string; inNav: boolean; blocks: { type: BlockType; data: BlockData }[] };

/** The pages a company starts with (Eliche Radice): every text can be changed in the editor. */
export const STARTER_PAGES: PageSeed[] = [
  {
    slug: "",
    title: "Home",
    inNav: true,
    blocks: [
      { type: "hero", data: { size: "full", eyebrow: "Marine propellers · Lebanon", title: "Propellers built\nfor performance", text: "Supply, fitting, repair and balancing of propellers, shafts and running gear, with Italian expertise.", primaryLabel: "Book an appointment", primaryLink: "/book", secondaryLabel: "Discover the shop", secondaryLink: "/shop", waves: true, propeller: true } },
      { type: "stats", data: { tone: "dark", items: [] } },
      { type: "services", data: { tone: "light", layout: "cards", eyebrow: "Services", title: "Everything below the waterline", intro: "From choosing the right propeller to bringing a damaged one back to life.", buttonLabel: "All services", buttonLink: "/services" } },
      { type: "split", data: { tone: "white", side: "right", eyebrow: "Our story", title: "Italian know-how, Lebanese waters", text: "Eliche Radice Lebanon brings Italian propeller expertise to local yachts, fishing boats and workboats. Every propeller is measured, repaired and balanced to the original specification.", points: [{ text: "Precise measurement of pitch and diameter" }, { text: "Dynamic balancing for a smooth, quiet ride" }, { text: "Honest advice: repair when it makes sense" }], buttonLabel: "Our story", buttonLink: "/about" } },
      { type: "products", data: { tone: "light", eyebrow: "The shop", title: "Selected for your boat", count: 6, featuredOnly: false, buttonLabel: "Open the shop", buttonLink: "/shop" } },
      { type: "steps", data: { tone: "dark", eyebrow: "How it works", title: "From drop-off to a perfect ride", items: [{ title: "Bring or send your propeller", text: "Or book a visit: we come to the marina." }, { title: "Inspection & quote", text: "We measure it and tell you what it needs, with a clear price." }, { title: "Repair & balancing", text: "Straightening, welding, polishing and dynamic balancing." }, { title: "Back in the water", text: "Fitted and tested. Follow every step in your app." }] } },
      { type: "portal", data: { eyebrow: "Your boat, online", title: "Everything about your boat, in one app", text: "Install the Eliche Radice app on your phone: follow your work live, see your boats and invoices, book and message us.", items: [{ title: "Live work tracking", text: "Received, in progress, ready." }, { title: "Your boats", text: "Engines, hours and full history." }, { title: "Invoices & payments", text: "Statements whenever you need them." }, { title: "Messages", text: "Ask us anything, get the answer in the app." }] } },
      { type: "charter", data: { eyebrow: "Yacht charter", title: "Summer on the water", intro: "Our charter fleet is coming. Join the waiting list to be the first to book.", status: "Coming summer", buttonLabel: "Join the waiting list", items: [] } },
      { type: "cta", data: { title: "Ready for a smoother ride?", text: "Book an appointment or send us a photo of your propeller.", primaryLabel: "Book an appointment", primaryLink: "/book", secondaryLabel: "Contact us", secondaryLink: "/contact" } },
    ],
  },
  {
    slug: "about",
    title: "Our story",
    inNav: true,
    blocks: [
      { type: "hero", data: { size: "page", eyebrow: "Our story", title: "Italian know-how,\nLebanese waters", waves: true } },
      { type: "split", data: { tone: "white", side: "left", title: "Who we are", text: "Eliche Radice Lebanon brings Italian propeller expertise to Lebanese waters. We help you choose the right propeller for your boat and keep it in top condition." } },
      { type: "stats", data: { tone: "dark", items: [] } },
      { type: "cta", data: { title: "Let's talk about your boat", primaryLabel: "Contact us", primaryLink: "/contact" } },
    ],
  },
  {
    slug: "services",
    title: "Services",
    inNav: true,
    blocks: [
      { type: "hero", data: { size: "page", eyebrow: "Services", title: "Propellers, shafts\nand running gear", waves: true } },
      { type: "services", data: { tone: "light", layout: "list", title: "What we do" } },
      { type: "steps", data: { tone: "white", title: "How it works", items: [{ title: "Inspection", text: "We measure and assess the damage." }, { title: "Quote", text: "A clear price before we start." }, { title: "Repair", text: "Straightening, welding, polishing, balancing." }, { title: "Delivery", text: "Fitted and tested." }] } },
      { type: "faq", data: { tone: "light", title: "Questions", items: [{ q: "How long does a repair take?", a: "Most repairs take two to three working days. We tell you the date with the quote." }, { q: "Can a damaged propeller always be repaired?", a: "Most can. If a new one is better value, we tell you honestly." }] } },
      { type: "cta", data: { title: "Need a propeller checked?", primaryLabel: "Book an appointment", primaryLink: "/book" } },
    ],
  },
  { slug: "shop", title: "Shop", inNav: true, blocks: [{ type: "hero", data: { size: "page", eyebrow: "The shop", title: "Propellers & parts", waves: true } }, { type: "products", data: { tone: "white", count: 0, title: "" } }] },
  { slug: "gallery", title: "Gallery", inNav: true, blocks: [{ type: "hero", data: { size: "page", eyebrow: "Gallery", title: "Our work", waves: true } }, { type: "gallery", data: { tone: "dark", count: 0, title: "" } }] },
  { slug: "charter", title: "Charter", inNav: true, blocks: [{ type: "hero", data: { size: "page", eyebrow: "Yacht charter", title: "Summer\non the water", waves: true } }, { type: "charter", data: { title: "Our fleet", intro: "Bookings open soon. Join the waiting list and we'll tell you first.", status: "Coming summer", buttonLabel: "Join the waiting list", items: [] } }] },
  { slug: "book", title: "Book", inNav: false, blocks: [{ type: "hero", data: { size: "page", eyebrow: "Appointments", title: "Book an appointment", waves: true } }, { type: "booking", data: { title: "", text: "Tell us what you need and when suits you. We confirm quickly." } }] },
  { slug: "contact", title: "Contact", inNav: true, blocks: [{ type: "hero", data: { size: "page", eyebrow: "Contact", title: "Talk to us", waves: true } }, { type: "contact", data: { showForm: true, showMap: true, title: "" } }] },
];

/** Reserved addresses a custom page can't use. */
export const RESERVED_SLUGS = ["account", "catalogue", "p", "site-media", "api", "c"];
