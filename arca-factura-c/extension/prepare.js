// Wait for dependent fields instead of assuming that ARCA responds in 350 ms.
// This phase never clicks navigation buttons.
export async function prepareStep({ fill, inspect, active, pause, attempts = 60 }) {
  let lastMessage = 'ARCA no terminó de habilitar los campos.';
  let previous = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (!await active()) return { state: 'cancelled' };
    const result = await fill();
    if (typeof result.result === 'string') return { state: 'stopped', message: result.result };
    if (previous && result.documentId !== previous.documentId) return { state: 'changed' };
    previous = result;
    if (result.result.waiting) {
      lastMessage = result.result.message;
    } else {
      const check = await inspect(result.result.completed);
      if (check.documentId !== result.documentId) return { state: 'changed' };
      if (check.result.state === 'ready') return { state: 'ready', result };
      if (check.result.state !== 'waiting') return check.result;
      lastMessage = check.result.message;
    }
    if (attempt + 1 < attempts) await pause(500);
  }
  return { state: 'stopped', message: `Se agotó la espera: ${lastMessage} No se pulsó Continuar.` };
}
