import { redirect } from 'next/navigation'

export default function PortfoliosPage() {
  redirect('/settings?section=portfolios')
}
