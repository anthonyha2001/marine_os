import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CompanySlug } from "@/lib/permissions";
import type { ItemType, ServiceUnit } from "@/lib/catalogue";

// Reads are cached in server memory ("use cache") because the database is far away.
// Every mutation calls updateTag() with the matching tag, so changes show immediately.
export const tags = {
  products: "products",
  suppliers: "suppliers",
  stock: (companyId: string) => `stock:${companyId}`,
  purchases: (companyId: string) => `purchases:${companyId}`,
};

// Company rows never change, so remember their ids instead of a database round trip per request.
const companyIds = new Map<CompanySlug, string>();

export async function companyIdFor(slug: CompanySlug) {
  const cached = companyIds.get(slug);
  if (cached) return cached;
  const company = await prisma.company.findUniqueOrThrow({ where: { slug }, select: { id: true } });
  companyIds.set(slug, company.id);
  return company.id;
}

export type StockStatus = "out" | "low" | "ok";

export function stockStatus(stock: number, minQuantity: number): StockStatus {
  if (stock <= 0) return "out";
  if (stock <= minQuantity) return "low";
  return "ok";
}

export type CatalogueProduct = {
  id: string;
  code: string;
  type: ItemType;
  unit: ServiceUnit | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  supplierId: string | null;
  supplierName: string | null;
  priceHT: number;
  minQuantity: number;
  active: boolean;
  trackSerials: boolean;
  barcodes: string[];
};

/** The shared catalogue of products and services (plain values so it can be cached). */
export async function getCatalogue(): Promise<CatalogueProduct[]> {
  "use cache";
  cacheTag(tags.products);
  cacheLife("hours");

  const products = await prisma.product.findMany({
    include: { supplier: { select: { name: true } }, barcodes: { select: { code: true } } },
    orderBy: { name: "asc" },
  });
  return products.map((p) => ({
    id: p.id,
    code: p.code,
    type: p.type as ItemType,
    unit: p.unit as ServiceUnit | null,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    supplierId: p.supplierId,
    supplierName: p.supplier?.name ?? null,
    priceHT: Number(p.priceHT),
    minQuantity: p.minQuantity,
    active: p.active,
    trackSerials: p.trackSerials,
    barcodes: p.barcodes.map((b) => b.code),
  }));
}

/** Quantity on hand per product for one company. */
async function getStock(companyId: string): Promise<Record<string, number>> {
  "use cache";
  cacheTag(tags.stock(companyId));
  cacheLife("hours");

  const rows = await prisma.stockMovement.groupBy({
    by: ["productId"],
    where: { companyId },
    _sum: { quantity: true },
  });
  return Object.fromEntries(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
}

function matches(p: CatalogueProduct, q: string) {
  const needle = q.toLowerCase();
  return p.name.toLowerCase().includes(needle) || p.code.startsWith(q) || p.barcodes.some((b) => b.includes(q));
}

/** Shared catalogue with this company's stock level for each product. */
export async function listProductsWithStock(slug: CompanySlug, search?: string) {
  const companyId = await companyIdFor(slug);
  const [catalogue, stock] = await Promise.all([getCatalogue(), getStock(companyId)]);
  const q = search?.trim();
  return catalogue
    .filter((p) => p.type === "PRODUCT" && (!q || matches(p, q)))
    .map((p) => {
      const onHand = stock[p.id] ?? 0;
      return { ...p, stock: onHand, status: stockStatus(onHand, p.minQuantity) };
    });
}

export async function getProduct(id: string) {
  return (await getCatalogue()).find((p) => p.id === id && p.type === "PRODUCT") ?? null;
}

export async function listServices(search?: string) {
  const q = search?.trim();
  return (await getCatalogue()).filter((p) => p.type === "SERVICE" && (!q || matches(p, q)));
}

export async function getService(id: string) {
  return (await getCatalogue()).find((p) => p.id === id && p.type === "SERVICE") ?? null;
}

/** Stocked products for the purchase entry table (searched in the browser). */
export async function productCatalogue() {
  return (await getCatalogue())
    .filter((p) => p.active && p.type === "PRODUCT")
    .map(({ id, code, name, priceHT, barcodes, supplierId }) => ({ id, code, name, priceHT, barcodes, supplierId }));
}

export async function listSuppliers() {
  "use cache";
  cacheTag(tags.suppliers);
  cacheLife("hours");
  return prisma.supplier.findMany({ orderBy: { name: "asc" } });
}

async function getPurchases(companyId: string) {
  "use cache";
  cacheTag(tags.purchases(companyId));
  cacheLife("hours");

  const purchases = await prisma.purchase.findMany({
    where: { companyId },
    include: {
      supplier: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });
  return purchases.map((p) => ({
    id: p.id,
    invoiceNumber: p.invoiceNumber,
    reference: p.reference,
    purchaseDate: p.purchaseDate,
    supplierName: p.supplier.name,
    itemCount: p._count.items,
    totalHT: Number(p.totalHT),
    totalTTC: Number(p.totalTTC),
  }));
}

export async function listPurchases(slug: CompanySlug) {
  return getPurchases(await companyIdFor(slug));
}

async function getPurchaseDetail(companyId: string, id: string) {
  "use cache";
  cacheTag(tags.purchases(companyId));
  cacheLife("hours");

  const p = await prisma.purchase.findFirst({
    where: { id, companyId },
    include: {
      supplier: { select: { name: true, accountNumber: true } },
      createdBy: { select: { name: true } },
      purchaseOrder: { select: { id: true, number: true } },
      items: { include: { product: { select: { code: true, name: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    invoiceNumber: p.invoiceNumber,
    reference: p.reference,
    purchaseDate: p.purchaseDate,
    dueDate: p.dueDate ?? p.purchaseDate,
    purchaseOrder: p.purchaseOrder,
    notes: p.notes,
    createdAt: p.createdAt,
    createdByName: p.createdBy.name,
    supplierName: p.supplier.name,
    supplierAccount: p.supplier.accountNumber,
    subtotalHT: Number(p.subtotalHT),
    discount: Number(p.discount),
    totalHT: Number(p.totalHT),
    vatAmount: Number(p.vatAmount),
    totalTTC: Number(p.totalTTC),
    items: p.items.map((i) => ({
      id: i.id,
      code: i.product.code,
      name: i.product.name,
      quantity: i.quantity,
      unitPriceHT: Number(i.unitPriceHT),
      lineTotalHT: Number(i.lineTotalHT),
    })),
  };
}

/** A purchase, only if it belongs to this company. */
export async function getPurchase(slug: CompanySlug, id: string) {
  return getPurchaseDetail(await companyIdFor(slug), id);
}
