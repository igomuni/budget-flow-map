import { useState, useCallback } from 'react'
import type { TopNSettings } from '@/types/layout'

interface TopNSettingsProps {
  currentSettings?: TopNSettings
  topProjects: number
  topRecipients: number
  onTopProjectsChange: (value: number) => void
  onTopRecipientsChange: (value: number) => void
}

export function TopNSettings({
  currentSettings,
  topProjects,
  topRecipients,
  onTopProjectsChange,
  onTopRecipientsChange
}: TopNSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleCopyCommand = useCallback(() => {
    const command = `npm run data:layout ${topProjects} ${topRecipients}`
    navigator.clipboard.writeText(command)
    alert('コマンドをクリップボードにコピーしました')
  }, [topProjects, topRecipients])

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
        <h3 className="text-sm font-bold text-gray-800">TopN集約設定（リアルタイム）</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3 mb-4">
        {/* Live settings display */}
        <div className="bg-green-50 border border-green-200 rounded p-2 text-xs">
          <div className="font-medium text-green-800 mb-1">現在の表示</div>
          <div className="text-green-700">
            事業: Top {topProjects.toLocaleString()} /
            支出先: Top {topRecipients.toLocaleString()}
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
      </div>

      {/* Optional: Instructions for pre-generating */}
      {currentSettings && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
          <div className="text-xs text-blue-800 mb-1">
            <strong>事前生成された設定:</strong>
          </div>
          <div className="text-[11px] text-blue-700">
            事業: {currentSettings.projects} / 支出先: {currentSettings.recipients}
          </div>
          <div className="bg-gray-900 text-gray-100 rounded p-2 mt-2 font-mono text-[11px] overflow-x-auto">
            npm run data:layout {topProjects} {topRecipients}
          </div>
          <button
            onClick={handleCopyCommand}
            className="w-full mt-2 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-medium py-1 px-2 rounded transition-colors"
          >
            コマンドをコピー
          </button>
        </div>
      )}
    </div>
  )
}
