import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FolderTreeNode, type TreeNode } from './FolderTreeNode'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface DocumentSelectorModalProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly projectId: string
  readonly projectName?: string
  readonly onSelect: (path: string) => void
}

export function DocumentSelectorModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  onSelect,
}: DocumentSelectorModalProps) {
  const [tree, setTree] = useState<TreeNode[] | null>(null)
  const [, setFlatFiles] = useState<string[]>([])
  const [selectedPath, setSelectedPath] = useState<string>()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [warning, setWarning] = useState<string>()

  useEffect(() => {
    if (!open || !projectId) return
    setLoading(true)
    setSelectedPath(undefined)
    setSearch('')
    setWarning(undefined)
    setFlatFiles([])
    fetch(`${API_BASE}/api/projects/${projectId}/markdown-files`)
      .then((res) => res.json())
      .then((data) => {
        const treeData = data.tree || []
        setTree(treeData)
        setFlatFiles(data.files || [])
        if (data.warning) setWarning(data.warning)
        // If tree is empty but we have flat files, build a simple tree from file paths
        if (treeData.length === 0 && data.files && data.files.length > 0) {
          const simpleTree: TreeNode[] = data.files.map((f: string) => ({
            name: f.split('/').pop() || f,
            type: 'file' as const,
            path: f,
          }))
          setTree(simpleTree)
        }
      })
      .catch(() => setTree([]))
      .finally(() => setLoading(false))
  }, [open, projectId])

  const handleSelect = () => {
    if (selectedPath) {
      onSelect(selectedPath)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>📁 Select Document {projectName ? `from ${projectName}` : ''}</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />

        <div className="border rounded-md p-2 flex-1 min-h-[300px] max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="text-sm text-muted-foreground p-4 text-center">Loading files...</div>
          )}
          {!loading && tree?.length === 0 && (
            <div className="text-sm text-muted-foreground p-4 text-center">
              {warning || 'No markdown files found'}
            </div>
          )}
          {!loading &&
            tree?.map((node, i) => (
              <FolderTreeNode
                key={node.path || node.name + i}
                node={node}
                onSelectFile={setSelectedPath}
                selectedPath={selectedPath}
                searchFilter={search}
              />
            ))}
        </div>

        {selectedPath && (
          <div className="text-xs text-muted-foreground mt-1">
            Selected: <span className="font-mono">{selectedPath}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!selectedPath}>
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
