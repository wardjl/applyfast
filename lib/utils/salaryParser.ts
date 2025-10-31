/**
 * Utility to parse salary ranges from various formats
 */

export interface ParsedSalaryRange {
  min: string;
  max: string;
}

/**
 * Parses a salary range string into min and max values
 * Handles various formats:
 * - "$50,000 - $80,000"
 * - "50k-80k"
 * - "50-80K USD"
 * - "€50.000 - €80.000"
 * - "50000-80000"
 */
export function parseSalaryRange(salaryRange: string): ParsedSalaryRange {
  if (!salaryRange || typeof salaryRange !== "string") {
    return { min: "", max: "" };
  }

  // Remove currency symbols and common suffixes
  const cleaned = salaryRange
    .replace(/[$€£¥₹]/g, "")
    .replace(/\s*(USD|EUR|GBP|INR|CAD|AUD)\s*/gi, "")
    .trim();

  // Handle "k" or "K" suffix (thousands)
  const hasKSuffix = /\d+k/gi.test(cleaned);

  // Extract all numbers (with or without decimal separators)
  // Matches: 50,000 | 50.000 | 50000 | 50k
  const numberPattern = /(\d+(?:[.,]\d+)*)\s*k?/gi;
  const matches = Array.from(cleaned.matchAll(numberPattern));

  if (matches.length === 0) {
    return { min: "", max: "" };
  }

  // Extract and clean the numbers
  const extractNumber = (match: RegExpMatchArray): string => {
    const num = match[1].replace(/[.,]/g, "");
    // If the original had "k" suffix, multiply by 1000
    if (hasKSuffix && match[0].toLowerCase().includes("k")) {
      return (parseInt(num, 10) * 1000).toString();
    }
    return num;
  };

  const min = extractNumber(matches[0]);
  const max = matches.length > 1 ? extractNumber(matches[1]) : "";

  return { min, max };
}

/**
 * Format a salary range for display
 */
export function formatSalaryRange(min: string, max: string, currency = "$"): string {
  if (!min && !max) {
    return "";
  }

  const formatNumber = (num: string): string => {
    if (!num) return "";
    const parsed = parseInt(num, 10);
    if (isNaN(parsed)) return "";
    return parsed.toLocaleString("en-US");
  };

  const formattedMin = formatNumber(min);
  const formattedMax = formatNumber(max);

  if (formattedMin && formattedMax) {
    return `${currency}${formattedMin} - ${currency}${formattedMax}`;
  } else if (formattedMin) {
    return `${currency}${formattedMin}+`;
  } else if (formattedMax) {
    return `Up to ${currency}${formattedMax}`;
  }

  return "";
}
