/**
 * Field Detector — Enhanced
 * Detects ALL fillable form fields on job application pages, including:
 * - Standard HTML inputs, textareas, selects
 * - Shadow DOM encapsulated fields (Workday, Salesforce)
 * - ARIA comboboxes/listboxes (Greenhouse, Lever, custom dropdowns)
 * - ContentEditable divs (rich text editors)
 * - Dynamically loaded fields via MutationObserver
 * - Platform-specific patterns (Workday, Greenhouse, Lever, iCIMS, Taleo)
 */

export interface DetectedField {
  element: HTMLElement;
  type: 'input' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'combobox' | 'contenteditable';
  inputType?: string; // text, email, tel, url, number, etc.
  name: string;
  id: string;
  label: string;
  placeholder: string;
  ariaLabel: string;
  dataTestId: string;
  currentValue: string;
  required: boolean;
  // Combined identifier for matching
  identifier: string;
  // For radio/checkbox groups
  groupName?: string;
  options?: string[];
  // For ARIA comboboxes — the associated listbox element
  listboxId?: string;
  // Track the root (document or shadowRoot) this field belongs to
  ownerRoot?: Document | ShadowRoot;
}

/**
 * Detect all fillable form fields on the current page,
 * including inside Shadow DOM and ARIA widgets
 */
export function detectAllFields(): DetectedField[] {
  const fields: DetectedField[] = [];
  const seenElements = new WeakSet<HTMLElement>();

  // Traverse the main document and all shadow roots
  traverseRoots(document, fields, seenElements);

  // Deduplicate radio groups
  return deduplicateRadios(fields);
}

/**
 * Wait for dynamically loaded fields (SPA forms) and re-detect
 */
export function detectFieldsWithRetry(
  maxWaitMs = 3000,
  intervalMs = 300
): Promise<DetectedField[]> {
  return new Promise((resolve) => {
    let lastCount = 0;
    let stableCount = 0;
    const startTime = Date.now();

    const check = () => {
      const fields = detectAllFields();
      if (fields.length === lastCount) {
        stableCount++;
      } else {
        stableCount = 0;
        lastCount = fields.length;
      }

      // Stable for 2 consecutive checks, or timeout
      if (stableCount >= 2 || Date.now() - startTime > maxWaitMs) {
        resolve(fields);
        return;
      }

      setTimeout(check, intervalMs);
    };

    check();
  });
}

// ============ Root Traversal (Shadow DOM support) ============

function traverseRoots(
  root: Document | ShadowRoot,
  fields: DetectedField[],
  seen: WeakSet<HTMLElement>
): void {
  // Detect standard fields in this root
  detectStandardInputs(root, fields, seen);
  detectTextareas(root, fields, seen);
  detectSelects(root, fields, seen);

  // Detect ARIA-based widgets
  detectAriaComboboxes(root, fields, seen);
  detectContentEditables(root, fields, seen);

  // Recursively traverse shadow roots
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      traverseRoots(el.shadowRoot, fields, seen);
    }
  }
}

// ============ Standard HTML Inputs ============

function detectStandardInputs(
  root: Document | ShadowRoot,
  fields: DetectedField[],
  seen: WeakSet<HTMLElement>
): void {
  const inputs = root.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="file"]):not([type="search"])'
  );

  for (const input of inputs) {
    if (seen.has(input)) continue;
    if (!isVisible(input)) continue;
    seen.add(input);

    const type = input.type?.toLowerCase() || 'text';

    if (type === 'radio') {
      const label = getGroupLabel(input, root);
      fields.push({
        element: input,
        type: 'radio',
        inputType: 'radio',
        name: input.name,
        id: input.id,
        label,
        placeholder: '',
        ariaLabel: input.getAttribute('aria-label') || '',
        dataTestId: input.getAttribute('data-testid') || input.getAttribute('data-automation-id') || '',
        currentValue: getRadioGroupValue(input.name, root),
        required: input.required || input.getAttribute('aria-required') === 'true',
        identifier: buildIdentifier(input, root, label),
        groupName: input.name,
        options: [getLabelForElement(input, root) || input.value],
        ownerRoot: root,
      });
    } else if (type === 'checkbox') {
      fields.push({
        element: input,
        type: 'checkbox',
        inputType: 'checkbox',
        name: input.name,
        id: input.id,
        label: getLabelForElement(input, root) || '',
        placeholder: '',
        ariaLabel: input.getAttribute('aria-label') || '',
        dataTestId: input.getAttribute('data-testid') || input.getAttribute('data-automation-id') || '',
        currentValue: input.checked ? 'true' : 'false',
        required: input.required || input.getAttribute('aria-required') === 'true',
        identifier: buildIdentifier(input, root),
        ownerRoot: root,
      });
    } else {
      // Skip if this input is actually the text part of an ARIA combobox
      // (we'll handle those separately)
      if (input.getAttribute('role') === 'combobox') continue;

      fields.push({
        element: input,
        type: 'input',
        inputType: type,
        name: input.name,
        id: input.id,
        label: getLabelForElement(input, root) || '',
        placeholder: input.placeholder || '',
        ariaLabel: input.getAttribute('aria-label') || '',
        dataTestId: input.getAttribute('data-testid') || input.getAttribute('data-automation-id') || '',
        currentValue: input.value,
        required: input.required || input.getAttribute('aria-required') === 'true',
        identifier: buildIdentifier(input, root),
        ownerRoot: root,
      });
    }
  }
}

