import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CreditNoteRow, VoucherRow } from "@/lib/data/ledger";
import type { CompanyProfile } from "@/lib/data/sales";
import type { LedgerMove } from "@/lib/ledger/reports";
import { amountInWords } from "@/lib/offers";
import { VAT_RATE } from "@/lib/money";
import { formatLbp, formatRate } from "@/lib/pos";
import type { CompanySlug } from "@/lib/permissions";
import { BRAND, INK, Letterhead, MUTED, PageChrome, RULE, TitleBlock, companyDisplayName, lines, longDate, money, s, type Brand } from "./shared";

// Payment / receipt vouchers, credit notes and statements of account, on the same letterhead
// as offers and invoices.

const METHOD: Record<string, string> = { BANK_TRANSFER: "Bank transfer", CASH: "Cash", CHEQUE: "Cheque", CARD: "Card", OTHER: "Other" };

function Signatures({ brand, labels }: { brand: Brand; labels: string[] }) {
  return (
    <View style={s.signatures} wrap={false}>
      {labels.map((l) => (
        <View key={l} style={s.signBox}>
          <Text style={[s.signLabel, { color: brand.navy }]}>{l}</Text>
          <Text style={s.signLine}>Name, signature and date</Text>
        </View>
      ))}
    </View>
  );
}

