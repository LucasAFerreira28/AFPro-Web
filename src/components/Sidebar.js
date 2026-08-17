import React from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../assets/logo.png'; // coloque sua imagem nesta pasta

export default function Sidebar(){
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src={logo} alt="Logo AFPro" className="logo" />
        <h3>AFPro</h3>
        <small>Painel de Coletas</small>
      </div>

      <nav>
        <NavLink to="/pontos" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <i className="bi bi-list-check"></i> Pontos Atuais
        </NavLink>
        <NavLink to="/historico" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <i className="bi bi-archive"></i> Histórico de Coletas
        </NavLink>
        <NavLink to="/nova" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <i className="bi bi-upload"></i> Nova Coleta
        </NavLink>
        <NavLink to="/jornada" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <i className="bi bi-upload"></i> Jornada
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <small>🟢 Conectado ao Sheets</small>
      </div>
    </aside>
  );
}

