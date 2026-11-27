async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => v !== undefined && v !== '' && v !== null && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  products: (q, inactive) => request('GET', `/api/products${qs({ q, inactive: inactive ? 1 : undefined })}`),
  productByBarcode: (code) => request('GET', `/api/products/barcode/${encodeURIComponent(code)}`),
  createProduct: (data) => request('POST', '/api/products', data),
  updateProduct: (id, data) => request('PUT', `/api/products/${id}`, data),
  movements: (product_id) => request('GET', `/api/stock/movements${qs({ product_id, limit: 50 })}`),
  addMovement: (data) => request('POST', '/api/stock/movements', data),
  createSale: (items) => request('POST', '/api/sales', { items }),
  sales: (date) => request('GET', `/api/sales${qs({ date })}`),
  summary: (from, to) => request('GET', `/api/reports/summary${qs({ from, to })}`),
};
