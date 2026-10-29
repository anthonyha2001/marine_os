import "server-only";
import fs from "fs";
import path from "path";
import { createContext, useContext } from "react";
import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { CompanyProfile } from "@/lib/data/sales";
import type { CompanySlug } from "@/lib/permissions";

// Shared building blocks for offer and invoice PDFs, so both documents look the same.

// Brand per company: logo + two colours taken from the logos.
export const BRAND: Record<CompanySlug, { logo: string; navy: string; accent: string; tint: string }> = {
  "xpert-marine": { logo: "xpert-marine-pdf.png", navy: "#0a2146", accent: "#1565c0", tint: "#eef3fa" },
  "eliche-radice": { logo: "eliche-radice-pdf.png", navy: "#141b2d", accent: "#b5772f", tint: "#f7f1ea" },
};
export type Brand = (typeof BRAND)[CompanySlug];

// Formal documents don't hyphenate words across lines.
Font.registerHyphenationCallback((word) => [word]);

// Logos are passed as bytes: react-pdf misreads Windows file paths.
const logoCache = new Map<string, Buffer>();
export function logoData(file: string) {
  if (!logoCache.has(file)) logoCache.set(file, fs.readFileSync(path.join(process.cwd(), "public", "logos", file)));
  return { data: logoCache.get(file)!, format: "png" as const };
}

export const INK = "#1d2433";
export const MUTED = "#5f6b7d";
export const RULE = "#d9dee6";

export const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : money.format(n));

export function lines(text: string | null | undefined) {
  return (text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
}

export const s = StyleSheet.create({
  page: { paddingTop: 46, paddingBottom: 64, paddingHorizontal: 46, fontFamily: "Helvetica", fontSize: 9, color: INK, lineHeight: 1.35 },
  marking: { position: "absolute", left: 0, right: 0, textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 2.5, color: "#a11d1d" },
  // Letterhead
  letterhead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { height: 52, objectFit: "contain" },
  companyBlock: { width: 230, textAlign: "right", fontSize: 7.8, color: MUTED, lineHeight: 1.45 },
  companyName: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: INK, marginBottom: 2 },
  accentRule: { height: 2.2, marginTop: 14, marginBottom: 18 },
  // Title
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 21, letterSpacing: 3, lineHeight: 1.15 },
  titleSub: { fontSize: 8, color: MUTED, letterSpacing: 1.5, marginTop: 6, lineHeight: 1.2 },
  meta: { width: 215 },
  metaRow: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: RULE, paddingVertical: 3.2 },
  metaLabel: { width: 82, fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8 },
  metaValue: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 8.6, textAlign: "right" },
  // Parties
  parties: { flexDirection: "row", gap: 14, marginBottom: 16 },
  party: { flex: 1, padding: 11, borderRadius: 3 },
  partyLabel: { fontFamily: "Helvetica-Bold", fontSize: 7, letterSpacing: 1.6, marginBottom: 5 },
  partyName: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginBottom: 2 },
  partyLine: { fontSize: 8.4, color: INK },
  subject: { fontSize: 9.5, marginBottom: 10 },
  subjectLabel: { fontFamily: "Helvetica-Bold" },
  paragraph: { marginBottom: 12, fontSize: 9, lineHeight: 1.5 },
  // Table
  th: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 7.4, letterSpacing: 0.6, textTransform: "uppercase" },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.6, borderBottomColor: RULE },
  section: { paddingVertical: 6, paddingHorizontal: 6, fontFamily: "Helvetica-Bold", fontSize: 8.4, letterSpacing: 0.9, textTransform: "uppercase", marginTop: 4 },
  cNo: { width: 24 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 40, textAlign: "right" },
  cUnit: { width: 46, textAlign: "center" },
  cPrice: { width: 70, textAlign: "right" },
  cDisc: { width: 38, textAlign: "right" },
  cAmt: { width: 78, textAlign: "right" },
  itemTitle: { fontFamily: "Helvetica-Bold", fontSize: 8.8 },
  itemDesc: { fontSize: 8, color: MUTED, marginTop: 2, lineHeight: 1.4 },
  itemRef: { fontSize: 6.8, color: MUTED, marginTop: 2, letterSpacing: 0.4 },
  // Totals
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  totals: { width: 250 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5, paddingHorizontal: 8, fontSize: 8.8 },
  grandRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 8, marginTop: 4, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 11 },
  words: { marginTop: 8, fontSize: 8.4, color: INK, textAlign: "right", fontFamily: "Helvetica-Oblique" },
  // Text sections
  h2: { fontFamily: "Helvetica-Bold", fontSize: 8.6, letterSpacing: 1.6, textTransform: "uppercase", marginTop: 20, marginBottom: 7, paddingBottom: 4, borderBottomWidth: 0.8 },
  term: { flexDirection: "row", marginBottom: 3.5, fontSize: 8.6, lineHeight: 1.45 },
  termNo: { width: 18, color: MUTED },
  // Signatures
  signatures: { flexDirection: "row", gap: 26, marginTop: 26 },
  signBox: { flex: 1 },
  signLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.4, letterSpacing: 1.4, marginBottom: 34, textTransform: "uppercase" },
  signLine: { borderTopWidth: 0.8, borderTopColor: INK, paddingTop: 4, fontSize: 7.8, color: MUTED, marginBottom: 14 },
  stamp: { height: 58, borderWidth: 0.8, borderColor: RULE, borderStyle: "dashed", borderRadius: 3, alignItems: "center", justifyContent: "center", fontSize: 7, color: MUTED, letterSpacing: 1.2 },
  // Running header / footer. Anchored from the top: react-pdf drops fixed Views positioned with "bottom".
  runningHeader: { position: "absolute", top: 24, left: 46, right: 46 },
  runningHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 0.6, borderBottomColor: RULE, paddingBottom: 5, fontSize: 7.5, color: MUTED },
  footer: { position: "absolute", top: 796, left: 46, right: 46, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.6, borderTopColor: RULE, paddingTop: 6, fontSize: 6.9, color: MUTED },
});

