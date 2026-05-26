/**
 * Field Highlighter
 * Injects CSS to visually highlight filled, ambiguous, and unfilled fields.
 * Provides a floating summary badge.
 */

import type { FillResult } from './autoFiller';
import type { DetectedField } from './fieldDetector';
import type { FieldMapping } from './fuzzyMatcher';

const STYLE_ID = 'applymate-field-highlights';
const BADGE_ID = 'applymate-fill-badge';

// ============ CSS Injection ============

/**
 * Inject highlight styles into the page
 */
function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .applymate-filled {
      outline: 2px solid #22c55e !important;
      outline-offset: 1px;
      background-color: rgba(34, 197, 94, 0.05) !important;
      transition: outline-color 0.3s ease, background-color 0.3s ease;
    }
    .applymate-filled:focus {
      outline-color: #16a34a !important;
    }

    .applymate-ambiguous {
      outline: 2px dashed #f59e0b !important;
      outline-offset: 1px;
      background-color: rgba(245, 158, 11, 0.05) !important;
      transition: outline-color 0.3s ease;
    }

    .applymate-unfilled {
      outline: 2px dashed #ef4444 !important;
      outline-offset: 1px;
      background-color: rgba(239, 68, 68, 0.03) !important;
      transition: outline-color 0.3s ease;
    }

    .applymate-field-tooltip {
      position: absolute;
      background: #1e293b;
      color: #e2e8f0;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      z-index: 999999;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    #${BADGE_ID} {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: #e2e8f0;
      padding: 12px 16px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      cursor: pointer;
      transition: transform 0.2s ease, opacity 0.3s ease;
      border: 1px solid rgba(255,255,255,0.1);
    }
    #${BADGE_ID}:hover {
      transform: translateY(-2px);
    }
    #${BADGE_ID} .badge-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #${BADGE_ID} .badge-stats {
      display: flex;
      gap: 12px;
      font-size: 12px;
    }
    #${BADGE_ID} .stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    #${BADGE_ID} .stat-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    #${BADGE_ID} .dot-green { background: #22c55e; }
    #${BADGE_ID} .dot-yellow { background: #f59e0b; }
    #${BADGE_ID} .dot-red { background: #ef4444; }
    #${BADGE_ID} .close-btn {
      position: absolute;
      top: 4px;
      right: 8px;
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 14px;
      cursor: pointer;
      padding: 2px;
    }
    #${BADGE_ID} .close-btn:hover { color: #e2e8f0; }
  `;
  document.head.appendChild(style);
}

// ============ Highlight Fields ============

/**
 * Highlight filled, ambiguous, and unfilled fields on the page
 */
export function highlightFields(
  result: FillResult,
  mappings: FieldMapping[],
  allFields: DetectedField[]
): void {
  injectStyles();

  // Clear previous highlights
  clearHighlights();

  // Mark filled fields
  for (const detail of result.details) {
    const mapping = mappings.find((m) => m.profileKey === detail.profileKey);
    if (!mapping) continue;

    if (detail.status === 'filled') {
      mapping.field.element.classList.add('applymate-filled');
    } else if (detail.status === 'ambiguous') {
      mapping.field.element.classList.add('applymate-ambiguous');
      addTooltip(mapping.field.element, `⚠ Possible: ${detail.profileKey} (low confidence)`);
    }
  }

  // Mark required unfilled fields
  const filledElements = new Set(
    mappings.map((m) => m.field.element)
  );

  for (const field of allFields) {
    if (field.required && !filledElements.has(field.element) && !hasValue(field)) {
      field.element.classList.add('applymate-unfilled');
    }
  }

  // Show summary badge
  showFillBadge(result);
}

/**
 * Clear all highlights from the page
 */
export function clearHighlights(): void {
  document.querySelectorAll('.applymate-filled').forEach((el) => {
    el.classList.remove('applymate-filled');
  });
  document.querySelectorAll('.applymate-ambiguous').forEach((el) => {
    el.classList.remove('applymate-ambiguous');
  });
  document.querySelectorAll('.applymate-unfilled').forEach((el) => {
    el.classList.remove('applymate-unfilled');
  });
  document.querySelectorAll('.applymate-field-tooltip').forEach((el) => el.remove());

  const badge = document.getElementById(BADGE_ID);
  if (badge) badge.remove();
}

// ============ Badge ============

function showFillBadge(result: FillResult): void {
  const existing = document.getElementById(BADGE_ID);
  if (existing) existing.remove();

  const badge = document.createElement('div');
  badge.id = BADGE_ID;
  badge.innerHTML = `
    <button class="close-btn" title="Dismiss">✕</button>
    <div class="badge-title">
      <span>📝</span>
      <span>ApplyMate Auto-Fill</span>
    </div>
    <div class="badge-stats">
      <span class="stat">
        <span class="stat-dot dot-green"></span>
        ${result.filled} filled
      </span>
      <span class="stat">
        <span class="stat-dot dot-yellow"></span>
        ${result.ambiguous} review
      </span>
      <span class="stat">
        <span class="stat-dot dot-red"></span>
        ${result.skipped} skipped
      </span>
    </div>
  `;

  const closeBtn = badge.querySelector('.close-btn');
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearHighlights();
  });

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    badge.style.opacity = '0';
    setTimeout(() => badge.remove(), 300);
  }, 10000);

  document.body.appendChild(badge);
}

// ============ Tooltips ============

function addTooltip(el: HTMLElement, text: string): void {
  const tooltip = document.createElement('div');
  tooltip.className = 'applymate-field-tooltip';
  tooltip.textContent = text;
  tooltip.style.display = 'none';

  document.body.appendChild(tooltip);

  el.addEventListener('mouseenter', () => {
    const rect = el.getBoundingClientRect();
    tooltip.style.top = `${rect.top - 28 + window.scrollY}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.display = 'block';
  });

  el.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });
}

// ============ Helpers ============

function hasValue(field: DetectedField): boolean {
  if (field.type === 'checkbox') return (field.element as HTMLInputElement).checked;
  return !!(field.currentValue && field.currentValue.trim());
}
