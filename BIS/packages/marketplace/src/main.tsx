import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './style.css';
import './square-grid.css';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
