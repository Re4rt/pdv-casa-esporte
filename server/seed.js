// Dados de EXEMPLO para testar o sistema. Não use em produção.
import { openDb } from './db.js';
import { createProduct } from './services.js';

const db = openDb();
const exemplos = [
  { barcode: '7891000000011', name: 'Bola de futebol campo', category: 'Futebol', cost_cents: 6500, price_cents: 11990, stock: 12, min_stock: 4 },
  { barcode: '7891000000028', name: 'Vara de pesca telescópica 2,10 m', category: 'Pesca', cost_cents: 4200, price_cents: 8990, stock: 8, min_stock: 3 },
  { barcode: '7891000000035', name: 'Anzol nº 6 (cartela)', category: 'Pesca', cost_cents: 350, price_cents: 790, stock: 60, min_stock: 20 },
  { barcode: '7891000000042', name: 'Barraca camping 3 pessoas', category: 'Camping', cost_cents: 18000, price_cents: 32990, stock: 3, min_stock: 2 },
  { barcode: '7891000000059', name: 'Garrafa térmica 1 L', category: 'Camping', cost_cents: 2800, price_cents: 5990, stock: 0, min_stock: 5 },
];
for (const p of exemplos) {
  try {
    createProduct(db, p);
    console.log('criado:', p.name);
  } catch (e) {
    console.log('ignorado:', p.name, '-', e.message);
  }
}
