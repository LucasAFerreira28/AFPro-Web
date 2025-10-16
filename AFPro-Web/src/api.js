import { API_BASE } from './config';

async function handleFetch(body) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch(e) {
    return text;
  }
}

export const api = {
  async list() {
    return await handleFetch({ action: 'list' });
  },

  async create(data) {
    return await handleFetch({ action: 'create', payload: data });
  },

  async update(id, data) {
    return await handleFetch({ action: 'update', id, payload: data });
  },

  async remove(id) {
    return await handleFetch({ action: 'delete', id });
  }
};
