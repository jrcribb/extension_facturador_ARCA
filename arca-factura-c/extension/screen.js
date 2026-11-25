// Serialized by Chrome: keep all dependencies inside this function.
export function fillScreen(config) {
  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const visible = el => el.getClientRects().length > 0 && !el.disabled && !el.readOnly;
  const displayed = [...document.querySelectorAll('input, select, textarea')].filter(el => el.getClientRects().length > 0);
  const controls = displayed.filter(visible);
  const invoiceNames = ['Factura C', '11 - Factura C', '011 - Factura C'].map(norm);
  const isInvoiceC = option => invoiceNames.includes(norm(option.textContent));
  if (document.querySelector('input[type=password]')) return 'Pantalla de acceso: no se realiza ninguna acción.';
  const url = new URL(location.href);
  if (url.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)+(?:afip\.gob\.ar|arca\.gob\.ar)$/.test(url.hostname) || !/^\/rcel(?:\/|$)/i.test(url.pathname)) return 'Página fuera de Comprobantes en Línea.';
  // Exact aliases only. Never infer a field from its position or surrounding page text.
  const aliases = {
    point: ['puntoDeVenta', 'puntoVenta', 'idPuntoVenta', 'puntoDeVentaId', 'Punto de venta', 'Punto de ventas a utilizar'],
    invoice: ['tipoComprobante', 'tipoDeComprobante', 'idTipoComprobante', 'Tipo de comprobante'],
    concept: ['idConcepto', 'concepto', 'Conceptos a incluir'],
    date: ['fechaEmision', 'fechaComprobante', 'Fecha del comprobante'],
    from: ['periodoFacturadoDesde', 'fechaDesde', 'Período facturado desde'],
    to: ['periodoFacturadoHasta', 'fechaHasta', 'Período facturado hasta'],
    due: ['vencimientoPago', 'fechaVtoPago', 'Fecha de vencimiento para el pago'],
    cash: ['condicionVenta', 'idCondicionVenta', 'Condición de venta'],
    vat: ['idIVAReceptor', 'idCondicionIVA', 'Condición frente al IVA'],
    description: ['detalleDescripcion', 'descripcion', 'Producto / Servicio', 'Descripción'],
    quantity: ['detalleCantidad', 'cantidad', 'Cantidad'],
    price: ['detallePrecio', 'precioUnitario', 'Precio unitario'],
    discount: ['detalleBonificacion', 'bonificacion', '% Bonif.'],
    unit: ['detalleMedida', 'unidadMedida', 'U. Medida']
  };
  const found = {};
  for (const [key, names] of Object.entries(aliases)) {
    const allowed = names.map(norm);
    const matches = (key === 'invoice' ? displayed : controls).filter(el => {
      if (!['SELECT', 'TEXTAREA'].includes(el.tagName) && !['text', 'number', 'date'].includes(el.type)) return false;
      const identifiers = [el.id, el.name, el.getAttribute('aria-label'), ...[...(el.labels || [])].map(l => l.textContent)].filter(Boolean);
      return identifiers.some(s => allowed.includes(norm(s.replace(/\[\d*\]$/, ''))));
    });
    if (matches.length > 1) return `Detenido: campo ambiguo o múltiples líneas (${key}). No se modificó nada.`;
    if (matches.length) found[key] = matches[0];
  }
  // Some RCEL versions use a different ID or lock the already selected type.
  // Identify a unique SELECT by its exact option text, only on the point screen.
  if (found.point && !found.invoice) {
    const candidates = displayed.filter(el => el.tagName === 'SELECT' && [...el.options].some(isInvoiceC));
    if (candidates.length > 1) return 'Detenido: hay varios selectores que contienen Factura C. No se modificó nada.';
    if (candidates.length === 1) found.invoice = candidates[0];
  }
  const plan = [];
  let waiting = false;
  function select(key, texts) {
    const el = found[key];
    if (!el) return;
    if (el.tagName !== 'SELECT') throw new Error(`No se reconoce el selector ${key}.`);
    const options = [...el.options].filter(o => (!o.disabled || (key === 'invoice' && o.value === el.value)) && texts.map(norm).includes(norm(o.textContent)));
    if (key === 'invoice' && found.point && options.length === 0) { waiting = true; return; }
    if (options.length !== 1) throw new Error(`No se encontró una opción inequívoca para ${key}.`);
    if ((el.disabled || el.readOnly) && el.value !== options[0].value) throw new Error('El tipo de comprobante está bloqueado y no tiene Factura C seleccionada.');
    plan.push([el, options[0].value, key]);
  }
  function field(key, value) {
    const el = found[key];
    if (!el) return;
    if (el.tagName === 'SELECT') throw new Error(`Formato no reconocido para ${key}.`);
    plan.push([el, value, key]);
  }
  let pointChanging = false;
  try {
    if (found.point) {
      const el = found.point;
      if (el.tagName !== 'SELECT') throw new Error('Punto de venta no reconocido.');
      const options = [...el.options].filter(option => !option.disabled && /^\d+$/.test(option.value) && Number(option.value) > 0 && !/seleccion|elija/i.test(option.textContent));
      if (options.length === 0) throw new Error('No hay un punto de venta disponible.');
      if (options.length > 1) throw new Error('Hay varios puntos de venta. Selecciona el correspondiente y avanza manualmente hasta los datos del comprobante; luego reinicia.');
      pointChanging = el.value !== options[0].value;
      plan.push([el, options[0].value, 'point']);
    }
    if (!pointChanging) select('invoice', ['Factura C', '11 - Factura C', '011 - Factura C']);
    select('concept', ['Productos y Servicios', 'Productos y servicios']);
    select('vat', ['Consumidor Final']);
    select('cash', ['Contado']);
    const cashChoices = controls.filter(el => ['checkbox', 'radio'].includes(el.type) && [...(el.labels || [])].some(label => norm(label.textContent) === 'contado'));
    if (!found.cash && cashChoices.length === 1) plan.push([cashChoices[0], true, 'cash']);
    else if (!found.cash && cashChoices.length > 1) throw new Error('Condición Contado ambigua.');
    for (const key of ['date', 'from', 'to', 'due']) {
      if (found[key]) field(key, found[key].type === 'date' ? config[key] : config[key].split('-').reverse().join('/'));
    }
    const detail = ['description', 'quantity', 'price'];
    if (detail.some(k => found[k])) {
      if (!detail.every(k => found[k])) throw new Error('Detalle incompleto o no reconocido. Completa manualmente y verifica que haya una sola línea.');
      field('description', 'Servicios');
      field('quantity', '1');
      field('price', config.amount);
      field('discount', '0');
      select('unit', ['unidades', 'unidad']);
    }
  } catch (error) { return `Detenido: ${error.message} No se modificó nada.`; }
  if (!plan.length) return 'No hay campos reconocidos. Si estás en el resumen, revisa Factura C, consumidor final, concepto, fechas y total. La emisión requiere tu confirmación manual en ARCA.';
  const completed = [];
  for (const [el, value, key] of plan) {
    if (key === 'invoice' && el.isConnected && el.getClientRects().length > 0 && el.value === value && [...el.options].some(o => o.value === value && isInvoiceC(o))) {
      completed.push(key);
      continue;
    }
    if (!el.isConnected || !visible(el)) return `La pantalla cambió. Revisa lo ya completado: ${completed.join(', ')}. Vuelve a ejecutar en la pantalla actual.`;
    if (key === 'cash' && typeof value === 'boolean') {
      if (el.type === 'checkbox' && controls.some(other => other !== el && other.type === 'checkbox' && other.name === el.name && other.checked)) return 'Detenido: hay otra condición de venta marcada.';
      if (el.checked) { completed.push(key); continue; }
      el.checked = true;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (!el.checked) return 'ARCA no conservó Contado.';
      completed.push(key);
      continue;
    }
    // Do not repeat change handlers: point/concept handlers can reset dependent fields.
    if (el.value === value) { completed.push(key); continue; }
    const prototype = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (el.value !== value) return `ARCA no conservó el valor de ${key}. Detenido; revisa la pantalla.`;
    completed.push(key);
  }
  if (found.point && !completed.includes('invoice')) waiting = true;
  return { completed, ...(waiting ? { waiting: true, message: !found.invoice
    ? 'No se reconoce el selector de tipo de comprobante en esta pantalla.'
    : 'El selector de comprobante todavía no contiene una opción Factura C reconocida.' } : {}) };
}
