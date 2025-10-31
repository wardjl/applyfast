"use client";

import { Home, Laptop, Building2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkArrangementSelectorProps {
  value: "remote" | "hybrid" | "onsite" | "flexible";
  onChange: (value: "remote" | "hybrid" | "onsite" | "flexible") => void;
}

const arrangements = [
  {
    value: "remote" as const,
    label: "Remote",
    icon: Laptop,
    description: "Work from anywhere",
  },
  {
    value: "hybrid" as const,
    label: "Hybrid",
    icon: Home,
    description: "Mix of office & remote",
  },
  {
    value: "onsite" as const,
    label: "On-site",
    icon: Building2,
    description: "In-office only",
  },
  {
    value: "flexible" as const,
    label: "Flexible",
    icon: Sparkles,
    description: "Open to all options",
  },
];

export default function WorkArrangementSelector({ value, onChange }: WorkArrangementSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {arrangements.map((arrangement) => {
        const Icon = arrangement.icon;
        const isSelected = value === arrangement.value;

        return (
          <button
            key={arrangement.value}
            type="button"
            onClick={() => onChange(arrangement.value)}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
              "hover:border-primary/50 hover:bg-accent",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border"
            )}
          >
            <Icon className={cn(
              "h-6 w-6 mb-2",
              isSelected ? "text-primary" : "text-muted-foreground"
            )} />
            <span className={cn(
              "font-medium text-sm",
              isSelected ? "text-primary" : "text-foreground"
            )}>
              {arrangement.label}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              {arrangement.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
