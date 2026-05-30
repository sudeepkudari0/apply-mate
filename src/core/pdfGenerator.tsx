/**
 * pdfGenerator.ts  —  react-pdf/renderer edition
 *
 * Drop-in replacement for the previous html2canvas/jsPDF version.
 * All exported function signatures are identical so no call-sites change.
 *
 * Install:
 *   npm install @react-pdf/renderer
 *   npm uninstall jspdf html2canvas   ← safe to remove old deps
 */

import { pdf } from '@react-pdf/renderer';
import ResumeDocument from './resumeDocument';
import type { MasterResume } from './types';
import { parseRewrittenResume, mergeRewrittenIntoOriginal } from './resumeParser';

// ─── Public API (same signatures as before) ───────────────────────────────────

/**
 * Generate and trigger a browser download of the tailored PDF.
 */
export async function generateResumePDF(
  resumeText: string,
  filename: string,
  masterResume?: MasterResume
): Promise<void> {
  if (!masterResume) throw new Error('Master resume is required for PDF generation');

  const blob = await buildBlob(resumeText, masterResume);
  const safeName = filename || buildFilename(masterResume.name);
  triggerDownload(blob, safeName);
}

/**
 * Return the tailored PDF as a Blob (for upload, preview, etc.).
 */
export async function generateResumePDFBlob(
  resumeText: string,
  masterResume?: MasterResume
): Promise<Blob> {
  if (!masterResume) throw new Error('Master resume is required for PDF generation');
  return buildBlob(resumeText, masterResume);
}

/**
 * Build filename: FirstName_LastName_Tailored_CV.pdf
 */
export function buildFilename(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const formatted = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('_');
  return `${formatted}_Tailored_CV.pdf`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function buildBlob(resumeText: string, masterResume: MasterResume): Promise<Blob> {
  const parsed = parseRewrittenResume(resumeText);
  const merged = mergeRewrittenIntoOriginal(masterResume, parsed);

  // pdf() renders the react-pdf document tree to a Blob entirely in-memory —
  // no DOM, no canvas, no iframe needed.
  const instance = pdf(<ResumeDocument resume={merged} />);
  return instance.toBlob();
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}