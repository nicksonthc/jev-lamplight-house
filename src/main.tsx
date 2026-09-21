import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

// No StrictMode: double-invoked effects would build and dispose the scene's
// GPU buffers while the memoised scene graph still points at them.
createRoot(document.getElementById('root')!).render(<App />);
