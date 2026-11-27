import { useEffect, useState } from 'react';
import { api } from '../api.js';

const TYPE = { entrada: 'Entrada', venda: 'Venda', ajuste: 'Ajuste' };

export default function Stock() {
  const [products, setProducts] = useState([]);
  const [moves, setMoves] = useState([]);
  const [form, setForm] = useState({ product_id: '', type: 'entrada', value: '', note: '' });
  const [msg, setMsg] = useState(null);

  const load = () => {
    api.products().then(setProducts).catch((e) => setMsg({ ok: false, text: e.message }));
    api.movements().then(setMoves).catch(() => {});
  };
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    const n = Number(form.value);
    if (!form.product_id) return setMsg({ ok: false, text: 'Escolha um produto.' });
    if (!Number.isInteger(n)) return setMsg({ ok: false, text: 'Informe uma quantidade inteira.' });
    try {
      const body = { product_id: Number(form.product_id), type: form.type, note: form.note };
      if (form.type === 'entrada') body.quantity = n;
      else body.new_stock = n;
      const p = await api.addMovement(body);
      setMsg({ ok: true, text: `Estoque de "${p.name}" agora é ${p.stock}.` });
      setForm({ ...form, value: '', note: '' });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  const current = products.find((p) => String(p.id) === String(form.product_id));

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm lg:col-span-2">Produto
          <select className="input mt-1" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
            <option value="">Selecione…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (estoque {p.stock})</option>)}
          </select>
        </label>
        <label className="text-sm">Tipo
          <select className="input mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="entrada">Entrada de mercadoria</option>
            <option value="ajuste">Ajuste (contagem)</option>
          </select>
        </label>
        <label className="text-sm">{form.type === 'entrada' ? 'Quantidade que entrou' : `Saldo contado${current ? ` (atual: ${current.stock})` : ''}`}
          <input className="input mt-1" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
        </label>
        <label className="text-sm sm:col-span-2 lg:col-span-3">Observação
          <input className="input mt-1" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex.: compra do fornecedor, contagem de inventário" />
        </label>
        <div className="flex items-end"><button className="btn-primary w-full" type="submit">Registrar</button></div>
        {msg && <div className={`rounded-lg px-3 py-2 text-sm sm:col-span-2 lg:col-span-4 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
      </form>

      <div className="card overflow-x-auto p-0">
        <h2 className="px-4 pt-4 font-semibold">Últimos movimentos</h2>
        <table className="w-full">
          <thead><tr><th className="th">Data</th><th className="th">Produto</th><th className="th">Tipo</th><th className="th text-right">Variação</th><th className="th text-right">Saldo</th><th className="th">Obs.</th></tr></thead>
          <tbody>
            {moves.length === 0 && <tr><td className="td text-slate-400" colSpan={6}>Sem movimentos ainda.</td></tr>}
            {moves.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="td whitespace-nowrap text-slate-500">{m.created_at}</td>
                <td className="td">{m.product_name}</td>
                <td className="td">{TYPE[m.type]}</td>
                <td className={`td text-right font-medium ${m.quantity < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                <td className="td text-right">{m.stock_after}</td>
                <td className="td text-slate-500">{m.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
