/**
 * Answer Generator
 * Generates human-sounding answers for long-form job application questions.
 * Uses the configured LLM provider with specially tuned prompts.
 */

import { LLMProvider } from '../models/providers/types';
import { ANSWER_PROMPTS } from '../models/answerPrompts';

export class AnswerGenerator {
  constructor(private llm: LLMProvider) {}

  /**
   * Generate an answer for a job application question
   */
  async generateAnswer(
    question: string,
    jdText: string,
    userProfileSummary: string,
    maxLength?: number
  ): Promise<string> {
    const systemPrompt = ANSWER_PROMPTS.system(jdText, userProfileSummary);
    const userPrompt = ANSWER_PROMPTS.user(question);

    const response = await this.llm.generate(userPrompt, {
      systemPrompt,
      temperature: 0.8, // Higher temp for more natural variation
    });

    let answer = response.content.trim();

    // Remove any quotes the LLM might wrap the answer in
    if (answer.startsWith('"') && answer.endsWith('"')) {
      answer = answer.slice(1, -1);
    }

    // Remove any bullet points the LLM might have snuck in
    answer = answer
      .replace(/^[-•*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '');

    // Respect max length
    if (maxLength && answer.length > maxLength) {
      // Truncate at the last sentence boundary before maxLength
      const truncated = answer.slice(0, maxLength - 3);
      const lastSentence = truncated.lastIndexOf('.');
      if (lastSentence > maxLength * 0.5) {
        answer = truncated.slice(0, lastSentence + 1);
      } else {
        answer = truncated + '...';
      }
    }

    return answer;
  }

  /**
   * Build a user profile summary string for the prompt
   */
  static buildProfileSummary(profile: {
    fullName?: string;
    currentRole?: string;
    currentCompany?: string;
    totalYearsExperience?: number;
    topSkills?: string[];
    education?: Array<{ degree: string; college: string }>;
  }): string {
    const parts: string[] = [];

    if (profile.fullName) parts.push(`Name: ${profile.fullName}`);
    if (profile.currentRole) {
      parts.push(`Current role: ${profile.currentRole}${profile.currentCompany ? ` at ${profile.currentCompany}` : ''}`);
    }
    if (profile.totalYearsExperience) {
      parts.push(`${profile.totalYearsExperience} years of experience`);
    }
    if (profile.topSkills?.length) {
      parts.push(`Key skills: ${profile.topSkills.join(', ')}`);
    }
    if (profile.education?.length) {
      const edu = profile.education[0];
      parts.push(`Education: ${edu.degree} from ${edu.college}`);
    }

    return parts.join('. ') + '.';
  }
}
