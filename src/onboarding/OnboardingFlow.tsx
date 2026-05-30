/**
 * Onboarding Flow — Multi-step wizard
 * Parses CV first, auto-fills profile details, and allows user verification.
 * Steps: Upload CV & Parse → Basic Info → Experience → Preferences
 */

import React, { useState, useEffect, useRef } from 'react';
import yaml from 'js-yaml';
import {
  loadUserProfile,
  saveUserProfile,
  profileFromMasterResume,
  type UserProfile,
  type UserEducation,
  DEFAULT_PROFILE,
} from '../core/userProfile';
import { type ExtensionConfig } from '../background/configManager';
import { createProvider } from '../models/providers/factory';
import { PROMPTS } from '../models/prompts';
import { extractTextFromPdf } from '../core/pdfParser';

type Step = 'resume' | 'basic' | 'experience' | 'preferences';

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'resume', label: 'Upload CV', icon: '📄' },
  { key: 'basic', label: 'Basic Info', icon: '👤' },
  { key: 'experience', label: 'Experience', icon: '💼' },
  { key: 'preferences', label: 'Preferences', icon: '⚙️' },
];

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState<Step>('resume');
  const [profile, setProfile] = useState<UserProfile>({ ...DEFAULT_PROFILE });
  const [config, setConfig] = useState<ExtensionConfig>({
    provider: 'gemini',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModelId: 'qwen3:4b',
    groqApiKey: '',
    groqModelId: 'llama-3.3-70b-versatile',
    geminiApiKey: '',
    geminiModelId: 'gemini-1.5-flash',
    masterResumeYaml: '',
    masterResumeText: '',
  });

  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importedFromYaml, setImportedFromYaml] = useState(false);

  useEffect(() => {
    loadExistingData();
  }, []);

  async function loadExistingData() {
    // Load existing profile
    const existing = await loadUserProfile();
    if (existing.fullName) {
      setProfile(existing);
    }

    // Load existing config
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
      if (response.success && response.data) {
        setConfig((prev) => ({ ...prev, ...response.data }));
        
        // If they already have a masterResumeYaml, let's prefill
        if (response.data.masterResumeYaml && !existing.fullName) {
          const parsed = yaml.load(response.data.masterResumeYaml);
          const prefilled = profileFromMasterResume(parsed);
          setProfile((prev) => ({ ...prev, ...prefilled }));
          setImportedFromYaml(true);
        }
      }
    } catch {
      // Ignore
    }
  }

  function updateProfile(updates: Partial<UserProfile>) {
    setProfile((prev) => ({ ...prev, ...updates }));
  }

  function updateConfig(updates: Partial<ExtensionConfig>) {
    setConfig((prev) => ({ ...prev, ...updates }));
  }

  function nextStep() {
    const idx = STEPS.findIndex((s) => s.key === currentStep);
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1].key);
    }
  }

  function prevStep() {
    const idx = STEPS.findIndex((s) => s.key === currentStep);
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1].key);
    }
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      await saveUserProfile({ ...profile, onboardingComplete: true });
      // Close the onboarding tab
      window.close();
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleParseCV(file: File | null, rawText: string, useTextMode: boolean) {
    setParsing(true);
    setError(null);
    setParseSuccess(false);

    try {
      // Validate provider credentials first
      if (config.provider === 'gemini' && !config.geminiApiKey) {
        throw new Error('Please enter your Gemini API key');
      }
      if (config.provider === 'groq' && !config.groqApiKey) {
        throw new Error('Please enter your Groq API key');
      }
      if (config.provider === 'ollama' && (!config.ollamaBaseUrl || !config.ollamaModelId)) {
        throw new Error('Please enter your Ollama Base URL and Model ID');
      }

      let textToParse = '';

      if (useTextMode) {
        if (!rawText.trim()) {
          throw new Error('Please paste your resume text');
        }
        textToParse = rawText;
      } else {
        if (!file) {
          throw new Error('Please upload a PDF file');
        }
        setLoadingStatus('Extracting text from PDF...');
        const arrayBuffer = await file.arrayBuffer();
        textToParse = await extractTextFromPdf(arrayBuffer);
      }

      setLoadingStatus('Connecting to AI model...');
      const providerConfig = {
        provider: config.provider,
        apiKey: config.provider === 'gemini' ? config.geminiApiKey : config.groqApiKey,
        modelId: config.provider === 'gemini' ? config.geminiModelId : config.groqModelId,
        baseUrl: config.ollamaBaseUrl,
      };

      const providerInstance = await createProvider(providerConfig);
      
      setLoadingStatus('Analyzing and parsing CV with AI...');
      const prompt = PROMPTS.parse_resume.user(textToParse);
      const system = PROMPTS.parse_resume.system;

      const response = await providerInstance.generate(prompt, {
        systemPrompt: system,
        temperature: 0.1,
        forceJson: true,
      });

      setLoadingStatus('Formatting parsed profile...');
      let cleanContent = response.content.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }
      
      const parsedData = JSON.parse(cleanContent);
      
      // Update local profile state
      const parsedProfile = parsedData.profile || {};
      const updatedProfile = {
        ...profile,
        ...parsedProfile,
        ...(file && !useTextMode && {
          resumeFileName: file.name,
        }),
      };

      // Read PDF to base64 if uploaded
      if (file && !useTextMode) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
          reader.onerror = () => reject(new Error('Failed to read PDF file'));
          reader.readAsDataURL(file);
        });
        updatedProfile.resumePdfBase64 = base64;
      }

      setProfile(updatedProfile);

      // Serialize masterResume structure to YAML
      const masterResumeData = parsedData.masterResume || {};
      const yamlStr = yaml.dump(masterResumeData);
      
      // Save settings to ExtensionConfig
      const updatedConfig = {
        ...config,
        masterResumeYaml: yamlStr,
        masterResumeText: textToParse,
      };
      
      setConfig(updatedConfig);
      
      // Save profile and config to storage
      await saveUserProfile(updatedProfile);
      await chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', data: updatedConfig });

      setParseSuccess(true);
      setImportedFromYaml(true);
      setError(null);
      
      // Automatically advance to the next step after a short delay
      setTimeout(() => {
        setCurrentStep('basic');
      }, 1500);

    } catch (err: any) {
      console.error('[Onboarding] Parse error:', err);
      setError(err.message || 'Failed to parse resume. Please check your API key/settings and try again.');
    } finally {
      setParsing(false);
      setLoadingStatus('');
    }
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const isLastStep = currentStepIndex === STEPS.length - 1;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>✨</div>
          <h1 style={styles.title}>ApplyMate Setup</h1>
          <p style={styles.subtitle}>Get started by uploading your CV to auto-fill your application details</p>
        </div>

        {/* Import notice */}
        {importedFromYaml && currentStep === 'basic' && (
          <div style={styles.notice}>
            ✨ Pre-filled from your parsed CV. Please review and verify the details.
          </div>
        )}

        {/* Progress */}
        <div style={styles.progressBar}>
          {STEPS.map((step, i) => (
            <div
              key={step.key}
              style={{
                ...styles.progressStep,
                ...(i <= currentStepIndex ? styles.progressActive : {}),
              }}
              onClick={() => setCurrentStep(step.key)}
            >
              <span style={styles.progressIcon}>{step.icon}</span>
              <span style={styles.progressLabel}>{step.label}</span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div style={styles.stepContent}>
          {currentStep === 'resume' && (
            <ResumeUploadAndParseStep
              profile={profile}
              config={config}
              onChange={updateProfile}
              onConfigChange={updateConfig}
              onParse={handleParseCV}
              parsing={parsing}
              parseSuccess={parseSuccess}
              loadingStatus={loadingStatus}
            />
          )}
          {currentStep === 'basic' && (
            <BasicInfoStep profile={profile} onChange={updateProfile} />
          )}
          {currentStep === 'experience' && (
            <ExperienceStep profile={profile} onChange={updateProfile} />
          )}
          {currentStep === 'preferences' && (
            <PreferencesStep profile={profile} onChange={updateProfile} />
          )}
        </div>

        {/* Error */}
        {error && <div style={styles.error}>⚠️ {error}</div>}

        {/* Navigation */}
        <div style={styles.nav}>
          <button
            style={{ ...styles.btn, ...styles.btnSecondary }}
            onClick={prevStep}
            disabled={currentStepIndex === 0 || parsing}
          >
            ← Back
          </button>
          
          {currentStep === 'resume' && (
            <button
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={() => setCurrentStep('basic')}
              disabled={parsing}
            >
              Skip & Fill Manually →
            </button>
          )}

          {currentStep !== 'resume' && (
            isLastStep ? (
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? 'Saving...' : '✅ Finish Setup'}
              </button>
            ) : (
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={nextStep}
              >
                Next →
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Onboarding Step Components ============

interface ResumeUploadAndParseProps {
  profile: UserProfile;
  config: ExtensionConfig;
  onChange: (u: Partial<UserProfile>) => void;
  onConfigChange: (c: Partial<ExtensionConfig>) => void;
  onParse: (file: File | null, rawText: string, useTextMode: boolean) => Promise<void>;
  parsing: boolean;
  parseSuccess: boolean;
  loadingStatus: string;
}

function ResumeUploadAndParseStep({
  profile,
  config,
  onConfigChange,
  onParse,
  parsing,
  parseSuccess,
  loadingStatus,
}: ResumeUploadAndParseProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [useTextMode, setUseTextMode] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setLocalError(null);

    if (!selectedFile.type.includes('pdf')) {
      setLocalError('Please upload a PDF file');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setLocalError('File too large. Maximum size is 5MB.');
      return;
    }

    setFile(selectedFile);
  }

  function handleStartParse() {
    onParse(file, rawText, useTextMode);
  }

  return (
    <div style={styles.fields}>
      {/* AI Provider Config Section */}
      <div style={styles.sectionTitle}>🤖 Step 1: Configure AI Provider</div>
      <p style={{ ...styles.hint, color: '#94a3b8', fontSize: '12px', margin: '0 0 10px 0' }}>
        Select your AI model provider and enter your API credentials. This will be used to parse your CV and tailor your job applications.
      </p>

      {/* Provider Selector */}
      <div style={styles.providerGrid}>
        {(['gemini', 'groq', 'ollama'] as const).map((p) => {
          const active = config.provider === p;
          const info = {
            gemini: { icon: '✨', label: 'Gemini', desc: 'Google AI (Free/Fast)' },
            groq: { icon: '⚡', label: 'Groq', desc: 'Fast & Free APIs' },
            ollama: { icon: '🦙', label: 'Ollama', desc: 'Local LLM' },
          }[p];

          return (
            <div
              key={p}
              style={{
                ...styles.providerCard,
                ...(active ? styles.providerCardActive : {}),
              }}
              onClick={() => onConfigChange({ provider: p })}
            >
              <span style={styles.providerIcon}>{info.icon}</span>
              <div style={styles.providerName}>{info.label}</div>
              <div style={styles.providerDesc}>{info.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Provider Settings Fields */}
      <div style={styles.providerConfigFields}>
        {config.provider === 'gemini' && (
          <div style={styles.fieldGroup}>
            <div style={styles.inputWithLink}>
              <label style={styles.label}>Gemini API Key</label>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={styles.helperLink}>
                Get Key ↗
              </a>
            </div>
            <input
              style={styles.input}
              type="password"
              value={config.geminiApiKey}
              onChange={(e) => onConfigChange({ geminiApiKey: e.target.value })}
              placeholder="Paste AIzaSy... API Key"
            />
          </div>
        )}

        {config.provider === 'groq' && (
          <div style={styles.fieldGroup}>
            <div style={styles.inputWithLink}>
              <label style={styles.label}>Groq API Key</label>
              <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={styles.helperLink}>
                Get Key ↗
              </a>
            </div>
            <input
              style={styles.input}
              type="password"
              value={config.groqApiKey}
              onChange={(e) => onConfigChange({ groqApiKey: e.target.value })}
              placeholder="Paste gsk_... API Key"
            />
          </div>
        )}

        {config.provider === 'ollama' && (
          <div style={styles.row}>
            <div style={{ ...styles.fieldGroup, flex: 2 }}>
              <label style={styles.label}>Ollama URL</label>
              <input
                style={styles.input}
                value={config.ollamaBaseUrl}
                onChange={(e) => onConfigChange({ ollamaBaseUrl: e.target.value })}
                placeholder="http://localhost:11434"
              />
            </div>
            <div style={{ ...styles.fieldGroup, flex: 1.5 }}>
              <label style={styles.label}>Model ID</label>
              <input
                style={styles.input}
                value={config.ollamaModelId}
                onChange={(e) => onConfigChange({ ollamaModelId: e.target.value })}
                placeholder="qwen3:4b"
              />
            </div>
          </div>
        )}
      </div>

      {/* CV Data Section */}
      <div style={{ ...styles.sectionTitle, marginTop: '16px' }}>📄 Step 2: Provide your CV</div>

      {/* Tab select between PDF upload and Text Paste */}
      <div style={styles.tabHeader}>
        <button
          style={{
            ...styles.tabBtn,
            ...(!useTextMode ? styles.tabBtnActive : {}),
          }}
          onClick={() => setUseTextMode(false)}
        >
          📁 Upload PDF
        </button>
        <button
          style={{
            ...styles.tabBtn,
            ...(useTextMode ? styles.tabBtnActive : {}),
          }}
          onClick={() => setUseTextMode(true)}
        >
          ✍️ Paste Text
        </button>
      </div>

      {/* PDF Upload Mode */}
      {!useTextMode && (
        <div style={styles.fieldGroup}>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div
            style={{
              ...styles.dropzone,
              ...(file ? styles.dropzoneActive : {}),
            }}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
            {file ? (
              <div>
                <span style={{ fontWeight: 600, color: '#86efac' }}>{file.name}</span>
                <p style={styles.hint}>{Math.round(file.size / 1024)} KB • Click to replace</p>
              </div>
            ) : (
              <div>
                <span style={{ fontWeight: 500, color: '#cbd5e1' }}>Click to choose your CV (PDF)</span>
                <p style={styles.hint}>Supported size: up to 5MB</p>
              </div>
            )}
          </div>
          {localError && <div style={styles.error}>{localError}</div>}
        </div>
      )}

      {/* Plain Text Mode */}
      {useTextMode && (
        <div style={styles.fieldGroup}>
          <textarea
            style={{ ...styles.input, height: '140px', fontFamily: 'monospace', fontSize: '12px' }}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste your complete resume text here (copy and paste from your PDF)..."
          />
        </div>
      )}

      {/* Parse Trigger Button */}
      <button
        style={{
          ...styles.btn,
          ...styles.btnPrimary,
          marginTop: '12px',
          padding: '14px',
          fontSize: '15px',
          fontWeight: 600,
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
        }}
        onClick={handleStartParse}
        disabled={parsing || parseSuccess || (!file && !useTextMode) || (useTextMode && !rawText.trim())}
      >
        {parsing ? (
          <span style={styles.spinnerWrapper}>
            <span style={styles.spinner}></span>
            {loadingStatus || 'Parsing CV...'}
          </span>
        ) : parseSuccess ? (
          '✅ CV Parsed! Redirecting...'
        ) : (
          '✨ Save Config & Parse CV'
        )}
      </button>

      {/* Parse success details snapshot */}
      {profile.fullName && parseSuccess && (
        <div style={styles.successBadge}>
          <strong>Successfully auto-filled:</strong>
          <div style={{ marginTop: '6px', fontSize: '12px', color: '#cbd5e1' }}>
            👤 Name: {profile.fullName} | ✉️ Email: {profile.email} | 🎓 Education: {profile.education[0]?.degree || 'None'}
          </div>
        </div>
      )}
    </div>
  );
}

function BasicInfoStep({
  profile,
  onChange,
}: {
  profile: UserProfile;
  onChange: (u: Partial<UserProfile>) => void;
}) {
  return (
    <div style={styles.fields}>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Full Name *</label>
        <input
          style={styles.input}
          value={profile.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          placeholder="John Doe"
        />
      </div>
      <div style={styles.row}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Email *</label>
          <input
            style={styles.input}
            type="email"
            value={profile.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="john@email.com"
          />
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Phone *</label>
          <input
            style={styles.input}
            type="tel"
            value={profile.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+1 555-123-4567"
          />
        </div>
      </div>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Location</label>
        <input
          style={styles.input}
          value={profile.location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="Bangalore, India"
        />
      </div>
      <div style={styles.row}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>LinkedIn URL</label>
          <input
            style={styles.input}
            type="url"
            value={profile.linkedinUrl}
            onChange={(e) => onChange({ linkedinUrl: e.target.value })}
            placeholder="https://linkedin.com/in/..."
          />
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>GitHub URL</label>
          <input
            style={styles.input}
            type="url"
            value={profile.githubUrl}
            onChange={(e) => onChange({ githubUrl: e.target.value })}
            placeholder="https://github.com/..."
          />
        </div>
      </div>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Portfolio URL</label>
        <input
          style={styles.input}
          type="url"
          value={profile.portfolioUrl}
          onChange={(e) => onChange({ portfolioUrl: e.target.value })}
          placeholder="https://yoursite.com"
        />
      </div>
    </div>
  );
}

function ExperienceStep({
  profile,
  onChange,
}: {
  profile: UserProfile;
  onChange: (u: Partial<UserProfile>) => void;
}) {
  function addEducation() {
    onChange({
      education: [...profile.education, { degree: '', college: '', year: '' }],
    });
  }

  function updateEducation(idx: number, field: keyof UserEducation, value: string) {
    const updated = [...profile.education];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ education: updated });
  }

  function removeEducation(idx: number) {
    onChange({ education: profile.education.filter((_, i) => i !== idx) });
  }

  return (
    <div style={styles.fields}>
      <div style={styles.row}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Total Years of Experience *</label>
          <input
            style={styles.input}
            type="number"
            min="0"
            value={profile.totalYearsExperience || ''}
            onChange={(e) =>
              onChange({ totalYearsExperience: parseInt(e.target.value) || 0 })
            }
            placeholder="3"
          />
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Current Role</label>
          <input
            style={styles.input}
            value={profile.currentRole}
            onChange={(e) => onChange({ currentRole: e.target.value })}
            placeholder="Software Developer"
          />
        </div>
      </div>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Current Company</label>
        <input
          style={styles.input}
          value={profile.currentCompany}
          onChange={(e) => onChange({ currentCompany: e.target.value })}
          placeholder="Acme Corp"
        />
      </div>

      {/* Education */}
      <div style={styles.sectionTitle}>🎓 Education</div>
      {profile.education.map((edu, idx) => (
        <div key={idx} style={styles.eduRow}>
          <input
            style={{ ...styles.input, flex: 2 }}
            value={edu.degree}
            onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
            placeholder="B.Tech in CS"
          />
          <input
            style={{ ...styles.input, flex: 2 }}
            value={edu.college}
            onChange={(e) => updateEducation(idx, 'college', e.target.value)}
            placeholder="University Name"
          />
          <input
            style={{ ...styles.input, flex: 1 }}
            value={edu.year}
            onChange={(e) => updateEducation(idx, 'year', e.target.value)}
            placeholder="2023"
          />
          <button
            style={styles.removeBtn}
            onClick={() => removeEducation(idx)}
            title="Remove"
          >
            ✕
          </button>
        </div>
      ))}
      <button style={styles.addBtn} onClick={addEducation}>
        + Add Education
      </button>

      {/* Skills */}
      <div style={styles.sectionTitle}>🛠 Top Skills (5-8)</div>
      <input
        style={styles.input}
        value={profile.topSkills.join(', ')}
        onChange={(e) =>
          onChange({
            topSkills: e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        placeholder="TypeScript, React, Node.js, AWS, PostgreSQL"
      />
      <p style={styles.hint}>Comma-separated</p>
    </div>
  );
}

function PreferencesStep({
  profile,
  onChange,
}: {
  profile: UserProfile;
  onChange: (u: Partial<UserProfile>) => void;
}) {
  return (
    <div style={styles.fields}>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Preferred Job Titles</label>
        <input
          style={styles.input}
          value={profile.preferredJobTitles.join(', ')}
          onChange={(e) =>
            onChange({
              preferredJobTitles: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="Software Engineer, Full Stack Developer, Backend Engineer"
        />
        <p style={styles.hint}>Comma-separated</p>
      </div>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Preferred Locations</label>
        <input
          style={styles.input}
          value={profile.preferredLocations.join(', ')}
          onChange={(e) =>
            onChange({
              preferredLocations: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="Bangalore, Remote, Hyderabad"
        />
        <p style={styles.hint}>Comma-separated</p>
      </div>
      <div style={styles.row}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Salary Expectation</label>
          <input
            style={styles.input}
            value={profile.salaryExpectation}
            onChange={(e) => onChange({ salaryExpectation: e.target.value })}
            placeholder="₹15-20 LPA / $80,000-100,000"
          />
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Work Authorization</label>
          <select
            style={styles.input}
            value={profile.workAuthorization}
            onChange={(e) => onChange({ workAuthorization: e.target.value })}
          >
            <option value="">Select...</option>
            <option value="Authorized to work">Authorized to work</option>
            <option value="Citizen">Citizen</option>
            <option value="Permanent Resident">Permanent Resident</option>
            <option value="Work Visa">Work Visa (H1B, etc.)</option>
            <option value="Need Sponsorship">Need Sponsorship</option>
            <option value="Student Visa">Student Visa (F1/OPT)</option>
          </select>
        </div>
      </div>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Cover Letter Preference</label>
        <div style={styles.radioGroup}>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="coverLetter"
              checked={profile.coverLetterPreference === 'auto'}
              onChange={() => onChange({ coverLetterPreference: 'auto' })}
            />
            Auto-generate cover letters
          </label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="coverLetter"
              checked={profile.coverLetterPreference === 'skip'}
              onChange={() => onChange({ coverLetterPreference: 'skip' })}
            />
            Skip cover letters
          </label>
        </div>
      </div>
    </div>
  );
}

// ============ Premium Styles ============

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '640px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  logo: { fontSize: '40px', marginBottom: '8px' },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    background: 'linear-gradient(to right, #60a5fa, #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0 0 4px',
  },
  subtitle: { color: '#94a3b8', fontSize: '14px', margin: 0 },
  notice: {
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#a5b4fc',
    fontSize: '13px',
    marginBottom: '16px',
  },
  progressBar: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
  },
  progressStep: {
    flex: 1,
    padding: '10px 8px',
    borderRadius: '8px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    background: '#0f172a',
    border: '1px solid #334155',
    transition: 'all 0.2s',
  },
  progressActive: {
    background: 'rgba(99, 102, 241, 0.15)',
    borderColor: '#6366f1',
  },
  progressIcon: { display: 'block', fontSize: '18px', marginBottom: '2px' },
  progressLabel: { fontSize: '11px', color: '#94a3b8' },
  stepContent: { marginBottom: '24px' },
  fields: { display: 'flex', flexDirection: 'column' as const, gap: '14px' },
  fieldGroup: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  label: { fontSize: '13px', fontWeight: 500, color: '#cbd5e1' },
  input: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#e2e8f0',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  hint: { fontSize: '11px', color: '#64748b', margin: '2px 0 0' },
  row: { display: 'flex', gap: '12px' },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e2e8f0',
    marginTop: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid #334155',
  },
  eduRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  addBtn: {
    background: 'none',
    border: '1px dashed #475569',
    borderRadius: '8px',
    padding: '8px',
    color: '#6366f1',
    fontSize: '13px',
    cursor: 'pointer',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px',
  },
  radioGroup: { display: 'flex', gap: '16px', marginTop: '4px' },
  radioLabel: { fontSize: '13px', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
  nav: { display: 'flex', justifyContent: 'space-between', gap: '12px' },
  btn: {
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white',
  },
  btnSecondary: {
    background: '#334155',
    color: '#cbd5e1',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#fca5a5',
    fontSize: '13px',
    marginTop: '4px',
  },
  successBadge: {
    marginTop: '12px',
    padding: '12px',
    background: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid rgba(34, 197, 94, 0.4)',
    borderRadius: '8px',
    color: '#86efac',
    fontSize: '13px',
    boxShadow: '0 2px 10px rgba(34, 197, 94, 0.1)',
  },
  providerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    margin: '8px 0',
  },
  providerCard: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '10px',
    padding: '12px 8px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  providerCardActive: {
    borderColor: '#6366f1',
    background: 'rgba(99, 102, 241, 0.1)',
    boxShadow: '0 0 10px rgba(99, 102, 241, 0.15)',
  },
  providerIcon: {
    fontSize: '20px',
    marginBottom: '4px',
    display: 'block',
  },
  providerName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#cbd5e1',
  },
  providerDesc: {
    fontSize: '9px',
    color: '#64748b',
    marginTop: '2px',
  },
  providerConfigFields: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    marginTop: '6px',
  },
  inputWithLink: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperLink: {
    color: '#60a5fa',
    textDecoration: 'none',
    fontSize: '12px',
    fontWeight: 500,
  },
  tabHeader: {
    display: 'flex',
    background: '#0f172a',
    borderRadius: '8px',
    padding: '3px',
    margin: '8px 0',
    border: '1px solid #334155',
  },
  tabBtn: {
    flex: 1,
    padding: '8px',
    border: 'none',
    background: 'none',
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'all 0.2s',
  },
  tabBtnActive: {
    background: '#1e293b',
    color: '#ffffff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  dropzone: {
    border: '2px dashed #475569',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    background: '#0f172a',
    transition: 'all 0.2s',
  },
  dropzoneActive: {
    borderColor: '#22c55e',
    background: 'rgba(34, 197, 94, 0.05)',
  },
  spinnerWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
