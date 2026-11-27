import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const pad = (n) => String(n).padStart(2, '0');

function stamp(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${String(d.getMilliseconds()).padStart(3, '0')}`;
}

// Cria uma cópia consistente do banco (VACUUM INTO) e mantém só as `keep` mais recentes.
export function makeBackup(db, dir = 'backups', keep = 7) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `pdv-${stamp()}.db`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const old = readdirSync(dir).filter((f) => /^pdv-.*\.db$/.test(f)).sort().reverse().slice(keep);
  for (const f of old) rmSync(join(dir, f), { force: true });
  return file;
}

export function scheduleBackups(db, { dir = 'backups', keep = 7, everyHours = 24 } = {}) {
  const run = () => {
    try {
      const f = makeBackup(db, dir, keep);
      console.log(`[backup] criado: ${f}`);
    } catch (e) {
      console.error('[backup] falhou:', e.message);
    }
  };
  run();
  const timer = setInterval(run, everyHours * 3600 * 1000);
  timer.unref();
  return timer;
}
