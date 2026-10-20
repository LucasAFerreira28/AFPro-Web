import { API_BASE } from './config';

async function handleGet(params = {}) {
  const url = new URL(API_BASE);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, String(value));
    }
  });

  const res = await fetch(url.toString(), {
    method: 'GET',
    mode: 'cors',
    headers: { Accept: 'application/json' },
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handlePost(body) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  listUnimed() {
    return handleGet({ tabela: 'unimed' });
  },
  listColetas() {
    return handleGet({ tabela: 'coletas' });
  },
  exportColetasCsv() {
    return handleGet({ tabela: 'coletas', exportar: 'csv' });
  },
  updateStatus(id, status) {
    return handlePost({ action: 'updateStatus', pontoid: id, status });
  },
  addColeta(data) {
    return handlePost({ action: 'addColeta', ...data });
  },
  replaceUnimed(rows) {
    return handlePost({ action: 'replaceUnimed', sheetName: 'UNIMED', rows });
  },
};
