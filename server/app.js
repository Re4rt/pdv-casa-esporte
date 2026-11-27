import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AppError } from './errors.js';
import * as svc from './services.js';

const wrap = (fn) => (req, res, next) => {
  try {
    res.json(fn(req, res));
  } catch (e) {
    next(e);
  }
};

export function createApp(db) {
  const app = express();
  app.use(express.json());

  const api = express.Router();
  api.get('/health', wrap(() => ({ ok: true })));

  api.get('/products', wrap((req) => svc.listProducts(db, { q: req.query.q, includeInactive: req.query.inactive === '1' })));
  api.get('/products/barcode/:code', wrap((req) => svc.getProductByBarcode(db, req.params.code)));
  api.post('/products', (req, res, next) => {
    try {
      res.status(201).json(svc.createProduct(db, req.body));
    } catch (e) {
      next(e);
    }
  });
  api.put('/products/:id', wrap((req) => svc.updateProduct(db, Number(req.params.id), req.body)));

  api.get('/stock/movements', wrap((req) => svc.listMovements(db, { product_id: req.query.product_id, limit: req.query.limit })));
  api.post('/stock/movements', (req, res, next) => {
    try {
      res.status(201).json(svc.registerMovement(db, req.body));
    } catch (e) {
      next(e);
    }
  });

  api.get('/sales', wrap((req) => svc.listSales(db, { date: req.query.date, limit: req.query.limit })));
  api.get('/sales/:id', wrap((req) => svc.getSale(db, Number(req.params.id))));
  api.post('/sales', (req, res, next) => {
    try {
      res.status(201).json(svc.createSale(db, req.body?.items));
    } catch (e) {
      next(e);
    }
  });

  api.get('/reports/summary', wrap((req) => svc.summary(db, { from: req.query.from, to: req.query.to })));
  api.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use('/api', api);

  // Em produção, serve a interface compilada (npm run build).
  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'client', 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  });
  return app;
}
