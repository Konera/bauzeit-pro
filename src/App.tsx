// App.tsx: Root-Komponente mit QueryClient und Router
import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppRouter } from './app/router'

// QueryClient für Datencaching konfigurieren
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 Minuten
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
