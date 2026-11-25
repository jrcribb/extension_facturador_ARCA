export const RCEL_PATTERNS = ['https://fe.afip.gob.ar/rcel/*', 'https://fe.arca.gob.ar/rcel/*'];
export function isRcelTab(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ['fe.afip.gob.ar', 'fe.arca.gob.ar'].includes(parsed.hostname) && parsed.port === '' && parsed.pathname.startsWith('/rcel/');
  } catch { return false; }
}
export async function findRcelTabs(api = chrome) {
  const tabs = await api.tabs.query({ url: RCEL_PATTERNS });
  return tabs.filter(tab => Number.isInteger(tab.id) && isRcelTab(tab.url)).sort((a, b) => a.windowId - b.windowId || a.index - b.index);
}
export function chooseRcelTab(tabs, selectedId) {
  if (!tabs.length) throw new Error('No hay una pestaña RCEL abierta. Abrí Comprobantes en Línea e iniciá sesión.');
  const selected = selectedId ? tabs.find(tab => tab.id === Number(selectedId)) : tabs.length === 1 ? tabs[0] : null;
  if (!selected) throw new Error('Elegí la pestaña RCEL que querés utilizar.');
  return selected;
}
export function checkStartTab(tab) {
  if (!tab || !isRcelTab(tab.url)) throw new Error('La pestaña seleccionada ya no está en RCEL. Actualizá la lista.');
  if (tab.discarded || tab.frozen) throw new Error('Chrome suspendió RCEL. Usá «Ir a RCEL» para reactivarla antes de iniciar.');
  if (tab.status === 'loading') throw new Error('RCEL todavía está cargando. Esperá unos segundos antes de iniciar.');
  if (new URL(tab.url).pathname !== '/rcel/jsp/menu_ppal.jsp') throw new Error('Dejá RCEL en MENÚ PRINCIPAL antes de iniciar. No se modificó el formulario abierto.');
}
