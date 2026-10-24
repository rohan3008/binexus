import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

// One readline interface for the whole session. Opening a new one per
// question breaks piped input: the first interface buffers all of stdin and
// later questions see end-of-file. End of input answers every question "no".
let rl = null;
let ended = false;

function iface() {
  if (!rl) {
    rl = createInterface({ input: stdin, output: stdout });
    rl.on('close', () => { ended = true; });
  }
  return rl;
}

async function ask(q) {
  if (ended) { stdout.write(`${q}(no input)\n`); return ''; }
  const r = iface();
  const answer = await Promise.race([
    r.question(q),
    new Promise((resolve) => r.once('close', () => resolve(''))),
  ]);
  if (ended) stdout.write('(no input)\n');
  return answer.trim();
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
