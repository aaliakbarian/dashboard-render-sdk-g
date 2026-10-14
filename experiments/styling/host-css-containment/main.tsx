// POC / EXPERIMENT / NOT FOR PRODUCTION
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { HostCssContainmentApp, inspectHostCssContainment } from './runtimeApp.tsx';
import './host-profiles.css';
import './provider-containment.css';

const element = document.getElementById('root');
if (!element) throw new Error('Host CSS containment experiment root is missing.');

createRoot(element).render(
  <StrictMode>
    <HostCssContainmentApp />
  </StrictMode>
);

Object.assign(globalThis, {
  __HOST_CSS_CONTAINMENT__: { inspect: inspectHostCssContainment },
});
