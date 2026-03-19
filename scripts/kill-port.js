#!/usr/bin/env node
/**
 * Pre-start script: checks if the server port is already in use.
 * If so, finds the PID and asks the user whether to kill it.
 */
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createConnection } from 'node:net';

const PORT = process.env.PORT || 3001;

function isPortInUse(port) {
    return new Promise((resolve) => {
        const sock = createConnection({ port, host: '127.0.0.1' });
        sock.once('connect', () => { sock.destroy(); resolve(true); });
        sock.once('error', () => resolve(false));
    });
}

function findPid(port) {
    try {
        // Works on Linux and macOS
        const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf-8' }).trim();
        return out.split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

function ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

const inUse = await isPortInUse(PORT);
if (!inUse) process.exit(0);

const pids = findPid(PORT);
if (pids.length === 0) {
    console.log(`Port ${PORT} appears in use but could not find PID. Proceeding anyway.`);
    process.exit(0);
}

console.log(`Port ${PORT} is already in use by PID ${pids.join(', ')}.`);
const answer = await ask('Kill existing process(es)? [Y/n] ');

if (answer === '' || answer === 'y' || answer === 'yes') {
    // Try SIGTERM first
    for (const pid of pids) {
        try {
            process.kill(Number(pid), 'SIGTERM');
        } catch {}
    }
    await new Promise((r) => setTimeout(r, 1000));

    // Check if port is still held — escalate to SIGKILL
    if (await isPortInUse(PORT)) {
        const remaining = findPid(PORT);
        for (const pid of remaining) {
            try {
                process.kill(Number(pid), 'SIGKILL');
                console.log(`SIGTERM didn't work, sent SIGKILL to PID ${pid}`);
            } catch {}
        }
        await new Promise((r) => setTimeout(r, 500));
    }

    if (await isPortInUse(PORT)) {
        console.error(`Failed to free port ${PORT}. Kill the process manually.`);
        process.exit(1);
    }
    console.log(`Port ${PORT} is free.`);
} else {
    console.log('Aborted. Server not started.');
    process.exit(1);
}
