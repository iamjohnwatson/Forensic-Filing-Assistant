
const Database = require('better-sqlite3');
const { createClient } = require('@libsql/client');
const dotenv = require('dotenv');

dotenv.config();

const LOCAL_DB_PATH = 'whale_data.db';
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

// Turso HTTP Limit is roughly 4MB body I believe, but safer to keep batches around 500-1000 rows.
const ROWS_PER_BATCH = 500;
const CONCURRENCY = 20;

if (!TURSO_URL || !TURSO_TOKEN) {
    console.error("Missing TURSO config");
    process.exit(1);
}

const localDb = new Database(LOCAL_DB_PATH, { readonly: true });
const turso = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
});

async function main() {
    console.log("Starting MEGA-BATCH Migration...");
    console.log(`Concurrency: ${CONCURRENCY} | Rows per Bulk Insert: ${ROWS_PER_BATCH}`);

    console.log("Clearing Holdings to ensure clean state...");
    await turso.execute("DELETE FROM holdings");

    // We will stream rows from Local DB and pack them into batches
    // Instead of querying per filing (lots of small seeks), let's query ALL holdings
    // and stream them using better-sqlite3 iterator.

    console.log("Querying all holdings (iterator)...");
    const stmt = localDb.prepare('SELECT accession_number, issuer, cusip, value, shares FROM holdings');

    let buffer = [];
    let promises = [];
    let totalRows = 0;

    // Helper to flush buffer
    const flushParams = async (rows: any[]) => {
        if (rows.length === 0) return;

        // Construct ( (?, ?, ?, ?, ?), (?, ?, ...), ... )
        // Actually, Turso client .batch() vs .execute()
        // execute() with values literal is fastest but careful with SQL injection (here data is trusted/typed).
        // Parameterized is safer.

        let sql = 'INSERT INTO holdings (accession_number, issuer, cusip, value, shares) VALUES ';
        let args = [];
        const placeholders = [];

        for (const r of rows) {
            placeholders.push('(?, ?, ?, ?, ?)');
            args.push(r.accession_number, r.issuer, r.cusip, r.value, r.shares);
        }

        sql += placeholders.join(', ');

        try {
            await turso.execute({ sql, args });
            // process.stdout.write('.');
        } catch (e: any) {
            console.error("\nBatch failed:", e.message);
        }
    };

    // Semaphore for concurrency
    const activeWorkers = new Set();

    const scheduleUpload = async (rows: any[]) => {
        // Wait if too many workers
        while (activeWorkers.size >= CONCURRENCY) {
            await Promise.race(activeWorkers);
        }

        const p = flushParams(rows).then(() => {
            activeWorkers.delete(p);
            totalRows += rows.length;
            if (totalRows % 10000 === 0) process.stdout.write(`\rUploaded: ${totalRows} rows`);
        });
        activeWorkers.add(p);
    }

    for (const row of stmt.iterate()) {
        buffer.push(row);

        if (buffer.length >= ROWS_PER_BATCH) {
            await scheduleUpload([...buffer]);
            buffer = [];
        }
    }

    // Final flush
    if (buffer.length > 0) {
        await scheduleUpload([...buffer]);
    }

    console.log("\nWaiting for pending uploads...");
    await Promise.all(activeWorkers);

    console.log("\nMigration Complete!");
}

main().catch(console.error);
