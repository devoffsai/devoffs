import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Could not find root element with id 'root'");
}

try {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Critical: Failed to mount Devoffs Application:", error);
  rootElement.innerHTML = `
    <div style="background: #0f172a; color: white; padding: 40px; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
      <div style="max-width: 500px; background: #1e293b; padding: 30px; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <h1 style="font-size: 24px; color: #f87171; margin-bottom: 16px;">Application Error</h1>
        <p style="color: #94a3b8; margin-bottom: 24px;">The Skill DNA interface encountered a fatal initialization error during the render phase.</p>
        <pre style="color: #fca5a5; background: #0f172a; padding: 16px; border-radius: 8px; overflow: auto; text-align: left; font-size: 12px; font-family: 'JetBrains Mono', monospace; border: 1px solid #450a0a;">${error instanceof Error ? error.stack : String(error)}</pre>
        <button onclick="window.location.reload()" style="margin-top: 24px; background: #06b6d4; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer;">Retry Boot Sequence</button>
      </div>
    </div>`;
}