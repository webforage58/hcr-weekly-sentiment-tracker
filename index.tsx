import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import test suites for browser console access
import './test-weeklyCache';
import './test-cachesStaleness';
import './test-frameworkVersioning';
import './test-executiveSummary';
import './test-performanceBench';
import './test-realWorldRunLogger';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
