import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, formatAmount, allowedUrl, validateConfig } from '../extension/rules.js';
import { readFileSync } from 'node:fs';
test('importes exactos y formatos ambiguos', () => {
  assert.equal(parseAmount('12500,50'), '12500.50');
  assert.equal(parseAmount('0,01'), '0.01');
  for (const value of ['0', '-10', '1.23,56', '0.01', '1,234', 'Infinity', '1e3', '']) assert.throws(() => parseAmount(value));
});
test('solo HTTPS y ruta RCEL en dominios oficiales', () => {
  assert.ok(allowedUrl('https://fe.afip.gob.ar/rcel/jsp/menu_ppal.jsp'));
  for (const url of ['http://fe.afip.gob.ar/rcel/', 'https://afip.gob.ar.evil.com/rcel/', 'https://evil.com/rcel/', 'https://auth.afip.gob.ar/login', 'https://fe.afip.gob.ar/rcel-evil']) assert.equal(allowedUrl(url), false);
});
test('validación de fechas', () => {
  const config = { amount: '10', date: '2026-11-24', from: '2026-11-24', to: '2026-11-24', due: '2026-11-24' };
  assert.equal(validateConfig(config).amount, '10.00');
  assert.throws(() => validateConfig({ ...config, from: '2026-11-25' }));
  assert.throws(() => validateConfig({ ...config, date: '2026-02-30' }));
});
test('el ejecutor no invoca clicks, envíos, red ni almacenamiento', () => {
  const source = readFileSync(new URL('../extension/screen.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.(click|submit|requestSubmit)\s*\(|\bfetch\s*\(|XMLHttpRequest|sendBeacon|chrome\.storage|document\.cookie|localStorage/);
});

test('formato argentino y transporte interno mantienen los centavos', () => {
  for (const [input, canonical] of [['999.999,99','999999.99'],['1.234,56','1234.56'],['1.234','1234.00'],['12,5','12.50']]) {
    assert.equal(parseAmount(input), canonical);
    assert.equal(parseAmount(formatAmount(canonical)), canonical);
    const config={amount:canonical,date:'2026-11-24',from:'2026-11-24',to:'2026-11-24',due:'2026-11-24'};
    assert.equal(validateConfig(config,true).amount,canonical);
  }
  assert.equal(formatAmount('999999.99'),'999.999,99');
});
