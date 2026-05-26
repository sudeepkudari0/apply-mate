/**
 * Fuzzy Matcher
 * Maps detected form fields to user profile data using
 * keyword matching, normalized containment, and Levenshtein distance.
 */

import type { DetectedField } from './fieldDetector';

export interface FieldMapping {
  field: DetectedField;
  profileKey: string;
  confidence: 'high' | 'medium' | 'low';
  matchMethod: 'exact' | 'contains' | 'fuzzy';
}

// ============ Keyword Map ============
// Maps profile data keys to common field identifiers found on job portals

const FIELD_KEYWORDS: Record<string, string[]> = {
  firstName: [
    'first name', 'first_name', 'firstname', 'fname', 'given name', 'givenname',
    'given_name', 'first', 'name_first', 'applicant_first',
  ],
  lastName: [
    'last name', 'last_name', 'lastname', 'lname', 'surname', 'family name',
    'familyname', 'family_name', 'last', 'name_last', 'applicant_last',
  ],
  fullName: [
    'full name', 'full_name', 'fullname', 'your name', 'name', 'applicant name',
    'candidate name', 'legal name',
  ],
  email: [
    'email', 'e-mail', 'email address', 'emailaddress', 'email_address', 'e_mail',
    'mail', 'your email', 'contact email',
  ],
  phone: [
    'phone', 'telephone', 'tel', 'mobile', 'cell', 'phone number', 'phonenumber',
    'phone_number', 'mobile number', 'contact number', 'cell phone',
  ],
  location: [
    'location', 'city', 'address', 'current location', 'your location',
    'where are you based', 'city/state',
  ],
  city: ['city', 'town', 'municipality'],
  state: ['state', 'province', 'region'],
  country: ['country', 'nation'],
  linkedinUrl: [
    'linkedin', 'linked in', 'linkedin url', 'linkedin profile', 'linkedin link',
    'linked_in', 'linkedinurl',
  ],
  githubUrl: [
    'github', 'git hub', 'github url', 'github profile', 'github link',
    'githuburl', 'git_hub',
  ],
  portfolioUrl: [
    'portfolio', 'website', 'personal website', 'personal url', 'web',
    'portfolio url', 'portfolio link', 'personal site', 'your website',
    'url', 'homepage',
  ],
  website: ['website', 'web', 'url', 'homepage', 'personal url'],
  currentRole: [
    'current title', 'current role', 'current job title', 'current position',
    'job title', 'position', 'title', 'role',
  ],
  currentJobTitle: [
    'current job title', 'current title', 'job title', 'most recent title',
  ],
  currentCompany: [
    'current company', 'current employer', 'company', 'employer', 'organization',
    'current organization', 'most recent company',
  ],
  currentEmployer: ['current employer', 'employer', 'most recent employer'],
  totalYearsExperience: [
    'years of experience', 'experience', 'total experience', 'years experience',
    'work experience', 'how many years', 'professional experience',
  ],
  degree: [
    'degree', 'highest degree', 'education level', 'qualification',
    'highest qualification', 'level of education',
  ],
  college: [
    'college', 'university', 'school', 'institution', 'alma mater',
    'educational institution',
  ],
  university: ['university', 'school', 'institution'],
  graduationYear: [
    'graduation year', 'year of graduation', 'grad year', 'completion year',
    'year graduated',
  ],
  salaryExpectation: [
    'salary', 'salary expectation', 'expected salary', 'desired salary',
    'compensation', 'pay expectation', 'expected compensation',
    'salary requirement', 'desired compensation',
  ],
  workAuthorization: [
    'work authorization', 'visa', 'visa status', 'authorized to work',
    'work permit', 'sponsorship', 'require sponsorship', 'legally authorized',
    'eligibility to work', 'right to work',
  ],
  visaStatus: ['visa status', 'visa', 'immigration status'],
  coverLetter: [
    'cover letter', 'coverletter', 'cover_letter', 'motivation letter',
    'why do you want', 'why are you interested',
  ],
  skills: [
    'skills', 'key skills', 'technical skills', 'core competencies',
    'areas of expertise',
  ],
};

// ============ Main Matching Function ============

/**
 * Match detected fields to profile data keys
 */
