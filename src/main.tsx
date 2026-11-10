import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('[Inkwell Atelier] Initializing Studio with Writing Desk (Phase 2)');
createRoot(document.getElementById('root')!).render(<App />);
