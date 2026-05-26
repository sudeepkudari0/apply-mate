/**
 * PDF Generator - Matching exact resume format
 * Features: Left-aligned header, Employment History with subsections,
 * Projects with links and descriptions, proper formatting.
 *
 * FIX: Now accepts rewritten resume text, parses it back into structure,
 * and merges with original to preserve formatting while using tailored content.
 */

import { jsPDF } from 'jspdf';
import { MasterResume } from './types';
import { parseRewrittenResume, mergeRewrittenIntoOriginal } from './resumeParser';

// Colors
const COLORS = {
  black: [0, 0, 0] as [number, number, number],
  link: [0, 102, 204] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
};

/**
 * Generate PDF from tailored resume text + original structure.
 * Parses the LLM-rewritten text and merges it with the original
 * to preserve URLs, dates, and formatting.
 */
export async function generateResumePDF(
  resumeText: string,
  filename: string,
  masterResume?: MasterResume
): Promise<void> {
  if (!masterResume) {
    throw new Error('Master resume is required for PDF generation');
  }

  // Parse the rewritten text and merge with original structure
  const parsed = parseRewrittenResume(resumeText);
  const merged = mergeRewrittenIntoOriginal(masterResume, parsed);

  const doc = createResumePDF(merged);

  // Auto-download with proper filename
  const safeName = filename || buildFilename(masterResume.name);
  doc.save(safeName);
}

/**
 * Generate PDF Blob from tailored resume
 */
export async function generateResumePDFBlob(
  resumeText: string,
  masterResume?: MasterResume
): Promise<Blob> {
  if (!masterResume) {
    throw new Error('Master resume is required for PDF generation');
  }

  const parsed = parseRewrittenResume(resumeText);
  const merged = mergeRewrittenIntoOriginal(masterResume, parsed);

  const doc = createResumePDF(merged);
  return doc.output('blob');
}

/**
 * Build filename: FirstName_LastName_Tailored_CV.pdf
 */
export function buildFilename(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const formatted = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('_');
  return `${formatted}_Tailored_CV.pdf`;
}

/**
 * Create the actual PDF document
 */
