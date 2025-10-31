import { parseLinkedInJobUrl } from "@/lib/linkedin";
import {
  LinkedInBasicJobInfo,
  LinkedInJobDetailsPayload,
  LinkedInJobSection,
  normalizeWhitespace,
} from "../shared/linkedin";

type NullableElement = Element | null;

const EMPLOYMENT_KEYWORDS = ["full-time", "part-time", "contract", "temporary", "internship", "volunteer", "freelance"];
const WORKPLACE_KEYWORDS = ["remote", "hybrid", "on-site", "onsite", "on site"];

const textFromElement = (element: NullableElement): string | null => {
  if (!element) return null;
  const text = element.textContent?.replace(/\u00a0/g, " ").trim();
  if (!text) return null;
  return text.replace(/\s+/g, " ");
};

const textFromHtml = (html: string | null | undefined): string | null => {
  if (!html) return null;
  const temp = document.createElement("div");
  temp.innerHTML = html;
  const text = temp.innerText.replace(/\u00a0/g, " ").replace(/\r+/g, "\n");
  return text.split("\n").map((line) => line.trim()).filter(Boolean).join("\n");
};

const htmlFromElement = (element: NullableElement): string | null => {
  if (!element) return null;
  return element.innerHTML;
};

const listItemsFromElement = (element: NullableElement): string[] => {
  if (!element) return [];
  return Array.from(element.querySelectorAll("li"))
    .map((item) => normalizeWhitespace(item.textContent))
    .filter((item): item is string => Boolean(item));
};

