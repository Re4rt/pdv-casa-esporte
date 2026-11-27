import { tx } from './db.js';
import { AppError } from './errors.js';

const isInt = (v) => Number.isInteger(v);
const clean = (s) => (typeof s === 'string' && s.trim() !== '' ? s.trim() : null);

/* ------------------------------ Produtos ------------------------------ */

function validateProduct(data, { partial = false } = {}) {
  const out = {};
  if (!partial || data.name !== undefined) {
    const name = clean(data.name);
    if (!name) throw new AppError(400, 'Informe o nome do produto.');
    out.name = name;
  }
  if (!partial || data.price_cents !== undefined) {
    if (!isInt(data.price_cents) || data.price_cents < 0) throw new AppError(400, 'Preço de venda inválido.');
    out.price_cents = data.price_cents;
  }
  if (data.cost_cents !== undefined) {
    if (!isInt(data.cost_cents) || data.cost_cents < 0) throw new AppError(400, 'Custo inválido.');
    out.cost_cents = data.cost_cents;
  }
  if (data.min_stock !== undefined) {
    if (!isInt(data.min_stock) || data.min_stock < 0) throw new AppError(400, 'Estoque mínimo inválido.');
    out.min_stock = data.min_stock;
  }
  if (data.barcode !== undefined) out.barcode = clean(data.barcode);
  if (data.category !== undefined) out.category = clean(data.category);
  return out;
}

function mapUniqueError(err) {
  if (String(err.message).includes('UNIQUE') && String(err.message).includes('barcode')) {
    return new AppError(409, 'Já existe um produto com esse código de barras.');
  }
  return err;
}

export function getProduct(db, id) {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!p) throw new AppError(404, 'Produto não encontrado.');
  return p;
}

export function createProduct(db, data) {
  const v = validateProduct(data);
  const initialStock = data.stock ?? 0;
  if (!isInt(initialStock) || initialStock < 0) throw new AppError(400, 'Estoque inicial inválido.');
  try {
    return tx(db, () => {
      const r = db
        .prepare(
          `INSERT INTO products (barcode, name, category, cost_cents, price_cents, stock, min_stock)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(v.barcode ?? null, v.name, v.category ?? null, v.cost_cents ?? 0, v.price_cents, initialStock, v.min_stock ?? 0);
      const id = Number(r.lastInsertRowid);
      if (initialStock > 0) {
        db.prepare(
          `INSERT INTO stock_movements (product_id, type, quantity, stock_after, note) VALUES (?, 'entrada', ?, ?, 'Estoque inicial')`
        ).run(id, initialStock, initialStock);
      }
      return getProduct(db, id);
    });
  } catch (err) {
    throw mapUniqueError(err);
  }
}

export function updateProduct(db, id, data) {
  getProduct(db, id);
  const v = validateProduct(data, { partial: true });
  if (data.active !== undefined) v.active = data.active ? 1 : 0;
  const cols = Object.keys(v);
  if (cols.length === 0) return getProduct(db, id);
  try {
    db.prepare(
      `UPDATE products SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now','localtime') WHERE id = ?`
    ).run(...cols.map((c) => v[c]), id);
  } catch (err) {
    throw mapUniqueError(err);
  }
  return getProduct(db, id);
}

export function listProducts(db, { q, includeInactive = false } = {}) {
  const where = [];
  const params = [];
  if (!includeInactive) where.push('active = 1');
  if (q && q.trim()) {
    where.push('(name LIKE ? OR barcode LIKE ? OR category LIKE ?)');
    const like = `%${q.trim()}%`;
    params.push(like, like, like);
  }
  const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name COLLATE NOCASE LIMIT 500`;
  return db.prepare(sql).all(...params);
}

export function getProductByBarcode(db, code) {
  const p = db.prepare('SELECT * FROM products WHERE barcode = ? AND active = 1').get(String(code).trim());
  if (!p) throw new AppError(404, 'Código de barras não cadastrado.');
  return p;
}

/* ------------------------------- Estoque ------------------------------ */

// Registra entrada (soma) ou ajuste/contagem (define o saldo absoluto).
export function registerMovement(db, { product_id, type, quantity, new_stock, note }) {
  return tx(db, () => {
    const p = getProduct(db, product_id);
    let delta;
    if (type === 'entrada') {
      if (!isInt(quantity) || quantity <= 0) throw new AppError(400, 'A quantidade de entrada deve ser maior que zero.');
      delta = quantity;
    } else if (type === 'ajuste') {
      if (!isInt(new_stock) || new_stock < 0) throw new AppError(400, 'Informe o saldo contado (zero ou mais).');
      delta = new_stock - p.stock;
      if (delta === 0) throw new AppError(400, 'O saldo informado é igual ao atual.');
    } else {
      throw new AppError(400, 'Tipo de movimento inválido (use "entrada" ou "ajuste").');
    }
    const after = p.stock + delta;
    db.prepare(`UPDATE products SET stock = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(after, p.id);
    db.prepare(
      `INSERT INTO stock_movements (product_id, type, quantity, stock_after, note) VALUES (?, ?, ?, ?, ?)`
    ).run(p.id, type, delta, after, clean(note));
    return getProduct(db, p.id);
  });
}

