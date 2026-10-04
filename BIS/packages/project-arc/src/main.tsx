import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ArcApp } from './ArcApp';
import './style.css';

createRoot(document.getElementById('root')!).render(<StrictMode><ArcApp /></StrictMode>);
