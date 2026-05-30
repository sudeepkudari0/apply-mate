/**
 * ResumeDocument.tsx
 * react-pdf/renderer component that produces a pixel-accurate replica
 * of the original Calibri-based US-Letter resume.
 *
 * Install deps:
 *   npm install @react-pdf/renderer
 */

import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { MasterResume } from "./types";

// ─── Font Registration ────────────────────────────────────────────────────────
// Inter font — separate TTF files for regular and bold.
// react-pdf requires TTF/OTF format (woff2 is NOT supported).
// The files live in public/fonts/ and Vite serves them at /fonts/...

Font.register({
  family: "Inter",
  fonts: [
    { src: "/fonts/Inter-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/Inter-Bold.ttf", fontWeight: 700 },
  ],
});

const FONT = "Inter";
const FONTB = "Inter"; // bold is handled via fontWeight: 'bold' in styles

// ─── Colour constants ─────────────────────────────────────────────────────────
const BLACK = "#000000";
const LINK_BLUE = "#0563C1";
const WHITE = "#ffffff";

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 10,
    color: BLACK,
    backgroundColor: WHITE,
    // US Letter: 612 × 792 pt  |  1-inch (72 pt) margins all sides
    paddingTop: 72,
    paddingBottom: 72,
    paddingLeft: 72,
    paddingRight: 72,
    lineHeight: 1.35,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  name: {
    fontFamily: FONTB,
    fontWeight: "bold",
    fontSize: 20,
    marginBottom: 10,
  },
  contactBlock: {
    marginBottom: 10,
  },
  contactRow: {
    fontFamily: FONTB,
    fontWeight: "bold",
    fontSize: 10,
    lineHeight: 1.7,
  },
  contactLink: {
    fontFamily: FONTB,
    fontWeight: "bold",
    fontSize: 10,
    color: LINK_BLUE,
    textDecoration: "underline",
  },

  // ── Summary ─────────────────────────────────────────────────────────────────
  summary: {
    fontFamily: FONT,
    fontSize: 10,
    lineHeight: 1.4,
    marginBottom: 8,
  },

  // ── Section header + rule ───────────────────────────────────────────────────
  sectionHeader: {
    fontFamily: FONTB,
    fontWeight: "bold",
    fontSize: 12,
    textAlign: "center",
    color: BLACK,
    marginTop: 10,
    marginBottom: 3,
  },
  sectionRule: {
    borderBottomWidth: 1,
    borderBottomColor: BLACK,
    marginBottom: 5,
  },

  // ── Experience ──────────────────────────────────────────────────────────────
  expEntry: {
    marginBottom: 6,
  },
  expTitle: {
    fontFamily: FONTB,
    fontWeight: "bold",
    fontSize: 10,
    marginBottom: 1,
  },
  metaLine: {
    fontFamily: FONT,
    fontSize: 9.5,
    marginBottom: 1,
  },
  techLine: {
    fontFamily: FONT,
    fontSize: 9.5,
    marginBottom: 3,
  },

  // ── Subsection header (Full-Time / Intern) ──────────────────────────────────
  subsectionHeader: {
    fontFamily: FONTB,
    fontWeight: "bold",
    fontSize: 10,
    marginTop: 3,
    marginBottom: 2,
    marginLeft: 18,
  },

  // ── Bullets ─────────────────────────────────────────────────────────────────
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2.5,
    marginLeft: 18, // level-1 indent
  },
  bulletRowIndented: {
    flexDirection: "row",
    marginBottom: 2.5,
    marginLeft: 36, // level-2 indent (under subsection headers)
  },
  bulletDash: {
    fontFamily: FONT,
    fontSize: 10,
    width: 12,
    flexShrink: 0,
  },
  bulletText: {
    fontFamily: FONT,
    fontSize: 10,
    flex: 1,
    lineHeight: 1.35,
  },

  // ── Projects ─────────────────────────────────────────────────────────────────
  projEntry: {
    marginBottom: 5,
  },
  projTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    marginBottom: 2,
  },
  projName: {
    fontFamily: FONTB,
    fontWeight: "bold",
    fontSize: 10,
  },
  projSep: {
    fontFamily: FONT,
    fontSize: 10,
    marginLeft: 3,
    marginRight: 3,
  },
  projLink: {
    fontFamily: FONT,
    fontSize: 10,
    color: LINK_BLUE,
    textDecoration: "underline",
  },

  // ── Skills ───────────────────────────────────────────────────────────────────
  skillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    fontSize: 10,
    lineHeight: 1.6,
    marginBottom: 0,
  },
  skillLabel: {
    fontFamily: FONTB,
    fontWeight: "bold",
    fontSize: 10,
  },
  skillValue: {
    fontFamily: FONT,
    fontSize: 10,
  },

  // ── Education ────────────────────────────────────────────────────────────────
  eduEntry: {
    marginBottom: 2,
  },
  eduDegree: {
    fontFamily: FONT,
    fontSize: 10,
  },
  eduYearRow: {
    flexDirection: "row",
    fontSize: 10,
    marginTop: 1,
  },
  eduYearBold: {
    fontFamily: FONTB,
    fontWeight: "bold",
    fontSize: 10,
  },
  eduYearRegular: {
    fontFamily: FONT,
    fontSize: 10,
  },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeader = ({ title }: { title: string }) => (
  <View>
    <Text style={s.sectionHeader}>{title}</Text>
    <View style={s.sectionRule} />
  </View>
);

