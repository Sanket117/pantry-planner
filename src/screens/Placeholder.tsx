interface PlaceholderProps {
  title: string
  phase: string
}

export function Placeholder({ title, phase }: PlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl font-semibold text-stone-800">{title}</h1>
      <p className="text-sm text-stone-500">Coming in {phase}.</p>
    </div>
  )
}
