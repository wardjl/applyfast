import type { Doc } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, MapPin, Building2, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoreChart } from "./ScoreChart";

interface JobCardProps {
  job: Doc<"jobs">;
}

export function JobCard({ job }: JobCardProps) {

  const handleCardClick = () => {
    // Open LinkedIn URL when clicking the card
    if (job.url) {
      chrome.tabs.create({ url: job.url });
    }
  };

  const handleApplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open company website if available, otherwise LinkedIn URL
    const urlToOpen = job.applyUrl || job.url;
    if (urlToOpen) {
      chrome.tabs.create({ url: urlToOpen });
    }
  };

  const handleDashboardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open job details in dashboard
    const dashboardUrl = `https://applyfa.st/dashboard/jobs?job=${job._id}`;
    chrome.tabs.create({ url: dashboardUrl });
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        "hover:shadow-lg hover:scale-[1.01] cursor-pointer",
        "border-border/50 hover:border-border"
      )}
      onClick={handleCardClick}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative p-4 space-y-3">
        {/* Header with title and score */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors line-clamp-2 mb-2" title={job.title}>
              {job.title}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate font-medium">{job.company}</span>
            </div>
            {/* Location */}
            {job.location && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground" style={{ marginTop: "0.25rem" }}>
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate font-medium">{job.location.split(',')[0].trim()}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            {job.aiScore ? (
              <ScoreChart score={job.aiScore} size="lg" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <span className="text-base font-bold text-muted-foreground">?</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Description */}
        {job.aiDescription && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {job.aiDescription}
          </p>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs font-medium hover:bg-primary/10 hover:text-primary flex-1"
            onClick={handleApplyClick}
          >
            <ExternalLink className="h-3 w-3 mr-1.5" />
            Apply Now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs font-medium hover:bg-primary/10 hover:text-primary flex-1"
            onClick={handleDashboardClick}
          >
            <LayoutDashboard className="h-3 w-3 mr-1.5" />
            Dashboard
          </Button>
        </div>
      </div>
    </Card>
  );
}
