// Self-contained for executeScript. Only recognized editing stages may advance.
export function advanceScreen(completed = [], click = true) {
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const visible = el => el.getClientRects().length > 0 && !el.disabled;
  const buttons = [...document.querySelectorAll('button, input[type=button], input[type=submit], a')].filter(visible);
  const label = el => norm(el.value || el.textContent);
  // Entry is allowed only on the RCEL main menu, never on a review screen.
  const onMenu = /\/rcel\/jsp\/menu_ppal\.jsp$/i.test(new URL(location.href).pathname);
  const entry = buttons.filter(el => label(el) === 'generarcomprobantes');
  const menuEntry = onMenu && entry.length === 1 ? entry[0] : null;
  // The presence of any final action ends the run BEFORE filling or clicking.
  if (buttons.some(el => el !== menuEntry && /confirmar|emitir|generarcomprobante|obtenercae/.test(label(el)))) return { state: 'review', message: 'Detenido antes de la emisión. Revisa el resumen y confirma personalmente en ARCA.' };
  if (!click) return { state: menuEntry ? 'menu' : 'editing' };
  if (menuEntry) {
    if (click === 'validate') return { state: 'stopped', message: 'ARCA volvió al menú principal. Reinicia el proceso desde allí.' };
    const action = [menuEntry.getAttribute('onclick'), menuEntry.getAttribute('href'), menuEntry.getAttribute('formaction'), menuEntry.form?.getAttribute('action')].join(' ');
    if (/confirm|emitir|cae/i.test(action)) return { state: 'stopped', message: 'Acción de entrada no reconocida; no se avanzó.' };
    menuEntry.click();
    return { state: 'advancing', message: 'Ingresando a Generar Comprobantes…' };
  }
  const groups = [
    ['point', 'invoice'],
    ['concept', 'date', 'from', 'to', 'due'],
    ['vat', 'cash'],
    ['description', 'quantity', 'price']
  ];
  const matched = groups.filter(group => group.every(key => completed.includes(key)));
  if (matched.length !== 1) {
    const partial = matched.length === 0 && groups.some(group => group.some(key => completed.includes(key)));
    return { state: partial ? 'waiting' : 'stopped', message: 'Pantalla incompleta o no reconocida; esperando los campos requeridos antes de avanzar.' };
  }
  const next = buttons.filter(el => ['continuar', 'siguiente'].includes(label(el)));
  if (next.length !== 1) return { state: next.length === 0 ? 'waiting' : 'stopped', message: 'No se encontró un único botón Continuar o Siguiente habilitado.' };
  const button = next[0];
  if (button.form && !button.form.checkValidity()) return { state: 'stopped', message: 'ARCA requiere completar o corregir datos adicionales.' };
  const action = [button.getAttribute('onclick'), button.getAttribute('href'), button.getAttribute('formaction'), button.form?.getAttribute('action')].join(' ');
  if (/confirm|emitir|generarcomprobante|cae/i.test(action)) return { state: 'review', message: 'La siguiente acción podría emitir. Revisa y continúa personalmente en ARCA.' };
  if (click === 'validate') return { state: 'ready' };
  button.click();
  return { state: 'advancing', message: 'Avanzando automáticamente a la siguiente pantalla…' };
}