export function companyDisplayName(company: CompanyProfile) {
  return company.legalName || company.name;
}

/**
 * Footer, protective markings and the compact header for pages 2+.
 * Render this first inside <Page>: fixed elements declared first repeat on every page.
 */
export function PageChrome({
  brand,
  company,
  docLabel,
  number,
  marking,
}: {
  brand: Brand;
  company: CompanyProfile;
  docLabel: string;
  number: string;
  marking: string | null;
}) {
  const name = companyDisplayName(company);
  const legalBits = [
    name,
    company.registrationNumber && `C.R. ${company.registrationNumber}`,
    company.taxNumber && `VAT No. ${company.taxNumber}`,
  ].filter(Boolean);

  return (
    <>
      <View style={s.footer} fixed>
        <Text>{legalBits.join("  ·  ")}</Text>
        <Text render={({ pageNumber, totalPages }) => `${number}   ·   Page ${pageNumber} of ${totalPages}`} />
      </View>
      {marking && (
        <>
          <Text style={[s.marking, { top: 10 }]} fixed>{marking}</Text>
          <Text style={[s.marking, { bottom: 10 }]} fixed>{marking}</Text>
        </>
      )}
      {/* Text only: images aren't supported in render props. */}
      <View
        style={s.runningHeader}
        fixed
        render={({ pageNumber }) =>
          pageNumber > 1 ? (
            <View style={s.runningHeaderRow}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: brand.navy, letterSpacing: 1 }}>{name.toUpperCase()}</Text>
              <Text>
                {docLabel} <Text style={{ fontFamily: "Helvetica-Bold", color: INK }}>{number}</Text>
              </Text>
            </View>
          ) : null
        }
      />
    </>
  );
}

/** Logo on the left, company details on the right, then the accent rule. */
export function Letterhead({ brand, company }: { brand: Brand; company: CompanyProfile }) {
  return (
    <>
      <View style={s.letterhead}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
        <Image src={logoData(brand.logo)} style={s.logo} />
        <View style={s.companyBlock}>
          <Text style={s.companyName}>{companyDisplayName(company)}</Text>
          {lines(company.address).map((l) => (
            <Text key={l}>{l}</Text>
          ))}
          {company.phone && <Text>Tel. {company.phone}</Text>}
          {company.email && <Text>{company.email}</Text>}
          {company.website && <Text>{company.website}</Text>}
          {company.taxNumber && <Text>VAT No. {company.taxNumber}</Text>}
          {company.registrationNumber && <Text>C.R. {company.registrationNumber}</Text>}
        </View>
      </View>
      <View style={[s.accentRule, { backgroundColor: brand.accent }]} />
    </>
  );
}

