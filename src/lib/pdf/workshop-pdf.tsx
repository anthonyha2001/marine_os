import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CompanyProfile } from "@/lib/data/sales";
import type { VesselRow } from "@/lib/data/vessels";
import type { JobCardRow, WarrantyRow } from "@/lib/data/workshop";
import type { CompanySlug } from "@/lib/permissions";
import { BRAND, INK, Letterhead, MUTED, PageChrome, RULE, SectionHeading, TitleBlock, companyDisplayName, lines, longDate, money, s } from "./shared";

const KIND = { PART: "Part", LABOR: "Labour", SERVICE: "Service" } as const;

function VesselBox({ vessel, color }: { vessel: VesselRow | null; color: string }) {
  if (!vessel) return null;
  return (
    <View style={[s.party, { backgroundColor: "#f5f6f8" }]}>
      <Text style={[s.partyLabel, { color }]}>VESSEL</Text>
      <Text style={s.partyName}>{vessel.name}</Text>
      {(vessel.make || vessel.model) && <Text style={s.partyLine}>{[vessel.make, vessel.model].filter(Boolean).join(" ")}</Text>}
      {vessel.registration && <Text style={s.partyLine}>Reg. {vessel.registration}</Text>}
      {vessel.engines.map((e) => (
        <Text key={e.id} style={s.partyLine}>
          {e.position}: {[e.make, e.model].filter(Boolean).join(" ") || "—"}
          {e.serialNumber ? ` · S/N ${e.serialNumber}` : ""}
        </Text>
      ))}
    </View>
  );
}

