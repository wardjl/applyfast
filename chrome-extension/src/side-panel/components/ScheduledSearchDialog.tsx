import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import {
  buildLinkedInJobSearchUrl,
  DEFAULT_JOB_SEARCH_DISTANCE_KM,
  DEFAULT_JOB_SEARCH_TIME_RANGE,
} from "@/lib/linkedin";

interface ScheduledSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle: string;
  location: string;
}

export function ScheduledSearchDialog({
  isOpen,
  onClose,
  jobTitle,
  location,
}: ScheduledSearchDialogProps) {
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createRecurringJobScrape = useMutation(api.recurringJobScrapes.createRecurringJobScrape);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedJobTitle = jobTitle.trim();
    const trimmedLocation = location.trim();

    if (!trimmedJobTitle) {
      alert("Please enter a job title");
      return;
    }

    if (!trimmedLocation) {
      alert("Please enter a location");
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate search name (job title only; location handled separately)
      const searchName = trimmedJobTitle;

      const linkedinUrl = buildLinkedInJobSearchUrl({
        keywords: trimmedJobTitle,
        location: trimmedLocation,
        distance: DEFAULT_JOB_SEARCH_DISTANCE_KM,
        timeRange: DEFAULT_JOB_SEARCH_TIME_RANGE,
      });

      await createRecurringJobScrape({
        name: searchName,
        location: trimmedLocation,
        linkedinUrl,
        frequency,
        dayOfWeek: frequency === "weekly" ? dayOfWeek : undefined,
        dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
        hour,
        minute,
        emailSettings: {
          enabled: emailNotifications,
          timing: "auto",
          delayMinutes: 5,
          manualTime: undefined,
        },
      });

      // Close dialog and reset form
      onClose();
      setFrequency("daily");
      setDayOfWeek(1);
      setDayOfMonth(1);
      setHour(9);
      setMinute(0);
      setEmailNotifications(true);
    } catch (error) {
      console.error("Failed to create scheduled search:", error);
      alert(`Failed to create scheduled search: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dayOfWeekOptions = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[340px]">
        <DialogHeader>
          <DialogTitle>Schedule Search</DialogTitle>
          <DialogDescription>
            Set up a recurring search for {jobTitle}
            {location && ` in ${location}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Frequency */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={frequency}
              onValueChange={(value) => setFrequency(value as "daily" | "weekly" | "monthly")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Day of Week (for weekly) */}
          {frequency === "weekly" && (
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select
                value={dayOfWeek.toString()}
                onValueChange={(value) => setDayOfWeek(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayOfWeekOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Day of Month (for monthly) */}
          {frequency === "monthly" && (
            <div className="space-y-2">
              <Label>Day of Month</Label>
              <Select
                value={dayOfMonth.toString()}
                onValueChange={(value) => setDayOfMonth(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hour</Label>
              <Select value={hour.toString()} onValueChange={(value) => setHour(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                    <SelectItem key={h} value={h.toString()}>
                      {h.toString().padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Minute</Label>
              <Select value={minute.toString()} onValueChange={(value) => setMinute(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {m.toString().padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="email-notifications" className="flex-1 cursor-pointer">
              Email Notifications
            </Label>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
