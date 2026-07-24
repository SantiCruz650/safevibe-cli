#!/usr/bin/env node

import { runValidationPipeline } from './engine/validatorEngine.js';
import fs from 'node:fs/promises';

function parseArgs(argv: string[]): { file?: string; stdin: boolean; lang: string } {
  let file: string | undefined;
  let stdin = false;
  let lang = 'typescript';

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--file':
        file = argv[++i];
        break;
      case '--stdin':
        stdin = true;
        break;
      case '--lang':
        lang = argv[++i];
        break;
    }
  }

  if (!file && !stdin) {
    console.error('Usage: cli.js --file <path> --lang <language> | --stdin --lang <language>');
    process.exit(1);
  }

  return { file, stdin, lang };
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const { file, stdin, lang } = parseArgs(process.argv);

  let code: string;
  if (file) {
    code = await fs.readFile(file, 'utf-8');
  } else {
    code = await readStdin();
  }

  const result = await runValidationPipeline(code, lang);

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  process.exit(result.success ? 0 : 1);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stdout.write(JSON.stringify({
    success: false,
    language: 'unknown',
    checks: [],
    finalCode: null,
    error: msg,
  }, null, 2) + '\n');
  process.exit(1);
});