const Bullet = ({
  text,
  indented = false,
}: {
  text: string;
  indented?: boolean;
}) => (
  <View style={indented ? s.bulletRowIndented : s.bulletRow}>
    <Text style={s.bulletDash}>{"\u2013"}</Text>
    <Text style={s.bulletText}>{text}</Text>
  </View>
);

// ─── Main Document ────────────────────────────────────────────────────────────

interface ResumeDocumentProps {
  resume: MasterResume;
}

export default function ResumeDocument({ resume }: ResumeDocumentProps) {
  const linkedinUrl = resume.linkedin
    ? resume.linkedin.startsWith("http")
      ? resume.linkedin
      : `https://www.linkedin.com/in/${resume.linkedin.replace("linkedin.com/in/", "")}`
    : "";

  const portfolioUrl = resume.portfolio
    ? resume.portfolio.startsWith("http")
      ? resume.portfolio
      : `https://${resume.portfolio}`
    : "";

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* ── Name ── */}
        <Text style={s.name}>{resume.name}</Text>

        {/* ── Contact block ── */}
        <View style={s.contactBlock}>
          {portfolioUrl ? (
            <View style={{ flexDirection: "row" }}>
              <Text style={s.contactRow}>Portfolio: </Text>
              <Link src={portfolioUrl} style={s.contactLink}>
                {portfolioUrl}
              </Link>
            </View>
          ) : null}
          <View style={{ flexDirection: "row" }}>
            <Text style={s.contactRow}>Email: </Text>
            <Link src={`mailto:${resume.email}`} style={s.contactLink}>
              {resume.email}
            </Link>
          </View>
          {resume.phone ? (
            <Text style={s.contactRow}>Phone: {resume.phone}</Text>
          ) : null}
          {linkedinUrl ? (
            <View style={{ flexDirection: "row" }}>
              <Text style={s.contactRow}>LinkedIn: </Text>
              <Link src={linkedinUrl} style={s.contactLink}>
                {linkedinUrl}
              </Link>
            </View>
          ) : null}
        </View>

        {/* ── Summary ── */}
        {resume.summary ? (
          <Text style={s.summary}>{resume.summary.trim()}</Text>
        ) : null}

        {/* ── Employment History ── */}
        <SectionHeader title="Employment History" />
        {resume.experience.map((exp, i) => (
          <View key={i} style={s.expEntry}>
            <Text style={s.expTitle}>
              {exp.title}, {exp.company}
            </Text>
            <Text style={s.metaLine}>Duration: {exp.dates}</Text>
            {exp.technologies?.length ? (
              <Text style={s.techLine}>
                Technologies Used: [Tech Stack: {exp.technologies.join(", ")}]
              </Text>
            ) : null}

            {exp.intern_bullets && exp.intern_bullets.length > 0 ? (
              <>
                {/* Level-1 subsection: Full-Time */}
                <Text style={s.subsectionHeader}>
                  {"\u2013"}
                  {"   "}As Full-Time Developer ({exp.dates}):
                </Text>
                {exp.bullets.map((b, j) => (
                  <Bullet key={j} text={b} indented />
                ))}
                {/* Level-1 subsection: Intern */}
                <Text style={s.subsectionHeader}>
                  {"\u2013"}
                  {"   "}As Intern:
                </Text>
                {exp.intern_bullets.map((b, j) => (
                  <Bullet key={j} text={b} indented />
                ))}
              </>
            ) : (
              exp.bullets.map((b, j) => <Bullet key={j} text={b} />)
            )}
          </View>
        ))}

        {/* ── Projects ── */}
        {resume.projects && resume.projects.length > 0 ? (
          <>
            <SectionHeader title="Projects" />
            {resume.projects.map((proj, i) => {
              const url = proj.url
                ? proj.url.startsWith("http")
                  ? proj.url
                  : `https://${proj.url}`
                : "";
              return (
                <View key={i} style={s.projEntry}>
                  <View style={s.projTitleRow}>
                    <Text style={s.projName}>{proj.name}</Text>
                    {url ? (
                      <>
                        <Text style={s.projSep}> | </Text>
                        <Link src={url} style={s.projLink}>
                          {url}
                        </Link>
                      </>
                    ) : null}
                  </View>
                  {proj.bullets && proj.bullets.length > 0 ? (
                    proj.bullets.map((b, j) => <Bullet key={j} text={b} />)
                  ) : proj.description ? (
                    <Bullet text={proj.description} />
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {/* ── Skills ── */}
        <SectionHeader title="Skills" />
        {resume.categorized_skills && resume.categorized_skills.length > 0 ? (
          resume.categorized_skills.map((cat, i) => (
            <View key={i} style={s.skillRow}>
              <Text style={s.skillLabel}>{cat.label}</Text>
              <Text style={s.skillValue}>: {cat.items}</Text>
            </View>
          ))
        ) : (
          <View style={s.skillRow}>
            <Text style={s.skillValue}>{resume.skills.join(", ")}</Text>
          </View>
        )}

        {/* ── Education ── */}
        <SectionHeader title="Education" />
        {resume.education.map((edu, i) => (
          <View key={i} style={s.eduEntry}>
            <Text style={s.eduDegree}>
              {edu.degree}, {edu.school}
            </Text>
            <View style={s.eduYearRow}>
              <Text style={s.eduYearBold}>({edu.year})</Text>
              {edu.gpa ? (
                <Text style={s.eduYearRegular}> | CGPA - {edu.gpa}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
}
