"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function AiUsageDisplay() {
  const dailyUsage = useQuery(api.aiUsageTracking.getDailyAiUsage);
  const monthlyUsage = useQuery(api.aiUsageTracking.getMonthlyAiUsage);

  if (!dailyUsage || !monthlyUsage) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 animate-pulse"></div>
        </div>
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <span className="mr-2">✨</span>
        AI Usage
      </h3>

      <div className="space-y-4">
        {/* Daily Usage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Daily ({dailyUsage.resetTime})
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {dailyUsage.aiCallsUsed} / {dailyUsage.dailyLimit}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getDailyProgressColor()}`}
              style={{ width: `${Math.min(dailyPercentage, 100)}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {dailyUsage.remainingScores} AI scores remaining today
          </div>
        </div>

        {/* Monthly Usage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Monthly ({monthlyUsage.resetTime})
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {monthlyUsage.monthlyCallsUsed} / {monthlyUsage.monthlyLimit}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getMonthlyProgressColor()}`}
              style={{ width: `${Math.min(monthlyPercentage, 100)}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {monthlyUsage.remainingScores} AI scores remaining this month
          </div>
        </div>

        {/* Warning Messages */}
        {dailyUsage.remainingScores <= Math.max(5, Math.floor(dailyUsage.dailyLimit * 0.1)) && dailyUsage.remainingScores > 0 && (
          <div className="text-xs text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-600">
            ⚠️ You&apos;re close to your daily AI limit
          </div>
        )}
        {monthlyUsage.remainingScores <= Math.max(50, Math.floor(monthlyUsage.monthlyLimit * 0.05)) && monthlyUsage.remainingScores > 0 && (
          <div className="text-xs text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 p-2 rounded border border-gray-400 dark:border-gray-500">
            ⚠️ You&apos;re close to your monthly AI limit
          </div>
        )}
        {(dailyUsage.remainingScores <= 0 || monthlyUsage.remainingScores <= 0) && (
          <div className="text-xs text-gray-900 dark:text-gray-100 bg-gray-300 dark:bg-gray-600 p-2 rounded border border-gray-500 dark:border-gray-400">
            🚫 AI scoring is paused due to usage limits
          </div>
        )}
      </div>
    </div>
  );
}