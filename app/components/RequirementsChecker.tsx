"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

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

export default function RequirementsChecker({
  requirements,
  checks,
  className = "",
}: RequirementsCheckerProps) {
  const [requirementStates, setRequirementStates] = useState<RequirementCheckState[]>([]);

  // Initialize requirement states
  useEffect(() => {
    setRequirementStates(
      requirements.map((req) => ({
        requirement: req,
        status: "pending",
      }))
    );
  }, [requirements]);

  // Update states when checks arrive from streaming
  useEffect(() => {
    if (!checks || checks.length === 0) return;

    setRequirementStates((prev) =>
      prev.map((state) => {
        const check = checks.find((c) => c.requirement === state.requirement);
        if (check) {
          return {
            requirement: state.requirement,
            status: check.score === 1 ? "met" : "not-met",
          };
        }
        // If not found in checks yet, mark as checking if we have any checks
        return {
          ...state,
          status: state.status === "pending" ? "checking" : state.status,
        };
      })
    );
  }, [checks]);

  if (requirements.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Requirements
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {requirementStates.map((state, idx) => (
          <RequirementCard key={idx} state={state} />
        ))}
      </div>
    </div>
  );
}

function RequirementCard({ state }: { state: RequirementCheckState }) {
  const getCardStyle = () => {
    switch (state.status) {
      case "met":
        return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800";
      case "not-met":
        return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800";
      case "checking":
        return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800";
      default:
        return "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700";
    }
  };

  const getIcon = () => {
    switch (state.status) {
      case "met":
        return (
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
        );
      case "not-met":
        return (
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
        );
      case "checking":
        return <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />;
      default:
        return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />;
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getCardStyle()}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
            {state.requirement}
          </p>
        </div>
      </div>
    </div>
  );
}
