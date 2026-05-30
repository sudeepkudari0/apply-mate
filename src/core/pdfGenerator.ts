/**
 * PDF Generator — HTML Template → html2canvas → jsPDF
 *
 * Instead of drawing each element programmatically with jsPDF APIs,
 * we build a complete HTML+CSS template matching the original resume,
 * render it into a hidden DOM container, capture it with html2canvas
 * at high DPI, and embed the result in a jsPDF document.
 *
 * This approach gives pixel-perfect control over fonts, colors,
 * spacing, and layout — exactly matching the original resume.
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { MasterResume } from './types';
import { parseRewrittenResume, mergeRewrittenIntoOriginal } from './resumeParser';

/**
 * Generate PDF from tailored resume text + original structure.
 */
export async function generateResumePDF(
  resumeText: string,
  filename: string,
  masterResume?: MasterResume
): Promise<void> {
  if (!masterResume) {
    throw new Error('Master resume is required for PDF generation');
  }

  const parsed = parseRewrittenResume(resumeText);
  const merged = mergeRewrittenIntoOriginal(masterResume, parsed);

  const doc = await createResumePDFFromHTML(merged);
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

  const doc = await createResumePDFFromHTML(merged);
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

// ===================== HTML Template Builder =====================

function buildResumeHTML(resume: MasterResume): string {
  const linkedinUrl = resume.linkedin
    ? resume.linkedin.startsWith('http')
      ? resume.linkedin
      : `https://www.linkedin.com/in/${resume.linkedin.replace('linkedin.com/in/', '')}`
    : '';

  const portfolioUrl = resume.portfolio
    ? resume.portfolio.startsWith('http')
      ? resume.portfolio
      : `https://${resume.portfolio}`
    : '';

  // Build Experience HTML
  let experienceHTML = '';
  for (const exp of resume.experience) {
    const techLine = exp.technologies?.length
      ? `<div class="tech-line">Technologies Used: [Tech Stack: ${exp.technologies.join(', ')}]</div>`
      : '';

    let bulletsHTML = '';
    if (exp.intern_bullets && exp.intern_bullets.length > 0) {
      // Parse dates dynamically — original format: "Feb 2024 - Present"
      const dateParts = exp.dates.split(/[-–—]/);
      const startDate = dateParts[0]?.trim() || 'Feb 2024';
      const endDate = dateParts[1]?.trim() || 'Present';

      // Subsection format — Full-Time + Intern
      bulletsHTML += `<div class="subsection-header">-&nbsp;&nbsp;&nbsp;As Full-Time Developer (${startDate} – ${endDate}):</div>`;
      bulletsHTML += '<ul class="bullet-list indented">';
      for (const b of exp.bullets) {
        bulletsHTML += `<li>${escapeHTML(b)}</li>`;
      }
      bulletsHTML += '</ul>';
      bulletsHTML += `<div class="subsection-header">-&nbsp;&nbsp;&nbsp;As Intern (${startDate} – June 2024):</div>`;
      bulletsHTML += '<ul class="bullet-list indented">';
      for (const b of exp.intern_bullets) {
        bulletsHTML += `<li>${escapeHTML(b)}</li>`;
      }
      bulletsHTML += '</ul>';
    } else {
      bulletsHTML += '<ul class="bullet-list">';
      for (const b of exp.bullets) {
        bulletsHTML += `<li>${escapeHTML(b)}</li>`;
      }
      bulletsHTML += '</ul>';
    }

    experienceHTML += `
      <div class="exp-entry">
        <div class="exp-title"><b>${escapeHTML(exp.title)}, ${escapeHTML(exp.company)}</b></div>
        <div class="exp-dates">Duration: ${escapeHTML(exp.dates)}</div>
        ${techLine}
        ${bulletsHTML}
      </div>`;
  }

  // Build Projects HTML
  let projectsHTML = '';
  if (resume.projects) {
    for (const proj of resume.projects) {
      const url = proj.url
        ? proj.url.startsWith('http') ? proj.url : `https://${proj.url}`
        : '';
      const linkPart = url
        ? `<span class="pipe-sep"> | </span><a href="${url}" class="link">${escapeHTML(url)}</a>`
        : '';

      let projBullets = '';
      if (proj.bullets && proj.bullets.length > 0) {
        projBullets += '<ul class="bullet-list">';
        for (const b of proj.bullets) {
          projBullets += `<li>${escapeHTML(b)}</li>`;
        }
        projBullets += '</ul>';
      } else if (proj.description) {
        projBullets += '<ul class="bullet-list">';
        projBullets += `<li>${escapeHTML(proj.description)}</li>`;
        projBullets += '</ul>';
      }

      projectsHTML += `
        <div class="proj-entry">
          <div class="proj-title"><b>${escapeHTML(proj.name)}</b>${linkPart}</div>
          ${projBullets}
        </div>`;
    }
  }

  // Build Skills HTML
  let skillsHTML = '';
  if (resume.categorized_skills && resume.categorized_skills.length > 0) {
    for (const cat of resume.categorized_skills) {
      skillsHTML += `<div class="skill-row"><b>${escapeHTML(cat.label)}</b>: ${escapeHTML(cat.items)}</div>`;
    }
  } else {
    skillsHTML = `<div class="skill-row">${escapeHTML(resume.skills.join(', '))}</div>`;
  }

  // Build Education HTML
  let educationHTML = '';
  for (const edu of resume.education) {
    let details = `(${escapeHTML(edu.year)})`;
    if (edu.gpa) details += ` | CGPA - ${escapeHTML(edu.gpa)}`;
    educationHTML += `
      <div class="edu-entry">
        <div class="edu-title"><b>${escapeHTML(edu.degree)}, ${escapeHTML(edu.school)}</b></div>
        <div class="edu-details">${details}</div>
      </div>`;
  }

  // Assemble the full HTML with inline CSS
  return `
<div id="resume-root" style="
  width: 595px;
  padding: 40px 48px;
  font-family: Arial, Helvetica, sans-serif;
  color: #000;
  background: #fff;
  box-sizing: border-box;
  line-height: 1.35;
">
  <style>
    #resume-root * { box-sizing: border-box; margin: 0; padding: 0; }

    /* Header */
    .name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
    .contact-row { font-size: 10.5px; line-height: 1.6; }
    .contact-label { font-weight: bold; }
    .link { color: #0563C1; text-decoration: underline; }
    .pipe-sep { font-weight: normal; color: #000; }

    /* Summary */
    .summary { font-size: 10.5px; margin-top: 6px; margin-bottom: 4px; line-height: 1.4; }

    /* Section headers — centered, teal/dark-cyan like original */
    .section-header {
      text-align: center;
      font-size: 14px;
      font-weight: bold;
      color: #C6A300;
      margin-top: 8px;
      margin-bottom: 4px;
    }

    /* Experience */
    .exp-entry { margin-bottom: 4px; }
    .exp-title { font-size: 10.5px; font-weight: bold; margin-bottom: 1px; }
    .exp-dates { font-size: 9.5px; color: #444; margin-bottom: 1px; }
    .tech-line { font-size: 9.5px; color: #444; margin-bottom: 2px; line-height: 1.35; }

    /* Subsection headers (Full-Time / Intern) */
    .subsection-header {
      font-size: 10.5px;
      font-weight: bold;
      margin: 3px 0 1px 12px;
    }

    /* Bullet lists */
    .bullet-list {
      list-style: none;
      margin: 1px 0 2px 18px;
      padding: 0;
    }
    .bullet-list.indented {
      margin-left: 36px;
    }
    .bullet-list li {
      font-size: 10px;
      line-height: 1.35;
      margin-bottom: 1.5px;
      padding-left: 14px;
      position: relative;
    }
    .bullet-list li::before {
      content: "–";
      position: absolute;
      left: 0;
    }

    /* Projects */
    .proj-entry { margin-bottom: 3px; }
    .proj-title { font-size: 10.5px; margin-bottom: 1px; }
    .proj-title a { font-size: 10px; }

    /* Skills */
    .skill-row { font-size: 10.5px; line-height: 1.55; }

    /* Education */
    .edu-entry { margin-bottom: 2px; }
    .edu-title { font-size: 10.5px; }
    .edu-details { font-size: 9.5px; margin-top: 0; }
  </style>

  <!-- Name -->
  <div class="name">${escapeHTML(resume.name)}</div>

  <!-- Contact Info -->
  <div class="contact-row">
    ${resume.portfolio ? `<div><span class="contact-label">Portfolio:</span> <a href="${portfolioUrl}" class="link">${escapeHTML(portfolioUrl)}</a></div>` : ''}
    <div><span class="contact-label">Email:</span> <a href="mailto:${escapeHTML(resume.email)}" class="link">${escapeHTML(resume.email)}</a></div>
    ${resume.phone ? `<div><span class="contact-label">Phone: ${escapeHTML(resume.phone)}</span></div>` : ''}
    ${linkedinUrl ? `<div><span class="contact-label">LinkedIn:</span>  <a href="${linkedinUrl}" class="link">${escapeHTML(linkedinUrl)}</a></div>` : ''}
  </div>

  <!-- Summary -->
  ${resume.summary ? `<div class="summary">${escapeHTML(resume.summary.trim())}</div>` : ''}

  <!-- Employment History -->
  <div class="section-header">Employment History</div>
  ${experienceHTML}

  <!-- Projects -->
  <div class="section-header">Projects</div>
  ${projectsHTML}

  <!-- Skills -->
  <div class="section-header">Skills</div>
  ${skillsHTML}

  <!-- Education -->
  <div class="section-header">Education</div>
  ${educationHTML}
</div>`;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===================== HTML → Canvas → PDF Pipeline =====================

async function createResumePDFFromHTML(resume: MasterResume): Promise<jsPDF> {
  const html = buildResumeHTML(resume);

  // Use an iframe for complete CSS isolation.
  // html2canvas cannot parse Tailwind v4's oklch() colors, so we must
  // render in a clean document context free of any parent-page styles.
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 595px;
    height: 900px;
    border: none;
    visibility: hidden;
  `;
  document.body.appendChild(iframe);

  try {
    // Wait for iframe to be ready
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      // Write a minimal clean document — no external stylesheets
      const iframeDoc = iframe.contentDocument!;
      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  html, body { margin: 0; padding: 0; background: #fff; }
</style></head><body>${html}</body></html>`);
      iframeDoc.close();
    });

    const iframeDoc = iframe.contentDocument!;
    const resumeRoot = iframeDoc.getElementById('resume-root') as HTMLElement;

    if (!resumeRoot) {
      throw new Error('Resume template failed to render in iframe');
    }

    // Resize iframe to fit full content (so html2canvas captures everything)
    const contentHeight = resumeRoot.scrollHeight + 20;
    iframe.style.height = `${contentHeight}px`;

    // Small delay to ensure layout is settled
    await new Promise((r) => setTimeout(r, 100));

    // Capture with html2canvas at 2x for crisp text
    // We pass the iframe's window context so html2canvas uses the clean document
    const canvas = await html2canvas(resumeRoot, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 595,
      windowWidth: 595,
    });

    // A4 dimensions in pt: 595.28 x 841.89
    const PDF_WIDTH_PT = 595.28;
    const PDF_HEIGHT_PT = 841.89;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    // Calculate how to fit the canvas into A4 pages
    const imgWidth = PDF_WIDTH_PT;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;

    if (imgHeight <= PDF_HEIGHT_PT) {
      // Single page — fits entirely
      doc.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0, 0,
        imgWidth, imgHeight,
        undefined,
        'FAST'
      );
    } else {
      // Multi-page — slice the canvas
      const pageCanvasHeight = (PDF_HEIGHT_PT / imgWidth) * canvas.width;
      const totalPages = Math.ceil(canvas.height / pageCanvasHeight);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) doc.addPage();

        const sourceY = page * pageCanvasHeight;
        const sourceH = Math.min(pageCanvasHeight, canvas.height - sourceY);
        const destH = (sourceH / canvas.width) * imgWidth;

        // Create a slice canvas for this page
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceH;
        const ctx = pageCanvas.getContext('2d')!;
        ctx.drawImage(
          canvas,
          0, sourceY,        // source x, y
          canvas.width, sourceH, // source w, h
          0, 0,              // dest x, y
          canvas.width, sourceH  // dest w, h
        );

        doc.addImage(
          pageCanvas.toDataURL('image/png'),
          'PNG',
          0, 0,
          imgWidth, destH,
          undefined,
          'FAST'
        );
      }
    }

    return doc;
  } finally {
    document.body.removeChild(iframe);
  }
}

