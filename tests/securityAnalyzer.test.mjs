import { SecurityAnalyzer } from '../dist/validators/securityAnalyzer.js';

const analyzer = new SecurityAnalyzer();

const casos = [
  ['TS: typosquatting distancia 1', `import _ from 'lodahs';`, 'typescript', 'BLOQUEAR'],
  ['TS: paquete legitimo',          `import _ from 'lodash';`, 'typescript', 'PASAR'],
  ['TS: variante legitima',         `import _ from 'lodash-es';`, 'typescript', 'PASAR'],
  ['TS: scope legitimo',            `import React from '@types/react';`, 'typescript', 'PASAR'],
  ['TS: import relativo',           `import x from './utils.js';`, 'typescript', 'PASAR'],
  ['TS: eval bloqueado',            `eval("1+1");`, 'typescript', 'BLOQUEAR'],
  ['PY: typosquatting distancia 1', `import reqeusts`, 'python', 'BLOQUEAR'],
  ['PY: paquete legitimo',          `import requests`, 'python', 'PASAR'],
  ['PY: stdlib',                    `import os`, 'python', 'PASAR'],
  ['PY: alucinacion pura',          `import super_json_parser_9000`, 'python', 'BLOQUEAR'],
  ['PY: os.system bloqueado',       `import os\nos.system("ls")`, 'python', 'BLOQUEAR'],
];

let fallas = 0;

for (const [desc, code, lang, esperado] of casos) {
  const r = await analyzer.analyze(code, lang);
  const real = r.success ? 'PASAR' : 'BLOQUEAR';

  if (real !== esperado) fallas++;

  const ok = real === esperado ? 'OK  ' : 'FALLA';
  console.log(`${ok} | ${desc}`);
  if (real !== esperado) console.log(`      esperado=${esperado} real=${real}`);
  if (r.errors.length)   console.log(`      errores:  ${r.errors.join(' | ')}`);
  if (r.warnings.length) console.log(`      warnings: ${r.warnings.join(' | ')}`);
}

console.log('');
console.log(fallas === 0
  ? `TODOS LOS TESTS PASARON (${casos.length}/${casos.length})`
  : `${fallas} DE ${casos.length} TEST(S) FALLARON`);

process.exit(fallas === 0 ? 0 : 1);
