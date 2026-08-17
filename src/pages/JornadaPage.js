// src/pages/JornadaPage.js
import React, { useEffect, useState, useMemo } from "react";
import { format, parse, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Modal, Button } from "react-bootstrap";
import JornadaPage from './pages/JornadaPage';

const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwJoUCP0ijIAvO1Nws8QxTibo5bMTBhaCk9tN_8SkBD9heskaiQXj96LtgPiZURSHue/exec";

export default function JornadaPage() {
  const [dadosINI, setDadosINI] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [filtroMotorista, setFiltroMotorista] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [modalShow, setModalShow] = useState(false);
  const [paradasSelecionadas, setParadasSelecionadas] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    try {
      setLoading(true);
      setErro("");
      const res = await fetch(`${WEB_APP_URL}?tabela=INIxFIM`);
      const json = await res.json();
      setDadosINI(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error(err);
      setErro("Erro ao buscar dados da planilha.");
    } finally {
      setLoading(false);
    }
  }

  function limparPlaca(texto) {
    if (!texto) return "";
    return texto.replace(/[^A-Z0-9]/gi, "").substring(0, 7).toUpperCase();
  }

  function normalizeStatus(s) {
    return String(s).trim().toLowerCase();
  }

  function parseData(d) {
    if (!d && d !== 0) return null;
    if (d instanceof Date && isValid(d)) return d;
    const s = String(d).trim();

    try {
      const p = parse(s, "dd/MM/yyyy HH:mm:ss", new Date());
      if (isValid(p)) return p;
    } catch {}

    try {
      const p = parseISO(s);
      if (isValid(p)) return p;
    } catch {}

    try {
      const fallback = new Date(s);
      if (isValid(fallback)) return fallback;
    } catch {}

    return null;
  }

  function parseDist(km) {
    if (!km) return 0;
    const v = parseFloat(String(km).replace(",", "."));
    return Number.isNaN(v) ? 0 : v;
  }

  //
  // 🔥 LÓGICA DE JORNADA CORRIGIDA
  //
  function calcularJornadas() {
    const grupos = {};

    dadosINI.forEach((r) => {
      const placa = limparPlaca(r.placa);
      const motorista = r.motorista || "*";
      const inicio = parseData(r.dataInicial || r.dataInicio);
      const fim = parseData(r.dataFinal || r.dataFim) || inicio;
      const status = normalizeStatus(r.status);
      const dist = parseDist(r.distancia);

      if (!placa || !inicio) return;

      const dia = format(inicio, "yyyy-MM-dd");
      const chave = `${placa}||${motorista}||${dia}`;
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push({ placa, motorista, status, inicio, fim, dist });
    });

    const resultados = [];

    Object.values(grupos).forEach((registros) => {
      registros.sort((a, b) => a.inicio - b.inicio);

      // preencher fim faltando
      for (let i = 0; i < registros.length; i++) {
        if (!registros[i].fim && i + 1 < registros.length)
          registros[i].fim = registros[i + 1].inicio;

        if (registros[i].fim < registros[i].inicio)
          registros[i].fim = registros[i].inicio;
      }

      // 1) Primeiro ligado com km > 0 → Início da Jornada (SEM tempo mínimo)
      const inicioJornadaReg = registros.find(r => r.status === "ligado" && r.dist > 0);
      if (!inicioJornadaReg) return;
      const inicioJornada = inicioJornadaReg.inicio;

      // 2) Último ligado com km > 0 que tenha DURAÇÃO >= 10 min
      const ligadosValidos = registros.filter(r => {
        if (!(r.status === "ligado" && r.dist > 0)) return false;
        const dur = (r.fim - r.inicio) / 1000;
        return dur >= 600;
      });
      if (ligadosValidos.length === 0) return;
      const ultimoLigado = ligadosValidos[ligadosValidos.length - 1];

      // 3) Primeiro desligado após esse último ligado → Fim Jornada
      const desligadoDepois = registros.find(r =>
        r.status === "desligado" && r.inicio > ultimoLigado.inicio
      );

      const fimJornada = desligadoDepois ? desligadoDepois.inicio : ultimoLigado.fim;
      if (fimJornada <= inicioJornada) return;

      // 4) Paradas dentro da jornada
      const paradasLigado = [];
      const paradasDesligado = [];

      registros.forEach(r => {
        if (r.inicio < inicioJornada || r.fim > fimJornada) return;
        const dur = (r.fim - r.inicio) / 1000;

        if (r.status === "desligado" && dur >= 2400) {
          paradasDesligado.push({ inicio: r.inicio, fim: r.fim, duracao: dur });
        }

        if (r.status === "ligado" && r.dist === 0 && dur >= 600) {
          paradasLigado.push({ inicio: r.inicio, fim: r.fim, duracao: dur });
        }
      });

      resultados.push({
        placa: inicioJornadaReg.placa,
        motorista: inicioJornadaReg.motorista,
        inicio: inicioJornada,
        fim: fimJornada,
        duracao: (fimJornada - inicioJornada) / 1000,
        paradasLigado,
        paradasDesligado
      });
    });

    return resultados;
  }

  const jornadas = useMemo(() => calcularJornadas(), [dadosINI]);

  const jornadasFiltradas = jornadas.filter((j) => {
    const placaMatch = filtroPlaca ? j.placa.includes(filtroPlaca.toUpperCase()) : true;
    const motoristaMatch = filtroMotorista
      ? j.motorista.toUpperCase().includes(filtroMotorista.toUpperCase())
      : true;
    const dataMatch = filtroData ? format(j.inicio, "yyyy-MM-dd") === filtroData : true;
    return placaMatch && motoristaMatch && dataMatch;
  });

  function abrirModal(jornada) {
    setParadasSelecionadas(jornada);
    setModalShow(true);
  }

  function formatDuracao(segundos) {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    return `${h}h ${m}m`;
  }

  const getCorDia = (data) => {
    const dia = data.getDay();
    if (dia === 6) return "#fff9c4";
    if (dia === 0) return "#ffcdd2";
    return "transparent";
  };

  return (
    <div className="page-content p-4">
      <h2 className="fw-bold mb-3">Painel de Jornada de Trabalho</h2>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <input className="form-control" placeholder="Filtrar por placa"
          value={filtroPlaca} onChange={(e) => setFiltroPlaca(e.target.value)} />

        <input type="date" className="form-control"
          value={filtroData} onChange={(e) => setFiltroData(e.target.value)} />

        <input className="form-control" placeholder="Filtrar por motorista"
          value={filtroMotorista} onChange={(e) => setFiltroMotorista(e.target.value)} />

        <Button variant="outline-primary" onClick={carregarDados}>🔄 Atualizar</Button>
      </div>

      {erro && <div className="alert alert-danger">{erro}</div>}
      {loading && <p>Carregando...</p>}

      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="text-white text-center"
            style={{ backgroundColor: "#0b1627" }}>
            <tr>
              <th>Data</th><th>Placa</th><th>Motorista</th>
              <th>Início</th><th>Fim</th><th>Duração</th>
            </tr>
          </thead>

          <tbody>
            {jornadasFiltradas.map((j, i) => (
              <tr key={i} style={{ backgroundColor: getCorDia(j.inicio), cursor: "pointer" }}
                onClick={() => abrirModal(j)}>
                <td>{format(j.inicio, "dd/MM/yyyy")}</td>
                <td>{j.placa}</td>
                <td>{j.motorista}</td>
                <td>{format(j.inicio, "HH:mm:ss")}</td>
                <td>{format(j.fim, "HH:mm:ss")}</td>
                <td>{formatDuracao(j.duracao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal show={modalShow} onHide={() => setModalShow(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Paradas - {paradasSelecionadas?.placa}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {paradasSelecionadas && (
            <>
              <h6>
                Motorista: {paradasSelecionadas.motorista}<br />
                Jornada: {format(paradasSelecionadas.inicio, "HH:mm")} → {format(paradasSelecionadas.fim, "HH:mm")}
              </h6>

              <h5 className="mt-3">Paradas Ligado</h5>
              <ul>
                {paradasSelecionadas.paradasLigado.map((p, i) => (
                  <li key={i}>{format(p.inicio, "HH:mm")} - {format(p.fim, "HH:mm")} ({formatDuracao(p.duracao)})</li>
                ))}
              </ul>

              <h5 className="mt-3">Paradas Desligado</h5>
              <ul>
                {paradasSelecionadas.paradasDesligado.map((p, i) => (
                  <li key={i}>{format(p.inicio, "HH:mm")} - {format(p.fim, "HH:mm")} ({formatDuracao(p.duracao)})</li>
                ))}
              </ul>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setModalShow(false)}>Fechar</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