// ============ Textareas ============

function detectTextareas(
  root: Document | ShadowRoot,
  fields: DetectedField[],
  seen: WeakSet<HTMLElement>
): void {
  const textareas = root.querySelectorAll<HTMLTextAreaElement>('textarea');
  for (const textarea of textareas) {
    if (seen.has(textarea)) continue;
    if (!isVisible(textarea)) continue;
    seen.add(textarea);

    fields.push({
      element: textarea,
      type: 'textarea',
      name: textarea.name,
      id: textarea.id,
      label: getLabelForElement(textarea, root) || '',
      placeholder: textarea.placeholder || '',
      ariaLabel: textarea.getAttribute('aria-label') || '',
      dataTestId: textarea.getAttribute('data-testid') || textarea.getAttribute('data-automation-id') || '',
      currentValue: textarea.value,
      required: textarea.required || textarea.getAttribute('aria-required') === 'true',
      identifier: buildIdentifier(textarea, root),
      ownerRoot: root,
    });
  }
}

// ============ Select Dropdowns ============

function detectSelects(
  root: Document | ShadowRoot,
  fields: DetectedField[],
  seen: WeakSet<HTMLElement>
): void {
  const selects = root.querySelectorAll<HTMLSelectElement>('select');
  for (const select of selects) {
    if (seen.has(select)) continue;
    if (!isVisible(select)) continue;
    seen.add(select);

    const options = Array.from(select.options)
      .filter((o) => o.value && o.value !== '')
      .map((o) => o.text.trim());

    fields.push({
      element: select,
      type: 'select',
      name: select.name,
      id: select.id,
      label: getLabelForElement(select, root) || '',
      placeholder: '',
      ariaLabel: select.getAttribute('aria-label') || '',
      dataTestId: select.getAttribute('data-testid') || select.getAttribute('data-automation-id') || '',
      currentValue: select.value,
      required: select.required || select.getAttribute('aria-required') === 'true',
      identifier: buildIdentifier(select, root),
      options,
      ownerRoot: root,
    });
  }
}

// ============ ARIA Comboboxes / Custom Dropdowns ============

