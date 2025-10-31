"use client"

interface ScoreChartProps {
  score: number
  size?: "sm" | "md" | "lg"
}

export function ScoreChart({ score, size = "md" }: ScoreChartProps) {
  const maxScore = 10
  const percentage = (score / maxScore) * 100

  const dimensions = {
    sm: { radius: 12, svgSize: 28, center: 14, strokeWidth: 3 },
    md: { radius: 18, svgSize: 42, center: 21, strokeWidth: 4 },
    lg: { radius: 24, svgSize: 56, center: 28, strokeWidth: 5 }
  }

  const { radius, svgSize, center, strokeWidth } = dimensions[size]
  const circumference = 2 * Math.PI * radius
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference

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
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold text-foreground ${
          size === "sm" ? "text-xs" :
          size === "md" ? "text-sm" :
          "text-base"
        }`}>
          {score}
        </span>
      </div>
    </div>
  )
}
