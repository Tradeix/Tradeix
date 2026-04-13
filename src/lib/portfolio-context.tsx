'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Portfolio } from '@/types'

type PortfolioContextType = {
  activePortfolio: Portfolio | null
  portfolios: Portfolio[]
  portfoliosLoaded: boolean
  setActivePortfolio: (p: Portfolio) => void
  reload: () => void
}

const PortfolioContext = createContext<PortfolioContextType>({
  activePortfolio: null,
  portfolios: [],
  portfoliosLoaded: false,
  setActivePortfolio: () => {},
  reload: () => {},
})

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [activePortfolio, setActivePortfolioState] = useState<Portfolio | null>(null)
  const [portfoliosLoaded, setPortfoliosLoaded] = useState(false)
  const supabase = createClient()

  useEffect(() => { loadPortfolios() }, [])

  async function loadPortfolios() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPortfoliosLoaded(true); return }
    const { data } = await supabase
      .from('portfolios').select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', { ascending: false })
    if (!data || data.length === 0) { setPortfoliosLoaded(true); return }
    setPortfolios(data)
    const savedId = localStorage.getItem('tradeix-active-portfolio')
    const saved = data.find((p: Portfolio) => p.id === savedId)
    setActivePortfolioState(saved || data[0])
    if (!saved) localStorage.setItem('tradeix-active-portfolio', data[0].id)
    setPortfoliosLoaded(true)
  }

  function setActivePortfolio(p: Portfolio) {
    setActivePortfolioState(p)
    localStorage.setItem('tradeix-active-portfolio', p.id)
  }

  return (
    <PortfolioContext.Provider value={{ activePortfolio, portfolios, portfoliosLoaded, setActivePortfolio, reload: loadPortfolios }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  return useContext(PortfolioContext)
}
