/**
 * Auto-Filler Engine
 * Fills form fields with user profile data based on fuzzy-matched mappings.
 * Handles inputs, textareas, selects, radio buttons, and checkboxes.
 * Dispatches proper events for React/Angular/Vue compatibility.
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
    await sleep(50);
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
  }
}

/**
 * Fill an input field with proper event simulation
 */
async function fillInputField(el: HTMLInputElement, value: string): Promise<void> {
  el.focus();
  el.value = '';

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
  await sleep(30);
}

/**
 * Fill a textarea field
 */
async function fillTextareaField(el: HTMLTextAreaElement, value: string): Promise<void> {
  el.focus();
  el.value = '';

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
  await sleep(30);
}

/**
 * Fill a select dropdown
 */
async function fillSelectField(el: HTMLSelectElement, value: string): Promise<void> {
  const options = Array.from(el.options);
  const matchedValue = matchSelectOption(options, value);

  if (matchedValue !== null) {
    el.focus();

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
    await sleep(30);
  }
}

/**
 * Fill a radio button group
 */
async function fillRadioField(field: DetectedField, value: string): Promise<void> {
  if (!field.groupName) return;

  const radios = document.querySelectorAll<HTMLInputElement>(
    `input[type="radio"][name="${CSS.escape(field.groupName)}"]`
  );

  const normalizedValue = value.toLowerCase().trim();

  for (const radio of radios) {
    const label = getLabelText(radio).toLowerCase().trim();
    const radioValue = radio.value.toLowerCase().trim();

    // Check for match in label or value
    if (
      label.includes(normalizedValue) ||
      normalizedValue.includes(label) ||
      radioValue.includes(normalizedValue) ||
      normalizedValue.includes(radioValue) ||
      // Boolean matches
      (normalizedValue === 'yes' && (label.includes('yes') || radioValue === 'yes' || radioValue === 'true')) ||
      (normalizedValue === 'no' && (label.includes('no') || radioValue === 'no' || radioValue === 'false'))
    ) {
      radio.focus();
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      radio.dispatchEvent(new Event('click', { bubbles: true }));
      await sleep(30);
      return;
    }
  }
}

/**
 * Fill a checkbox field
 */
async function fillCheckboxField(el: HTMLInputElement, value: string): Promise<void> {
  const normalizedValue = value.toLowerCase().trim();
  const shouldCheck = ['yes', 'true', '1', 'agree', 'accept'].includes(normalizedValue);

  if (shouldCheck !== el.checked) {
    el.focus();
    el.checked = shouldCheck;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('click', { bubbles: true }));
    await sleep(30);
  }
}

// ============ Event Dispatching ============

/**
 * Dispatch all necessary events for framework compatibility
 */
function dispatchInputEvents(el: HTMLElement): void {
  // For React's synthetic event system
  el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

  // For Angular/Vue
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

  // Blur to trigger validation
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

// ============ Helpers ============

function hasExistingValue(field: DetectedField): boolean {
  if (field.type === 'checkbox') return false; // Always allow checkbox toggling
  return !!(field.currentValue && field.currentValue.trim());
}

function getLabelText(el: HTMLElement): string {
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return label.textContent.trim();
  }
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent) return parentLabel.textContent.trim();
  return (el as HTMLInputElement).value || '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
