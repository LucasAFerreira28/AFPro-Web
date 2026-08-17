import React, { useState, useEffect } from 'react';
import { formatISO } from 'date-fns';

const defaultStatus = 'Pendente';

export default function PointForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    BENEFICIARIO: '',
    RUA: '',
    NR: '',
    BAIRRO: '',
    CIDADE: '',
    DATA: formatISO(new Date(), { representation: 'date' }),
    STATUS: defaultStatus,
    OBS: ''
  });

  useEffect(() => {
    if (initial) {
      setForm({
        BENEFICIARIO: initial.BENEFICIARIO || '',
        RUA: initial.RUA || '',
        NR: initial.NR || '',
        BAIRRO: initial.BAIRRO || '',
        CIDADE: initial.CIDADE || '',
        DATA: initial.DATA || formatISO(new Date(), { representation: 'date' }),
        STATUS: initial.STATUS || defaultStatus,
        OBS: initial.OBS || ''
      });
    }
  }, [initial]);

  function fieldChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    await onSubmit(form);
    if (!initial) {
      setForm({
        BENEFICIARIO: '',
        RUA: '',
        NR: '',
        BAIRRO: '',
        CIDADE: '',
        DATA: formatISO(new Date(), { representation: 'date' }),
        STATUS: defaultStatus,
        OBS: ''
      });
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <label>BENEFICIARIO<input name="BENEFICIARIO" value={form.BENEFICIARIO} onChange={fieldChange} required /></label>
      <label>RUA<input name="RUA" value={form.RUA} onChange={fieldChange} /></label>
      <label>Nº<input name="NR" value={form.NR} onChange={fieldChange} /></label>
      <label>BAIRRO<input name="BAIRRO" value={form.BAIRRO} onChange={fieldChange} /></label>
      <label>CIDADE<input name="CIDADE" value={form.CIDADE} onChange={fieldChange} /></label>
      <label>DATA<input type="date" name="DATA" value={form.DATA} onChange={fieldChange} /></label>
      <label>STATUS
        <select name="STATUS" value={form.STATUS} onChange={fieldChange}>
          <option>Pendente</option>
          <option>Coletado</option>
          <option>Cancelado</option>
        </select>
      </label>
      <label>OBSERVAÇÕES<textarea name="OBS" value={form.OBS} onChange={fieldChange} /></label>

      <div className="actions">
        <button type="submit">{initial ? 'Salvar' : 'Criar'}</button>
        {initial && <button type="button" onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}
