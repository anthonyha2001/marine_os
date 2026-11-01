// Demo data for trying the whole app: customers, boats, suppliers, catalogue, purchases,
// offers, job cards, invoices, payments, appointments, warranties, staff and expenses, for
// both companies. Documents go through the app's own numbering and ledger posting.
//
//   npx tsx --conditions=react-server prisma/seed-demo.ts
//
// Runs once: stops if the demo customers are already there.
import { prisma, type Tx } from "@/lib/prisma";
import { nextItemCode, TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { nextNumber } from "@/lib/ledger/numbering";
import { systemAccounts } from "@/lib/ledger/chart";
import { postPurchase, postReceipt, postSupplierPayment, postVoucher } from "@/lib/ledger/posting";
import { refreshInvoiceStatus } from "@/lib/ledger/invoice-status";
import { averageCosts, recomputePurchaseCosts } from "@/lib/costing";
import { createInvoiceWithLines } from "@/lib/invoicing";
import { offerTotals, lineTotal } from "@/lib/offers";
import { VAT_RATE, round2 } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";

const NOTE = "Demo data";
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const addDays = (iso: string, n: number) => new Date(day(iso).getTime() + n * 86400000);

// ── Shared: suppliers, catalogue, customers and boats ──

const SUPPLIERS = [
  { name: "Yamaha Motor Middle East", phone: "+971 4 881 5000", email: "parts@yamaha-me.example", address: "Jebel Ali, Dubai" },
  { name: "Brunswick Marine EMEA (Mercury)", phone: "+32 2 718 0911", email: "orders@brunswick.example", address: "Brussels, Belgium" },
  { name: "Vetus BV", phone: "+31 10 437 7700", email: "sales@vetus.example", address: "Schiedam, Netherlands" },
  { name: "Michigan Wheel", phone: "+1 616 452 6941", email: "export@miwheel.example", address: "Grand Rapids, USA" },
  { name: "Marine Supply SARL", phone: "+961 1 445 210", email: "info@marinesupply.example", address: "Port of Beirut, Lebanon" },
  { name: "Hempel Paints", phone: "+45 4593 3800", email: "yacht@hempel.example", address: "Kongens Lyngby, Denmark" },
];

type Item = { name: string; type: "PRODUCT" | "SERVICE"; unit?: string; price: number; supplier?: string; min?: number; serials?: boolean; description?: string };
const ITEMS: Item[] = [
  { name: "Yamaha oil filter 69J-13440", type: "PRODUCT", price: 18, supplier: "Yamaha Motor Middle East", min: 10 },
  { name: "Mercury fuel filter 35-8M0093688", type: "PRODUCT", price: 24, supplier: "Brunswick Marine EMEA (Mercury)", min: 8 },
  { name: "Water pump impeller kit, Yamaha F150", type: "PRODUCT", price: 65, supplier: "Yamaha Motor Middle East", min: 4 },
  { name: "NGK spark plug LFR6A-11", type: "PRODUCT", price: 9, supplier: "Marine Supply SARL", min: 20 },
  { name: "4-stroke engine oil 10W-30, 1 L", type: "PRODUCT", price: 14, supplier: "Marine Supply SARL", min: 24 },
  { name: "Quicksilver gear lube, 1 L", type: "PRODUCT", price: 22, supplier: "Brunswick Marine EMEA (Mercury)", min: 10 },
  { name: "Aluminium anode kit, outboard", type: "PRODUCT", price: 48, supplier: "Marine Supply SARL", min: 6 },
  { name: "Antifouling paint Hempel Mille NCT, 2.5 L", type: "PRODUCT", price: 135, supplier: "Hempel Paints", min: 6 },
  { name: "Bilge pump 1100 GPH", type: "PRODUCT", price: 85, supplier: "Vetus BV", min: 3 },
  { name: "Marine battery 12 V 100 Ah", type: "PRODUCT", price: 210, supplier: "Marine Supply SARL", min: 2 },
  { name: "LED navigation light set", type: "PRODUCT", price: 55, supplier: "Vetus BV", min: 3 },
  { name: "Fuel water separator 10 micron", type: "PRODUCT", price: 75, supplier: "Vetus BV", min: 4 },
  { name: "Yamaha thermostat 6AW-12411", type: "PRODUCT", price: 38, supplier: "Yamaha Motor Middle East", min: 4 },
  { name: "Yamaha F150 outboard engine", type: "PRODUCT", price: 14500, supplier: "Yamaha Motor Middle East", serials: true },
  { name: "Stainless steel propeller 3-blade 15 x 17", type: "PRODUCT", price: 690, supplier: "Michigan Wheel", min: 2, description: "For outboards 90–300 hp, Flo-Torq hub." },
  { name: "Aluminium propeller 3-blade 13 x 19", type: "PRODUCT", price: 180, supplier: "Michigan Wheel", min: 3 },
  { name: "Bronze propeller 4-blade 22 x 24", type: "PRODUCT", price: 2400, supplier: "Michigan Wheel", min: 1, description: "Nibral, for inboard shafts 40–50 mm." },
  { name: "Stainless propeller shaft 35 mm x 1.5 m", type: "PRODUCT", price: 850, supplier: "Vetus BV", min: 1 },
  { name: "Cutless bearing 35 mm", type: "PRODUCT", price: 95, supplier: "Vetus BV", min: 4 },
  { name: "Shaft seal kit 35 mm", type: "PRODUCT", price: 210, supplier: "Vetus BV", min: 2 },
  { name: "Propeller nut and washer kit", type: "PRODUCT", price: 35, supplier: "Michigan Wheel", min: 6 },
  { name: "Flo-Torq hub kit", type: "PRODUCT", price: 60, supplier: "Michigan Wheel", min: 4 },
  { name: "Labour", type: "SERVICE", unit: "HOUR", price: 45 },
  { name: "Haul-out and launch", type: "SERVICE", unit: "FIXED", price: 350 },
  { name: "Hull pressure wash", type: "SERVICE", unit: "FIXED", price: 120 },
  { name: "Outboard 100-hour service", type: "SERVICE", unit: "FIXED", price: 280 },
  { name: "Antifouling application, per metre", type: "SERVICE", unit: "UNIT", price: 40 },
  { name: "Engine diagnostic", type: "SERVICE", unit: "FIXED", price: 90 },
  { name: "Propeller repair and balancing", type: "SERVICE", unit: "FIXED", price: 250 },
  { name: "Propeller pitch change", type: "SERVICE", unit: "FIXED", price: 180 },
  { name: "Shaft alignment", type: "SERVICE", unit: "FIXED", price: 300 },
  { name: "Winterization", type: "SERVICE", unit: "FIXED", price: 220 },
];

const CUSTOMERS = [
  { name: "Karim Haddad", phone: "+961 3 214 556", email: "karim.haddad@example.com", address: "Jounieh Marina, Kaslik" },
  { name: "Nadine Khoury", phone: "+961 70 118 902", email: "nadine.k@example.com", address: "Zaitunay Bay, Beirut" },
  { name: "Georges Abi Nader", phone: "+961 3 667 120", email: "georges.an@example.com", address: "Batroun port" },
  { name: "Rami Saade", phone: "+961 71 450 330", email: "rami.saade@example.com", address: "ATCL, Kaslik" },
  { name: "Lea Frem", phone: "+961 76 902 441", email: "lea.frem@example.com", address: "Byblos old port" },
  { name: "Mediterranean Yacht Charters SAL", phone: "+961 1 370 800", email: "ops@medcharters.example", address: "Dbayeh Marina", taxNumber: "2041188-601", contactName: "Elie Rizk" },
  { name: "Tony Gemayel", phone: "+961 3 881 004", email: "tony.g@example.com", address: "Tabarja" },
  { name: "Sea Breeze Diving Center", phone: "+961 9 640 225", email: "dive@seabreeze.example", address: "Batroun", contactName: "Maya Sfeir" },
  { name: "Joseph Aoun", phone: "+961 70 334 781", email: "joseph.aoun@example.com", address: "Amchit" },
  { name: "Fishing Cooperative of Tyre", phone: "+961 7 740 115", address: "Tyre fishing port", contactName: "Hassan Fakih" },
  { name: "Marc Daher", phone: "+961 3 552 908", email: "marc.daher@example.com", address: "Jounieh" },
  { name: "Carla Nassif", phone: "+961 71 228 640", email: "carla.n@example.com", address: "Dbayeh" },
];

const BOATS: { owner: string; name: string; type: string; make: string; model: string; lengthM: number; year: number; port: string; engines: { position: string; make: string; model: string; serial: string; hours: number }[] }[] = [
  { owner: "Karim Haddad", name: "Blue Horizon", type: "Motor yacht", make: "Azimut", model: "40 Fly", lengthM: 12.4, year: 2016, port: "Jounieh", engines: [{ position: "Port", make: "Volvo Penta", model: "D6-435", serial: "VP-2016-88412", hours: 1240 }, { position: "Starboard", make: "Volvo Penta", model: "D6-435", serial: "VP-2016-88413", hours: 1236 }] },
  { owner: "Nadine Khoury", name: "Sirocco", type: "RIB", make: "Zodiac", model: "Medline 7.5", lengthM: 7.5, year: 2020, port: "Beirut", engines: [{ position: "Outboard", make: "Yamaha", model: "F250", serial: "6P2-1045521", hours: 410 }] },
  { owner: "Georges Abi Nader", name: "Layla", type: "Sailing yacht", make: "Beneteau", model: "Oceanis 38", lengthM: 11.5, year: 2014, port: "Batroun", engines: [{ position: "Main", make: "Yanmar", model: "3JH5E", serial: "YM-3JH5-77021", hours: 2105 }] },
  { owner: "Rami Saade", name: "Speedy R", type: "Sport boat", make: "Sea Ray", model: "SPX 210", lengthM: 6.4, year: 2019, port: "Kaslik", engines: [{ position: "Outboard", make: "Mercury", model: "150 Pro XS", serial: "2B330876", hours: 520 }] },
  { owner: "Mediterranean Yacht Charters SAL", name: "Cedar Star", type: "Motor yacht", make: "Princess", model: "F50", lengthM: 15.2, year: 2018, port: "Dbayeh", engines: [{ position: "Port", make: "Volvo Penta", model: "IPS 800", serial: "IPS-18-55102", hours: 1890 }, { position: "Starboard", make: "Volvo Penta", model: "IPS 800", serial: "IPS-18-55103", hours: 1884 }, { position: "Generator", make: "Onan", model: "11 kW", serial: "ON-11-4410", hours: 3020 }] },
  { owner: "Mediterranean Yacht Charters SAL", name: "Cedar Moon", type: "Catamaran", make: "Lagoon", model: "42", lengthM: 12.8, year: 2021, port: "Dbayeh", engines: [{ position: "Port", make: "Yanmar", model: "4JH57", serial: "YM-4JH-21110", hours: 960 }, { position: "Starboard", make: "Yanmar", model: "4JH57", serial: "YM-4JH-21111", hours: 958 }] },
  { owner: "Sea Breeze Diving Center", name: "Dive One", type: "Dive boat", make: "Local build", model: "9 m", lengthM: 9, year: 2012, port: "Batroun", engines: [{ position: "Outboard", make: "Yamaha", model: "F150", serial: "6GL-1022874", hours: 3450 }] },
  { owner: "Fishing Cooperative of Tyre", name: "Al Bahr 3", type: "Fishing boat", make: "Local build", model: "11 m", lengthM: 11, year: 2009, port: "Tyre", engines: [{ position: "Main", make: "Perkins", model: "M135", serial: "PK-M135-0098", hours: 8800 }] },
  { owner: "Tony Gemayel", name: "Nayla", type: "Motor yacht", make: "Sunseeker", model: "Manhattan 52", lengthM: 16, year: 2015, port: "Tabarja", engines: [{ position: "Port", make: "MAN", model: "R6-730", serial: "MAN-R6-15330", hours: 1510 }, { position: "Starboard", make: "MAN", model: "R6-730", serial: "MAN-R6-15331", hours: 1502 }] },
  { owner: "Marc Daher", name: "Wave Rider", type: "RIB", make: "Capelli", model: "Tempest 570", lengthM: 5.7, year: 2022, port: "Jounieh", engines: [{ position: "Outboard", make: "Yamaha", model: "F115", serial: "6EK-1099120", hours: 180 }] },
];

// ── Per company ──

type Ctx = { slug: CompanySlug; companyId: string; userId: string; prefix: string };
const products = new Map<string, { id: string; price: number; type: string }>();
const customers = new Map<string, { id: string; name: string; phone: string | null; email: string | null; address: string | null; taxNumber: string | null; contactName: string | null }>();
const boats = new Map<string, string>();

const P = (name: string) => {
  const p = products.get(name);
  if (!p) throw new Error("No product " + name);
  return p;
};
const C = (name: string) => customers.get(name)!;

async function purchase(c: Ctx, supplier: string, invoiceNumber: string, date: string, items: [string, number, number][], paid: number) {
  const s = await prisma.supplier.findUniqueOrThrow({ where: { name: supplier } });
  const rows = items.map(([name, qty, cost]) => ({ productId: P(name).id, quantity: qty, unitPriceHT: cost, lineTotalHT: round2(qty * cost) }));
  const totalHT = round2(rows.reduce((t, r) => t + r.lineTotalHT, 0));
  const vatAmount = round2(totalHT * VAT_RATE);
  const totalTTC = round2(totalHT + vatAmount);
  await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.create({
      select: { id: true },
      data: {
        companyId: c.companyId, supplierId: s.id, invoiceNumber, purchaseDate: day(date), dueDate: addDays(date, 30), notes: NOTE, createdById: c.userId,
        subtotalHT: totalHT, discount: 0, totalHT, vatAmount, totalTTC,
        items: { create: rows },
        stockMovements: { create: rows.map((r) => ({ companyId: c.companyId, productId: r.productId, quantity: r.quantity, type: "PURCHASE" })) },
      },
    });
    const ledger = { companyId: c.companyId, invoiceNumber, purchaseDate: day(date), supplierId: s.id, supplierName: s.name, totalHT, vatAmount, totalTTC, createdById: c.userId };
    await postPurchase(tx, { id: p.id, ...ledger });
    await recomputePurchaseCosts(tx, p.id);
    if (paid > 0) {
      const a = await systemAccounts(c.companyId, tx);
      const amount = round2(paid === 1 ? totalTTC : paid);
      const number = await nextNumber(tx, c.companyId, "PV", day(date).getUTCFullYear());
      const pay = await tx.supplierPayment.create({
        select: { id: true },
        data: { companyId: c.companyId, number, purchaseId: p.id, amount, paidAt: addDays(date, 10), method: "BANK_TRANSFER", moneyAccountId: a.BANK, createdById: c.userId },
      });
      await postSupplierPayment(tx, { id: pay.id, companyId: c.companyId, number, amount, paidAt: addDays(date, 10), moneyAccountId: a.BANK, supplierId: s.id, supplierName: s.name, invoiceNumber, createdById: c.userId });
    }
  }, TRANSACTION_OPTIONS);
}

