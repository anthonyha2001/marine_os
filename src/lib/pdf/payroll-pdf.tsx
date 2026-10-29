import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { EmployeeRow, PayrollRunRow } from "@/lib/data/payroll";
import type { CompanyProfile } from "@/lib/data/sales";
import { amountInWords } from "@/lib/offers";
import { PAY_FREQUENCIES } from "@/lib/payroll";
import type { CompanySlug } from "@/lib/permissions";
import { BRAND, INK, Letterhead, MUTED, PageChrome, RULE, TitleBlock, companyDisplayName, longDate, money, s } from "./shared";

const period = (run: PayrollRunRow) => `${longDate.format(run.periodStart)} – ${longDate.format(run.periodEnd)}`;

/** One table for the whole payroll: each employee signs next to their net pay. */
export function PayrollSheetPdf({ slug, run, company }: { slug: CompanySlug; run: PayrollRunRow; company: CompanyProfile }) {
  const brand = BRAND[slug];
  const c = { no: { width: 20 }, name: { flex: 1, paddingRight: 6 }, num: { width: 62, textAlign: "right" as const }, sign: { width: 110, marginLeft: 10 } };
  return (
    <Document title={`${run.number} · Payroll ${run.label}`} author={companyDisplayName(company)} creator="Marine OS" producer="Marine OS">
      <Page size="A4" style={s.page} wrap>
        <PageChrome brand={brand} company={company} docLabel="Payroll" number={run.number} marking={null} />
        <Letterhead brand={brand} company={company} />
        <TitleBlock
          brand={brand}
          title="PAYROLL SHEET"
          subtitle={`${run.label.toUpperCase()} · ${PAY_FREQUENCIES[run.frequency].toUpperCase()}`}
          meta={[
            ["Payroll No.", run.number],
            ["Period", period(run)],
            ["Employees", String(run.lines.length)],
            ["Currency", "USD"],
          ]}
        />
        <View>
          <View style={[s.th, { backgroundColor: brand.navy }]} fixed>
            <Text style={c.no}>No.</Text>
            <Text style={c.name}>Employee</Text>
            <Text style={c.num}>Salary</Text>
            <Text style={c.num}>Withheld</Text>
            <Text style={c.num}>Net paid</Text>
            <Text style={c.sign}>Signature</Text>
          </View>
          {run.lines.map((l, i) => (
            <View key={l.id} style={[s.tr, { minHeight: 36, alignItems: "center" }]} wrap={false}>
              <Text style={[c.no, { color: MUTED }]}>{i + 1}</Text>
              <View style={c.name}>
                <Text style={s.itemTitle}>{l.name}</Text>
                {l.position && <Text style={s.itemDesc}>{l.position}</Text>}
              </View>
              <Text style={c.num}>{money.format(l.gross)}</Text>
              <Text style={[c.num, { color: l.advance + l.nssfEmployee + l.incomeTax ? INK : MUTED }]}>
                {l.advance + l.nssfEmployee + l.incomeTax ? money.format(l.advance + l.nssfEmployee + l.incomeTax) : "—"}
              </Text>
              <Text style={[c.num, { fontFamily: "Helvetica-Bold" }]}>{money.format(l.net)}</Text>
              <View style={[c.sign, { height: 24, borderBottomWidth: 0.8, borderBottomColor: INK }]} />
            </View>
          ))}
          <View style={[s.tr, { backgroundColor: brand.tint }]} wrap={false}>
            <Text style={c.no} />
            <Text style={[c.name, { fontFamily: "Helvetica-Bold" }]}>Total</Text>
            <Text style={[c.num, { fontFamily: "Helvetica-Bold" }]}>{money.format(run.totalGross)}</Text>
            <Text style={[c.num, { fontFamily: "Helvetica-Bold" }]}>{money.format(run.totalAdvance + run.totalNssfEmployee + run.totalIncomeTax)}</Text>
            <Text style={[c.num, { fontFamily: "Helvetica-Bold" }]}>{money.format(run.totalNet)}</Text>
            <View style={c.sign} />
          </View>
        </View>
        <Text style={[s.words, { textAlign: "left" }]}>Total net paid in words: {amountInWords(run.totalNet)}.</Text>
        <Text style={{ marginTop: 10, fontSize: 8, color: MUTED }}>
          By signing, each employee confirms receiving the net amount shown for {run.label}. The detail of each salary is on the individual payslip.
        </Text>
        <View style={s.signatures} wrap={false}>
          {["Prepared by", "Approved by"].map((l) => (
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

/** One page per employee: the breakdown of the pay and a "received by" signature. */
export function PayslipsPdf({ slug, run, company, employees }: { slug: CompanySlug; run: PayrollRunRow; company: CompanyProfile; employees: Map<string, EmployeeRow> }) {
  const brand = BRAND[slug];
  const companyName = companyDisplayName(company);
  return (
    <Document title={`${run.number} · Payslips ${run.label}`} author={companyName} creator="Marine OS" producer="Marine OS">
      {run.lines.map((l) => {
        const e = employees.get(l.employeeId);
        const rows: [string, number, boolean][] = [
          [`Base salary (${run.frequency === "MONTHLY" ? "month" : "week"})`, l.baseSalary, false],
          ["Bonus", l.bonus, false],
          ["Overtime", l.overtime, false],
          ["Deductions (absence, other)", -l.deductions, false],
          ["Salary for the period", l.gross, true],
          ["NSSF (employee share)", -l.nssfEmployee, false],
          ["Income tax withheld", -l.incomeTax, false],
          ["Advance paid back", -l.advance, false],
        ];
        return (
          <Page key={l.id} size="A4" style={s.page}>
            <PageChrome brand={brand} company={company} docLabel="Payslip" number={`${run.number} · ${l.name}`} marking={null} />
            <Letterhead brand={brand} company={company} />
            <TitleBlock
              brand={brand}
              title="PAYSLIP"
              subtitle={run.label.toUpperCase()}
              meta={[
                ["Payroll No.", run.number],
                ["Period", period(run)],
                ...(run.payDate ? ([["Paid on", longDate.format(run.payDate)]] as [string, string][]) : []),
              ]}
            />
            <View style={s.parties}>
              <View style={[s.party, { backgroundColor: brand.tint }]}>
                <Text style={[s.partyLabel, { color: brand.accent }]}>EMPLOYEE</Text>
                <Text style={s.partyName}>{l.name}</Text>
                {l.position && <Text style={s.partyLine}>{l.position}</Text>}
                {e?.idNumber && <Text style={s.partyLine}>ID / NSSF No. {e.idNumber}</Text>}
                {e?.startDate && <Text style={s.partyLine}>Since {longDate.format(e.startDate)}</Text>}
              </View>
              <View style={[s.party, { backgroundColor: "#f5f6f8" }]}>
                <Text style={[s.partyLabel, { color: MUTED }]}>EMPLOYER</Text>
                <Text style={s.partyName}>{companyName}</Text>
                {company.taxNumber && <Text style={s.partyLine}>VAT No. {company.taxNumber}</Text>}
                {company.registrationNumber && <Text style={s.partyLine}>C.R. {company.registrationNumber}</Text>}
              </View>
            </View>
            <View style={{ marginTop: 4 }}>
              {rows.map(([label, value, bold]) => (
                <View key={label} style={[s.tr, bold ? { backgroundColor: "#f5f6f8" } : {}]}>
                  <Text style={{ flex: 1, fontFamily: bold ? "Helvetica-Bold" : "Helvetica" }}>{label}</Text>
                  <Text style={{ width: 110, textAlign: "right", fontFamily: bold ? "Helvetica-Bold" : "Helvetica", color: value === 0 ? MUTED : INK }}>
                    {value === 0 ? "—" : `${value < 0 ? "− " : ""}${money.format(Math.abs(value))}`}
                  </Text>
                </View>
              ))}
            </View>
            <View style={s.totalsWrap}>
              <View style={s.totals}>
                <View style={[s.grandRow, { backgroundColor: brand.navy }]}>
                  <Text>NET PAID (USD)</Text>
                  <Text>{money.format(l.net)}</Text>
                </View>
              </View>
            </View>
            <Text style={s.words}>In words: {amountInWords(l.net)}.</Text>
            {l.nssfEmployer > 0 && (
              <Text style={{ marginTop: 8, fontSize: 8, color: MUTED }}>Paid by the employer on top of this salary: NSSF contributions {money.format(l.nssfEmployer)}.</Text>
            )}
            {l.note && <Text style={[s.paragraph, { marginTop: 10 }]}>Note: {l.note}</Text>}
            <View style={[s.signatures, { marginTop: 40 }]} wrap={false}>
              <View style={s.signBox}>
                <Text style={[s.signLabel, { color: brand.navy }]}>Received by the employee</Text>
                <Text style={s.signLine}>{l.name} · signature and date</Text>
              </View>
              <View style={s.signBox}>
                <Text style={[s.signLabel, { color: brand.navy }]}>For {companyName}</Text>
                <Text style={s.signLine}>Authorised signature and stamp</Text>
              </View>
            </View>
            <View style={{ marginTop: 12, borderTopWidth: 0.6, borderTopColor: RULE, paddingTop: 6 }}>
              <Text style={{ fontSize: 7.5, color: MUTED }}>Keep this payslip. It confirms the salary paid for {run.label}.</Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
