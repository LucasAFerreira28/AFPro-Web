// src/pages/NovaColetaPage.js
import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api";
import { API_BASE } from "../config";

/**
 * NovaColetaPage (versão inteligente)
 * - importa XLSX
 * - parseia endereço (heurística)
 * - busca correspondência no histórico (fuzzy) e preenche endereço se encontrar
 * - preview editável (Beneficiário | Rua | Nº | Bairro | Cidade)
 * - cache local salvo em localStorage
 * - envia tudo para Apps Script com action 'replaceUnimed'
 */

const CACHE_KEY = "afpro_novacoleta_cache_v2";

// util: normalize string (remove acentos, lowercase, trim)
function normalize(str = "") {
  return String(str || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

// Levenshtein distance (small implementation)
function levenshtein(a = "", b = "") {
  const pa = a.split("");
  const pb = b.split("");
  const m = pa.length;
  const n = pb.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = pa[i - 1] === pb[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

// similarity score 0..1 (1 = identical)
function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const d = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - d / Math.max(1, maxLen);
}

// heurística de split de endereço (simples, cobre os casos comuns)
function splitAddress(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return { rua: "", numero: "", bairro: "", cidade: "" };

  // 1) separar por " - " ou " — " ou ","
  let parts = raw.split(/[-–—]/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    parts = raw.split(",").map(p => p.trim()).filter(Boolean);
  }

  // se tem varias partes, tente mapear
  let rua = "", numero = "", bairro = "", cidade = "";
  if (parts.length >= 3) {
    // comum: "Rua X, 123 - Centro - Presidente Prudente"
    rua = parts[0];
    // tentar extrair número do segundo ou da própria rua
    const numMatch = (parts[1] || "").match(/(\d+[\w-]*)/);
    if (numMatch) numero = numMatch[1];
    else {
      // tentar extrair número do fim da rua
      const endNum = rua.match(/(.+?)\s+(\d+[\w-]*)$/);
      if (endNum) {
        rua = endNum[1];
        numero = endNum[2];
      }
    }
    bairro = parts[1] && parts[1] !== numero ? parts[1] : parts[2] || "";
    cidade = parts[2] || parts[3] || "";
  } else {
    // tentativa de extrair número: "Rua Exemplo 123 Bairro Cidade"
    const m = raw.match(/(.+?)\s+(\d+[\w-]*)\s*(.*)/);
    if (m) {
      rua = m[1];
      numero = m[2];
      const rest = (m[3] || "").split(",").map(x => x.trim()).filter(Boolean);
      bairro = rest[0] || "";
      cidade = rest[1] || "";
    } else {
      // fallback: peça tudo como rua
      rua = raw;
    }
  }

  return {
    rua: rua || "",
    numero: numero || "",
    bairro: bairro || "",
    cidade: cidade || ""
  };
}

export default function NovaColetaPage() {
  const [rows, setRows] = useState([]); // preview rows: {beneficiario, rua, numero, bairro, cidade, matched:boolean, matchedFrom: {...}}
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [history, setHistory] = useState([]); // histórico de coletas para comparação

  // load cache and history on mount
  useEffect(() => {
    const cache = localStorage.getItem(CACHE_KEY);
    if (cache) {
      try { setRows(JSON.parse(cache)); } catch {}
    }
    // carregar histórico (coletas) para comparação
    (async () => {
      try {
        const res = await api.listColetas();
        if (Array.isArray(res)) setHistory(res);
      } catch (err) {
        console.warn("Não foi possível carregar histórico:", err);
      }
    })();
  }, []);

  // salvar cache sempre que rows mudar
  useEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  }, [rows]);

  // read file and map to preview rows
  const handleFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFileName(f.name);
    try {
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: "" }); // array of objects
      // detect columns roughly
      const headers = Object.keys(rawJson[0] || {}).map(h => h.toString().toUpperCase());
      const nameKeys = headers.filter(h => /BENEF|NOME|PACIENTE/.test(h));
      const addrKeys = headers.filter(h => /ENDERE|END|RUA|LOGRADOURO/.test(h));
      const nameKey = nameKeys[0] || headers[0];
      const addrKey = addrKeys[0] || headers.find(h => h !== nameKey) || headers[1];

      // build rows, keep lines even with empty name (to preserve count)
      const parsed = rawJson.map((r, i) => {
        const beneficiario = r[nameKey] ?? r[Object.keys(r)[0]] ?? "";
        // try address fields: address might be split across columns; try to combine
        let enderecoRaw = "";
        if (addrKey && r[addrKey]) enderecoRaw = String(r[addrKey]);
        else {
          // try combine columns that look like address parts
          const candidates = Object.keys(r).filter(k => /(ENDERE|RUA|LOGRADOURO|END|BAIRRO|CIDADE|NUM|Nº)/i.test(k));
          if (candidates.length) enderecoRaw = candidates.map(k => r[k]).filter(Boolean).join(" - ");
          else {
            // take second column if exists
            const keys = Object.keys(r);
            if (keys.length >= 2) enderecoRaw = r[keys[1]];
          }
        }

        const split = splitAddress(String(enderecoRaw || ""));
        return {
          beneficiario: String(beneficiario || "").trim(),
          enderecoRaw: String(enderecoRaw || "").trim(),
          rua: split.rua,
          numero: split.numero,
          bairro: split.bairro,
          cidade: split.cidade,
          matched: false,
          matchedFrom: null
        };
      });

      // after creating parsed rows, attempt auto-match with history
      const withMatches = parsed.map(row => {
        const best = findBestMatch(row.beneficiario, history);
        if (best && best.score >= 0.75) {
          // take address fields from best (try common header names)
          const from = best.item;
          const mapped = {
            rua: from.RUA ?? from.rua ?? from["Rua"] ?? "",
            numero: from["Nº"] ?? from.numero ?? from.NUMERO ?? "",
            bairro: from.BAIRRO ?? from.bairro ?? "",
            cidade: from.CIDADE ?? from.cidade ?? ""
          };
          return { ...row, ...mapped, matched: true, matchedFrom: { score: best.score, item: mapped } };
        }
        return row;
      });

      setRows(withMatches);
    } catch (err) {
      console.error("Erro ao ler arquivo:", err);
      alert("Erro ao ler o arquivo. Ver console.");
    }
  };

  // find best match in history by beneficiario name
  function findBestMatch(name, histArr) {
    if (!name) return null;
    const n = normalize(name);
    let best = { score: 0, item: null };
    histArr.forEach(item => {
      // item may have BENEFICIARIO, BENEFICIARIO (uppercase) or other keys
      const candidate =
        item.BENEFICIARIO ?? item.beneficiario ?? item.Beneficiario ?? item.NOME ?? item.nome ?? "";
      const s = similarity(n, normalize(candidate));
      if (s > best.score) best = { score: s, item };
    });
    return best.score > 0 ? best : null;
  }

  // apply heuristic to all rows (re-split enderecoRaw or rua)
  function applyHeuristicAll() {
    setRows(rows.map(r => {
      const source = r.enderecoRaw || r.rua || "";
      const s = splitAddress(source);
      return { ...r, rua: s.rua || r.rua, numero: s.numero || r.numero, bairro: s.bairro || r.bairro, cidade: s.cidade || r.cidade };
    }));
    alert("Heurística aplicada.");
  }

  // manual edit
  function editField(idx, field, value) {
    const nxt = [...rows];
    nxt[idx] = { ...nxt[idx], [field]: value, matched: false, matchedFrom: null };
    setRows(nxt);
  }

  // try auto-match again (use current history)
  function runAutoMatchAgain() {
    setRows(rows.map(r => {
      const best = findBestMatch(r.beneficiario, history);
      if (best && best.score >= 0.75) {
        const from = best.item;
        const mapped = {
          rua: from.RUA ?? from.rua ?? from["Rua"] ?? "",
          numero: from["Nº"] ?? from.numero ?? from.NUMERO ?? "",
          bairro: from.BAIRRO ?? from.bairro ?? "",
          cidade: from.CIDADE ?? from.cidade ?? ""
        };
        return { ...r, ...mapped, matched: true, matchedFrom: { score: best.score } };
      }
      return r;
    }));
    alert("Auto-match executado.");
  }

  // get max PONTOID from UNIMED (so we can generate sequential IDs)
  async function getMaxPontoId() {
    try {
      const unimed = await api.listUnimed();
      if (!Array.isArray(unimed) || unimed.length === 0) return 0;
      return unimed.reduce((m, row) => {
        const v = parseInt(row.PONTOID ?? row.pontoid ?? row.ID ?? row.id ?? 0, 10);
        return Number.isFinite(v) ? Math.max(m, v) : m;
      }, 0);
    } catch (err) {
      console.warn("Erro ao buscar UNIMED:", err);
      return 0;
    }
  }

 // ✅ Exporta a planilha Preview em formato XLSX (sem enviar ao Google)