function createResumePDF(resume: MasterResume): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper to check page overflow
  const checkPageBreak = (neededSpace: number) => {
    if (y + neededSpace > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ==================== HEADER SECTION ====================
  // Name - Bold, left-aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.black);
  doc.text(resume.name, margin, y);
  y += 20;

  // Contact info - labeled fields, left-aligned
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  // Portfolio
  if (resume.portfolio) {
    doc.setTextColor(...COLORS.black);
    doc.text('Portfolio: ', margin, y);
    const portfolioLabelWidth = doc.getTextWidth('Portfolio: ');
    doc.setTextColor(...COLORS.link);
    const portfolioUrl = resume.portfolio.startsWith('http') ? resume.portfolio : `https://${resume.portfolio}`;
    doc.textWithLink(resume.portfolio, margin + portfolioLabelWidth, y, { url: portfolioUrl });
    y += 14;
  }

  // Email
  doc.setTextColor(...COLORS.black);
  doc.text('Email: ', margin, y);
  const emailLabelWidth = doc.getTextWidth('Email: ');
  doc.setTextColor(...COLORS.link);
  doc.textWithLink(resume.email, margin + emailLabelWidth, y, { url: `mailto:${resume.email}` });
  y += 14;

  // Phone
  if (resume.phone) {
    doc.setTextColor(...COLORS.black);
    doc.text('Phone: ', margin, y);
    const phoneLabelWidth = doc.getTextWidth('Phone: ');
    doc.text(resume.phone, margin + phoneLabelWidth, y);
    y += 14;
  }

  // LinkedIn
  if (resume.linkedin) {
    doc.setTextColor(...COLORS.black);
    doc.text('LinkedIn: ', margin, y);
    const linkedinLabelWidth = doc.getTextWidth('LinkedIn: ');
    doc.setTextColor(...COLORS.link);
    const linkedinUrl = resume.linkedin.startsWith('http') ? resume.linkedin : `https://${resume.linkedin}`;
    doc.textWithLink(linkedinUrl, margin + linkedinLabelWidth, y, { url: linkedinUrl });
    y += 14;
  }

  y += 6;

  // ==================== SUMMARY/BIO ====================
  if (resume.summary) {
    doc.setTextColor(...COLORS.black);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(resume.summary.trim(), contentWidth);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 12 + 8;
  }

  // ==================== EMPLOYMENT HISTORY ====================
  checkPageBreak(30);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.black);
  doc.text('Employment History', pageWidth / 2, y, { align: 'center' });
  y += 16;

  for (const exp of resume.experience) {
    checkPageBreak(80);

    // Job title and company
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.black);
    doc.text(`${exp.title}, ${exp.company}`, margin, y);
    y += 14;

    // Duration line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gray);
    doc.text(`Duration: ${exp.dates}`, margin, y);
    y += 12;

    // Technologies Used line
    if (exp.technologies && exp.technologies.length > 0) {
      const techText = `Technologies Used: [Tech Stack: ${exp.technologies.join(', ')}]`;
      const techLines = doc.splitTextToSize(techText, contentWidth);
      doc.text(techLines, margin, y);
      y += techLines.length * 11 + 4;
    }

    // Full-Time bullets (if intern_bullets exist, show as subsection)
    if (exp.intern_bullets && exp.intern_bullets.length > 0) {
      // Show as "As Full-Time Developer" subsection
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.black);
      doc.text('•   As Full-Time Developer (June 2024 – Present):', margin, y);
      y += 14;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const bullet of exp.bullets) {
        checkPageBreak(30);
        const bulletText = `-      ${bullet}`;
        const bulletLines = doc.splitTextToSize(bulletText, contentWidth - 30);
        doc.text(bulletLines, margin + 20, y);
        y += bulletLines.length * 11 + 2;
      }

      // Intern bullets
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('•   As Intern (Feb 2024 – June 2024):', margin, y);
      y += 14;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const bullet of exp.intern_bullets) {
        checkPageBreak(30);
        const bulletText = `-      ${bullet}`;
        const bulletLines = doc.splitTextToSize(bulletText, contentWidth - 30);
        doc.text(bulletLines, margin + 20, y);
        y += bulletLines.length * 11 + 2;
      }
    } else {
      // Regular bullets without subsections
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.black);
      for (const bullet of exp.bullets) {
        checkPageBreak(30);
        const bulletText = `-      ${bullet}`;
        const bulletLines = doc.splitTextToSize(bulletText, contentWidth - 15);
        doc.text(bulletLines, margin + 10, y);
        y += bulletLines.length * 11 + 2;
      }
    }

    y += 8;
  }

  // ==================== PROJECTS ====================
  checkPageBreak(40);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.black);
  doc.text('Projects', pageWidth / 2, y, { align: 'center' });
  y += 16;

  if (resume.projects) {
    for (const project of resume.projects) {
      checkPageBreak(50);

      // Project name with link
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.black);

      const projectName = project.name;
      doc.text(projectName, margin, y);

      if (project.url) {
        const nameWidth = doc.getTextWidth(projectName);
        doc.setFont('helvetica', 'normal');
        doc.text(' | ', margin + nameWidth, y);
        const pipeWidth = doc.getTextWidth(' | ');
        doc.setTextColor(...COLORS.link);
        const projectUrl = project.url.startsWith('http') ? project.url : `https://${project.url}`;
        doc.textWithLink(project.url, margin + nameWidth + pipeWidth, y, { url: projectUrl });
      }
      y += 14;

      // Project bullets/description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.black);

      if (project.bullets && project.bullets.length > 0) {
        for (const bullet of project.bullets) {
          checkPageBreak(25);
          const bulletText = `-      ${bullet}`;
          const bulletLines = doc.splitTextToSize(bulletText, contentWidth - 15);
          doc.text(bulletLines, margin + 10, y);
          y += bulletLines.length * 11 + 2;
        }
      } else if (project.description) {
        const descLines = doc.splitTextToSize(`-      ${project.description}`, contentWidth - 15);
        doc.text(descLines, margin + 10, y);
        y += descLines.length * 11 + 2;
      }

      y += 6;
    }
  }

  // ==================== SKILLS ====================
  checkPageBreak(40);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.black);
  doc.text('Skills', pageWidth / 2, y, { align: 'center' });
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const skillsText = resume.skills.join(', ') + '.';
  const skillLines = doc.splitTextToSize(skillsText, contentWidth);
  doc.text(skillLines, margin, y);
  y += skillLines.length * 12 + 8;

  // ==================== EDUCATION ====================
  checkPageBreak(50);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.black);
  doc.text('Education', pageWidth / 2, y, { align: 'center' });
  y += 16;

  for (const edu of resume.education) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.black);
    doc.text(`${edu.degree}, ${edu.school}`, margin, y);
    y += 12;

    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gray);
    let eduDetails = `(${edu.year})`;
    if (edu.gpa) {
      eduDetails += ` | CGPA - ${edu.gpa}`;
    }
    doc.text(eduDetails, margin, y);
    y += 14;
  }

  return doc;
}
