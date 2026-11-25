// Runs in the page only for an explicitly opted-in execution.
export function issueOrInspect(action, authorized = false) {
  const url = new URL(location.href);
  if (url.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)+(?:afip\.gob\.ar|arca\.gob\.ar)$/.test(url.hostname) || !/^\/rcel\//i.test(url.pathname)) return { state: 'stopped', message: 'Página fuera de ARCA.' };
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const buttons = [...document.querySelectorAll('button, input[type=button], input[type=submit], input[type=image], a, [role=button]')].filter(el => el.getClientRects().length && !el.disabled);
  const label = el => norm(el.value || el.textContent || el.getAttribute?.('aria-label') || el.getAttribute?.('alt') || el.getAttribute?.('title'));
  const confirmation = norm('Usted está por generar un nuevo comprobante. ¿Confirma la Operación?');
  const key = '__arcaInvoiceConfirmation';
  if (action === 'cancel') {
    window[key]?.cleanup?.();
    return { state: 'cancelled' };
  }
  const text = (document.body.innerText || '').replace(/\s+/g, ' ');
  const hasCAE = /C\.?\s*A\.?\s*E\.?\s*(?:N[°ºo.]*)?\s*:?\s*\d{14}\b/i.test(text);
  const positive = /\bcomprobante\s+(?:(?:ha\s+sido|fue)\s+)?(?:generado|autorizado)(?:\s|[.!:]|$)|\bse\s+(?:ha\s+)?generado\s+(?:el|un)\s+comprobante\b|\boperaci[oó]n\s+exitosa\b/i.test(text);
  const negative = /\bno\s+(?:(?:se\s+)?(?:ha\s+)?(?:podido\s+)?(?:generar|generado|gener[oó]|autorizado|autoriz[oó])|(?:se\s+)?pudo\s+generar)|\b(?:error|rechazad[oa])\b|comprobante\s+no\s+(?:generado|autorizado)/i.test(text);
  const menuVisible = buttons.some(el => ['menuprincipal', 'volveramenuprincipal', 'volveralmenuprincipal', 'iralmenuprincipal'].includes(label(el)));
  const finalConfirmation = buttons.some(el => ['confirmardatos', 'confirmar', 'emitircomprobante', 'generarcomprobante'].includes(label(el)));
  // RCEL can show the successful result while the CAE is only in the PDF.
  // A positive result plus the terminal menu is sufficient; the menu alone is not.
  const success = positive && !negative && (hasCAE || (menuVisible && !finalConfirmation));
  if (action === 'inspect') {
    if (success) window[key]?.cleanup?.();
    if (!success && authorized) {
      // Custom HTML confirmation dialogs, including asynchronous ones.
      const dialogs = [...document.querySelectorAll('[role=dialog], dialog, .ui-dialog')].filter(el => el.getClientRects().length && norm(el.innerText || el.textContent).includes(confirmation));
      if (dialogs.length === 1) {
        const dialog = dialogs[0];
        const choices = [...dialog.querySelectorAll('button, input[type=button], input[type=submit], a')].filter(el => el.getClientRects().length && !el.disabled && ['confirmar', 'aceptar', 'si'].includes(label(el)));
        const state = window[key];
        if (choices.length === 1 && state && !state.dialogConfirmed) {
          state.dialogConfirmed = true;
          choices[0].click();
        }
      }
    }
    return { state: success ? 'issued' : 'pending' };
  }
  if (!authorized) return { state: 'stopped', message: 'La emisión automática no está autorizada.' };
  if (action === 'menu') {
    if (!success) return { state: 'stopped', message: 'No se verificó la emisión; no se regresa al menú.' };
    const menu = buttons.filter(el => ['menuprincipal', 'volveramenuprincipal', 'volveralmenuprincipal', 'iralmenuprincipal'].includes(label(el)));
    if (!menu.length) return { state: 'waiting', message: 'Comprobante generado; esperando que se habilite MENÚ PRINCIPAL.' };
    if (menu.length > 1) return { state: 'stopped', message: 'Comprobante generado; hay varios controles MENÚ PRINCIPAL.' };
    menu[0].click();
    return { state: 'returning' };
  }
  if (action !== 'issue' || success) return { state: 'stopped', message: 'No corresponde iniciar otra emisión.' };
  const candidates = buttons.filter(el => ['confirmardatos', 'confirmar', 'emitircomprobante', 'generarcomprobante'].includes(label(el)));
  if (candidates.length !== 1) return { state: 'stopped', message: 'No se reconoce un único botón de confirmación final.' };
  if (candidates[0].form && !candidates[0].form.checkValidity()) return { state: 'stopped', message: 'ARCA requiere corregir datos antes de emitir.' };
  // Keep a one-shot handler alive for ARCA's delayed confirmation only.
  // Other questions always go to the original browser confirmation.
  window[key]?.cleanup?.();
  const original = window.confirm;
  const state = { dialogConfirmed: false };
  let timer;
  const handler = message => {
    if (norm(message) !== confirmation) return original.call(window, message);
    state.cleanup();
    return true;
  };
  state.cleanup = () => {
    if (window.confirm === handler) window.confirm = original;
    if (timer) window.clearTimeout(timer);
    if (window[key] === state) delete window[key];
  };
  window[key] = state;
  window.confirm = handler;
  timer = window.setTimeout(state.cleanup, 120000);
  try {
    candidates[0].click();
  } catch (error) { state.cleanup(); throw error; }
  return { state: 'submitted' };
}

export async function awaitIssuance({ inspect, active, pause, attempts = 120 }) {
  for (let i = 0; i < attempts; i++) {
    if (!await active()) return { state: 'cancelled' };
    try {
      const result = await inspect();
      if (result.state === 'issued' || result.state === 'stopped') return result;
    } catch { /* Navigation can temporarily remove the document. Never resubmit. */ }
    if (i + 1 < attempts) await pause(500);
  }
  return { state: 'stopped', message: 'No se pudo verificar la emisión. Revisa ARCA antes de volver a intentar: el comprobante podría haberse emitido. No se reenvió la solicitud.' };
}
