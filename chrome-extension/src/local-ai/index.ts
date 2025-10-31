/**
 * Local AI Module
 *
 * This module provides local AI-powered job scoring using Chrome's built-in Gemini Nano model.
 * All exports from this module are optional - the extension will continue to work if this
 * folder is deleted.
 */

export { LocalJobScoring } from './LocalJobScoring';
export { LocalJobScoringStream } from './LocalJobScoringStream';
export { isChromeAIAvailable, getChromeAICapabilities } from './chrome-ai-provider';
export { scoreJobWithLocalAI, jobScoringSchema } from './scoring-utils';
export type { JobScoringResult } from './scoring-utils';
