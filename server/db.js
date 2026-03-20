import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;

const pool = mysql.createPool({
    host: process.env.DOLT_HOST || 'localhost',
    port: parseInt(process.env.DOLT_PORT || '3307'),
    user: process.env.DOLT_USER || 'root',
    password: process.env.DOLT_PASSWORD || '',
    database: process.env.DOLT_DATABASE || 'brunch',
    waitForConnections: true,
    connectionLimit: 10,
});

export default pool;

export async function initDb({ retries = 10, delayMs = 2000 } = {}) {
    // Wait for Dolt to be ready (relevant for `npm run dev` without docker-compose healthcheck)
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await pool.execute('SELECT 1');
            break;
        } catch (err) {
            if (attempt === retries) {
                throw new Error(`[db] could not connect after ${retries} attempts: ${err.message}`);
            }
            console.log(`[db] waiting for Dolt (attempt ${attempt}/${retries})...`);
            await new Promise(r => setTimeout(r, delayMs));
        }
    }

    const dbName = process.env.DOLT_DATABASE || 'brunch';

    // Check if tables exist; if not, run init.sql
    const [rows] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'project'`,
        [dbName]
    );
    if (rows[0].cnt === 0) {
        const initSql = readFileSync(resolve(__dirname, 'migrations', 'dolt', 'init.sql'), 'utf-8');
        const statements = initSql.split(/;\s*$/m).map(s => s.trim()).filter(s => s.length > 0);
        for (const stmt of statements) {
            await pool.execute(stmt);
        }
        console.log('[db] initialized schema from init.sql');
    }

    // Run 002_normalize migration if assumption table doesn't exist yet
    const [normRows] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'assumption'`,
        [dbName]
    );
    if (normRows[0].cnt === 0) {
        const migSql = readFileSync(resolve(__dirname, 'migrations', 'dolt', '002_normalize.sql'), 'utf-8');
        const statements = migSql.split(/;\s*$/m).map(s => s.trim()).filter(s => s.length > 0);
        for (const stmt of statements) {
            await pool.execute(stmt);
        }
        console.log('[db] applied 002_normalize migration');
    }
}
