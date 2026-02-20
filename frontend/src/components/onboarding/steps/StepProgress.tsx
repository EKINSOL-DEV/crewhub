export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
            i + 1 <= step ? 'bg-primary' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  )
}
