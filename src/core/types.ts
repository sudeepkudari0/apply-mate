/**
 * Core Types
 * Data structures for resume and job information
 */

export interface SkillCategory {
  label: string;
  items: string;
}

export interface MasterResume {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;

  summary?: string;

  experience: Experience[];
  education: Education[];
  skills: string[];
  categorized_skills?: SkillCategory[];
  certifications?: string[];
  projects?: Project[];
}

export interface Experience {
  title: string;
  company: string;
  dates: string;
  location?: string;
  technologies?: string[];
  bullets: string[];
  intern_bullets?: string[];
}

export interface Education {
  degree: string;
  school: string;
  year: string;
  gpa?: string;
}

export interface Project {
  name: string;
  url?: string;
  description?: string;
  bullets?: string[];
}

export interface JDAnalysis {
  hard_skills: string[];
  soft_skills: string[];
  tools_technologies: string[];
  action_verbs: string[];
  role_expectations: string[];
  seniority_indicators: string[];
  keyword_priorities: {
    must_have: string[];
    nice_to_have: string[];
    industry_terms: string[];
  };
  years_experience: string | null;
  education_requirements: string[];
  culture_signals: string[];
  key_phrases_verbatim: string[];
}

export interface GenerationResult {
  resume: string;
  coverLetter: string;
  jdAnalysis: JDAnalysis;
}
