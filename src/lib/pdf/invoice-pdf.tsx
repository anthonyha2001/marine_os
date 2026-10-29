import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CompanyProfile, InvoiceDetail } from "@/lib/data/sales";
import { amountInWords } from "@/lib/offers";
import { VAT_RATE } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";
import {
  BRAND,
  BankDetails,
  T,
  INK,
  Letterhead,
  MUTED,
  PageChrome,
  RULE,
  TitleBlock,
  companyDisplayName,
  lines,
  longDate,
  money,
  s,
} from "./shared";

export function InvoicePdf({ slug, invoice, company, bilingual = false }: { slug: CompanySlug; invoice: InvoiceDetail; company: CompanyProfile; bilingual?: boolean }) {
  const brand = BRAND[slug];
  const companyName = companyDisplayName(company);
  const title = invoice.applyVat ? "TAX INVOICE" : "INVOICE";
  const cancelled = invoice.status === "CANCELLED";

  return (
    <Document
      title={`${invoice.number}${invoice.subject ? ` · ${invoice.subject}` : ""}`}
      author={companyName}
      subject={`Invoice for ${invoice.customerName}`}
      creator="Marine OS"
      producer="Marine OS"
    >
      <Page size="A4" style={s.page} wrap>
        <PageChrome brand={brand} company={company} docLabel="Invoice" number={invoice.number} marking={invoice.marking} />
        {cancelled && (
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
          bilingual={bilingual}
          brand={brand}
          title={title}
          subtitle={invoice.offer ? `ISSUED AGAINST OFFER ${invoice.offer.number}` : "FOR SERVICES AND SUPPLIES"}
          meta={[
            ["Invoice No.", invoice.number],
            ["Invoice date", longDate.format(invoice.invoiceDate)],
            ["Due date", longDate.format(invoice.dueDate)],
            ...(invoice.reference ? ([["Your ref.", invoice.reference]] as [string, string][]) : []),
          ]}
        />

        <View style={s.parties}>
          <View style={[s.party, { backgroundColor: brand.tint }]}>
            <T bi={bilingual} en="BILL TO" style={[s.partyLabel, { color: brand.accent }]} />
            <Text style={s.partyName}>{invoice.customerName}</Text>
            {invoice.customerAttention && <Text style={s.partyLine}>Attn: {invoice.customerAttention}</Text>}
            {lines(invoice.customerAddress).map((l) => (
              <Text key={l} style={s.partyLine}>{l}</Text>
            ))}
            {invoice.customerPhone && <Text style={s.partyLine}>Tel. {invoice.customerPhone}</Text>}
            {invoice.customerEmail && <Text style={s.partyLine}>{invoice.customerEmail}</Text>}
            {invoice.customerTaxNumber && <Text style={s.partyLine}>VAT No. {invoice.customerTaxNumber}</Text>}
          </View>
          <View style={[s.party, { backgroundColor: "#f5f6f8" }]}>
            <T bi={bilingual} en="FROM" style={[s.partyLabel, { color: MUTED }]} />
            <Text style={s.partyName}>{companyName}</Text>
            {company.taxNumber && <Text style={s.partyLine}>VAT No. {company.taxNumber}</Text>}
            {company.email && <Text style={s.partyLine}>{company.email}</Text>}
            {company.phone && <Text style={s.partyLine}>Tel. {company.phone}</Text>}
          </View>
        </View>

        {invoice.subject && (
          <Text style={s.subject}>
            <Text style={s.subjectLabel}>Subject: </Text>
            {invoice.subject}
          </Text>
        )}

        <View>
          <View style={[s.th, { backgroundColor: brand.navy }]} fixed>
            <T bi={bilingual} en="No." style={s.cNo} />
            <T bi={bilingual} en="Description" style={s.cDesc} />
            <T bi={bilingual} en="Qty" style={s.cQty} />
            <T bi={bilingual} en="Unit price" style={s.cPrice} />
            <T bi={bilingual} en="Amount (USD)" style={s.cAmt} />
          </View>
          {invoice.lines.map((line, i) => (
            <View key={line.id} style={s.tr} wrap={false}>
              <Text style={[s.cNo, { color: MUTED }]}>{i + 1}</Text>
              <View style={s.cDesc}>
                <Text style={s.itemTitle}>{line.title}</Text>
                {line.description && <Text style={s.itemDesc}>{line.description}</Text>}
              </View>
              <Text style={s.cQty}>{line.quantity}</Text>
              <Text style={s.cPrice}>{money.format(line.unitPrice)}</Text>
              <Text style={[s.cAmt, { fontFamily: "Helvetica-Bold" }]}>{money.format(line.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View wrap={false}>
          <View style={s.totalsWrap}>
            <View style={s.totals}>
              <View style={s.totalRow}>
                <T bi={bilingual} en="Total excl. VAT" style={{ fontFamily: "Helvetica-Bold" }} />
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{money.format(invoice.totalHT)}</Text>
              </View>
              <View style={[s.totalRow, { borderBottomWidth: 0.6, borderBottomColor: RULE, paddingBottom: 5 }]}>
                <T bi={bilingual} en={invoice.applyVat ? `VAT ${VAT_RATE * 100}%` : "VAT"} ar="الضريبة على القيمة المضافة" style={{ color: MUTED }} />
                <Text>{invoice.applyVat ? money.format(invoice.vatAmount) : "Exempt"}</Text>
              </View>
              <View style={[s.grandRow, { backgroundColor: brand.navy }]}>
                <T bi={bilingual} en={invoice.status === "PAID" ? "TOTAL PAID (USD)" : "TOTAL DUE (USD)"} />
                <Text>{money.format(invoice.totalTTC)}</Text>
              </View>
            </View>
          </View>
          <Text style={s.words}>Amount in words: {amountInWords(invoice.totalTTC)}.</Text>
        </View>

        <View style={{ marginTop: 18, padding: 10, borderRadius: 3, backgroundColor: brand.tint }} wrap={false}>
          <Text style={{ fontSize: 8.6, color: INK }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Payment due by {longDate.format(invoice.dueDate)}. </Text>
            Please quote invoice number {invoice.number} with your payment.
          </Text>
          {invoice.status === "PAID" && invoice.paidAt && (
            <Text style={{ fontSize: 8.6, color: "#2e7d32", fontFamily: "Helvetica-Bold", marginTop: 3 }}>
              Paid in full on {longDate.format(invoice.paidAt)}. Thank you.
            </Text>
          )}
        </View>

        {invoice.notes && <Text style={[s.paragraph, { marginTop: 12 }]}>{invoice.notes}</Text>}

        <BankDetails brand={brand} company={company} bilingual={bilingual} />

        <View style={[s.signatures, { justifyContent: "flex-end" }]} wrap={false}>
          <View style={{ width: 240 }}>
            <Text style={[s.signLabel, { color: brand.navy }]}>For {companyName}</Text>
            <T bi={bilingual} en="Authorised signature and stamp" style={s.signLine} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