const findHeadingForList = (root: Element, list: Element): string | null => {
  let current: Element | null = list;
  while (current && current !== root) {
    let sibling: Element | null = current.previousElementSibling;
    while (sibling) {
      const strong = sibling.querySelector("strong, b");
      const candidate = normalizeWhitespace(strong?.textContent ?? sibling.textContent);
      if (candidate) {
        return candidate;
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return null;
};

const extractSections = (descriptionRoot: Element | null) => {
  const sections: LinkedInJobSection[] = [];
  const responsibilities: string[] = [];
  const qualifications: string[] = [];
  const contractDetails: string[] = [];
  const warnings: string[] = [];

  if (!descriptionRoot) {
    return { sections, responsibilities, qualifications, contractDetails, warnings };
  }

  const lists = Array.from(descriptionRoot.querySelectorAll("ul"));
  for (const list of lists) {
    const parentUl = list.parentElement?.closest("ul");
    if (parentUl && parentUl !== list) {
      continue;
    }

    const items = listItemsFromElement(list);
    if (items.length === 0) {
      continue;
    }

    const heading = findHeadingForList(descriptionRoot, list);
    const sectionHeading = heading ?? "Details";
    const normalizedHeading = sectionHeading.toLowerCase();

    if (normalizedHeading.includes("responsibil")) {
      responsibilities.push(...items);
    } else if (
      normalizedHeading.includes("qualification") ||
      normalizedHeading.includes("experience") ||
      normalizedHeading.includes("skills")
    ) {
      qualifications.push(...items);
    } else if (normalizedHeading.includes("contract")) {
      contractDetails.push(...items);
    } else if (normalizedHeading.includes("fraud") || normalizedHeading.includes("vacature")) {
      warnings.push(...items);
    }

    sections.push({
      heading: sectionHeading,
      items,
    });
  }

  return { sections, responsibilities, qualifications, contractDetails, warnings };
};

const extractCompanyDescription = (container: NullableElement) => {
  if (!container) {
    return { html: null, text: null };
  }
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button").forEach((button) => button.remove());
  const html = clone.innerHTML;
  const text = clone.innerText.replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
  return {
    html,
    text: text || null,
  };
};

const collectJobDetails = (): LinkedInJobDetailsPayload | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const jobUrl = window.location.href;
  const parsedUrl = parseLinkedInJobUrl(jobUrl);
  const layoutVariant = document.querySelector(".job-details-jobs-unified-top-card__container")
    ? "unified-top-card"
    : document.querySelector(".jobs-job-details-card") ? "legacy-card" : "unknown";

  const titleElement = document.querySelector(".job-details-jobs-unified-top-card__job-title h1, .jobs-unified-top-card__job-title h1, h1.topcard__title");
  const companyAnchor = document.querySelector(".job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a, .topcard__org-name-link");
  const companyLogoElement = document.querySelector(".job-details-jobs-unified-top-card__company-name img, .jobs-unified-top-card__company-logo img, .topcard__logo-img");
  const tertiaryContainer = document.querySelector(".job-details-jobs-unified-top-card__tertiary-description-container, .jobs-unified-top-card__subtitle-primary-grouping");
  const badgesContainer = document.querySelector(".job-details-fit-level-preferences, .jobs-unified-top-card__job-insight");
  const descriptionContainer = document.querySelector("#job-details, .jobs-description-content__text, .jobs-description__container");
  const companyInfoContainer = document.querySelector(".jobs-company__box .t-14.mt5, .jobs-company__footer + .t-14, .jobs-company__box .t-14");
  const companyInlineInfo = companyInfoContainer
    ? Array.from(companyInfoContainer.querySelectorAll(".jobs-company__inline-information"))
    : [];
  const companyDescriptionContainer = document.querySelector(".jobs-company__company-description");
  const hiringTeamContainer = document.querySelector(".job-details-people-who-can-help__section--two-pane, .hirer-card__hirer-information");

  const title = textFromElement(titleElement);
  const companyName = textFromElement(companyAnchor);
  if (!title || !companyName) {
    return null;
  }

  const companyUrl = (companyAnchor as HTMLAnchorElement | null)?.href ?? null;
  const companyLogo = (companyLogoElement as HTMLImageElement | null)?.src ?? null;

  const tertiaryItems = tertiaryContainer
    ? Array.from(tertiaryContainer.querySelectorAll("span, time"))
        .map((item) => normalizeWhitespace(item.textContent))
        .filter((item): item is string => Boolean(item && item !== "·"))
    : [];

  let location: string | null = null;
  let postedAt: string | null = null;
  let applicantsCount: string | null = null;

  for (const item of tertiaryItems) {
    if (!location && item && !/\d/.test(item) && !item.toLowerCase().includes("people") && !item.toLowerCase().includes("applicant")) {
      location = item;
      continue;
    }
    if (!postedAt && /\bago\b/i.test(item)) {
      postedAt = item;
      continue;
    }
    if (!applicantsCount && (item.toLowerCase().includes("people") || item.toLowerCase().includes("applicant"))) {
      applicantsCount = item;
      continue;
    }
  }

  const badges = badgesContainer
    ? Array.from(badgesContainer.querySelectorAll("button span, .jobs-unified-top-card__job-insight-text, .jobs-unified-top-card__badge"))
        .map((badge) => normalizeWhitespace(badge.textContent))
        .filter((badge): badge is string => Boolean(badge))
    : [];

  let employmentType: string | null = null;
  let workplaceType: string | null = null;

  for (const badge of badges) {
    const lower = badge.toLowerCase();
    if (!employmentType && EMPLOYMENT_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      employmentType = badge;
    }
    if (!workplaceType && WORKPLACE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      workplaceType = badge;
    }
  }

  const descriptionHtml = htmlFromElement(descriptionContainer);
  const descriptionText = descriptionContainer ? textFromHtml(descriptionContainer.innerHTML) : null;

  const sectionExtraction = extractSections(descriptionContainer as Element | null);

  let companyIndustry: string | null = null;
  if (companyInfoContainer) {
    const clone = companyInfoContainer.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("span.jobs-company__inline-information").forEach((span) => span.remove());
    companyIndustry = normalizeWhitespace(clone.textContent);
  }

  const companySize = companyInlineInfo[0] ? normalizeWhitespace(companyInlineInfo[0].textContent) : null;
  const companyLinkedInCount = companyInlineInfo[1] ? normalizeWhitespace(companyInlineInfo[1].textContent) : null;

  const companyDescription = extractCompanyDescription(companyDescriptionContainer);

  let jobPoster: LinkedInJobDetailsPayload["jobPoster"] = null;
  if (hiringTeamContainer) {
    const name = normalizeWhitespace(
      hiringTeamContainer.querySelector(".jobs-poster__name, strong")?.textContent ?? undefined,
    );
    const titleText = normalizeWhitespace(
      hiringTeamContainer.querySelector(".jobs-poster__headline, .linked-area .t-12, .linked-area .t-14")?.textContent ?? undefined,
    );
    const profileAnchor = hiringTeamContainer.querySelector("a[href*='linkedin.com/in/']") as HTMLAnchorElement | null;
    if (name || titleText || profileAnchor?.href) {
      jobPoster = {
        name,
        title: titleText,
        profileUrl: profileAnchor?.href ?? null,
      };
    }
  }

  const findApplyUrl = (): string | null => {
    const candidateValues = new Set<string>();

    const applyButton = document.querySelector("button.jobs-apply-button") as HTMLButtonElement | null;
    if (applyButton) {
      const attrCandidates = ["data-apply-url", "data-offsite-url", "data-job-url", "data-url", "data-redirect-url"];
      for (const attr of attrCandidates) {
        const value = applyButton.getAttribute(attr);
        if (value) candidateValues.add(value);
      }
      const buttonContainer = applyButton.closest(".jobs-s-apply, .jobs-apply-button--top-card");
      const anchorInContainer = buttonContainer?.querySelector("a[href]") as HTMLAnchorElement | null;
      if (anchorInContainer?.href) candidateValues.add(anchorInContainer.href);
      Object.values(applyButton.dataset ?? {}).forEach((value) => {
        if (typeof value === "string" && /^https?:\/\//i.test(value)) {
          candidateValues.add(value);
        }
      });
      const easyApply = applyButton.classList.contains("jobs-apply-button--linkedin") ||
        applyButton.textContent?.toLowerCase().includes("easy apply");
      if (easyApply && candidateValues.size === 0) {
        return null;
      }
    }

    const anchorSelectors = [
      "a[data-tracking-control-name*='jobdetails_topcard_apply']",
      "a[data-control-name*='jobdetails_topcard']",
      "a.jobs-apply-button[href]",
    ];

    for (const selector of anchorSelectors) {
      const anchor = document.querySelector(selector) as HTMLAnchorElement | null;
      if (anchor?.href) candidateValues.add(anchor.href);
    }

    const decodeEscapedUrl = (value: string) => {
      try {
        return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
      } catch {
        return value;
      }
    };

    if (candidateValues.size === 0) {
      const match = document.body.innerHTML.match(/\"applyUrl\":\"(https?:[^"]+)\"/);
      if (match?.[1]) {
        candidateValues.add(decodeEscapedUrl(match[1]));
      }
    }

    if (candidateValues.size === 0) {
      const dataScripts = Array.from(
        document.querySelectorAll("script[type='application/ld+json'], script[data-component=\"job-details\"]")
      );
      for (const script of dataScripts) {
        try {
          const jsonText = script.textContent?.trim();
          if (!jsonText) continue;
          const data = JSON.parse(jsonText);
          const applyUrl = (data?.hiringOrganization?.website || data?.jobPosting?.applyUri || data?.applyUrl || data?.applyLink) as string | undefined;
          if (applyUrl) candidateValues.add(applyUrl);
        } catch {
          continue;
        }
      }
    }

    for (const candidate of candidateValues) {
      if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) {
        return candidate;
      }
    }

    return null;
  };

  const applyUrlFromButton = findApplyUrl();

  const payload: LinkedInJobDetailsPayload = {
    jobId: parsedUrl?.jobId ?? null,
    jobUrl,
    canonicalUrl: parsedUrl?.canonicalUrl ?? null,
    capturedAt: Date.now(),
    layoutVariant,
    title,
    companyName,
    companyUrl,
    companyLogo,
    location,
    postedAt,
    applicantsCount,
    employmentType,
    workplaceType,
    badges,
    descriptionHtml,
    descriptionText,
    responsibilities: sectionExtraction.responsibilities,
    qualifications: sectionExtraction.qualifications,
    contractDetails: sectionExtraction.contractDetails,
    additionalSections: sectionExtraction.sections,
    companyIndustry,
    companySize,
    companyLinkedInCount,
    companyDescriptionHtml: companyDescription.html,
    companyDescriptionText: companyDescription.text,
    jobPoster,
    applyUrl: applyUrlFromButton,
    warnings: sectionExtraction.warnings,
    rawHtml: htmlFromElement(document.querySelector(".job-view-layout.jobs-details, .jobs-details")),
  };

  return payload;
};

