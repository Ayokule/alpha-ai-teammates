"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { DepartmentDialog } from "./DepartmentDialog"
import { GripVertical, Trash2, Edit } from "lucide-react"
import { cn } from "@/lib/utils"
import { Department } from "@/types"

interface DepartmentListProps {
  departments: Department[]
  workspaceId: string
  onCreate: (data: { name: string; floor_tint: string }) => Promise<void>
  onUpdate: (deptId: string, data: { name: string; floor_tint: string }) => Promise<void>
  onReorder: (deptId: string, newOrder: number) => Promise<void>
  onDelete: (deptId: string, moveBotsTo?: string) => Promise<void>
  isLoading?: boolean
}

export function DepartmentList({
  departments,
  workspaceId,
  onCreate,
  onUpdate,
  onReorder,
  onDelete,
  isLoading,
}: DepartmentListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deletingDept, setDeletingDept] = useState<Department | null>(null)
  const [moveBotsTo, setMoveBotsTo] = useState<string>("")
  const [deleteError, setDeleteError] = useState<string>("")

  const handleOpenCreate = () => {
    setEditingDept(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept)
    setDialogOpen(true)
  }

  const handleOpenDelete = (dept: Department) => {
    setDeletingDept(dept)
    setMoveBotsTo("")
    setDeleteError("")
  }

  const handleSubmit = async (data: { name: string; floor_tint: string }) => {
    if (editingDept) {
      await onUpdate(editingDept.id, data)
    } else {
      await onCreate(data)
    }
    setDialogOpen(false)
  }

  const handleReorder = async (deptId: string, newOrder: number) => {
    await onReorder(deptId, newOrder)
  }

  const handleConfirmDelete = async () => {
    if (!deletingDept) return

    try {
      await onDelete(deletingDept.id, moveBotsTo || undefined)
    } catch (error) {
      setDeleteError("Failed to delete department")
    }
  }

  // Render loading state
  function renderLoading() {
    return (
      <div className="space-y-2" role="status" aria-label="Loading departments">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-12 bg-muted rounded-lg" />
        ))}
      </div>
    )
  }

  // Render empty state
  function renderEmpty() {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No departments yet</p>
        <p className="text-sm">Click "Add Department" to create your first floor</p>
      </div>
    )
  }

  // Render department list
  function renderList() {
    return (
      <div className="space-y-2">
        {departments.map((dept, index) => (
          <DepartmentRow
            key={dept.id}
            dept={dept}
            index={index}
            onEdit={handleOpenEdit}
            onReorder={handleReorder}
            onDelete={handleOpenDelete}
            totalCount={departments.length}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Departments</h3>
        <Button onClick={handleOpenCreate} disabled={isLoading}>
          Add Department
        </Button>
      </div>

      {isLoading ? renderLoading() : (
        departments.length === 0 ? renderEmpty() : renderList()
      )}

      {/* Create/Edit Dialog */}
      <DepartmentDialog
        open={dialogOpen}
        onOpenChange={(open: boolean) => setDialogOpen(open)}
        onSubmit={handleSubmit}
        workspaceId={workspaceId}
        department={editingDept}
        isEditing={!!editingDept}
      />

      {/* Delete Confirmation Dialog */}
      {deletingDept && (
        <Dialog open onOpenChange={(open: boolean) => setDeletingDept(open ? deletingDept : null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Department</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deletingDept.name}"?
                {deleteError && <p className="text-destructive mt-2">{deleteError}</p>}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Move bots to another department</label>
                <select
                  value={moveBotsTo}
                  onChange={(e) => setMoveBotsTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                >
                  <option value="">Select department (optional)</option>
                  {departments
                    .filter((d) => d.id !== deletingDept?.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  If left empty, bots in this department will need to be reassigned manually.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingDept(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

interface DepartmentRowProps {
  dept: Department
  index: number
  onEdit: (dept: Department) => void
  onReorder: (deptId: string, newOrder: number) => void
  onDelete: (dept: Department) => void
  totalCount: number
}

function DepartmentRow({ dept, index, onEdit, onReorder, onDelete, totalCount }: DepartmentRowProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2 text-muted-foreground">
        {index > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onReorder(dept.id, index - 1)}
            disabled={index === 0}
            aria-label="Move up"
          >
            <GripVertical className="h-4 w-4" />
          </Button>
        )}
        {index < totalCount - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onReorder(dept.id, index + 1)}
            disabled={index === totalCount - 1}
            aria-label="Move down"
          >
            <GripVertical className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="w-4 h-4 rounded-lg flex-shrink-0"
          style={{ backgroundColor: dept.floor_tint }}
          title={`Floor tint: ${dept.floor_tint}`}
        />
        <div className="min-w-0">
          <p className="font-medium truncate">{dept.name}</p>
          <p className="text-sm text-muted-foreground truncate">
            Floor {dept.display_order + 1} • {dept.bots?.length || 0} bots
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(dept)}
          aria-label="Edit department"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(dept)}
          aria-label="Delete department"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}