"use client"

import * as React from "react"
import { type DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"

export interface CalendarRangePickerProps
  extends Omit<React.ComponentProps<typeof Calendar>, "mode" | "selected" | "onSelect"> {
  selected: DateRange | undefined
  onSelect: (range: DateRange | undefined) => void
}

export function CalendarRangePicker({
  selected,
  onSelect,
  className,
  ...props
}: CalendarRangePickerProps) {
  return (
    <Calendar
      mode="range"
      numberOfMonths={1}
      selected={selected}
      onSelect={onSelect}
      className={className}
      {...props}
    />
  )
}

// Optional default export for standalone usage/demo
export default function Calendar04Demo() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  })

  return (
    <CalendarRangePicker selected={dateRange} onSelect={setDateRange} />
  )
}
