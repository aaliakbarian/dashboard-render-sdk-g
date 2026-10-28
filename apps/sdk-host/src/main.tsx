import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { App } from './App';
import './host.css';

let root: Root | undefined;

export function mountSdkHost(element: HTMLElement): void {
  if (root) throw new Error('The SDK host already has an active React root.');
  root = createRoot(element);
  root.render(<StrictMode><App /></StrictMode>);
}

export function unmountSdkHost(): void {
  root?.unmount();
  root = undefined;
}

const element = document.querySelector<HTMLElement>('#root');
if (!element) throw new Error('The SDK host requires a #root element.');
mountSdkHost(element);

if (import.meta.hot) import.meta.hot.dispose(unmountSdkHost);
