/**
 * Content Script for ApplyMate
 * Orchestrates all content-side features:
 * - Job description detection (multi-strategy)
 * - Form field auto-fill with fuzzy matching
 * - Long-form question detection + AI answer injection
 * - Resume PDF auto-upload
 * - Field highlighting
 */

import { detectAllFields } from './fieldDetector';
import { matchFieldsToProfile } from './fuzzyMatcher';
import { fillMatchedFields } from './autoFiller';
import { highlightFields, clearHighlights } from './fieldHighlighter';
import { detectQuestionFields } from './questionDetector';
import { injectAnswerButtons } from './answerInjector';
import { autoUploadResume } from './resumeUploader';

// ============ Message Types ============

interface Message {
  type: string;
  data?: any;
}

interface SchemaJobPosting {
  title?: string;
  company?: string;
  description?: string;
  location?: string;
}

// ============ Message Handler ============

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  console.log('[ApplyMate] Received message:', message.type);
  handleMessage(message, sendResponse);
  return true;
});

async function handleMessage(message: Message, sendResponse: (response: any) => void) {
  try {
    switch (message.type) {
      case 'DETECT_JD': {
        const result = detectJobDescriptionMultiStrategy();
        console.log('[ApplyMate] Detection result:', {
          jdLength: result.jd.length,
          title: result.jobTitle,
          company: result.company,
          method: result.method,
        });
        sendResponse({ success: true, data: result });
        break;
      }

      case 'FILL_FORM': {
        const profileData: Record<string, string> = message.data;
        console.log('[ApplyMate] Auto-filling form with profile data...');

        // Detect all fields
        const fields = detectAllFields();
        console.log('[ApplyMate] Detected', fields.length, 'form fields');

        // Match fields to profile data
        const mappings = matchFieldsToProfile(fields, profileData);
        console.log('[ApplyMate] Matched', mappings.length, 'fields');

        // Fill matched fields
        const fillResult = await fillMatchedFields(mappings, profileData);
        console.log('[ApplyMate] Fill result:', fillResult);

        // Highlight fields
        highlightFields(fillResult, mappings, fields);

        sendResponse({ success: true, data: fillResult });
        break;
      }

      case 'GET_FORM_FIELDS': {
        const fields = detectAllFields();
        const simplified = fields.map((f) => ({
          name: f.name,
          type: f.type + (f.inputType ? `-${f.inputType}` : ''),
          label: f.label,
          value: f.currentValue,
          required: f.required,
        }));
        sendResponse({ success: true, data: simplified });
        break;
      }

      case 'DETECT_QUESTIONS': {
        const questions = detectQuestionFields();
        sendResponse({
          success: true,
          data: questions.map((q) => ({
            questionText: q.questionText,
            maxLength: q.maxLength,
            hasExistingAnswer: q.hasExistingAnswer,
          })),
        });
        break;
      }

      case 'INJECT_ANSWER_BUTTONS': {
        const jdText = message.data?.jdText || '';
        const questions = detectQuestionFields();
        injectAnswerButtons(questions, jdText);
        sendResponse({
          success: true,
          data: { questionsFound: questions.length },
        });
        break;
      }

      case 'UPLOAD_RESUME': {
        const { pdfBase64, fileName } = message.data;
        // Convert base64 to blob
        const byteChars = atob(pdfBase64);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteArray[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        const uploaded = await autoUploadResume(blob, fileName);
        sendResponse({ success: true, data: { uploaded } });
        break;
      }

      case 'CLEAR_HIGHLIGHTS': {
        clearHighlights();
        sendResponse({ success: true });
        break;
      }

      case 'PING': {
        sendResponse({ success: true, data: 'pong' });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error: any) {
    console.error('[ApplyMate] Error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============ JD Detection — Multi-Strategy ============

function detectJobDescriptionMultiStrategy(): {
  jd: string;
  jobTitle: string;
  company: string;
  method: string;
} {
  // Strategy 1: Schema.org JSON-LD (most reliable)
  const schemaResult = detectFromSchemaOrg();
  if (schemaResult && schemaResult.description && schemaResult.description.length > 200) {
    return {
      jd: schemaResult.description,
      jobTitle: schemaResult.title || detectJobTitle() || '',
      company: schemaResult.company || detectCompany() || '',
      method: 'schema_org',
    };
  }

  // Strategy 2: OpenGraph/Meta tags
  const metaResult = detectFromMetaTags();
  if (metaResult.description && metaResult.description.length > 200) {
    return {
      jd: metaResult.description,
      jobTitle: metaResult.title || detectJobTitle() || '',
      company: detectCompany() || '',
      method: 'meta_tags',
    };
  }

  // Strategy 3: CSS Selector-based detection
  const selectorResult = detectFromSelectors();
  const jobInfo = detectJobInfo();

  return {
    jd: selectorResult,
    jobTitle: jobInfo.jobTitle,
    company: jobInfo.company,
    method: 'css_selectors',
  };
}

// ============ Strategy 1: Schema.org ============

function detectFromSchemaOrg(): SchemaJobPosting | null {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      const content = script.textContent;
      if (!content) continue;
      try {
        const data = JSON.parse(content);
        const jobPosting = findJobPosting(data);
        if (jobPosting) {
          return {
            title: extractString(jobPosting.title),
            company: extractCompanyName(jobPosting.hiringOrganization),
            description: cleanHtml(extractString(jobPosting.description) || ''),
            location: extractLocation(jobPosting.jobLocation),
          };
        }
      } catch { continue; }
    }
  } catch (error) {
    console.error('[ApplyMate] Schema.org detection error:', error);
  }
  return null;
}

function findJobPosting(data: any): any | null {
  if (!data) return null;
  if (data['@type'] === 'JobPosting') return data;
  if (Array.isArray(data['@type']) && data['@type'].includes('JobPosting')) return data;
  if (Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      const found = findJobPosting(item);
      if (found) return found;
    }
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJobPosting(item);
      if (found) return found;
    }
  }
  return null;
}

function extractString(value: any): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    return value['@value'] || value.value || value.name;
  }
  return undefined;
}

