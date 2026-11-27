# PDV Casa Esporte

Ponto de venda (PDV) e controle de estoque para a Casa Esporte.

- **Back-end:** Node.js + Express + SQLite nativo (`node:sqlite`)
- **Front-end:** React + Vite + Tailwind CSS

## Funcionalidades

- Cadastro de produtos com código de barras, custo, preço e estoque mínimo
- Vendas com baixa automática de estoque (em transação)
- Entradas e ajustes de estoque com histórico de movimentações
- Relatórios de faturamento, custo, lucro, mais vendidos e estoque baixo
- Backup automático diário do banco (mantém os 7 mais recentes)

## Requisitos

- Node.js **22.13 ou superior**

## Como rodar

```bash
npm run setup     # instala as dependências do servidor e do cliente
npm run seed      # (opcional) cria produtos de exemplo
npm run dev       # API em http://localhost:3001 e interface em http://localhost:5173
```

### Produção

```bash
npm run build     # compila a interface em client/dist
npm start         # serve API + interface em http://localhost:3001
```

### Testes

```bash
npm test
```

## Variáveis de ambiente (opcionais)

| Variável     | Padrão        | Descrição                    |
|--------------|---------------|------------------------------|
| `PORT`       | `3001`        | Porta do servidor            |
| `DB_FILE`    | `data/pdv.db` | Caminho do banco SQLite      |
| `BACKUP_DIR` | `backups`     | Pasta dos backups do banco   |

> O banco (`data/`) e os backups (`backups/`) contêm dados reais da loja e
> estão no `.gitignore` — não os envie para o GitHub.
