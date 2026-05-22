import type { Currency } from '@/lib/app-context'

const CURRENCY_LOCALE: Record<Currency, string> = {
  ILS: 'he-IL',
  USD: 'en-US',
  EUR: 'de-DE',
}

export function formatMoney(value: number, currency: Currency, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(value)
}

export function formatSignedMoney(value: number, currency: Currency, maximumFractionDigits = 0) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatMoney(Math.abs(value), currency, maximumFractionDigits)}`
}

export function formatCompactMoney(value: number, currency: Currency) {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatSignedCompactMoney(value: number, currency: Currency) {
  if (value === 0) return formatMoney(0, currency)
  const sign = value > 0 ? '+' : '-'
  return `${sign}${formatCompactMoney(Math.abs(value), currency)}`
}