function detectAriaComboboxes(
  root: Document | ShadowRoot,
  fields: DetectedField[],
  seen: WeakSet<HTMLElement>
): void {
  // Strategy 1: Elements with role="combobox"
  const comboboxes = root.querySelectorAll<HTMLElement>('[role="combobox"]');
  for (const el of comboboxes) {
    if (seen.has(el)) continue;
    if (!isVisible(el)) continue;
    seen.add(el);

    const listboxId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns') || '';
    const input = el.tagName === 'INPUT' ? el as HTMLInputElement : el.querySelector('input');
    const currentValue = input ? (input as HTMLInputElement).value : el.textContent?.trim() || '';

    fields.push({
      element: el,
      type: 'combobox',
      name: (el as HTMLInputElement).name || el.getAttribute('data-name') || '',
      id: el.id,
      label: getLabelForElement(el, root) || '',
      placeholder: (el as HTMLInputElement).placeholder || el.getAttribute('data-placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-automation-id') || '',
      currentValue,
      required: el.getAttribute('aria-required') === 'true' || el.hasAttribute('required'),
      identifier: buildIdentifier(el, root),
      listboxId,
      ownerRoot: root,
    });
  }

  // Strategy 2: Platform-specific custom dropdown patterns
  const customDropdownSelectors = [
    // Workday
    '[data-automation-id*="select"], [data-automation-id*="dropdown"]',
    // Greenhouse
    '.select2-container, .css-1pahdxg-control, [class*="select__control"]',
    // Lever
    '[class*="custom-select"], [class*="dropdown-trigger"]',
    // Generic React-Select
    '[class*="react-select"], [class*="css-"][class*="-container"]',
    // Material UI
    '.MuiSelect-root, .MuiAutocomplete-root',
    // Ant Design
    '.ant-select, .ant-cascader-picker',
  ];

  for (const selector of customDropdownSelectors) {
    try {
      const elements = root.querySelectorAll<HTMLElement>(selector);
      for (const el of elements) {
        if (seen.has(el)) continue;
        if (!isVisible(el)) continue;
        seen.add(el);

        // Find the actual input or display element inside
        const inner = el.querySelector('input') || el.querySelector('[class*="value"], [class*="placeholder"], .select2-selection__rendered');
        const currentValue = inner
          ? (inner as HTMLInputElement).value || inner.textContent?.trim() || ''
          : el.textContent?.trim() || '';

        // Skip if it looks like it already has a meaningful value from a native select
        const nativeSelect = el.querySelector('select');
        if (nativeSelect && seen.has(nativeSelect)) continue;

        fields.push({
          element: el,
          type: 'combobox',
          name: el.getAttribute('data-name') || el.getAttribute('name') || '',
          id: el.id || '',
          label: getLabelForElement(el, root) || '',
          placeholder: (inner as HTMLInputElement)?.placeholder || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-automation-id') || '',
          currentValue,
          required: el.getAttribute('aria-required') === 'true',
          identifier: buildIdentifier(el, root),
          ownerRoot: root,
        });
      }
    } catch { /* invalid selector, skip */ }
  }
}

// ============ ContentEditable Divs (Rich Text Editors) ============

function detectContentEditables(
  root: Document | ShadowRoot,
  fields: DetectedField[],
  seen: WeakSet<HTMLElement>
): void {
  const editables = root.querySelectorAll<HTMLElement>(
    '[contenteditable="true"], [contenteditable=""], [role="textbox"]'
  );

  for (const el of editables) {
    if (seen.has(el)) continue;
    if (!isVisible(el)) continue;
    // Skip tiny contenteditable elements (likely inline editing, not form fields)
    const rect = el.getBoundingClientRect();
    if (rect.height < 30 || rect.width < 100) continue;
    seen.add(el);

    fields.push({
      element: el,
      type: 'contenteditable',
      name: el.getAttribute('data-name') || '',
      id: el.id,
      label: getLabelForElement(el, root) || '',
      placeholder: el.getAttribute('data-placeholder') || el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-automation-id') || '',
      currentValue: el.innerText?.trim() || '',
      required: el.getAttribute('aria-required') === 'true',
      identifier: buildIdentifier(el, root),
      ownerRoot: root,
    });
  }
}

// ============ Label Extraction (Multi-Strategy) ============

/**
 * Get label text for an element using 8 strategies, ordered by reliability
 */
function getLabelForElement(el: HTMLElement, root: Document | ShadowRoot): string {
  // Strategy 1: <label for="id">
  if (el.id) {
    const label = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return cleanLabel(label.textContent);
  }

  // Strategy 2: Wrapping <label>
  const parentLabel = el.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll('input, textarea, select');
    inputs.forEach((i) => i.remove());
    if (clone.textContent?.trim()) return cleanLabel(clone.textContent);
  }

  // Strategy 3: aria-labelledby (can reference multiple IDs)
  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const ids = ariaLabelledBy.split(/\s+/);
    const texts = ids
      .map((id) => {
        const refEl = root.getElementById?.(id) || document.getElementById(id);
        return refEl?.textContent?.trim();
      })
      .filter(Boolean);
    if (texts.length) return cleanLabel(texts.join(' '));
  }

  // Strategy 4: aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return cleanLabel(ariaLabel);

  // Strategy 5: aria-describedby (secondary description — still useful for matching)
  const ariaDescribedBy = el.getAttribute('aria-describedby');
  if (ariaDescribedBy) {
    const refEl = root.getElementById?.(ariaDescribedBy) || document.getElementById(ariaDescribedBy);
    if (refEl?.textContent?.trim()) return cleanLabel(refEl.textContent);
  }

  // Strategy 6: Nearby label/span in parent container (expanded selectors)
  const parent = el.closest(
    '[class*="field"], [class*="form-group"], [class*="formRow"], [class*="input-group"], ' +
    '[class*="form-field"], [class*="question"], [class*="FormField"], ' +
    '[data-automation-id], .field, .form-field, .css-field, div, fieldset, li'
  );
  if (parent) {
    const labelEl = parent.querySelector(
      'label, span[class*="label"], div[class*="label"], .field-label, .form-label, ' +
      '[class*="Label"], [class*="prompt"], [class*="question-text"], ' +
      'legend, h3, h4, h5, h6, p[class*="label"]'
    );
    if (labelEl && labelEl !== el && !labelEl.contains(el) && labelEl.textContent?.trim()) {
      return cleanLabel(labelEl.textContent);
    }
  }

  // Strategy 7: Preceding sibling or previous element text
  const prev = el.previousElementSibling;
  if (prev && ['LABEL', 'SPAN', 'DIV', 'P'].includes(prev.tagName)) {
    const text = prev.textContent?.trim();
    if (text && text.length > 1 && text.length < 150) return cleanLabel(text);
  }

  // Strategy 8: placeholder
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) return cleanLabel(placeholder);

  // Strategy 9: title attribute
  const title = el.getAttribute('title');
  if (title) return cleanLabel(title);

  return '';
}

