// POC / EXPERIMENT / NOT FOR PRODUCTION
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { SharedGrafanaCohortApp, inspectSharedGrafanaCohort } from './browserApp.tsx';
import '../lazy-panel-chunks/browser.css';

const element = document.getElementById('root');
if (!element) throw new Error('Shared-cohort experiment root is missing.');
createRoot(element).render(<StrictMode><SharedGrafanaCohortApp /></StrictMode>);
Object.assign(globalThis, { __SHARED_GRAFANA_COHORT__: { inspect: inspectSharedGrafanaCohort } });
