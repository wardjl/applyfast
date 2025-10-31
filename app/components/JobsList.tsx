"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface JobsListProps {
  scrapeId: Id<"jobScrapes">;
}

export default function JobsList({ scrapeId }: JobsListProps) {
  const scrape = useQuery(api.jobScraping.getJobScrape, { scrapeId });
  const jobs = useQuery(api.jobScraping.getJobsByScrape, { scrapeId });
  const toggleJobSelection = useMutation(api.jobScraping.toggleJobSelection);
  const scoreJobWithAI = useAction(api.jobScraping.scoreJobWithAI);
  const dailyUsage = useQuery(api.aiUsageTracking.getDailyAiUsage);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [showSelected, setShowSelected] = useState(false);
  const [expandedJob, setExpandedJob] = useState<Id<"jobs"> | null>(null);
  const [scoringJobs, setScoringJobs] = useState<Set<Id<"jobs">>>(new Set());

  const handleToggleSelection = async (jobId: Id<"jobs">, currentSelected: boolean) => {
    await toggleJobSelection({
      jobId,
      selected: !currentSelected,
    });
  };

  const handleScoreWithAI = async (jobId: Id<"jobs">) => {
    // Check if AI usage limit is reached before attempting to score
    if (dailyUsage && dailyUsage.remainingScores <= 0) {
      toast({
        variant: "destructive",
        title: "AI Scoring Limit Reached",
        description: "You've reached your daily AI usage limit. Please try again tomorrow or contact support for additional credits.",
      });
      return;
    }

    setScoringJobs(prev => new Set(prev).add(jobId));
    try {
      await scoreJobWithAI({ jobId });
      toast({
        title: "Job scored successfully",
        description: "AI scoring has been completed for this job.",
      });
    } catch (error) {
      console.error('AI scoring failed:', error);

      // Check if error is related to AI usage limits
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Daily AI usage limit exceeded") ||
          errorMessage.includes("Monthly AI usage limit exceeded")) {
        toast({
          variant: "destructive",
          title: "AI Scoring Limit Reached",
          description: "You've reached your AI usage limit. Please wait for the limit to reset or contact support for additional credits.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "AI Scoring Failed",
          description: `There was an error scoring this job: ${errorMessage}`,
        });
      }
    } finally {
      setScoringJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  if (scrape === undefined || jobs === undefined) {
    return <div>Loading jobs...</div>;
  }

  if (!scrape) {
    return <div>Job scrape not found.</div>;
  }

  // Filter jobs based on search criteria
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchTerm ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCompany = !filterCompany || job.company.toLowerCase().includes(filterCompany.toLowerCase());
    const matchesSelection = !showSelected || job.selected;

    return matchesSearch && matchesCompany && matchesSelection;
  });

  const selectedCount = jobs.filter(job => job.selected).length;
  const companies = Array.from(new Set(jobs.map(job => job.company))).sort();

  return (
    <div className="space-y-4">
      {/* Header with scrape info */}
      <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{scrape.name}</h2>
        <p className="text-gray-700 dark:text-gray-300">
          {scrape.linkedinUrl ? `URL: ${scrape.linkedinUrl}` : `Search: "${scrape.searchQuery}"`} • {jobs.length} total jobs • {selectedCount} selected
        </p>
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="jobs-filter-search">Search</Label>
          <Input
            id="jobs-filter-search"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Company</Label>
          <Select
            value={filterCompany || "__all__"}
            onValueChange={(value) =>
              setFilterCompany(value === "__all__" ? "" : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="__all__">All companies</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company} value={company}>
                  {company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Selection</Label>
          <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
            <Checkbox
              id="jobs-filter-selected"
              checked={showSelected}
              onCheckedChange={(checked) => setShowSelected(!!checked)}
            />
            <Label
              htmlFor="jobs-filter-selected"
              className="text-sm font-normal text-muted-foreground"
            >
              Show only selected
            </Label>
          </div>
        </div>
        <div className="flex items-end text-sm text-muted-foreground">
          Showing {filteredJobs.length} of {jobs.length} jobs
        </div>
      </div>

      {/* Job List */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No jobs match your current filters.
          </div>
        ) : (
          filteredJobs.map((job) => (
            <div key={job._id} className={`border rounded-lg p-4 ${
              job.selected ? 'bg-gray-100 border-gray-300 dark:bg-gray-800/50 dark:border-gray-600' : 'bg-white dark:bg-gray-800'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{job.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">{job.company}</p>
                  {job.location && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">📍 {job.location}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleScoreWithAI(job._id)}
                    disabled={scoringJobs.has(job._id) || (dailyUsage && dailyUsage.remainingScores <= 0)}
                    title={dailyUsage && dailyUsage.remainingScores <= 0 ? "Daily AI usage limit reached" : ""}
                  >
                    {scoringJobs.has(job._id) ? "Scoring..." : "Score"}
                  </Button>
                  <Button
                    size="sm"
                    variant={job.selected ? "default" : "secondary"}
                    onClick={() => handleToggleSelection(job._id, job.selected || false)}
                  >
                    {job.selected ? "Selected ✓" : "Select"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
                {job.salary && (
                  <div className="flex items-center">
                    <span className="font-medium text-gray-600 dark:text-gray-400">💰</span>
                    <span className="ml-1">{job.salary}</span>
                  </div>
                )}
                {job.employmentType && (
                  <div className="flex items-center">
                    <span className="font-medium text-gray-600 dark:text-gray-400">⏰</span>
                    <span className="ml-1">{job.employmentType}</span>
                  </div>
                )}
                {job.experienceLevel && (
                  <div className="flex items-center">
                    <span className="font-medium text-gray-600 dark:text-gray-400">📈</span>
                    <span className="ml-1">{job.experienceLevel}</span>
                  </div>
                )}
                {job.postedDate && (
                  <div className="flex items-center">
                    <span className="font-medium text-gray-600">📅</span>
                    <span className="ml-1">{job.postedDate}</span>
                  </div>
                )}
              </div>

              {job.description && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                    {job.description.substring(0, 200)}...
                  </p>
                </div>
              )}

              {/* AI Score Display */}
              {job.aiScore && (
                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-bold text-black dark:text-white">Score: {job.aiScore}/10</span>
                    {job.aiScoredAt && (
                      <span className="text-xs text-gray-500">
                        ({new Date(job.aiScoredAt).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {job.aiDescription}
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t">
                <div className="flex gap-2">
                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-800 text-sm transition-colors dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      View Job →
                    </a>
                  )}
                  {job.applyUrl && job.applyUrl !== job.url && (
                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-800 text-sm transition-colors dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Apply →
                    </a>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setExpandedJob(expandedJob === job._id ? null : job._id)}
                >
                  {expandedJob === job._id ? "Hide Details" : "Show Details"}
                </Button>
              </div>

              {/* Expanded Details */}
              {expandedJob === job._id && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  {job.description && (
                    <div>
                      <h4 className="font-medium mb-1">Full Description:</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                        {job.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {job.industry && (
                      <div className="flex items-center">
                        <span className="font-medium text-indigo-600">🏢</span>
                        <span className="ml-1"><strong>Industry:</strong> {job.industry}</span>
                      </div>
                    )}
                    {job.companySize && (
                      <div className="flex items-center">
                        <span className="font-medium text-gray-600 dark:text-gray-400">👥</span>
                        <span className="ml-1"><strong>Company Size:</strong> {job.companySize}</span>
                      </div>
                    )}
                  </div>

                  {job.rawData && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                        Raw Apify Data (for debugging)
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded overflow-x-auto">
                        {JSON.stringify(job.rawData, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {jobs.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>Total Jobs: {jobs.length}</div>
            <div>Selected Jobs: {selectedCount}</div>
            <div>Unique Companies: {companies.length}</div>
            <div>Showing: {filteredJobs.length}</div>
          </div>
        </div>
      )}
    </div>
  );
}
