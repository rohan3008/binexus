import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

// One readline for the whole session, with our own line queue. Readline drops
// lines that arrive while no question is pending, and the applier does async
// work between prompts, so piped answers were being lost. End of input
// answers every remaining question "no". Piped answers are echoed so the
// transcript reads like an interactive session.
let rl = null;
let ended = false;
const queue = [];
const waiters = [];

function iface() {
  if (rl) return rl;
  rl = createInterface({ input: stdin, output: stdout, terminal: !!stdin.isTTY });
  rl.on('line', (line) => { const w = waiters.shift(); if (w) w(line); else queue.push(line); });
  rl.on('close', () => { ended = true; for (const w of waiters.splice(0)) w(null); });
  return rl;
}

async function ask(q) {
  iface();
  stdout.write(q);
  let line = queue.length ? queue.shift() : ended ? null : await new Promise((r) => waiters.push(r));
  if (line === null) { stdout.write('(no input)\n'); return ''; }
  if (!stdin.isTTY) stdout.write(`${line}\n`);
  return line.trim();
}

export async function confirm(question) {
  return /^y(es)?$/i.test(await ask(`${question} [y/N] `));
}

export async function typed(question, expected) {
  return (await ask(`${question}\nType "${expected}" to confirm: `)) === expected;
}

export function closePrompt() {
  if (rl && !ended) rl.close();
}
