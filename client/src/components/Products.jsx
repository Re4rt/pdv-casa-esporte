import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { money, parseMoney, centsToInput } from '../format.js';

const EMPTY = { barcode: '', name: '', category: '', cost: '', price: '', stock: '0', min_stock: '0' };

export default function Products() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [inactive, setInactive] = useState(false);
  const [form, setForm] = useState(null); // null = fechado; { id?, ...campos }
  const [err, setErr] = useState('');

  const load = () => api.products(q, inactive).then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, inactive]);

  function edit(p) {
    setErr('');
    setForm({
      id: p.id, barcode: p.barcode ?? '', name: p.name, category: p.category ?? '',
      cost: centsToInput(p.cost_cents), price: centsToInput(p.price_cents), min_stock: String(p.min_stock),
    });
  }

  async function save(e) {
    e.preventDefault();
    setErr('');
    const price_cents = parseMoney(form.price);
    const cost_cents = parseMoney(form.cost || '0');
    if (price_cents === null) return setErr('Informe um preço de venda válido.');
    if (cost_cents === null) return setErr('Custo inválido.');
    const data = { barcode: form.barcode, name: form.name, category: form.category, cost_cents, price_cents, min_stock: Number(form.min_stock) || 0 };
    try {
      if (form.id) await api.updateProduct(form.id, data);
      else await api.createProduct({ ...data, stock: Number(form.stock) || 0 });
      setForm(null);
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  async function toggle(p) {
    await api.updateProduct(p.id, { active: !p.active });
    load();
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Buscar por nome, código ou categoria" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> mostrar inativos</label>
        <button className="btn-primary ml-auto" onClick={() => { setErr(''); setForm({ ...EMPTY }); }}>Novo produto</button>
      </div>

      {form && (
        <form onSubmit={save} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <h2 className="font-semibold sm:col-span-2 lg:col-span-3">{form.id ? 'Editar produto' : 'Novo produto'}</h2>
          <label className="text-sm">Nome *<input className="input mt-1" value={form.name} onChange={set('name')} required /></label>
          <label className="text-sm">Código de barras<input className="input mt-1" value={form.barcode} onChange={set('barcode')} /></label>
          <label className="text-sm">Categoria<input className="input mt-1" value={form.category} onChange={set('category')} /></label>
          <label className="text-sm">Custo (R$)<input className="input mt-1" inputMode="decimal" value={form.cost} onChange={set('cost')} placeholder="0,00" /></label>
          <label className="text-sm">Preço de venda (R$) *<input className="input mt-1" inputMode="decimal" value={form.price} onChange={set('price')} required placeholder="0,00" /></label>
          <label className="text-sm">Estoque mínimo<input className="input mt-1" type="number" min="0" value={form.min_stock} onChange={set('min_stock')} /></label>
          {!form.id && <label className="text-sm">Estoque inicial<input className="input mt-1" type="number" min="0" value={form.stock} onChange={set('stock')} /></label>}
          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2 lg:col-span-3">{err}</div>}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <button className="btn-primary" type="submit">Salvar</button>
            <button className="btn-secondary" type="button" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}
      {!form && err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr><th className="th">Produto</th><th className="th">Código</th><th className="th">Categoria</th><th className="th text-right">Custo</th><th className="th text-right">Preço</th><th className="th text-right">Estoque</th><th /></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td className="td text-slate-400" colSpan={7}>Nenhum produto encontrado.</td></tr>}
            {list.map((p) => (
              <tr key={p.id} className={`border-t border-slate-100 ${p.active ? '' : 'opacity-50'}`}>
                <td className="td font-medium">{p.name}</td>
                <td className="td text-slate-500">{p.barcode || '—'}</td>
                <td className="td text-slate-500">{p.category || '—'}</td>
                <td className="td text-right">{money(p.cost_cents)}</td>
                <td className="td text-right">{money(p.price_cents)}</td>
                <td className={`td text-right font-medium ${p.stock <= p.min_stock ? 'text-red-600' : ''}`}>{p.stock}</td>
                <td className="td text-right whitespace-nowrap">
                  <button className="mr-3 text-sm text-emerald-700 hover:underline" onClick={() => edit(p)}>editar</button>
                  <button className="text-sm text-slate-500 hover:underline" onClick={() => toggle(p)}>{p.active ? 'desativar' : 'reativar'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
