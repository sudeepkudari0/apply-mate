/**
 * Auto-Filler Engine — Enhanced
 * Fills form fields with user profile data based on fuzzy-matched mappings.
 * Handles: inputs, textareas, selects, radio buttons, checkboxes,
 * ARIA comboboxes (Workday/Greenhouse/Lever), and contenteditable divs.
 * Dispatches proper events for React/Angular/Vue/Lit compatibility.
 */

import type { DetectedField } from './fieldDetector';
import type { FieldMapping } from './fuzzyMatcher';
import { matchSelectOption } from './fuzzyMatcher';

export interface FillResult {
  filled: number;
  skipped: number;
  ambiguous: number;
  details: FillDetail[];
}

export interface FillDetail {
  fieldLabel: string;
  profileKey: string;
  status: 'filled' | 'skipped' | 'ambiguous' | 'error';
  confidence: 'high' | 'medium' | 'low';
  reason?: string;
}

/**
 * Fill all matched fields with profile data
 */
export async function fillMatchedFields(
  mappings: FieldMapping[],
  profileData: Record<string, string>
): Promise<FillResult> {
  const result: FillResult = {
    filled: 0,
    skipped: 0,
    ambiguous: 0,
    details: [],
  };

  for (const mapping of mappings) {
    const { field, profileKey, confidence } = mapping;
    const value = profileData[profileKey];

    if (!value) {
      result.skipped++;
      result.details.push({
        fieldLabel: field.label || field.name || field.id,
        profileKey,
        status: 'skipped',
        confidence,
        reason: 'No profile data for this field',
      });
      continue;
    }

    // Skip fields that already have values
    if (hasExistingValue(field)) {
      result.skipped++;
      result.details.push({
        fieldLabel: field.label || field.name || field.id,
        profileKey,
        status: 'skipped',
        confidence,
        reason: 'Field already has a value',
      });
      continue;
    }

    // Low confidence = ambiguous, mark but don't auto-fill
    if (confidence === 'low') {
      result.ambiguous++;
      result.details.push({
        fieldLabel: field.label || field.name || field.id,
        profileKey,
        status: 'ambiguous',
        confidence,
        reason: 'Low confidence match — needs review',
      });
      continue;
    }

    try {
      await fillField(field, value);
      result.filled++;
      result.details.push({
        fieldLabel: field.label || field.name || field.id,
        profileKey,
        status: 'filled',
        confidence,
      });
    } catch (err: any) {
      result.details.push({
        fieldLabel: field.label || field.name || field.id,
        profileKey,
        status: 'error',
        confidence,
        reason: err.message,
      });
    }

    // Small delay between fields for framework reactivity
    await sleep(80);
  }

  return result;
}

// ============ Field Filling Logic ============

/**
 * Fill a single field based on its type
 */
async function fillField(field: DetectedField, value: string): Promise<void> {
  switch (field.type) {
    case 'input':
      await fillInputField(field.element as HTMLInputElement, value);
      break;
    case 'textarea':
      await fillTextareaField(field.element as HTMLTextAreaElement, value);
      break;
    case 'select':
      await fillSelectField(field.element as HTMLSelectElement, value);
      break;
    case 'radio':
      await fillRadioField(field, value);
      break;
    case 'checkbox':
      await fillCheckboxField(field.element as HTMLInputElement, value);
      break;
    case 'combobox':
      await fillComboboxField(field, value);
      break;
    case 'contenteditable':
      await fillContentEditableField(field.element, value);
      break;
  }
}

/**
 * Fill an input field with proper event simulation
 */
async function fillInputField(el: HTMLInputElement, value: string): Promise<void> {
  el.focus();
  await sleep(20);

  // Use native setter for React compatibility
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }

  dispatchInputEvents(el);
  await sleep(50);
}

/**
 * Fill a textarea field
 */
