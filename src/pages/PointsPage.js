import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusColors = {
  coletado: 'success',
  pendente: 'warning',
  'sem residuos': 'info',
  'sem resíduos': 'info',
  'responsável não encontrado': 'danger',
  'responsavel não encontrado': 'danger',
  'não localizado': 'danger',
};

export default function PointsPage() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const data = await api.listUnimed();
      setPoints(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar dados. Verifique a conexão com o Apps Script.');
    } finally {
      setLoading(false);
    }
  }

  function formatarData(dataString) {
    if (!dataString) return '-';
    try {
      return format(new Date(dataString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return '-';
    }
  }

  function getStatusClass(status = '') {
    const normalized = String(status || '').trim().toLowerCase();
    const key = normalized in statusColors ? normalized : 'default';

    const classes = {
      success: 'status-badge success',
      warning: 'status-badge warning',
      info: 'status-badge info',
      danger: 'status-badge danger',
      default: 'status-badge neutral',
    };

    return classes[key];
  }

  const totalPendentes = useMemo(
    () => points.filter((p) => String(p.STATUS || '').trim().toLowerCase() === 'pendente').length,
    [points]
  );

  const totalColetados = useMemo(
    () => points.filter((p) => String(p.STATUS || '').trim().toLowerCase() === 'coletado').length,
    [points]
  );

  const filteredPoints = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return points;

    return points.filter((p) => {
      const text = [
        p.BENEFICIARIO,
        p.RUA,
        p.BAIRRO,
        p.CIDADE,
        p.STATUS,
        p.PONTOID,
      ]
        .join(' ')
        .toLowerCase();

      return text.includes(term);
    });
  }, [points, search]);

  async function registrarColetaManual() {
    const pontoid = window.prompt('Digite o ID (PONTOID) do ponto coletado:');
    if (!pontoid) return;

    const ponto = points.find((item) => String(item.PONTOID) === String(pontoid));
    if (!ponto) {
      alert('Nenhum ponto encontrado com esse ID.');
      return;
    }

    const residuosA1 = window.prompt('Resíduos A1 (kg):', '') || '';
    const residuosE = window.prompt('Resíduos E (kg):', '') || '';
    const motivo = window.prompt('Motivo (opcional):', '') || '';
    const observacao = window.prompt('Observação (opcional):', '') || '';

    const payload = {
      action: 'addColeta',
      pontoid: ponto.PONTOID,
      beneficiario: ponto.BENEFICIARIO,
      rua: ponto.RUA,
      numero: ponto['Nº'] || ponto.NUMERO || '',
      bairro: ponto.BAIRRO,
      cidade: ponto.CIDADE,
      data: new Date().toISOString(),
      residuosA1,
      residuosE,
      motivo,
      observacao,
      status: 'COLETADO',
    };

    try {
      const res = await api.addColeta(payload);
      if (res && (res.result === 'OK' || res.result === 'success' || res.id || res.ID)) {
        alert('✅ Coleta registrada com sucesso!');
        await api.updateStatus(pontoid, 'COLETADO');
        await loadAll();
        return;
      }

      alert('❌ Erro ao registrar coleta.');
    } catch (error) {
      console.error(error);
      alert('❌ Não foi possível registrar a coleta.');
    }
  }

  async function registrarColetasEmLote() {
    if (!window.confirm('Registrar coletas coletadas na planilha?')) return;

    try {
      const response = await fetch('https://script.google.com/macros/s/AKfycby5BIXauxgQXHFTOxRXl0XL6-eTzz5Z7oOFdRmezymGieVAnB8rbzVbdfU49dRxLF7R/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'registrarColetas' }),
      });

      const result = await response.json();
      alert(result.result || 'Coletas registradas.');
      await loadAll();
    } catch (error) {
      console.error(error);
      alert('Erro ao registrar coletas em lote.');
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Pontos Atuais</h2>

        <div className="page-actions">
          <div className="stats-card warning">🕓 Pendentes: {totalPendentes}</div>
          <div className="stats-card success">✅ Coletadas: {totalColetados}</div>
          <button className="btn btn-secondary" onClick={loadAll}>🔄 Atualizar</button>
          <button className="btn btn-danger" onClick={registrarColetasEmLote}>🧾 Registrar Coleta</button>
        </div>
      </div>

      <div className="filters">
        <input
          type="search"
          className="form-control"
          placeholder="Buscar por beneficiário, rua, bairro, cidade..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="btn btn-primary" onClick={registrarColetaManual}>✚ Registrar manual</button>
      </div>

      {loading ? (
        <div className="empty-state">Carregando pontos...</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>ID</th>
                <th>Beneficiário</th>
                <th>Rua</th>
                <th>Nº</th>
                <th>Bairro</th>
                <th>Cidade</th>
                <th>Data</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPoints.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-cell">
                    Nenhum ponto encontrado para a busca atual.
                  </td>
                </tr>
              ) : (
                filteredPoints.map((ponto, index) => (
                  <tr key={index}>
                    <td>{ponto.PONTOID || ponto.id || '-'}</td>
                    <td>{ponto.BENEFICIARIO || '-'}</td>
                    <td>{ponto.RUA || '-'}</td>
                    <td>{ponto['Nº'] || ponto.NUMERO || '-'}</td>
                    <td>{ponto.BAIRRO || '-'}</td>
                    <td>{ponto.CIDADE || '-'}</td>
                    <td>{formatarData(ponto.DATA)}</td>
                    <td>
                      <span className={getStatusClass(ponto.STATUS)}>
                        {ponto.STATUS || 'Sem status'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
