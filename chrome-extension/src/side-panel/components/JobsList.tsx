import { useEffect, useMemo, useState } from "react";
import { JobCard } from "./JobCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, Loader2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { useJobsLookup } from "../lib/JobsLookupContext";

export function JobsList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [minScore, setMinScore] = useState<number>(6);
  const [showFilters, setShowFilters] = useState(false);
  const [lastSettledJobs, setLastSettledJobs] = useState<Doc<"jobs">[] | undefined>(undefined);
  const { jobs, isLoading } = useJobsLookup();

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 350);

    return () => {
      clearTimeout(handle);
    };
  }, [searchQuery]);

  const trimmedQuery = debouncedQuery.trim();
  const isDebouncing = searchQuery !== debouncedQuery;

  useEffect(() => {
    if (jobs !== undefined) {
      setLastSettledJobs(jobs);
    }
  }, [jobs]);

  const jobsToRender = jobs ?? lastSettledJobs;

  const filteredJobs = useMemo(() => {
    if (!jobsToRender) return [];

    const loweredQuery = trimmedQuery.toLowerCase();

    return jobsToRender
      .filter((job) => {
        if (job.aiScore && job.aiScore < minScore) return false;

        if (loweredQuery.length > 0) {
          const haystack = `${job.title ?? ""} ${job.company ?? ""} ${job.location ?? ""}`.toLowerCase();
          if (!haystack.includes(loweredQuery)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const scoreA = a.aiScore ?? -1;
        const scoreB = b.aiScore ?? -1;
        return scoreB - scoreA;
      });
  }, [jobsToRender, trimmedQuery, minScore]);


  const isInitialLoading = !jobsToRender && (isLoading || isDebouncing);

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Loading saved jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filters Section */}
      <div className="bg-background border-b flex-shrink-0">
        <div className="p-4 space-y-3">
          {/* Stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{filteredJobs.length} jobs</span>
            </div>
            <Button
              variant={showFilters ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-9"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by title, company, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="pt-3 border-t space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Score Filter
              </Label>
              <Select
                value={minScore.toString()}
                onValueChange={(value) => setMinScore(parseInt(value))}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">
                    <span className="flex items-center gap-2">
                      All Jobs
                      <Badge variant="outline" className="text-xs">1+</Badge>
                    </span>
                  </SelectItem>
                  <SelectItem value="4">
                    <span className="flex items-center gap-2">
                      Good Matches
                      <Badge variant="outline" className="text-xs">4+</Badge>
                    </span>
                  </SelectItem>
                  <SelectItem value="6">
                    <span className="flex items-center gap-2">
                      Great Matches
                      <Badge variant="secondary" className="text-xs">6+</Badge>
                    </span>
                  </SelectItem>
                  <SelectItem value="8">
                    <span className="flex items-center gap-2">
                      Excellent Matches
                      <Badge className="text-xs">8+</Badge>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 bg-muted/20">
        {filteredJobs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4 max-w-sm">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Briefcase className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {searchQuery ? "No jobs match your search" : "No jobs yet"}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {searchQuery
                    ? "Try adjusting your search terms or filters"
                    : "Create a scrape in the dashboard to start finding opportunities"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <JobCard
                key={job._id}
                job={job}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
