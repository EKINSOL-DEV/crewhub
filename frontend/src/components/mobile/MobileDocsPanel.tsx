/**
 * MobileDocsPanel - Mobile-friendly wrapper for docs browsing
 * Fullscreen file tree + markdown viewer with touch-friendly UI
 */

import { useState } from 'react'
import { ArrowLeft, Search, SortAsc, Clock } from 'lucide-react'
import { FullscreenOverlay } from '../markdown/FullscreenOverlay'
import { DocumentTreeNode } from '@/components/shared/DocumentTreeNode'
import { formatDocDate, useDocumentPanel } from '@/components/zen/hooks/useDocumentPanel'

const RGBA_255_255_255_0_06 = 'rgba(255,255,255,0.06)'

interface MobileDocsPanelProps {
  readonly onBack: () => void
}

export function MobileDocsPanel({ onBack }: MobileDocsPanelProps) {
  const [showSearch, setShowSearch] = useState(false)
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
    treeErrorMessage: 'Failed to load docs',
    documentErrorMessage: 'Failed to load document',
  })

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
          paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: RGBA_255_255_255_0_06,
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#f1f5f9' }}>📚 Docs</h1>
          <span style={{ fontSize: 11, color: '#64748b' }}>{fileCount} files</span>
        </div>

        <button
          onClick={() => setSortKey((k) => (k === 'name' ? 'date' : 'name'))}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: RGBA_255_255_255_0_06,
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={`Sort by ${sortKey === 'name' ? 'date' : 'name'}`}
        >
          {sortKey === 'name' ? <SortAsc size={16} /> : <Clock size={16} />}
        </button>

        <button
          onClick={() => setShowSearch((s) => !s)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: showSearch ? 'rgba(99,102,241,0.15)' : RGBA_255_255_255_0_06,
            color: showSearch ? '#818cf8' : '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Search size={16} />
        </button>
      </header>

      {/* Search bar */}
      {showSearch && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              color: '#e2e8f0',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {(() => {
          if (loading) {
            return (
              <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
                Loading…
              </div>
            )
          }

          if (error && !fullscreenOpen) {
            return <div style={{ padding: 20, color: '#ef4444', fontSize: 14 }}>{error}</div>
          }

          if (sortedTree.length === 0) {
            return (
              <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
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
              variant="mobile"
              formatDate={(ts) => formatDocDate(ts, false)}
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
