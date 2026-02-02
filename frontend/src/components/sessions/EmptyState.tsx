export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="text-6xl mb-4">💤</div>
      <h3 className="text-lg font-semibold mb-2">No agents running</h3>
      <p className="text-muted-foreground text-sm">
        Start an agent to see it appear here
      </p>
    </div>
  )
}
