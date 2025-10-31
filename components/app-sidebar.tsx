"use client"

import * as React from "react"
import {
  LayoutDashboardIcon,
  BriefcaseIcon,
  Calendar,
} from "lucide-react"
import Image from "next/image"
import { useConvexAuth } from "convex/react"

import AiUsageNavbar from "@/app/components/AiUsageNavbar"
import UserProfileModal from "@/app/components/UserProfileModal"
import { NavMain } from "@/components/nav-main"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navItems = [
  {
    title: "Home",
    url: "/dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Jobs",
    url: "/dashboard/jobs",
    icon: BriefcaseIcon,
  },
  {
    title: "Scheduled Searches",
    url: "/dashboard/searches",
    icon: Calendar,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isAuthenticated } = useConvexAuth()
  const [showProfile, setShowProfile] = React.useState(false)
  const [aiUsageExpanded, setAiUsageExpanded] = React.useState(false)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 p-2">
              <Image
                src="/logo.png"
                alt="ApplyFa.st"
                width={128}
                height={80}
                className="h-6 w-auto rounded-sm"
                priority
              />
              <span className="text-base font-semibold">ApplyFa.st</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        {isAuthenticated && (
          <SidebarMenu>
            <SidebarMenuItem>
              <div
                className="flex flex-col gap-3 rounded-md border border-sidebar-border bg-sidebar-accent/80 p-3"
                onMouseEnter={() => setAiUsageExpanded(true)}
                onMouseLeave={() => setAiUsageExpanded(false)}
              >
                <AiUsageNavbar
                  expanded={aiUsageExpanded}
                  onExpandedChange={setAiUsageExpanded}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => setShowProfile(true)}
                >
                  Profile
                </Button>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
      <UserProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </Sidebar>
  )
}
