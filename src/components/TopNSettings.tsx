import { useState } from 'react'

interface TopNSettingsProps {
  topProjects: number
  topRecipients: number
  onTopProjectsChange: (value: number) => void
  onTopRecipientsChange: (value: number) => void
}

export function TopNSettings({
  topProjects,
  topRecipients,
  onTopProjectsChange,
  onTopRecipientsChange
}: TopNSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur rounded-lg shadow-lg p-2 flex items-center gap-2 hover:bg-gray-50 transition-colors"
        title="TopN設定"
      >
        <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2" />
        </svg>
        <span className="text-xs text-gray-600 font-medium">TopN: {topProjects}/{topRecipients}</span>
      </button>
    )
  }

  return (
    <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur rounded-lg shadow-lg p-4 w-80">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">TopN表示設定</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        {/* Live settings display */}
        <div className="bg-green-50 border border-green-200 rounded p-2 text-xs">
          <div className="font-medium text-green-800 mb-1">現在の表示</div>
          <div className="text-green-700">
            事業: Top {topProjects.toLocaleString()} / 支出先: Top {topRecipients.toLocaleString()}
          </div>
          <div className="text-[10px] text-green-600 mt-1">
            ✓ スライダー変更で即座に反映
          </div>
        </div>

        {/* Projects slider */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            事業 (Layer 3) - Top {topProjects.toLocaleString()}
          </label>
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={topProjects}
            onChange={(e) => onTopProjectsChange(parseInt(e.target.value))}
            className="w-full h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>50</span>
            <span>2000</span>
          </div>
        </div>

        {/* Recipients slider */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            支出先 (Layer 4) - Top {topRecipients.toLocaleString()}
          </label>
          <input
            type="range"
            min={100}
            max={5000}
            step={100}
            value={topRecipients}
            onChange={(e) => onTopRecipientsChange(parseInt(e.target.value))}
            className="w-full h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>100</span>
            <span>5000</span>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px] text-blue-700">
          全データ（32,609ノード）から動的にフィルタリング中
        </div>
      </div>
    </div>
  )
}
