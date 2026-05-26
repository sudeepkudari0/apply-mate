/**
 * Chrome Storage Utilities for ApplyMate
 * Centralized storage management for all extension data
 */

import type { SavedSearch } from "../features/jobSearch/jobSearchData";

// Storage Keys
const STORAGE_KEYS = {
  SAVED_SEARCHES: "cv_tailor_saved_searches",
  TARGET_COMPANIES: "cv_tailor_target_companies",
  APPLICATION_HISTORY: "cv_tailor_applications",
  SETTINGS: "cv_tailor_settings",
} as const;

// Target Company Interface
export interface TargetCompany {
  id: string;
  name: string;
  careerUrl: string;
  category: string;
  lastChecked?: Date;
  addedAt: Date;
}

// Application Record Interface (for future use)
export interface ApplicationRecord {
  id: string;
  company: string;
  jobTitle: string;
  jobUrl: string;
  matchScore?: number;
  status: "bookmarked" | "applied" | "interview" | "offer" | "rejected" | "ghosted";
  appliedDate?: Date;
  followUpDate?: Date;
  notes: string;
  resumeVersion?: string;
  coverLetterUsed: boolean;
  source: "linkedin" | "indeed" | "glassdoor" | "company_site" | "referral" | "other";
  createdAt: Date;
  updatedAt: Date;
}

// User Settings
export interface UserSettings {
  defaultLocation: string;
  defaultBoards: string[];
  defaultExperienceLevels: string[];
  remindersEnabled: boolean;
  followUpDays: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  defaultLocation: "Bangalore, India",
  defaultBoards: ["linkedin", "indeed"],
  defaultExperienceLevels: ["mid", "senior"],
  remindersEnabled: true,
  followUpDays: 7,
};

// ============ Saved Searches ============

export async function loadSavedSearches(): Promise<SavedSearch[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SAVED_SEARCHES);
    const searches = result[STORAGE_KEYS.SAVED_SEARCHES] || [];
    // Parse dates
    return searches.map((s: any) => ({
      ...s,
      createdAt: new Date(s.createdAt),
    }));
  } catch (error) {
    console.error("[ApplyMate] Failed to load saved searches:", error);
    return [];
  }
}

export async function saveSavedSearches(searches: SavedSearch[]): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SAVED_SEARCHES]: searches,
    });
  } catch (error) {
    console.error("[ApplyMate] Failed to save searches:", error);
  }
}

// ============ Target Companies ============

export async function loadTargetCompanies(): Promise<TargetCompany[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TARGET_COMPANIES);
    const companies = result[STORAGE_KEYS.TARGET_COMPANIES] || [];
    return companies.map((c: any) => ({
      ...c,
      lastChecked: c.lastChecked ? new Date(c.lastChecked) : undefined,
      addedAt: new Date(c.addedAt),
    }));
  } catch (error) {
    console.error("[ApplyMate] Failed to load target companies:", error);
    return [];
  }
}

export async function saveTargetCompanies(companies: TargetCompany[]): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.TARGET_COMPANIES]: companies,
    });
  } catch (error) {
    console.error("[ApplyMate] Failed to save target companies:", error);
  }
}

export async function addTargetCompany(company: Omit<TargetCompany, "id" | "addedAt">): Promise<TargetCompany> {
  const companies = await loadTargetCompanies();
  const newCompany: TargetCompany = {
    ...company,
    id: Date.now().toString(),
    addedAt: new Date(),
  };
  companies.push(newCompany);
  await saveTargetCompanies(companies);
  return newCompany;
}

export async function removeTargetCompany(id: string): Promise<void> {
  const companies = await loadTargetCompanies();
  const updated = companies.filter((c) => c.id !== id);
  await saveTargetCompanies(updated);
}

export async function updateCompanyLastChecked(id: string): Promise<void> {
  const companies = await loadTargetCompanies();
  const updated = companies.map((c) =>
    c.id === id ? { ...c, lastChecked: new Date() } : c
  );
  await saveTargetCompanies(updated);
}

// ============ Application History ============

export async function loadApplicationHistory(): Promise<ApplicationRecord[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.APPLICATION_HISTORY);
    const applications = result[STORAGE_KEYS.APPLICATION_HISTORY] || [];
    return applications.map((a: any) => ({
      ...a,
      appliedDate: a.appliedDate ? new Date(a.appliedDate) : undefined,
      followUpDate: a.followUpDate ? new Date(a.followUpDate) : undefined,
      createdAt: new Date(a.createdAt),
      updatedAt: new Date(a.updatedAt),
    }));
  } catch (error) {
    console.error("[ApplyMate] Failed to load application history:", error);
    return [];
  }
}

export async function saveApplicationHistory(applications: ApplicationRecord[]): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.APPLICATION_HISTORY]: applications,
    });
  } catch (error) {
    console.error("[ApplyMate] Failed to save application history:", error);
  }
}

export async function addApplication(
  application: Omit<ApplicationRecord, "id" | "createdAt" | "updatedAt">
): Promise<ApplicationRecord> {
  const applications = await loadApplicationHistory();
  const now = new Date();
  const newApp: ApplicationRecord = {
    ...application,
    id: Date.now().toString(),
    createdAt: now,
    updatedAt: now,
  };
  applications.push(newApp);
  await saveApplicationHistory(applications);
  return newApp;
}

export async function updateApplication(
  id: string,
  updates: Partial<ApplicationRecord>
): Promise<void> {
  const applications = await loadApplicationHistory();
  const updated = applications.map((a) =>
    a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a
  );
  await saveApplicationHistory(updated);
}

// ============ Settings ============

export async function loadSettings(): Promise<UserSettings> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
  } catch (error) {
    console.error("[ApplyMate] Failed to load settings:", error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Partial<UserSettings>): Promise<void> {
  try {
    const current = await loadSettings();
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: { ...current, ...settings },
    });
  } catch (error) {
    console.error("[ApplyMate] Failed to save settings:", error);
  }
}
