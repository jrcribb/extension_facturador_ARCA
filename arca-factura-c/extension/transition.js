// A click can unload its execution context before Chrome returns its result.
// Observe the destination without repeating the click or clearing the run.
export async function waitForTransition({ documentId, active, read, pause, attempts = 120 }) {
  for (let i = 0; i < attempts; i++) {
    if (!await active()) return { state: 'cancelled' };
    try {
      const page = await read();
      if (page.state === 'outside') return { state: 'stopped', message: 'La navegación salió de Comprobantes en Línea.' };
      if (page.state !== 'loading') {
        if (page.result?.state === 'review') return page.result;
        if (page.documentId && page.documentId !== documentId) return { state: 'changed' };
      }
    } catch { /* Context may disappear while the next document loads. */ }
    if (i + 1 < attempts) await pause(500);
  }
  return { state: 'stopped', message: 'ARCA no completó la navegación. Revisa si muestra errores; no se repitió Continuar.' };
}
