"use client";

import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Id } from "../../convex/_generated/dataModel";
import EmailSettingsModal from "./EmailSettingsModal";
import TagInput from "./TagInput";
import SkillTagInput, { Skill } from "./SkillTagInput";
import WorkArrangementSelector from "./WorkArrangementSelector";
import LinkedInProfileImport from "./LinkedInProfileImport";
import { DEFAULT_SCORING_CRITERIA } from "../../lib/constants";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EmailSettings {
  enabled: boolean;
  timing: "auto" | "manual";
  delayMinutes: number;
  manualTime?: {
    hour: number;
    minute: number;
  };
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { isAuthenticated } = useConvexAuth();
  const userProfile = useQuery(api.userProfiles.getUserProfile, isOpen && isAuthenticated ? {} : undefined);
  const upsertProfile = useMutation(api.userProfiles.upsertUserProfile);
  const recurringJobScrapes = useQuery(api.recurringJobScrapes.listRecurringJobScrapes, isOpen && isAuthenticated ? {} : undefined);
  const updateRecurringJobScrape = useMutation(api.recurringJobScrapes.updateRecurringJobScrape);
  const aiScoringPrompt = useQuery(api.aiScoringPrompts.getAiScoringPrompt, isOpen && isAuthenticated ? {} : undefined);
  const upsertAiScoringPrompt = useMutation(api.aiScoringPrompts.upsertAiScoringPrompt);
  const interviewState = useQuery(api.jobPreferenceInterviews.getInterviewState, isOpen && isAuthenticated ? {} : undefined);
  const { signOut } = useAuthActions();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"linkedin" | "preferences" | "email" | "scoring" | "settings">("linkedin");
  const [selectedScrapeId, setSelectedScrapeId] = useState<Id<"recurringJobScrapes"> | null>(null);
  const [showEmailSettingsModal, setShowEmailSettingsModal] = useState(false);

  // Form state for preferences tab
  const [idealJobTitle, setIdealJobTitle] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [experience, setExperience] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [workArrangement, setWorkArrangement] = useState<"remote" | "hybrid" | "onsite" | "flexible">("flexible");
  const [industries, setIndustries] = useState<string[]>([]);
  const [companySize, setCompanySize] = useState("");
  const [careerGoals, setCareerGoals] = useState("");
  const [roleRequirements, setRoleRequirements] = useState<string[]>([]);
  const [dealBreakers, setDealBreakers] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [careerNarrative, setCareerNarrative] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for AI scoring tab
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSavingScoringPrompt, setIsSavingScoringPrompt] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const router = useRouter();

  // Load existing profile data
  useEffect(() => {
    if (userProfile && isOpen) {
      setIdealJobTitle(userProfile.idealJobTitle || "");

      // Convert skills to Skill[] format
      if (userProfile.skills) {
        setSkills(userProfile.skills.map(skill =>
          typeof skill === 'string' ? { name: skill } : skill
        ));
      } else {
        setSkills([]);
      }

      setExperience(userProfile.experience || "");
      setLocations(userProfile.preferredLocation ? [userProfile.preferredLocation] : []);
      setWorkArrangement(userProfile.workArrangement || "flexible");
      setIndustries(userProfile.industryPreferences || []);
      setCompanySize(userProfile.companySize || "");
      setCareerGoals(userProfile.careerGoals || "");
      setRoleRequirements(userProfile.roleRequirements || []);
      setDealBreakers(userProfile.dealBreakers || []);
      setAdditionalNotes(userProfile.additionalNotes || "");
      setCareerNarrative(userProfile.careerNarrative || "");
    }
  }, [userProfile, isOpen]);

  // Initialize career narrative from AI interview if not set
  useEffect(() => {
    if (isOpen && !careerNarrative && interviewState) {
      const candidates = [
        interviewState.interview?.summary,
        interviewState.latestCompletedInterview?.summary,
      ];

      for (const value of candidates) {
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed.length > 0) {
            setCareerNarrative(trimmed);
            break;
          }
        }
      }
    }
  }, [isOpen, careerNarrative, interviewState]);

  // Load AI scoring prompt settings
  useEffect(() => {
    if (aiScoringPrompt && isOpen) {
      setUseCustomPrompt(aiScoringPrompt.useCustomPrompt);
      setCustomPrompt(aiScoringPrompt.customPrompt || "");
    } else if (isOpen) {
      // Reset to defaults if no settings exist
      setUseCustomPrompt(false);
      setCustomPrompt("");
    }
  }, [aiScoringPrompt, isOpen]);

  const getEmailSettings = (scrape: {
    emailSettings?: EmailSettings;
    digestEnabled?: boolean;
  }): EmailSettings => {
    if (scrape.emailSettings) {
      return scrape.emailSettings;
    }
    if (scrape.digestEnabled !== undefined) {
      return {
        enabled: scrape.digestEnabled,
        timing: "auto",
        delayMinutes: 5,
        manualTime: undefined,
      };
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await upsertProfile({
        idealJobTitle: idealJobTitle.trim() || undefined,
        skills: skills.length > 0 ? skills.map(s => s.name) : undefined,
        experience: experience.trim() || undefined,
        preferredLocation: locations.length > 0 ? locations.join(", ") : undefined,
        workArrangement,
        salaryRange: undefined,
        industryPreferences: industries.length > 0 ? industries : undefined,
        companySize: companySize.trim() || undefined,
        careerGoals: careerGoals.trim() || undefined,
        roleRequirements: roleRequirements.length > 0 ? roleRequirements : undefined,
        dealBreakers: dealBreakers.length > 0 ? dealBreakers : undefined,
        additionalNotes: additionalNotes.trim() || undefined,
        careerNarrative: careerNarrative.trim() || undefined,
      });

      toast({
        title: "Profile saved",
        description: "Your profile has been updated successfully.",
      });
      onClose();
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save profile. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const handleSaveScoringPrompt = async () => {
    setIsSavingScoringPrompt(true);
    try {
      await upsertAiScoringPrompt({
        customPrompt: customPrompt.trim() || undefined,
        useCustomPrompt,
      });
      toast({
        title: "Job scoring settings saved",
        description: "Your custom scoring criteria has been updated successfully.",
      });
    } catch (error) {
      console.error("Failed to save job scoring prompt:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save job scoring settings. Please try again.",
      });
    } finally {
      setIsSavingScoringPrompt(false);
    }
  };

  const handleResetToDefault = () => {
    setCustomPrompt(DEFAULT_SCORING_CRITERIA);
    toast({
      title: "Reset to default",
      description: "The scoring criteria has been reset to the default template.",
    });
  };

  const handleRedoInterview = useCallback(() => {
    onClose();
    router.push("/onboarding?redo=1");
  }, [onClose, router]);

  const selectedScrape = selectedScrapeId
    ? recurringJobScrapes?.find(s => s._id === selectedScrapeId)
    : null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Profile Settings</DialogTitle>
            <DialogDescription>
              Manage your job preferences, email notifications, and account settings
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="linkedin" value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="linkedin">LinkedIn Profile</TabsTrigger>
              <TabsTrigger value="preferences">Job Preferences</TabsTrigger>
              <TabsTrigger value="scoring">Job Scoring</TabsTrigger>
              <TabsTrigger value="email">Email Notifications</TabsTrigger>
              <TabsTrigger value="settings">General Settings</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(90vh-200px)] mt-6">
              {/* LinkedIn Profile Tab */}
              <TabsContent value="linkedin" className="space-y-6 px-1">
                <LinkedInProfileImport />
              </TabsContent>

              {/* Preferences Tab */}
              <TabsContent value="preferences" className="space-y-6 px-1">
                <Card className="p-6 shadow-none flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">Update Profile with AI</h3>
                    <p className="text-sm text-muted-foreground">
                      Re-run the AI interview to refresh and update your job preferences based on your current goals and experience.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleRedoInterview()}
                    className="self-start sm:self-auto"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Update with AI Interview
                  </Button>
                </Card>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* AI Career Narrative */}
                  <Card className="rounded-xl border text-card-foreground p-4 shadow-none border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 to-blue-50/50 dark:from-emerald-950/20 dark:to-blue-950/20">
                    <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                      Career Narrative
                    </h3>
                    <div className="space-y-2">
                      <Textarea
                        value={careerNarrative}
                        onChange={(e) => setCareerNarrative(e.target.value)}
                        placeholder="Describe your career goals, experience, and what you're looking for in your next role..."
                        rows={4}
                        className="text-sm leading-relaxed resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        This narrative helps AI understand your career goals and match you with relevant opportunities.
                      </p>
                    </div>
                  </Card>

                  {/* Basic Information */}
                  <Card className="p-5 shadow-none">
                    <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="jobTitle" className="flex items-center gap-2">
                          Ideal Job Title
                        </Label>
                        <Input
                          id="jobTitle"
                          value={idealJobTitle}
                          onChange={(e) => setIdealJobTitle(e.target.value)}
                          placeholder="e.g., Senior Full Stack Developer"
                        />
                        <p className="text-xs text-muted-foreground">Used by AI to match you with relevant positions</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="experience">Experience</Label>
                        <Textarea
                          id="experience"
                          value={experience}
                          onChange={(e) => setExperience(e.target.value)}
                          placeholder="e.g., Hands-on building of digital products combined with strategic advisory roles, bridging concept to prototype with research-based decision making"
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                          Describe your professional experience, years in the field, or expertise level
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Work Arrangement</Label>
                        <WorkArrangementSelector
                          value={workArrangement}
                          onChange={setWorkArrangement}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Preferred Locations</Label>
                        <TagInput
                          value={locations}
                          onChange={setLocations}
                          placeholder="Add location (e.g., San Francisco, Remote)"
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Skills & Expertise */}
                  <Card className="p-5 shadow-none">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      Skills & Expertise
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add 5-10 skills for best matching results
                    </p>
                    <div className="space-y-2">
                      <Label>Your Skills ({skills.length})</Label>
                      <SkillTagInput
                        value={skills}
                        onChange={setSkills}
                        placeholder="Add skill (e.g., JavaScript, React, Python)"
                        showProficiency={false}
                      />
                    </div>
                  </Card>

                  {/* Career Goals & Preferences */}
                  <Card className="p-5 shadow-none">
                    <h3 className="text-lg font-semibold mb-4">Career Goals & Preferences</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="careerGoals">Career Goals</Label>
                        <Textarea
                          id="careerGoals"
                          value={careerGoals}
                          onChange={(e) => setCareerGoals(e.target.value)}
                          placeholder="Describe your long-term goals"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Requirements</Label>
                        <TagInput
                          value={roleRequirements}
                          onChange={setRoleRequirements}
                          placeholder="Add requirement (e.g., Remote work, Health benefits, $120k+ salary)"
                        />
                        <p className="text-xs text-muted-foreground">
                          Specific must-haves for your ideal role (compensation, benefits, culture, tech stack, etc.)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Deal Breakers</Label>
                        <TagInput
                          value={dealBreakers}
                          onChange={setDealBreakers}
                          placeholder="Add deal breaker (e.g., Mandatory relocation)"
                        />
                      </div>

                      <div className="space-y-2 mt-4">
                      <Label htmlFor="additionalNotes">Additional Notes</Label>
                      <Textarea
                        id="additionalNotes"
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value)}
                        placeholder="Any other preferences or context we should know about?"
                      />
                    </div>
                    </div>
                  </Card>

                  {/* Industry & Company Preferences */}
                  <Card className="p-5 shadow-none">
                    <h3 className="text-lg font-semibold mb-4">Industry & Company Preferences</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Industry Preferences</Label>
                        <TagInput
                          value={industries}
                          onChange={setIndustries}
                          placeholder="Add industry (e.g., FinTech, Healthcare)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companySize">Preferred Company Size</Label>
                        <Input
                          id="companySize"
                          value={companySize}
                          onChange={(e) => setCompanySize(e.target.value)}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          Describe preferred company size or organizational structure
                        </p>
                      </div>
                    </div>
                  </Card>

                  <div className="flex justify-end space-x-3 pt-4">
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground shadow-none">
                        {isSubmitting ? "Saving..." : "Save Profile"}
                      </Button>
                    </div>
                  </div>
                </form>
              </TabsContent>

              {/* Email Preferences Tab */}
              <TabsContent value="email" className="space-y-6 px-1">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Email Notification Settings</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Manage email notification settings for all your recurring job scrapes
                  </p>

                  {!recurringJobScrapes || recurringJobScrapes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        No recurring job scrapes found. Create a recurring scrape to manage email settings.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recurringJobScrapes.map((scrape) => {
                        const emailSettings = getEmailSettings(scrape);
                        const isActive = scrape.enabled && emailSettings.enabled;
                        return (
                          <div
                            key={scrape._id}
                            className={`border rounded-lg p-4 cursor-pointer ${
                              isActive
                                ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                                : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                            }`}
                            onClick={() => openEmailSettings(scrape._id)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg">{scrape.name}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {scrape.frequency.charAt(0).toUpperCase() + scrape.frequency.slice(1)} •
                                  Next run: {scrape.nextRun ? new Date(scrape.nextRun).toLocaleString() : "Not scheduled"}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  isActive
                                    ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                                }`}
                              >
                                {isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <span className="text-sm font-medium">Email notifications:</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                emailSettings.enabled
                                  ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                                  : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                              }`}>
                                {formatEmailSettings(emailSettings)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Job Scoring Tab */}
              <TabsContent value="scoring" className="space-y-6 px-1">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Job Scoring Customization
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Customize how jobs are evaluated and scored for you
                  </p>

                  {/* Toggle Custom Prompt */}
                  <Card className="p-5 mb-6 shadow-none">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="use-custom-prompt" className="text-base font-semibold cursor-pointer">
                          Use Custom Scoring Criteria
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Override the default criteria with your own custom instructions
                        </p>
                      </div>
                      <Switch
                        id="use-custom-prompt"
                        checked={useCustomPrompt}
                        onCheckedChange={setUseCustomPrompt}
                      />
                    </div>
                  </Card>

                  {/* Custom Prompt Editor */}
                  {useCustomPrompt && (
                    <Card className="p-5 mb-6 shadow-none">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="custom-prompt" className="text-base font-semibold">
                            Custom Scoring Criteria
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleResetToDefault}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reset to Default
                          </Button>
                        </div>
                        <Textarea
                          id="custom-prompt"
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="Enter your custom scoring criteria..."
                          rows={15}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Define how you want jobs to be evaluated. Include criteria, weights, and scoring ranges.
                        </p>
                      </div>
                    </Card>
                  )}

                  {/* Default Criteria Display */}
                  {!useCustomPrompt && (
                    <Card className="p-5 mb-6 bg-muted/30 shadow-none">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Default Scoring Criteria</Label>
                          <Badge variant="secondary">Currently Active</Badge>
                        </div>
                        <div className="bg-background border rounded-lg p-4">
                          <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                            {DEFAULT_SCORING_CRITERIA}
                          </pre>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This is the default criteria. Enable custom scoring above to modify it.
                        </p>
                      </div>
                    </Card>
                  )}

                  {/* Preview Full Prompt */}
                  <Collapsible open={showPromptPreview} onOpenChange={setShowPromptPreview}>
                    <Card className="p-5 shadow-none">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between">
                          <div className="text-left">
                            <h4 className="font-semibold text-sm">Preview Complete AI Prompt</h4>
                            <p className="text-xs text-muted-foreground">See how your profile combines with scoring criteria</p>
                          </div>
                          {showPromptPreview ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4">
                        <div className="bg-muted/50 border rounded-lg p-4 max-h-96 overflow-y-auto">
                          <pre className="text-xs whitespace-pre-wrap font-mono">
                            {`You are evaluating job opportunities for a user based on their profile and preferences:

USER PROFILE:
${userProfile?.idealJobTitle ? `- Ideal Job Title: ${userProfile.idealJobTitle}` : ''}
${userProfile?.experience ? `- Experience Level: ${userProfile.experience}` : ''}
${userProfile?.skills?.length ? `- Skills: ${userProfile.skills.join(', ')}` : ''}
${userProfile?.preferredLocation ? `- Preferred Location: ${userProfile.preferredLocation}` : ''}
${userProfile?.workArrangement && userProfile.workArrangement !== 'flexible' ? `- Work Arrangement Preference: ${userProfile.workArrangement}` : ''}
${userProfile?.salaryRange ? `- Desired Salary Range: ${userProfile.salaryRange}` : ''}
${userProfile?.industryPreferences?.length ? `- Industry Preferences: ${userProfile.industryPreferences.join(', ')}` : ''}
${userProfile?.companySize ? `- Preferred Company Size: ${userProfile.companySize}` : ''}
${userProfile?.careerGoals ? `- Career Goals: ${userProfile.careerGoals}` : ''}
${userProfile?.dealBreakers?.length ? `- Deal Breakers: ${userProfile.dealBreakers.join(', ')}` : ''}
${userProfile?.additionalNotes ? `- Additional Notes: ${userProfile.additionalNotes}` : ''}${careerNarrative ? `

CAREER NARRATIVE (from personalized AI interview):
${careerNarrative}

This narrative provides deeper context about the user's motivations, goals, and ideal work environment. Use it to better understand what truly matters to them beyond the structured profile fields.` : ''}

${useCustomPrompt && customPrompt ? customPrompt : DEFAULT_SCORING_CRITERIA}`}
                          </pre>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleSaveScoringPrompt}
                      disabled={isSavingScoringPrompt || (useCustomPrompt && !customPrompt.trim())}
                      className="bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground shadow-none"
                    >
                      {isSavingScoringPrompt ? "Saving..." : "Save Job Scoring Settings"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* General Settings Tab */}
              <TabsContent value="settings" className="space-y-6 px-1">
                <div>
                  <h3 className="text-lg font-semibold mb-2">General Settings</h3>
                  <p className="text-sm text-muted-foreground mb-6">Manage your account and authentication</p>

                  <Card className="p-5 shadow-none">
                    <h4 className="font-semibold text-lg mb-2">Sign Out</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Sign out of your account. You&apos;ll need to sign in again to access your data.
                    </p>
                    <Button onClick={handleSignOut} variant="destructive">
                      Sign Out
                    </Button>
                  </Card>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

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
