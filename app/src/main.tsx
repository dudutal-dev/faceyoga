import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { setupPWA } from './pwa';

setupPWA();

// HashRouter: עובד גם ב-GitHub Pages וגם מהתקנה למסך הבית בלי שרת.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
