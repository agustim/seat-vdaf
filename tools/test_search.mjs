// Prova funcional de la cerca (BM25 + sinònims) sobre les dades reals.
// Executa: node tools/test_search.mjs
import { DocSearch } from '../js/retrieval.js';

const search = new DocSearch();
const tests = [
  ['quant de temps tinc cotxe de substitucio', ['assistencia-secundari', 'assistencia-primari']],
  ['punxada què faig si punxo una roda', ['assistencia-secundari', 'assistencia-primari']],
  ['qui pot conduir el cotxe neboda', ['guia-usuari']],
  ['el segur de pneumatics cobreix la llanda', ['segur-neumatics']],
  ['accident amb altre vehicle part amistos', ['guia-usuari']],
  ['telefon assistencia estranger', ['assistencia-secundari', 'assistencia-primari', 'guia-usuari']],
  ['robo denuncia policia', ['guia-usuari', 'segur-neumatics']],
  ['els pares de l empleada poden conduir', ['guia-usuari']],
  ['quan tens dret a hotel per accident', ['assistencia-secundari', 'assistencia-primari']],
];

let fails = 0;
for (const [q, expected] of tests) {
  const res = await search.search(q, 6);
  const ok = res.slice(0, 3).some((r) => expected.includes(r.doc.id));
  const top = res[0];
  console.log(`${ok ? 'PASS' : 'FAIL'}  «${q}»  →  ${top ? top.doc.id : 'cap resultat'}  (s'esperava ${expected.join(' | ')})`);
  if (!ok) fails++;
}
console.log(fails === 0 ? '\nTotes les proves han passat ✔' : `\n${fails} proves han fallat ✘`);
process.exit(fails === 0 ? 0 : 1);
