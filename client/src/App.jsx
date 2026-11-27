import { useState } from 'react';
import Sale from './components/Sale.jsx';
import Products from './components/Products.jsx';
import Stock from './components/Stock.jsx';
import Reports from './components/Reports.jsx';

const TABS = [
  { id: 'venda', label: 'Venda', Component: Sale },
  { id: 'produtos', label: 'Produtos', Component: Products },
  { id: 'estoque', label: 'Estoque', Component: Stock },
  { id: 'relatorios', label: 'Relatórios', Component: Reports },
];

export default function App() {
  const [tab, setTab] = useState('venda');
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-emerald-700">PDV · Casa Esporte</h1>
        <nav className="flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                tab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="flex-1">
        {TABS.map(({ id, Component }) => (
          <div key={id} hidden={tab !== id}>
            {tab === id && <Component />}
          </div>
        ))}
      </main>
    </div>
  );
}
