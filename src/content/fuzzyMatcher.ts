/**
 * Fuzzy Matcher — Enhanced
 * Maps detected form fields to user profile data using:
 * - Expanded keyword dictionary (200+ keywords across 40+ field types)
 * - HTML autocomplete attribute mapping
 * - Input type heuristics
 * - Normalized containment matching
 * - Levenshtein fuzzy matching
 * - Platform-specific attribute detection (Workday, Greenhouse, Lever)
 */

import type { DetectedField } from './fieldDetector';

export interface FieldMapping {
  field: DetectedField;
  profileKey: string;
  confidence: 'high' | 'medium' | 'low';
  matchMethod: 'exact' | 'contains' | 'fuzzy' | 'autocomplete' | 'inputType';
}

// ============ Comprehensive Keyword Map ============

const FIELD_KEYWORDS: Record<string, string[]> = {
  firstName: [
    'first name', 'first_name', 'firstname', 'fname', 'given name', 'givenname',
    'given_name', 'first', 'name_first', 'applicant_first', 'legal first',
    'preferred first', 'candidate first name', 'forename',
    // Workday / ATS specific
    'legalNameSection_firstName', 'input-firstName',
  ],
  lastName: [
    'last name', 'last_name', 'lastname', 'lname', 'surname', 'family name',
    'familyname', 'family_name', 'last', 'name_last', 'applicant_last',
    'legal last', 'candidate last name',
    'legalNameSection_lastName', 'input-lastName',
  ],
  fullName: [
    'full name', 'full_name', 'fullname', 'your name', 'name', 'applicant name',
    'candidate name', 'legal name', 'complete name', 'display name',
    'preferred name', 'your full name',
  ],
  email: [
    'email', 'e-mail', 'email address', 'emailaddress', 'email_address', 'e_mail',
    'mail', 'your email', 'contact email', 'primary email', 'work email',
    'personal email', 'email id', 'emailid', 'candidate email',
    'input-email', 'emailAddress',
  ],
  phone: [
    'phone', 'telephone', 'tel', 'mobile', 'cell', 'phone number', 'phonenumber',
    'phone_number', 'mobile number', 'contact number', 'cell phone',
    'primary phone', 'home phone', 'work phone', 'phone no',
    'mobile no', 'contact phone', 'daytime phone', 'evening phone',
    'input-phone', 'phoneNumber', 'mobileNumber',
  ],
  location: [
    'location', 'current location', 'your location',
    'where are you based', 'city/state', 'current city',
    'city state', 'city, state',
  ],
  city: [
    'city', 'town', 'municipality', 'city name', 'current city',
    'addressSection_city', 'address city',
  ],
  state: [
    'state', 'province', 'region', 'state/province', 'state name',
    'addressSection_state', 'address state',
  ],
  country: [
    'country', 'nation', 'country name', 'country/region',
    'addressSection_country', 'address country',
  ],
  zipCode: [
    'zip', 'zip code', 'zipcode', 'postal code', 'postalcode', 'postal',
    'pin code', 'pincode', 'zip/postal', 'postcode',
    'addressSection_postalCode',
  ],
  address: [
    'address', 'street address', 'street', 'address line 1', 'address1',
    'address line', 'mailing address', 'home address', 'residential address',
    'addressSection_addressLine1',
  ],
  linkedinUrl: [
    'linkedin', 'linked in', 'linkedin url', 'linkedin profile', 'linkedin link',
    'linked_in', 'linkedinurl', 'linkedin.com', 'linkedin account',
    'your linkedin', 'linkedin page',
  ],
  githubUrl: [
    'github', 'git hub', 'github url', 'github profile', 'github link',
    'githuburl', 'git_hub', 'github.com', 'github account',
  ],
  portfolioUrl: [
    'portfolio', 'website', 'personal website', 'personal url', 'web',
    'portfolio url', 'portfolio link', 'personal site', 'your website',
    'url', 'homepage', 'blog', 'personal page', 'online portfolio',
  ],
  website: ['website', 'web', 'url', 'homepage', 'personal url', 'web url'],
  currentRole: [
    'current title', 'current role', 'current job title', 'current position',
    'job title', 'position', 'title', 'role', 'designation',
    'most recent title', 'latest title', 'what is your current title',
  ],
  currentJobTitle: [
    'current job title', 'current title', 'job title', 'most recent title',
    'latest job title', 'position title', 'professional title',
  ],
  currentCompany: [
    'current company', 'current employer', 'company', 'employer', 'organization',
    'current organization', 'most recent company', 'company name',
    'employer name', 'where do you work', 'present employer',
    'latest company', 'organization name',
  ],
  currentEmployer: ['current employer', 'employer', 'most recent employer'],
  totalYearsExperience: [
    'years of experience', 'experience', 'total experience', 'years experience',
    'work experience', 'how many years', 'professional experience',
    'years of relevant experience', 'yoe', 'experience level',
    'total years', 'relevant experience', 'industry experience',
  ],
  degree: [
    'degree', 'highest degree', 'education level', 'qualification',
    'highest qualification', 'level of education', 'academic degree',
    'degree type', 'degree earned', 'education degree',
  ],
  college: [
    'college', 'university', 'school', 'institution', 'alma mater',
    'educational institution', 'school name', 'university name',
    'college name', 'institution name', 'school/university',
  ],
  university: ['university', 'school', 'institution', 'college'],
  graduationYear: [
    'graduation year', 'year of graduation', 'grad year', 'completion year',
    'year graduated', 'graduation date', 'year of completion',
    'degree year', 'education year',
  ],
  fieldOfStudy: [
    'field of study', 'major', 'specialization', 'concentration',
    'area of study', 'discipline', 'course', 'program',
  ],
  gpa: [
    'gpa', 'grade point average', 'cgpa', 'grades', 'cumulative gpa',
  ],
  salaryExpectation: [
    'salary', 'salary expectation', 'expected salary', 'desired salary',
    'compensation', 'pay expectation', 'expected compensation',
    'salary requirement', 'desired compensation', 'expected ctc',
    'current ctc', 'pay range', 'salary range', 'expected pay',
    'annual salary', 'minimum salary', 'desired pay',
  ],
  workAuthorization: [
    'work authorization', 'visa', 'visa status', 'authorized to work',
    'work permit', 'sponsorship', 'require sponsorship', 'legally authorized',
    'eligibility to work', 'right to work', 'work eligibility',
    'authorization status', 'employment authorization',
    'need visa sponsorship', 'immigration status',
    'do you require sponsorship', 'are you authorized',
    'legally eligible', 'employment eligibility',
  ],
  visaStatus: ['visa status', 'visa', 'immigration status', 'visa type'],
  coverLetter: [
    'cover letter', 'coverletter', 'cover_letter', 'motivation letter',
    'why do you want', 'why are you interested', 'letter of motivation',
    'application letter',
  ],
  skills: [
    'skills', 'key skills', 'technical skills', 'core competencies',
    'areas of expertise', 'skill set', 'skillset', 'proficiencies',
    'competencies', 'qualifications',
  ],
  noticePeriod: [
    'notice period', 'notice_period', 'noticeperiod', 'availability',
    'when can you start', 'start date', 'earliest start',
    'available to start', 'joining date', 'date available',
    'earliest availability', 'how soon can you join',
  ],
  gender: [
    'gender', 'sex', 'gender identity', 'gender identification',
  ],
  ethnicity: [
    'ethnicity', 'race', 'racial', 'ethnic background',
    'race/ethnicity', 'demographic',
  ],
  veteranStatus: [
    'veteran', 'veteran status', 'military', 'military service',
    'armed forces', 'protected veteran',
  ],
  disabilityStatus: [
    'disability', 'disabled', 'disability status', 'handicap',
    'accommodation', 'special needs',
  ],
  referral: [
    'referral', 'referred by', 'how did you hear', 'source',
    'referral source', 'who referred you', 'hear about us',
    'how did you find', 'where did you hear',
  ],
  dateOfBirth: [
    'date of birth', 'dob', 'birth date', 'birthday',
    'birth_date', 'dateofbirth',
  ],
  nationality: [
    'nationality', 'citizenship', 'country of citizenship',
    'national origin',
  ],
};

