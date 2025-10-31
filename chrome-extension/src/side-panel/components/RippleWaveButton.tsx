/**
 * RippleWaveButton - Animated button with ripple wave effects
 *
 * A visually striking button with animated ripple waves radiating from the center.
 * Used for the primary "Check Match" action in the job review interface.
 */

import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface RippleWaveButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button click handler */
  onClick?: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Job title to display below button */
  jobTitle?: string | null;
  /** Company name to display below button */
  company?: string | null;
  /** Job location to display below button */
  location?: string | null;
  /** Whether the button is in a thinking/loading animation state */
  thinking?: boolean;
}

export function RippleWaveButton({
  onClick,
  disabled = false,
  className,
  title,
  jobTitle,
  company,
  location,
  thinking = false,
  ...props
}: RippleWaveButtonProps) {
  const isDisabled = disabled || thinking;

  return (
    <>
      {/* Button with ripple waves - absolutely centered, independent of text */}
      <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2", className)}>
        <div className="relative">
          {/* Large fading shadow background - 2x size */}
          <div
            className="absolute inset-0 w-64 h-64 rounded-full -translate-x-12 -translate-y-12 pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(209, 213, 219, 0.6) 0%, rgba(209, 213, 219, 0.4) 25%, rgba(209, 213, 219, 0.2) 50%, rgba(209, 213, 219, 0.05) 75%, transparent 100%)",
            }}
            aria-hidden="true"
          />

          {/* Main button - 2x size (160px) */}
          <button
            onClick={onClick}
            disabled={isDisabled}
            title={title}
            aria-label="Check job match"
            className={cn(
              "relative w-40 h-40 rounded-full shadow-lg transition-all duration-300 group z-10 transform",
              "bg-gradient-to-br from-gray-500 to-gray-600 text-white",
              "hover:shadow-xl hover:scale-110",
              "focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md",
              thinking && "animate-[pulse_2.4s_ease-in-out_infinite]",
              // Dark mode adjustments
              "dark:from-gray-600 dark:to-gray-700 dark:focus:ring-gray-500"
            )}
            aria-busy={thinking ? "true" : undefined}
            {...props}
          >
            {/* Hover gradient overlay */}
            <div
              className={cn(
                "absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                "bg-gradient-to-br from-gray-400 to-gray-500",
                "dark:from-gray-500 dark:to-gray-600",
                thinking && "opacity-100 animate-[flicker_1s_ease-in-out_infinite]"
              )}
              aria-hidden="true"
            />

            {/* Button text - larger font */}
            <div className="relative z-10 flex items-center justify-center gap-2">
              <span className="text-2xl font-semibold">{thinking ? "Matching..." : "Match"}</span>
            </div>
          </button>

          {/* Ripple waves - hidden when disabled, 2x size */}
          {(!isDisabled || thinking) && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
              aria-hidden="true"
            >
              <div className="absolute w-40 h-40 border-2 border-gray-300 rounded-full animate-ripple-1 opacity-30 dark:border-gray-400" />
              <div className="absolute w-40 h-40 border-2 border-gray-300 rounded-full animate-ripple-2 opacity-20 dark:border-gray-500" />
              <div className="absolute w-40 h-40 border-2 border-gray-200 rounded-full animate-ripple-3 opacity-10 dark:border-gray-300" />
            </div>
          )}
        </div>
      </div>

      {/* Job info text - absolutely positioned below button center, wider area */}
      {(jobTitle || company || location) && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 text-center pointer-events-none w-80 max-w-full px-6"
          style={{ marginTop: "100px" }}
        >
          <p className="text-sm text-muted-foreground leading-snug">
            Check your match with{" "}
            {jobTitle && <span className="font-medium text-foreground">{jobTitle}</span>}
            {jobTitle && company && " at "}
            {company && <span className="font-medium text-foreground">{company}</span>}
            {(jobTitle || company) && location && " in "}
            {location && <span className="font-medium text-foreground">{location}</span>}
          </p>
        </div>
      )}
    </>
  );
}
