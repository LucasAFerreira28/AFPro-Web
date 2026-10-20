import React from 'react';

export default function TopBar() {
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="topbar">
      <div>
        <p className="topbar-kicker">AFPro</p>
        <h1>Painel de Coletas</h1>
      </div>

      <div className="topbar-meta">
        <span className="status-pill online">Online</span>
        <span className="topbar-date">{formattedDate}</span>
      </div>
    </header>
  );
}
