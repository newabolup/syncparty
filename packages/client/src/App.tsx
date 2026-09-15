import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './components/landing/LandingPage.js';
import { WatchRoom } from './components/room/WatchRoom.js';
import { ToastContainer, ToastMessage } from './components/common/Toast.js';
import { Navbar } from './components/common/Navbar.js';

export const App: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (
    text: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Navbar />
                <LandingPage onToast={addToast} />
              </>
            }
          />
          <Route path="/room/:roomId" element={<WatchRoom onToast={addToast} />} />
        </Routes>
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </div>
    </BrowserRouter>
  );
};
export default App;
