import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import logo from '../assets/logo.png';

const statusStyles = {
  coletado: 'status-badge success',
  pendente: 'status-badge warning',
  'sem residuos': 'status-badge info',
  'sem resíduos': 'status-badge info',
  'responsável não encontrado': 'status-badge danger',
  'responsavel não encontrado': 'status-badge danger',
  'não localizado': 'status-badge danger',
};

export default function HistoryPage() {
  const [coletas, setColetas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ from: '', to: '', q: '', cidade: '' });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.listColetas();
      setColetas(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar histórico.');
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

  function toNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const cidades = useMemo(
    () => Array.from(new Set(coletas.map((item) => item.CIDADE).filter(Boolean))),
    [coletas]
  );

  const filtered = useMemo(() => {
    return coletas.filter((item) => {
      const dataItem = new Date(item.DATA);
      const q = filter.q.trim().toLowerCase();

      if (q) {
        const matchText = `${item.BENEFICIARIO || ''} ${item.MOTIVO || ''}`.toLowerCase();
        if (!matchText.includes(q)) return false;
      }

      if (filter.cidade && item.CIDADE !== filter.cidade) return false;

      if (filter.from) {
        const from = new Date(`${filter.from}T00:00:00`);
        if (dataItem < from) return false;
      }

      if (filter.to) {
        const to = new Date(`${filter.to}T23:59:59`);
        if (dataItem > to) return false;
      }

      return true;
    });
  }, [coletas, filter]);

  const totalA1 = filtered.reduce((acc, item) => acc + toNumber(item['RESIDUOS-A1'] ?? item.residuosA1), 0);
  const totalE = filtered.reduce((acc, item) => acc + toNumber(item['RESIDUOS-E'] ?? item.residuosE), 0);

  function getStatusClass(status = '') {
    const normalized = String(status || '').trim().toLowerCase();
    const key = normalized in statusStyles ? normalized : 'default';

    const fallback = 'status-badge neutral';
    return statusStyles[key] || fallback;
  }

  async function exportXlsx() {
    if (filtered.length === 0) {
      alert('Nenhum dado para exportar!');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const capa = workbook.addWorksheet('Capa');
    capa.columns = [{ width: 80 }];

    try {
      const imageResponse = await fetch(logo);
      const blob = await imageResponse.blob();
      const imageBuffer = await blob.arrayBuffer();
      const imageId = workbook.addImage({ buffer: imageBuffer, extension: 'png' });
      capa.addImage(imageId, {
        tl: { col: 0.5, row: 0.5 },
        ext: { width: 180, height: 90 },
      });
    } catch (error) {
      console.warn('Logo não pôde ser carregada:', error);
    }

    capa.addRow([]);
    capa.addRow(['Relatório de Coletas']);
    capa.addRow([`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`]);
    capa.addRow([]);
    capa.addRow(['Este relatório contém o histórico de coletas filtradas no sistema.']);

    capa.getCell('A2').font = { size: 20, bold: true, color: { argb: '0D6EFD' } };
    capa.getCell('A2').alignment = { horizontal: 'center' };

    const sheet = workbook.addWorksheet('Histórico');
    const headers = [
      'PONTOID',
      'DATA',
      'BENEFICIARIO',
      'RUA',
      'NUMERO',
      'BAIRRO',
      'CIDADE',
      'RESÍDUOS A1',
      'RESÍDUOS E',
      'MOTIVO',
      'OBSERVAÇÃO',
      'STATUS',
    ];

    sheet.addRow(headers);

    filtered.forEach((item) => {
      const a1 = toNumber(item['RESIDUOS-A1'] ?? item.residuosA1 ?? 0);
      const e = toNumber(item['RESIDUOS-E'] ?? item.residuosE ?? 0);

      sheet.addRow([
        item.PONTOID ?? item.pontoid,
        formatarData(item.DATA),
        item.BENEFICIARIO ?? '',
        item.RUA ?? '',
        item['Nº'] ?? item.NR ?? '',
        item.BAIRRO ?? '',
        item.CIDADE ?? '',
        a1,
        e,
        item.MOTIVO ?? '',
        item.OBSERVACAO ?? item.observacao ?? '',
        item.STATUS ?? item.status ?? '',
      ]);
    });

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0D6EFD' } };
    sheet.getRow(1).alignment = { horizontal: 'center' };
    sheet.getColumn(8).numFmt = '#,##0.00';
    sheet.getColumn(9).numFmt = '#,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Historico_Coletas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Histórico de Coletas</h2>

        <div className="page-actions">
          <div className="stats-card warning">☣️ Resíduos A1: <strong>{totalA1.toLocaleString('pt-BR')}</strong></div>
          <div className="stats-card success">📦 Resíduos E: <strong>{totalE.toLocaleString('pt-BR')}</strong></div>
          <button className="btn btn-secondary" onClick={load}>🔄 Atualizar</button>
          <button className="btn btn-primary" onClick={exportXlsx}>📥 Exportar XLSX</button>
        </div>
      </div>

      <div className="filters">
        <input
          className="form-control"
          placeholder="Pesquisar beneficiário/motivo"
          value={filter.q}
          onChange={(event) => setFilter((value) => ({ ...value, q: event.target.value }))}
        />

        <select
          className="form-select"
          value={filter.cidade}
          onChange={(event) => setFilter((value) => ({ ...value, cidade: event.target.value }))}
        >
          <option value="">Todas as cidades</option>
          {cidades.map((cidade) => (
            <option key={cidade} value={cidade}>{cidade}</option>
          ))}
        </select>

        <input
          type="date"
          className="form-control"
          value={filter.from}
          onChange={(event) => setFilter((value) => ({ ...value, from: event.target.value }))}
        />

        <input
          type="date"
          className="form-control"
          value={filter.to}
          onChange={(event) => setFilter((value) => ({ ...value, to: event.target.value }))}
        />
      </div>

      {loading ? (
        <div className="empty-state">Carregando histórico...</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>PONTOID</th>
                <th>DATA</th>
                <th>Beneficiário</th>
                <th>Rua</th>
                <th>Nº</th>
                <th>Bairro</th>
                <th>Cidade</th>
                <th>Resíduos A1</th>
                <th>Resíduos E</th>
                <th>Motivo</th>
                <th>Obs</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="12" className="empty-cell">
                    Nenhuma coleta encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filtered.map((item, index) => (
                  <tr key={`${item.PONTOID || item.pontoid || index}-${index}`}>
                    <td>{item.PONTOID ?? item.pontoid ?? '-'}</td>
                    <td>{formatarData(item.DATA)}</td>
                    <td>{item.BENEFICIARIO || '-'}</td>
                    <td>{item.RUA || '-'}</td>
                    <td>{item['Nº'] ?? item.NR ?? '-'}</td>
                    <td>{item.BAIRRO || '-'}</td>
                    <td>{item.CIDADE || '-'}</td>
                    <td>{item['RESIDUOS-A1'] ?? item.residuosA1 ?? '0'}</td>
                    <td>{item['RESIDUOS-E'] ?? item.residuosE ?? '0'}</td>
                    <td>{item.MOTIVO ?? item.motivo ?? '-'}</td>
                    <td>{item.OBSERVACAO ?? item.observacao ?? '-'}</td>
                    <td>
                      <span className={getStatusClass(item.STATUS ?? item.status)}>
                        {(item.STATUS ?? item.status ?? 'Sem status')}
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
