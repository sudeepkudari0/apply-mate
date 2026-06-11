/**
 * Answer Injector
 * Adds "Generate AI Answer" buttons next to detected question fields.
 * Communicates with background worker to generate answers via LLM.
 */

import type { DetectedQuestion } from './questionDetector';

const INJECTED_CLASS = 'applymate-answer-injected';
const BUTTON_CLASS = 'applymate-gen-btn';

/**
 * Inject AI answer generation buttons next to detected question fields
 */
export function injectAnswerButtons(
  questions: DetectedQuestion[],
  jdText: string
): void {
  injectAnswerStyles();

  for (const question of questions) {
    // Skip if already injected
    if (question.element.classList.contains(INJECTED_CLASS)) continue;
    // Skip if already has an answer
    if (question.hasExistingAnswer) continue;

    question.element.classList.add(INJECTED_CLASS);

    // Create button container
    const container = document.createElement('div');
    container.className = 'applymate-answer-controls';

    const btn = document.createElement('button');
    btn.className = BUTTON_CLASS;
    btn.innerHTML = '✨ AI Answer';
    btn.title = 'Generate a human-sounding answer using AI';
    btn.type = 'button';

    const statusSpan = document.createElement('span');
    statusSpan.className = 'applymate-gen-status';

    container.appendChild(btn);
    container.appendChild(statusSpan);

    // Insert after textarea
    question.element.parentNode?.insertBefore(
      container,
      question.element.nextSibling
    );

    // Click handler
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      btn.disabled = true;
      btn.innerHTML = '⏳ Generating...';
      statusSpan.textContent = '';

      try {
        const answer = await requestAIAnswer(question.questionText, jdText);

        if (answer) {
          // Respect character limits
          let finalAnswer = answer;
          if (question.maxLength && answer.length > question.maxLength) {
            finalAnswer = answer.slice(0, question.maxLength - 3) + '...';
          }

          // Fill the textarea or contenteditable
          if (question.element instanceof HTMLTextAreaElement) {
            await fillTextarea(question.element, finalAnswer);
          } else {
            // ContentEditable element
            question.element.focus();
            question.element.innerText = finalAnswer;
            question.element.dispatchEvent(new Event('input', { bubbles: true }));
            question.element.dispatchEvent(new Event('change', { bubbles: true }));
          }

          btn.innerHTML = '✅ Done';
          statusSpan.textContent = `${finalAnswer.length} chars`;

          // Show regenerate option
          setTimeout(() => {
            btn.innerHTML = '🔄 Regenerate';
            btn.disabled = false;
          }, 2000);
        }
      } catch (err: any) {
        btn.innerHTML = '❌ Failed';
        statusSpan.textContent = err.message || 'Error';

        setTimeout(() => {
          btn.innerHTML = '✨ AI Answer';
          btn.disabled = false;
        }, 3000);
      }
    });
  }
}

/**
 * Request AI answer from background service worker
 */
async function requestAIAnswer(
  questionText: string,
  jdText: string
): Promise<string> {
  const response = await chrome.runtime.sendMessage({
    type: 'GENERATE_ANSWER',
    data: {
      question: questionText,
      jdText: jdText.slice(0, 3000), // Limit JD size
    },
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to generate answer');
  }

  return response.data;
}

/**
 * Fill textarea with proper event dispatching
 */
async function fillTextarea(
  textarea: HTMLTextAreaElement,
  value: string
): Promise<void> {
  textarea.focus();

  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(textarea, value);
  } else {
    textarea.value = value;
  }

  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  textarea.dispatchEvent(new Event('blur', { bubbles: true }));
}

// ============ Styles ============

function injectAnswerStyles(): void {
  if (document.getElementById('applymate-answer-styles')) return;

  const style = document.createElement('style');
  style.id = 'applymate-answer-styles';
  style.textContent = `
    .applymate-answer-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .${BUTTON_CLASS} {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);
    }

    .${BUTTON_CLASS}:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);
    }

    .${BUTTON_CLASS}:disabled {
      opacity: 0.7;
      cursor: wait;
    }

    .applymate-gen-status {
      font-size: 11px;
      color: #6b7280;
    }
  `;
  document.head.appendChild(style);
}
