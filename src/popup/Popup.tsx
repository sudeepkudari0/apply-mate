/**
 * Popup UI — Quick action menu
 * Shows profile status, quick fill, and navigation to side panel / settings.
 */

import React, { useState, useEffect } from 'react';
import { loadUserProfile, profileToFillData, type UserProfile } from '../core/userProfile';

export function Popup() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fillStatus, setFillStatus] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<number | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const p = await loadUserProfile();
    setProfile(p);
  }

  async function handleQuickFill() {
    if (!profile) return;

    setFillStatus('Filling...');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) throw new Error('No active tab');

      // Ensure content script is loaded
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript.js'],
        });
      } catch { /* already loaded */ }
      await new Promise((r) => setTimeout(r, 100));

      const fillData = profileToFillData(profile);
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'FILL_FORM',
        data: fillData,
      });

      if (response.success) {
        const { filled, ambiguous } = response.data;
        setFillStatus(`✅ ${filled} filled, ${ambiguous} needs review`);
      } else {
        throw new Error(response.error);
      }
    } catch (err: any) {
      setFillStatus(`❌ ${err.message}`);
    }

    setTimeout(() => setFillStatus(null), 4000);
  }

  async function handleDetectQuestions() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return;

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript.js'],
        });
      } catch { /* already loaded */ }
      await new Promise((r) => setTimeout(r, 100));

      // First detect JD for context
      const jdResponse = await chrome.tabs.sendMessage(tab.id, { type: 'DETECT_JD' });
      const jdText = jdResponse.success ? jdResponse.data.jd : '';

      // Inject answer buttons
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'INJECT_ANSWER_BUTTONS',
        data: { jdText },
      });

      if (response.success) {
        setQuestionCount(response.data.questionsFound);
      }
    } catch (err: any) {
      console.error('Question detection failed:', err);
    }
  }

  async function openSidePanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
    window.close();
  }

  const isOnboarded = profile?.onboardingComplete;

  return (
    <div style={popupStyles.container}>
      {/* Header */}
      <div style={popupStyles.header}>
        <div style={popupStyles.headerRow}>
          <div style={popupStyles.logoBox}>CV</div>
          <div>
            <div style={popupStyles.title}>ApplyMate</div>
            <div style={popupStyles.version}>v1.0.0</div>
          </div>
        </div>
      </div>

      {/* Profile Status */}
      <div style={popupStyles.section}>
        {isOnboarded ? (
          <div style={popupStyles.statusGood}>
            ✅ Profile: {profile?.fullName}
          </div>
        ) : (
          <div style={popupStyles.statusWarn}>
            ⚠️ Setup required
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={popupStyles.actions}>
        {isOnboarded ? (
          <>
            <button style={popupStyles.actionBtn} onClick={handleQuickFill}>
              📝 Auto-Fill Form
            </button>
            <button style={popupStyles.actionBtn} onClick={handleDetectQuestions}>
              ✨ AI Answer Questions
            </button>
            <button style={popupStyles.actionBtn} onClick={openSidePanel}>
              📄 Open Tailor Panel
            </button>
          </>
        ) : (
          <button
            style={{ ...popupStyles.actionBtn, ...popupStyles.primaryBtn }}
            onClick={() => {
              chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
              window.close();
            }}
          >
            🚀 Complete Setup
          </button>
        )}

        <button
          style={popupStyles.settingsBtn}
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Status Messages */}
      {fillStatus && <div style={popupStyles.status}>{fillStatus}</div>}
      {questionCount !== null && (
        <div style={popupStyles.status}>
          Found {questionCount} question{questionCount !== 1 ? 's' : ''} on page
        </div>
      )}
    </div>
  );
}

const popupStyles: Record<string, React.CSSProperties> = {
  container: {
    width: '280px',
    background: '#1e293b',
    color: '#e2e8f0',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: '13px',
  },
  header: {
    padding: '14px 16px',
    borderBottom: '1px solid #334155',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoBox: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 700,
    fontSize: '12px',
  },
  title: { fontWeight: 600, fontSize: '15px' },
  version: { fontSize: '11px', color: '#64748b' },
  section: {
    padding: '10px 16px',
  },
  statusGood: {
    padding: '8px 10px',
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.2)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#86efac',
  },
  statusWarn: {
    padding: '8px 10px',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#fbbf24',
  },
  actions: {
    padding: '8px 16px 14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  actionBtn: {
    width: '100%',
    padding: '9px 12px',
    background: '#334155',
    color: '#e2e8f0',
    border: '1px solid #475569',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background 0.2s',
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    textAlign: 'center' as const,
  },
  settingsBtn: {
    width: '100%',
    padding: '7px 12px',
    background: 'none',
    color: '#64748b',
    border: 'none',
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'center' as const,
  },
  status: {
    padding: '8px 16px 12px',
    fontSize: '11px',
    color: '#94a3b8',
    textAlign: 'center' as const,
  },
};
