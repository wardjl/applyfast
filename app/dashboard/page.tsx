import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DashboardCards } from "@/components/section-cards"

export default function DashboardPage() {
  return (
    <section className="flex flex-col gap-4">
      <DashboardCards />
      <ChartAreaInteractive />
    </section>
  )
}
