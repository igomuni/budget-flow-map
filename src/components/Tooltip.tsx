import { useStore } from '@/store'

export function Tooltip() {
  const position = useStore((state) => state.tooltipPosition)
  const content = useStore((state) => state.tooltipContent)

  if (!position || !content) return null

  return (
    <div
      className="absolute pointer-events-none bg-gray-900 text-white px-3 py-2 rounded shadow-lg text-sm z-50 max-w-xs"
      style={{
        left: position.x + 12,
        top: position.y + 12,
      }}
    >
      {content}
    </div>
  )
}
