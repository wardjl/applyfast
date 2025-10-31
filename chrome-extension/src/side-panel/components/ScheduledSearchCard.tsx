import { Bell, BellOff, Trash2, Clock, Repeat, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface ScheduledSearchCardProps {
  id: Id<"recurringJobScrapes">;
  name: string;
  linkedinUrl: string;
  frequency: "daily" | "weekly" | "monthly";
  emailNotificationsEnabled: boolean;
  enabled: boolean;
  hour: number;
  minute: number;
}

// Extract job title and location from LinkedIn URL
function extractSearchDetails(linkedinUrl: string): { jobTitle: string; location: string } {
  try {
    const url = new URL(linkedinUrl);
    const keywords = url.searchParams.get("keywords") || url.searchParams.get("title") || "";
    const location = url.searchParams.get("location") || "";

    return {
      jobTitle: keywords || "Job Search",
      location: location || "Any Location",
    };
  } catch {
    return {
      jobTitle: "Job Search",
      location: "Any Location",
    };
  }
}

export function ScheduledSearchCard({
  id,
  name,
  linkedinUrl,
  frequency,
  emailNotificationsEnabled,
  enabled,
  hour,
  minute,
}: ScheduledSearchCardProps) {
  const toggleRecurringJobScrape = useMutation(api.recurringJobScrapes.toggleRecurringJobScrape);
  const deleteRecurringJobScrape = useMutation(api.recurringJobScrapes.deleteRecurringJobScrape);

  const { jobTitle, location } = extractSearchDetails(linkedinUrl);
  const formattedTime = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

  const handleTogglePauseResume = async () => {
    try {
      await toggleRecurringJobScrape({
        id,
        enabled: !enabled,
      });
    } catch (error) {
      console.error("Failed to toggle scheduled search:", error);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this scheduled search?")) {
      try {
        await deleteRecurringJobScrape({ id });
      } catch (error) {
        console.error("Failed to delete scheduled search:", error);
      }
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border shadow group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.01] cursor-pointer",
        enabled
          ? "border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-600 hover:border-green-600 dark:hover:border-green-500"
          : "border-border/50 bg-muted/50 hover:border-border opacity-60"
      )}
      onClick={handleTogglePauseResume}
    >
      {/* Gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity",
          enabled
            ? "bg-gradient-to-br from-green-500/15 via-green-500/5 to-transparent opacity-100"
            : "bg-gradient-to-br from-muted/5 via-transparent to-transparent opacity-0 group-hover:opacity-100"
        )}
      />

      <div className="relative p-4 space-y-2.5">
        {/* Header with title, location, and action buttons */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <h3
              className="font-semibold text-base leading-tight group-hover:text-primary transition-colors line-clamp-2"
              title={jobTitle}
            >
              {jobTitle}
            </h3>
            {location && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {/* Bell icon - visual indicator only */}
            <div
              className={cn(
                "h-7 w-7 flex items-center justify-center",
                emailNotificationsEnabled
                  ? "text-green-600 dark:text-green-400"
                  : "text-muted-foreground"
              )}
              title={emailNotificationsEnabled ? "Notifications enabled" : "Notifications disabled"}
            >
              {emailNotificationsEnabled ? (
                <Bell className="h-4 w-4 fill-current" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              title="Delete scheduled search"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Schedule badge with icons */}
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors",
              enabled
                ? "bg-green-600/50 text-green-50 dark:bg-green-700/80 dark:text-green-50"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Repeat className="h-3.5 w-3.5" />
            <span className="font-medium capitalize">{frequency}</span>
            <span>•</span>
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium">{formattedTime}</span>
          </div>
          {!enabled && (
            <span className="text-xs text-muted-foreground font-medium">Paused</span>
          )}
        </div>
      </div>
    </div>
  );
}