type L = [string, number] | [string, number, number]; // product, quantity, discount %

async function offer(c: Ctx, customer: string, boat: string | null, date: string, status: string, subject: string, lines: L[]) {
  const cu = C(customer);
  const rows = lines.map(([name, quantity, disc = 0], position) => {
    const p = P(name);
    return { position, kind: "ITEM" as const, productId: p.id, title: name, quantity, unit: p.type === "SERVICE" ? "job" : "pc", unitPrice: p.price, discountPercent: disc, lineTotal: lineTotal({ quantity, unitPrice: p.price, discountPercent: disc }) };
  });
  const t = offerTotals(rows.map((r) => ({ ...r, code: null, description: null })) as never, "PERCENT", 0, true);
  const year = day(date).getUTCFullYear();
  const prefix = `${c.prefix}-OF-${year}-`;
  const last = await prisma.offer.findFirst({ where: { number: { startsWith: prefix }, revision: 0 }, orderBy: { number: "desc" }, select: { number: true } });
  const number = prefix + String(last ? Number(last.number.slice(prefix.length, prefix.length + 4)) + 1 : 1).padStart(4, "0");
  return prisma.offer.create({
    data: {
      companyId: c.companyId, number, customerId: cu.id, customerName: cu.name, customerAttention: cu.contactName, customerAddress: cu.address, customerEmail: cu.email, customerPhone: cu.phone,
      vesselId: boat ? boats.get(boat) : null, subject, offerDate: day(date), validUntil: addDays(date, 30), status, notes: NOTE,
      discountType: "PERCENT", discountValue: 0, applyVat: true, paymentPlan: "FULL", ...t, createdById: c.userId,
      leadTime: "1–2 weeks from order", warranty: "6 months parts and labour",
      lines: { create: rows },
      paymentTerms: { create: [{ position: 0, label: "Full payment", mode: "PERCENT", value: 100, percent: 100, amount: t.totalTTC, dueDays: 0 }] },
    },
    include: { lines: true },
  });
}