// ============ Autocomplete → Profile Key Map ============

const AUTOCOMPLETE_MAP: Record<string, string> = {
  'given-name': 'firstName',
  'family-name': 'lastName',
  'name': 'fullName',
  'additional-name': 'firstName',
  'honorific-prefix': 'firstName',
  'email': 'email',
  'tel': 'phone',
  'tel-national': 'phone',
  'tel-local': 'phone',
  'url': 'portfolioUrl',
  'organization': 'currentCompany',
  'organization-title': 'currentRole',
  'address-level2': 'city',
  'address-level1': 'state',
  'country-name': 'country',
  'country': 'country',
  'postal-code': 'zipCode',
  'street-address': 'address',
  'address-line1': 'address',
  'bday': 'dateOfBirth',
  'sex': 'gender',
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

  // Sort fields so required fields get matched first
  const sortedFields = [...fields].sort((a, b) => {
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    return 0;
  });

  for (const field of sortedFields) {
    // Skip fields that already have values
    if (field.currentValue && field.currentValue.trim()) continue;

    const identifier = field.identifier;
    if (!identifier) continue;

    let bestMatch: {
      key: string;
      confidence: FieldMapping['confidence'];
      method: FieldMapping['matchMethod'];
      score: number;
    } | null = null;

    // === Strategy 1: Autocomplete attribute (highest reliability) ===
    const autocomplete = (field.element as HTMLInputElement).autocomplete;
    if (autocomplete && autocomplete !== 'off' && autocomplete !== 'on') {
      const mapped = AUTOCOMPLETE_MAP[autocomplete];
      if (mapped && profileData[mapped]) {
        bestMatch = { key: mapped, confidence: 'high', method: 'autocomplete', score: 1000 };
      }
    }

    // === Strategy 2: Input type heuristics ===
    if (!bestMatch) {
      if (field.inputType === 'email' && profileData.email) {
        bestMatch = { key: 'email', confidence: 'high', method: 'inputType', score: 900 };
      } else if (field.inputType === 'tel' && profileData.phone) {
        bestMatch = { key: 'phone', confidence: 'high', method: 'inputType', score: 900 };
      } else if (field.inputType === 'url') {
        // Check label to determine WHICH url
        const lowerLabel = (field.label + ' ' + field.name + ' ' + field.id).toLowerCase();
        if (lowerLabel.includes('linkedin') && profileData.linkedinUrl) {
          bestMatch = { key: 'linkedinUrl', confidence: 'high', method: 'inputType', score: 900 };
        } else if (lowerLabel.includes('github') && profileData.githubUrl) {
          bestMatch = { key: 'githubUrl', confidence: 'high', method: 'inputType', score: 900 };
        } else if (profileData.portfolioUrl) {
          bestMatch = { key: 'portfolioUrl', confidence: 'medium', method: 'inputType', score: 500 };
        }
      }
    }

    // === Strategy 3: Keyword matching ===
    if (!bestMatch || bestMatch.score < 900) {
      for (const [profileKey, keywords] of Object.entries(FIELD_KEYWORDS)) {
        if (!profileData[profileKey]) continue;

        // Exact keyword match in identifier
        for (const keyword of keywords) {
          if (identifier.includes(keyword)) {
            const score = keyword.length * 3;
            if (!bestMatch || score > bestMatch.score) {
              bestMatch = { key: profileKey, confidence: 'high', method: 'exact', score };
            }
          }
        }

        // Normalized containment (if no high-confidence match yet)
        if (!bestMatch || bestMatch.confidence !== 'high') {
          const normalizedId = normalizeStr(identifier);
          for (const keyword of keywords) {
            const normalizedKw = normalizeStr(keyword);
            if (normalizedKw.length >= 3 && normalizedId.includes(normalizedKw)) {
              const score = normalizedKw.length * 2;
              if (!bestMatch || score > bestMatch.score) {
                bestMatch = { key: profileKey, confidence: 'medium', method: 'contains', score };
              }
            }
          }
        }

        // Fuzzy match via Levenshtein (last resort)
        if (!bestMatch) {
          const idWords = identifier.split(/[\s_\-]+/).filter((w) => w.length >= 3);
          for (const keyword of keywords) {
            const kwWords = keyword.split(/[\s_\-]+/);
            for (const idWord of idWords) {
              for (const kwWord of kwWords) {
                if (kwWord.length < 3) continue;
                const similarity = 1 - levenshteinDistance(idWord, kwWord) / Math.max(idWord.length, kwWord.length);
                if (similarity >= 0.75) {
                  const score = similarity * kwWord.length;
                  if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { key: profileKey, confidence: 'low', method: 'fuzzy', score };
                  }
                }
              }
            }
          }
        }
      }
    }

    // === Apply match ===
    if (bestMatch && profileData[bestMatch.key]) {
      // Avoid double-mapping the same profile key to multiple fields
      // (allow name-related fields to coexist)
      const isNameField = ['firstName', 'lastName', 'fullName'].includes(bestMatch.key);
      const isUrlField = ['linkedinUrl', 'githubUrl', 'portfolioUrl', 'website'].includes(bestMatch.key);
      if (!isNameField && !isUrlField && usedKeys.has(bestMatch.key)) continue;

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
