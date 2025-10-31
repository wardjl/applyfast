// Background service worker for the Chrome extension
import { parseLinkedInJobUrl } from "@/lib/linkedin";

// Track the currently detected LinkedIn job shown to users
let currentLinkedInJob:
  | {
      tabId: number;
      jobId: string;
      jobUrl: string;
      canonicalUrl: string;
    }
  | null = null;

// Track side panel open state
let isSidePanelOpen = false;
const PANEL_STATE_STORAGE_KEY = "applyfastSidePanelOpenState";
const PANEL_STATE_RESET_DELAY_MS = 3000;

// Track active connections from side panel
const sidePanelConnections = new Set<chrome.runtime.Port>();
let panelStateResetTimeoutId: number | undefined;
let hasLoadedPersistedPanelState = false;
let restorePanelStatePromise: Promise<void> | null = null;

function clearPanelStateResetTimeout(): void {
  if (panelStateResetTimeoutId !== undefined) {
    clearTimeout(panelStateResetTimeoutId);
    panelStateResetTimeoutId = undefined;
  }
}

function getPanelStateStorage(): chrome.storage.StorageArea | undefined {
  if (chrome.storage?.session) {
    return chrome.storage.session;
  }
  if (chrome.storage?.local) {
    return chrome.storage.local;
  }
  return undefined;
}

async function restorePanelStateFromStorage(): Promise<void> {
  if (hasLoadedPersistedPanelState) {
    return;
  }

  const storage = getPanelStateStorage();
  if (!storage) {
    hasLoadedPersistedPanelState = true;
    return;
  }

  try {
    const result = await storage.get(PANEL_STATE_STORAGE_KEY);
    isSidePanelOpen = Boolean(result[PANEL_STATE_STORAGE_KEY]);
  } catch (error) {
    console.error("Failed to restore side panel state from storage:", error);
  } finally {
    hasLoadedPersistedPanelState = true;
  }
}

function ensurePanelStateRestored(): Promise<void> {
  if (hasLoadedPersistedPanelState) {
    return Promise.resolve();
  }

  if (!restorePanelStatePromise) {
    restorePanelStatePromise = restorePanelStateFromStorage().finally(() => {
      restorePanelStatePromise = null;
    });
  }

  return restorePanelStatePromise;
}

async function persistPanelState(isOpen: boolean): Promise<void> {
  const storage = getPanelStateStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.set({ [PANEL_STATE_STORAGE_KEY]: isOpen });
  } catch (error) {
    console.error("Failed to persist side panel state:", error);
  }
}

function updatePanelState(isOpen: boolean): void {
  if (isSidePanelOpen === isOpen) {
    return;
  }

  isSidePanelOpen = isOpen;
  void persistPanelState(isOpen);
  broadcastPanelState();
}

void ensurePanelStateRestored().then(() => {
  if (isSidePanelOpen) {
    broadcastPanelState();
  }
});

// Set up side panel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("ApplyFast extension installed");

  // Create context menu for logout
  chrome.contextMenus.create({
    id: "logout",
    title: "Sign Out",
    contexts: ["action"],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "logout") {
    // Clear all stored auth data
    chrome.storage.local.clear(() => {
      console.log("Signed out - all storage cleared");
      // Send message to side panel to trigger re-render
      chrome.runtime.sendMessage({ type: "SIGNED_OUT" }).catch(() => {
        // Ignore errors if side panel is not open
      });
    });
  }
});

function sendJobDetectedMessage(jobId: string, jobUrl: string, canonicalUrl: string) {
  chrome.runtime
    .sendMessage({
      type: "LINKEDIN_JOB_DETECTED",
      jobId,
      jobUrl,
      canonicalUrl,
    })
    .catch(() => {
      // Ignore if side panel is not open
    });
}

function sendJobClearedMessage() {
  if (!currentLinkedInJob) {
    return;
  }

  chrome.runtime
    .sendMessage({
      type: "LINKEDIN_JOB_CLEARED",
    })
    .catch(() => {
      // Ignore if side panel is not open
    });
  currentLinkedInJob = null;
}

function notifyCurrentLinkedInJob() {
  if (!currentLinkedInJob) {
    return;
  }

  sendJobDetectedMessage(
    currentLinkedInJob.jobId,
    currentLinkedInJob.jobUrl,
    currentLinkedInJob.canonicalUrl,
  );
}

