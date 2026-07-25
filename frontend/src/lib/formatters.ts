export function toNumber(value: number | string | undefined | null): number {
  if (typeof value === 'number') {
    return value
  }

  if (!value) {
    return 0
  }

  const parsed = Number.parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatCurrency(value: number | string | undefined | null): string {
  return `${toNumber(value).toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MT`
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return 'Sem registo'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
