"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Filter } from "lucide-react"

const SECTION_TITLES: Record<string, string> = {
  dashboard: "Home",
  jobs: "Jobs",
  searches: "Scheduled Searches",
}

function resolveTitle(pathname: string | null): string {
  if (!pathname) {
    return SECTION_TITLES.dashboard
  }

  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] === "dashboard") {
    const section = segments[1] ?? "dashboard"
    return SECTION_TITLES[section] ?? SECTION_TITLES.dashboard
  }

  const section = segments[0] ?? "dashboard"
  return SECTION_TITLES[section] ?? SECTION_TITLES.dashboard
}

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const title = resolveTitle(pathname)
  const isSearchesPage = pathname === "/dashboard/searches"
  const isJobsPage = pathname === "/dashboard/jobs"

  // Get current tab from URL or default to "one-time"
  const currentTab = searchParams.get("tab") ?? "one-time"

  const handleTabChange = (value: string) => {
    router.push(`/dashboard/searches?tab=${value}`)
  }

  const handleOpenFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("filters", "open")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleNewSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("new", currentTab === "one-time" ? "search" : "schedule")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-16 flex h-16 shrink-0 items-center border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-3 px-4 lg:gap-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="hidden h-6 lg:inline-flex" />
        <span className="text-base font-semibold">{title}</span>

        {isSearchesPage && (
          <>
            <div className="flex justify-end">
              <Button
                onClick={handleNewSearch}
                variant="outline"
                size="sm"
                className="h-8 rounded-md px-3 text-xs"
              >
                {currentTab === "one-time" ? "New One-Time Search" : "New Scheduled Search"}
              </Button>
            </div>
            <div className="ml-auto">
              <Tabs value={currentTab} onValueChange={handleTabChange}>
                <TabsList className="grid grid-cols-2 w-auto">
                  <TabsTrigger value="one-time">Search History</TabsTrigger>
                  <TabsTrigger value="scheduled">Scheduled Searches</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </>
        )}

        {isJobsPage && (
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenFilters}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
