"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import RecurringJobScrapeForm from "./RecurringJobScrapeForm";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { parseLinkedInJobSearchUrl } from "@/lib/linkedin";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function RecurringJobScrapesList() {
  const recurringJobScrapes = useQuery(api.recurringJobScrapes.listRecurringJobScrapes);
  const toggleRecurringJobScrape = useMutation(api.recurringJobScrapes.toggleRecurringJobScrape);
  const deleteRecurringJobScrape = useMutation(api.recurringJobScrapes.deleteRecurringJobScrape);
  const { toast } = useToast();

  const [editingId, setEditingId] = useState<Id<"recurringJobScrapes"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"recurringJobScrapes"> | null>(null);

  const handleToggle = async (id: Id<"recurringJobScrapes">, currentEnabled: boolean) => {
    try {
      await toggleRecurringJobScrape({
        id,
        enabled: !currentEnabled,
      });
      toast({
        title: currentEnabled ? "Search paused" : "Search resumed",
        description: `Recurring search has been ${currentEnabled ? "paused" : "resumed"} successfully.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to toggle recurring search: ${error}`,
      });
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    try {
      await deleteRecurringJobScrape({ id: deletingId });
      toast({
        title: "Search deleted",
        description: "Recurring search has been deleted successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete recurring search: ${error}`,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatSchedule = (scrape: {
    frequency: "daily" | "weekly" | "monthly";
    hour: number;
    minute: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
  }) => {
    const formatTime = (hour: number, minute: number) => {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      return `${h}:${m}`;
    };

    const time = formatTime(scrape.hour, scrape.minute);

    switch (scrape.frequency) {
      case "daily":
        return `Daily at ${time}`;
      case "weekly":
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        return `Weekly on ${days[scrape.dayOfWeek ?? 0]} at ${time}`;
      case "monthly":
        return `Monthly on day ${scrape.dayOfMonth ?? 1} at ${time}`;
      default:
        return "Unknown schedule";
    }
  };

  const getDisplayLocation = (scrape: { location?: string | null; linkedinUrl: string }) => {
    if (scrape.location && scrape.location.trim().length > 0) {
      return scrape.location;
    }
    const parsed = parseLinkedInJobSearchUrl(scrape.linkedinUrl);
    return parsed?.location || "—";
  };

  const formatNextRun = (nextRun: number | undefined) => {
    if (!nextRun) return "Not scheduled";
    const date = new Date(nextRun);
    return date.toLocaleString();
  };

  const formatLastRun = (lastRun: number | undefined) => {
    if (!lastRun) return "Never";
    const date = new Date(lastRun);
    return date.toLocaleString();
  };

  if (recurringJobScrapes === undefined) {
    return <div>Loading recurring job searches...</div>;
  }

  const editingData = editingId
    ? recurringJobScrapes.find((scrape) => scrape._id === editingId)
    : null;

  return (
    <>
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recurring search?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this recurring job search configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <RecurringJobScrapeForm
            existingData={editingData}
            onSuccess={() => setEditingId(null)}
            onCancel={() => setEditingId(null)}
            onDelete={(id) => setDeletingId(id)}
          />
        </div>
      )}

      <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-10rem)]">
        {recurringJobScrapes.length === 0 ? (
          <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-3 p-12 text-center text-gray-500 dark:text-gray-400">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              No Schedules Yet
            </h3>
            <p className="max-w-md">
              Create your first recurring search to keep new opportunities coming in automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {recurringJobScrapes.map((scrape) => (
              <div
                key={scrape._id}
                className={`border rounded-lg p-4 ${
                  scrape.enabled
                    ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                    : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{scrape.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatSchedule(scrape)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        scrape.enabled
                          ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {scrape.enabled ? "Active" : "Paused"}
                    </span>
                  </div>
                </div>

                <div className="text-sm space-y-1 mb-3">
                  <p>
                    <strong>Location:</strong> {getDisplayLocation(scrape)}
                  </p>
                  <p>
                    <strong>URL:</strong>{" "}
                    <a
                      href={scrape.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate block max-w-xs text-gray-600 dark:text-gray-400 hover:underline"
                      title={scrape.linkedinUrl}
                    >
                      {scrape.linkedinUrl}
                    </a>
                  </p>
                  <p>
                    <strong>Last Run:</strong> {formatLastRun(scrape.lastRun)}
                  </p>
                  <p>
                    <strong>Next Run:</strong> {formatNextRun(scrape.nextRun)}
                  </p>
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(scrape._id, scrape.enabled)}
                    >
                      {scrape.enabled ? "Pause" : "Resume"}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingId(scrape._id)}
                    >
                      Edit
                    </Button>
                  </div>

                  <div className="text-xs text-gray-500">
                    Created: {new Date(scrape.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
