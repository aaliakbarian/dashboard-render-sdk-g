// POC / EXPERIMENT / NOT FOR PRODUCTION
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { LazyPanelExperimentApp, inspectLazyPanelExperiment } from './browserApp.tsx';
import './browser.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Lazy-panel experiment root is missing.');
const root = createRoot(rootElement);
root.render(<StrictMode><LazyPanelExperimentApp /></StrictMode>);

Object.assign(globalThis, { __LAZY_PANEL_EXPERIMENT__: { inspect: inspectLazyPanelExperiment } });

