"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarRangePicker } from "@/components/calendar-04";
import {
  Field,
  FieldDescription,
  FieldTitle,
} from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useState, useEffect, useMemo } from "react";
import { XIcon } from "lucide-react";
import type { Column } from "@tanstack/react-table";

// Debounced Text Filter Component
function DebouncedTextFilter<T>({
  column,
  placeholder = "Filter..."
}: {
  column: Column<T, unknown>;
  placeholder?: string;
}) {
  const [value, setValue] = useState((column.getFilterValue() as string) ?? "");

  // Debounce the filter update
  useEffect(() => {
    const timeout = setTimeout(() => {
      column.setFilterValue(value || undefined);
    }, 300);

    return () => clearTimeout(timeout);
  }, [value, column]);

  // Sync with external filter changes
  useEffect(() => {
    const filterValue = (column.getFilterValue() as string) ?? "";
    setValue(filterValue);
  }, [column]);

  const isFiltering = value !== ((column.getFilterValue() as string) ?? "");

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9 pr-10 text-sm",
          isFiltering && "border-ring/70 bg-primary/5"
        )}
      />
      {isFiltering && (
        <div className="absolute right-6 top-1/2 transform -translate-y-1/2 text-xs text-blue-600 dark:text-blue-400">
          •••
        </div>
      )}
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setValue("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground h-7 w-7"
        >
          <XIcon className="h-4 w-4" />
          <span className="sr-only">Clear filter</span>
        </Button>
      )}
    </div>
  );
}

// AI Score Range Slider Component
function AIScoreRangeFilter<T>({ column }: { column: Column<T, unknown> }) {
  const [values, setValues] = useState<number[]>([1, 10]);

  const currentFilterValue = column.getFilterValue() as [number, number] | undefined;

  useEffect(() => {
    if (currentFilterValue) {
      setValues([currentFilterValue[0], currentFilterValue[1]]);
    } else {
      setValues([1, 10]);
    }
  }, [currentFilterValue]);

  const handleValueChange = (newValues: number[]) => {
    setValues(newValues);
  };

  const handleValueCommit = (newValues: number[]) => {
    if (newValues[0] === 1 && newValues[1] === 10) {
      column.setFilterValue(undefined);
    } else {
      column.setFilterValue([newValues[0], newValues[1]]);
    }
  };

  return (
    <div className="w-full">
      <Field>
        <FieldTitle>Score Range</FieldTitle>
        <FieldDescription>
          Filter by score (
          <span className="font-medium tabular-nums">{values[0]}</span> -{" "}
          <span className="font-medium tabular-nums">{values[1]}</span>).
        </FieldDescription>
        <Slider
          value={values}
          onValueChange={handleValueChange}
          onValueCommit={handleValueCommit}
          max={10}
          min={1}
          step={1}
          className="mt-2 w-full"
          aria-label="Score Range"
        />
      </Field>
    </div>
  );
}

