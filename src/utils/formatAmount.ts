/**
 * Format a monetary amount in Japanese Yen
 * Uses appropriate units (億円, 万円, 円) for readability
 */
export function formatAmount(amount: number): string {
  if (amount >= 100_000_000) {
    // 億円 (hundred million yen)
    const oku = amount / 100_000_000
    return `${oku.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}億円`
  }

  if (amount >= 10_000) {
    // 万円 (ten thousand yen)
    const man = amount / 10_000
    return `${man.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`
  }

  // 円 (yen)
  return `${amount.toLocaleString('ja-JP')}円`
}

/**
 * Format amount with full precision
 */
export function formatAmountFull(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

/**
 * Format execution rate as percentage
 */
export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}
