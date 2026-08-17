import React from 'react';

export default function PointsList({ points = [], onEdit, onDelete }) {
  if (!points.length) return <div>Nenhum ponto cadastrado.</div>;

  return (
    <table className="table">
      <thead>
        <tr>
          <th>ID</th><th>Beneficiário</th><th>Rua</th><th>Nº</th><th>Bairro</th><th>Cidade</th><th>Data</th><th>Status</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {points.map(p => (
          <tr key={p.ID || p.id || Math.random()}>
            <td>{p.ID ?? p.id}</td>
            <td>{p.BENEFICIARIO}</td>
            <td>{p.RUA}</td>
            <td>{p.NR}</td>
            <td>{p.BAIRRO}</td>
            <td>{p.CIDADE}</td>
            <td>{p.DATA}</td>
            <td>{p.STATUS}</td>
            <td>
              <button onClick={() => onEdit(p)}>Editar</button>
              <button onClick={() => onDelete(p.ID ?? p.id)}>Excluir</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
