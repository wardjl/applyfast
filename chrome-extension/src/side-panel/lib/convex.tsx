import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "https://your-deployment.convex.cloud";

// Create the Convex client
const convex = new ConvexReactClient(CONVEX_URL);

// Auth storage using Chrome Storage API
const chromeStorage = {
  getItem: async (key: string) => {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  },
  setItem: async (key: string, value: string) => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string) => {
    await chrome.storage.local.remove(key);
  },
};

export function ConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} storage={chromeStorage}>
      {children}
    </ConvexAuthProvider>
  );
}

export { convex };
