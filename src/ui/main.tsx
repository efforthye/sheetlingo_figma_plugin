import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

/** Shows crashes instead of a blank window. */
class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { error: e instanceof Error ? e.stack || e.message : String(e) }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="body">
        <b>Sheetlingo crashed</b>
        <pre className="note err" style={{ whiteSpace: 'pre-wrap', userSelect: 'text' }}>{this.state.error}</pre>
      </div>
    );
  }
}

function showFatal(msg: string) {
  const el = document.getElementById('fatal') || document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'fatal' }));
  el.className = 'note err';
  el.setAttribute('style', 'white-space:pre-wrap;margin:12px;user-select:text');
  el.textContent = 'Sheetlingo error: ' + msg;
}
window.addEventListener('error', (e) => showFatal(e.message));
window.addEventListener('unhandledrejection', (e) => showFatal(String(e.reason?.stack || e.reason)));

createRoot(document.getElementById('root')!).render(<Boundary><App /></Boundary>);