/**
 * Lightweight extraction of just job title, company name, and location
 * Used for quick UI updates without fetching full job details
 */
const collectBasicJobInfo = (): LinkedInBasicJobInfo => {
  if (typeof window === "undefined") {
    return { title: null, company: null, location: null };
  }

  const titleElement = document.querySelector(
    ".job-details-jobs-unified-top-card__job-title h1, .jobs-unified-top-card__job-title h1, h1.topcard__title",
  );
  const companyAnchor = document.querySelector(
    ".job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a, .topcard__org-name-link",
  );
  const tertiaryContainer = document.querySelector(
    ".job-details-jobs-unified-top-card__tertiary-description-container, .jobs-unified-top-card__subtitle-primary-grouping",
  );

  const title = textFromElement(titleElement);
  const company = textFromElement(companyAnchor);

  let location: string | null = null;

  if (tertiaryContainer) {
    const tertiaryItems = Array.from(tertiaryContainer.querySelectorAll("span, time"))
      .map((item) => normalizeWhitespace(item.textContent))
      .filter((item): item is string => Boolean(item && item !== "·"));

    for (const item of tertiaryItems) {
      if (
        item &&
        !/\d/.test(item) &&
        !item.toLowerCase().includes("people") &&
        !item.toLowerCase().includes("applicant")
      ) {
        location = item;
        break;
      }
    }
  }

  if (!location) {
    const locationElement = document.querySelector(
      ".jobs-unified-top-card__bullet, .job-details-jobs-unified-top-card__bullet, .topcard__flavor--bullet",
    );
    location = textFromElement(locationElement);
  }

  return { title, company, location };
};

let hasInitializedManualCapture = false;

export const initializeLinkedInManualCapture = () => {
  if (hasInitializedManualCapture) {
    return;
  }
  hasInitializedManualCapture = true;

  if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
    return;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Handle lightweight title/company request
    if (message?.type === "COLLECT_LINKEDIN_JOB_TITLE_COMPANY") {
      try {
        const { title, company, location } = collectBasicJobInfo();
        if (title || company || location) {
          sendResponse({ success: true, title, company, location });
        } else {
          sendResponse({
            success: false,
            error: "We couldn't find the job title, company, or location on this page.",
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unexpected error while reading job title, company, or location.";
        sendResponse({ success: false, error: errorMessage });
      }
      return;
    }

    // Handle full job details request
    if (message?.type === "COLLECT_LINKEDIN_JOB_DETAILS") {
      try {
        const payload = collectJobDetails();
        if (payload) {
          sendResponse({ success: true, payload });
        } else {
          sendResponse({
            success: false,
            error:
              "We couldn't read the LinkedIn job details. Make sure the job description is visible and the job page is fully loaded.",
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unexpected error while reading LinkedIn job details.";
        sendResponse({ success: false, error: message });
      }
      return;
    }
  });
};
