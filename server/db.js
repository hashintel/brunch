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

export async function initDb() {
    // Check if tables exist; if not, run init.sql
    const [rows] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'project'`,
        [process.env.DOLT_DATABASE || 'brunch']
    );
    if (rows[0].cnt === 0) {
        const initSql = readFileSync(resolve(__dirname, 'migrations', 'dolt', 'init.sql'), 'utf-8');
        // Split on semicolons and execute each statement
        const statements = initSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const stmt of statements) {
            await pool.execute(stmt);
        }
        console.log('[db] initialized schema from init.sql');
    }
}
