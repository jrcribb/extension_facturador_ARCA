export async function returnToMenu({ active, read, click, pause, attempts = 40 }) {
  let clicked = false;
  for (let i = 0; i < attempts; i++) {
    if (!await active()) return { state: 'cancelled' };
    try {
      const page = await read();
      if (page === 'menu') return { state: 'done' };
      if (page === 'outside') return { state: 'stopped', message: 'La página salió de Comprobantes en Línea.' };
      if (!clicked && page === 'ready') {
        // Retry finding the button, never repeat an attempted navigation click.
        clicked = true;
        const result = await click();
        if (result.state === 'waiting') clicked = false;
        else if (result.state === 'stopped') return result;
      }
    } catch { /* A click may destroy the context; observe its destination. */ }
    if (i + 1 < attempts) await pause(500);
  }
  return { state: 'stopped', message: clicked ? 'No se pudo verificar el regreso al menú.' : 'No apareció un botón MENÚ PRINCIPAL habilitado.' };
}
