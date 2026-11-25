import { validateConfig, parseAmount, formatAmount } from './rules.js';
import { findRcelTabs, chooseRcelTab, checkStartTab, isRcelTab } from './rcel-tabs.js';
const status = document.querySelector('#status');
const form = document.querySelector('form');
const automatic = document.querySelector('#autoIssue');
const amount = document.querySelector('#amount');
const start = form.querySelector('[type=submit]');
let activeRun = null;
let targets = [];
const targetSelect = document.querySelector('#targetTab');
const targetStatus = document.querySelector('#targetStatus');
let selectedTarget = '';
function renderTarget() {
  targetSelect.hidden = targets.length < 2;
  targetSelect.disabled = Boolean(activeRun);
  document.querySelector('#refreshTabs').disabled = Boolean(activeRun);
  document.querySelector('#goToRcel').disabled = !activeRun?.tabId && !selectedTarget;
  const target = targets.find(tab => tab.id === Number(activeRun?.tabId || selectedTarget));
  targetStatus.textContent = activeRun ? 'Trabajando en RCEL en segundo plano' : target ? `RCEL: ${target.title || new URL(target.url).hostname}` : targets.length ? 'Elegí una pestaña RCEL' : 'No hay pestañas RCEL abiertas';
}
async function refreshTargets() {
  targets = await findRcelTabs();
  if (!targets.some(tab => tab.id === Number(selectedTarget))) selectedTarget = targets.length === 1 ? String(targets[0].id) : '';
  targetSelect.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = ''; placeholder.textContent = 'Elegí una pestaña…'; targetSelect.append(placeholder);
  for (const tab of targets) {
    const option = document.createElement('option');
    option.value = String(tab.id);
    option.textContent = `${tab.title || 'RCEL'} · ventana ${tab.windowId ?? '?'} · pestaña ${(tab.index ?? 0) + 1}`;
    targetSelect.append(option);
  }
  targetSelect.value = selectedTarget;
  renderTarget();
}
targetSelect.addEventListener('change', () => { selectedTarget = targetSelect.value; renderTarget(); });
document.querySelector('#refreshTabs').addEventListener('click', async () => {
  try { await refreshTargets(); } catch (error) { status.textContent = error.message; }
});
document.querySelector('#goToRcel').addEventListener('click', async () => {
  try {
    const id = Number(activeRun?.tabId || selectedTarget);
    const tab = await chrome.tabs.get(id);
    if (!isRcelTab(tab.url)) throw new Error('La pestaña ya no está en RCEL. Actualizá la lista.');
    await chrome.tabs.update(id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch (error) { status.textContent = error.message; }
});
let preference = false;
let saving = Promise.resolve();
function renderMode() {
  renderTarget();
  automatic.checked = activeRun ? activeRun.config.autoIssue === true : preference;
  automatic.disabled = Boolean(activeRun);
  amount.disabled = Boolean(activeRun);
  start.disabled = Boolean(activeRun);
  start.textContent = activeRun ? 'En ejecución…' : automatic.checked ? 'Preparar y emitir' : 'Preparar hasta revisión';
  document.querySelector('#mode').textContent = automatic.checked ? 'Emisión automática activada' : 'Se detendrá antes de emitir';
}
function todayArgentina() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
document.querySelector('#dates').textContent = `Todas las fechas: ${todayArgentina()}`;
// Bind controls before loading preferences; disabled HTML prevents early submission.
automatic.addEventListener('change', () => {
  preference = automatic.checked;
  const selected = preference;
  saving = saving.catch(() => {}).then(() => chrome.storage.local.set({ autoIssuePreference: selected }));
  saving.catch(() => { status.textContent = 'No se pudo guardar la preferencia.'; });
  renderMode();
});
amount.addEventListener('blur', () => {
  try { amount.value = formatAmount(parseAmount(amount.value)); } catch { /* Submit explains invalid amounts. */ }
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (activeRun) return;
  start.disabled = true;
  try {
    await saving;
    const date = todayArgentina();
    const config = validateConfig({ amount: amount.value, date, from: date, to: date, due: date, autoIssue: preference });
    const freshTargets = await findRcelTabs();
    const tab = chooseRcelTab(freshTargets, selectedTarget);
    checkStartTab(tab);
    await chrome.storage.session.set({ draft: config });
    const result = await chrome.runtime.sendMessage({ type: 'start', tabId: tab.id, config });
    status.textContent = result.message;
    activeRun = (await chrome.storage.session.get('run')).run || null;
  } catch (error) { status.textContent = error.message; }
  finally { renderMode(); }
});
document.querySelector('#clear').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'stop' });
  activeRun = null;
  amount.value = '';
  renderMode();
  status.textContent = 'Proceso detenido. La preferencia se conserva.';
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.autoIssuePreference) preference = changes.autoIssuePreference.newValue === true;
  if (area === 'session') {
    if (changes.run) activeRun = changes.run.newValue || null;
    if (changes.runStatus) status.textContent = changes.runStatus.newValue || '';
    if (changes.draft?.newValue) amount.value = changes.draft.newValue.amount ? formatAmount(changes.draft.newValue.amount) : '';
  }
  renderMode();
});
try {
  const [saved, session] = await Promise.all([chrome.storage.local.get('autoIssuePreference'), chrome.storage.session.get(['draft', 'run', 'runStatus'])]);
  preference = saved.autoIssuePreference === true;
  activeRun = session.run || null;
  amount.value = session.draft?.amount ? formatAmount(session.draft.amount) : '';
  if (session.runStatus) status.textContent = session.runStatus;
  await refreshTargets();
  renderMode();
} catch { status.textContent = 'No se pudo cargar la configuración. Cierra y vuelve a abrir el panel.'; }
