/**
 * User Profile — Types and Storage
 * Stores all user data needed for auto-filling job applications.
 * Persisted in chrome.storage.local.
 */

// ============ Types ============

export interface UserEducation {
  degree: string;
  college: string;
  year: string;
}

export interface UserProfile {
  // Basic Info
  fullName: string;
  email: string;
  phone: string;
  location: string;
  address: string;
  zipCode: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;

  // Professional
  totalYearsExperience: number;
  currentRole: string;
  currentCompany: string;
  noticePeriod: string;

  // Education
  education: UserEducation[];

  // Skills & Preferences
  topSkills: string[];
  preferredJobTitles: string[];
  preferredLocations: string[];
  salaryExpectation: string;
  workAuthorization: string;
  coverLetterPreference: 'auto' | 'skip';

  // Demographics (optional, for EEO forms)
  gender: string;
  nationality: string;
  dateOfBirth: string;

  // Resume PDF (stored as base64)
  resumePdfBase64: string;
  resumeFileName: string;

  // Meta
  onboardingComplete: boolean;
  updatedAt: string;
}

// ============ Defaults ============

export const DEFAULT_PROFILE: UserProfile = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  address: '',
  zipCode: '',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  totalYearsExperience: 0,
  currentRole: '',
  currentCompany: '',
  noticePeriod: '',
  education: [],
  topSkills: [],
  preferredJobTitles: [],
  preferredLocations: [],
  salaryExpectation: '',
  workAuthorization: '',
  coverLetterPreference: 'auto',
  gender: '',
  nationality: '',
  dateOfBirth: '',
  resumePdfBase64: '',
  resumeFileName: '',
  onboardingComplete: false,
  updatedAt: new Date().toISOString(),
};

// ============ Storage Keys ============

const PROFILE_KEY = 'cv_tailor_user_profile';

// ============ CRUD Operations ============

/**
 * Load user profile from chrome.storage.local
 */
export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const result = await chrome.storage.local.get(PROFILE_KEY);
    const stored = result[PROFILE_KEY];
    if (!stored) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...stored };
  } catch (error) {
    console.error('[ApplyMate] Failed to load user profile:', error);
    return { ...DEFAULT_PROFILE };
  }
}

/**
 * Save user profile to chrome.storage.local
 */
export async function saveUserProfile(profile: Partial<UserProfile>): Promise<void> {
  try {
    const current = await loadUserProfile();
    const updated = {
      ...current,
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [PROFILE_KEY]: updated });
  } catch (error) {
    console.error('[ApplyMate] Failed to save user profile:', error);
    throw error;
  }
}

/**
 * Check if onboarding is complete
 */
export async function isOnboardingComplete(): Promise<boolean> {
  const profile = await loadUserProfile();
  return profile.onboardingComplete;
}

/**
 * Get a flat map of profile data for auto-filling forms
 */
export function profileToFillData(profile: UserProfile): Record<string, string> {
  const nameParts = profile.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return {
    fullName: profile.fullName,
    firstName,
    lastName,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    address: profile.address,
    city: profile.location.split(',')[0]?.trim() || profile.location,
    state: profile.location.split(',')[1]?.trim() || '',
    country: profile.location.split(',').pop()?.trim() || '',
    zipCode: profile.zipCode,
    linkedinUrl: profile.linkedinUrl,
    githubUrl: profile.githubUrl,
    portfolioUrl: profile.portfolioUrl,
    website: profile.portfolioUrl || profile.githubUrl,
    totalYearsExperience: String(profile.totalYearsExperience),
    currentRole: profile.currentRole,
    currentJobTitle: profile.currentRole,
    currentCompany: profile.currentCompany,
    currentEmployer: profile.currentCompany,
    noticePeriod: profile.noticePeriod,
    degree: profile.education[0]?.degree || '',
    college: profile.education[0]?.college || '',
    university: profile.education[0]?.college || '',
    school: profile.education[0]?.college || '',
    graduationYear: profile.education[0]?.year || '',
    fieldOfStudy: (profile.education[0] as any)?.fieldOfStudy || '',
    gpa: (profile.education[0] as any)?.gpa || '',
    skills: profile.topSkills.join(', '),
    salaryExpectation: profile.salaryExpectation,
    workAuthorization: profile.workAuthorization,
    visaStatus: profile.workAuthorization,
    gender: profile.gender,
    nationality: profile.nationality,
    dateOfBirth: profile.dateOfBirth,
  };
}

/**
 * Pre-fill profile from existing YAML master resume data
 */
export function profileFromMasterResume(yaml: any): Partial<UserProfile> {
  const profile: Partial<UserProfile> = {};

  if (yaml.name) profile.fullName = yaml.name;
  if (yaml.email) profile.email = yaml.email;
  if (yaml.phone) profile.phone = yaml.phone;
  if (yaml.location) profile.location = yaml.location;
  if (yaml.linkedin) {
    profile.linkedinUrl = yaml.linkedin.startsWith('http')
      ? yaml.linkedin
      : `https://${yaml.linkedin}`;
  }
  if (yaml.github) {
    profile.githubUrl = yaml.github.startsWith('http')
      ? yaml.github
      : `https://${yaml.github}`;
  }
  if (yaml.portfolio) {
    profile.portfolioUrl = yaml.portfolio.startsWith('http')
      ? yaml.portfolio
      : `https://${yaml.portfolio}`;
  }

  if (yaml.experience?.length) {
    const latest = yaml.experience[0];
    profile.currentRole = latest.title || '';
    profile.currentCompany = latest.company || '';
  }

  if (yaml.education?.length) {
    profile.education = yaml.education.map((edu: any) => ({
      degree: edu.degree || '',
      college: edu.school || '',
      year: edu.year || '',
    }));
  }

  if (yaml.skills?.length) {
    profile.topSkills = yaml.skills.slice(0, 8);
  }

  return profile;
}