async function fillTextareaField(el: HTMLTextAreaElement, value: string): Promise<void> {
  el.focus();
  await sleep(20);

  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }

  dispatchInputEvents(el);
  await sleep(50);
}

/**
 * Fill a select dropdown
 */
async function fillSelectField(el: HTMLSelectElement, value: string): Promise<void> {
  const options = Array.from(el.options);
  const matchedValue = matchSelectOption(options, value);

  if (matchedValue !== null) {
    el.focus();
    await sleep(20);

    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(el, matchedValue);
    } else {
      el.value = matchedValue;
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);
  }
}

/**
 * Fill a radio button group
 */
async function fillRadioField(field: DetectedField, value: string): Promise<void> {
  if (!field.groupName) return;

  const root = field.ownerRoot || document;
  const radios = root.querySelectorAll<HTMLInputElement>(
    `input[type="radio"][name="${CSS.escape(field.groupName)}"]`
  );

  const normalizedValue = value.toLowerCase().trim();

  for (const radio of radios) {
    const label = getLabelText(radio, root).toLowerCase().trim();
    const radioValue = radio.value.toLowerCase().trim();

    // Check for match in label or value
    if (
      label.includes(normalizedValue) ||
      normalizedValue.includes(label) ||
      radioValue.includes(normalizedValue) ||
      normalizedValue.includes(radioValue) ||
      // Boolean matches
      (normalizedValue === 'yes' && (label.includes('yes') || radioValue === 'yes' || radioValue === 'true' || radioValue === '1')) ||
      (normalizedValue === 'no' && (label.includes('no') || radioValue === 'no' || radioValue === 'false' || radioValue === '0')) ||
      // Affirmative/Negative patterns
      (['yes', 'true', '1', 'agree'].includes(normalizedValue) && ['yes', 'true', '1', 'agree'].includes(radioValue)) ||
      (['no', 'false', '0', 'disagree'].includes(normalizedValue) && ['no', 'false', '0', 'disagree'].includes(radioValue))
    ) {
      radio.focus();
      await sleep(20);
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      radio.dispatchEvent(new Event('click', { bubbles: true }));
      radio.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(50);
      return;
    }
  }
}

/**
 * Fill a checkbox field
 */
async function fillCheckboxField(el: HTMLInputElement, value: string): Promise<void> {
  const normalizedValue = value.toLowerCase().trim();
  const shouldCheck = ['yes', 'true', '1', 'agree', 'accept', 'acknowledged'].includes(normalizedValue);

  if (shouldCheck !== el.checked) {
    el.focus();
    await sleep(20);
    el.checked = shouldCheck;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('click', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);
  }
}

/**
 * Fill an ARIA combobox / custom dropdown
 * This is the tricky one — we simulate typing + option selection
 */
async function fillComboboxField(field: DetectedField, value: string): Promise<void> {
  const el = field.element;

  // Find the actual input element inside the combobox
  const input = el.tagName === 'INPUT'
    ? el as HTMLInputElement
    : el.querySelector('input') as HTMLInputElement | null;

  if (input) {
    // Step 1: Focus and clear
    input.focus();
    await sleep(50);

    // Set value using native setter for React compatibility
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }

    // Step 2: Dispatch events to trigger dropdown opening
    dispatchInputEvents(input);
    await sleep(200);

    // Step 3: Try to find and click the matching option in the opened dropdown
    const selected = await selectComboboxOption(field, value);

    if (!selected) {
      // Fallback: dispatch Enter to confirm the typed value
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      await sleep(50);
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    }

    await sleep(100);
  } else {
    // No inner input — try clicking the element to open dropdown, then select
    el.click();
    await sleep(200);
    await selectComboboxOption(field, value);
  }
}

/**
 * Try to find and click a matching option in a combobox's dropdown
 */
