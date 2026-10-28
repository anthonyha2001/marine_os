import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { SaleRow } from "@/lib/data/pos";
import type { CompanyProfile } from "@/lib/data/sales";
import { amountInWords } from "@/lib/offers";
import { VAT_RATE } from "@/lib/money";
import { formatLbp, formatRate } from "@/lib/pos";
import type { CompanySlug } from "@/lib/permissions";
import { BRAND, INK, Letterhead, MUTED, PageChrome, RULE, TitleBlock, companyDisplayName, lines, longDate, money, s } from "./shared";

/** A4 tax invoice for a counter sale (same letterhead as offers and invoices). */
export function PosInvoicePdf({ slug, sale, company }: { slug: CompanySlug; sale: SaleRow; company: CompanyProfile }) {
  const brand = BRAND[slug];
  const companyName = companyDisplayName(company);
  const lbpTotal = Math.ceil((sale.totalTTC * sale.rate) / 1000) * 1000;
  const paid = [
    sale.paidUsd - sale.changeUsd > 0 && `cash ${money.format(sale.paidUsd - sale.changeUsd)} USD`,
    sale.paidLbp - sale.changeLbp > 0 && `cash ${formatLbp(sale.paidLbp - sale.changeLbp)}`,
    sale.paidCard > 0 && `card ${money.format(sale.paidCard)} USD`,
  ].filter(Boolean);

  return (
    <Document title={`${sale.number} · Tax invoice`} author={companyName} creator="Marine OS" producer="Marine OS">
      <Page size="A4" style={s.page} wrap>
        <PageChrome brand={brand} company={company} docLabel="Tax invoice" number={sale.number} marking={null} />
        <Letterhead brand={brand} company={company} />
        <TitleBlock
          brand={brand}
          title="TAX INVOICE"
          subtitle="COUNTER SALE · PAID"
          meta={[
            ["Invoice No.", sale.number],
            ["Date", longDate.format(sale.saleDate)],
            ["Cashier", sale.cashierName],
          ]}
        />
        <View style={s.parties}>
          <View style={[s.party, { backgroundColor: brand.tint }]}>
            <Text style={[s.partyLabel, { color: brand.accent }]}>BILL TO</Text>
            <Text style={s.partyName}>{sale.customerName}</Text>
            {lines(sale.customerAddress).map((l) => (
              <Text key={l} style={s.partyLine}>{l}</Text>
            ))}
            {sale.customerTaxNumber && <Text style={s.partyLine}>VAT No. {sale.customerTaxNumber}</Text>}
          </View>
          <View style={[s.party, { backgroundColor: "#f5f6f8" }]}>
            <Text style={[s.partyLabel, { color: MUTED }]}>FROM</Text>
            <Text style={s.partyName}>{companyName}</Text>
            {company.taxNumber && <Text style={s.partyLine}>VAT No. {company.taxNumber}</Text>}
            {company.phone && <Text style={s.partyLine}>Tel. {company.phone}</Text>}
          </View>
        </View>

        <View>
          <View style={[s.th, { backgroundColor: brand.navy }]} fixed>
            <Text style={s.cNo}>No.</Text>
            <Text style={s.cDesc}>Description</Text>
            <Text style={s.cQty}>Qty</Text>
            <Text style={s.cPrice}>Unit price</Text>
            <Text style={s.cAmt}>Amount (USD)</Text>
          </View>
          {sale.lines.map((l, i) => (
            <View key={l.id} style={s.tr} wrap={false}>
              <Text style={[s.cNo, { color: MUTED }]}>{i + 1}</Text>
              <View style={s.cDesc}>
                <Text style={s.itemTitle}>{l.name}</Text>
                <Text style={s.itemRef}>REF. {l.code}</Text>
              </View>
              <Text style={s.cQty}>{l.quantity}</Text>
              <Text style={s.cPrice}>{money.format(l.unitPriceHT)}</Text>
              <Text style={[s.cAmt, { fontFamily: "Helvetica-Bold" }]}>{money.format(l.lineTotalHT)}</Text>
            </View>
          ))}
        </View>

        <View wrap={false}>
          <View style={s.totalsWrap}>
            <View style={s.totals}>
              <View style={s.totalRow}>
                <Text>Subtotal excl. VAT</Text>
                <Text>{money.format(sale.subtotalHT)}</Text>
              </View>
              {sale.discountHT > 0 && (
                <View style={s.totalRow}>
                  <Text style={{ color: MUTED }}>Discount {sale.discountPct}%</Text>
                  <Text>− {money.format(sale.discountHT)}</Text>
                </View>
              )}
              <View style={s.totalRow}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Total excl. VAT</Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{money.format(sale.totalHT)}</Text>
              </View>
              <View style={[s.totalRow, { borderBottomWidth: 0.6, borderBottomColor: RULE, paddingBottom: 5 }]}>
                <Text style={{ color: MUTED }}>VAT {VAT_RATE * 100}%</Text>
                <Text>{money.format(sale.vatAmount)}</Text>
              </View>
              <View style={[s.grandRow, { backgroundColor: brand.navy }]}>
                <Text>TOTAL PAID (USD)</Text>
                <Text>{money.format(sale.totalTTC)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={{ color: MUTED }}>Equivalent</Text>
                <Text style={{ color: MUTED }}>{formatLbp(lbpTotal)}</Text>
              </View>
            </View>
          </View>
          <Text style={s.words}>Amount in words: {amountInWords(sale.totalTTC)}.</Text>
        </View>

        <View style={{ marginTop: 18, padding: 10, borderRadius: 3, backgroundColor: brand.tint }} wrap={false}>
          <Text style={{ fontSize: 8.6, color: INK }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Paid in full at the counter</Text>
            {paid.length ? ` (${paid.join(", ")})` : ""}. Exchange rate {formatRate(sale.rate)}.
          </Text>
        </View>

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