async function handleSendReplaceUnimed() {
  if (!window.confirm("📦 Deseja exportar esta planilha Preview para Excel (.xlsx)?")) return;

  setLoading(true);
  try {
    const historico = await api.listColetas();
    const maxId = Array.isArray(historico)
      ? historico.reduce((m, row) => {
          const v = parseInt(row.PONTOID ?? row.pontoid ?? 0, 10);
          return Number.isFinite(v) ? Math.max(m, v) : m;
        }, 0)
      : 0;

    const rowsToExport = rows.map((r, i) => ({
      PONTOID: maxId + i + 1,
      BENEFICIARIO: r.beneficiario || "",
      FREQUENCIA: "",
      RUA: r.rua || "",
      NUMERO: r.numero || "",
      BAIRRO: r.bairro || "",
      CIDADE: r.cidade || "",
      DATA: "",
      "RESIDUOS-A1": "",
      "RESIDUOS-E": "",
      AUXILIAR: "",
      OBSERVACOES: "",
      MOTIVO: "",
    }));

    // Cria workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rowsToExport);
    XLSX.utils.book_append_sheet(wb, ws, "UNIMED");

    // Adiciona título e formatação simples
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `UNIMED_Preview_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    link.click();

    alert("✅ Planilha exportada com sucesso!");
  } catch (err) {
    console.error("Erro ao exportar:", err);
    alert("❌ Erro ao exportar: " + err.message);
  } finally {
    setLoading(false);
  }
}

  // clear preview
  function clearPreview() {
    if (!window.confirm("Limpar preview?")) return;
    setRows([]);
    localStorage.removeItem(CACHE_KEY);
  }

  return (
    <div className="page-content p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold">Nova Coleta — Importar e preparar (UNIMED)</h2>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={runAutoMatchAgain}>🔁 Re-executar Auto-match</button>
          <button className="btn btn-outline-secondary" onClick={applyHeuristicAll}>🧭 Heurística Endereço</button>
          <button className="btn btn-primary" onClick={handleSendReplaceUnimed} disabled={loading}>
            {loading ? "Gerando..." : "📥 Exportar Preview (.xlsx)"}
          </button>
        </div>
      </div>

      <div className="card mb-3 p-3">
        <div className="d-flex gap-3 align-items-center">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
          <div className="text-muted">{fileName}</div>
          <button className="btn btn-outline-secondary" onClick={() => {
            // quick save cache
            localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
            alert("Cache salvo.");
          }}>💾 Salvar cache</button>
          <button className="btn btn-outline-danger" onClick={clearPreview}>🧹 Limpar preview</button>
        </div>
      </div>

      <div className="card table-responsive p-0">
        {rows.length === 0 ? (
          <div className="p-4 text-muted">Nenhum arquivo carregado. Faça upload para ver a pré-visualização.</div>
        ) : (
          <table className="table table-hover mb-0">
            <thead style={{ position: "sticky", top: 0, backgroundColor: "#0b1627", color: "white", zIndex: 4 }}>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Beneficiário</th>
                <th>Rua</th>
                <th style={{ width: 90 }}>Nº</th>
                <th>Bairro</th>
                <th>Cidade</th>
                <th style={{ width: 160 }}>Status (auto)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} style={r.matched ? { background: "rgba(220,255,230,0.5)" } : undefined}>
                  <td>{idx + 1}</td>
                  <td>
                    <input className="form-control" value={r.beneficiario || ""} onChange={e => editField(idx, "beneficiario", e.target.value)} />
                  </td>
                  <td><input className="form-control" value={r.rua || ""} onChange={e => editField(idx, "rua", e.target.value)} /></td>
                  <td><input className="form-control" value={r.numero || ""} onChange={e => editField(idx, "numero", e.target.value)} /></td>
                  <td><input className="form-control" value={r.bairro || ""} onChange={e => editField(idx, "bairro", e.target.value)} /></td>
                  <td><input className="form-control" value={r.cidade || ""} onChange={e => editField(idx, "cidade", e.target.value)} /></td>
                  <td style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {r.matched ? <span className="badge bg-success">✔ Endereço reutilizado</span> : <span className="badge bg-warning text-dark">Novo / revisar</span>}
                    <small className="text-muted">{r.enderecoRaw ? r.enderecoRaw.slice(0, 40) : ""}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