async function selectComboboxOption(field: DetectedField, value: string): Promise<boolean> {
  const normalizedValue = value.toLowerCase().trim();
  const root = field.ownerRoot || document;

  // Strategy 1: Find listbox by aria-controls ID
  let listbox: HTMLElement | null = null;
  if (field.listboxId) {
    listbox = root.getElementById?.(field.listboxId) as HTMLElement || document.getElementById(field.listboxId);
  }

  // Strategy 2: Find any visible listbox on the page
  if (!listbox) {
    const listboxes = document.querySelectorAll<HTMLElement>('[role="listbox"], [role="menu"]');
    for (const lb of listboxes) {
      if (lb.offsetParent || getComputedStyle(lb).display !== 'none') {
        listbox = lb;
        break;
      }
    }
  }

  // Strategy 3: Find generic dropdown containers
  if (!listbox) {
    const dropdownSelectors = [
      '.select2-results', '.css-26l3qy-menu', '[class*="menu-list"]',
      '[class*="dropdown-menu"]', '[class*="listbox"]',
      '.MuiAutocomplete-popper', '.ant-select-dropdown',
      '[class*="select__menu"]', // React-Select
    ];
    for (const sel of dropdownSelectors) {
      const found = document.querySelector<HTMLElement>(sel);
      if (found && found.offsetParent) {
        listbox = found;
        break;
      }
    }
  }

  if (!listbox) return false;

  // Find all options
  const options = listbox.querySelectorAll<HTMLElement>(
    '[role="option"], li, [class*="option"], [class*="menu-item"]'
  );

  let bestMatch: HTMLElement | null = null;
  let bestScore = 0;

  for (const option of options) {
    const text = option.textContent?.trim().toLowerCase() || '';
    const optionValue = option.getAttribute('data-value')?.toLowerCase() || '';

    // Exact match
    if (text === normalizedValue || optionValue === normalizedValue) {
      bestMatch = option;
      bestScore = 100;
      break;
    }

    // Contains match
    if (text.includes(normalizedValue) || normalizedValue.includes(text)) {
      const score = Math.min(text.length, normalizedValue.length) / Math.max(text.length, normalizedValue.length) * 80;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = option;
      }
    }
  }

  if (bestMatch && bestScore > 30) {
    bestMatch.click();
    await sleep(100);

    // Also dispatch mousedown/mouseup for frameworks that listen to those
    bestMatch.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(20);
    bestMatch.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    return true;
  }

  return false;
}

/**
 * Fill a contenteditable div (rich text editor)
 */
async function fillContentEditableField(el: HTMLElement, value: string): Promise<void> {
  el.focus();
  await sleep(30);

  // Clear existing content
  el.innerHTML = '';
  await sleep(20);

  // Set content — use innerText to avoid HTML injection
  el.innerText = value;

  // Dispatch events for framework compatibility
  el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));

  // For Quill, Draft.js, ProseMirror — also try execCommand
  try {
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, value);
  } catch { /* Not supported in all contexts */ }

  await sleep(50);
}

// ============ Event Dispatching ============

/**
 * Dispatch all necessary events for framework compatibility
 * Uses InputEvent constructor for better React 17+ support
 */
function dispatchInputEvents(el: HTMLElement): void {
  // InputEvent (preferred by React 17+, Angular)
  try {
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
    }));
  } catch {
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  }

  // Change event
  el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

  // Keyboard events for Angular/Vue watchers
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
  el.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: 'a' }));
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));

  // Composition events for frameworks that listen to IME
  el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));

  // Blur to trigger validation
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

// ============ Helpers ============

function hasExistingValue(field: DetectedField): boolean {
  if (field.type === 'checkbox') return false; // Always allow checkbox toggling
  return !!(field.currentValue && field.currentValue.trim());
}

function getLabelText(el: HTMLElement, root: Document | ShadowRoot = document): string {
  if (el.id) {
    const label = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return label.textContent.trim();
  }
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent) return parentLabel.textContent.trim();
  return (el as HTMLInputElement).value || '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