export function listMovements(db, { product_id, limit = 100 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const base = `SELECT m.*, p.name AS product_name, p.barcode
                FROM stock_movements m JOIN products p ON p.id = m.product_id`;
  if (product_id) return db.prepare(`${base} WHERE m.product_id = ? ORDER BY m.id DESC LIMIT ?`).all(Number(product_id), lim);
  return db.prepare(`${base} ORDER BY m.id DESC LIMIT ?`).all(lim);
}

/* -------------------------------- Vendas ------------------------------ */

// Regra de negócio: venda com estoque insuficiente/zerado É permitida, mas gera alerta.
export function createSale(db, items) {
  if (!Array.isArray(items) || items.length === 0) throw new AppError(400, 'A venda precisa ter ao menos um item.');

  const merged = new Map();
  for (const it of items) {
    if (!isInt(it.product_id) || !isInt(it.quantity) || it.quantity <= 0) {
      throw new AppError(400, 'Item de venda inválido.');
    }
    merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + it.quantity);
  }

  return tx(db, () => {
    const warnings = [];
    const lines = [];
    let total = 0;
    for (const [pid, qty] of merged) {
      const p = getProduct(db, pid);
      if (!p.active) throw new AppError(400, `Produto inativo: ${p.name}.`);
      const subtotal = p.price_cents * qty;
      total += subtotal;
      lines.push({ p, qty, subtotal });
    }

    const sale = db.prepare('INSERT INTO sales (total_cents) VALUES (?)').run(total);
    const saleId = Number(sale.lastInsertRowid);

    for (const { p, qty, subtotal } of lines) {
      db.prepare(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price_cents, unit_cost_cents, subtotal_cents)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(saleId, p.id, qty, p.price_cents, p.cost_cents, subtotal);
      const after = p.stock - qty;
      db.prepare(`UPDATE products SET stock = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(after, p.id);
      db.prepare(
        `INSERT INTO stock_movements (product_id, type, quantity, stock_after, note, sale_id)
         VALUES (?, 'venda', ?, ?, ?, ?)`
      ).run(p.id, -qty, after, `Venda #${saleId}`, saleId);
      if (qty > p.stock) {
        warnings.push({ product_id: p.id, name: p.name, requested: qty, available: p.stock, stock_after: after });
      }
    }
    return { sale: getSale(db, saleId), warnings };
  });
}

export function getSale(db, id) {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  if (!sale) throw new AppError(404, 'Venda não encontrada.');
  sale.items = db
    .prepare(
      `SELECT si.*, p.name, p.barcode FROM sale_items si JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ? ORDER BY si.id`
    )
    .all(id);
  return sale;
}

export function listSales(db, { date, limit = 50 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 500);
  if (date) return db.prepare('SELECT * FROM sales WHERE date(created_at) = ? ORDER BY id DESC LIMIT ?').all(date, lim);
  return db.prepare('SELECT * FROM sales ORDER BY id DESC LIMIT ?').all(lim);
}

/* ------------------------------ Relatórios ----------------------------- */

const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function summary(db, { from, to } = {}) {
  const f = from || today();
  const t = to || f;
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS sales_count, COALESCE(SUM(total_cents), 0) AS revenue_cents
       FROM sales WHERE date(created_at) BETWEEN ? AND ?`
    )
    .get(f, t);
  const items = db
    .prepare(
      `SELECT COALESCE(SUM(si.quantity), 0) AS items_sold,
              COALESCE(SUM(si.unit_cost_cents * si.quantity), 0) AS cost_cents
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE date(s.created_at) BETWEEN ? AND ?`
    )
    .get(f, t);
  const top = db
    .prepare(
      `SELECT p.id, p.name, SUM(si.quantity) AS quantity, SUM(si.subtotal_cents) AS revenue_cents
       FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
       WHERE date(s.created_at) BETWEEN ? AND ?
       GROUP BY p.id ORDER BY quantity DESC, revenue_cents DESC LIMIT 5`
    )
    .all(f, t);
  const lowStock = db
    .prepare(`SELECT id, name, barcode, stock, min_stock FROM products WHERE active = 1 AND stock <= min_stock ORDER BY stock ASC, name LIMIT 100`)
    .all();
  return {
    from: f,
    to: t,
    sales_count: Number(totals.sales_count),
    revenue_cents: Number(totals.revenue_cents),
    items_sold: Number(items.items_sold),
    cost_cents: Number(items.cost_cents),
    profit_cents: Number(totals.revenue_cents) - Number(items.cost_cents),
    top_products: top,
    low_stock: lowStock,
  };
}