// Date Range Filter Component
function DateRangeFilter<T>({ column }: { column: Column<T, unknown> }) {
  const [range, setRange] = useState<DateRange | undefined>();

  // Sync local state when external filter changes
  useEffect(() => {
    const filterValue = column.getFilterValue() as [string | undefined, string | undefined] | undefined;
    if (!filterValue) {
      setRange(undefined);
      return;
    }

    const [start, end] = filterValue;
    setRange((prev) => {
      const next: DateRange = {
        from: start ? new Date(start) : undefined,
        to: end ? new Date(end) : undefined,
      };
      if (!prev) return next;
      if (
        (prev.from?.toISOString().slice(0, 10) || "") === (start || "") &&
        (prev.to?.toISOString().slice(0, 10) || "") === (end || "")
      ) {
        return prev;
      }
      return next;
    });
  }, [column]);

  // Push updates to table filter with debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!range?.from && !range?.to) {
        column.setFilterValue(undefined);
        return;
      }

      const start = range?.from ? format(range.from, "yyyy-MM-dd") : undefined;
      const end = range?.to ? format(range.to, "yyyy-MM-dd") : undefined;

      column.setFilterValue([start, end]);
    }, 200);

    return () => clearTimeout(timeout);
  }, [column, range]);

  const displayValue = useMemo(() => {
    if (range?.from && range?.to) {
      return `${format(range.from, "LLL dd, yyyy")} - ${format(range.to, "LLL dd, yyyy")}`;
    }
    if (range?.from) {
      return format(range.from, "LLL dd, yyyy");
    }
    return "Pick a date range";
  }, [range]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 w-full justify-start text-left text-sm font-normal",
            !range?.from && "text-muted-foreground"
          )}
        >
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 overflow-hidden" align="start">
        <CalendarRangePicker
          selected={range}
          onSelect={setRange}
          defaultMonth={range?.from}
        />
        <div className="flex items-center justify-end gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRange(undefined)}
            className="text-muted-foreground"
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Column Filter Component
function ColumnFilter<T>({
  column,
  jobScrapes,
  uniqueLocations,
  uniqueCompanies
}: {
  column: Column<T, unknown>;
  jobScrapes?: Array<{ _id: string; name: string }>;
  uniqueLocations: string[];
  uniqueCompanies: string[];
}) {
  if (column.id === "aiScore") {
    return <AIScoreRangeFilter column={column} />;
  }

  if (column.id === "date") {
    return <DateRangeFilter column={column} />;
  }

  if (column.id === "scrape") {
    const columnFilterValue = column.getFilterValue() as string | undefined;
    return (
      <Select
        value={columnFilterValue || "__all__"}
        onValueChange={(value) =>
          column.setFilterValue(value === "__all__" ? undefined : value)
        }
      >
        <SelectTrigger className="h-9 w-full text-sm">
          <SelectValue placeholder="All scrapes" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          <SelectItem value="__all__">All scrapes</SelectItem>
          {Array.from(new Set(jobScrapes?.map((s) => s.name)))
            .sort()
            .map((scrapeName) => (
              <SelectItem key={scrapeName} value={scrapeName}>
                {scrapeName}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    );
  }

  if (column.id === "location") {
    const columnFilterValue = column.getFilterValue() as string | undefined;
    return (
      <Select
        value={columnFilterValue || "__all__"}
        onValueChange={(value) =>
          column.setFilterValue(value === "__all__" ? undefined : value)
        }
      >
        <SelectTrigger className="h-9 w-full text-sm">
          <SelectValue placeholder="All locations" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          <SelectItem value="__all__">All locations</SelectItem>
          {uniqueLocations.map((location) => (
            <SelectItem key={location} value={location}>
              {location}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (column.id === "company") {
    const columnFilterValue = column.getFilterValue() as string | undefined;
    return (
      <Select
        value={columnFilterValue || "__all__"}
        onValueChange={(value) =>
          column.setFilterValue(value === "__all__" ? undefined : value)
        }
      >
        <SelectTrigger className="h-9 w-full text-sm">
          <SelectValue placeholder="All companies" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          <SelectItem value="__all__">All companies</SelectItem>
          {uniqueCompanies.map((company) => (
            <SelectItem key={company} value={company}>
              {company}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Default text filter with debouncing
  return <DebouncedTextFilter column={column} placeholder="Filter..." />;
}

interface JobFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any; // Table instance from TanStack Table
  jobScrapes?: Array<{ _id: string; name: string }>;
  uniqueLocations: string[];
  uniqueCompanies: string[];
  allJobsCount: number;
  filteredJobsCount: number;
  displayedJobsCount: number;
}

export function JobFiltersSheet({
  open,
  onOpenChange,
  table,
  jobScrapes,
  uniqueLocations,
  uniqueCompanies,
  allJobsCount,
  filteredJobsCount,
  displayedJobsCount,
}: JobFiltersSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <SheetTitle>Column Filters</SheetTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              Showing {displayedJobsCount} of {filteredJobsCount} filtered jobs ({allJobsCount} total)
            </span>
            <Button
              type="button"
              variant="link"
              onClick={() => table.resetColumnFilters()}
              className="px-0 text-sm text-muted-foreground hover:text-foreground h-auto"
            >
              Clear all
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {table
            .getHeaderGroups()[0]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .headers.filter((header: any) => header.column.getCanFilter())
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((header: any) => (
              <div key={header.id}>
                {header.id !== "aiScore" && (
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">
                        {typeof header.column.columnDef.header === "string"
                          ? header.column.columnDef.header
                          : "Filter"}
                      </Label>
                    </div>
                    {header.id === "date" && header.column.getFilterValue() ? (
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 h-auto py-0 text-sm text-muted-foreground"
                        onClick={() => header.column.setFilterValue(undefined)}
                      >
                        Clear dates
                      </Button>
                    ) : null}
                  </div>
                )}
                <ColumnFilter
                  column={header.column}
                  jobScrapes={jobScrapes}
                  uniqueLocations={uniqueLocations}
                  uniqueCompanies={uniqueCompanies}
                />
              </div>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
