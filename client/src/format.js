const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (cents) => brl.format((cents ?? 0) / 100);

// "12,50" ou "12.50" -> 1250 (centavos). Retorna null se inválido.
export function parseMoney(text) {
  const t = String(text ?? '').trim().replace(/\s/g, '').replace('R$', '');
  if (t === '') return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export const centsToInput = (cents) => ((cents ?? 0) / 100).toFixed(2).replace('.', ',');
