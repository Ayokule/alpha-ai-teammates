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
import { Bot, BotRole, Department, BotToolConfig } from "@/types"

const toolConfigSchema = z.object({
  toolkit: z.string(),
  composio_connection_id: z.string().optional(),
  is_active: z.boolean().default(true),
})

const botSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be 50 characters or less"),
  role: z.enum(["head", "lead", "worker"], { required_error: "Role is required" }),
  department_id: z.string().min(1, "Department is required"),
  avatar_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  instructions: z.string().optional(),
  tool_configs: z.array(z.object({
    toolkit: z.string(),
    composio_connection_id: z.string().optional(),
    is_active: z.boolean().default(true),
  })).optional(),
})

type BotFormData = z.infer<typeof botSchema>

interface BotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: BotFormData) => Promise<void>
  workspaceId: string
  departments: Department[]
  availableToolkits: { toolkit: string; connection_id: string }[]
  bot?: Bot | null
  isEditing: boolean
}

const defaultValues: BotFormData = {
  name: "",
  role: "worker",
  department_id: "",
  avatar_color: "#6366F1",
  instructions: "",
  tool_configs: [],
}

export function BotDialog({
  open,
  onOpenChange,
  onSubmit,
  workspaceId,
  departments,
  availableToolkits,
  bot,
  isEditing,
}: BotDialogProps) {
  const form = useForm<BotFormData>({
    resolver: zodResolver(botSchema) as any,
    defaultValues: bot ? {
      name: bot.name,
      role: bot.role,
      department_id: bot.department_id || "",
      avatar_color: bot.avatar_color,
      instructions: bot.instructions || "",
      tool_configs: bot.tool_configs?.map(tc => ({
        toolkit: tc.toolkit,
        composio_connection_id: tc.composio_connection_id || "",
        is_active: tc.is_active ?? true,
      })) || [],
    } : defaultValues,
  })

  const handleFormSubmit = (data: BotFormData) => {
    onSubmit(data)
    onOpenChange(false)
  }

  const isHead = bot?.role === "head" || (!isEditing && form.watch("role") === "head")
  const isLead = form.watch("role") === "lead"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Bot" : "Add Bot"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the bot configuration"
              : "Create a new bot for your workspace"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Bot Name</label>
            <Input
              placeholder="e.g., Research Bot"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Role</label>
            <Select onValueChange={(v) => form.setValue("role", v as any)} defaultValue={form.watch("role")}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="worker">Worker - Executes assigned tasks</SelectItem>
                <SelectItem value="lead">Lead - Manages workers & assigns tasks</SelectItem>
                <SelectItem value="head">Head - Plans work for entire team (one per workspace)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Department (Floor)</label>
            <Select onValueChange={(v) => form.setValue("department_id", v)} defaultValue={form.watch("department_id")} disabled={form.watch("role") === "head"}>
              <SelectTrigger>
                <SelectValue placeholder={form.watch("role") === "head" ? "Head bot is on the top floor" : "Select department"} />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Avatar Color</label>
            <ColorPicker value={form.watch("avatar_color")} onChange={(v) => form.setValue("avatar_color", v)} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Instructions</label>
            <Textarea
              placeholder="Enter custom instructions for this bot..."
              className="min-h-[120px]"
              {...form.register("instructions")}
            />
          </div>

          {/* Tool Access Configuration */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Tool Access</label>
            <div className="space-y-3">
              {availableToolkits.map((toolkit) => {
                const toolConfigs = form.watch("tool_configs") || []
                const currentConfig = toolConfigs.find(tc => tc.toolkit === toolkit.toolkit)
                const isConnected = !!toolkit.connection_id
                const isActive = currentConfig?.is_active ?? false
                return (
                  <div key={toolkit.toolkit} className="flex items-center justify-between p-3 border border-border rounded-lg bg-background">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => {
                          const current = form.watch("tool_configs") || []
                          if (e.target.checked) {
                            form.setValue("tool_configs", [
                              ...current.filter(tc => tc.toolkit !== toolkit.toolkit),
                              { toolkit: toolkit.toolkit, composio_connection_id: toolkit.connection_id || "", is_active: true }
                            ])
                          } else {
                            form.setValue("tool_configs", current.filter(tc => tc.toolkit !== toolkit.toolkit))
                          }
                        }}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="font-medium">{toolkit.toolkit}</p>
                        <p className="text-sm text-muted-foreground">
                          {!!toolkit.connection_id ? "Connected" : "Not connected - click to connect"}
                        </p>
                      </div>
                    </div>
                    {!toolkit.connection_id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          alert(`Connect ${toolkit.toolkit} via Composio OAuth`)
                        }}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? "Save Changes" : "Add Bot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

