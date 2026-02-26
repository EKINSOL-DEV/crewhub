export function StepProgress({ step, total }: Readonly<{ step: number; readonly total: number }>) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_unused, idx) => idx).map((n) => (
        <div
          key={`step-${n}`}
          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
            n + 1 <= step ? 'bg-primary' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  )
}
