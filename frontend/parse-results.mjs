import { readFileSync } from 'node:fs';

const r = JSON.parse(readFileSync('test-results.json', 'utf8'));
console.log(`passed: ${r.numPassedTests} failed: ${r.numFailedTests}`);
for (const file of r.testResults.filter((t) => t.status === 'failed')) {
  console.log(`\n${file.name}`);
  for (const a of file.assertionResults.filter((x) => x.status === 'failed')) {
    console.log(` - ${a.fullName}`);
    console.log(`   ${a.failureMessages?.[0]?.split('\n')[0] ?? ''}`);
  }
}