import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Building2, Home, MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function JobPreferencesOverview() {
  const userProfile = useQuery(api.userProfiles.getUserProfile, {});
  const interviewState = useQuery(api.jobPreferenceInterviews.getInterviewState, {});

  if (userProfile === undefined || interviewState === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Loading your preferences...</p>
        </div>
      </div>
    );
  }

  const careerNarrative = (() => {
    // Prioritize user's saved narrative, then fall back to interview summaries
    const candidates = [
      userProfile?.careerNarrative,
      interviewState?.interview?.summary,
      interviewState?.latestCompletedInterview?.summary,
    ];

    for (const value of candidates) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }

    return null;
  })();

  const hasCareerNarrative = !!careerNarrative;
  const hasPreferences = userProfile && (
    userProfile.idealJobTitle ||
    (userProfile.skills && userProfile.skills.length > 0) ||
    userProfile.experience ||
    userProfile.preferredLocation ||
    userProfile.careerGoals ||
    (userProfile.industryPreferences && userProfile.industryPreferences.length > 0)
  );

  if (!hasPreferences && !hasCareerNarrative) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center space-y-4 max-w-sm">
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">No Preferences Yet</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Set up your job preferences in the web dashboard to see AI-powered job matching scores.
            </p>
            <button
              onClick={() => chrome.tabs.create({ url: "https://applyfa.st" })}
              className="mt-4 inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Open Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getWorkArrangementIcon = (arrangement?: string) => {
    switch (arrangement) {
      case "onsite":
        return <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />;
      case "remote":
        return <Home className="h-4 w-4 text-primary" aria-hidden="true" />;
      case "hybrid":
        return <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />;
      default:
        return <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />;
    }
  };

  const formatWorkArrangement = (arrangement?: string) => {
    if (!arrangement || arrangement === "flexible") return "Flexible";
    return arrangement.charAt(0).toUpperCase() + arrangement.slice(1);
  };

  const parseLocations = (locationString?: string): string[] => {
    if (!locationString) return [];
    return locationString.split(",").map(loc => loc.trim()).filter(Boolean);
  };

  const locations = parseLocations(userProfile?.preferredLocation);
  const isHighImpactSkills = userProfile?.skills && userProfile.skills.length >= 5;

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-32 bg-muted/20">
      <div className="space-y-4">

        <div className="space-y-4">
          {/* Career Narrative */}
          {hasCareerNarrative && (
            <Card className="rounded-xl border text-card-foreground p-4 shadow-none border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 to-blue-50/50 dark:from-emerald-950/20 dark:to-blue-950/20">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                Career Narrative
              </h3>
              <p className="text-sm leading-relaxed">
                {careerNarrative}
              </p>
            </Card>
          )}

          {/* Basic Information */}
          {(userProfile?.idealJobTitle || userProfile?.experience || userProfile?.workArrangement || locations.length > 0) && (
            <Card className="rounded-xl border bg-card text-card-foreground p-4 shadow-none">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                Basic Information
              </h3>
              <div className="space-y-3">
                {userProfile?.idealJobTitle && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Ideal Job Title
                    </label>
                    <p className="text-sm font-medium">{userProfile.idealJobTitle}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  {userProfile?.experience && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Experience</label>
                      <p className="text-sm">{userProfile.experience}</p>
                    </div>
                  )}

                  {userProfile?.workArrangement && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Work Arrangement</label>
                      <div className="flex items-center gap-2">
                        {getWorkArrangementIcon(userProfile.workArrangement)}
                        <span className="text-sm">{formatWorkArrangement(userProfile.workArrangement)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {locations.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Preferred Locations</label>
                    <div className="flex flex-wrap gap-1">
                      {locations.map((location, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {location}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Skills & Expertise */}
          {userProfile?.skills && userProfile.skills.length > 0 && (
            <Card className="rounded-xl border bg-card text-card-foreground p-4 shadow-none">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                Skills &amp; Expertise
              </h3>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Your Skills ({userProfile.skills.length})
                </label>
                <div className="flex flex-wrap gap-1">
                  {userProfile.skills.map((skill, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Career Goals & Preferences */}
          {(userProfile?.careerGoals || (userProfile?.roleRequirements && userProfile.roleRequirements.length > 0) || (userProfile?.dealBreakers && userProfile.dealBreakers.length > 0) || userProfile?.additionalNotes) && (
            <Card className="rounded-xl border bg-card text-card-foreground p-4 shadow-none">
              <h3 className="text-base font-semibold mb-3">Career Goals &amp; Preferences</h3>
              <div className="space-y-3">
                {userProfile?.careerGoals && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Career Goals</label>
                    <p className="text-sm leading-relaxed">{userProfile.careerGoals}</p>
                  </div>
                )}

                {userProfile?.roleRequirements && userProfile.roleRequirements.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Role Requirements</label>
                    <div className="flex flex-wrap gap-1">
                      {userProfile.roleRequirements.map((requirement, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {requirement}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {userProfile?.dealBreakers && userProfile.dealBreakers.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Deal Breakers</label>
                    <div className="flex flex-wrap gap-1">
                      {userProfile.dealBreakers.map((dealBreaker, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {dealBreaker}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {userProfile?.additionalNotes && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Additional Notes</label>
                    <p className="text-sm leading-relaxed">{userProfile.additionalNotes}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Industry & Company Preferences */}
          {((userProfile?.industryPreferences && userProfile.industryPreferences.length > 0) || userProfile?.companySize || userProfile?.salaryRange) && (
            <Card className="rounded-xl border bg-card text-card-foreground p-4 shadow-none">
              <h3 className="text-base font-semibold mb-3">Industry &amp; Company Preferences</h3>
              <div className="space-y-3">
                {userProfile?.industryPreferences && userProfile.industryPreferences.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Industry Preferences</label>
                    <div className="flex flex-wrap gap-1">
                      {userProfile.industryPreferences.map((industry, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {industry}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {userProfile?.companySize && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Preferred Company Size</label>
                    <p className="text-sm leading-relaxed">{userProfile.companySize}</p>
                  </div>
                )}

                {userProfile?.salaryRange && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Salary Range</label>
                    <p className="text-sm">{userProfile.salaryRange}</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
