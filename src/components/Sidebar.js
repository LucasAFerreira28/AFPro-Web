import React from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function Sidebar() {
  const links = [
    { to: '/pontos', label: 'Pontos Atuais', icon: 'bi bi-list-check' },
    { to: '/historico', label: 'Histórico de Coletas', icon: 'bi bi-archive' },
    { to: '/nova', label: 'Nova Coleta', icon: 'bi bi-upload' },
    { to: '/jornada', label: 'Jornada', icon: 'bi bi-graph-up-arrow' },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src={logo} alt="Logo AFPro" className="logo" />
        <h3>AFPro</h3>
        <small>Painel de Coletas</small>
      </div>

      <nav className="sidebar-nav" aria-label="Menu principal">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            <i className={icon}></i>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="status-pill online">● Conectado ao Sheets</span>
      </div>
    </aside>
  );
}
