"use client"

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"
import * as React from "react"
import { useQuery } from "convex/react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/convex/_generated/api"

export function DashboardCards() {
  const jobScrapes = useQuery(api.jobScraping.listJobScrapes)
  const allJobs = useQuery(api.jobScraping.searchJobs, {
    scrapeId: undefined,
    keywords: undefined,
    location: undefined,
    company: undefined,
    hideDuplicates: false,
  })

  // Calculate metrics for the last 7 days
  const metrics = React.useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    let totalScrapes = 0
    let totalJobs = 0
    let highPotentialMatches = 0

    if (Array.isArray(jobScrapes)) {
      const recentAutomatedScrapes = jobScrapes.filter(scrape =>
        !scrape.isManual && (scrape.createdAt || scrape._creationTime) >= sevenDaysAgo
      )

      totalScrapes = recentAutomatedScrapes.length

      totalJobs = recentAutomatedScrapes.reduce(
        (sum, scrape) => sum + (scrape.totalJobs || 0),
        0,
      )
    }

    if (Array.isArray(allJobs)) {
      highPotentialMatches = allJobs.filter(job => {
        const score = typeof job.aiScore === "number" ? job.aiScore : null
        const timestamp = job.aiScoredAt || job._creationTime
        return score !== null && score >= 6 && timestamp >= sevenDaysAgo
      }).length
    }

    return { totalScrapes, totalJobs, highPotentialMatches }
  }, [jobScrapes, allJobs])

  return (
    <div className="*:data-[slot=card]:shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card">
      <div data-slot="card" className="bg-gradient-to-t from-primary/5 to-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm @container/card dark:bg-card">
        <div data-slot="card-header" className="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6">
          <div data-slot="card-description" className="text-muted-foreground text-sm">Searches this week</div>
          <div data-slot="card-title" className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{metrics.totalScrapes}</div>
          <div data-slot="card-action" className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
            <span data-slot="badge" className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden [a&]:hover:bg-accent [a&]:hover:text-accent-foreground">
              <TrendingUpIcon className="size-3" />
              Active
            </span>
          </div>
        </div>
        <div data-slot="card-footer" className="flex px-6 [.border-t]:pt-6 flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Job searches completed <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Over the last 7 days
          </div>
        </div>
      </div>
      <div data-slot="card" className="bg-gradient-to-t from-primary/5 to-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm @container/card dark:bg-card">
        <div data-slot="card-header" className="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6">
          <div data-slot="card-description" className="text-muted-foreground text-sm">Jobs found this week</div>
          <div data-slot="card-title" className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{metrics.totalJobs}</div>
          <div data-slot="card-action" className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
            <span data-slot="badge" className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden [a&]:hover:bg-accent [a&]:hover:text-accent-foreground">
              <TrendingUpIcon className="size-3" />
              Growing
            </span>
          </div>
        </div>
        <div data-slot="card-footer" className="flex px-6 [.border-t]:pt-6 flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total jobs found <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            From all searches this week
          </div>
        </div>
      </div>
      <div data-slot="card" className="bg-gradient-to-t from-primary/5 to-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm @container/card dark:bg-card">
        <div data-slot="card-header" className="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6">
          <div data-slot="card-description" className="text-muted-foreground text-sm">High potential matches</div>
          <div data-slot="card-title" className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{metrics.highPotentialMatches}</div>
          <div data-slot="card-action" className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
            <span data-slot="badge" className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden [a&]:hover:bg-accent [a&]:hover:text-accent-foreground">
              <TrendingUpIcon className="size-3" />
              Quality
            </span>
          </div>
        </div>
        <div data-slot="card-footer" className="flex px-6 [.border-t]:pt-6 flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            AI scored 6+ this week <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Promising opportunities found
          </div>
        </div>
      </div>
    </div>
  )
}

export function SectionCards() {
  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Total Revenue</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            $1,250.00
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingUpIcon className="size-3" />
              +12.5%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Trending up this month <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Visitors for the last 6 months
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>New Customers</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            1,234
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingDownIcon className="size-3" />
              -20%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Down 20% this period <TrendingDownIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Acquisition needs attention
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Active Accounts</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            45,678
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingUpIcon className="size-3" />
              +12.5%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Strong user retention <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">Engagement exceed targets</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Growth Rate</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            4.5%
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingUpIcon className="size-3" />
              +4.5%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Steady performance <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">Meets growth projections</div>
        </CardFooter>
      </Card>
    </div>
  )
}
