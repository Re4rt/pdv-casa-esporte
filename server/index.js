import { openDb } from './db.js';
import { createApp } from './app.js';
import { scheduleBackups } from './backup.js';

const PORT = Number(process.env.PORT) || 3001;
const db = openDb();
scheduleBackups(db, { dir: process.env.BACKUP_DIR || 'backups', keep: 7, everyHours: 24 });

createApp(db).listen(PORT, () => {
  console.log(`PDV Casa Esporte rodando em http://localhost:${PORT}`);
});
