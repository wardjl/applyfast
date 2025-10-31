import { useState, FormEvent } from "react";
import { Search, Loader2, Plus, Repeat, Clock, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useConvexAuth, useAction, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ScheduledSearchCard } from "./ScheduledSearchCard";
import {
  buildLinkedInJobSearchUrl,
  DEFAULT_JOB_SEARCH_DISTANCE_KM,
  DEFAULT_JOB_SEARCH_TIME_RANGE,
} from "@/lib/linkedin";

export function JobSearchPage() {
  const { isAuthenticated } = useConvexAuth();
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [locationSuggestion, setLocationSuggestion] = useState<{
    original: string;
    suggested: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<"search" | "schedule" | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const validateLocationAction = useAction(api.locationValidation.validateLocation);
  const scheduledSearches = useQuery(
    api.recurringJobScrapes.listRecurringJobScrapes,
    isAuthenticated ? {} : "skip"
  );
  const createRecurringJobScrape = useMutation(api.recurringJobScrapes.createRecurringJobScrape);

  const openLinkedInSearch = (title: string, loc: string) => {
    // Don't apply time/distance filters for manual browsing to get more results
    const linkedinUrl = buildLinkedInJobSearchUrl({
      keywords: title.trim(),
      location: loc.trim(),
    });

    chrome.tabs.create({ url: linkedinUrl });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Require location
    if (!location.trim()) {
      return;
    }

    setIsValidating(true);
    setPendingAction("search");

    try {
      const validation = await validateLocationAction({ location });

      if (!validation.isSpecific && validation.suggestedLocation) {
        // Show suggestion banner
        setLocationSuggestion({
          original: location,
          suggested: validation.suggestedLocation,
        });
      } else {
        // Location is specific enough, proceed
        openLinkedInSearch(jobTitle, location);
        setPendingAction(null);
      }
    } catch (error) {
      console.error('Location validation failed:', error);
      // Fallback: proceed with original location
      openLinkedInSearch(jobTitle, location);
      setPendingAction(null);
    } finally {
      setIsValidating(false);
    }
  };

  const performSchedule = async (locationToUse: string) => {
    if (!jobTitle.trim() || !locationToUse.trim()) {
      return;
    }

    setIsScheduling(true);

    try {
      // Generate search name (job title only; location stored separately)
      const searchName = jobTitle.trim();

      const linkedinUrl = buildLinkedInJobSearchUrl({
        keywords: jobTitle.trim(),
        location: locationToUse.trim(),
        distance: DEFAULT_JOB_SEARCH_DISTANCE_KM,
        timeRange: DEFAULT_JOB_SEARCH_TIME_RANGE,
      });

      // Create with default settings: daily at 9:00 AM, email notifications enabled
      await createRecurringJobScrape({
        name: searchName,
        location: locationToUse.trim(),
        linkedinUrl,
        frequency: "daily",
        hour: 9,
        minute: 0,
        emailSettings: {
          enabled: true,
          timing: "auto",
          delayMinutes: 5,
          manualTime: undefined,
        },
      });

      // Success feedback
      const trimmedLocation = locationToUse.trim();
      const locationSuffix = trimmedLocation ? ` in ${trimmedLocation}` : "";
      alert(`✓ Scheduled daily search for "${searchName}"${locationSuffix} at 9:00 AM`);

      // Clear the form
      setJobTitle("");
      setLocation("");
    } catch (error) {
      console.error("Failed to create scheduled search:", error);
      alert(`Failed to create scheduled search: ${error}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleAcceptSuggestion = () => {
    if (locationSuggestion) {
      setLocation(locationSuggestion.suggested);

      if (pendingAction === "search") {
        openLinkedInSearch(jobTitle, locationSuggestion.suggested);
      } else if (pendingAction === "schedule") {
        performSchedule(locationSuggestion.suggested);
      }

      setLocationSuggestion(null);
      setPendingAction(null);
    }
  };

  const handleRejectSuggestion = () => {
    if (pendingAction === "search") {
      openLinkedInSearch(jobTitle, location);
    } else if (pendingAction === "schedule") {
      performSchedule(location);
    }

    setLocationSuggestion(null);
    setPendingAction(null);
  };

  const handleAddToSchedule = async () => {
    if (!jobTitle.trim()) {
      alert("Please enter a job title");
      return;
    }

    if (!location.trim()) {
      alert("Please enter a location");
      return;
    }

    setIsValidating(true);
    setPendingAction("schedule");

    try {
      const validation = await validateLocationAction({ location });

      if (!validation.isSpecific && validation.suggestedLocation) {
        // Show suggestion banner
        setLocationSuggestion({
          original: location,
          suggested: validation.suggestedLocation,
        });
      } else {
        // Location is specific enough, proceed with scheduling
        await performSchedule(location);
        setPendingAction(null);
      }
    } catch (error) {
      console.error('Location validation failed:', error);
      // Fallback: proceed with original location
      await performSchedule(location);
      setPendingAction(null);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scheduled Searches List - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 pb-72 bg-muted/20">
        {/* Empty State with Example */}
        {scheduledSearches && scheduledSearches.length === 0 && (
          <div className="space-y-6">
            {/* Example Card */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Example</span>
              </div>

              <div className="rounded-xl border border-green-500/50 bg-gradient-to-br from-green-50/80 to-blue-50/80 dark:from-green-950/30 dark:to-blue-950/30 shadow-sm p-4 space-y-2.5 relative overflow-hidden">
                {/* Example badge */}
                <div className="absolute top-2 right-2 bg-green-600/20 text-green-700 dark:text-green-300 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Example
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="font-semibold text-base leading-tight text-foreground line-clamp-2">
                      Software Engineer
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">Amsterdam</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-green-600/50 text-green-50 dark:bg-green-700/80 dark:text-green-50">
                    <Repeat className="h-3.5 w-3.5" />
                    <span className="font-medium">Daily</span>
                    <span>•</span>
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-medium">09:00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-3 text-sm">
              <h4 className="font-semibold text-foreground">How to schedule your own search:</h4>
              <ol className="space-y-2.5 text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                  <span className="leading-relaxed">Enter a job title and <strong className="text-foreground">location</strong> in the form below (location is required)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                  <span className="leading-relaxed">Click the <strong className="text-foreground">"Schedule"</strong> button to create a daily search at 9:00 AM</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                  <span className="leading-relaxed">Click any scheduled search card to pause or resume it</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Scheduled Searches List */}
        {scheduledSearches && scheduledSearches.length > 0 && (
          <div className="space-y-3">
            {scheduledSearches.map((search) => (
              <ScheduledSearchCard
                key={search._id}
                id={search._id}
                name={search.name}
                linkedinUrl={search.linkedinUrl}
                frequency={search.frequency}
                emailNotificationsEnabled={search.emailSettings?.enabled ?? true}
                enabled={search.enabled}
                hour={search.hour}
                minute={search.minute}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fixed Footer with Search Form */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FAFAFA] dark:bg-background border-t border-border z-10">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Job Title Input */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="job-title" className="text-sm font-normal leading-[1.3] text-foreground">
              Job Title
            </Label>
            <Input
              id="job-title"
              type="text"
              placeholder="e.g., Software Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Location Input */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="location" className="text-sm font-normal leading-[1.3] text-foreground">
              Location <span className="text-destructive">*</span>
            </Label>
            <Input
              id="location"
              type="text"
              placeholder="e.g., Amsterdam"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-9"
              required
            />
          </div>

          {/* Helper text for location requirement */}
          {!location.trim() && (
            <p className="text-xs text-muted-foreground italic">
              Location is required to search and schedule
            </p>
          )}

          {/* Location Suggestion - Replaces buttons */}
          {locationSuggestion ? (
            <div className="space-y-2.5 animate-in fade-in-50 slide-in-from-top-1">
              <p className="text-sm text-muted-foreground">
                Did you mean <span className="font-medium text-foreground">{locationSuggestion.suggested}</span>?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="default"
                  onClick={handleAcceptSuggestion}
                  className="flex-1 h-[42px]"
                  disabled={isScheduling}
                >
                  {isScheduling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {pendingAction === "schedule" ? "Scheduling..." : "Searching..."}
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Use this
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRejectSuggestion}
                  className="flex-1 h-[42px]"
                  disabled={isScheduling}
                >
                  {isScheduling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {pendingAction === "schedule" ? "Scheduling..." : "Searching..."}
                    </>
                  ) : (
                    "Keep original"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Action Buttons */
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="default"
                className="flex-1 h-[42px]"
                disabled={!location.trim() || isValidating || isScheduling}
              >
                {isValidating && pendingAction === "search" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-[42px]"
                onClick={handleAddToSchedule}
                disabled={!location.trim() || isValidating || isScheduling}
              >
                {isValidating && pendingAction === "schedule" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : isScheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
