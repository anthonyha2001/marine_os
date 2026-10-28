import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CompanyProfile } from "@/lib/data/sales";
import type { PurchaseOrderDetail } from "@/lib/data/purchase-orders";
import { amountInWords } from "@/lib/offers";
import { VAT_RATE } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";
import {
  BRAND,
  Letterhead,
  MUTED,
  PageChrome,
  RULE,
  SectionHeading,
  TitleBlock,
  companyDisplayName,
  lines,
  longDate,
  money,
  s,
} from "./shared";

export function PurchaseOrderPdf({ slug, order, company }: { slug: CompanySlug; order: PurchaseOrderDetail; company: CompanyProfile }) {
  const brand = BRAND[slug];
  const companyName = companyDisplayName(company);
  const terms = lines(order.terms);

  return (
    <Document title={order.number} author={companyName} subject={`Purchase order to ${order.supplier.name}`} creator="Marine OS" producer="Marine OS">
      <Page size="A4" style={s.page} wrap>
        <PageChrome brand={brand} company={company} docLabel="Purchase order" number={order.number} marking={null} />
        {order.status === "CANCELLED" && (
          <Text
            fixed
            style={{
              position: "absolute",
              top: 380,
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: "Helvetica-Bold",
              fontSize: 64,
              letterSpacing: 8,
              color: "#c62828",
              opacity: 0.14,
              transform: "rotate(-28deg)",
            }}
          >
            CANCELLED
          </Text>
        )}
        <Letterhead brand={brand} company={company} />

        <TitleBlock
          brand={brand}
          title="PURCHASE ORDER"
          subtitle="QUOTE THIS NUMBER ON ALL DOCUMENTS"
          meta={[
            ["PO No.", order.number],
            ["Order date", longDate.format(order.orderDate)],
            ...(order.expectedDate ? ([["Delivery by", longDate.format(order.expectedDate)]] as [string, string][]) : []),
            ...(order.reference ? ([["Reference", order.reference]] as [string, string][]) : []),
          ]}
        />

        <View style={s.parties}>
          <View style={[s.party, { backgroundColor: brand.tint }]}>
            <Text style={[s.partyLabel, { color: brand.accent }]}>SUPPLIER</Text>
            <Text style={s.partyName}>{order.supplier.name}</Text>
            {order.supplier.accountNumber && <Text style={s.partyLine}>Account: {order.supplier.accountNumber}</Text>}
            {lines(order.supplier.address).map((l) => (
              <Text key={l} style={s.partyLine}>{l}</Text>
            ))}
            {order.supplier.phone && <Text style={s.partyLine}>Tel. {order.supplier.phone}</Text>}
            {order.supplier.email && <Text style={s.partyLine}>{order.supplier.email}</Text>}
          </View>
          <View style={[s.party, { backgroundColor: "#f5f6f8" }]}>
            <Text style={[s.partyLabel, { color: MUTED }]}>DELIVER TO / INVOICE TO</Text>
            <Text style={s.partyName}>{companyName}</Text>
            {lines(company.address).map((l) => (
              <Text key={l} style={s.partyLine}>{l}</Text>
            ))}
            {company.taxNumber && <Text style={s.partyLine}>VAT No. {company.taxNumber}</Text>}
            <Text style={s.partyLine}>Ordered by: {order.createdByName}</Text>
          </View>
        </View>

        <View>
          <View style={[s.th, { backgroundColor: brand.navy }]} fixed>
            <Text style={s.cNo}>No.</Text>
            <Text style={{ width: 46 }}>Code</Text>
            <Text style={s.cDesc}>Description</Text>
            <Text style={s.cQty}>Qty</Text>
            <Text style={s.cPrice}>Unit price</Text>
            <Text style={s.cAmt}>Amount (USD)</Text>
          </View>
          {order.lines.map((line, i) => (
            <View key={line.id} style={s.tr} wrap={false}>
              <Text style={[s.cNo, { color: MUTED }]}>{i + 1}</Text>
              <Text style={{ width: 46, color: MUTED }}>{line.code}</Text>
              <Text style={[s.cDesc, s.itemTitle]}>{line.name}</Text>
              <Text style={s.cQty}>{line.quantity}</Text>
              <Text style={s.cPrice}>{money.format(line.unitPriceHT)}</Text>
              <Text style={[s.cAmt, { fontFamily: "Helvetica-Bold" }]}>{money.format(line.lineTotalHT)}</Text>
            </View>
          ))}
        </View>

        <View wrap={false}>
          <View style={s.totalsWrap}>
            <View style={s.totals}>
              <View style={s.totalRow}>
                <Text style={{ color: MUTED }}>Subtotal</Text>
                <Text>{money.format(order.subtotalHT)}</Text>
              </View>
              {order.discount > 0 && (
                <View style={s.totalRow}>
                  <Text style={{ color: MUTED }}>Discount</Text>
                  <Text>– {money.format(order.discount)}</Text>
                </View>
              )}
              <View style={[s.totalRow, { borderTopWidth: 0.6, borderTopColor: RULE, marginTop: 2, paddingTop: 5 }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Total excl. VAT</Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{money.format(order.totalHT)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={{ color: MUTED }}>VAT {VAT_RATE * 100}%</Text>
                <Text>{money.format(order.vatAmount)}</Text>
              </View>
              <View style={[s.grandRow, { backgroundColor: brand.navy }]}>
                <Text>ORDER TOTAL (USD)</Text>
                <Text>{money.format(order.totalTTC)}</Text>
              </View>
            </View>
          </View>
          <Text style={s.words}>Amount in words: {amountInWords(order.totalTTC)}.</Text>
        </View>

        {terms.length > 0 && (
          <View>
            <SectionHeading brand={brand}>Terms</SectionHeading>
            {terms.map((t, i) => (
              <View key={i} style={s.term} wrap={false}>
                <Text style={s.termNo}>{i + 1}.</Text>
                <Text style={{ flex: 1 }}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.signatures} wrap={false}>
          <View style={s.signBox}>
            <Text style={[s.signLabel, { color: brand.navy }]}>Authorised by {companyName}</Text>
            <Text style={s.signLine}>Signature and stamp</Text>
            <Text style={s.signLine}>Name, title and date</Text>
          </View>
          <View style={s.signBox}>
            <Text style={[s.signLabel, { color: brand.navy }]}>Order acknowledged by the supplier</Text>
            <Text style={s.signLine}>Signature and stamp</Text>
            <Text style={s.signLine}>Confirmed delivery date</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