function Watermark({ text }: { text: string }) {
  return (
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
      {text}
    </Text>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={[s.tr, { paddingVertical: 7 }]}>
      <Text style={{ width: 140, color: MUTED, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Text>
      <Text style={{ flex: 1, fontFamily: bold ? "Helvetica-Bold" : "Helvetica", fontSize: 9.5 }}>{value}</Text>
    </View>
  );
}

export function VoucherPdf({ slug, voucher, company }: { slug: CompanySlug; voucher: VoucherRow; company: CompanyProfile }) {
  const brand = BRAND[slug];
  const title = { PAYMENT: "PAYMENT VOUCHER", RECEIPT: "RECEIPT VOUCHER", TRANSFER: "TRANSFER VOUCHER" }[voucher.kind];
  const partyLabel = { PAYMENT: "Paid to", RECEIPT: "Received from", TRANSFER: "Transfer" }[voucher.kind];
  const moneyLabel = { PAYMENT: "Paid from", RECEIPT: "Received into", TRANSFER: "From" }[voucher.kind];
  const counterLabel = { PAYMENT: "Charged to account", RECEIPT: "Credited to account", TRANSFER: "To" }[voucher.kind];

  return (
    <Document title={`${voucher.number} · ${voucher.description}`} author={companyDisplayName(company)} creator="Marine OS" producer="Marine OS">
      <Page size="A4" style={s.page}>
        <PageChrome brand={brand} company={company} docLabel={title} number={voucher.number} marking={null} />
        <Letterhead brand={brand} company={company} />
        <TitleBlock
          brand={brand}
          title={title}
          subtitle={voucher.kind === "TRANSFER" ? "MOVEMENT BETWEEN CASH AND BANK ACCOUNTS" : "CASH AND BANK MOVEMENT"}
          meta={[
            ["Voucher No.", voucher.number],
            ["Date", longDate.format(voucher.date)],
            ["Method", METHOD[voucher.method] ?? voucher.method],
            ...(voucher.reference ? ([["Reference", voucher.reference]] as [string, string][]) : []),
          ]}
        />

        <View style={{ marginBottom: 14 }}>
          {voucher.kind !== "TRANSFER" && <Row label={partyLabel} value={voucher.partyName ?? "—"} bold />}
          <Row label="Description" value={voucher.description} />
          <Row label={moneyLabel} value={voucher.moneyAccount} />
          <Row label={counterLabel} value={voucher.counterAccount} />
        </View>

        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totals}>
            {voucher.vatAmount > 0 && (
              <>
                <View style={s.totalRow}>
                  <Text>Amount excl. VAT</Text>
                  <Text>{money.format(voucher.amountHT)}</Text>
                </View>
                <View style={[s.totalRow, { borderBottomWidth: 0.6, borderBottomColor: RULE, paddingBottom: 5 }]}>
                  <Text style={{ color: MUTED }}>Recoverable VAT {VAT_RATE * 100}%</Text>
                  <Text>{money.format(voucher.vatAmount)}</Text>
                </View>
              </>
            )}
            <View style={[s.grandRow, { backgroundColor: brand.navy }]}>
              <Text>AMOUNT (USD)</Text>
              <Text>{money.format(voucher.amount)}</Text>
            </View>
          </View>
        </View>
        <Text style={s.words}>Amount in words: {amountInWords(voucher.amount)}.</Text>

        <Signatures
          brand={brand}
          labels={voucher.kind === "PAYMENT" ? ["Prepared by", "Approved by", "Received by"] : voucher.kind === "RECEIPT" ? ["Received by", "Approved by"] : ["Prepared by", "Approved by"]}
        />
        <Text style={{ marginTop: 6, fontSize: 7.5, color: MUTED }}>Recorded in Marine OS by {voucher.createdByName}.</Text>
      </Page>
    </Document>
  );
}

export function CreditNotePdf({ slug, note, company }: { slug: CompanySlug; note: CreditNoteRow; company: CompanyProfile }) {
  const brand = BRAND[slug];
  const companyName = companyDisplayName(company);
  return (
    <Document title={`${note.number} · Credit note`} author={companyName} creator="Marine OS" producer="Marine OS">
      <Page size="A4" style={s.page} wrap>
        <PageChrome brand={brand} company={company} docLabel="Credit note" number={note.number} marking={null} />
        {note.status === "CANCELLED" && <Watermark text="CANCELLED" />}
        <Letterhead brand={brand} company={company} />
        <TitleBlock
          brand={brand}
          title={note.applyVat ? "TAX CREDIT NOTE" : "CREDIT NOTE"}
          subtitle={note.invoice ? `AGAINST INVOICE ${note.invoice.number}` : "CREDIT TO CUSTOMER ACCOUNT"}
          meta={[
            ["Credit note No.", note.number],
            ["Date", longDate.format(note.date)],
            ...(note.invoice ? ([["Invoice No.", note.invoice.number]] as [string, string][]) : []),
          ]}
        />
        <View style={s.parties}>
          <View style={[s.party, { backgroundColor: brand.tint }]}>
            <Text style={[s.partyLabel, { color: brand.accent }]}>CREDIT TO</Text>
            <Text style={s.partyName}>{note.customerName}</Text>
            {lines(note.customerAddress).map((l) => (
              <Text key={l} style={s.partyLine}>{l}</Text>
            ))}
            {note.customerTaxNumber && <Text style={s.partyLine}>VAT No. {note.customerTaxNumber}</Text>}
          </View>
          <View style={[s.party, { backgroundColor: "#f5f6f8" }]}>
            <Text style={[s.partyLabel, { color: MUTED }]}>FROM</Text>
            <Text style={s.partyName}>{companyName}</Text>
            {company.taxNumber && <Text style={s.partyLine}>VAT No. {company.taxNumber}</Text>}
          </View>
        </View>
        <Text style={s.subject}>
          <Text style={s.subjectLabel}>Reason: </Text>
          {note.reason}
        </Text>
        <View>
          <View style={[s.th, { backgroundColor: brand.navy }]} fixed>
            <Text style={s.cNo}>No.</Text>
            <Text style={s.cDesc}>Description</Text>
            <Text style={s.cQty}>Qty</Text>
            <Text style={s.cPrice}>Unit price</Text>
            <Text style={s.cAmt}>Amount (USD)</Text>
          </View>
          {note.lines.map((l, i) => (
            <View key={l.id} style={s.tr} wrap={false}>
              <Text style={[s.cNo, { color: MUTED }]}>{i + 1}</Text>
              <Text style={[s.cDesc, s.itemTitle]}>{l.title}</Text>
              <Text style={s.cQty}>{l.quantity}</Text>
              <Text style={s.cPrice}>{money.format(l.unitPrice)}</Text>
              <Text style={[s.cAmt, { fontFamily: "Helvetica-Bold" }]}>{money.format(l.lineTotal)}</Text>
            </View>
          ))}
        </View>
        <View wrap={false}>
          <View style={s.totalsWrap}>
            <View style={s.totals}>
              <View style={s.totalRow}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Total excl. VAT</Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{money.format(note.totalHT)}</Text>
              </View>
              <View style={[s.totalRow, note.applyVat && note.lbpRate ? {} : { borderBottomWidth: 0.6, borderBottomColor: RULE, paddingBottom: 5 }]}>
                <Text style={{ color: MUTED }}>{note.applyVat ? `VAT ${VAT_RATE * 100}%` : "VAT"}</Text>
                <Text>{note.applyVat ? money.format(note.vatAmount) : "Exempt"}</Text>
              </View>
              {note.applyVat && note.lbpRate ? (
                <View style={[s.totalRow, { borderBottomWidth: 0.6, borderBottomColor: RULE, paddingBottom: 5 }]}>
                  <View>
                    <Text style={{ color: MUTED }}>VAT in LBP</Text>
                    <Text style={{ fontSize: 6.8, color: MUTED }}>at {formatRate(note.lbpRate)}</Text>
                  </View>
                  <Text>{formatLbp(Math.round(note.vatAmount * note.lbpRate))}</Text>
                </View>
              ) : null}
              <View style={[s.grandRow, { backgroundColor: brand.navy }]}>
                <Text>TOTAL CREDITED (USD)</Text>
                <Text>{money.format(note.totalTTC)}</Text>
              </View>
            </View>
          </View>
          <Text style={s.words}>Amount in words: {amountInWords(note.totalTTC)}.</Text>
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

export type StatementData = {
  partyLabel: "Customer" | "Supplier";
  partyName: string;
  from?: Date;
  to: Date;
  opening: number;
  moves: LedgerMove[];
  debit: number;
  credit: number;
  closing: number;
};

export function StatementPdf({ slug, data, company }: { slug: CompanySlug; data: StatementData; company: CompanyProfile }) {
  const brand = BRAND[slug];
  const ref = `SOA-${data.to.toISOString().slice(0, 10)}`;
  const customer = data.partyLabel === "Customer";
  const cDate = { width: 62 };
  const cDoc = { width: 78 };
  const cNum = { width: 66, textAlign: "right" as const };
  const cBal = { width: 72, textAlign: "right" as const };
  return (
    <Document title={`Statement of account · ${data.partyName}`} author={companyDisplayName(company)} creator="Marine OS" producer="Marine OS">
      <Page size="A4" style={s.page} wrap>
        <PageChrome brand={brand} company={company} docLabel="Statement of account" number={data.partyName} marking={null} />
        <Letterhead brand={brand} company={company} />
        <TitleBlock
          brand={brand}
          title="STATEMENT OF ACCOUNT"
          subtitle={customer ? "AMOUNTS DUE TO US" : "AMOUNTS DUE TO SUPPLIER"}
          meta={[
            ["Reference", ref],
            ["Period from", data.from ? longDate.format(data.from) : "Beginning"],
            ["Period to", longDate.format(data.to)],
            ["Currency", "USD"],
          ]}
        />
        <View style={[s.party, { backgroundColor: brand.tint, marginBottom: 14 }]}>
          <Text style={[s.partyLabel, { color: brand.accent }]}>{data.partyLabel.toUpperCase()}</Text>
          <Text style={s.partyName}>{data.partyName}</Text>
        </View>
        <View>
          <View style={[s.th, { backgroundColor: brand.navy }]} fixed>
            <Text style={cDate}>Date</Text>
            <Text style={cDoc}>Entry</Text>
            <Text style={{ flex: 1 }}>Description</Text>
            <Text style={cNum}>{customer ? "Debit" : "Paid"}</Text>
            <Text style={cNum}>{customer ? "Credit" : "Billed"}</Text>
            <Text style={cBal}>Balance</Text>
          </View>
          <View style={[s.tr, { backgroundColor: "#f5f6f8" }]}>
            <Text style={cDate} />
            <Text style={cDoc} />
            <Text style={{ flex: 1, fontFamily: "Helvetica-Bold" }}>Opening balance</Text>
            <Text style={cNum} />
            <Text style={cNum} />
            <Text style={[cBal, { fontFamily: "Helvetica-Bold" }]}>{money.format(data.opening)}</Text>
          </View>
          {data.moves.map((m, i) => (
            <View key={`${m.entryId}-${i}`} style={s.tr} wrap={false}>
              <Text style={cDate}>{m.date.toISOString().slice(0, 10)}</Text>
              <Text style={[cDoc, { fontSize: 7.6 }]}>{m.number}</Text>
              <Text style={{ flex: 1, paddingRight: 6 }}>{m.description ?? m.memo}</Text>
              <Text style={cNum}>{m.debit ? money.format(m.debit) : ""}</Text>
              <Text style={cNum}>{m.credit ? money.format(m.credit) : ""}</Text>
              <Text style={[cBal, { fontFamily: "Helvetica-Bold" }]}>{money.format(m.balance)}</Text>
            </View>
          ))}
        </View>
        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totals}>
            <View style={s.totalRow}>
              <Text style={{ color: MUTED }}>Total debits</Text>
              <Text>{money.format(data.debit)}</Text>
            </View>
            <View style={[s.totalRow, { borderBottomWidth: 0.6, borderBottomColor: RULE, paddingBottom: 5 }]}>
              <Text style={{ color: MUTED }}>Total credits</Text>
              <Text>{money.format(data.credit)}</Text>
            </View>
            <View style={[s.grandRow, { backgroundColor: brand.navy }]}>
              <Text>{customer ? "BALANCE DUE (USD)" : "BALANCE OWED (USD)"}</Text>
              <Text>{money.format(data.closing)}</Text>
            </View>
          </View>
        </View>
        <Text style={{ marginTop: 18, fontSize: 8.2, color: INK }}>
          Please check this statement and report any difference within 15 days. Without a reply, the balance is considered agreed.
        </Text>
      </Page>
    </Document>
  );
}
