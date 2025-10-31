/**
 * RequirementsChecker - Live role requirements validation component
 *
 * Displays user's role requirements as cards that update in real-time
 * as AI validates each one during streaming job scoring.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type RequirementCheck = {
  requirement: string;
  score: number; // 0 or 1
};

export type RequirementCheckState = {
  requirement: string;
  status: "pending" | "checking" | "met" | "not-met";
};

interface RequirementsCheckerProps {
  requirements: string[];
  checks?: RequirementCheck[];
  className?: string;
}

export function RequirementsChecker({
  requirements,
  checks,
  className = "",
}: RequirementsCheckerProps) {
  const [requirementStates, setRequirementStates] = useState<RequirementCheckState[]>([]);

  // Initialize requirement states with checks if available
  useEffect(() => {
    setRequirementStates(
      requirements.map((req) => {
        // If checks are already available, initialize with the correct status
        if (checks && checks.length > 0) {
          const check = checks.find((c) => c.requirement === req);
          if (check) {
            return {
              requirement: req,
              status: check.score === 1 ? "met" : "not-met",
            };
          }
        }
        // Otherwise, start as pending
        return {
          requirement: req,
          status: "pending",
        };
      })
    );
  }, [requirements, checks]);

  if (requirements.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-foreground mb-3">
        Requirements
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {requirementStates.map((state, idx) => (
          <RequirementCard key={idx} state={state} />
        ))}
      </div>
    </div>
  );
}

function RequirementCard({ state }: { state: RequirementCheckState }) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (state.status === "met" || state.status === "not-met") {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [state.status]);

  const getCardStyle = () => {
    switch (state.status) {
      case "met":
        return "bg-green-500/10 border-green-500/30";
      case "not-met":
        return "bg-red-500/10 border-red-500/30";
      case "checking":
        return "bg-blue-500/10 border-blue-500/30 animate-pulse";
      default:
        return "bg-muted/40 border-border";
    }
  };

  const getIcon = () => {
    switch (state.status) {
      case "met":
        return (
          <CheckCircle2
            className={cn(
              "w-4 h-4 text-green-600 dark:text-green-400 transition-all",
              isAnimating ? "scale-125" : "scale-100"
            )}
          />
        );
      case "not-met":
        return (
          <XCircle
            className={cn(
              "w-4 h-4 text-red-600 dark:text-red-400 transition-all",
              isAnimating ? "scale-125" : "scale-100"
            )}
          />
        );
      case "checking":
        return <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />;
      default:
        return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />;
    }
  };

  return (
    <div
      className={cn(
        "border rounded-md p-2.5 transition-all duration-300",
        getCardStyle(),
        isAnimating ? "scale-105" : "scale-100"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground leading-snug">
            {state.requirement}
          </p>
        </div>
      </div>
    </div>
  );
}
