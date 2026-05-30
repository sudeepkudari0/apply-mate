/**
 * ResumePreview.tsx
 * Live in-browser PDF preview using @react-pdf/renderer's PDFViewer.
 * Drop this into any route/page in your Vite+React app.
 *
 * Usage:
 *   <ResumePreview resume={masterResumeObject} filename="Sudeep_Kudari_CV.pdf" />
 */

import { Suspense, lazy } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import ResumeDocument from "./resumeDocument";
import type { MasterResume } from "./types";

// PDFViewer uses browser APIs — lazy-load to avoid SSR issues
const PDFViewer = lazy(() =>
  import("@react-pdf/renderer").then((m) => ({ default: m.PDFViewer })),
);

interface ResumePreviewProps {
  resume: MasterResume;
  filename?: string;
}

export function ResumePreview({
  resume,
  filename = "Resume.pdf",
}: ResumePreviewProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#f0f0f0",
      }}
    >
      {/* ── Toolbar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#1a1a1a",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: "sans-serif", fontSize: 14 }}>
          Resume Preview — {resume.name}
        </span>

        <PDFDownloadLink
          document={<ResumeDocument resume={resume} />}
          fileName={filename}
          style={{
            background: "#0563C1",
            color: "#fff",
            padding: "8px 18px",
            borderRadius: 4,
            textDecoration: "none",
            fontFamily: "sans-serif",
            fontSize: 13,
            fontWeight: "bold",
          }}
        >
          {({ loading }) => (loading ? "Generating…" : "⬇ Download PDF")}
        </PDFDownloadLink>
      </div>

      {/* ── PDF Viewer ── */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <Suspense
          fallback={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                fontFamily: "sans-serif",
              }}
            >
              Loading preview…
            </div>
          }
        >
          <PDFViewer width="100%" height="100%" showToolbar={false}>
            <ResumeDocument resume={resume} />
          </PDFViewer>
        </Suspense>
      </div>
    </div>
  );
}
