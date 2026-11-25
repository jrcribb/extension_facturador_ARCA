export function parseAmount(raw) {
  const value = String(raw).trim();
  if (!/^(?:\d{1,12}|\d{1,3}(?:\.\d{3}){1,3})(?:,\d{1,2})?$/.test(value)) throw new Error('Usa el formato argentino, por ejemplo 999.999,99 (punto para miles y coma para decimales).');
  const [whole, fraction = ''] = value.replaceAll('.', '').split(',');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('El importe debe ser mayor que cero.');
  return (cents / 100).toFixed(2);
}
export function formatAmount(amount) {
  const [whole, decimals] = amount.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + decimals;
}
export function validateConfig(values, canonical = false) {
  if (canonical && (!/^\d{1,12}\.\d{2}$/.test(values.amount) || Number(values.amount) <= 0)) throw new Error('Importe interno inválido.');
  const result = { ...values, amount: canonical ? values.amount : parseAmount(values.amount) };
  for (const key of ['date', 'from', 'to', 'due']) {
    const value = values[key];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Completa todas las fechas con valores válidos.');
  }
  if (values.from > values.to) throw new Error('El inicio del servicio debe ser anterior o igual al fin.');
  if (values.due < values.date) throw new Error('El vencimiento no puede ser anterior al comprobante.');
  return result;
}
export function allowedUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^(?:[a-z0-9-]+\.)+(?:afip\.gob\.ar|arca\.gob\.ar)$/.test(url.hostname) && /^\/rcel(?:\/|$)/i.test(url.pathname);
  } catch { return false; }
}
