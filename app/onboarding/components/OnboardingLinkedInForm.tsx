"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { Linkedin, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface OnboardingLinkedInFormProps {
  onImported?: () => void;
}

export default function OnboardingLinkedInForm({ onImported }: OnboardingLinkedInFormProps) {
  const importLinkedInProfile = useAction(api.linkedinProfiles.importLinkedInProfile);
  const [profileValue, setProfileValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profileValue.trim()) {
      toast({
        variant: "destructive",
        title: "LinkedIn profile required",
        description: "Add your full LinkedIn URL or profile handle.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await importLinkedInProfile({ linkedinUrl: profileValue.trim() });
      toast({
        title: "LinkedIn imported",
        description: "We captured your public profile details to personalize the next step.",
      });
      setProfileValue("");
      onImported?.();
    } catch (error) {
      console.error("Failed to import LinkedIn profile", error);
      toast({
        variant: "destructive",
        title: "Import failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6 shadow-none">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0077b5]/10">
          <Linkedin className="h-5 w-5 text-[#0077b5]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Link your LinkedIn</h2>
          <p className="text-sm text-muted-foreground">We use this to craft questions tailored to your background.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="linkedin-url">Profile URL or handle</Label>
          <Input
            id="linkedin-url"
            placeholder="https://www.linkedin.com/in/yourname"
            value={profileValue}
            onChange={(event) => setProfileValue(event.target.value)}
            disabled={isSubmitting}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Paste your LinkedIn URL or handle and we will import the public profile automatically.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Import profile
        </Button>
      </form>
    </Card>
  );
}
