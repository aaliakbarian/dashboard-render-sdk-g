import Keycloak from 'keycloak-js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App, createStandaloneSdk } from './App';
import { createAuthSession } from './authSession';
import './styles.css';

const element = document.getElementById('root');
if (!element) throw new Error('The standalone demo requires a root element.');

// The host owns one adapter and starts one initialization, before StrictMode
// can replay effects. React only subscribes to this shared promise.
const keycloak = new Keycloak({
  url: `${window.location.origin}/keycloak`,
  realm: 'dashboard-render-sdk-g-demo',
  clientId: 'standalone-demo',
});
const session = createAuthSession({ keycloak });
const initialization = session.initialize();
const sdk = createStandaloneSdk(window.location.origin);
const root = createRoot(element);

root.render(
  <StrictMode>
    <App initialization={initialization} logout={session.logout} sdk={sdk} />
  </StrictMode>
);

if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