async function job(c: Ctx, boat: string, date: string, status: "OPEN" | "IN_PROGRESS" | "DONE", complaint: string, workDone: string | null, technician: string, lines: [string, number][], offerId?: string) {
  const v = await prisma.vessel.findUniqueOrThrow({ where: { id: boats.get(boat)! }, include: { customer: true } });
  return prisma.$transaction(async (tx) => {
    const j = await tx.jobCard.create({
      data: {
        companyId: c.companyId, number: await nextNumber(tx, c.companyId, "JC", day(date).getUTCFullYear()), vesselId: v.id, customerId: v.customerId, customerName: v.customer!.name, offerId: offerId ?? null,
        status, complaint, workDone, technician, openedAt: day(date), dueDate: addDays(date, 7), completedAt: status === "DONE" ? addDays(date, 3) : null, applyVat: true, createdById: c.userId,
        lines: {
          create: lines.map(([name, quantity], position) => {
            const p = P(name);
            return { position, kind: p.type === "SERVICE" ? (name === "Labour" ? "LABOR" : "SERVICE") : "PART", productId: p.id, title: name, quantity, unitPrice: p.price, lineTotal: round2(quantity * p.price), billable: !offerId };
          }),
        },
      },
      include: { lines: true },
    });
    if (status === "DONE") {
      const costs = await averageCosts(c.companyId, tx);
      const parts = j.lines.filter((l) => l.kind === "PART" && l.productId);
      for (const l of parts) await tx.jobCardLine.update({ where: { id: l.id }, data: { unitCost: costs.get(l.productId!) ?? 0 } });
      if (parts.length) await tx.stockMovement.createMany({ data: parts.map((l) => ({ companyId: c.companyId, productId: l.productId!, quantity: -Math.round(Number(l.quantity)), type: "JOB_CARD", jobCardId: j.id })) });
    }
    return j;
  }, TRANSACTION_OPTIONS);
}

