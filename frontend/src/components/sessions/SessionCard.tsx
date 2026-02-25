import { memo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, MessageCircle } from 'lucide-react'
import type { CrewSession } from '@/lib/api'
import { useChatContext } from '@/contexts/ChatContext'
import {
  getSessionStatus,
  getStatusIndicator,
  parseRecentActivities,
  getCurrentActivity,
  getSessionType,
  getSessionDisplayName,
  formatModel,
  timeAgo,
  getSessionCost,
  formatCost,
} from '@/lib/minionUtils'
import { cn } from '@/lib/utils'
import { EditableSessionName } from './EditableSessionName'

interface SessionCardProps {
  session: CrewSession
  onViewLogs?: () => void
}

const FIXED_AGENT_RE = /^agent:[a-zA-Z0-9_-]+:main$/

export const SessionCard = memo(function SessionCard({ session, onViewLogs }: SessionCardProps) {
  const status = getSessionStatus(session)
  const statusInfo = getStatusIndicator(status)
  const sessionType = getSessionType(session)
  const fallbackName = getSessionDisplayName(session)
  const currentActivity = getCurrentActivity(session)
  const recentActivities = parseRecentActivities(session, 3)
  const cost = getSessionCost(session)
  const { openChat } = useChatContext()
  const isFixedAgent = FIXED_AGENT_RE.test(session.key)

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all hover:shadow-md',
        status === 'active' && 'border-green-300 dark:border-green-700',
        status === 'idle' && 'border-yellow-300 dark:border-yellow-700'
      )}
    >
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2"
              style={{ backgroundColor: `${sessionType.color}20`, borderColor: sessionType.color }}
              title={sessionType.type}
            >
              {sessionType.emoji}
            </div>
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs"
              title={statusInfo.label}
            >
              {statusInfo.emoji}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">
                <EditableSessionName
                  sessionKey={session.key}
                  fallbackName={fallbackName}
                  showEditIcon={true}
                />
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0"
                style={{ color: sessionType.color, borderColor: `${sessionType.color}40` }}
              >
                {sessionType.type}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={statusInfo.color}>
                {statusInfo.emoji} {timeAgo(session.updatedAt)}
              </span>
              {session.model && (
                <>
                  <span>·</span>
                  <span>{formatModel(session.model)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 p-2 bg-muted/30 rounded-md">
          <div className="text-xs text-muted-foreground italic">💭 "{currentActivity}"</div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Recent</div>
          <div className="space-y-1">
            {recentActivities.length === 0 ? (
              <div className="text-xs text-muted-foreground">No recent activity</div>
            ) : (
              recentActivities.map((a, i) => (
                <div key={i} className="text-xs text-muted-foreground truncate">
                  <span className="mr-1">{a.icon}</span>
                  {a.text}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {(session.totalTokens || 0).toLocaleString()} tokens
          </div>
          {cost > 0 && <div className="text-xs text-muted-foreground">{formatCost(cost)}</div>}
        </div>

        <div className="flex items-center gap-2 pt-2">
          {isFixedAgent && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={() =>
                openChat(session.key, fallbackName, sessionType.emoji, sessionType.color)
              }
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
              Chat
            </Button>
          )}
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={onViewLogs}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})

// Backwards compatibility alias
export { SessionCard as MinionCard }
