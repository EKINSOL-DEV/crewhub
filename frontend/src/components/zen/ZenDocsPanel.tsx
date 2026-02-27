/**
 * Zen Docs Panel - Browse CrewHub repo documentation (docs/ folder)
 * Folder tree view with collapsible directories and fullscreen markdown viewer.
 */

import { FullscreenOverlay } from '../markdown/FullscreenOverlay'
import { DocumentTreeNode } from '@/components/shared/DocumentTreeNode'
import { formatDocDate, useDocumentPanel } from './hooks/useDocumentPanel'

const BORDER_1PX_SOLID_VAR_ZEN_BORDER_HSL_V = '1px solid var(--zen-border, hsl(var(--border)))'
const VAR_ZEN_FG = 'var(--zen-fg, hsl(var(--foreground)))'
const VAR_ZEN_FG_DIM = 'var(--zen-fg-dim, hsl(var(--muted-foreground)))'

export function ZenDocsPanel() {
  const {
    sortedTree,
    loading,
    error,
    content,
    selectedPath,
    contentLoading,
    fullscreenOpen,
    searchQuery,
    sortKey,
    fileCount,
    setSearchQuery,
    setSortKey,
    setFullscreenOpen,
    openDoc,
  } = useDocumentPanel({
    treeErrorMessage: 'Failed to load docs tree',
    documentErrorMessage: 'Failed to load document',
  })

  return (
    <div
      style={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--zen-bg, hsl(var(--background)))',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: BORDER_1PX_SOLID_VAR_ZEN_BORDER_HSL_V,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: VAR_ZEN_FG }}>📚 Docs</span>
        <span style={{ fontSize: 11, color: VAR_ZEN_FG_DIM }}>{fileCount} files</span>
        <div style={{ flex: 1 }} />

        <button
          onClick={() => setSortKey((k) => (k === 'name' ? 'date' : 'name'))}
          title={`Sort by ${sortKey === 'name' ? 'date' : 'name'}`}
          style={{
            background: 'none',
            border: BORDER_1PX_SOLID_VAR_ZEN_BORDER_HSL_V,
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 10,
            padding: '3px 8px',
            color: VAR_ZEN_FG_DIM,
          }}
        >
          {sortKey === 'name' ? '🔤 Name' : '🕒 Date'}
        </button>

        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: 160,
            padding: '4px 8px',
            border: BORDER_1PX_SOLID_VAR_ZEN_BORDER_HSL_V,
            borderRadius: 4,
            background: 'var(--zen-bg-panel, hsl(var(--card)))',
            color: VAR_ZEN_FG,
            fontSize: 12,
            outline: 'none',
          }}
        />
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {(() => {
          if (loading) {
            return (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  fontSize: 12,
                  color: VAR_ZEN_FG_DIM,
                }}
              >
                Loading…
              </div>
            )
          }

          if (error && !fullscreenOpen) {
            return (
              <div style={{ padding: 16, color: 'var(--zen-error, #ef4444)', fontSize: 13 }}>
                {error}
              </div>
            )
          }

          if (sortedTree.length === 0) {
            return (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  fontSize: 12,
                  color: VAR_ZEN_FG_DIM,
                }}
              >
                No documents found
              </div>
            )
          }

          return sortedTree.map((node) => (
            <DocumentTreeNode
              key={node.path}
              node={node}
              depth={0}
              sortKey={sortKey}
              onOpen={openDoc}
              searchQuery={searchQuery}
              variant="zen"
              formatDate={(ts) => formatDocDate(ts, true)}
            />
          ))
        })()}
      </div>

      <FullscreenOverlay
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        title={selectedPath?.split('/').pop()?.replace(/\.md$/, '') || ''}
        subtitle={selectedPath || ''}
        content={contentLoading ? 'Loading…' : content}
      />
    </div>
  )
}