async function invoice(c: Ctx, customer: string, date: string, lines: { productId?: string; title: string; quantity: number; unitPrice: number; discountPercent?: number }[], extra: { jobCardId?: string; jobLineIds?: string[]; offerId?: string; vesselId?: string | null; subject?: string; dueDays?: number }) {
  const cu = C(customer);
  return prisma.$transaction(async (tx) => {
    const inv = await createInvoiceWithLines(tx, {
      slug: c.slug, companyId: c.companyId, createdById: c.userId, invoiceDate: day(date), dueDate: addDays(date, extra.dueDays ?? 15),
      customer: { id: cu.id, name: cu.name, address: cu.address, email: cu.email, phone: cu.phone, taxNumber: cu.taxNumber, attention: cu.contactName },
      subject: extra.subject ?? null, applyVat: true, lines, vesselId: extra.vesselId ?? null, jobCardId: extra.jobCardId ?? null, offerId: extra.offerId ?? null,
    });
    if (extra.jobLineIds?.length) await tx.jobCardLine.updateMany({ where: { id: { in: extra.jobLineIds } }, data: { invoiceId: inv.id } });
    return inv;
  }, TRANSACTION_OPTIONS);
}

async function receipt(c: Ctx, inv: { id: string; number: string; totalTTC: number }, customer: string, date: string, amount: number | "all", method: "CASH" | "BANK_TRANSFER") {
  const cu = C(customer);
  const a = await systemAccounts(c.companyId);
  const value = amount === "all" ? inv.totalTTC : amount;
  const moneyAccountId = method === "CASH" ? a.CASH : a.BANK;
  await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, c.companyId, "RV", day(date).getUTCFullYear());
    const r = await tx.customerReceipt.create({
      select: { id: true },
      data: { companyId: c.companyId, number, invoiceId: inv.id, customerId: cu.id, customerName: cu.name, amount: value, receivedAt: day(date), method, moneyAccountId, notes: NOTE, createdById: c.userId },
    });
    await postReceipt(tx, { id: r.id, companyId: c.companyId, number, amount: value, receivedAt: day(date), moneyAccountId, customerId: cu.id, customerName: cu.name, invoiceNumber: inv.number, createdById: c.userId });
    await refreshInvoiceStatus(tx, inv.id);
  }, TRANSACTION_OPTIONS);
}

