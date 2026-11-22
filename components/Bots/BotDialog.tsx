"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Department, Bot, BotRole } from "@/types"
import { cn } from "@/lib/utils"

const botSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be 50 characters or less"),
  role: z.enum(["head", "lead", "worker"]),
  department_id: z.string().min(1, "Department is required"),
  avatar_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  instructions: z.string().max(2000, "Instructions must be 2000 characters or less"),
  monthly_budget_usd: z.number().min(0).max(10000).optional(),
  budget_alert_threshold: z.number().min(0).max(1).optional(),
})

type BotFormData = z.infer<typeof botSchema>

interface BotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: BotFormData) => Promise<void>
  departments: Department[]
  bot?: Bot | null
  isEditing: boolean
}

const defaultValues: BotFormData = {
  name: "",
  role: "worker",
  department_id: "",
  avatar_color: "#6366F1",
  instructions: "",
  monthly_budget_usd: 0,
  budget_alert_threshold: 0.8,
}

export function BotDialog({
  open,
  onOpenChange,
  onSubmit,
  departments,
  bot,
  isEditing,
}: BotDialogProps) {
  const form = useForm<BotFormData>({
    resolver: zodResolver(botSchema),
    defaultValues: bot
      ? {
          name: bot.name,
          role: bot.role,
          department_id: bot.department_id || "",
          avatar_color: bot.avatar_color,
          instructions: bot.instructions,
          monthly_budget_usd: bot.monthly_budget_usd,
          budget_alert_threshold: bot.budget_alert_threshold,
        }
      : defaultValues,
  })

  const handleSubmit = (data: BotFormData) => {
    onSubmit(data)
    onOpenChange(false)
  }

  const sortedDepts = departments
    .slice()
    .sort((a, b) => a.display_order - b.display_order)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Bot" : "Add Bot"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the bot's configuration"
              : "Create a new bot for your team"}
          </DialogDescription>
        </DialogHeader>

        <Form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Research Bot" {...field} />
                  </FormControl>
                  <FormDescription>
                    Give this bot a memorable name
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lead">Lead — Can assign tasks to workers</SelectItem>
                      <SelectItem value="worker">Worker — Executes assigned tasks</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Leads can delegate tasks to workers on any floor. Workers execute tasks.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Department */}
            <FormField
              control={form.control}
              name="department_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department (Floor)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sortedDepts.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name} (Floor {dept.display_order})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The floor this bot will work on
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Avatar Color */}
            <FormField
              control={form.control}
              name="avatar_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar Color</FormLabel>
                  <FormControl>
                    <ColorPicker {...field} />
                  </FormControl>
                  <FormDescription>
                    Color for the bot's avatar in the 3D office
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Instructions */}
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>System Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the bot's system prompt / instructions..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Define this bot's role, capabilities, and behavior. This becomes the system prompt.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Budget Settings */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthly_budget_usd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Budget (USD)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10000"
                        placeholder="0 = inherit from workspace"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      0 means inherit from workspace budget
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget_alert_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alert Threshold</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        placeholder="0.8 = 80%"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Alert when budget reaches this percentage
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Head bot warning */}
            {bot?.is_head_immutable && (
              <Alert variant="default" className="border-blue-200 bg-blue-50">
                <span className="text-sm text-blue-800">
                  This is the Head Bot and cannot be deleted, demoted, or moved to another floor.
                </span>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {isEditing ? "Save Changes" : "Add Bot"}
              </Button>
            </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}