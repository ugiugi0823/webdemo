import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface ThemeCtx {
  dark: boolean
  setDark: (v: boolean) => void
}

const ThemeContext = createContext<ThemeCtx>({ dark: false, setDark: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false)
  return <ThemeContext.Provider value={{ dark, setDark }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
