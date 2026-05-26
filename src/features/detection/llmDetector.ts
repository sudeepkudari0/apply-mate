/**
 * LLM-Powered Job Description Detector
 * Falls back to AI when Schema.org and CSS selectors fail
 */

export interface LLMJobExtraction {
  title: string;
  company: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  skills: string[];
  location?: string;
  salary?: string;
  experienceLevel?: string;
  employmentType?: string;
}

/**
 * Prompt template for LLM job extraction
 */
export const JOB_EXTRACTION_PROMPT = `You are a job description parser. Extract the following information from this job posting content.

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "title": "Job title",
  "company": "Company name",
  "description": "Brief summary of the role (2-3 sentences)",
  "requirements": ["requirement 1", "requirement 2"],
  "responsibilities": ["responsibility 1", "responsibility 2"],
  "skills": ["skill 1", "skill 2"],
  "location": "Location or Remote",
  "salary": "Salary range if mentioned",
  "experienceLevel": "Entry/Mid/Senior/Lead",
  "employmentType": "Full-time/Part-time/Contract"
}

If any field is not found, use an empty string for text fields or empty array for list fields.

Job Posting Content:
---
`;

/**
 * Clean and truncate page content for LLM processing
 */
export function preparePageContentForLLM(maxChars: number = 8000): string {
  // Get all text content
  const bodyText = document.body.innerText || "";
  
  // Remove excessive whitespace
  const cleaned = bodyText
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Truncate if needed
  if (cleaned.length > maxChars) {
    // Try to find a good break point
    const truncated = cleaned.slice(0, maxChars);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastNewline = truncated.lastIndexOf("\n");
    const breakPoint = Math.max(lastPeriod, lastNewline, maxChars - 500);
    return truncated.slice(0, breakPoint + 1) + "...";
  }

  return cleaned;
}

/**
 * Build the full prompt for LLM extraction
 */
export function buildExtractionPrompt(pageContent: string): string {
  const truncatedContent = pageContent.slice(0, 8000);
  return JOB_EXTRACTION_PROMPT + truncatedContent;
}

/**
 * Parse LLM response into structured data
 */
export function parseLLMResponse(response: string): LLMJobExtraction | null {
  try {
    // Try to extract JSON from response (handle markdown code blocks)
    let jsonStr = response;
    
    // Remove markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object in response
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize
    return {
      title: normalizeString(parsed.title),
      company: normalizeString(parsed.company),
      description: normalizeString(parsed.description),
      requirements: normalizeArray(parsed.requirements),
      responsibilities: normalizeArray(parsed.responsibilities),
      skills: normalizeArray(parsed.skills),
      location: normalizeString(parsed.location) || undefined,
      salary: normalizeString(parsed.salary) || undefined,
      experienceLevel: normalizeString(parsed.experienceLevel) || undefined,
      employmentType: normalizeString(parsed.employmentType) || undefined,
    };
  } catch (error) {
    console.error("[ApplyMate] Failed to parse LLM response:", error);
    return null;
  }
}

function normalizeString(value: any): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => normalizeString(v))
      .filter((v) => v.length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    // Split by common delimiters
    return value.split(/[,;•\n]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Extract skills from text using common patterns
 */
export function extractSkillsFromText(text: string): string[] {
  // Common technical skills to look for
  const skillPatterns = [
    // Languages
    /\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|Go|Golang|Rust|Ruby|PHP|Swift|Kotlin|Scala|R)\b/gi,
    // Frameworks
    /\b(React(?:\.js)?|Vue(?:\.js)?|Angular|Node(?:\.js)?|Express(?:\.js)?|Django|Flask|FastAPI|Spring|\.NET|Next\.js|Nuxt\.js)\b/gi,
    // Databases
    /\b(SQL|PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|DynamoDB|Cassandra|Oracle|SQLite)\b/gi,
    // Cloud
    /\b(AWS|Azure|GCP|Google Cloud|Kubernetes|Docker|Terraform|CloudFormation|Lambda|EC2|S3)\b/gi,
    // Tools
    /\b(Git|GitHub|GitLab|Jenkins|CircleCI|Travis|Jira|Confluence|Slack|Figma)\b/gi,
    // Concepts
    /\b(REST|GraphQL|gRPC|Microservices|CI\/CD|DevOps|Agile|Scrum|TDD|BDD)\b/gi,
    // Data/ML
    /\b(Machine Learning|Deep Learning|NLP|Computer Vision|TensorFlow|PyTorch|Pandas|NumPy|Spark|Hadoop)\b/gi,
  ];

  const foundSkills = new Set<string>();

  for (const pattern of skillPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((match) => foundSkills.add(match));
    }
  }

  return Array.from(foundSkills);
}
