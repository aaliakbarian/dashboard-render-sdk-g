import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  readonly children?: ReactNode;
  readonly errorLogger?: (error: Error) => void;
}

interface State {
  readonly failed: boolean;
}

/** View-only replacement for Grafana UI's inner panel error boundary. */
export class Grafana13ErrorBoundaryAlert extends Component<Props, State> {
  override readonly state: State = { failed: false };

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    void error;
  }

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override render(): ReactNode {
    if (this.state.failed) {
      throw new Error('The Grafana 13 panel render failed.');
    }
    return this.props.children;
  }
}