async function expense(c: Ctx, date: string, code: string, partyName: string, description: string, amountHT: number, vat: boolean) {
  const account = await prisma.ledgerAccount.findFirstOrThrow({ where: { companyId: c.companyId, code } });
  const a = await systemAccounts(c.companyId);
  const vatAmount = vat ? round2(amountHT * VAT_RATE) : 0;
  const amount = round2(amountHT + vatAmount);
  await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, c.companyId, "PV", day(date).getUTCFullYear());
    const v = await tx.voucher.create({
      select: { id: true },
      data: { companyId: c.companyId, number, kind: "PAYMENT", date: day(date), moneyAccountId: a.BANK, counterAccountId: account.id, partyName, description, amountHT, vatAmount, amount, method: "BANK_TRANSFER", createdById: c.userId },
    });
    await postVoucher(tx, { id: v.id, companyId: c.companyId, number, kind: "PAYMENT", date: day(date), moneyAccountId: a.BANK, counterAccountId: account.id, partyName, description, amountHT, vatAmount, amount, createdById: c.userId });
  }, TRANSACTION_OPTIONS);
}

async function appointment(c: Ctx, customer: string, boat: string | null, date: string, time: string, status: string, source: string, reason: string) {
  const cu = C(customer);
  await prisma.$transaction(async (tx) => {
    await tx.appointment.create({
      data: {
        companyId: c.companyId, number: await nextNumber(tx, c.companyId, "AP", day(date).getUTCFullYear()), customerId: cu.id, customerName: cu.name, phone: cu.phone,
        vesselId: boat ? boats.get(boat) : null, reason, requestedDate: day(date), requestedTime: time, date: day(date), time, status, source,
      },
    });
  });
}

async function warranty(c: Ctx, customer: string, boat: string | null, product: string, serial: string | null, start: string, months: number, sourceLabel: string | null) {
  const cu = C(customer);
  const end = day(start);
  end.setUTCMonth(end.getUTCMonth() + months);
  end.setUTCDate(end.getUTCDate() - 1);
  await prisma.$transaction(async (tx) => {
    await tx.warranty.create({
      data: {
        companyId: c.companyId, number: await nextNumber(tx, c.companyId, "WR", day(start).getUTCFullYear()), customerId: cu.id, customerName: cu.name, vesselId: boat ? boats.get(boat) : null,
        productId: P(product).id, item: product, serialNumber: serial, startDate: day(start), endDate: end, terms: "Parts and labour. Excludes impact damage and wrong use.", sourceType: sourceLabel ? "JOB_CARD" : null, sourceLabel, createdById: c.userId,
      },
    });
  });
}

const fromJob = (j: { lines: { id: string; productId: string | null; title: string; quantity: unknown; unitPrice: unknown }[] }, discount = 0) =>
  j.lines.map((l) => ({ productId: l.productId ?? undefined, title: l.title, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPercent: l.title === "Labour" ? 0 : discount }));

