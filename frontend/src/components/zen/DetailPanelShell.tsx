import type { ReactNode } from 'react'

interface DetailPanelTab {
  readonly key: string
  readonly label: string
}

interface DetailPanelShellProps {
  readonly panelClassName: string
  readonly headerClassName: string
  readonly headerInfoClassName: string
  readonly headerInfo: ReactNode
  readonly tabs: DetailPanelTab[]
  readonly activeTab: string
  readonly onTabChange: (tab: string) => void
  readonly onClose: () => void
  readonly onFullscreen?: () => void
  readonly children: ReactNode
}

export function DetailPanelShell({
  panelClassName,
  headerClassName,
  headerInfoClassName,
  headerInfo,
  tabs,
  activeTab,
  onTabChange,
  onClose,
  onFullscreen,
  children,
}: DetailPanelShellProps) {
  return (
    <div className={panelClassName}>
      <div className={headerClassName}>
        <div className={headerInfoClassName}>{headerInfo}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {onFullscreen && (
            <button
              className="zen-sd-close"
              onClick={onFullscreen}
              title="Fullscreen"
              style={{ fontSize: 13 }}
            >
              ⛶
            </button>
          )}
          <button className="zen-sd-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
      </div>

      <div className="zen-sd-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`zen-sd-tab ${activeTab === tab.key ? 'zen-sd-tab-active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="zen-sd-content">{children}</div>
    </div>
  )
}
