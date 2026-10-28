import { Component, type ErrorInfo, type ReactNode } from 'react';
interface Props {
    readonly children?: ReactNode;
    readonly errorLogger?: (error: Error) => void;
}
interface State {
    readonly failed: boolean;
}
export declare class Grafana13ErrorBoundaryAlert extends Component<Props, State> {
    readonly state: State;
    componentDidCatch(error: Error, _info: ErrorInfo): void;
    static getDerivedStateFromError(): State;
    render(): ReactNode;
}
export {};
