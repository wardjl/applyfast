import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Footer() {
  const handleClosePanel = () => {
    window.close();
  };

  const handleOpenDashboard = () => {
    chrome.tabs.create({ url: "https://applyfa.st" });
  };

  return (
    <footer className="bg-[#FAFAFA] dark:bg-background p-6 fixed bottom-0 right-0 left-0 border-t border-border z-10">
      <div className="flex gap-2 items-center">
        <Button
          variant="outline"
          className="flex-1 h-10"
          onClick={handleClosePanel}
        >
          <X className="h-4 w-4 mr-2" />
          Close Panel
        </Button>
        <Button
          className="flex-1 h-10"
          onClick={handleOpenDashboard}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
      </div>
    </footer>
  );
}
