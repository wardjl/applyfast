"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import type { TooltipProps } from "recharts"
import { useQuery } from "convex/react"

import { api } from "@/convex/_generated/api"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"

type HighlightJob = {
  id: string
  title: string
  company: string
  score: number | null
}

type ChartPoint = {
  dateKey: string
  label: string
  scrapes: number
  highlights: HighlightJob[]
}

type JobsChartPoint = {
  dateKey: string
  label: string
  jobs: number
  manualJobs: number
  scrapeDetails: Array<{ name: string; jobs: number }>
}

const chartConfig = {
  scrapes: {
    label: "Scrapes",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

const jobsChartConfig = {
  jobs: {
    label: "Jobs scraped",
    color: "hsl(142 70% 45%)",
  },
  manualJobs: {
    label: "Manual saves",
    color: "hsl(0 0% 0%)",
  },
} satisfies ChartConfig

const formatDateKey = (timestamp: number) => {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
    .toISOString()
    .slice(0, 10)
}

const formatDisplayDate = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "short", day: "numeric" })

const WeeklyTooltip = ({
  active,
  payload,
}: TooltipProps<number, string>) => {
  if (!active || !payload?.length) {
    return null
  }

  const dataPoint = payload[0]?.payload as ChartPoint | undefined
  if (!dataPoint) {
    return null
  }

  const highlightJobs = dataPoint.highlights

  return (
    <div className="grid min-w-[12rem] gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="font-medium text-foreground">
        {dataPoint.label}
      </div>
      <div className="text-muted-foreground">
        {dataPoint.scrapes} {dataPoint.scrapes === 1 ? "scrape" : "scrapes"}
      </div>
      {highlightJobs.length > 0 ? (
        <div className="space-y-1">
          {highlightJobs.map((job) => (
            <div key={job.id} className="border-l-2 border-primary/60 pl-2">
              <div className="font-medium text-foreground">
                {job.title}
              </div>
              <div className="text-muted-foreground">
                {job.company}
                {typeof job.score === "number" && (
                  <span className="ml-1 font-medium text-foreground">
                    · {job.score.toFixed(1)}/10
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground">
          No highlighted jobs yet
        </div>
      )}
    </div>
  )
}

export function ChartAreaInteractive() {
  const jobScrapes = useQuery(api.jobScraping.listJobScrapes)
  const allJobs = useQuery(api.jobScraping.searchJobs, {
    scrapeId: undefined,
    keywords: undefined,
    location: undefined,
    company: undefined,
    hideDuplicates: false,
  })

  const chartData = React.useMemo<ChartPoint[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const start = new Date(today)
    start.setDate(start.getDate() - 6)

    const days: { key: string; date: Date }[] = []
    const buckets = new Map<string, { scrapes: number; highlights: HighlightJob[]; date: Date }>()

    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      const key = formatDateKey(date.getTime())
      days.push({ key, date })
      buckets.set(key, { scrapes: 0, highlights: [], date })
    }

    if (Array.isArray(jobScrapes)) {
      for (const scrape of jobScrapes) {
        if (scrape.isManual) {
          continue
        }
        const timestamp = typeof scrape.createdAt === "number" ? scrape.createdAt : scrape._creationTime
        const key = formatDateKey(timestamp)
        const bucket = buckets.get(key)
        if (bucket) {
          bucket.scrapes += 1
        }
      }
    }

    if (Array.isArray(allJobs)) {
      for (const job of allJobs) {
        const score = typeof job.aiScore === "number" ? job.aiScore : null
        if (score === null || score < 7) {
          continue
        }

        const timestamp =
          typeof job.aiScoredAt === "number"
            ? job.aiScoredAt
            : typeof job._creationTime === "number"
              ? job._creationTime
              : null

        if (!timestamp) {
          continue
        }

        const key = formatDateKey(timestamp)
        const bucket = buckets.get(key)
        if (!bucket) {
          continue
        }

        bucket.highlights.push({
          id: String(job._id ?? `${job.title}-${timestamp}`),
          title: job.title || "Untitled role",
          company: job.company || "Unknown company",
          score,
        })
      }
    }

    return days.map(({ key, date }) => {
      const bucket = buckets.get(key)
      const highlights = bucket
        ? [...bucket.highlights]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, 3)
        : []

      return {
        dateKey: key,
        label: formatDisplayDate(date),
        scrapes: bucket?.scrapes ?? 0,
        highlights,
      }
    })
  }, [jobScrapes, allJobs])

  const totalScrapes = React.useMemo(
    () => chartData.reduce((acc, day) => acc + day.scrapes, 0),
    [chartData]
  )

  const jobsChartData = React.useMemo<JobsChartPoint[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const start = new Date(today)
    start.setDate(start.getDate() - 6)

    const days: { key: string; date: Date }[] = []
    const buckets = new Map<string, {
      jobs: number
      manualJobs: number
      date: Date
      scrapeDetails: Array<{ name: string; jobs: number }>
    }>()

    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      const key = formatDateKey(date.getTime())
      days.push({ key, date })
      buckets.set(key, { jobs: 0, manualJobs: 0, date, scrapeDetails: [] })
    }

    if (Array.isArray(jobScrapes)) {
      for (const scrape of jobScrapes) {
        if (scrape.isManual) {
          continue
        }
        const timestamp = typeof scrape.createdAt === "number" ? scrape.createdAt : scrape._creationTime
        const key = formatDateKey(timestamp)
        const bucket = buckets.get(key)
        if (bucket && scrape.totalJobs) {
          bucket.jobs += scrape.totalJobs
          bucket.scrapeDetails.push({
            name: scrape.name,
            jobs: scrape.totalJobs
          })
        }
      }
    }

    if (Array.isArray(allJobs)) {
      for (const job of allJobs) {
        if (!job.manualCapture) {
          continue
        }

        const timestamp =
          typeof job.manualCapturedAt === "number"
            ? job.manualCapturedAt
            : typeof job._creationTime === "number"
              ? job._creationTime
              : null

        if (!timestamp) {
          continue
        }

        const key = formatDateKey(timestamp)
        const bucket = buckets.get(key)
        if (!bucket) {
          continue
        }

        bucket.manualJobs += 1
      }
    }

    return days.map(({ key, date }) => {
      const bucket = buckets.get(key)
      return {
        dateKey: key,
        label: formatDisplayDate(date),
        jobs: bucket?.jobs ?? 0,
        manualJobs: bucket?.manualJobs ?? 0,
        scrapeDetails: bucket?.scrapeDetails ?? [],
      }
    })
  }, [jobScrapes, allJobs])

  const totalJobs = React.useMemo(
    () => jobsChartData.reduce((acc, day) => acc + day.jobs, 0),
    [jobsChartData]
  )

  const totalManualJobs = React.useMemo(
    () => jobsChartData.reduce((acc, day) => acc + day.manualJobs, 0),
    [jobsChartData]
  )

  return (
    <div className="space-y-4">
      <div data-slot="card" className="bg-transparent text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm">
        <div className="px-6">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Weekly job searches</h3>
            <p className="text-sm text-muted-foreground">
              {totalScrapes} {totalScrapes === 1 ? "scheduled search" : "scheduled searches"} over the last 7 days
            </p>
          </div>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fillScrapes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-scrapes)" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="var(--color-scrapes)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip cursor={false} content={<WeeklyTooltip />} />
                <Area
                  type="monotone"
                  dataKey="scrapes"
                  stroke="var(--color-scrapes)"
                  fill="url(#fillScrapes)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 4 }}
                />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>

      <div data-slot="card" className="bg-transparent text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm">
        <div className="px-6">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Weekly jobs searched</h3>
            <p className="text-sm text-muted-foreground">
              {totalJobs} {totalJobs === 1 ? "job" : "jobs"} saved automatically · {totalManualJobs} {totalManualJobs === 1 ? "manual save" : "manual saves"}
            </p>
          </div>
          <ChartContainer config={jobsChartConfig} className="h-[200px] w-full">
            <AreaChart data={jobsChartData}>
                <defs>
                  <linearGradient id="fillJobs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-jobs)" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="var(--color-jobs)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0]?.payload as JobsChartPoint | undefined
                    if (!data) return null
                    return (
                      <div className="grid min-w-[12rem] gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                        <div className="font-medium text-foreground">{data.label}</div>
                        <div className="text-muted-foreground">
                          {data.jobs} {data.jobs === 1 ? "job" : "jobs"} saved automatically
                        </div>
                        <div className="text-muted-foreground">
                          {data.manualJobs} {data.manualJobs === 1 ? "manual save" : "manual saves"}
                        </div>
                        {data.scrapeDetails.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-border/50">
                            {data.scrapeDetails.map((scrape, idx) => (
                              <div key={idx} className="flex justify-between items-center gap-2">
                                <div className="text-muted-foreground truncate">{scrape.name}</div>
                                <div className="font-medium text-foreground whitespace-nowrap">
                                  {scrape.jobs} {scrape.jobs === 1 ? "job" : "jobs"}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="jobs"
                  stroke="var(--color-jobs)"
                  fill="url(#fillJobs)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="manualJobs"
                  stroke="var(--color-manualJobs)"
                  fill="var(--color-manualJobs)"
                  fillOpacity={0}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 4 }}
                />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  )
}