async function main() {
  if (await prisma.customer.findUnique({ where: { name: CUSTOMERS[0].name } })) {
    console.log("Demo data is already there. Nothing to do.");
    return;
  }
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });

  // Shared records
  for (const s of SUPPLIERS) await prisma.supplier.upsert({ where: { name: s.name }, update: {}, create: { ...s, notes: NOTE } });
  for (const it of ITEMS) {
    const existing = await prisma.product.findFirst({ where: { name: it.name } });
    const supplierId = it.supplier ? (await prisma.supplier.findUniqueOrThrow({ where: { name: it.supplier } })).id : null;
    const p =
      existing ??
      (await prisma.$transaction(async (tx: Tx) =>
        tx.product.create({ data: { code: await nextItemCode(tx), name: it.name, type: it.type, unit: it.unit ?? null, priceHT: it.price, supplierId, minQuantity: it.min ?? 0, trackSerials: !!it.serials, description: it.description ?? null } }),
      ));
    products.set(it.name, { id: p.id, price: Number(p.priceHT), type: p.type });
  }
  for (const cu of CUSTOMERS) {
    const row = await prisma.customer.create({ data: { ...cu, notes: NOTE } });
    customers.set(cu.name, row);
  }
  for (const b of BOATS) {
    const v = await prisma.vessel.create({
      data: {
        name: b.name, customerId: C(b.owner).id, type: b.type, make: b.make, model: b.model, lengthM: b.lengthM, year: b.year, homePort: b.port, notes: NOTE,
        engines: { create: b.engines.map((e) => ({ position: e.position, make: e.make, model: e.model, serialNumber: e.serial, year: b.year, hours: e.hours, hoursAt: day("2026-10-15"), hoursBy: "Workshop" })) },
      },
    });
    boats.set(b.name, v.id);
  }

  const companies = await prisma.company.findMany();
  const ctx = (slug: CompanySlug): Ctx => ({ slug, companyId: companies.find((x) => x.slug === slug)!.id, userId: admin.id, prefix: slug === "xpert-marine" ? "XM" : "ER" });

  // ── Xpert Marine: workshop, parts and services ──
  const xm = ctx("xpert-marine");
  await purchase(xm, "Yamaha Motor Middle East", "YME-55120", "2026-08-04", [["Yamaha oil filter 69J-13440", 40, 9.5], ["Water pump impeller kit, Yamaha F150", 12, 36], ["Yamaha thermostat 6AW-12411", 10, 19], ["Yamaha F150 outboard engine", 2, 10900]], 1);
  await purchase(xm, "Marine Supply SARL", "MS-2026-0871", "2026-08-20", [["NGK spark plug LFR6A-11", 60, 4.2], ["4-stroke engine oil 10W-30, 1 L", 96, 7.5], ["Aluminium anode kit, outboard", 20, 24], ["Marine battery 12 V 100 Ah", 6, 128]], 1);
  await purchase(xm, "Brunswick Marine EMEA (Mercury)", "BME-771045", "2026-09-12", [["Mercury fuel filter 35-8M0093688", 30, 12.5], ["Quicksilver gear lube, 1 L", 36, 11]], 400);
  await purchase(xm, "Vetus BV", "VET-90231", "2026-09-28", [["Bilge pump 1100 GPH", 8, 48], ["LED navigation light set", 10, 29], ["Fuel water separator 10 micron", 12, 41]], 0);
  await purchase(xm, "Hempel Paints", "HEM-DK-33012", "2026-10-06", [["Antifouling paint Hempel Mille NCT, 2.5 L", 24, 78]], 0);

  const j1 = await job(xm, "Sirocco", "2026-08-18", "DONE", "Annual service on the F250, check the cooling.", "Oil and filter changed, new impeller, thermostat replaced, anodes changed. Test run OK.", "Ziad", [["Outboard 100-hour service", 1], ["Yamaha oil filter 69J-13440", 1], ["4-stroke engine oil 10W-30, 1 L", 7], ["Water pump impeller kit, Yamaha F150", 1], ["Yamaha thermostat 6AW-12411", 1], ["Aluminium anode kit, outboard", 1], ["Labour", 2]]);
  const j2 = await job(xm, "Dive One", "2026-09-02", "DONE", "Engine overheating, loses power at high rpm.", "Impeller worn out, fuel filter blocked. Replaced both, cleaned the water passages.", "Ziad", [["Engine diagnostic", 1], ["Water pump impeller kit, Yamaha F150", 1], ["Fuel water separator 10 micron", 1], ["NGK spark plug LFR6A-11", 4], ["Labour", 4]]);
  const j3 = await job(xm, "Speedy R", "2026-09-21", "DONE", "Haul out, antifouling and new battery.", "Hull washed, two coats of antifouling, new battery installed.", "Hadi", [["Haul-out and launch", 1], ["Hull pressure wash", 1], ["Antifouling paint Hempel Mille NCT, 2.5 L", 2], ["Antifouling application, per metre", 6.4], ["Marine battery 12 V 100 Ah", 1]]);
  const j4 = await job(xm, "Blue Horizon", "2026-10-14", "DONE", "Bilge pump not starting, navigation lights intermittent.", "Bilge pump replaced, LED navigation set installed and wiring redone.", "Hadi", [["Bilge pump 1100 GPH", 1], ["LED navigation light set", 1], ["Labour", 5]]);
  await job(xm, "Nayla", "2026-10-24", "IN_PROGRESS", "Both engines: 1500-hour service and gearbox oil.", "Port engine done, starboard in progress.", "Ziad", [["Engine diagnostic", 2], ["Quicksilver gear lube, 1 L", 6], ["Labour", 10]]);
  await job(xm, "Al Bahr 3", "2026-10-28", "IN_PROGRESS", "Engine smokes and hard to start in the morning.", null, "Ziad", [["Engine diagnostic", 1], ["Labour", 3]]);
  await job(xm, "Wave Rider", "2026-10-30", "OPEN", "First service, 200 hours.", null, "Hadi", [["Outboard 100-hour service", 1], ["Yamaha oil filter 69J-13440", 1], ["4-stroke engine oil 10W-30, 1 L", 5]]);
  await job(xm, "Layla", "2026-10-31", "OPEN", "Winterization before the season ends.", null, "Hadi", [["Winterization", 1], ["4-stroke engine oil 10W-30, 1 L", 6]]);

  const i1 = await invoice(xm, "Nadine Khoury", "2026-08-22", fromJob(j1), { jobCardId: j1.id, jobLineIds: j1.lines.map((l) => l.id), vesselId: j1.vesselId, subject: `Job card ${j1.number} · Sirocco` });
  const i2 = await invoice(xm, "Sea Breeze Diving Center", "2026-09-06", fromJob(j2, 10), { jobCardId: j2.id, jobLineIds: j2.lines.map((l) => l.id), vesselId: j2.vesselId, subject: `Job card ${j2.number} · Dive One`, dueDays: 30 });
  const i3 = await invoice(xm, "Rami Saade", "2026-09-25", fromJob(j3, 5), { jobCardId: j3.id, jobLineIds: j3.lines.map((l) => l.id), vesselId: j3.vesselId, subject: `Job card ${j3.number} · Speedy R` });
  await invoice(xm, "Karim Haddad", "2026-10-18", fromJob(j4), { jobCardId: j4.id, jobLineIds: j4.lines.map((l) => l.id), vesselId: j4.vesselId, subject: `Job card ${j4.number} · Blue Horizon`, dueDays: 30 });
  await receipt(xm, i1, "Nadine Khoury", "2026-08-25", "all", "CASH");
  await receipt(xm, i2, "Sea Breeze Diving Center", "2026-10-02", "all", "BANK_TRANSFER");
  await receipt(xm, i3, "Rami Saade", "2026-10-01", 500, "CASH");

  const o1 = await offer(xm, "Mediterranean Yacht Charters SAL", "Cedar Star", "2026-09-15", "ACCEPTED", "Cedar Star – pre-season service, both IPS engines", [["Engine diagnostic", 2], ["Labour", 16], ["Quicksilver gear lube, 1 L", 8, 10], ["Fuel water separator 10 micron", 2, 10], ["Aluminium anode kit, outboard", 4, 10]]);
  const i5 = await invoice(xm, "Mediterranean Yacht Charters SAL", "2026-10-05", o1.lines.map((l) => ({ productId: l.productId ?? undefined, title: l.title, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPercent: Number(l.discountPercent) })), { offerId: o1.id, vesselId: o1.vesselId, subject: o1.subject ?? undefined, dueDays: 45 });
  await receipt(xm, i5, "Mediterranean Yacht Charters SAL", "2026-10-20", round2(i5.totalTTC / 2), "BANK_TRANSFER");
  await offer(xm, "Mediterranean Yacht Charters SAL", "Cedar Moon", "2026-10-22", "SENT", "Cedar Moon – haul-out and antifouling", [["Haul-out and launch", 1], ["Hull pressure wash", 1], ["Antifouling paint Hempel Mille NCT, 2.5 L", 4, 5], ["Antifouling application, per metre", 12.8]]);
  await offer(xm, "Tony Gemayel", "Nayla", "2026-10-25", "SENT", "Nayla – new batteries and bilge pumps", [["Marine battery 12 V 100 Ah", 4, 5], ["Bilge pump 1100 GPH", 2], ["Labour", 6]]);
  await offer(xm, "Joseph Aoun", null, "2026-10-29", "DRAFT", "New Yamaha F150 with installation", [["Yamaha F150 outboard engine", 1, 3], ["Labour", 8]]);
  await offer(xm, "Lea Frem", null, "2026-09-03", "REJECTED", "Engine repower quotation", [["Yamaha F150 outboard engine", 2], ["Labour", 14]]);

  await appointment(xm, "Marc Daher", "Wave Rider", "2026-11-03", "09:00", "CONFIRMED", "STAFF", "Drop off for the 200-hour service");
  await appointment(xm, "Georges Abi Nader", "Layla", "2026-11-04", "10:30", "CONFIRMED", "STAFF", "Winterization");
  await appointment(xm, "Carla Nassif", null, "2026-11-05", "11:00", "REQUESTED", "PORTAL", "Quote for a new outboard");
  await appointment(xm, "Karim Haddad", "Blue Horizon", "2026-11-10", "08:30", "REQUESTED", "PORTAL", "Generator making noise");
  await warranty(xm, "Sea Breeze Diving Center", "Dive One", "Water pump impeller kit, Yamaha F150", null, "2026-09-06", 6, j2.number);
  await warranty(xm, "Karim Haddad", "Blue Horizon", "Bilge pump 1100 GPH", "BP1100-77821", "2026-10-18", 24, j4.number);

  await expense(xm, "2026-08-01", "613", "Kaslik Marina Properties", "Workshop rent, August", 1800, false);
  await expense(xm, "2026-09-01", "613", "Kaslik Marina Properties", "Workshop rent, September", 1800, false);
  await expense(xm, "2026-10-01", "613", "Kaslik Marina Properties", "Workshop rent, October", 1800, false);
  await expense(xm, "2026-09-10", "6061", "EDL", "Electricity, August", 340, true);
  await expense(xm, "2026-10-09", "6062", "Medco station", "Fuel for the work van", 160, true);
  await expense(xm, "2026-10-12", "623", "Social media ads", "Instagram campaign, October", 250, false);

  for (const e of [
    { name: "Ziad Karam", position: "Senior mechanic", baseSalary: 1400 },
    { name: "Hadi Mansour", position: "Mechanic", baseSalary: 950 },
    { name: "Nour Haddad", position: "Workshop assistant", baseSalary: 650 },
    { name: "Sami Tannous", position: "Storekeeper", baseSalary: 800 },
  ])
    await prisma.employee.create({ data: { companyId: xm.companyId, ...e, payFrequency: "MONTHLY", startDate: day("2024-03-01"), notes: NOTE } });

  // ── Eliche Radice: propellers and shafts ──
  const er = ctx("eliche-radice");
  await purchase(er, "Michigan Wheel", "MW-EXP-44871", "2026-08-07", [["Stainless steel propeller 3-blade 15 x 17", 6, 420], ["Aluminium propeller 3-blade 13 x 19", 10, 98], ["Bronze propeller 4-blade 22 x 24", 2, 1520], ["Propeller nut and washer kit", 30, 15], ["Flo-Torq hub kit", 20, 28]], 1);
  await purchase(er, "Vetus BV", "VET-90118", "2026-09-03", [["Stainless propeller shaft 35 mm x 1.5 m", 3, 520], ["Cutless bearing 35 mm", 12, 52], ["Shaft seal kit 35 mm", 6, 120]], 1500);

  const ej1 = await job(er, "Cedar Moon", "2026-09-08", "DONE", "Vibration at cruising speed on the port side.", "Port propeller bent: repaired and balanced, new cutless bearing, shaft aligned.", "Antoine", [["Propeller repair and balancing", 1], ["Cutless bearing 35 mm", 1], ["Shaft alignment", 1], ["Labour", 3]]);
  const ej2 = await job(er, "Speedy R", "2026-10-10", "DONE", "Propeller damaged on a rock.", "Fitted a new stainless propeller with new hub kit.", "Antoine", [["Stainless steel propeller 3-blade 15 x 17", 1], ["Flo-Torq hub kit", 1], ["Propeller nut and washer kit", 1], ["Labour", 1]]);
  await job(er, "Al Bahr 3", "2026-10-27", "IN_PROGRESS", "Replace the shaft seal, leaking.", null, "Antoine", [["Shaft seal kit 35 mm", 1], ["Labour", 4]]);
  await job(er, "Layla", "2026-10-30", "OPEN", "Pitch change to gain rpm.", null, "Antoine", [["Propeller pitch change", 1]]);

  const ei1 = await invoice(er, "Mediterranean Yacht Charters SAL", "2026-09-12", fromJob(ej1), { jobCardId: ej1.id, jobLineIds: ej1.lines.map((l) => l.id), vesselId: ej1.vesselId, subject: `Job card ${ej1.number} · Cedar Moon`, dueDays: 30 });
  const ei2 = await invoice(er, "Rami Saade", "2026-10-12", fromJob(ej2, 5), { jobCardId: ej2.id, jobLineIds: ej2.lines.map((l) => l.id), vesselId: ej2.vesselId, subject: `Job card ${ej2.number} · Speedy R` });
  await receipt(er, ei1, "Mediterranean Yacht Charters SAL", "2026-10-08", "all", "BANK_TRANSFER");
  await receipt(er, ei2, "Rami Saade", "2026-10-12", "all", "CASH");

  const eo1 = await offer(er, "Fishing Cooperative of Tyre", "Al Bahr 3", "2026-09-20", "ACCEPTED", "Al Bahr 3 – new bronze propeller and shaft", [["Bronze propeller 4-blade 22 x 24", 1, 8], ["Stainless propeller shaft 35 mm x 1.5 m", 1, 8], ["Cutless bearing 35 mm", 2], ["Shaft alignment", 1]]);
  const ei3 = await invoice(er, "Fishing Cooperative of Tyre", "2026-10-03", eo1.lines.map((l) => ({ productId: l.productId ?? undefined, title: l.title, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPercent: Number(l.discountPercent) })), { offerId: eo1.id, vesselId: eo1.vesselId, subject: eo1.subject ?? undefined, dueDays: 60 });
  await receipt(er, ei3, "Fishing Cooperative of Tyre", "2026-10-15", 1500, "CASH");
  await offer(er, "Nadine Khoury", "Sirocco", "2026-10-26", "SENT", "Spare stainless propeller for Sirocco", [["Stainless steel propeller 3-blade 15 x 17", 1, 5], ["Propeller nut and washer kit", 1]]);
  await offer(er, "Tony Gemayel", "Nayla", "2026-10-29", "DRAFT", "Nayla – propellers check and balancing", [["Propeller repair and balancing", 2], ["Haul-out and launch", 1]]);

  await appointment(er, "Nadine Khoury", "Sirocco", "2026-11-06", "10:00", "CONFIRMED", "STAFF", "Fit the spare propeller");
  await appointment(er, "Georges Abi Nader", "Layla", "2026-11-07", "09:30", "REQUESTED", "PORTAL", "Propeller pitch change");
  await warranty(er, "Rami Saade", "Speedy R", "Stainless steel propeller 3-blade 15 x 17", "MW-SS-151721-0087", "2026-10-12", 12, ej2.number);

  await expense(er, "2026-09-01", "613", "Dbayeh Industrial Zone", "Workshop rent, September", 1200, false);
  await expense(er, "2026-10-01", "613", "Dbayeh Industrial Zone", "Workshop rent, October", 1200, false);
  await expense(er, "2026-10-14", "616", "Bankers Assurance", "Workshop insurance, yearly", 950, false);

  for (const e of [
    { name: "Antoine Raffoul", position: "Propeller technician", baseSalary: 1250 },
    { name: "Elias Bou Saab", position: "Machinist", baseSalary: 900 },
  ])
    await prisma.employee.create({ data: { companyId: er.companyId, ...e, payFrequency: "MONTHLY", startDate: day("2023-06-01"), notes: NOTE } });

  console.log("Demo data added.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
