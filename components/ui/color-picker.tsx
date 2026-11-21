"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-12 rounded-md border border-border cursor-pointer",
          "hover:opacity-80 transition-opacity"
        )}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const color = e.target.value
          if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
            onChange(color)
          }
        }}
        className={cn(
          "flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background",
          "placeholder:text-muted-foreground"
        )}
        placeholder="#RRGGBB"
      />
    </div>
  )
}