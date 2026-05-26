/**
 * Background Service Worker
 * Handles extension lifecycle, message routing, and cross-component communication.
 * Supports: config management, user profile CRUD, AI answer generation.
 */

import { ConfigManager } from './configManager';
import {
  loadUserProfile,
  saveUserProfile,
  isOnboardingComplete,
} from '../core/userProfile';
import { AnswerGenerator } from '../core/answerGenerator';
import { createProvider } from '../models/providers/factory';

// ============ Extension Lifecycle ============

chrome.runtime.onInstalled.addListener((details) => {
  console.log('ApplyMate extension installed:', details.reason);

  // Open onboarding page on first install
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});

// Handle action click - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    // Check if onboarding is complete
    const onboarded = await isOnboardingComplete();
    if (!onboarded) {
      chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
      return;
    }
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ============ Message Handler ============

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message: any, sendResponse: (response: any) => void) {
  const configManager = ConfigManager.getInstance();

  try {
    switch (message.type) {
      // ===== Config Messages =====
      case 'GET_CONFIG': {
        const config = await configManager.getConfig();
        sendResponse({ success: true, data: config });
        break;
      }

      case 'SAVE_CONFIG': {
        await configManager.saveConfig(message.data);
        sendResponse({ success: true });
        break;
      }

      case 'GET_PROVIDER_CONFIG': {
        const providerConfig = await configManager.getProviderConfig();
        sendResponse({ success: true, data: providerConfig });
        break;
      }

      case 'IS_CONFIGURED': {
        const isConfigured = await configManager.isConfigured();
        sendResponse({ success: true, data: isConfigured });
        break;
      }

      // ===== Profile Messages =====
      case 'GET_PROFILE': {
        const profile = await loadUserProfile();
        sendResponse({ success: true, data: profile });
        break;
      }

      case 'SAVE_PROFILE': {
        await saveUserProfile(message.data);
        sendResponse({ success: true });
        break;
      }

      case 'IS_ONBOARDED': {
        const onboarded = await isOnboardingComplete();
        sendResponse({ success: true, data: onboarded });
        break;
      }

      // ===== AI Answer Generation =====
      case 'GENERATE_ANSWER': {
        const { question, jdText } = message.data;

        // Get provider config
        const providerConfig = await configManager.getProviderConfig();
        const provider = await createProvider(providerConfig);

        // Get user profile for context
        const profile = await loadUserProfile();
        const profileSummary = AnswerGenerator.buildProfileSummary(profile);

        // Generate answer
        const generator = new AnswerGenerator(provider);
        const answer = await generator.generateAnswer(
          question,
          jdText,
          profileSummary,
          message.data.maxLength
        );

        sendResponse({ success: true, data: answer });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error: any) {
    console.error('[ApplyMate] Background error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

export {};
