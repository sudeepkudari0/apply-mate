/**
 * Resume Parser
 * Parses LLM-rewritten plain-text resume back into a MasterResume structure.
 * Used to merge rewritten content with original formatting for PDF generation.
 */

import type { MasterResume } from './types';

interface ParsedSections {
  summary?: string;
  experiences: ParsedExperience[];
  projects: ParsedProject[];
  skills: string[];
  categorized_skills: { label: string; items: string }[];
}

interface ParsedExperience {
  title: string;
  company: string;
  bullets: string[];
  internBullets: string[];
}

interface ParsedProject {
  name: string;
  bullets: string[];
}

/**
 * Parse LLM-rewritten resume text into sections
 */
export function parseRewrittenResume(text: string): ParsedSections {
  const lines = text.split('\n').map((l) => l.trim());
  const result: ParsedSections = {
    experiences: [],
    projects: [],
    skills: [],
    categorized_skills: [],
  };

  let currentSection: 'none' | 'summary' | 'experience' | 'projects' | 'skills' | 'education' = 'none';
  let currentExp: ParsedExperience | null = null;
  let currentProject: ParsedProject | null = null;
  let inInternSection = false;
  let summaryLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Detect section headers
    const sectionHeader = detectSectionHeader(line);
    if (sectionHeader) {
      // Flush current items
      if (currentExp) {
        result.experiences.push(currentExp);
        currentExp = null;
      }
      if (currentProject) {
        result.projects.push(currentProject);
        currentProject = null;
      }

      currentSection = sectionHeader;
      inInternSection = false;
      continue;
    }

    switch (currentSection) {
      case 'summary':
        if (!isBullet(line) && !isSubheading(line)) {
          summaryLines.push(line);
        }
        break;

      case 'experience': {
        // Detect subsection headers (Full-Time vs Intern)
        if (line.toLowerCase().includes('full-time') || line.toLowerCase().includes('full time')) {
          inInternSection = false;
          continue;
        }
        if (line.toLowerCase().includes('intern') && !isBullet(line)) {
          inInternSection = true;
          continue;
        }

        // Detect new experience entry (Title at/- Company or Title, Company)
        const expMatch = line.match(/^#{2,3}\s+(.+?)\s+(?:at|[-–—])\s+(.+)/i) ||
          line.match(/^(?:\*\*)?(.+?)(?:\*\*)?,\s*(?:\*\*)?(.+?)(?:\*\*)?$/);

        if (expMatch && !isBullet(line) && !isDateLine(line) && !isTechLine(line)) {
          if (currentExp) result.experiences.push(currentExp);
          currentExp = {
            title: expMatch[1].replace(/[*#]/g, '').trim(),
            company: expMatch[2].replace(/[*#]/g, '').trim(),
            bullets: [],
            internBullets: [],
          };
          inInternSection = false;
          continue;
        }

        // Skip date/location/tech lines
        if (isDateLine(line) || isTechLine(line) || isLocationLine(line)) continue;

        // Collect bullets
        if (isBullet(line) && currentExp) {
          const bulletText = extractBulletText(line);
          if (bulletText) {
            if (inInternSection) {
              currentExp.internBullets.push(bulletText);
            } else {
              currentExp.bullets.push(bulletText);
            }
          }
        }
        break;
      }

      case 'projects': {
        // Detect new project
        const projMatch = line.match(/^#{2,3}\s+(.+)/) ||
          line.match(/^(?:\*\*)?([^-•*\n].{3,})(?:\*\*)?$/);

        if (projMatch && !isBullet(line) && !isLinkLine(line)) {
          if (currentProject) result.projects.push(currentProject);
          currentProject = {
            name: projMatch[1].replace(/[*#]/g, '').replace(/\|.*$/, '').trim(),
            bullets: [],
          };
          continue;
        }

        // Skip link lines
        if (isLinkLine(line)) continue;

        // Collect bullets
        if (isBullet(line) && currentProject) {
          const bulletText = extractBulletText(line);
          if (bulletText) currentProject.bullets.push(bulletText);
        }
        break;
      }

      case 'skills': {
        const skillLine = line.replace(/^[-•*]\s+/, '').replace(/\*\*/g, '').trim();
        if (skillLine) {
          const colonIdx = skillLine.indexOf(':');
          if (colonIdx !== -1 && colonIdx < 40) {
            // Looks like a category line e.g., "Frontend: React, Next.js"
            const label = skillLine.substring(0, colonIdx).trim();
            const items = skillLine.substring(colonIdx + 1).replace(/\.$/, '').trim();
            result.categorized_skills.push({ label, items });
          } else {
            // Flat skills list
            const skills = skillLine
              .split(/[,;]/)
              .map((s) => s.replace(/\.$/, '').trim())
              .filter((s) => s.length > 0);
            result.skills.push(...skills);
          }
        }
        break;
      }

      case 'none': {
        // Content before any section header — could be summary
        if (i > 5 && !isContactLine(line)) {
          summaryLines.push(line);
        }
        break;
      }
    }
  }

  // Flush remaining items
  if (currentExp) result.experiences.push(currentExp);
  if (currentProject) result.projects.push(currentProject);
  if (summaryLines.length > 0) {
    result.summary = summaryLines.join(' ').trim();
  }

  return result;
}

// ============ Section Detection ============

function detectSectionHeader(line: string): 'summary' | 'experience' | 'projects' | 'skills' | 'education' | null {
  const lower = line.toLowerCase().replace(/[#*_\-=]/g, '').trim();

  if (/^summary|^bio|^profile|^about|^objective/i.test(lower)) return 'summary';
  if (/^experience|^employment|^work\s*history|^professional\s*experience/i.test(lower)) return 'experience';
  if (/^project/i.test(lower)) return 'projects';
  if (/^skill|^technical\s*skill|^core\s*competenc/i.test(lower)) return 'skills';
  if (/^education|^academic/i.test(lower)) return 'education';

  return null;
}

// ============ Line Type Detection ============

function isBullet(line: string): boolean {
  return /^[-•*–]\s+/.test(line) || /^\d+\.\s+/.test(line);
}

function isSubheading(line: string): boolean {
  return /^#{2,}/.test(line) || /^\*\*.+\*\*$/.test(line);
}

function isDateLine(line: string): boolean {
  return /\b\d{4}\b/.test(line) && /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|present|current)/i.test(line);
}

function isTechLine(line: string): boolean {
  return /^tech(nolog)?/i.test(line) || /^\[?tech\s*stack/i.test(line);
}

function isLocationLine(line: string): boolean {
  return /^location|^remote|^hybrid|^on-?site/i.test(line);
}

function isLinkLine(line: string): boolean {
  return /^link:|^url:|^https?:\/\//i.test(line);
}

function isContactLine(line: string): boolean {
  return /^(email|phone|linkedin|github|portfolio|location):/i.test(line) || /^#\s+/.test(line);
}

function extractBulletText(line: string): string {
  return line.replace(/^[-•*–]\s+/, '').replace(/^\d+\.\s+/, '').trim();
}

/**
 * Merge parsed rewritten content into original MasterResume structure
 */
export function mergeRewrittenIntoOriginal(
  original: MasterResume,
  parsed: ParsedSections
): MasterResume {
  const merged: MasterResume = JSON.parse(JSON.stringify(original)); // Deep clone

  // Update summary
  if (parsed.summary) {
    merged.summary = parsed.summary;
  }

  // Update experience bullets (keep original structure: title, company, dates, techs, URLs)
  for (let i = 0; i < merged.experience.length; i++) {
    if (i < parsed.experiences.length) {
      const parsedExp = parsed.experiences[i];
      // Only update bullets — preserve everything else from original
      if (parsedExp.bullets.length > 0) {
        merged.experience[i].bullets = parsedExp.bullets;
      }
      if (parsedExp.internBullets.length > 0 && merged.experience[i].intern_bullets) {
        merged.experience[i].intern_bullets = parsedExp.internBullets;
      }
    }
  }

  // Update project bullets (keep names, URLs, descriptions from original)
  if (merged.projects) {
    for (let i = 0; i < merged.projects.length; i++) {
      if (i < parsed.projects.length) {
        const parsedProj = parsed.projects[i];
        if (parsedProj.bullets.length > 0) {
          merged.projects[i].bullets = parsedProj.bullets;
        }
      }
    }
  }

  // Update skills if parsed
  if (parsed.categorized_skills && parsed.categorized_skills.length > 0) {
    merged.categorized_skills = parsed.categorized_skills;
  } else if (parsed.skills.length > 0) {
    merged.skills = parsed.skills;
    merged.categorized_skills = []; // Clear categorized if AI flattened it
  }

  return merged;
}
