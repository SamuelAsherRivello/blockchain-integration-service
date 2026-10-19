import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

const root = createRoot(document.getElementById('root'));
root.render(<StrictMode><App /></StrictMode>);

// Without an accepting entry boundary, a source edit reloads this MPA page
// and loses its memory-only results while a user is reading them.
if (import.meta.hot) {
  import.meta.hot.accept('./App.tsx', updated => {
    if (updated) root.render(<StrictMode><updated.App /></StrictMode>);
  });
}

