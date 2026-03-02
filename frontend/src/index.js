import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// ============== COMPREHENSIVE RESIZEOBSERVER ERROR SUPPRESSION ==============
// This is a known issue with Radix UI components and does not affect functionality

// 1. Override ResizeObserver with error-safe wrapper
if (typeof window !== 'undefined' && window.ResizeObserver) {
  const OriginalResizeObserver = window.ResizeObserver;
  
  window.ResizeObserver = class ResizeObserver extends OriginalResizeObserver {
    constructor(callback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          try {
            callback(entries, observer);
          } catch (e) {
            // Silently suppress ResizeObserver errors
          }
        });
      });
    }
  };
}

// 2. Intercept console.error to prevent red error overlay
const originalError = window.console.error;
window.console.error = (...args) => {
  const errorStr = args.join(' ').toLowerCase();
  
  // Check for ResizeObserver related errors
  if (
    errorStr.includes('resizeobserver') ||
    errorStr.includes('resize observer') ||
    errorStr.includes('loop completed') ||
    errorStr.includes('loop limit') ||
    errorStr.includes('undelivered notifications')
  ) {
    // Suppress completely
    return;
  }
  
  // Allow other errors through
  originalError.apply(console, args);
};

// 3. Global error event handler (highest priority)
window.addEventListener('error', (e) => {
  const msgStr = (e.message || '').toLowerCase();
  const errStr = (e.error?.message || '').toLowerCase();
  
  if (
    msgStr.includes('resizeobserver') ||
    msgStr.includes('loop completed') ||
    errStr.includes('resizeobserver') ||
    errStr.includes('loop completed')
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }
}, { capture: true });

// 4. Unhandled rejection handler
window.addEventListener('unhandledrejection', (e) => {
  const reason = String(e.reason || '').toLowerCase();
  if (reason.includes('resizeobserver')) {
    e.preventDefault();
    return false;
  }
});

// 5. React error boundary suppression hook
const originalReactError = window.onerror;
window.onerror = function(message, source, lineno, colno, error) {
  const msg = String(message || '').toLowerCase();
  if (
    msg.includes('resizeobserver') ||
    msg.includes('loop completed')
  ) {
    return true; // Suppress
  }
  if (originalReactError) {
    return originalReactError.apply(this, arguments);
  }
  return false;
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
