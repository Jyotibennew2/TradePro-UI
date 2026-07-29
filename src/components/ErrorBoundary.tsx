/**
 * TradePro - Diagnostic Error Boundary
 * Purely a safety/diagnostic wrapper — catches render errors that would
 * otherwise crash to a blank screen, and shows the exact error message +
 * component stack on-screen instead. No business logic touched; this only
 * wraps existing pages so crashes are visible instead of silent.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    // eslint-disable-next-line no-console
    console.error("TradePro crash:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#0a0010", color: "#fff", minHeight: "100vh", padding: 16, fontFamily: "monospace", fontSize: 12, overflowY: "auto" }}>
          <div style={{ color: "#ff5577", fontWeight: 900, fontSize: 16, marginBottom: 10 }}>⚠ TradePro crashed</div>
          <div style={{ color: "#ffaa55", fontWeight: 700, marginBottom: 6 }}>{this.state.error.name}: {this.state.error.message}</div>
          <pre style={{ whiteSpace: "pre-wrap", color: "#88ccff", fontSize: 10, marginBottom: 14 }}>{this.state.error.stack}</pre>
          {this.state.info && (
            <>
              <div style={{ color: "#ffaa55", fontWeight: 700, marginBottom: 6 }}>Component stack:</div>
              <pre style={{ whiteSpace: "pre-wrap", color: "#aaaaaa", fontSize: 10 }}>{this.state.info.componentStack}</pre>
            </>
          )}
          <button
            onClick={() => this.setState({ error: null, info: null })}
            style={{ marginTop: 16, padding: "8px 16px", background: "#00c8f0", color: "#000", fontWeight: 900, borderRadius: 8, border: "none" }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