function extractCompanyName(org: any): string | undefined {
  if (!org) return undefined;
  if (typeof org === 'string') return org;
  return org.name || org.legalName;
}

function extractLocation(location: any): string | undefined {
  if (!location) return undefined;
  if (typeof location === 'string') return location;
  if (location.address) {
    const addr = location.address;
    return [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(', ');
  }
  if (Array.isArray(location)) {
    return location.map((l) => extractLocation(l)).filter(Boolean).join(' | ');
  }
  return location.name;
}

// ============ Strategy 2: Meta Tags ============

function detectFromMetaTags(): { title: string; description: string } {
  const result = { title: '', description: '' };

  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogTitle) result.title = ogTitle.getAttribute('content') || '';
  if (ogDesc) result.description = ogDesc.getAttribute('content') || '';

  if (!result.title) {
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) result.title = twitterTitle.getAttribute('content') || '';
  }
  if (!result.description) {
    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) result.description = twitterDesc.getAttribute('content') || '';
  }
  if (!result.description) {
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) result.description = metaDesc.getAttribute('content') || '';
  }

  return result;
}

// ============ Strategy 3: CSS Selectors ============

function detectFromSelectors(): string {
  const selectors = [
    '[class*="job-description"]', '[class*="job_description"]', '[class*="jobDescription"]',
    '[id*="job-description"]', '[id*="job_description"]', '[data-testid*="description"]',
    '[data-automation-id="jobPostingDescription"]', '.job-posting-section',
    '#content .job-description', '.job-content', '.content-intro',
    '.posting-headline', '[data-qa="job-description"]',
    '.description__text', '.jobs-description', '.jobs-description-content__text',
    '.jobs-box__html-content',
    '#jobDescriptionText', '.jobsearch-jobDescriptionText',
    '.desc', '[data-test="jobDescriptionContent"]',
    '.job-desc', '.jd-desc', '[class*="jd-container"]',
    '.job-description', '#JobDescription',
    '.job_description',
    '#jobDescription',
    '.jobs-overview',
    '.job-sections', '[class*="jobDetails"]',
    '.iCIMS_JobContent',
    '[role="main"]', 'main', 'article',
  ];

  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.length > 200) {
        return cleanText(element.textContent);
      }
    } catch { /* Invalid selector, skip */ }
  }

  // Fallback: large text blocks with job-related keywords
  const mainContent = document.querySelector('main') || document.querySelector('#main') || document.body;
  const allParagraphs = mainContent.querySelectorAll('p, div, section');
  let longestText = '';

  for (const el of allParagraphs) {
    const text = el.textContent || '';
    if (
      text.length > longestText.length && text.length > 500 &&
      (text.toLowerCase().includes('responsibilities') ||
        text.toLowerCase().includes('requirements') ||
        text.toLowerCase().includes('qualifications') ||
        text.toLowerCase().includes('experience'))
    ) {
      longestText = text;
    }
  }

  if (longestText.length > 200) return cleanText(longestText);

  for (const el of allParagraphs) {
    const text = el.textContent || '';
    if (text.length > longestText.length && text.length > 500) {
      longestText = text;
    }
  }

  return cleanText(longestText);
}

// ============ Title & Company Detection ============

function detectJobTitle(): string {
  const selectors = [
    'h1', '[class*="job-title"]', '[class*="jobTitle"]',
    '[data-testid*="title"]', '.posting-headline h2',
    '.jobs-details-top-card__job-title', '.top-card-layout__title',
    '[data-automation-id="jobPostingTitle"]', '.job-title',
  ];

  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el && el.textContent && el.textContent.length > 2 && el.textContent.length < 150) {
        const text = cleanText(el.textContent);
        if (!text.toLowerCase().includes('menu') && !text.toLowerCase().includes('search')) {
          return text;
        }
      }
    } catch { continue; }
  }
  return '';
}

function detectCompany(): string {
  const selectors = [
    '[class*="company-name"]', '[class*="companyName"]',
    '[data-testid*="company"]', '.jobs-details-top-card__company-url',
    '.employer-name', '.top-card-layout__second-subline',
    '[data-automation-id="jobPostingHeader"]',
  ];

  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el && el.textContent && el.textContent.length > 1 && el.textContent.length < 100) {
        return cleanText(el.textContent);
      }
    } catch { continue; }
  }
  return '';
}

function detectJobInfo(): { jobTitle: string; company: string } {
  let jobTitle = detectJobTitle();
  let company = detectCompany();

  if (!jobTitle || !company) {
    const pageTitle = document.title;
    const match = pageTitle.match(/^(.+?)\s+(?:at|@|-|–|—|\|)\s+(.+?)(?:\s+[-|]|$)/i);
    if (match) {
      if (!jobTitle) jobTitle = match[1].trim();
      if (!company) company = match[2].trim();
    }
  }

  return { jobTitle, company };
}

// ============ Text Helpers ============

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
}

function cleanHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('script, style').forEach((s) => s.remove());
  return cleanText(div.textContent || '');
}

// ============ Boot ============

console.log('[ApplyMate] Content script loaded on:', window.location.hostname);
