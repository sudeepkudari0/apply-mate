/**
 * Onboarding Flow — Multi-step wizard
 * Collects all user profile data before any auto-apply happens.
 * Steps: Basic Info → Experience → Preferences → Resume Upload
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  loadUserProfile,
  saveUserProfile,
  profileFromMasterResume,
  type UserProfile,
  type UserEducation,
  DEFAULT_PROFILE,
} from '../core/userProfile';

type Step = 'basic' | 'experience' | 'preferences' | 'resume';

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'basic', label: 'Basic Info', icon: '👤' },
  { key: 'experience', label: 'Experience', icon: '💼' },
  { key: 'preferences', label: 'Preferences', icon: '⚙️' },
  { key: 'resume', label: 'Resume', icon: '📄' },
];

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState<Step>('basic');
  const [profile, setProfile] = useState<UserProfile>({ ...DEFAULT_PROFILE });
  const [saving, setSaving] = useState(false);
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
      return;
    }

    // Try to import from YAML master resume
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
      if (response.success && response.data.masterResumeYaml) {
        const yaml = await import('js-yaml');
        const parsed = yaml.load(response.data.masterResumeYaml);
        const prefilled = profileFromMasterResume(parsed);
        setProfile({ ...DEFAULT_PROFILE, ...prefilled });
        setImportedFromYaml(true);
      }
    } catch {
      // Ignore — user will fill manually
    }
  }

  function updateProfile(updates: Partial<UserProfile>) {
    setProfile((prev) => ({ ...prev, ...updates }));
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

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const isLastStep = currentStepIndex === STEPS.length - 1;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>📝</div>
          <h1 style={styles.title}>ApplyMate Setup</h1>
          <p style={styles.subtitle}>Let's collect your details for auto-filling job applications</p>
        </div>

        {/* Import notice */}
        {importedFromYaml && currentStep === 'basic' && (
          <div style={styles.notice}>
            ✨ Pre-filled from your YAML resume. Please review and update.
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
          {currentStep === 'basic' && (
            <BasicInfoStep profile={profile} onChange={updateProfile} />
          )}
          {currentStep === 'experience' && (
            <ExperienceStep profile={profile} onChange={updateProfile} />
          )}
          {currentStep === 'preferences' && (
            <PreferencesStep profile={profile} onChange={updateProfile} />
          )}
          {currentStep === 'resume' && (
            <ResumeUploadStep profile={profile} onChange={updateProfile} />
          )}
        </div>

        {/* Error */}
        {error && <div style={styles.error}>⚠️ {error}</div>}

        {/* Navigation */}
        <div style={styles.nav}>
          <button
            style={{ ...styles.btn, ...styles.btnSecondary }}
            onClick={prevStep}
            disabled={currentStepIndex === 0}
          >
            ← Back
          </button>
          {isLastStep ? (
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
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Step Components ============

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
          <label style={styles.label}>GitHub / Portfolio URL</label>
          <input
            style={styles.input}
            type="url"
            value={profile.githubUrl || profile.portfolioUrl}
            onChange={(e) => onChange({ githubUrl: e.target.value })}
            placeholder="https://github.com/..."
          />
        </div>
      </div>
      {!profile.portfolioUrl && profile.githubUrl && (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Portfolio URL (if different from GitHub)</label>
          <input
            style={styles.input}
            type="url"
            value={profile.portfolioUrl}
            onChange={(e) => onChange({ portfolioUrl: e.target.value })}
            placeholder="https://yoursite.com"
          />
        </div>
      )}
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

function ResumeUploadStep({
  profile,
  onChange,
}: {
  profile: UserProfile;
  onChange: (u: Partial<UserProfile>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (!file.type.includes('pdf')) {
      setUploadError('Please upload a PDF file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      onChange({
        resumePdfBase64: base64,
        resumeFileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={styles.fields}>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Upload your Resume (PDF)</label>
        <p style={styles.hint}>
          This will be stored locally and used for auto-uploading to job portals.
          Max 5MB.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        <button
          style={{ ...styles.btn, ...styles.btnSecondary, marginTop: '8px' }}
          onClick={() => fileRef.current?.click()}
        >
          📁 Choose PDF File
        </button>

        {profile.resumeFileName && (
          <div style={styles.fileInfo}>
            ✅ {profile.resumeFileName} uploaded
            ({Math.round((profile.resumePdfBase64.length * 0.75) / 1024)}KB)
          </div>
        )}

        {uploadError && <div style={styles.error}>{uploadError}</div>}
      </div>

      {/* Summary */}
      <div style={styles.sectionTitle}>📋 Profile Summary</div>
      <div style={styles.summary}>
        <div><strong>Name:</strong> {profile.fullName || '—'}</div>
        <div><strong>Email:</strong> {profile.email || '—'}</div>
        <div><strong>Phone:</strong> {profile.phone || '—'}</div>
        <div><strong>Location:</strong> {profile.location || '—'}</div>
        <div><strong>Role:</strong> {profile.currentRole || '—'} at {profile.currentCompany || '—'}</div>
        <div><strong>Experience:</strong> {profile.totalYearsExperience} years</div>
        <div><strong>Skills:</strong> {profile.topSkills.join(', ') || '—'}</div>
        <div><strong>Resume:</strong> {profile.resumeFileName || 'Not uploaded'}</div>
      </div>
    </div>
  );
}

// ============ Styles ============

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
    marginBottom: '12px',
  },
  fileInfo: {
    marginTop: '8px',
    padding: '8px 12px',
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '8px',
    color: '#86efac',
    fontSize: '13px',
  },
  summary: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '13px',
    color: '#94a3b8',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
};
