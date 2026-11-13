import { Component } from 'react';
import { useLocation } from 'react-router-dom';
import { dismissBootLoader } from '../lib/bootLoader';

/**
 * Site-wide render error boundary. Keeps the navbar and footer usable when a
 * page crashes, and clears itself when the visitor navigates elsewhere.
 */
class ErrorBoundaryInner extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    dismissBootLoader();
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.locationKey !== this.props.locationKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center"
      >
        <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.22em] text-neon-cyan">
          Something broke
        </p>
        <h1 className="mb-4 text-2xl font-bold text-white sm:text-3xl">
          This page could not be displayed
        </h1>
        <p className="mb-8 text-sm text-text-secondary">
          Reloading usually fixes it. If it keeps happening, please let us know
          through the bug report page.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border border-neon-cyan/60 px-5 py-2 text-sm font-semibold uppercase tracking-wider text-neon-cyan hover:bg-neon-cyan/10"
          >
            Reload page
          </button>
          <a href="/" className="text-sm text-text-secondary underline hover:text-white">
            Go to home
          </a>
          <a
            href="/bugs/report"
            className="text-sm text-text-secondary underline hover:text-white"
          >
            Report a bug
          </a>
        </div>
      </div>
    );
  }
}

export default function ErrorBoundary({ children }) {
  const location = useLocation();
  return (
    <ErrorBoundaryInner locationKey={location.pathname}>
      {children}
    </ErrorBoundaryInner>
  );
}
