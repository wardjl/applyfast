"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

type AiUsageNavbarProps = {
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

export default function AiUsageNavbar({ expanded, onExpandedChange }: AiUsageNavbarProps = {}) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const dailyUsage = useQuery(api.aiUsageTracking.getDailyAiUsage);
  const monthlyUsage = useQuery(api.aiUsageTracking.getMonthlyAiUsage);
  const dailyJobsScraped = useQuery(api.aiUsageTracking.getDailyJobsScraped);

  const controlled = expanded !== undefined;
  const isExpanded = controlled ? expanded! : internalExpanded;

  const handleExpandedChange = (next: boolean) => {
    onExpandedChange?.(next);
    if (!controlled) {
      setInternalExpanded(next);
    }
  };

  if (!dailyUsage || !monthlyUsage || !dailyJobsScraped) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
        <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
      </div>
    );
  }

  const dailyPercentage = (dailyUsage.aiCallsUsed / dailyUsage.dailyLimit) * 100;
  const monthlyPercentage = (monthlyUsage.monthlyCallsUsed / monthlyUsage.monthlyLimit) * 100;

  const getDailyProgressColor = () => {
    if (dailyPercentage >= 90) return "bg-gray-800 dark:bg-gray-300";
    if (dailyPercentage >= 70) return "bg-gray-600 dark:bg-gray-400";
    return "bg-black dark:bg-white";
  };

  const getMonthlyProgressColor = () => {
    if (monthlyPercentage >= 90) return "bg-gray-800 dark:bg-gray-300";
    if (monthlyPercentage >= 70) return "bg-gray-600 dark:bg-gray-400";
    return "bg-black dark:bg-white";
  };

  const hoverHandlers = controlled
    ? {}
    : {
        onMouseEnter: () => handleExpandedChange(true),
        onMouseLeave: () => handleExpandedChange(false),
      };

  return (
    <div
      className="flex flex-col gap-2"
      {...hoverHandlers}
    >
      <div
        className="flex items-center justify-between gap-2 text-sm text-gray-700 transition-colors hover:text-black dark:text-gray-300 dark:hover:text-white cursor-pointer"
        onMouseEnter={() => handleExpandedChange(true)}
      >
        <div className="flex items-center gap-2">
          <span>✨</span>
          <span className="font-medium">
            {dailyUsage.aiCallsUsed} / {dailyUsage.dailyLimit}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {dailyUsage.remainingScores} remaining
        </span>
      </div>

      {isExpanded && (
        <div className="space-y-4 border-t border-gray-200 pt-3 text-sm text-gray-600 transition-colors dark:border-gray-700 dark:text-gray-300">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Daily</span>
              <span>Resets {dailyUsage.resetTime}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
              <span>{dailyUsage.aiCallsUsed} used</span>
              <span>{dailyUsage.remainingScores} left</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getDailyProgressColor()}`}
                style={{ width: `${Math.min(dailyPercentage, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Monthly</span>
              <span>Resets {monthlyUsage.resetTime}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
              <span>{monthlyUsage.monthlyCallsUsed} used</span>
              <span>{monthlyUsage.remainingScores} left</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getMonthlyProgressColor()}`}
                style={{ width: `${Math.min(monthlyPercentage, 100)}%` }}
              ></div>
            </div>
          </div>

          {dailyUsage.remainingScores <= Math.max(5, Math.floor(dailyUsage.dailyLimit * 0.1)) && dailyUsage.remainingScores > 0 && (
            <div className="text-xs text-gray-800 dark:text-gray-200">
              ⚠️ You&apos;re close to your daily AI limit
            </div>
          )}
          {monthlyUsage.remainingScores <= Math.max(50, Math.floor(monthlyUsage.monthlyLimit * 0.05)) && monthlyUsage.remainingScores > 0 && (
            <div className="text-xs text-gray-800 dark:text-gray-200">
              ⚠️ You&apos;re close to your monthly AI limit
            </div>
          )}
          {(dailyUsage.remainingScores <= 0 || monthlyUsage.remainingScores <= 0) && (
            <div className="text-xs text-gray-900 dark:text-gray-100">
              🚫 AI scoring is paused due to usage limits
            </div>
          )}

          <div className="border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
              <span>Jobs searched today</span>
              <span>{dailyJobsScraped.jobsScraped} jobs</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
