/**
 * Question Detector — Enhanced
 * Detects long-form question fields on job application pages.
 * Now supports Shadow DOM, contenteditable, and more question patterns.
 */

export interface DetectedQuestion {
  element: HTMLTextAreaElement | HTMLElement;
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
  // Additional patterns for modern ATS
  /provide\s+(?:an?\s+example|details|more\s+info)/i,
  /walk\s+us\s+through/i,
  /please\s+(?:describe|explain|elaborate|share)/i,
  /in\s+\d+\s+words/i,
  /cover\s+letter/i,
  /write\s+a\s+brief/i,
  /what\s+(?:excites|inspires|drives)\s+you/i,
  /how\s+(?:will|can|would)\s+you\s+(?:add|bring)\s+value/i,
  /do\s+you\s+have\s+any\s+(?:questions|comments)/i,
  /diversity|inclusion|equity/i,
  /give\s+(?:an?\s+example|us\s+an?\s+example)/i,
];

// Labels that indicate this is a DATA field, not a question
const DATA_FIELD_PATTERNS = [
  /^address$/i,
  /^street/i,
  /^notes?$/i,
  /^message$/i,
  /^comment$/i,
  /^summary$/i,
  /^bio$/i,
  /^skills?$/i,
];

/**
 * Detect long-form question fields on the page (including Shadow DOM)
 */
export function detectQuestionFields(): DetectedQuestion[] {
  const questions: DetectedQuestion[] = [];
  const seen = new WeakSet<HTMLElement>();

  // Scan main document
  scanForQuestions(document, questions, seen);

  // Scan shadow roots
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      scanForQuestions(el.shadowRoot, questions, seen);
    }
  }

  return questions;
}

function scanForQuestions(
  root: Document | ShadowRoot,
  questions: DetectedQuestion[],
  seen: WeakSet<HTMLElement>
): void {
  // Textareas
  const textareas = root.querySelectorAll<HTMLTextAreaElement>('textarea');
  for (const textarea of textareas) {
    if (seen.has(textarea)) continue;
    if (!isVisibleElement(textarea)) continue;
    seen.add(textarea);

    const rows = parseInt(textarea.getAttribute('rows') || '0', 10);
    const computedHeight = parseInt(getComputedStyle(textarea).height, 10);
    if (rows < 2 && computedHeight < 60) continue;

    const questionText = getQuestionText(textarea, root);
    if (!questionText) continue;

    const isDataField = DATA_FIELD_PATTERNS.some((p) => p.test(questionText));
    if (isDataField) continue;

    const isQuestion = QUESTION_PATTERNS.some((p) => p.test(questionText));
    if (!isQuestion && rows < 4 && computedHeight < 100) continue;

    const maxLength = textarea.maxLength > 0 ? textarea.maxLength : undefined;
    const minLength = textarea.minLength > 0 ? textarea.minLength : undefined;
    const charLimit = findCharacterLimit(textarea);

    questions.push({
      element: textarea,
      questionText,
      minLength,
      maxLength: maxLength || charLimit || undefined,
      hasExistingAnswer: !!(textarea.value && textarea.value.trim().length > 10),
    });
  }

  // ContentEditable divs that look like question fields
  const editables = root.querySelectorAll<HTMLElement>(
    '[contenteditable="true"][role="textbox"], [contenteditable="true"]'
  );
  for (const el of editables) {
    if (seen.has(el)) continue;
    if (!isVisibleElement(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height < 60 || rect.width < 200) continue;
    seen.add(el);

    const questionText = getQuestionText(el, root);
    if (!questionText) continue;

    const isDataField = DATA_FIELD_PATTERNS.some((p) => p.test(questionText));
    if (isDataField) continue;

    const isQuestion = QUESTION_PATTERNS.some((p) => p.test(questionText));
    if (!isQuestion && rect.height < 100) continue;

    questions.push({
      element: el,
      questionText,
      hasExistingAnswer: !!(el.innerText && el.innerText.trim().length > 10),
    });
  }
}

// ============ Label Extraction ============

function getQuestionText(el: HTMLElement, root: Document | ShadowRoot): string {
  // Strategy 1: label[for]
  if (el.id) {
    const label = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  // Strategy 2: aria-labelledby
  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const refEl = document.getElementById(ariaLabelledBy);
    if (refEl?.textContent?.trim()) return refEl.textContent.trim();
  }

  // Strategy 3: Wrapping label
  const parentLabel = el.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('textarea, [contenteditable]').forEach((t) => t.remove());
    if (clone.textContent?.trim()) return clone.textContent.trim();
  }

  // Strategy 4: Parent container heading/label
  const container = el.closest(
    '[class*="question"], [class*="field"], [class*="form-group"], .question, .field-group, div'
  );
  if (container) {
    const headings = container.querySelectorAll(
      'label, h1, h2, h3, h4, h5, h6, .question-text, [class*="question"], [class*="label"], [class*="prompt"], p'
    );
    for (const heading of headings) {
      if (heading.contains(el)) continue;
      const text = heading.textContent?.trim();
      if (text && text.length > 10 && text.length < 500) return text;
    }
  }

  // Strategy 5: aria-label or placeholder
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const placeholder = (el as HTMLTextAreaElement).placeholder || el.getAttribute('data-placeholder');
  if (placeholder && placeholder.length > 10) return placeholder;

  return '';
}

function findCharacterLimit(textarea: HTMLElement): number | undefined {
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
  if (!el.offsetParent && el.style.position !== 'fixed') {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
  }
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}
