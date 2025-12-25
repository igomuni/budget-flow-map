import { useState, useCallback } from 'react'

interface TopNSettingsProps {
  topProjects: number
  topRecipients: number
  threshold: number
  onTopProjectsChange: (value: number) => void
  onTopRecipientsChange: (value: number) => void
  onThresholdChange: (value: number) => void
}

export function TopNSettings({
  topProjects,
  topRecipients,
  threshold,
  onTopProjectsChange,
  onTopRecipientsChange,
  onThresholdChange
}: TopNSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draftProjects, setDraftProjects] = useState(topProjects)
  const [draftRecipients, setDraftRecipients] = useState(topRecipients)
  const [draftThreshold, setDraftThreshold] = useState(threshold)

  // 適用ボタンが有効かどうか（値が変更されているか）
  const hasChanges = draftProjects !== topProjects || draftRecipients !== topRecipients || draftThreshold !== threshold

  const handleApply = () => {
    onTopProjectsChange(draftProjects)
    onTopRecipientsChange(draftRecipients)
    onThresholdChange(draftThreshold)
  }

  // 閾値を表示（円単位から適切な単位に変換）
  const formatThreshold = (value: number) => {
    if (value >= 1e12) {
      return `${(value / 1e12).toFixed(1)}兆円`
    }
    if (value >= 1e8) {
      return `${(value / 1e8).toFixed(0)}億円`
    }
    if (value >= 1e4) {
      return `${(value / 1e4).toFixed(0)}万円`
    }
    return `${value.toFixed(0)}円`
  }

  // Handle direct input for projects
  const handleProjectsInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value) || 50
      setDraftProjects(Math.max(50, Math.min(2000, value)))
    },
    []
  )

  // Handle direct input for recipients
  const handleRecipientsInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value) || 100
      setDraftRecipients(Math.max(100, Math.min(5000, value)))
    },
    []
  )


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
        {/* Current display */}
        <div className="bg-green-50 border border-green-200 rounded p-2 text-xs">
          <div className="font-medium text-green-800 mb-1">現在の表示</div>
          <div className="text-green-700">
            事業: Top {topProjects.toLocaleString()} / 支出先: Top {topRecipients.toLocaleString()}
          </div>
        </div>

        {/* Projects slider */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            事業 (Layer 3) - Top {draftProjects.toLocaleString()}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={50}
              max={2000}
              step={50}
              value={draftProjects}
              onChange={(e) => setDraftProjects(parseInt(e.target.value))}
              className="flex-1 h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
            />
            <input
              type="number"
              min={50}
              max={2000}
              value={draftProjects}
              onChange={handleProjectsInput}
              className="w-16 px-2 py-1 text-xs text-right text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>50</span>
            <span>2000</span>
          </div>
        </div>

        {/* Recipients slider */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            支出先 (Layer 4) - Top {draftRecipients.toLocaleString()}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={draftRecipients}
              onChange={(e) => setDraftRecipients(parseInt(e.target.value))}
              className="flex-1 h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
            />
            <input
              type="number"
              min={100}
              max={5000}
              value={draftRecipients}
              onChange={handleRecipientsInput}
              className="w-16 px-2 py-1 text-xs text-right text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>100</span>
            <span>5000</span>
          </div>
        </div>

        {/* Threshold slider */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            閾値（最小高さ適用） - {formatThreshold(draftThreshold)}
          </label>
          <input
            type="range"
            min={0}
            max={13}
            step={1}
            value={Math.log10(draftThreshold)}
            onChange={(e) => setDraftThreshold(10 ** parseFloat(e.target.value))}
            className="w-full h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-orange-500"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>1円</span>
            <span>10兆円</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            閾値未満のノードは最小高さ（2px）で表示
          </div>
        </div>

        {/* Apply button */}
        <button
          onClick={handleApply}
          disabled={!hasChanges}
          className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
            hasChanges
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {hasChanges ? '適用して再描画' : '変更なし'}
        </button>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px] text-blue-700">
          全データ（32,609ノード）から動的にフィルタリング
        </div>
      </div>
    </div>
  )
}
