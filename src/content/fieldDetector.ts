/**
 * Field Detector
 * Detects all fillable form fields on job application pages.
 * Extracts labels, types, and context for each field.
 */

export interface DetectedField {
  element: HTMLElement;
  type: 'input' | 'textarea' | 'select' | 'radio' | 'checkbox';
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
}

/**
 * Detect all fillable form fields on the current page
 */
export function detectAllFields(): DetectedField[] {
  const fields: DetectedField[] = [];

  // Standard inputs
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"])'
  );

  for (const input of inputs) {
    if (!isVisible(input)) continue;

    const type = input.type?.toLowerCase() || 'text';

    if (type === 'radio') {
      // Group radios by name
      const existing = fields.find(
        (f) => f.type === 'radio' && f.groupName === input.name
      );
      if (existing) {
        const optionLabel = getLabelForElement(input) || input.value;
        existing.options?.push(optionLabel);
        continue;
      }

      fields.push({
        element: input,
        type: 'radio',
        inputType: 'radio',
        name: input.name,
        id: input.id,
        label: getGroupLabel(input),
        placeholder: '',
        ariaLabel: input.getAttribute('aria-label') || '',
        dataTestId: input.getAttribute('data-testid') || '',
        currentValue: getRadioGroupValue(input.name),
        required: input.required,
        identifier: buildIdentifier(input, getGroupLabel(input)),
        groupName: input.name,
        options: [getLabelForElement(input) || input.value],
      });
    } else if (type === 'checkbox') {
      fields.push({
        element: input,
        type: 'checkbox',
        inputType: 'checkbox',
        name: input.name,
        id: input.id,
        label: getLabelForElement(input) || '',
        placeholder: '',
        ariaLabel: input.getAttribute('aria-label') || '',
        dataTestId: input.getAttribute('data-testid') || '',
        currentValue: input.checked ? 'true' : 'false',
        required: input.required,
        identifier: buildIdentifier(input),
      });
    } else {
      fields.push({
        element: input,
        type: 'input',
        inputType: type,
        name: input.name,
        id: input.id,
        label: getLabelForElement(input) || '',
        placeholder: input.placeholder || '',
        ariaLabel: input.getAttribute('aria-label') || '',
        dataTestId: input.getAttribute('data-testid') || '',
        currentValue: input.value,
        required: input.required,
        identifier: buildIdentifier(input),
      });
    }
  }

  // Textareas
  const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea');
  for (const textarea of textareas) {
    if (!isVisible(textarea)) continue;

    fields.push({
      element: textarea,
      type: 'textarea',
      name: textarea.name,
      id: textarea.id,
      label: getLabelForElement(textarea) || '',
      placeholder: textarea.placeholder || '',
      ariaLabel: textarea.getAttribute('aria-label') || '',
      dataTestId: textarea.getAttribute('data-testid') || '',
      currentValue: textarea.value,
      required: textarea.required,
      identifier: buildIdentifier(textarea),
    });
  }

  // Selects
  const selects = document.querySelectorAll<HTMLSelectElement>('select');
  for (const select of selects) {
    if (!isVisible(select)) continue;

    const options = Array.from(select.options)
      .filter((o) => o.value && o.value !== '')
      .map((o) => o.text.trim());

    fields.push({
      element: select,
      type: 'select',
      name: select.name,
      id: select.id,
      label: getLabelForElement(select) || '',
      placeholder: '',
      ariaLabel: select.getAttribute('aria-label') || '',
      dataTestId: select.getAttribute('data-testid') || '',
      currentValue: select.value,
      required: select.required,
      identifier: buildIdentifier(select),
      options,
    });
  }

  return fields;
}

// ============ Label Extraction ============

/**
 * Get label text for an element using multiple strategies
 */
function getLabelForElement(el: HTMLElement): string {
  // Strategy 1: <label for="id">
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return cleanLabel(label.textContent);
  }

  // Strategy 2: Wrapping <label>
  const parentLabel = el.closest('label');
  if (parentLabel) {
    // Get label text excluding the input's own content
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll('input, textarea, select');
    inputs.forEach((i) => i.remove());
    if (clone.textContent?.trim()) return cleanLabel(clone.textContent);
  }

  // Strategy 3: Nearby label/span in parent container
  const parent = el.closest(
    '[class*="field"], [class*="form-group"], [class*="formRow"], [class*="input-group"], .field, .form-field, div, fieldset'
  );
  if (parent) {
    const labelEl = parent.querySelector(
      'label, span[class*="label"], div[class*="label"], .field-label, .form-label'
    );
    if (labelEl && labelEl !== el && labelEl.textContent?.trim()) {
      return cleanLabel(labelEl.textContent);
    }
  }

  // Strategy 4: aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return cleanLabel(ariaLabel);

  // Strategy 5: aria-labelledby
  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const refEl = document.getElementById(ariaLabelledBy);
    if (refEl?.textContent) return cleanLabel(refEl.textContent);
  }

  // Strategy 6: placeholder
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) return cleanLabel(placeholder);

  return '';
}

/**
 * Get label for a radio/checkbox group
 */
function getGroupLabel(el: HTMLElement): string {
  // Try fieldset > legend
  const fieldset = el.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend?.textContent) return cleanLabel(legend.textContent);
  }

  // Try parent container label
  const container = el.closest(
    '[class*="group"], [class*="field"], [role="radiogroup"], [role="group"]'
  );
  if (container) {
    const label = container.querySelector('label, span, div.label, .question-text');
    if (label && !label.querySelector('input')) {
      return cleanLabel(label.textContent || '');
    }
  }

  return getLabelForElement(el);
}

/**
 * Get current value for a radio group
 */
function getRadioGroupValue(name: string): string {
  const checked = document.querySelector<HTMLInputElement>(
    `input[type="radio"][name="${CSS.escape(name)}"]:checked`
  );
  if (checked) {
    return getLabelForElement(checked) || checked.value;
  }
  return '';
}

// ============ Helpers ============

/**
 * Build combined identifier string for matching
 */
function buildIdentifier(el: HTMLElement, extraLabel?: string): string {
  const parts = [
    (el as HTMLInputElement).name,
    el.id,
    (el as HTMLInputElement).placeholder,
    el.getAttribute('aria-label'),
    el.getAttribute('data-testid'),
    el.getAttribute('data-automation-id'),
    el.getAttribute('autocomplete'),
    getLabelForElement(el),
    extraLabel,
  ].filter(Boolean);

  return parts.join(' ').toLowerCase();
}

/**
 * Check if element is visible
 */
function isVisible(el: HTMLElement): boolean {
  if (!el.offsetParent && el.style.position !== 'fixed') return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  return true;
}

/**
 * Clean label text
 */
function cleanLabel(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[*:]/g, '')
    .trim()
    .slice(0, 150);
}
