"use client"

import * as React from "react"

interface ScoreChartProps {
  score: number
  size?: "sm" | "md" | "lg"
}

export function ScoreChart({ score, size = "md" }: ScoreChartProps) {
  const maxScore = 10
  const percentage = (score / maxScore) * 100
  const [animatedDashoffset, setAnimatedDashoffset] = React.useState<number | null>(null)
  const prevScoreRef = React.useRef<number | null>(null)

  const dimensions = {
    sm: { radius: 12, svgSize: 28, center: 14, strokeWidth: 3 },
    md: { radius: 18, svgSize: 42, center: 21, strokeWidth: 4 },
    lg: { radius: 24, svgSize: 56, center: 28, strokeWidth: 5 }
  }

  const { radius, svgSize, center, strokeWidth } = dimensions[size]
  const circumference = 2 * Math.PI * radius
  const strokeDasharray = circumference
  const targetDashoffset = circumference - (percentage / 100) * circumference

  React.useEffect(() => {
    const shouldAnimate = prevScoreRef.current === null || prevScoreRef.current !== score
    prevScoreRef.current = score

    if (shouldAnimate) {
      setAnimatedDashoffset(circumference)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimatedDashoffset(targetDashoffset)
        })
      })
    } else {
      setAnimatedDashoffset(targetDashoffset)
    }
  }, [score, circumference, targetDashoffset])

  const strokeDashoffset = animatedDashoffset ?? circumference

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={svgSize}
        height={svgSize}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold text-foreground ${
          size === "sm" ? "text-xs" :
          size === "md" ? "text-sm" :
          "text-xl"
        }`}>
          {score}
        </span>
      </div>
    </div>
  )
}
