import { useState, useCallback, useEffect } from 'react'

interface TopNSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  topProjects: number
  topRecipients: number
  threshold: number
  onApply: (settings: { topProjects: number; topRecipients: number; threshold: number }) => void
}

export function TopNSettingsDialog({
  isOpen,
  onClose,
  topProjects,
  topRecipients,
  threshold,
  onApply,
}: TopNSettingsDialogProps) {
  // Local state for slider values (not applied until user clicks Apply)
  const [localTopProjects, setLocalTopProjects] = useState(topProjects)
  const [localTopRecipients, setLocalTopRecipients] = useState(topRecipients)
  const [localThreshold, setLocalThreshold] = useState(threshold)

  // Sync local state when dialog opens with current props
  useEffect(() => {
    if (isOpen) {
      setLocalTopProjects(topProjects)
      setLocalTopRecipients(topRecipients)
      setLocalThreshold(threshold)
    }
  }, [isOpen, topProjects, topRecipients, threshold])

  const handleApply = useCallback(() => {
    onApply({
      topProjects: localTopProjects,
      topRecipients: localTopRecipients,
      threshold: localThreshold,
    })
    onClose()
  }, [localTopProjects, localTopRecipients, localThreshold, onApply, onClose])

  const handleCancel = useCallback(() => {
    // Reset local state to current props
    setLocalTopProjects(topProjects)
    setLocalTopRecipients(topRecipients)
    setLocalThreshold(threshold)
    onClose()
  }, [topProjects, topRecipients, threshold, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-xl p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">表示フィルター設定</h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {/* Top Projects */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              事業表示数: Top {localTopProjects}
            </label>
            <input
              type="range"
              min={100}
              max={2000}
              step={100}
              value={localTopProjects}
              onChange={(e) => setLocalTopProjects(parseInt(e.target.value))}
              className="w-full h-2 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>100</span>
              <span>2000</span>
            </div>
          </div>

          {/* Top Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              支出先表示数: Top {localTopRecipients}
            </label>
            <input
              type="range"
              min={100}
              max={3000}
              step={100}
              value={localTopRecipients}
              onChange={(e) => setLocalTopRecipients(parseInt(e.target.value))}
              className="w-full h-2 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>100</span>
              <span>3000</span>
            </div>
          </div>

          {/* Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              最小高さ閾値: {localThreshold >= 1e12 ? `${(localThreshold / 1e12).toFixed(1)}兆円` : `${(localThreshold / 1e8).toFixed(0)}億円`}
            </label>
            <input
              type="range"
              min={0}
              max={5e12}
              step={1e11}
              value={localThreshold}
              onChange={(e) => setLocalThreshold(parseInt(e.target.value))}
              className="w-full h-2 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0円</span>
              <span>5兆円</span>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
            ⚠️ 設定を適用すると、レイアウト再計算のため数秒かかる場合があります
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            適用
          </button>
        </div>
      </div>
    </>
  )
}
