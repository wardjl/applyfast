"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"

import JobScrapeForm from "@/app/components/JobScrapeForm"
import JobScrapesList from "@/app/components/JobScrapesList"
import RecurringJobScrapeForm from "@/app/components/RecurringJobScrapeForm"
import RecurringJobScrapesList from "@/app/components/RecurringJobScrapesList"
import { Tabs, TabsContent } from "@/components/ui/tabs"

function SearchesContent() {
  const [showJobForm, setShowJobForm] = useState(false)
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const currentTab = searchParams.get("tab") ?? "one-time"

  // Handle URL-based form opening from header button
  useEffect(() => {
    const newParam = searchParams.get("new")
    if (newParam === "search") {
      setShowJobForm(true)
      // Clean up the URL parameter
      const params = new URLSearchParams(searchParams.toString())
      params.delete("new")
      router.replace(`/dashboard/searches?${params.toString()}`, { scroll: false })
    } else if (newParam === "schedule") {
      setShowRecurringForm(true)
      // Clean up the URL parameter
      const params = new URLSearchParams(searchParams.toString())
      params.delete("new")
      router.replace(`/dashboard/searches?${params.toString()}`, { scroll: false })
    }
  }, [searchParams, router])

  return (
    <>
      <section className="flex flex-col gap-4">
        <Tabs value={currentTab} className="w-full">
          <TabsContent value="one-time" className="mt-4">
            <div className="rounded-lg bg-card text-card-foreground">
              <JobScrapesList />
            </div>
          </TabsContent>

          <TabsContent value="scheduled" className="mt-4">
            <div className="rounded-lg bg-card text-card-foreground">
              <RecurringJobScrapesList />
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {showJobForm && <JobScrapeForm onClose={() => setShowJobForm(false)} />}

      {showRecurringForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <RecurringJobScrapeForm
            onSuccess={() => setShowRecurringForm(false)}
            onCancel={() => setShowRecurringForm(false)}
          />
        </div>
      )}
    </>
  )
}

export default function SearchesPage() {
  return (
    <Suspense>
      <SearchesContent />
    </Suspense>
  )
}