function handleActiveTabUrlChange(tabId: number, url?: string) {
  if (!url) {
    sendJobClearedMessage();
    return;
  }

  const detectedJob = parseLinkedInJobUrl(url);

  if (detectedJob) {
    if (
      currentLinkedInJob &&
      currentLinkedInJob.tabId === tabId &&
      currentLinkedInJob.jobId === detectedJob.jobId &&
      currentLinkedInJob.jobUrl === detectedJob.originalUrl
    ) {
      // Same job already reported
      return;
    }

    currentLinkedInJob = {
      tabId,
      jobId: detectedJob.jobId,
      jobUrl: detectedJob.originalUrl,
      canonicalUrl: detectedJob.canonicalUrl,
    };
    sendJobDetectedMessage(
      detectedJob.jobId,
      detectedJob.originalUrl,
      detectedJob.canonicalUrl,
    );
    return;
  }

  sendJobClearedMessage();
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    if (tab.active === true) {
      handleActiveTabUrlChange(tabId, changeInfo.url ?? tab.url);
    }
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      return;
    }

    handleActiveTabUrlChange(tabId, tab.url);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (currentLinkedInJob && currentLinkedInJob.tabId === tabId) {
    sendJobClearedMessage();
  }
});

// Handle messages from content scripts and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "OPEN_SIDE_PANEL": {
      // Open side panel for the tab that sent the message
      if (sender.tab?.id) {
        chrome.sidePanel
          .open({ tabId: sender.tab.id })
          .then(() => {
            clearPanelStateResetTimeout();
            updatePanelState(true);
          })
          .catch((error) => {
            console.error("Failed to open side panel:", error);
          });
      }
      break;
    }
    case "SIDE_PANEL_OPENED": {
      clearPanelStateResetTimeout();
      updatePanelState(true);
      notifyCurrentLinkedInJob();
      break;
    }
    case "SIDE_PANEL_CLOSED": {
      clearPanelStateResetTimeout();
      updatePanelState(false);
      break;
    }
    case "GET_SIDE_PANEL_STATE": {
      if (!hasLoadedPersistedPanelState) {
        ensurePanelStateRestored()
          .catch(() => {
            // Ignore errors; we'll reply with the current in-memory state.
          })
          .finally(() => {
            sendResponse({ isOpen: isSidePanelOpen });
          });
        return true; // Keep channel open for async response
      }

      sendResponse({ isOpen: isSidePanelOpen });
      return true; // Keep channel open for async response
    }
    case "REQUEST_LINKEDIN_JOB_TITLE_COMPANY": {
      if (!currentLinkedInJob) {
        sendResponse({
          success: false,
          error: "No active LinkedIn job detected in the current tab.",
        });
        return;
      }

      chrome.tabs
        .sendMessage(currentLinkedInJob.tabId, { type: "COLLECT_LINKEDIN_JOB_TITLE_COMPANY" })
        .then((response) => {
          if (response) {
            sendResponse(response);
          } else {
            sendResponse({
              success: false,
              error: "Could not read the job title and company from this tab.",
            });
          }
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Job title and company unavailable.",
          });
        });

      return true; // Keep channel open for async response
    }
    case "REQUEST_LINKEDIN_JOB_DETAILS": {
      if (!currentLinkedInJob) {
        sendResponse({
          success: false,
          error: "No active LinkedIn job detected in the current tab.",
        });
        return;
      }

      chrome.tabs
        .sendMessage(currentLinkedInJob.tabId, { type: "COLLECT_LINKEDIN_JOB_DETAILS" })
        .then((response) => {
          if (response) {
            sendResponse(response);
          } else {
            sendResponse({
              success: false,
              error: "Could not read the LinkedIn job details from this tab.",
            });
          }
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "LinkedIn job details unavailable.",
          });
        });

      return true; // Keep channel open for async response
    }
  }
});

// Handle persistent connections from side panel
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "side-panel") {
    sidePanelConnections.add(port);
    clearPanelStateResetTimeout();
    updatePanelState(true);
    notifyCurrentLinkedInJob();

    port.onDisconnect.addListener(() => {
      sidePanelConnections.delete(port);
      if (sidePanelConnections.size === 0 && isSidePanelOpen) {
        clearPanelStateResetTimeout();
        panelStateResetTimeoutId = setTimeout(() => {
          if (sidePanelConnections.size === 0) {
            panelStateResetTimeoutId = undefined;
            updatePanelState(false);
          }
        }, PANEL_STATE_RESET_DELAY_MS);
      }
    });
  }
});

// Broadcast panel state to all LinkedIn tabs
function broadcastPanelState() {
  chrome.tabs
    .query({ url: "*://*.linkedin.com/*" })
    .then((tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs
            .sendMessage(tab.id, {
              type: "SIDE_PANEL_STATE_CHANGED",
              isOpen: isSidePanelOpen,
            })
            .catch(() => {
              // Ignore errors if content script not loaded
            });
        }
      });
    })
    .catch((error) => {
      console.error("Failed to query tabs:", error);
    });
}
