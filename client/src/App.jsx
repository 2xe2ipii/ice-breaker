import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PlayerView from './views/PlayerView';
import HostView from './views/HostView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlayerView />} />
        <Route path="/host" element={<HostView />} />
      </Routes>
    </BrowserRouter>
  );
}