import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { money } from '../format.js';

// O leitor de código de barras USB funciona como um teclado: digita o código e envia Enter.
export default function Sale() {
  const [code, setCode] = useState('');
  const [cart, setCart] = useState([]); // { product, quantity }
  const [msg, setMsg] = useState(null); // { kind: 'error' | 'warn' | 'ok', text }
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => inputRef.current?.focus(), []);
  const refocus = () => setTimeout(() => inputRef.current?.focus(), 0);

  const total = cart.reduce((s, l) => s + l.product.price_cents * l.quantity, 0);

  function addProduct(product) {
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === product.id);
      if (i >= 0) return c.map((l, k) => (k === i ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { product, quantity: 1 }];
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const value = code.trim();
    if (!value) return;
    setCode('');
    setMsg(null);
    try {
      let product;
      try {
        product = await api.productByBarcode(value);
      } catch {
        // Se não for um código cadastrado, tenta buscar pelo nome.
        const found = await api.products(value);
        if (found.length === 1) product = found[0];
        else if (found.length > 1) throw new Error(`${found.length} produtos encontrados para "${value}". Seja mais específico ou use o código de barras.`);
        else throw new Error('Produto não encontrado.');
      }
      addProduct(product);
      if (product.stock <= 0) setMsg({ kind: 'warn', text: `Atenção: "${product.name}" está sem estoque. A venda ainda é permitida.` });
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    }
    refocus();
  }

  function setQty(id, q) {
    const n = Math.max(0, Math.floor(Number(q) || 0));
    setCart((c) => (n === 0 ? c.filter((l) => l.product.id !== id) : c.map((l) => (l.product.id === id ? { ...l, quantity: n } : l))));
  }

  async function finish() {
    if (cart.length === 0) return;
    setBusy(true);
    try {
      const { sale, warnings } = await api.createSale(cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })));
      setCart([]);
      setMsg({
        kind: warnings.length ? 'warn' : 'ok',
        text:
          `Venda #${sale.id} registrada: ${money(sale.total_cents)}.` +
          (warnings.length ? ` Estoque insuficiente em: ${warnings.map((w) => w.name).join(', ')}.` : ''),
      });
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
      refocus();
    }
  }

  const color = { error: 'bg-red-50 text-red-700 ring-red-200', warn: 'bg-amber-50 text-amber-800 ring-amber-200', ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200' };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="card flex flex-col gap-3">
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            className="input text-base"
            placeholder="Leia o código de barras ou digite o nome do produto e tecle Enter"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
          <button className="btn-secondary" type="submit">Adicionar</button>
        </form>
        {msg && <div className={`rounded-lg px-3 py-2 text-sm ring-1 ${color[msg.kind]}`}>{msg.text}</div>}
        <table className="w-full">
          <thead>
            <tr><th className="th">Produto</th><th className="th text-right">Preço</th><th className="th text-center">Qtd</th><th className="th text-right">Subtotal</th><th /></tr>
          </thead>
          <tbody>
            {cart.length === 0 && (
              <tr><td className="td text-slate-400" colSpan={5}>Nenhum item na venda.</td></tr>
            )}
            {cart.map(({ product, quantity }) => (
              <tr key={product.id} className="border-t border-slate-100">
                <td className="td">
                  {product.name}
                  {product.stock < quantity && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">estoque: {product.stock}</span>}
                </td>
                <td className="td text-right">{money(product.price_cents)}</td>
                <td className="td text-center">
                  <input type="number" min="0" className="input w-20 text-center" value={quantity} onChange={(e) => setQty(product.id, e.target.value)} />
                </td>
                <td className="td text-right font-medium">{money(product.price_cents * quantity)}</td>
                <td className="td text-right"><button className="text-sm text-red-600 hover:underline" onClick={() => setQty(product.id, 0)}>remover</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <aside className="card flex h-fit flex-col gap-4">
        <div>
          <div className="text-sm text-slate-500">Total da venda</div>
          <div className="text-4xl font-bold text-emerald-700">{money(total)}</div>
        </div>
        <button className="btn-primary py-3 text-base" disabled={busy || cart.length === 0} onClick={finish}>Finalizar venda</button>
        <button className="btn-secondary" disabled={cart.length === 0} onClick={() => { setCart([]); refocus(); }}>Cancelar venda</button>
      </aside>
    </div>
  );
}
