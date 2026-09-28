import { mapFedaPayStatus, isNotFoundError } from './fedapayRiskTests.helpers';
import { isValidEmail } from '../config/fedapayHttp';

type Case<T> = { name: string; input: T; expected: unknown };

const statusCases: Case<unknown>[] = [
  { name: 'approved', input: 'approved', expected: 'approved' },
  { name: 'paid', input: 'paid', expected: 'approved' },
  { name: 'transferred', input: 'transferred', expected: 'approved' },
  { name: 'success', input: 'success', expected: 'approved' },
  { name: 'succeeded', input: 'succeeded', expected: 'approved' },
  { name: 'declined', input: 'declined', expected: 'declined' },
  { name: 'failed', input: 'failed', expected: 'declined' },
  { name: 'failure', input: 'failure', expected: 'declined' },
  { name: 'canceled', input: 'canceled', expected: 'canceled' },
  { name: 'cancelled', input: 'cancelled', expected: 'canceled' },
  { name: 'refunded', input: 'refunded', expected: 'refunded' },
  { name: 'partially_refunded', input: 'partially_refunded', expected: 'refunded' },
  { name: 'expired', input: 'expired', expected: 'expired' },
  { name: 'timeout', input: 'timeout', expected: 'expired' },
  { name: 'timed_out', input: 'timed_out', expected: 'expired' },
  { name: 'unknown → pending', input: 'foo_bar', expected: 'pending' },
  { name: 'null → pending', input: null, expected: 'pending' },
  { name: 'uppercase', input: 'APPROVED', expected: 'approved' },
  { name: 'empty string', input: '', expected: 'pending' },
];

const notFoundCases: Case<unknown>[] = [
  { name: 'httpStatus 404', input: { httpStatus: 404, message: 'whatever' }, expected: true },
  { name: 'statusCode 404', input: { statusCode: 404, message: 'whatever' }, expected: true },
  { name: 'message contains not found', input: { message: 'Resource not found' }, expected: true },
  { name: 'message 404', input: { message: 'Got 404' }, expected: true },
  { name: 'message introuvable', input: { message: 'Transaction introuvable' }, expected: true },
  { name: 'random error', input: { message: 'Network down' }, expected: false },
  { name: 'null', input: null, expected: false },
];

const emailCases: Case<unknown>[] = [
  { name: 'valid', input: 'a@b.c', expected: true },
  { name: 'valid long', input: 'john.doe+test@example.co.uk', expected: true },
  { name: 'missing @', input: 'ab.c', expected: false },
  { name: 'empty', input: '', expected: false },
  { name: 'null', input: null, expected: false },
  { name: 'too long', input: 'a'.repeat(252) + '@b.c', expected: false },
];

let failed = 0;
function run<T>(label: string, cases: Case<T>[], fn: (i: T) => unknown) {
  for (const c of cases) {
    const got = fn(c.input);
    const ok = JSON.stringify(got) === JSON.stringify(c.expected);
    if (!ok) {
      failed++;
      console.error(`[FAIL] ${label} / ${c.name}: got=${JSON.stringify(got)} expected=${JSON.stringify(c.expected)}`);
    } else {
      console.log(`[ok]   ${label} / ${c.name}`);
    }
  }
}

run('mapFedaPayStatus', statusCases, (i) => mapFedaPayStatus(i));
run('isNotFoundError', notFoundCases, (i) => isNotFoundError(i));
run('isValidEmail', emailCases, (i) => isValidEmail(i));

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log('\nAll tests passed');
}
