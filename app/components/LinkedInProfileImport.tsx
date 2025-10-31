"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Linkedin, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LinkedInExperience {
  logo?: string;
  title: string;
  subtitle: string;
  caption?: string;
  metadata?: string;
}

interface LinkedInSkill {
  title: string;
}

interface LinkedInEducation {
  logo?: string;
  title: string;
  subtitle?: string;
  caption?: string;
}

interface LinkedInCertificate {
  logo?: string;
  title: string;
  subtitle?: string;
  caption?: string;
  metadata?: string;
}

export default function LinkedInProfileImport() {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showReimport, setShowReimport] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const { toast } = useToast();

  const linkedinProfile = useQuery(api.linkedinProfiles.getLinkedInProfile);
  const importLinkedInProfile = useAction(api.linkedinProfiles.importLinkedInProfile);

  const handleImport = async () => {
    if (!linkedinUrl.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a LinkedIn profile URL",
      });
      return;
    }

    setIsLoading(true);

    try {
      await importLinkedInProfile({ linkedinUrl: linkedinUrl.trim() });

      toast({
        title: "Profile imported successfully",
        description: "Your LinkedIn profile data has been saved.",
      });

      setLinkedinUrl("");
      setShowReimport(false);
    } catch (error) {
      console.error("Failed to import LinkedIn profile:", error);
      toast({
        variant: "destructive",
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import profile. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Import Form - Only show if no profile exists or re-import is requested */}
      {(!linkedinProfile || showReimport) && (
        <Card className="p-5 shadow-none">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0077b5]/10">
            <Linkedin className="h-5 w-5 text-[#0077b5]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">
              {showReimport ? "Re-import LinkedIn Profile" : "Import LinkedIn Profile"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {showReimport
                ? "Update your profile data from LinkedIn"
                : "Auto-fill your profile data securely using your LinkedIn URL"}
            </p>
          </div>
          {showReimport && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReimport(false)}
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkedin-url">LinkedIn Profile URL</Label>
            <Input
              id="linkedin-url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/yourprofile"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Enter your full LinkedIn profile URL or just your profile name (e.g., wardleenders).{" "}
              <a
                href="https://www.linkedin.com/in/me/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View your LinkedIn profile
              </a>
              . We handle the rest using our verified enrichment provider.
            </p>
          </div>

          <Button
            onClick={handleImport}
            disabled={isLoading || !linkedinUrl.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              "Import Profile"
            )}
          </Button>
        </div>
      </Card>
      )}

      {/* Saved Profile Display */}
      {linkedinProfile && !showReimport && (
        <Card className="p-5 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Your LinkedIn Profile</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReimport(true)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-import Profile
            </Button>
          </div>

          {/* Profile Header */}
          <div className="flex items-start gap-4 mb-6">
            {linkedinProfile.profilePicHighQuality && (
              <Image
                src={linkedinProfile.profilePicHighQuality}
                alt={linkedinProfile.fullName || "Profile"}
                width={80}
                height={80}
                className="rounded-full border-2 border-gray-200"
              />
            )}
            <div className="flex-1">
              <h4 className="text-xl font-bold">{linkedinProfile.fullName}</h4>
              {linkedinProfile.headline && (
                <p className="text-muted-foreground mt-1">{linkedinProfile.headline}</p>
              )}
              {linkedinProfile.addressWithCountry && (
                <p className="text-sm text-muted-foreground mt-1">{linkedinProfile.addressWithCountry}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {linkedinProfile.connections && (
                  <span>{linkedinProfile.connections} connections</span>
                )}
                {linkedinProfile.followers && (
                  <span>•</span>
                )}
                {linkedinProfile.followers && (
                  <span>{linkedinProfile.followers} followers</span>
                )}
              </div>
            </div>
          </div>

          {/* About */}
          {linkedinProfile.about && (
            <div className="mb-6">
              <h5 className="font-semibold mb-2">About</h5>
              <p className="text-sm text-muted-foreground">{linkedinProfile.about}</p>
            </div>
          )}

          {/* Current Job */}
          {linkedinProfile.companyName && (
            <div className="mb-6">
              <h5 className="font-semibold mb-2">Current Position</h5>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="font-medium">{linkedinProfile.jobTitle}</p>
                <p className="text-sm text-muted-foreground">{linkedinProfile.companyName}</p>
                {linkedinProfile.currentJobDuration && (
                  <p className="text-xs text-muted-foreground mt-1">{linkedinProfile.currentJobDuration}</p>
                )}
              </div>
            </div>
          )}

          {/* Experience */}
          {linkedinProfile.experiences && linkedinProfile.experiences.length > 0 && (
            <div className="mb-6">
              <h5 className="font-semibold mb-2">Experience</h5>
              <div className="space-y-3">
                {(linkedinProfile.experiences as LinkedInExperience[]).map((exp, idx) => (
                  <div key={idx} className="flex gap-3 pb-3 border-b last:border-b-0">
                    {exp.logo && (
                      <div className="w-12 h-12 flex-shrink-0 relative rounded overflow-hidden bg-muted">
                        <Image src={exp.logo} alt={exp.title} fill className="object-contain" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{exp.title}</p>
                      <p className="text-sm text-muted-foreground">{exp.subtitle}</p>
                      {exp.caption && (
                        <p className="text-xs text-muted-foreground mt-1">{exp.caption}</p>
                      )}
                      {exp.metadata && (
                        <p className="text-xs text-muted-foreground">{exp.metadata}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {linkedinProfile.skills && linkedinProfile.skills.length > 0 && (
            <div className="mb-6">
              <h5 className="font-semibold mb-2">Skills</h5>
              <div className="flex flex-wrap gap-2">
                {(linkedinProfile.skills as LinkedInSkill[]).slice(0, showAllSkills ? undefined : 10).map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-muted/50 text-sm rounded-full"
                  >
                    {skill.title}
                  </span>
                ))}
                {linkedinProfile.skills.length > 10 && (
                  <button
                    onClick={() => setShowAllSkills(!showAllSkills)}
                    className="px-3 py-1 text-sm text-primary hover:text-primary/80 hover:bg-muted/30 rounded-full transition-colors"
                  >
                    {showAllSkills ? "Show less" : `+${linkedinProfile.skills.length - 10} more`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Education */}
          {linkedinProfile.educations && linkedinProfile.educations.length > 0 && (
            <div className="mb-6">
              <h5 className="font-semibold mb-2">Education</h5>
              <div className="space-y-3">
                {(linkedinProfile.educations as LinkedInEducation[]).map((edu, idx) => (
                  <div key={idx} className="flex gap-3 pb-3 border-b last:border-b-0">
                    {edu.logo && (
                      <div className="w-12 h-12 flex-shrink-0 relative rounded overflow-hidden bg-muted">
                        <Image src={edu.logo} alt={edu.title} fill className="object-contain" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{edu.title}</p>
                      {edu.subtitle && (
                        <p className="text-sm text-muted-foreground">{edu.subtitle}</p>
                      )}
                      {edu.caption && (
                        <p className="text-xs text-muted-foreground mt-1">{edu.caption}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {linkedinProfile.licenseAndCertificates && linkedinProfile.licenseAndCertificates.length > 0 && (
            <div className="mb-6">
              <h5 className="font-semibold mb-2">Licenses & Certifications</h5>
              <div className="space-y-3">
                {(linkedinProfile.licenseAndCertificates as LinkedInCertificate[]).map((cert, idx) => (
                  <div key={idx} className="flex gap-3 pb-3 border-b last:border-b-0">
                    {cert.logo && (
                      <div className="w-12 h-12 flex-shrink-0 relative rounded overflow-hidden bg-muted">
                        <Image src={cert.logo} alt={cert.title} fill className="object-contain" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{cert.title}</p>
                      {cert.subtitle && (
                        <p className="text-sm text-muted-foreground">{cert.subtitle}</p>
                      )}
                      {cert.caption && (
                        <p className="text-xs text-muted-foreground mt-1">{cert.caption}</p>
                      )}
                      {cert.metadata && (
                        <p className="text-xs text-muted-foreground">{cert.metadata}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            Last updated: {new Date(linkedinProfile.updatedAt).toLocaleDateString()}
          </p>
        </Card>
      )}
    </div>
  );
}
