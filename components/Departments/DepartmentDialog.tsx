"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"

const departmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be 50 characters or less"),
  floor_tint: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
})

type DepartmentFormData = z.infer<typeof departmentSchema>

interface DepartmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: DepartmentFormData) => Promise<void>
  workspaceId: string
  department?: {
    id: string
    name: string
    floor_tint: string
  } | null
  isEditing: boolean
}

const defaultValues: DepartmentFormData = {
  name: "",
  floor_tint: "#F5F0E8",
}

export function DepartmentDialog({
  open,
  onOpenChange,
  onSubmit,
  workspaceId,
  department,
  isEditing,
}: DepartmentDialogProps) {
  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: department ? { name: department.name, floor_tint: department.floor_tint } : defaultValues,
  })

  const handleSubmit = (data: DepartmentFormData) => {
    onSubmit(data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Department" : "Add Department"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the department name and floor color"
              : "Create a new department floor in your workspace"}
          </DialogDescription>
        </DialogHeader>

        <Form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Engineering" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter a name for this department (e.g., Assistant, Research, Content, Engineering)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="floor_tint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Floor Tint Color</FormLabel>
                  <FormControl>
                    <ColorPicker {...field} />
                  </FormControl>
                  <FormDescription>
                    This color will be used for the floor tint in the 3D office view
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {isEditing ? "Save Changes" : "Add Department"}
              </Button>
            </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}