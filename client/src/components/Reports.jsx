import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { money } from '../format.js';

const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function Kpi({ label, value }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function Reports() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.summary(from, to).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message));
  }, [from, to]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">De<input type="date" className="input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">Até<input type="date" className="input mt-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Vendas" value={data.sales_count} />
            <Kpi label="Faturamento" value={money(data.revenue_cents)} />
            <Kpi label="Itens vendidos" value={data.items_sold} />
            <Kpi label="Lucro bruto" value={money(data.profit_cents)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-2 font-semibold">Mais vendidos</h2>
              {data.top_products.length === 0 ? <p className="text-sm text-slate-400">Sem vendas no período.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {data.top_products.map((p) => (
                    <li key={p.id} className="flex justify-between py-2"><span>{p.name}</span><span className="text-slate-500">{p.quantity} un · {money(p.revenue_cents)}</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card">
              <h2 className="mb-2 font-semibold">Estoque baixo</h2>
              {data.low_stock.length === 0 ? <p className="text-sm text-slate-400">Nenhum produto abaixo do mínimo.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {data.low_stock.map((p) => (
                    <li key={p.id} className="flex justify-between py-2"><span>{p.name}</span><span className="font-medium text-red-600">{p.stock} (mín. {p.min_stock})</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
