import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

async function ask(q) {
  const rl = createInterface({ input: stdin, output: stdout });
  try { return (await rl.question(q)).trim(); } finally { rl.close(); }
}

export async function confirm(question) {
  return /^y(es)?$/i.test(await ask(`${question} [y/N] `));
}

export async function typed(question, expected) {
  return (await ask(`${question}\nType "${expected}" to confirm: `)) === expected;
}