export function matchFieldsToProfile(
  fields: DetectedField[],
  profileData: Record<string, string>
): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const usedKeys = new Set<string>();

  for (const field of fields) {
    // Skip fields that already have values
    if (field.currentValue && field.currentValue.trim()) continue;

    const identifier = field.identifier;
    if (!identifier) continue;

    let bestMatch: { key: string; confidence: FieldMapping['confidence']; method: FieldMapping['matchMethod'] } | null = null;
    let bestScore = 0;

    for (const [profileKey, keywords] of Object.entries(FIELD_KEYWORDS)) {
      // Skip if this profile key has no data
      if (!profileData[profileKey]) continue;

      // Strategy 1: Exact keyword match
      for (const keyword of keywords) {
        if (identifier.includes(keyword)) {
          const score = keyword.length * 3; // Longer keyword = more specific = higher score
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { key: profileKey, confidence: 'high', method: 'exact' };
          }
        }
      }

      // Strategy 2: Normalized containment (if no exact match yet)
      if (!bestMatch || bestMatch.confidence !== 'high') {
        const normalizedId = normalizeStr(identifier);
        for (const keyword of keywords) {
          const normalizedKw = normalizeStr(keyword);
          if (normalizedId.includes(normalizedKw) && normalizedKw.length >= 3) {
            const score = normalizedKw.length * 2;
            if (score > bestScore) {
              bestScore = score;
              bestMatch = { key: profileKey, confidence: 'medium', method: 'contains' };
            }
          }
        }
      }

      // Strategy 3: Fuzzy match via Levenshtein (most expensive, last resort)
      if (!bestMatch) {
        const idWords = identifier.split(/[\s_-]+/).filter((w) => w.length >= 3);
        for (const keyword of keywords) {
          const kwWords = keyword.split(/[\s_-]+/);
          for (const idWord of idWords) {
            for (const kwWord of kwWords) {
              if (kwWord.length < 3) continue;
              const similarity = 1 - levenshteinDistance(idWord, kwWord) / Math.max(idWord.length, kwWord.length);
              if (similarity >= 0.75) {
                const score = similarity * kwWord.length;
                if (score > bestScore) {
                  bestScore = score;
                  bestMatch = { key: profileKey, confidence: 'low', method: 'fuzzy' };
                }
              }
            }
          }
        }
      }
    }

    // Also check autocomplete attribute for high-confidence matches
    const autocomplete = (field.element as HTMLInputElement).autocomplete;
    if (autocomplete) {
      const autoMap: Record<string, string> = {
        'given-name': 'firstName',
        'family-name': 'lastName',
        'name': 'fullName',
        'email': 'email',
        'tel': 'phone',
        'url': 'portfolioUrl',
        'organization': 'currentCompany',
        'address-level2': 'city',
        'address-level1': 'state',
        'country-name': 'country',
      };
      const mapped = autoMap[autocomplete];
      if (mapped && profileData[mapped]) {
        bestMatch = { key: mapped, confidence: 'high', method: 'exact' };
      }
    }

    // Input type heuristics
    if (!bestMatch) {
      if (field.inputType === 'email' && profileData.email) {
        bestMatch = { key: 'email', confidence: 'high', method: 'exact' };
      } else if (field.inputType === 'tel' && profileData.phone) {
        bestMatch = { key: 'phone', confidence: 'high', method: 'exact' };
      } else if (field.inputType === 'url' && profileData.website) {
        bestMatch = { key: 'website', confidence: 'medium', method: 'contains' };
      }
    }

    if (bestMatch && profileData[bestMatch.key]) {
      // Avoid double-mapping the same profile key to multiple fields
      // (allow fullName + firstName/lastName to coexist though)
      const isNameField = ['firstName', 'lastName', 'fullName'].includes(bestMatch.key);
      if (!isNameField && usedKeys.has(bestMatch.key)) continue;

      usedKeys.add(bestMatch.key);
      mappings.push({
        field,
        profileKey: bestMatch.key,
        confidence: bestMatch.confidence,
        matchMethod: bestMatch.method,
      });
    }
  }

  return mappings;
}

/**
 * Match a select dropdown's options to a profile value
 * Returns the best matching option value
 */
export function matchSelectOption(
  options: HTMLOptionElement[],
  profileValue: string
): string | null {
  const normalizedProfile = normalizeStr(profileValue);

  // Exact match
  for (const opt of options) {
    if (normalizeStr(opt.text) === normalizedProfile || normalizeStr(opt.value) === normalizedProfile) {
      return opt.value;
    }
  }

  // Contains match
  for (const opt of options) {
    const normalizedOpt = normalizeStr(opt.text);
    if (normalizedOpt.includes(normalizedProfile) || normalizedProfile.includes(normalizedOpt)) {
      return opt.value;
    }
  }

  // Fuzzy match
  let bestMatch: string | null = null;
  let bestSimilarity = 0;

  for (const opt of options) {
    if (!opt.value || opt.value === '') continue;
    const similarity = 1 - levenshteinDistance(normalizeStr(opt.text), normalizedProfile)
      / Math.max(opt.text.length, profileValue.length);
    if (similarity > bestSimilarity && similarity >= 0.6) {
      bestSimilarity = similarity;
      bestMatch = opt.value;
    }
  }

  return bestMatch;
}

// ============ Helpers ============

function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}
