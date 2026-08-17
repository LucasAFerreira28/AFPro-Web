import React, { useEffect, useState } from "react";
import { api } from "../api";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import logo from "../assets/logo.png";

export default function HistoryPage() {
  const [coletas, setColetas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ from: "", to: "", q: "", cidade: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.listColetas();
      setColetas(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }

  function formatarData(dataString) {
    if (!dataString) return "-";
    try {
      const data = new Date(dataString);
      return format(data, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  }

  // 🔹 Converte valores de string "7,5" → número 7.5
  function toNumber(v) {
    if (v == null || v === "") return 0;
    const n = parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? 0 : n;
  }

  const cidades = Array.from(new Set(coletas.map((c) => c.CIDADE).filter(Boolean)));

  // ✅ Corrige filtro de data (sem erro de fuso)
  const filtered = coletas.filter((c) => {
    const dataItem = new Date(c.DATA);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      if (
        !(
          (c.BENEFICIARIO || "").toLowerCase().includes(q) ||
          (c.MOTIVO || "").toLowerCase().includes(q)
        )
      )
        return false;
    }
    if (filter.cidade && c.CIDADE !== filter.cidade) return false;

    if (filter.from) {
      const d1 = new Date(filter.from + "T00:00:00");
      if (dataItem < d1) return false;
    }
    if (filter.to) {
      const d2 = new Date(filter.to + "T23:59:59");
      if (dataItem > d2) return false;
    }

    return true;
  });

  // 🔹 Totais dinâmicos
  const totalA1 = filtered.reduce((acc, c) => acc + toNumber(c["RESIDUOS-A1"] ?? c.residuosA1), 0);
  const totalE = filtered.reduce((acc, c) => acc + toNumber(c["RESIDUOS-E"] ?? c.residuosE), 0);

  // ✅ Exportar XLSX com número real e vírgula
  async function exportXlsx() {
    if (filtered.length === 0) {
      alert("Nenhum dado para exportar!");
      return;
    }

    const wb = new ExcelJS.Workbook();

    // Capa
    const capa = wb.addWorksheet("Capa");
    capa.columns = [{ width: 80 }];

    try {
      const img = await fetch(logo).then((r) => r.blob());
      const arrayBuffer = await img.arrayBuffer();
      const imageId = wb.addImage({ buffer: arrayBuffer, extension: "png" });
      capa.addImage(imageId, {
        tl: { col: 0.5, row: 0.5 },
        ext: { width: 180, height: 90 },
      });
    } catch (err) {
      console.warn("Logo não pôde ser carregada:", err);
    }

    capa.addRow([]);
    capa.addRow(["Relatório de Coletas"]);
    capa.addRow([`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`]);
    capa.addRow([]);
    capa.addRow(["Este relatório contém o histórico de coletas filtradas no sistema."]);

    capa.getCell("A2").font = { size: 20, bold: true, color: { argb: "0D6EFD" } };
    capa.getCell("A2").alignment = { horizontal: "center" };

    // Aba principal
    const sheet = wb.addWorksheet("Histórico");
    const headers = [
      "PONTOID",
      "DATA",
      "BENEFICIARIO",
      "RUA",
      "NUMERO",
      "BAIRRO",
      "CIDADE",
      "RESÍDUOS A1",
      "RESÍDUOS E",
      "MOTIVO",
      "OBSERVAÇÃO",
      "STATUS",
    ];
    sheet.addRow(headers);

    filtered.forEach((c) => {
      const a1 = toNumber(c["RESIDUOS-A1"] ?? c.residuosA1 ?? 0);
      const e = toNumber(c["RESIDUOS-E"] ?? c.residuosE ?? 0);

      sheet.addRow([
        c.PONTOID ?? c.pontoid,
        formatarData(c.DATA),
        c.BENEFICIARIO ?? "",
        c.RUA ?? "",
        c["Nº"] ?? c.NR ?? "",
        c.BAIRRO ?? "",
        c.CIDADE ?? "",
        a1, // ✅ Agora número real
        e,  // ✅ Agora número real
        c.MOTIVO ?? "",
        c.OBSERVACAO ?? c.observacao ?? "",
        c.STATUS ?? c.status ?? "",
      ]);
    });

    // Formatação
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0D6EFD" } };
    sheet.getRow(1).alignment = { horizontal: "center" };

    sheet.getColumn(8).numFmt = "#,##0.00"; // Resíduos A1
    sheet.getColumn(9).numFmt = "#,##0.00"; // Resíduos E

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Historico_Coletas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
  function getStatusClass(status = "") {
  const s = status.toLowerCase();

  if (s === "coletado") {
    return "bg-success-subtle text-success border border-success"; // 💚 Verde
  }
  if (s === "pendente") {
    return "bg-warning-subtle text-dark border border-warning"; // 💛 Amarelo
  }
  if (s === "sem residuos" || s === "sem resíduos") {
    return "bg-info-subtle text-info border border-info"; // 💙 Azul claro
  }
  if (
    s === "responsavel não encontrado" ||
    s === "responsável não encontrado" ||
    s === "não localizado"
  ) {
    return "bg-danger-subtle text-danger border border-danger"; // ❤️ Vermelho claro
  }

  return "bg-secondary-subtle text-dark border border-secondary"; // ⚪ Neutro
}

function getStatusIcon(status = "") {
  const s = status.toLowerCase();

  if (s === "coletado") return "✅";
  if (s === "pendente") return "⏳";
  if (s === "sem residuos" || s === "sem resíduos") return "🗑️";
  if (
    s === "responsavel não encontrado" ||
    s === "responsável não encontrado" ||
    s === "não localizado"
  )
    return "🚫";

  return "❔";
}


  return (
    <div className="page-content">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold">Histórico de Coletas</h2>

        <div className="d-flex align-items-center gap-3">
          {/* 🔹 Cards Resíduos */}
          <div className="stats-card warning" style={{ fontSize: "1.1rem" }}>
            ☣️ Resíduos A1:{" "}
            <strong style={{ color: "#0d6efd" }}>{totalA1.toLocaleString("pt-BR")}</strong>
          </div>
          <div className="stats-card success" style={{ fontSize: "1.1rem" }}>
            📦 Resíduos E:{" "}
            <strong style={{ color: "#0f9d58" }}>{totalE.toLocaleString("pt-BR")}</strong>
          </div>

          {/* 🔹 Botões */}
          <button className="btn btn-outline-secondary" onClick={load}>
            🔄 Atualizar
          </button>
          <button className="btn btn-outline-primary" onClick={exportXlsx}>
            📥 Exportar XLSX
          </button>
        </div>
      </div>

      {/* 🔹 Filtros */}
      <div className="filters d-flex gap-2 mb-3">
        <input
          className="form-control"
          placeholder="Pesquisar beneficiário/motivo"
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
        />
        <select
          className="form-select"
          value={filter.cidade}
          onChange={(e) => setFilter({ ...filter, cidade: e.target.value })}
        >
          <option value="">Todas as cidades</option>
          {cidades.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="form-control"
          value={filter.from}
          onChange={(e) => setFilter({ ...filter, from: e.target.value })}
        />
        <input
          type="date"
          className="form-control"
          value={filter.to}
          onChange={(e) => setFilter({ ...filter, to: e.target.value })}
        />
      </div>

      {/* 🔹 Tabela */}
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead
            className="text-white text-center"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 5,
              backgroundColor: "#0b1627",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          >
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
            {filtered.map((c, i) => (
              <tr key={i}>
                <td>{c.PONTOID ?? c.pontoid}</td>
                <td>{formatarData(c.DATA)}</td>
                <td>{c.BENEFICIARIO}</td>
                <td>{c.RUA}</td>
                <td>{c["Nº"] ?? c.NR}</td>
                <td>{c.BAIRRO}</td>
                <td>{c.CIDADE}</td>
                <td>{c["RESIDUOS-A1"] ?? c.residuosA1}</td>
                <td>{c["RESIDUOS-E"] ?? c.residuosE}</td>
                <td>{c.MOTIVO ?? c.motivo}</td>
                <td>{c.OBSERVACAO ?? c.observacao}</td>
                <td>
                  <td>
  <span
    className={`badge ${getStatusClass(c.STATUS ?? c.status)} px-3 py-2 d-flex align-items-center gap-1`}
    style={{ fontSize: "0.9rem" }}
  >
    {getStatusIcon(c.STATUS ?? c.status)} {c.STATUS ?? c.status}
  </span>
</td>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
