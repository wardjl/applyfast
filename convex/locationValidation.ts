import { v } from "convex/values";
import { action } from "./_generated/server";
import { generateObject } from "ai";
import { z } from "zod";

// Define the Zod schema for location validation response
const locationValidationSchema = z.object({
  isSpecific: z.boolean().describe("Whether the location includes both city AND country/region (e.g., 'Amsterdam, Netherlands')"),
  suggestedLocation: z.string().nullable().describe("Full specific location in format: City, Region/State, Country. Null if already specific."),
  confidence: z.enum(["high", "medium", "low"]).describe("Confidence level of the suggestion based on common usage")
});

// Action to validate if a location is specific enough for LinkedIn job search
export const validateLocation = action({
  args: {
    location: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const trimmedLocation = args.location.trim();

      // If location is empty, return immediately
      if (!trimmedLocation) {
        return {
          isSpecific: true,
          suggestedLocation: null,
          confidence: "high" as const,
        };
      }

      // Generate validation using AI Gateway with Gemini 2.0 Flash
      // The AI Gateway automatically uses AI_GATEWAY_API_KEY environment variable
      const { object: validation } = await generateObject({
        model: 'openai/gpt-4.1-nano',
        schema: locationValidationSchema,
        system: `You are a location disambiguation assistant for LinkedIn job searches.

Your goal is to ensure locations are specific enough to get accurate search results on LinkedIn.

A SPECIFIC location includes:
- City name AND country/region (e.g., "Amsterdam, Netherlands", "London, United Kingdom")
- City, State/Province, Country for ambiguous city names (e.g., "Portland, Oregon, United States")
- Common metropolitan areas with clear context (e.g., "San Francisco Bay Area")

An AMBIGUOUS location includes:
- Only a city name without country (e.g., "Amsterdam", "Portland", "Paris")
- City abbreviations (e.g., "NYC", "SF", "LA")
- Regions without city (e.g., "Bay Area", "Midwest")
- Misspellings or unclear locations

When suggesting locations:
- Use the most commonly searched/intended location for that place name
- Format as: "City, Region/State, Country"
- For US cities, include state name
- Use official country names (e.g., "United States", "United Kingdom", "Netherlands")
- Be confident about major cities and their countries`,
        prompt: `Validate this location for a LinkedIn job search: "${trimmedLocation}"

Is it specific enough? If not, suggest the most commonly intended full location.

Examples:
- "Amsterdam" → NOT specific, suggest "Amsterdam, North Holland, Netherlands"
- "Amsterdam, Netherlands" → IS specific, no suggestion needed
- "NYC" → NOT specific, suggest "New York City, New York, United States"
- "San Francisco" → NOT specific, suggest "San Francisco, California, United States"
- "London" → NOT specific, suggest "London, England, United Kingdom"
- "Paris, France" → IS specific, no suggestion needed`,
      });

      return {
        isSpecific: validation.isSpecific,
        suggestedLocation: validation.suggestedLocation,
        confidence: validation.confidence,
      };
    } catch (error) {
      console.error("Location validation error:", error);

      // Fallback: treat location as specific (fail-safe)
      return {
        isSpecific: true,
        suggestedLocation: null,
        confidence: "low" as const,
      };
    }
  },
});
