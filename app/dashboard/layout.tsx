import { AppSidebar } from "@/components/app-sidebar"
import { DashboardShell } from "@/components/dashboard-shell"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <DashboardShell>{children}</DashboardShell>
      </SidebarInset>
    </SidebarProvider>
  )
}
