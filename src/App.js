// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import PointsPage from './pages/PointsPage';
import HistoryPage from './pages/HistoryPage';
import NovaColetaPage from './pages/NovaColetaPage';
import JornadaPage from './pages/JornadaPage';

export default function App(){
  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar />
        <div className="main">
          <TopBar />
          <div className="content">
            <Routes>
              <Route path="/" element={<Navigate to="/pontos" replace />} />
              <Route path="/pontos" element={<PointsPage />} />
              <Route path="/historico" element={<HistoryPage />} />
              <Route path="/nova" element={<NovaColetaPage />} />
               <Route path="/jornada" element={<JornadaPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}
