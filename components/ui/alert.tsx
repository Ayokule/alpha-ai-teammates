"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle, CheckCircle2 } from "lucide-react"

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success"
}

function renderChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") {
    return React.createElement("div", { className: "font-medium" }, children)
  }

  if (React.isValidElement(children)) {
    return React.createElement("div", { className: "font-medium" }, String((children as React.ReactElement<any>).props.children))
  }

  const childrenArray = React.Children.toArray(children)
  if (childrenArray.length > 0) {
    const fontMediumDivs = childrenArray.map((child, index) => {
      const childElement = childrenArray[index] as React.ReactElement<any> | null
      if (React.isValidElement(childElement)) {
        return React.createElement("div", { key: index, className: "font-medium" }, String((childElement as React.ReactElement<any>).props.children))
      }
      return null
    })

    const textSmDivs = childrenArray.map((child, index) => {
      const childElement = child as React.ReactElement<any> | null
      if (React.isValidElement(childElement)) {
        return React.createElement("div", { key: index }, String((childElement as React.ReactElement<any>).props.children))
      }
      return null
    })

    return React.createElement(React.Fragment, null,
      React.createElement("div", { className: "font-medium" }, fontMediumDivs),
      React.createElement("div", { className: "text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground" }, textSmDivs)
    )
  }
  return null
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return React.createElement("div",
      {
        ref,
        role: "alert",
        className: cn(
          "relative w-full rounded-lg border p-4 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
          {
            "border-border bg-muted text-muted-foreground": variant === "default",
            "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive": variant === "destructive",
            "border-green-500/50 text-green-700 dark:border-green-500/50 bg-green-500/10 [&>svg]:text-green-500": variant === "success",
          },
          className
        ),
        ...props
      },
      variant === "default" && React.createElement(AlertCircle, { className: "h-4 w-4" }),
      variant === "destructive" && React.createElement(AlertCircle, { className: "h-4 w-4" }),
      variant === "success" && React.createElement(CheckCircle2, { className: "h-4 w-4" }),
      React.createElement("div", { className: "ml-5" },
        React.createElement("div", { className: "flex flex-col gap-1" },
          renderChildren(children)
        )
      )
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  React.createElement("h5",
    { ref, className: cn("mb-1 font-medium leading-none tracking-tight", className), ...props }
  ))
)
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  React.createElement("div",
    { ref, className: cn("text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground", className), ...props }
  ))
)
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }