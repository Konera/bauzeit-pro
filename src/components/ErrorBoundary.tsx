// ErrorBoundary: Fängt unbehandelte React-Fehler ab und zeigt
// eine benutzerfreundliche Fehlermeldung statt eines weißen Bildschirms
import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-6 bg-stopped/20 rounded-2xl flex items-center justify-center">
              <AlertTriangle size={32} className="text-stopped" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">
              Etwas ist schiefgelaufen
            </h1>
            <p className="text-slate-400 text-sm mb-6">
              Ein unerwarteter Fehler ist aufgetreten. Bitte lade die App neu.
            </p>
            {this.state.error && (
              <p className="text-xs text-slate-600 bg-slate-900 p-3 rounded-xl mb-6 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="flex items-center justify-center gap-2 mx-auto bg-construction-500 hover:bg-construction-600 text-white py-3 px-6 rounded-xl font-medium transition-all active:scale-95"
            >
              <RefreshCw size={16} />
              App neu laden
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
