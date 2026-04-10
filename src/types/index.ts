export type Portfolio = {
  id: string
  user_id: string
  name: string
  market_type: 'forex' | 'stocks' | 'crypto' | 'commodities' | 'other'
  initial_capital: number
  currency: string
  created_at: string
}

export type Trade = {
  id: string
  portfolio_id: string
  user_id: string
  symbol: string
  direction: 'long' | 'short'
  entry_price: number
  stop_loss: number
  take_profit: number
  pnl: number
  rr_ratio: number
  image_url?: string
  ai_analysis?: string
  notes?: string
  traded_at: string
  created_at: string
  outcome: 'win' | 'loss' | 'breakeven'
}

export type Profile = {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  language: 'he' | 'en'
  theme: 'dark' | 'light'
  created_at: string
}

export type Stats = {
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalPnl: number
  profitFactor: number
  avgRR: number
  bestTrade: number
  worstTrade: number
}
