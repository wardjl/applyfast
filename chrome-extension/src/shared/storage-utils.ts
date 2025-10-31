/**
 * Chrome Storage utilities for persisting user preferences
 */

const SELECTED_MODEL_KEY = "selectedAIModel";

export type AIModelType = "local" | "cloud";

/**
 * Get the saved AI model preference from Chrome storage
 * @returns Promise resolving to the saved model or "local" as default
 */
export async function getSelectedModel(): Promise<AIModelType> {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return "local";
    }

    const result = await chrome.storage.local.get(SELECTED_MODEL_KEY);
    const saved = result[SELECTED_MODEL_KEY];

    // Validate the saved value
    if (saved === "local" || saved === "cloud") {
      return saved;
    }

    // Default to local if no valid value is saved
    return "local";
  } catch (error) {
    console.error("[Storage] Failed to get selected model:", error);
    return "local";
  }
}

/**
 * Save the AI model preference to Chrome storage
 * @param model - The AI model type to save ("local" or "cloud")
 */
export async function setSelectedModel(model: AIModelType): Promise<void> {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      console.warn("[Storage] Chrome storage API not available");
      return;
    }

    await chrome.storage.local.set({ [SELECTED_MODEL_KEY]: model });
    console.log("[Storage] Saved selected model:", model);
  } catch (error) {
    console.error("[Storage] Failed to save selected model:", error);
  }
}
