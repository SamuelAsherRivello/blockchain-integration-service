import { createRoot } from 'react-dom/client';
import { App } from './client/marketplace-layer/App';
import './client/ui-layer-react/style.css';
import './client/ui-layer-react/player-polish.css';
import './client/ui-layer-react/square-grid.css';
import './client/ui-layer-react/account-launcher.css';
createRoot(document.getElementById('root')!).render(<App />);
