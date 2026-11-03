import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CompanyProfile } from "@/lib/data/sales";
import type { LetterField } from "@/lib/data/letters";
import type { CompanySlug } from "@/lib/permissions";
import { BRAND, T, Letterhead, MUTED, PageChrome, RULE, TitleBlock, companyDisplayName, lines, longDate, s } from "./shared";

/** What the letter PDF prints (a saved letter, or the editor's preview). */
export type LetterPrint = {
  number: string;
  customerName: string;
  customerAttention: string | null;
  customerAddress: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  letterDate: Date;
  title: string;
  reference: string | null;
  subject: string | null;
  salutation: string | null;
  body: string;
  closing: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  fields: LetterField[];
  enclosures: string | null;
  cc: string | null;
  marking: string | null;
  acknowledgment: boolean;
  offerNumber: string | null;
  createdByName: string;
};

/** Paragraphs are separated by a blank line; single line breaks stay inside a paragraph. */
const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

export function LetterPdf({ slug, letter, company, bilingual = false }: { slug: CompanySlug; letter: LetterPrint; company: CompanyProfile; bilingual?: boolean }) {
  const brand = BRAND[slug];
  const companyName = companyDisplayName(company);

  return (
    <Document
      title={`${letter.number}${letter.subject ? ` · ${letter.subject}` : ""}`}
      author={companyName}
      subject={`Letter to ${letter.customerName}`}
      creator="Marine OS"
      producer="Marine OS"
    >
      <Page size="A4" style={s.page} wrap>
        <PageChrome brand={brand} company={company} docLabel="Letter" number={letter.number} marking={letter.marking} />
        <Letterhead brand={brand} company={company} />

        <TitleBlock
          bilingual={bilingual}
          brand={brand}
          title={letter.title.toUpperCase()}
          subtitle={companyName.toUpperCase()}
          meta={[
            ["Our ref.", letter.number],
            ["Date", longDate.format(letter.letterDate)],
            ...(letter.reference ? ([["Your ref.", letter.reference]] as [string, string][]) : []),
            ...(letter.offerNumber ? ([["Offer No.", letter.offerNumber]] as [string, string][]) : []),
          ]}
        />

        {/* Parties */}
        <View style={s.parties}>
          <View style={[s.party, { backgroundColor: brand.tint }]}>
            <Text style={[s.partyLabel, { color: brand.accent }]}>TO</Text>
            <Text style={s.partyName}>{letter.customerName}</Text>
            {letter.customerAttention && <Text style={s.partyLine}>Attn: {letter.customerAttention}</Text>}
            {lines(letter.customerAddress).map((l) => (
              <Text key={l} style={s.partyLine}>{l}</Text>
            ))}
            {letter.customerPhone && <Text style={s.partyLine}>Tel. {letter.customerPhone}</Text>}
            {letter.customerEmail && <Text style={s.partyLine}>{letter.customerEmail}</Text>}
          </View>
          <View style={[s.party, { backgroundColor: "#f5f6f8" }]}>
            <Text style={[s.partyLabel, { color: MUTED }]}>FROM</Text>
            <Text style={s.partyName}>{companyName}</Text>
            <Text style={s.partyLine}>{letter.signatoryName || letter.createdByName}</Text>
            {letter.signatoryTitle && <Text style={s.partyLine}>{letter.signatoryTitle}</Text>}
            {company.email && <Text style={s.partyLine}>{company.email}</Text>}
            {company.phone && <Text style={s.partyLine}>Tel. {company.phone}</Text>}
          </View>
        </View>

        {letter.subject && (
          <Text style={[s.subject, { marginBottom: 14 }]}>
            <Text style={s.subjectLabel}>Subject: </Text>
            {letter.subject}
          </Text>
        )}

        {letter.salutation && <Text style={s.paragraph}>{letter.salutation}</Text>}
        {paragraphs(letter.body).map((p, i) => (
          <Text key={i} style={[s.paragraph, { textAlign: "justify" }]}>{p}</Text>
        ))}

        {/* Details the user added (vessel, port, dates…) */}
        {letter.fields.length > 0 && (
          <View style={{ marginBottom: 14, borderTopWidth: 0.6, borderTopColor: RULE }} wrap={false}>
            {letter.fields.map((f, i) => (
              <View key={i} style={{ flexDirection: "row", paddingVertical: 4.5, paddingHorizontal: 6, borderBottomWidth: 0.6, borderBottomColor: RULE, fontSize: 8.8 }}>
                <Text style={{ width: 150, color: MUTED }}>{f.label}</Text>
                <Text style={{ flex: 1, fontFamily: "Helvetica-Bold" }}>{f.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Closing and signatures */}
        <View style={[s.signatures, { marginTop: 10 }]} wrap={false}>
          <View style={s.signBox}>
            {letter.closing && <Text style={{ fontSize: 9, marginBottom: 6 }}>{letter.closing}</Text>}
            <Text style={[s.signLabel, { color: brand.navy }]}>For {companyName}</Text>
            <Text style={s.signLine}>
              {letter.signatoryName ? `${letter.signatoryName}${letter.signatoryTitle ? ` · ${letter.signatoryTitle}` : ""}` : "Authorised signature"}
            </Text>
            <View style={s.stamp}>
              <T bi={bilingual} en="COMPANY STAMP" />
            </View>
          </View>
          {letter.acknowledgment ? (
            <View style={s.signBox}>
              <Text style={{ fontSize: 9, marginBottom: 6 }}> </Text>
              <Text style={[s.signLabel, { color: brand.navy }]}>Received by the customer</Text>
              <T bi={bilingual} en="Signature and date" style={s.signLine} />
              <T bi={bilingual} en="Name and title" style={s.signLine} />
            </View>
          ) : (
            <View style={s.signBox} />
          )}
        </View>

        {(letter.enclosures || letter.cc) && (
          <View style={{ marginTop: 18, fontSize: 8.4 }} wrap={false}>
            {letter.enclosures && (
              <View style={s.term}>
                <Text style={{ width: 70, color: MUTED }}>Enclosures</Text>
                <Text style={{ flex: 1 }}>{letter.enclosures}</Text>
              </View>
            )}
            {letter.cc && (
              <View style={s.term}>
                <Text style={{ width: 70, color: MUTED }}>Copy to</Text>
                <Text style={{ flex: 1 }}>{letter.cc}</Text>
              </View>
            )}
          </View>
        )}
      </Page>
    </Document>
  );
}
