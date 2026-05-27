import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optionnel : contenu de repli personnalisé. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary React — attrape les erreurs de rendu et affiche un message
 * au lieu d'un écran noir silencieux.
 *
 * À placer autour des composants critiques (pages, sections complexes).
 * En prod → affiche un message propre. En dev → affiche la stack pour debug.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Log en dev pour faciliter le debug
    console.error('[ErrorBoundary] Erreur capturée:', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <div className="text-sm font-bold text-red mb-1">Erreur de rendu</div>
          <div className="text-xs text-muted-2 font-mono max-w-xs break-words">
            {this.state.error.message}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-4 py-2 rounded-lg border border-teal/40 text-teal text-xs font-bold uppercase tracking-wider tap-transparent"
          >
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