/**
 * Get label for a radio/checkbox group
 */
function getGroupLabel(el: HTMLElement, root: Document | ShadowRoot): string {
  // Try fieldset > legend
  const fieldset = el.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend?.textContent) return cleanLabel(legend.textContent);
  }

  // Try parent container label (expanded for ARIA groups)
  const container = el.closest(
    '[class*="group"], [class*="field"], [role="radiogroup"], [role="group"], ' +
    '[class*="question"], [data-automation-id]'
  );
  if (container) {
    const label = container.querySelector(
      'label, span, div.label, .question-text, [class*="label"], legend, p'
    );
    if (label && !label.querySelector('input') && label.textContent?.trim()) {
      return cleanLabel(label.textContent);
    }
  }

  return getLabelForElement(el, root);
}

/**
 * Get current value for a radio group
 */
function getRadioGroupValue(name: string, root: Document | ShadowRoot): string {
  const checked = root.querySelector<HTMLInputElement>(
    `input[type="radio"][name="${CSS.escape(name)}"]:checked`
  );
  if (checked) {
    return getLabelForElement(checked, root) || checked.value;
  }
  return '';
}

// ============ Helpers ============

/**
 * Build combined identifier string for matching — includes more attributes
 */
function buildIdentifier(el: HTMLElement, root: Document | ShadowRoot, extraLabel?: string): string {
  const parts = [
    (el as HTMLInputElement).name,
    el.id,
    (el as HTMLInputElement).placeholder,
    el.getAttribute('aria-label'),
    el.getAttribute('aria-labelledby') ? (() => {
      const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/);
      return ids.map((id) => {
        const r = root.getElementById?.(id) || document.getElementById(id);
        return r?.textContent?.trim();
      }).filter(Boolean).join(' ');
    })() : null,
    el.getAttribute('data-testid'),
    el.getAttribute('data-automation-id'),
    el.getAttribute('data-field-name'),
    el.getAttribute('data-name'),
    el.getAttribute('autocomplete'),
    el.getAttribute('title'),
    getLabelForElement(el, root),
    extraLabel,
  ].filter(Boolean);

  return parts.join(' ').toLowerCase();
}

/**
 * Check if element is visible — improved for Shadow DOM and modern CSS
 */
function isVisible(el: HTMLElement): boolean {
  // Check basic display
  if (!el.offsetParent && el.style.position !== 'fixed' && el.style.position !== 'sticky') {
    // Some elements inside flexbox/grid may have null offsetParent — check rect
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
  }

  const style = getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  // Check for off-screen positioning (common hide technique)
  if (parseInt(style.left) < -9000 || parseInt(style.top) < -9000) return false;

  return true;
}

/**
 * Clean label text
 */
function cleanLabel(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[*:]/g, '')
    .replace(/\(required\)/gi, '')
    .replace(/\(optional\)/gi, '')
    .trim()
    .slice(0, 200);
}

/**
 * Deduplicate radio buttons — group by name, merge options
 */
function deduplicateRadios(fields: DetectedField[]): DetectedField[] {
  const radioGroups = new Map<string, DetectedField>();
  const result: DetectedField[] = [];

  for (const field of fields) {
    if (field.type === 'radio' && field.groupName) {
      const existing = radioGroups.get(field.groupName);
      if (existing) {
        // Merge options
        const optionLabel = getLabelForElement(field.element, field.ownerRoot || document) || (field.element as HTMLInputElement).value;
        existing.options?.push(optionLabel);
      } else {
        radioGroups.set(field.groupName, field);
        result.push(field);
      }
    } else {
      result.push(field);
    }
  }

  return result;
}
