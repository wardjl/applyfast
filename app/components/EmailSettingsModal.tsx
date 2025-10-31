"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
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

interface EmailSettings {
  enabled: boolean;
  timing: "auto" | "manual";
  delayMinutes: number; // Minutes after scrape completion
  manualTime?: {
    hour: number;
    minute: number;
  };
}

interface EmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: EmailSettings) => void;
  initialSettings?: EmailSettings;
}

export default function EmailSettingsModal({
  isOpen,
  onClose,
  onSave,
  initialSettings,
}: EmailSettingsModalProps) {
  const [settings, setSettings] = useState<EmailSettings>({
    enabled: true,
    timing: "auto",
    delayMinutes: 5,
    manualTime: { hour: 9, minute: 0 },
    ...initialSettings,
  });

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handleTimingChange = (timing: "auto" | "manual") => {
    setSettings(prev => ({
      ...prev,
      timing,
      // Reset to defaults when switching
      delayMinutes: timing === "auto" ? 5 : prev.delayMinutes,
      manualTime: timing === "manual" ? { hour: 9, minute: 0 } : prev.manualTime,
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Email notification settings</DialogTitle>
          <DialogDescription>
            Control how ApplyFa.st keeps you in the loop after each recurring scrape.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="email-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, enabled: !!checked }))
              }
            />
            <div className="space-y-1">
              <Label htmlFor="email-enabled" className="text-sm font-medium">
                Send email notifications for this schedule
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, ApplyFa.st sends a digest of new matches after each run.
              </p>
            </div>
          </div>

          {settings.enabled && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Email timing</Label>
                <RadioGroup
                  value={settings.timing}
                  onValueChange={(value) =>
                    handleTimingChange(value as "auto" | "manual")
                  }
                >
                  <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                    <RadioGroupItem value="auto" id="timing-auto" />
                    <Label htmlFor="timing-auto" className="flex-1 text-sm font-normal">
                      Send automatically after the scrape finishes
                    </Label>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                    <RadioGroupItem value="manual" id="timing-manual" />
                    <Label htmlFor="timing-manual" className="flex-1 text-sm font-normal">
                      Send at a specific time each day
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {settings.timing === "auto" && (
                <div className="space-y-2">
                  <Label htmlFor="auto-delay">Delay after scrape completion</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="auto-delay"
                      type="number"
                      min={1}
                      max={1440}
                      className="w-24"
                      value={settings.delayMinutes}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          delayMinutes: Math.max(
                            1,
                            Math.min(1440, parseInt(event.target.value) || 5)
                          ),
                        }))
                      }
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Defaults to 5 minutes. Accepts any value between 1 minute and 24 hours.
                  </p>
                </div>
              )}

              {settings.timing === "manual" && (
                <div className="space-y-2">
                  <Label>Email send time</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={(settings.manualTime?.hour ?? 9).toString()}
                      onValueChange={(value) =>
                        setSettings((prev) => ({
                          ...prev,
                          manualTime: {
                            ...(prev.manualTime ?? { hour: 9, minute: 0 }),
                            hour: Number(value),
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="HH" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, "0")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">:</span>
                    <Select
                      value={(settings.manualTime?.minute ?? 0).toString()}
                      onValueChange={(value) =>
                        setSettings((prev) => ({
                          ...prev,
                          manualTime: {
                            ...(prev.manualTime ?? { hour: 9, minute: 0 }),
                            minute: Number(value),
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {Array.from({ length: 60 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, "0")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uses 24-hour time and sends on the same day as the scrape run.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground shadow-none" onClick={handleSave}>
              Save settings
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
