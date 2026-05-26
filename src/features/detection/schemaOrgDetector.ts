/**
 * Schema.org JobPosting Detector
 * Extracts job information from structured data (JSON-LD)
 * 
 * This is the most reliable detection method as it uses
 * standardized structured data that many job sites implement.
 */

export interface SchemaJobPosting {
  title: string;
  company: string;
  description: string;
  location?: string;
  salary?: {
    currency?: string;
    minValue?: number;
    maxValue?: number;
  };
  datePosted?: string;
  validThrough?: string;
  employmentType?: string | string[];
  requirements?: string[];
  responsibilities?: string[];
  skills?: string[];
  experienceRequired?: string;
  educationRequired?: string;
  remote?: boolean;
}

/**
 * Extract JobPosting from Schema.org JSON-LD
 * @returns JobPosting data or null if not found
 */
export function extractSchemaOrgJobPosting(): SchemaJobPosting | null {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
      const content = script.textContent;
      if (!content) continue;

      try {
        const data = JSON.parse(content);
        const jobPosting = findJobPosting(data);
        
        if (jobPosting) {
          return parseJobPosting(jobPosting);
        }
      } catch (parseError) {
        // Invalid JSON, continue to next script
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error("[ApplyMate] Schema.org extraction error:", error);
    return null;
  }
}

/**
 * Recursively find JobPosting in JSON-LD data
 */
function findJobPosting(data: any): any | null {
  if (!data) return null;

  // Direct JobPosting
  if (data["@type"] === "JobPosting") {
    return data;
  }

  // Array of types (e.g., ["JobPosting", "ItemPage"])
  if (Array.isArray(data["@type"]) && data["@type"].includes("JobPosting")) {
    return data;
  }

  // Check @graph array (common in WordPress, etc.)
  if (Array.isArray(data["@graph"])) {
    for (const item of data["@graph"]) {
      const found = findJobPosting(item);
      if (found) return found;
    }
  }

  // Check array of items
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJobPosting(item);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Parse JobPosting schema into our format
 */
function parseJobPosting(data: any): SchemaJobPosting {
  const result: SchemaJobPosting = {
    title: extractString(data.title) || "",
    company: extractCompanyName(data.hiringOrganization) || "",
    description: extractString(data.description) || "",
  };

  // Location
  result.location = extractLocation(data.jobLocation);

  // Salary
  if (data.baseSalary) {
    result.salary = extractSalary(data.baseSalary);
  }

  // Dates
  result.datePosted = extractString(data.datePosted);
  result.validThrough = extractString(data.validThrough);

  // Employment type
  result.employmentType = data.employmentType;

  // Requirements and qualifications
  if (data.qualifications) {
    result.requirements = extractTextArray(data.qualifications);
  }
  if (data.responsibilities) {
    result.responsibilities = extractTextArray(data.responsibilities);
  }
  if (data.skills) {
    result.skills = extractTextArray(data.skills);
  }

  // Experience and education
  result.experienceRequired = extractExperience(data.experienceRequirements);
  result.educationRequired = extractEducation(data.educationRequirements);

  // Remote work
  if (data.jobLocationType === "TELECOMMUTE" || data.applicantLocationRequirements) {
    result.remote = true;
  }

  return result;
}

function extractString(value: any): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    return value["@value"] || value.value || value.name || undefined;
  }
  return undefined;
}

function extractCompanyName(org: any): string | undefined {
  if (!org) return undefined;
  if (typeof org === "string") return org;
  return org.name || org.legalName || undefined;
}

function extractLocation(location: any): string | undefined {
  if (!location) return undefined;
  if (typeof location === "string") return location;

  // Single location object
  if (location.address) {
    const addr = location.address;
    const parts = [
      addr.addressLocality,
      addr.addressRegion,
      addr.addressCountry,
    ].filter(Boolean);
    return parts.join(", ");
  }

  // Array of locations
  if (Array.isArray(location)) {
    return location
      .map((l) => extractLocation(l))
      .filter(Boolean)
      .join(" | ");
  }

  return location.name || undefined;
}

function extractSalary(salary: any): { currency?: string; minValue?: number; maxValue?: number } | undefined {
  if (!salary) return undefined;

  const result: { currency?: string; minValue?: number; maxValue?: number } = {};

  if (salary.currency) result.currency = salary.currency;
  
  // Handle MonetaryAmount
  if (salary.value) {
    if (typeof salary.value === "number") {
      result.minValue = salary.value;
      result.maxValue = salary.value;
    } else if (typeof salary.value === "object") {
      result.minValue = salary.value.minValue;
      result.maxValue = salary.value.maxValue;
    }
  }

  // Direct min/max
  if (salary.minValue) result.minValue = Number(salary.minValue);
  if (salary.maxValue) result.maxValue = Number(salary.maxValue);

  return Object.keys(result).length > 0 ? result : undefined;
}

function extractTextArray(value: any): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.map((v) => extractString(v)).filter((v): v is string => !!v);
  }
  return [];
}

function extractExperience(exp: any): string | undefined {
  if (!exp) return undefined;
  if (typeof exp === "string") return exp;
  if (exp.monthsOfExperience) {
    const years = Math.round(exp.monthsOfExperience / 12);
    return `${years}+ years`;
  }
  return exp.name || undefined;
}

function extractEducation(edu: any): string | undefined {
  if (!edu) return undefined;
  if (typeof edu === "string") return edu;
  if (edu.credentialCategory) return edu.credentialCategory;
  return edu.name || undefined;
}

/**
 * Check if current page likely has Schema.org JobPosting
 */
export function hasSchemaOrgJobPosting(): boolean {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    const content = script.textContent || "";
    if (content.includes("JobPosting")) {
      return true;
    }
  }
  return false;
}
