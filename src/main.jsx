import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { dismissBootLoader } from './lib/bootLoader';

// Failsafe: never leave the boot overlay stuck if App mount is delayed
window.setTimeout(dismissBootLoader, 2500);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
