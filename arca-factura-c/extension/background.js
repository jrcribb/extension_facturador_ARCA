import { checkStartTab } from './rcel-tabs.js';
import { allowedUrl, validateConfig, formatAmount } from './rules.js';
import { fillScreen } from './screen.js';
import { advanceScreen } from './navigation.js';
import { prepareStep } from './prepare.js';
import { returnToMenu } from './return-menu.js';
import { waitForTransition } from './transition.js';
import { issueOrInspect, awaitIssuance } from './issuance.js';
let starting = false;
const busy = new Set();
const pending = new Set();
async function issuanceCall(tabId, action) {
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: issueOrInspect, args: [action, true] });
  return result.result;
}
async function handleReview(run, message) {
  if (run.config.autoIssue !== true) return finish(message);
  if (!['emitting', 'awaitingEmission'].includes(run.phase)) {
    const current = (await chrome.storage.session.get('run')).run;
    if (!current || current.started !== run.started) return;
    // Persist BEFORE submitting so navigation/restarts cannot issue twice.
    await chrome.storage.session.set({ run: { ...current, phase: 'emitting' }, runStatus: 'Emitiendo comprobante…' });
    let sent;
    try { sent = await issuanceCall(run.tabId, 'issue'); } catch { /* Verify outcome; never retry the click. */ }
    if (sent?.state === 'stopped') return finish(sent.message);
  }
  const outcome = await awaitIssuance({
    inspect: () => issuanceCall(run.tabId, 'inspect'),
    active: async () => (await chrome.storage.session.get('run')).run?.started === run.started,
    pause: ms => new Promise(resolve => setTimeout(resolve, ms))
  });
  if (outcome.state === 'cancelled') return;
  if (outcome.state !== 'issued') {
    const current = (await chrome.storage.session.get('run')).run;
    if (current?.started === run.started) await chrome.storage.session.set({ run: { ...current, phase: 'awaitingEmission' }, runStatus: `${outcome.message} Se seguirá comprobando al cargar otra pantalla.` });
    return;
  }
  return completeIssued(run);
}
async function completeIssued(run) {
  const notice = `Se ha generado el comprobante por $ ${formatAmount(run.config.amount)}.`;
  await chrome.storage.session.set({ draft: { ...run.config, amount: '' }, runStatus: notice });
  await chrome.storage.session.set({ run: { ...run, phase: 'returning' } });
  try {
    await chrome.notifications.create(`issued-${run.started}`, { type: 'basic', iconUrl: 'icon.png', title: 'Comprobante generado', message: notice, priority: 2 });
  } catch { /* The popup status remains available if OS notifications are disabled. */ }
  const back = await returnToMenu({
    active: async () => (await chrome.storage.session.get('run')).run?.started === run.started,
    read: async () => {
      const page = await chrome.tabs.get(run.tabId);
      if (page.status !== 'complete') return 'loading';
      if (!allowedUrl(page.url)) return 'outside';
      return /\/menu_ppal\.jsp(?:[?#]|$)/i.test(page.url) ? 'menu' : 'ready';
    },
    click: () => issuanceCall(run.tabId, 'menu'),
    pause: ms => new Promise(resolve => setTimeout(resolve, ms))
  });
  if (back.state === 'cancelled') return;
  await finish(back.state === 'done' ? `${notice} Menú principal listo. Importe vacío.` : `${notice} ${back.message} Importe vacío.`);
}
async function finish(message) {
  await chrome.storage.session.remove('run');
  await chrome.storage.session.set({ runStatus: message });
}
async function execute(tabId, func, args) {
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return result;
}
async function processTab(tabId) {
  if (busy.has(tabId)) { pending.add(tabId); return; }
  busy.add(tabId);
  try {
    const { run } = await chrome.storage.session.get('run');
    if (!run || run.tabId !== tabId) return;
    const tab = await chrome.tabs.get(tabId);
    if (!allowedUrl(tab.url) || (!['emitting', 'awaitingEmission'].includes(run.phase) && Date.now() - run.started > 300000)) return await finish('Proceso detenido: sesión, página o tiempo de ejecución no válido.');
    if (tab.status === 'loading') return;
    if (run.phase === 'returning') return await completeIssued(run);
    if (['emitting', 'awaitingEmission'].includes(run.phase)) return await handleReview(run);
    const probe = await execute(tabId, advanceScreen, [[], false]);
    if (probe.result.state === 'review') return await handleReview(run, probe.result.message);
    if (probe.documentId === run.lastDocument) return;
    // Wait for the point-of-sale dependent selector and navigation to be ready.
    let result = { documentId: probe.documentId, result: { completed: [] } };
    if (probe.result.state !== 'menu') {
      const prepared = await prepareStep({
        fill: () => execute(tabId, fillScreen, [run.config]),
        inspect: completed => execute(tabId, advanceScreen, [completed, 'validate']),
        active: async () => (await chrome.storage.session.get('run')).run?.started === run.started,
        pause: ms => new Promise(resolve => setTimeout(resolve, ms))
      });
      if (prepared.state === 'cancelled') return;
      if (prepared.state === 'changed') { pending.add(tabId); return; }
      if (prepared.state === 'review') return await handleReview(run, prepared.message);
      if (prepared.state !== 'ready') return await finish(prepared.message);
      result = prepared.result;
    }
    const { run: current } = await chrome.storage.session.get('run');
    if (!current || current.started !== run.started) return;
    if (result.documentId !== probe.documentId) { pending.add(tabId); return; }
    await chrome.storage.session.set({ run: { ...run, lastDocument: result.documentId } });
    let next;
    try { next = await execute(tabId, advanceScreen, [result.result.completed]); }
    catch { /* Navigation may have destroyed the context after the click. */ }
    if (next?.result.state === 'review') return await handleReview(run, next.result.message);
    if (next && next.result.state !== 'advancing') return await finish(next.result.message);
    await chrome.storage.session.set({ runStatus: 'Esperando la siguiente pantalla de ARCA…' });
    const transition = await waitForTransition({
      documentId: result.documentId,
      active: async () => (await chrome.storage.session.get('run')).run?.started === run.started,
      pause: ms => new Promise(resolve => setTimeout(resolve, ms)),
      read: async () => {
        const page = await chrome.tabs.get(tabId);
        if (page.status === 'loading') return { state: 'loading' };
        if (!allowedUrl(page.url)) return { state: 'outside' };
        return execute(tabId, advanceScreen, [[], false]);
      }
    });
    if (transition.state === 'changed') pending.add(tabId);
    else if (transition.state === 'review') await handleReview(run, transition.message);
    else if (transition.state !== 'cancelled') await finish(transition.message);
  } catch (error) { await finish(`Proceso detenido: ${error.message}`); }
  finally {
    busy.delete(tabId);
    if (pending.delete(tabId)) void processTab(tabId);
  }
}
chrome.tabs.onUpdated.addListener((tabId, change) => { if (change.status === 'complete') void processTab(tabId); });
chrome.tabs.onRemoved.addListener(async tabId => {
  const { run } = await chrome.storage.session.get('run');
  if (run?.tabId === tabId) await finish('Proceso detenido: se cerró la pestaña.');
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type === 'start') {
    if (starting) { respond({ message: 'Ya se está iniciando un comprobante.' }); return; }
    starting = true;
  }
  (async () => {
    if (message.type === 'stop') {
      const { run } = await chrome.storage.session.get('run');
      await chrome.storage.session.clear();
      if (run) { try { await issuanceCall(run.tabId, 'cancel'); } catch {} }
      return { message: 'Proceso detenido y datos temporales borrados.' };
    }
    if (message.type !== 'start') throw new Error('Acción no reconocida.');
    const { run } = await chrome.storage.session.get('run');
    if (run) throw new Error('Ya hay un proceso en curso. Deténlo antes de iniciar otro.');
    const config = validateConfig(message.config, true);
    const tab = await chrome.tabs.get(message.tabId);
    checkStartTab(tab);
    await chrome.storage.session.set({ run: { tabId: tab.id, config, started: Date.now() }, runStatus: 'Preparando comprobante…' });
    void processTab(tab.id);
    return { message: config.autoIssue ? 'Preparando y emitiendo automáticamente. Puedes cerrar este panel.' : 'Preparando comprobante. Puedes cerrar este panel; se detendrá antes de emitir.' };
  })().then(respond, error => respond({ message: error.message })).finally(() => { if (message.type === 'start') starting = false; });
  return true;
});
