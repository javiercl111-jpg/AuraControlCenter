import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Error capturado en subcomponente:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 space-y-3 backdrop-blur text-left">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertOctagon className="h-5 w-5 animate-pulse" />
            <h4 className="text-sm font-bold uppercase tracking-wider">
              {this.props.fallbackTitle || "Error en Componente Comercial"}
            </h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Ocurrió un error inesperado al renderizar esta sección del panel comercial. Los datos podrían ser incompletos o incompatibles.
          </p>
          {this.state.error && (
            <pre className="rounded-lg bg-slate-950 p-3 text-[10px] text-rose-300 font-mono overflow-x-auto leading-relaxed border border-slate-900">
              {this.state.error.toString()}
            </pre>
          )}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2 text-[11px] font-bold text-rose-300 hover:bg-rose-500/20 transition flex items-center gap-1.5 active:scale-95"
            >
              <RotateCcw className="h-3 w-3" />
              Reintentar Renderizado
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
