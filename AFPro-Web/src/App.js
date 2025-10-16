import React, { useEffect, useState } from 'react';
import { api } from './api';
import PointForm from './components/PointForm';
import PointsList from './components/PointsList';

export default function App() {
  const [points, setPoints] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.list();
      setPoints(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      alert('Erro ao carregar dados. Confira a URL do Apps Script.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(data) {
    const res = await api.create(data);
    if (res && (res.id || res.ID)) {
      await load();
      return true;
    }
    alert('Erro ao criar ponto.');
    return false;
  }

  async function onUpdate(id, data) {
    const res = await api.update(id, data);
    if (res && res.result === 'OK') {
      await load();
      setEditing(null);
      return true;
    }
    alert('Erro ao atualizar.');
    return false;
  }

  async function onDelete(id) {
    if (!window.confirm('Remover este ponto?')) return;
    const res = await api.remove(id);
    if (res && res.result === 'OK') {
      await load();
    } else alert('Erro ao excluir.');
  }

  return (
    <div className="container">
      <h1>AFPro - Painel de Coletas</h1>
      <div className="grid">
        <div className="card">
          <h2>{editing ? 'Editar Ponto' : 'Novo Ponto'}</h2>
          <PointForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (data) => {
              if (editing) await onUpdate(editing.ID || editing.id, data);
              else await onCreate(data);
            }}
          />
        </div>

        <div className="card">
          <h2>Lista de Pontos {loading ? ' (carregando...)' : ''}</h2>
          <PointsList
            points={points}
            onEdit={(p) => setEditing(p)}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}
