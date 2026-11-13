import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/league-spartan/400.css';
import '@fontsource/league-spartan/500.css';
import '@fontsource/league-spartan/600.css';
import '@fontsource/league-spartan/700.css';
import '@fontsource/league-spartan/800.css';
import './index.css';
import App from './App.jsx';
import { dismissBootLoader } from './lib/bootLoader';
import { initVisualPerformance } from './lib/visualPerformance';
import { installScrollChain } from './utils/scrollChain';
import { installGlobalErrorReporting } from './lib/errorReporter';

initVisualPerformance();
installScrollChain();
installGlobalErrorReporting();

// Failsafe: never leave the boot overlay stuck if App mount is delayed
window.setTimeout(dismissBootLoader, 2500);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
