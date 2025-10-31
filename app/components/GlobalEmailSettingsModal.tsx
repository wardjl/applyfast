"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import EmailSettingsModal from "./EmailSettingsModal";
import { useToast } from "@/hooks/use-toast";

interface EmailSettings {
  enabled: boolean;
  timing: "auto" | "manual";
  delayMinutes: number;
  manualTime?: {
    hour: number;
    minute: number;
  };
}

interface GlobalEmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalEmailSettingsModal({
  isOpen,
  onClose,
}: GlobalEmailSettingsModalProps) {
  const recurringJobScrapes = useQuery(api.recurringJobScrapes.listRecurringJobScrapes);
  const updateRecurringJobScrape = useMutation(api.recurringJobScrapes.updateRecurringJobScrape);
  const { toast } = useToast();

  const [selectedScrapeId, setSelectedScrapeId] = useState<Id<"recurringJobScrapes"> | null>(null);
  const [showEmailSettingsModal, setShowEmailSettingsModal] = useState(false);

  const getEmailSettings = (scrape: {
    emailSettings?: EmailSettings;
    digestEnabled?: boolean;
  }): EmailSettings => {
    // Handle new format
    if (scrape.emailSettings) {
      return scrape.emailSettings;
    }

    // Handle legacy format
    if (scrape.digestEnabled !== undefined) {
      return {
        enabled: scrape.digestEnabled,
        timing: "auto",
        delayMinutes: 5,
        manualTime: undefined,
      };
    }

    // Default
    return {
      enabled: true,
      timing: "auto",
      delayMinutes: 5,
      manualTime: undefined,
    };
  };

  const handleEmailSettingsUpdate = async (scrapeId: Id<"recurringJobScrapes">, settings: EmailSettings) => {
    try {
      await updateRecurringJobScrape({
        id: scrapeId,
        emailSettings: settings,
      });
      setShowEmailSettingsModal(false);
      setSelectedScrapeId(null);
      toast({
        title: "Email settings updated",
        description: "Your email notification settings have been saved successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update email settings: ${error}`,
      });
    }
  };

  const openEmailSettings = (scrapeId: Id<"recurringJobScrapes">) => {
    setSelectedScrapeId(scrapeId);
    setShowEmailSettingsModal(true);
  };

  const formatEmailSettings = (settings: EmailSettings) => {
    if (!settings.enabled) {
      return "Disabled";
    }

    if (settings.timing === "auto") {
      return `Auto (${settings.delayMinutes}min delay)`;
    }

    if (settings.timing === "manual" && settings.manualTime) {
      return `Manual (${settings.manualTime.hour.toString().padStart(2, '0')}:${settings.manualTime.minute.toString().padStart(2, '0')})`;
    }

    return "Auto (5min delay)";
  };

  const selectedScrape = selectedScrapeId
    ? recurringJobScrapes?.find(s => s._id === selectedScrapeId)
    : null;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">📧 Email Settings Management</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage email notification settings for all your recurring job scrapes
            </p>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {!recurringJobScrapes || recurringJobScrapes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  No recurring job scrapes found. Create a recurring scrape to manage email settings.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recurringJobScrapes.map((scrape) => {
                  const emailSettings = getEmailSettings(scrape);
                  const isActive = scrape.enabled && emailSettings.enabled;
                  return (
                    <div
                      key={scrape._id}
                      className={`border rounded-lg p-4 ${
                        isActive
                          ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                          : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-lg">{scrape.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {scrape.frequency.charAt(0).toUpperCase() + scrape.frequency.slice(1)} •
                            Next run: {scrape.nextRun ? new Date(scrape.nextRun).toLocaleString() : "Not scheduled"}
                          </p>
                          <div className="mt-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Email notifications:
                            </span>
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                              emailSettings.enabled
                                ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                                : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                            }`}>
                              {formatEmailSettings(emailSettings)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            isActive
                              ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                          }`}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                          <button
                            onClick={() => openEmailSettings(scrape._id)}
                            className="bg-black text-white px-3 py-1 rounded-md hover:bg-gray-800 transition-colors text-sm dark:bg-white dark:text-black dark:hover:bg-gray-200"
                          >
                            Edit Email Settings
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedScrape && (
        <EmailSettingsModal
          isOpen={showEmailSettingsModal}
          onClose={() => {
            setShowEmailSettingsModal(false);
            setSelectedScrapeId(null);
          }}
          onSave={(settings) => handleEmailSettingsUpdate(selectedScrapeId!, settings)}
          initialSettings={getEmailSettings(selectedScrape)}
        />
      )}
    </>
  );
}