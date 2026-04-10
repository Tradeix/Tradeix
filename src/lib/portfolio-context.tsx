'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Portfolio } from '@/types'

type PortfolioContextType = {
  activePortfolio: Portfolio | null
  portfolios: Portfolio[]
  setActivePortfolio: (p: Portfolio) => void
  reload: () => void
}

const PortfolioContext = createContext<PortfolioContextType>({
  activePortfolio: null,
  portfolios: [],
  setActivePortfolio: () => {},
  reload: () => {},
})

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [activePortfolio, setActivePortfolioState] = useState<Portfolio | null>(null)
  const supabase = createClient()

  useEffect(() => { loadPortfolios() }, [])

  async function loadPortfolios() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('portfolios').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!data || data.length === 0) return
    setPortfolios(data)
    const savedId = localStorage.getItem('tradeix-active-portfolio')
    const saved = data.find((p: Portfolio) => p.id === savedId)
    setActivePortfolioState(saved || data[0])
    if (!saved) localStorage.setItem('tradeix-active-portfolio', data[0].id)
  }

  function setActivePortfolio(p: Portfolio) {
    setActivePortfolioState(p)
    localStorage.setItem('tradeix-active-portfolio', p.id)
  }

  return (
    <PortfolioContext.Provider value={{ activePortfolio, portfolios, setActivePortfolio, reload: loadPortfolios }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  return useContext(PortfolioContext)
}
