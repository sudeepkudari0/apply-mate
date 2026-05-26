/**
 * Resume Uploader
 * Auto-uploads generated PDF to file input fields on job portals.
 * Detects resume upload fields and programmatically sets files.
 */

/**
 * Find resume upload input on the page and upload the PDF
 */
export async function autoUploadResume(
  pdfBlob: Blob,
  fileName: string
): Promise<boolean> {
  const fileInput = findResumeUploadInput();
  if (!fileInput) {
    console.log('[ApplyMate] No resume upload input found on page');
    return false;
  }

  try {
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    // Dispatch events to trigger framework handlers
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

    console.log('[ApplyMate] Resume uploaded successfully:', fileName);
    return true;
  } catch (error) {
    console.error('[ApplyMate] Failed to upload resume:', error);
    return false;
  }
}

/**
 * Find the file input most likely to be a resume upload
 */
function findResumeUploadInput(): HTMLInputElement | null {
  const fileInputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');

  if (fileInputs.length === 0) return null;
  if (fileInputs.length === 1) return fileInputs[0]; // Only one file input — probably resume

  // Multiple file inputs: find the one most likely to be resume
  const resumeKeywords = [
    'resume', 'cv', 'curriculum', 'vitae',
    'upload resume', 'upload cv', 'attach resume', 'attach cv',
    'resume upload', 'cv upload',
  ];

  for (const input of fileInputs) {
    const identifier = [
      input.name,
      input.id,
      input.getAttribute('aria-label'),
      input.getAttribute('data-testid'),
      input.getAttribute('accept'),
      getParentLabelText(input),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Check if it accepts PDFs
    const accept = input.getAttribute('accept') || '';
    const acceptsPdf = !accept || accept.includes('pdf') || accept.includes('application/');

    if (!acceptsPdf) continue;

    // Check if identifier matches resume keywords
    for (const keyword of resumeKeywords) {
      if (identifier.includes(keyword)) {
        return input;
      }
    }
  }

  // Fallback: return first file input that accepts PDFs
  for (const input of fileInputs) {
    const accept = input.getAttribute('accept') || '';
    if (!accept || accept.includes('pdf') || accept.includes('application/')) {
      return input;
    }
  }

  return null;
}

/**
 * Get label text from parent elements
 */
function getParentLabelText(el: HTMLElement): string {
  // Check label[for]
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return label.textContent.trim();
  }

  // Check parent container
  const parent = el.closest('div, fieldset, section, label');
  if (parent) {
    const labels = parent.querySelectorAll('label, span, p, h3, h4');
    for (const label of labels) {
      if (label.contains(el)) continue;
      const text = label.textContent?.trim();
      if (text && text.length < 100) return text;
    }
  }

  return '';
}
