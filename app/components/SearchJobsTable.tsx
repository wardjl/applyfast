"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import JobDetailsModal from "./JobDetailsModal";
import type { Id } from "../../convex/_generated/dataModel";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { JobFiltersSheet } from "./JobFiltersSheet";

export default function SearchJobsTable() {
  // Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: "aiScore", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [scoringJobId, setScoringJobId] = useState<Id<"jobs"> | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const jobScrapes = useQuery(api.jobScraping.listJobScrapes);
  const allJobs = useQuery(api.jobScraping.searchJobs, {
    // Load all jobs - filtering is now handled by TanStack Table
    scrapeId: undefined,
    keywords: undefined,
    location: undefined,
    company: undefined,
    hideDuplicates: false,
  });
  const dailyAiUsage = useQuery(api.aiUsageTracking.getDailyAiUsage);
  const hasReachedDailyLimit = dailyAiUsage?.isLimitReached ?? false;
  const dailyLimitResetLabel = dailyAiUsage?.resetTime;

  // Check if filters should be open from URL
  const isFiltersOpen = searchParams.get("filters") === "open";

  const closeFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("filters");
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, router]);
  const scoreJob = useAction(api.jobScraping.scoreJobWithAI);

  // Apply scrape filter from URL params
  useEffect(() => {
    const scrapeParam = searchParams.get("scrape");
    if (scrapeParam && jobScrapes) {
      // Find the scrape
      const scrape = jobScrapes.find(s => s._id === scrapeParam);
      if (scrape) {
        // Apply the scrape filter and date filter when the URL param is present
        setColumnFilters(prev => {
          const existingScrapeFilter = prev.find(f => f.id === "scrape");
          const existingDateFilter = prev.find(f => f.id === "date");

          // Get the scrape creation date and set date range to that day
          const scrapeDate = new Date(scrape.createdAt);
          const startDate = format(scrapeDate, "yyyy-MM-dd");
          const endDate = startDate; // Same day

          // Check if filters are already correct
          if (existingScrapeFilter && existingScrapeFilter.value === scrape.name &&
              existingDateFilter &&
              Array.isArray(existingDateFilter.value) &&
              existingDateFilter.value[0] === startDate &&
              existingDateFilter.value[1] === endDate) {
            return prev; // Already correct
          }

          // Remove existing scrape and date filters, add new ones
          return [
            ...prev.filter(f => f.id !== "scrape" && f.id !== "date"),
            { id: "scrape", value: scrape.name },
            { id: "date", value: [startDate, endDate] }
          ];
        });
      }
    }
  }, [searchParams, jobScrapes]);


  // Modal navigation functions
  const openJobModal = useCallback((jobId: Id<"jobs">) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("job", jobId);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Define table columns
  const columns = useMemo<ColumnDef<NonNullable<typeof allJobs>[0]>[]>(
    () => [
      {
        accessorKey: "title",
        id: "title",
        header: "Job Title",
        cell: ({ row }) => {
          const job = row.original;
          return (
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
              {job.title}
            </div>
          );
        },
        filterFn: "includesString",
      },
      {
        accessorKey: "company",
        id: "company",
        header: "Company",
        cell: ({ row }) => {
          const job = row.original;
          return (
            <div className="text-sm text-gray-900 dark:text-gray-100 break-words">
              {job.company}
            </div>
          );
        },
        filterFn: "includesString",
      },
      {
        accessorKey: "location",
        id: "location",
        header: "Location",
        cell: ({ row }) => {
          const location = row.original.location;
          const cityName = location ? location.split(',')[0].trim() : "N/A";
          return (
            <div className="text-sm text-gray-900 dark:text-gray-100">
              {cityName}
            </div>
          );
        },
        enableSorting: false,
        filterFn: "includesString",
      },
      {
        id: "date",
        accessorFn: (row) => {
          // Use job creation time (when it was saved to the database)
          return row._creationTime;
        },
        header: "Saved Date",
        cell: ({ row }) => {
          const job = row.original;
          const displayDate = new Date(job._creationTime).toLocaleDateString();
          return (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {displayDate}
            </div>
          );
        },
        filterFn: (row, _columnId, filterValue: [string, string] | undefined) => {
          if (!filterValue || (!filterValue[0] && !filterValue[1])) return true;

          const job = row.original;
          const dateValue = job._creationTime;

          const startDate = filterValue[0] ? new Date(filterValue[0]).getTime() : 0;
          const endDate = filterValue[1] ? new Date(filterValue[1]).getTime() + (24 * 60 * 60 * 1000 - 1) : Infinity;

          return dateValue >= startDate && dateValue <= endDate;
        },
      },
      {
        id: "scrape",
        accessorFn: (row) => {
          const scrape = jobScrapes?.find(s => s._id === row.scrapeId);
          return scrape?.name || "Unknown";
        },
        header: "Scrape",
        cell: ({ row }) => {
          const scrape = jobScrapes?.find(s => s._id === row.original.scrapeId);
          const scrapeName = scrape?.name || "Unknown";
          return (
            <div className="text-sm text-gray-500 dark:text-gray-400 break-words">
              {scrapeName}
            </div>
          );
        },
        enableSorting: false,
        filterFn: "includesString",
      },
      {
        accessorKey: "aiScore",
        id: "aiScore",
        header: "Score",
        cell: ({ row }) => {
          const job = row.original;
          const isScoring = scoringJobId === job._id;
          const hasReachedLimit = hasReachedDailyLimit;

          const handleScoreClick = async () => {
            if (hasReachedLimit || isScoring) return;

            setScoringJobId(job._id);
            try {
              await scoreJob({ jobId: job._id });
              toast({
                title: "Job scored successfully",
                description: `Score has been generated for ${job.title}`,
              });
            } catch (error) {
              toast({
                title: "Failed to score job",
                description: error instanceof Error ? error.message : "An error occurred",
                variant: "destructive",
              });
            } finally {
              setScoringJobId(null);
            }
          };

          return (
            <div className="text-sm">
              {job.aiScore ? (
                <span className="font-medium text-black dark:text-white">
                  {job.aiScore}/10
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleScoreClick}
                  disabled={hasReachedLimit || isScoring}
                  title={hasReachedLimit ? `Daily limit reached. ${dailyLimitResetLabel ?? ""}` : undefined}
                  className={cn(
                    "h-7 px-2 text-xs gap-1",
                    hasReachedLimit && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  {isScoring ? "Scoring..." : hasReachedLimit ? "Limit reached" : "Score"}
                </Button>
              )}
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.aiScore || 0;
          const b = rowB.original.aiScore || 0;
          return a - b;
        },
        filterFn: "inNumberRange",
      },
    ],
    [jobScrapes, scoringJobId, scoreJob, toast, hasReachedDailyLimit, dailyLimitResetLabel]
  );

  // Create table instance
  const table = useReactTable({
    data: allJobs || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    enableSortingRemoval: false,
  });

  // Get selected job ID from URL
  const selectedJobId = searchParams.get("job") as Id<"jobs"> | null;

  if (!jobScrapes || !allJobs) {
    return <div className="p-4">Loading jobs...</div>;
  }

  const uniqueLocations = Array.from(new Set(
    allJobs.filter(job => job.location).map(job => job.location!)
  )).sort();

  const uniqueCompanies = Array.from(new Set(
    allJobs.map(job => job.company)
  )).sort();

  const closeJobModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("job");
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.push(newUrl, { scroll: false });
  };


  return (
    <>
      {/* Filters Sheet */}
      <JobFiltersSheet
        open={isFiltersOpen}
        onOpenChange={(open) => !open && closeFilters()}
        table={table}
        jobScrapes={jobScrapes}
        uniqueLocations={uniqueLocations}
        uniqueCompanies={uniqueCompanies}
        allJobsCount={allJobs.length}
        filteredJobsCount={table.getFilteredRowModel().rows.length}
        displayedJobsCount={table.getRowModel().rows.length}
      />

      {hasReachedDailyLimit && (
        <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-900/20 dark:text-amber-200">
          Daily AI scoring limit reached. {dailyLimitResetLabel ? `${dailyLimitResetLabel}.` : ""} We&apos;ll re-enable manual scoring once the limit resets.
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white dark:bg-gray-800 rounded-b-xl overflow-hidden flex flex-col flex-1 min-h-0 w-full min-w-0">
        {table.getRowModel().rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center text-gray-500 dark:text-gray-400">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              No Saved Jobs Yet
            </h3>
            <p className="max-w-md">
              Start by saving jobs you are interested in to build your personal list.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto overflow-y-auto flex-1 min-w-0">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 md:px-6 ${
                            header.column.getCanSort()
                              ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                              : ""
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="text-xs">
                                {header.column.getIsSorted() === "desc" ? "↓" :
                                 header.column.getIsSorted() === "asc" ? "↑" : ""}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => openJobModal(row.original._id)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-4 align-top md:px-6">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-xl">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({table.getFilteredRowModel().rows.length} total results)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  First
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  Last
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Job Details Modal */}
      <JobDetailsModal
        jobId={selectedJobId}
        onClose={closeJobModal}
      />
    </>
  );
}
