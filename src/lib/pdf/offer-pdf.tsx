import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CompanyProfile, OfferDetail } from "@/lib/data/sales";
import { amountInWords, dueLabel, itemNumbers } from "@/lib/offers";
import { VAT_RATE } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";
import {
  BRAND,
  BankDetails,
  Letterhead,
  MUTED,
  PageChrome,
  RULE,
  SectionHeading,
  TitleBlock,
  companyDisplayName,
  fmtQty,
  lines,
  longDate,
  money,
  s,
} from "./shared";

export function OfferPdf({ slug, offer, company }: { slug: CompanySlug; offer: OfferDetail; company: CompanyProfile }) {
  const brand = BRAND[slug];
  const companyName = companyDisplayName(company);
  const showDiscountCol = offer.lines.some((l) => l.kind === "ITEM" && l.discountPercent > 0);
  const terms = lines(offer.terms);
  const numbers = itemNumbers(offer.lines);

  return (
    <Document
      title={`${offer.number}${offer.subject ? ` · ${offer.subject}` : ""}`}
      author={companyName}
      subject={`Commercial offer for ${offer.customerName}`}
      creator="Marine OS"
      producer="Marine OS"
    >
      <Page size="A4" style={s.page} wrap>
        <PageChrome brand={brand} company={company} docLabel="Commercial offer" number={offer.number} marking={offer.marking} />
        <Letterhead brand={brand} company={company} />

        <TitleBlock
          brand={brand}
          title="COMMERCIAL OFFER"
          subtitle="QUOTATION FOR SERVICES AND SUPPLIES"
          meta={[
            ["Offer No.", offer.number],
            ["Date", longDate.format(offer.offerDate)],
            ["Valid until", longDate.format(offer.validUntil)],
            ...(offer.reference ? ([["Your ref.", offer.reference]] as [string, string][]) : []),
          ]}
        />

        {/* Parties */}
        <View style={s.parties}>
          <View style={[s.party, { backgroundColor: brand.tint }]}>
            <Text style={[s.partyLabel, { color: brand.accent }]}>PREPARED FOR</Text>
            <Text style={s.partyName}>{offer.customerName}</Text>
            {offer.customerAttention && <Text style={s.partyLine}>Attn: {offer.customerAttention}</Text>}
            {lines(offer.customerAddress).map((l) => (
              <Text key={l} style={s.partyLine}>{l}</Text>
            ))}
            {offer.customerPhone && <Text style={s.partyLine}>Tel. {offer.customerPhone}</Text>}
            {offer.customerEmail && <Text style={s.partyLine}>{offer.customerEmail}</Text>}
          </View>
          <View style={[s.party, { backgroundColor: "#f5f6f8" }]}>
            <Text style={[s.partyLabel, { color: MUTED }]}>PREPARED BY</Text>
            <Text style={s.partyName}>{companyName}</Text>
            <Text style={s.partyLine}>{offer.createdByName}</Text>
            <Text style={s.partyLine}>{company.email ?? offer.createdByEmail}</Text>
            {company.phone && <Text style={s.partyLine}>Tel. {company.phone}</Text>}
          </View>
        </View>

        {offer.subject && (
          <Text style={s.subject}>
            <Text style={s.subjectLabel}>Subject: </Text>
            {offer.subject}
          </Text>
        )}
        {offer.intro && <Text style={s.paragraph}>{offer.intro}</Text>}

        {/* Lines */}
        <View>
          <View style={[s.th, { backgroundColor: brand.navy }]} fixed>
            <Text style={s.cNo}>No.</Text>
            <Text style={s.cDesc}>Description</Text>
            <Text style={s.cQty}>Qty</Text>
            <Text style={s.cUnit}>Unit</Text>
            <Text style={s.cPrice}>Unit price</Text>
            {showDiscountCol && <Text style={s.cDisc}>Disc.</Text>}
            <Text style={s.cAmt}>Amount (USD)</Text>
          </View>
          {offer.lines.map((line, index) => {
            if (line.kind === "SECTION") {
              return (
                <View key={line.id} wrap={false} minPresenceAhead={60} style={{ backgroundColor: brand.tint }}>
                  <Text style={[s.section, { color: brand.navy }]}>{line.title}</Text>
                  {line.description && <Text style={[s.itemDesc, { paddingHorizontal: 6, paddingBottom: 5, marginTop: 0 }]}>{line.description}</Text>}
                </View>
              );
            }
            return (
              <View key={line.id} style={s.tr} wrap={false}>
                <Text style={[s.cNo, { color: MUTED }]}>{numbers[index]}</Text>
                <View style={s.cDesc}>
                  <Text style={s.itemTitle}>{line.title}</Text>
                  {line.description && <Text style={s.itemDesc}>{line.description}</Text>}
                  {line.code && <Text style={s.itemRef}>REF. {line.code}</Text>}
                </View>
                <Text style={s.cQty}>{fmtQty(line.quantity)}</Text>
                <Text style={[s.cUnit, { color: MUTED }]}>{line.unit ?? ""}</Text>
                <Text style={s.cPrice}>{money.format(line.unitPrice)}</Text>
                {showDiscountCol && (
                  <Text style={[s.cDisc, { color: MUTED }]}>{line.discountPercent > 0 ? `${fmtQty(line.discountPercent)}%` : "—"}</Text>
                )}
                <Text style={[s.cAmt, { fontFamily: "Helvetica-Bold" }]}>{money.format(line.lineTotal)}</Text>
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View wrap={false}>
          <View style={s.totalsWrap}>
            <View style={s.totals}>
              <View style={s.totalRow}>
                <Text style={{ color: MUTED }}>Subtotal</Text>
                <Text>{money.format(offer.subtotal)}</Text>
              </View>
              {offer.discountTotal > 0 && (
                <View style={s.totalRow}>
                  <Text style={{ color: MUTED }}>
                    Discount{offer.discountType === "PERCENT" ? ` (${fmtQty(offer.discountValue)}%)` : ""}
                  </Text>
                  <Text>– {money.format(offer.discountTotal)}</Text>
                </View>
              )}
              <View style={[s.totalRow, { borderTopWidth: 0.6, borderTopColor: RULE, marginTop: 2, paddingTop: 5 }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Total excl. VAT</Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{money.format(offer.totalHT)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={{ color: MUTED }}>{offer.applyVat ? `VAT ${VAT_RATE * 100}%` : "VAT"}</Text>
                <Text>{offer.applyVat ? money.format(offer.vatAmount) : "Exempt"}</Text>
              </View>
              <View style={[s.grandRow, { backgroundColor: brand.navy }]}>
                <Text>TOTAL (USD)</Text>
                <Text>{money.format(offer.totalTTC)}</Text>
              </View>
            </View>
          </View>
          <Text style={s.words}>Amount in words: {amountInWords(offer.totalTTC)}.</Text>
        </View>

        {/* Payment schedule */}
        {offer.paymentTerms.length > 0 && (
          <View wrap={false}>
            <SectionHeading brand={brand}>Payment schedule</SectionHeading>
            <View style={[s.th, { backgroundColor: brand.navy }]}>
              <Text style={s.cNo}>No.</Text>
              <Text style={s.cDesc}>Payment</Text>
              <Text style={{ width: 110 }}>Due</Text>
              <Text style={{ width: 52, textAlign: "right" }}>Share</Text>
              <Text style={s.cAmt}>Amount (USD)</Text>
            </View>
            {offer.paymentTerms.map((t, i) => (
              <View key={t.id} style={s.tr}>
                <Text style={[s.cNo, { color: MUTED }]}>{i + 1}</Text>
                <Text style={[s.cDesc, { fontFamily: "Helvetica-Bold" }]}>{t.label}</Text>
                <Text style={{ width: 110, color: MUTED }}>{dueLabel(t.dueDays)}</Text>
                <Text style={{ width: 52, textAlign: "right" }}>{fmtQty(Math.round(t.percent * 100) / 100)}%</Text>
                <Text style={[s.cAmt, { fontFamily: "Helvetica-Bold" }]}>{money.format(t.amount)}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 7.6, color: MUTED, marginTop: 5 }}>
              Amounts include VAT where applicable. Each payment is invoiced separately.
            </Text>
          </View>
        )}

        {terms.length > 0 && (
          <View>
            <SectionHeading brand={brand}>Terms and conditions</SectionHeading>
            {terms.map((t, i) => (
              <View key={i} style={s.term} wrap={false}>
                <Text style={s.termNo}>{i + 1}.</Text>
                <Text style={{ flex: 1 }}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <BankDetails brand={brand} company={company} />

        {/* Signatures */}
        <View style={s.signatures} wrap={false}>
          <View style={s.signBox}>
            <Text style={[s.signLabel, { color: brand.navy }]}>For {companyName}</Text>
            <Text style={s.signLine}>Authorised signature</Text>
            <Text style={s.signLine}>Name and title</Text>
            <View style={s.stamp}>
              <Text>COMPANY STAMP</Text>
            </View>
          </View>
          <View style={s.signBox}>
            <Text style={[s.signLabel, { color: brand.navy }]}>Accepted by the customer</Text>
            <Text style={s.signLine}>Signature and date</Text>
            <Text style={s.signLine}>Name and title</Text>
            <View style={s.stamp}>
              <Text>CUSTOMER STAMP</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
