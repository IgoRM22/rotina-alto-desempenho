export function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  return Math.round((due - today) / 86400000)
}

export function deadlineBadge(dateStr) {
  const days = daysUntil(dateStr)
  if (days === null) return null
  if (days < 0) return { text: `${Math.abs(days)}d vencido`, variant: 'overdue' }
  if (days === 0) return { text: 'Vence hoje', variant: 'urgent' }
  if (days === 1) return { text: 'Amanhã', variant: 'urgent' }
  if (days <= 7) return { text: `${days} dias`, variant: 'soon' }
  return { text: `${days} dias`, variant: 'ok' }
}
