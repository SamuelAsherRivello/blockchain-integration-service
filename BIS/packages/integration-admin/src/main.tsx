import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './client/ui-layer-react/App';
import './client/ui-layer-react/style.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
