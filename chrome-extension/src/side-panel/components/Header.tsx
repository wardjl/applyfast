import {
  Menu,
  LogOut,
  Briefcase,
  Calendar,
  Search,
  User,
  LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthActions } from "@convex-dev/auth/react";

type Page = "saved-jobs" | "job-search" | "profile";

interface HeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  hasActiveJob?: boolean;
}

export function Header({ currentPage, onNavigate, hasActiveJob = false }: HeaderProps) {
  const { signOut } = useAuthActions();

  const handleOpenDashboard = () => {
    chrome.tabs.create({ url: "https://applyfa.st" });
  };

  const handleOpenDashboardPage = (page: string) => {
    chrome.tabs.create({ url: `https://applyfa.st${page}` });
  };

  const handleSignOut = async () => {
    await signOut();
    // Send message to background script to clear storage
    chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
  };

  const getPageTitle = () => {
    if (hasActiveJob) {
      return "Review Job";
    }

    switch (currentPage) {
      case "job-search":
        return "Job Search";
      case "saved-jobs":
        return "Saved Jobs";
      case "profile":
        return "Profile";
      default:
        return "Job Search";
    }
  };

  return (
    <header className="px-6 py-4 bg-[#FAFAFA] dark:bg-background border-b border-border flex justify-between items-center fixed top-0 right-0 left-0 z-10">
      <div className="flex gap-2 items-center">
        <h1 className="text-lg font-bold leading-6">{getPageTitle()}</h1>
      </div>
      <div className="flex gap-2 items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-[calc(100vw-3rem)]"
          >
            {/* Extension Pages */}
            <DropdownMenuItem onClick={() => onNavigate("job-search")}>
              <Search className="h-4 w-4 mr-2" />
              Job Search
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate("saved-jobs")}>
              <Briefcase className="h-4 w-4 mr-2" />
              Saved Jobs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate("profile")}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Web App Links */}
            <DropdownMenuLabel>Web Dashboard</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleOpenDashboard}>
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Home
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenDashboardPage('/dashboard/jobs')}>
              <Briefcase className="h-4 w-4 mr-2" />
              Saved Jobs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenDashboardPage('/dashboard/searches')}>
              <Calendar className="h-4 w-4 mr-2" />
              Scheduled Searches
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