/** Work order / job card: what was asked, what was done, parts and labour, signatures. */
export function JobCardPdf({ slug, job, vessel, company }: { slug: CompanySlug; job: JobCardRow; vessel: VesselRow | null; company: CompanyProfile }) {
  const brand = BRAND[slug];
  return (
    <Document title={`${job.number} · Job card`} author={companyDisplayName(company)} creator="Marine OS" producer="Marine OS">
      <Page size="A4" style={s.page} wrap>
        <PageChrome brand={brand} company={company} docLabel="Job card" number={job.number} marking={null} />
        <Letterhead brand={brand} company={company} />
        <TitleBlock
          brand={brand}
          title="JOB CARD"
          subtitle={job.offer ? `AS PER OFFER ${job.offer.number}` : "WORKSHOP WORK ORDER"}
          meta={[
            ["Job card No.", job.number],
            ["Opened", longDate.format(job.openedAt)],
            ...(job.completedAt ? ([["Completed", longDate.format(job.completedAt)]] as [string, string][]) : []),
            ...(job.engineHours !== null ? ([["Engine hours", String(job.engineHours)]] as [string, string][]) : []),
            ...(job.technician ? ([["Technician", job.technician]] as [string, string][]) : []),
          ]}
        />
        <View style={s.parties}>
          <View style={[s.party, { backgroundColor: brand.tint }]}>
            <Text style={[s.partyLabel, { color: brand.accent }]}>CUSTOMER</Text>
            <Text style={s.partyName}>{job.customerName}</Text>
          </View>
          <VesselBox vessel={vessel} color={MUTED} />
        </View>
        <SectionHeading brand={brand}>Work requested</SectionHeading>
        {lines(job.complaint).map((l) => (
          <Text key={l} style={{ fontSize: 9 }}>{l}</Text>
        ))}
        <SectionHeading brand={brand}>Work done and findings</SectionHeading>
        {job.workDone ? lines(job.workDone).map((l) => <Text key={l} style={{ fontSize: 9 }}>{l}</Text>) : <View style={{ height: 60, borderWidth: 0.6, borderColor: RULE, borderStyle: "dashed" }} />}

        {job.lines.length > 0 && (
          <>
            <SectionHeading brand={brand}>Parts and labour</SectionHeading>
            <View style={[s.th, { backgroundColor: brand.navy }]} fixed>
              <Text style={{ width: 52 }}>Type</Text>
              <Text style={s.cDesc}>Description</Text>
              <Text style={s.cQty}>Qty</Text>
              <Text style={s.cPrice}>Unit price</Text>
              <Text style={s.cAmt}>Amount (USD)</Text>
            </View>
            {job.lines.map((l) => (
              <View key={l.id} style={s.tr} wrap={false}>
                <Text style={{ width: 52, color: MUTED }}>{KIND[l.kind]}</Text>
                <Text style={[s.cDesc, s.itemTitle]}>{l.title}</Text>
                <Text style={s.cQty}>{l.quantity}</Text>
                <Text style={s.cPrice}>{money.format(l.unitPrice)}</Text>
                <Text style={[s.cAmt, { fontFamily: "Helvetica-Bold" }]}>{money.format(l.lineTotal)}</Text>
              </View>
            ))}
            <View style={s.totalsWrap}>
              <View style={s.totals}>
                <View style={[s.grandRow, { backgroundColor: brand.navy }]}>
                  <Text>TOTAL EXCL. VAT</Text>
                  <Text>{money.format(job.totalHT)}</Text>
                </View>
              </View>
            </View>
          </>
        )}

        <View style={s.signatures} wrap={false}>
          {["Technician", "Customer: work accepted"].map((l) => (
            <View key={l} style={s.signBox}>
              <Text style={[s.signLabel, { color: brand.navy }]}>{l}</Text>
              <Text style={s.signLine}>Name, signature and date</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

/** Warranty certificate for the customer. */
export function WarrantyPdf({ slug, warranty, company }: { slug: CompanySlug; warranty: WarrantyRow; company: CompanyProfile }) {
  const brand = BRAND[slug];
  const companyName = companyDisplayName(company);
  const rows: [string, string][] = [
    ["Item", warranty.item],
    ...(warranty.serialNumber ? ([["Serial number", warranty.serialNumber]] as [string, string][]) : []),
    ...(warranty.vessel ? ([["Vessel", warranty.vessel.name]] as [string, string][]) : []),
    ["Covered from", longDate.format(warranty.startDate)],
    ["Covered until", longDate.format(warranty.endDate)],
    ...(warranty.sourceLabel ? ([["Reference", warranty.sourceLabel]] as [string, string][]) : []),
  ];
  return (
    <Document title={`${warranty.number} · Warranty`} author={companyName} creator="Marine OS" producer="Marine OS">
      <Page size="A4" style={s.page}>
        <PageChrome brand={brand} company={company} docLabel="Warranty" number={warranty.number} marking={null} />
        <Letterhead brand={brand} company={company} />
        <TitleBlock brand={brand} title="WARRANTY CERTIFICATE" subtitle={`ISSUED TO ${warranty.customerName.toUpperCase()}`} meta={[["Certificate No.", warranty.number], ["Valid until", longDate.format(warranty.endDate)]]} />
        <View style={{ marginBottom: 14 }}>
          {rows.map(([label, value]) => (
            <View key={label} style={[s.tr, { paddingVertical: 7 }]}>
              <Text style={{ width: 130, color: MUTED, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Text>
              <Text style={{ flex: 1, fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>{value}</Text>
            </View>
          ))}
        </View>
        <SectionHeading brand={brand}>Terms</SectionHeading>
        <Text style={{ fontSize: 8.8, lineHeight: 1.5, color: INK }}>
          {warranty.terms ||
            "This warranty covers defects in materials and workmanship under normal use and correct maintenance for the period above. It does not cover wear, misuse, accidents, incorrect installation by others, or damage from fuel, water or electrical faults. Keep this certificate and present it with any claim."}
        </Text>
        <View style={[s.signatures, { justifyContent: "flex-end" }]} wrap={false}>
          <View style={{ width: 240 }}>
            <Text style={[s.signLabel, { color: brand.navy }]}>For {companyName}</Text>
            <Text style={s.signLine}>Authorised signature and stamp</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
