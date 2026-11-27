import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../db.js';
import { makeBackup } from '../backup.js';
import * as svc from '../services.js';

const novo = () => openDb(':memory:');
const bola = { barcode: '111', name: 'Bola', cost_cents: 5000, price_cents: 10000, stock: 5, min_stock: 2 };

test('cria produto com estoque inicial e registra movimento de entrada', () => {
  const db = novo();
  const p = svc.createProduct(db, bola);
  assert.equal(p.stock, 5);
  const mov = svc.listMovements(db, { product_id: p.id });
  assert.equal(mov.length, 1);
  assert.equal(mov[0].type, 'entrada');
  assert.equal(mov[0].quantity, 5);
});

test('rejeita código de barras duplicado e preço inválido', () => {
  const db = novo();
  svc.createProduct(db, bola);
  assert.throws(() => svc.createProduct(db, { ...bola, name: 'Outra' }), /código de barras/);
  assert.throws(() => svc.createProduct(db, { name: 'X', price_cents: -1 }), /Preço/);
  assert.throws(() => svc.createProduct(db, { name: '  ', price_cents: 1 }), /nome/);
});

test('busca por código de barras e por texto', () => {
  const db = novo();
  svc.createProduct(db, bola);
  assert.equal(svc.getProductByBarcode(db, '111').name, 'Bola');
  assert.throws(() => svc.getProductByBarcode(db, '999'), /não cadastrado/);
  assert.equal(svc.listProducts(db, { q: 'bol' }).length, 1);
  assert.equal(svc.listProducts(db, { q: 'zzz' }).length, 0);
});

test('venda baixa o estoque, soma o total e grava movimento', () => {
  const db = novo();
  const p = svc.createProduct(db, bola);
  const { sale, warnings } = svc.createSale(db, [{ product_id: p.id, quantity: 2 }]);
  assert.equal(sale.total_cents, 20000);
  assert.equal(warnings.length, 0);
  assert.equal(svc.getProduct(db, p.id).stock, 3);
  const mov = svc.listMovements(db, { product_id: p.id });
  assert.equal(mov[0].type, 'venda');
  assert.equal(mov[0].quantity, -2);
  assert.equal(mov[0].stock_after, 3);
});

test('venda com estoque zerado é permitida, mas gera alerta e saldo negativo', () => {
  const db = novo();
  const p = svc.createProduct(db, { name: 'Sem estoque', price_cents: 1000 });
  const { sale, warnings } = svc.createSale(db, [{ product_id: p.id, quantity: 1 }]);
  assert.equal(sale.total_cents, 1000);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].stock_after, -1);
});

test('itens repetidos na venda são somados', () => {
  const db = novo();
  const p = svc.createProduct(db, bola);
  const { sale } = svc.createSale(db, [
    { product_id: p.id, quantity: 1 },
    { product_id: p.id, quantity: 2 },
  ]);
  assert.equal(sale.items.length, 1);
  assert.equal(sale.items[0].quantity, 3);
});

test('venda inválida não altera nada (transação desfeita)', () => {
  const db = novo();
  const p = svc.createProduct(db, bola);
  assert.throws(() => svc.createSale(db, [{ product_id: p.id, quantity: 1 }, { product_id: 999, quantity: 1 }]), /não encontrado/);
  assert.equal(svc.getProduct(db, p.id).stock, 5);
  assert.equal(svc.listSales(db).length, 0);
  assert.throws(() => svc.createSale(db, []), /ao menos um item/);
  assert.throws(() => svc.createSale(db, [{ product_id: p.id, quantity: 0 }]), /inválido/);
});

test('entrada soma e ajuste (contagem) define o saldo', () => {
  const db = novo();
  const p = svc.createProduct(db, bola);
  assert.equal(svc.registerMovement(db, { product_id: p.id, type: 'entrada', quantity: 10 }).stock, 15);
  const a = svc.registerMovement(db, { product_id: p.id, type: 'ajuste', new_stock: 12, note: 'contagem' });
  assert.equal(a.stock, 12);
  const mov = svc.listMovements(db, { product_id: p.id });
  assert.equal(mov[0].quantity, -3);
  assert.throws(() => svc.registerMovement(db, { product_id: p.id, type: 'ajuste', new_stock: 12 }), /igual/);
  assert.throws(() => svc.registerMovement(db, { product_id: p.id, type: 'entrada', quantity: 0 }), /maior que zero/);
});

test('produto inativo não é vendido nem aparece na listagem', () => {
  const db = novo();
  const p = svc.createProduct(db, bola);
  svc.updateProduct(db, p.id, { active: false });
  assert.equal(svc.listProducts(db).length, 0);
  assert.throws(() => svc.createSale(db, [{ product_id: p.id, quantity: 1 }]), /inativo/);
});

test('relatório do dia: faturamento, custo, lucro, mais vendidos e estoque baixo', () => {
  const db = novo();
  const a = svc.createProduct(db, bola); // estoque 5, mínimo 2
  const b = svc.createProduct(db, { name: 'Anzol', price_cents: 500, cost_cents: 200, stock: 1, min_stock: 3 });
  svc.createSale(db, [{ product_id: a.id, quantity: 2 }, { product_id: b.id, quantity: 1 }]);
  const r = svc.summary(db);
  assert.equal(r.sales_count, 1);
  assert.equal(r.revenue_cents, 20500);
  assert.equal(r.cost_cents, 10200);
  assert.equal(r.profit_cents, 10300);
  assert.equal(r.items_sold, 3);
  assert.equal(r.top_products[0].name, 'Bola');
  assert.deepEqual(r.low_stock.map((x) => x.name), ['Anzol']);
});

test('backup cria cópia legível do banco e mantém só as mais recentes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pdv-bkp-'));
  let db;
  try {
    const file = join(dir, 'origem.db');
    db = openDb(file);
    svc.createProduct(db, bola);
    const copia = makeBackup(db, join(dir, 'b'), 2);
    const db2 = openDb(copia);
    assert.equal(svc.listProducts(db2).length, 1);
    db2.close();
    for (let i = 0; i < 3; i++) makeBackup(db, join(dir, 'b'), 2);
    assert.equal(readdirSync(join(dir, 'b')).filter((f) => f.endsWith('.db')).length, 2);
  } finally {
    // No Windows o arquivo aberto impede a exclusão: feche o banco antes de apagar.
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