/** Big document title on the left, reference table on the right. */
export function TitleBlock({
  brand,
  title,
  subtitle,
  meta,
}: {
  brand: Brand;
  title: string;
  subtitle: string;
  meta: [string, string][];
}) {
  return (
    <View style={s.titleRow}>
      {/* flex + padding: a long subtitle wraps instead of running into the reference table */}
      <View style={{ flex: 1, paddingRight: 18 }}>
        <Text style={[s.title, { color: brand.navy }]}>{title}</Text>
        <TitleArabic title={title} color={brand.navy} />
        <Text style={s.titleSub}>{subtitle}</Text>
      </View>
      <View style={s.meta}>
        {meta.map(([label, value]) => (
          <View key={label} style={s.metaRow}>
            <T en={label} style={s.metaLabel} />
            <Text style={s.metaValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TitleArabic({ title, color }: { title: string; color: string }) {
  const bilingual = useContext(BilingualContext);
  if (!bilingual || !AR[title]) return null;
  return <Text style={{ fontFamily: "Cairo", fontWeight: "bold", fontSize: 15, color, marginTop: 2 }}>{AR[title]}</Text>;
}

export function SectionHeading({ brand, children }: { brand: Brand; children: string }) {
  const bilingual = useContext(BilingualContext);
  return (
    <Text style={[s.h2, { color: brand.navy, borderBottomColor: brand.accent }]} minPresenceAhead={40}>
      {children}
      {bilingual && AR[children] ? <Text style={{ fontFamily: "Cairo", fontWeight: "bold", letterSpacing: 0 }}>{"   " + AR[children]}</Text> : null}
    </Text>
  );
}

export function BankDetails({ brand, company }: { brand: Brand; company: CompanyProfile }) {
  if (!company.bankDetails) return null;
  return (
    <View wrap={false}>
      <SectionHeading brand={brand}>Bank details</SectionHeading>
      {lines(company.bankDetails).map((l) => (
        <Text key={l} style={{ fontSize: 8.6 }}>{l}</Text>
      ))}
    </View>
  );
}

// ── Bilingual (English + Arabic) documents ──
// Customers can get documents with Arabic under every English label (Customer → Documents
// language). Cairo is used for Arabic: it renders correctly in react-pdf (letters joined, dots kept).

Font.register({
  family: "Cairo",
  fonts: [
    { src: path.join(process.cwd(), "public", "fonts", "Cairo-Regular.ttf") },
    { src: path.join(process.cwd(), "public", "fonts", "Cairo-Bold.ttf"), fontWeight: "bold" },
  ],
});

export const AR: Record<string, string> = {
  "TAX INVOICE": "فاتورة ضريبية",
  INVOICE: "فاتورة",
  "COMMERCIAL OFFER": "عرض أسعار",
  "Invoice No.": "رقم الفاتورة",
  "Offer No.": "رقم العرض",
  Date: "التاريخ",
  "Invoice date": "تاريخ الفاتورة",
  "Due date": "تاريخ الاستحقاق",
  "Valid until": "صالح حتى",
  "Your ref.": "مرجعكم",
  "BILL TO": "فاتورة إلى",
  FROM: "من",
  "PREPARED FOR": "مُعدّ لـ",
  "PREPARED BY": "مُعدّ من",
  "No.": "رقم",
  Description: "البيان",
  Qty: "الكمية",
  Unit: "الوحدة",
  "Unit price": "سعر الوحدة",
  "Disc.": "حسم",
  "Amount (USD)": "المبلغ (دولار)",
  Subtotal: "المجموع الفرعي",
  Discount: "الحسم",
  "Total excl. VAT": "المجموع قبل الضريبة",
  "TOTAL (USD)": "المجموع (دولار)",
  "TOTAL DUE (USD)": "المبلغ المستحق (دولار)",
  "TOTAL PAID (USD)": "المبلغ المدفوع (دولار)",
  Payment: "الدفعة",
  Due: "الاستحقاق",
  Share: "النسبة",
  "Payment schedule": "جدول الدفعات",
  "Terms and conditions": "الشروط والأحكام",
  "Bank details": "التفاصيل المصرفية",
  "Authorised signature and stamp": "التوقيع والختم",
  "Authorised signature": "التوقيع المعتمد",
  "Accepted by the customer": "موافقة الزبون",
  "Signature and date": "التوقيع والتاريخ",
  "Name and title": "الاسم والصفة",
  "COMPANY STAMP": "ختم الشركة",
  "CUSTOMER STAMP": "ختم الزبون",
};

/** Whether the document being rendered is bilingual (set once at the top of each PDF). */
export const BilingualContext = createContext(false);

/**
 * A label: the English text, plus the Arabic translation underneath on bilingual documents.
 * `style` sets the cell (width, alignment, colour…); the Arabic line is smaller and in Cairo.
 */
export function T({ en, ar, style }: { en: string; ar?: string; style?: Style | Style[] }) {
  const bilingual = useContext(BilingualContext);
  const arabic = ar ?? AR[en];
  if (!bilingual || !arabic) return <Text style={style}>{en}</Text>;
  return (
    <View style={style}>
      <Text>{en}</Text>
      <Text style={{ fontFamily: "Cairo", fontWeight: "normal", fontSize: 7.4, letterSpacing: 0, textTransform: "none", lineHeight: 1.3 }}>{arabic}</Text>
    </View>
  );
}
