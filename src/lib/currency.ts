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
