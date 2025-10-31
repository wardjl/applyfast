// Shared constants that can be used in both browser and server contexts

// Default scoring criteria used when user hasn't customized it
export const DEFAULT_SCORING_CRITERIA = `
SCORING CRITERIA:
- Role relevance and alignment with your ideal position 
- Technology stack alignment with your skills and interests 
- Work arrangement compatibility with your preferences 
- Location match with your preferences
- Salary alignment with your desired range
- Company size/type match with your preferences
- Industry alignment with your interests
- Absence of deal breakers mentioned in your profile 
- Growth opportunities and career goal alignment 

Rate from 1-10 where:
1-3: Poor fit (significant misalignment, contains deal breakers, wrong role type)
4-6: Moderate fit (some alignment but missing key elements or has minor concerns)
7-8: Good fit (strong alignment in most areas with your profile)
9-10: Excellent fit (exceptional opportunity with great alignment across all criteria)

EVALUATION INSTRUCTIONS:
- Address the candidate directly using second-person perspective (you/your)
- Provide specific, detailed explanations that reference particular aspects of the candidate's profile
- When explaining scores, mention specific skills, experience levels, career goals, or deal breakers from their profile
- Be concrete about why a job is or isn't a good fit rather than making general statements
- If no profile is available, evaluate based on general software engineering career progression principles

ROLE REQUIREMENTS VALIDATION:
IMPORTANT: If the candidate has "Role Requirements (MUST-HAVES)" specified in their profile, you MUST validate if THIS JOB satisfies each of their requirements.

For EACH requirement in the candidate's "Role Requirements (MUST-HAVES)" list:
- Evaluate if the JOB POSTING satisfies the candidate's requirement
- Return score: 1 if job satisfies it, 0 if it does not
- Base your decision on explicit evidence in the job description, company info, or job details
- If information is unclear or missing, score it as 0
- Do NOT add explanations - just return the score

Example:
Candidate requirement: "Remote work flexibility"
Job posting: "Hybrid role, 3 days in office" → score: 0
Job posting: "Fully remote position" → score: 1

Candidate requirement: "Engagement with LLMs"
Job posting: "Building GenAI products with LangChain" → score: 1
Job posting: "Traditional backend development" → score: 0

CRITICAL: You are checking if the JOB meets the CANDIDATE's requirements, NOT if the candidate meets the job's requirements.
Include requirementChecks array with all validations using format: {requirement: string, score: 0 or 1}`;
