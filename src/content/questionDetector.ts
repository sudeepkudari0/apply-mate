/**
 * Question Detector
 * Detects long-form question fields on job application pages.
 * Distinguishes between data fields (name, email) and open-ended questions.
 */

export interface DetectedQuestion {
  element: HTMLTextAreaElement;
  questionText: string;
  minLength?: number;
  maxLength?: number;
  hasExistingAnswer: boolean;
}

// Patterns that indicate a long-form question (not a data field)
const QUESTION_PATTERNS = [
  /why\s+(?:do\s+you|are\s+you|would\s+you|should\s+we)/i,
  /describe\s+(?:a\s+time|your|the|how)/i,
  /tell\s+us\s+about/i,
  /what\s+(?:is\s+your|are\s+your|makes\s+you|would\s+you|motivates)/i,
  /how\s+(?:do\s+you|would\s+you|have\s+you|did\s+you)/i,
  /explain\s+(?:your|why|how|a)/i,
  /share\s+(?:an?\s+example|your)/i,
  /biggest\s+(?:strength|weakness|challenge|achievement|setback)/i,
  /most\s+(?:impactful|challenging|rewarding|difficult)/i,
  /professional\s+(?:setback|achievement|failure|growth)/i,
  /conflict\s+(?:in|with|at)/i,
  /leadership\s+(?:experience|style|example)/i,
  /handled?\s+(?:conflict|disagreement|challenge|failure)/i,
  /proud(?:est)?\s+(?:of|achievement|accomplishment)/i,
  /interested\s+in\s+(?:this|the|our|working)/i,
  /stand\s+out/i,
  /contribute\s+to/i,
  /good\s+fit/i,
  /about\s+yourself/i,
  /career\s+(?:goals|aspirations|objective)/i,
  /additional\s+(?:information|comments|notes)/i,
  /anything\s+(?:else|you'd\s+like)/i,
];

// Labels that indicate this is a DATA field, not a question
const DATA_FIELD_PATTERNS = [
  /^cover\s*letter$/i,
  /^address$/i,
  /^street/i,
  /^notes?$/i,
  /^message$/i,
  /^comment$/i,
  /^summary$/i,
  /^bio$/i,
  /^description$/i,
  /^skills?$/i,
];

/**
 * Detect long-form question fields on the page
 */
export function detectQuestionFields(): DetectedQuestion[] {
  const questions: DetectedQuestion[] = [];
  const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea');

  for (const textarea of textareas) {
    // Must be visible
    if (!isVisibleElement(textarea)) continue;

    // Must have reasonable size (not a tiny notes field)
    const rows = parseInt(textarea.getAttribute('rows') || '0', 10);
    const computedHeight = parseInt(getComputedStyle(textarea).height, 10);
    if (rows < 2 && computedHeight < 60) continue;

    // Get the question text from label/nearby elements
    const questionText = getQuestionText(textarea);
    if (!questionText) continue;

    // Check if this looks like a question (not a data field)
    const isDataField = DATA_FIELD_PATTERNS.some((p) => p.test(questionText));
    if (isDataField) continue;

    const isQuestion = QUESTION_PATTERNS.some((p) => p.test(questionText));
    // If it doesn't match patterns but is a large textarea with a label, include it
    if (!isQuestion && rows < 4 && computedHeight < 100) continue;

    // Get character limits
    const maxLength = textarea.maxLength > 0 ? textarea.maxLength : undefined;
    const minLength = textarea.minLength > 0 ? textarea.minLength : undefined;

    // Also check for character counter nearby
    const charLimit = findCharacterLimit(textarea);

    questions.push({
      element: textarea,
      questionText,
      minLength,
      maxLength: maxLength || charLimit || undefined,
      hasExistingAnswer: !!(textarea.value && textarea.value.trim().length > 10),
    });
  }

  return questions;
}

// ============ Label Extraction ============

function getQuestionText(textarea: HTMLTextAreaElement): string {
  // Strategy 1: label[for]
  if (textarea.id) {
    const label = document.querySelector(`label[for="${CSS.escape(textarea.id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  // Strategy 2: Wrapping label
  const parentLabel = textarea.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('textarea').forEach((t) => t.remove());
    if (clone.textContent?.trim()) return clone.textContent.trim();
  }

  // Strategy 3: Parent container heading/label
  const container = textarea.closest(
    '[class*="question"], [class*="field"], [class*="form-group"], .question, .field-group, div'
  );
  if (container) {
    const headings = container.querySelectorAll(
      'label, h1, h2, h3, h4, h5, h6, .question-text, [class*="question"], [class*="label"], p'
    );
    for (const heading of headings) {
      if (heading.contains(textarea)) continue;
      const text = heading.textContent?.trim();
      if (text && text.length > 10 && text.length < 500) return text;
    }
  }

  // Strategy 4: aria-label or placeholder
  const ariaLabel = textarea.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const placeholder = textarea.placeholder;
  if (placeholder && placeholder.length > 10) return placeholder;

  return '';
}

function findCharacterLimit(textarea: HTMLTextAreaElement): number | undefined {
  // Look for character counter near the textarea
  const parent = textarea.closest('div, fieldset, section');
  if (!parent) return undefined;

  const text = parent.textContent || '';
  const match = text.match(/(\d{2,5})\s*(?:characters?|chars?)\s*(?:max|limit|remaining)/i);
  if (match) return parseInt(match[1], 10);

  const match2 = text.match(/(?:max|limit|maximum)[:\s]*(\d{2,5})/i);
  if (match2) return parseInt(match2[1], 10);

  return undefined;
}

function isVisibleElement(el: HTMLElement): boolean {
  if (!el.offsetParent && el.style.position !== 'fixed') return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}
