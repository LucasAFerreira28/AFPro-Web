import React, { useEffect, useState } from "react";
import { api } from "../api";
import { API_BASE } from "../config";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PointsPage() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const data = await api.listUnimed();
      setPoints(Array.isArray(data) ? data : []);
    } catch (err) {
      alert("Erro ao carregar dados.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function formatarData(dataString) {
    try {
      return format(new Date(dataString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  }

  const totalPendentes = points.filter(
    (p) => p.STATUS?.toLowerCase() === "pendente"
  ).length;

  const totalColetados = points.filter(
    (p) => p.STATUS?.toLowerCase() === "coletado"
  ).length;

  // ✅ Função de registro de coleta
  async function registrarColetaManual() {
    const pontoid = prompt("Digite o ID (PONTOID) do ponto coletado:");
    if (!pontoid) return alert("❌ Informe um ID válido.");

    const ponto = points.find((p) => String(p.PONTOID) === String(pontoid));
    if (!ponto) return alert("❌ Nenhum ponto encontrado com esse ID.");

    const residuosA1 = prompt("Resíduos A1 (kg):") || "";
    const residuosE = prompt("Resíduos E (kg):") || "";
    const motivo = prompt("Motivo (opcional):") || "";
    const observacao = prompt("Observação (opcional):") || "";

    const dataAtual = new Date().toISOString();

    const payload = {
      action: "addColeta",
      pontoid: ponto.PONTOID,
      beneficiario: ponto.BENEFICIARIO,
      rua: ponto.RUA,
      numero: ponto["Nº"] || ponto.NUMERO,
      bairro: ponto.BAIRRO,
      cidade: ponto.CIDADE,
      data: dataAtual,
      residuosA1,
      residuosE,
      motivo,
      observacao,
      status: "COLETADO",
    };

    console.log("📤 Enviando coleta:", payload);

    const res = await api.addColeta(payload);
    if (res && res.result) {
      alert("✅ Coleta registrada com sucesso!");
      await api.updateStatus(pontoid, "COLETADO");
      await loadAll();
    } else {
      alert("❌ Erro ao registrar coleta.");
    }
  }

  return (
    <div className="page-content">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold">Pontos Atuais (UNIMED)</h2>

        <div className="d-flex align-items-center gap-3">
          <div className="stats-card warning">🕓 Pendentes: {totalPendentes}</div>
          <div className="stats-card success">✅ Coletadas: {totalColetados}</div>
          <button className="btn btn-outline-secondary" onClick={loadAll}>
            🔄 Atualizar
          </button>
          <button
  className="btn btn-outline-danger"
  onClick={async () => {
    if (!window.confirm("Registrar coletas coletadas na planilha?")) return;
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        body: JSON.stringify({ action: "registrarColetas" }),
      });
      const result = await res.json();
      alert(result.result);
    } catch (err) {
      alert("Erro ao registrar coletas.");
      console.error(err);
    }
  }}
>
  🧾 Registrar Coleta
</button>
        </div>
      </div>

      {loading && <p>Carregando...</p>}

      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead
  className="text-white text-center"
  style={{
    position: "sticky",
    top: 0,
    zIndex: 5,
    backgroundColor: "#0b1627", // fundo sólido
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)", // sombra suave
  }}
>
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
            {points.map((ponto, index) => (
              <tr key={index}>
                <td>{ponto.PONTOID || ponto.id}</td>
                <td>{ponto.BENEFICIARIO || "-"}</td>
                <td>{ponto.RUA || "-"}</td>
                <td>{ponto["Nº"] || ponto.NUMERO || "-"}</td>
                <td>{ponto.BAIRRO || "-"}</td>
                <td>{ponto.CIDADE || "-"}</td>
                <td>{formatarData(ponto.DATA)}</td>
                <td>
                  <span
                    className={`badge ${
                      ponto.STATUS?.toLowerCase() === "coletado"
                        ? "bg-success-subtle text-success border border-success"
                        : "bg-warning-subtle text-dark border border-warning"
                    } px-3 py-2`}
                  >
                    {ponto.STATUS}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
