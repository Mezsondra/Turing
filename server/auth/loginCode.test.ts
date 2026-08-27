// Run: npx tsx server/auth/loginCode.test.ts
import assert from 'assert';
import {
  generateCode, hashCode, checkCode, normaliseEmail, MAX_ATTEMPTS, CODE_TTL_MS,
} from './loginCode.js';

const SECRET = 'test-secret';
const EMAIL = 'player@example.com';

try {
  // Codes are six digits, keep leading zeros, and are not all identical.
  const codes = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const c = generateCode();
    assert.match(c, /^\d{6}$/, `not six digits: ${c}`);
    codes.add(c);
  }
  assert.ok(codes.size > 100, 'codes must not repeat constantly');

  const code = '012345';
  const hash = hashCode(code, EMAIL, SECRET);
  const fresh = { code_hash: hash, expires_at: Date.now() + CODE_TTL_MS, attempts: 0 };

  assert.strictEqual(checkCode(fresh, code, EMAIL, SECRET), 'ok');
  assert.strictEqual(checkCode(fresh, '999999', EMAIL, SECRET), 'wrong');
  assert.strictEqual(checkCode(undefined, code, EMAIL, SECRET), 'missing');

  // A hash is bound to its address, so it cannot be replayed against another.
  assert.strictEqual(checkCode(fresh, code, 'someone@else.com', SECRET), 'wrong');

  // Expiry.
  assert.strictEqual(
    checkCode({ ...fresh, expires_at: Date.now() - 1 }, code, EMAIL, SECRET),
    'expired',
  );

  // The attempt cap is what makes six digits safe. It must win even when the
  // submitted code is correct, or an attacker gets unlimited guesses.
  assert.strictEqual(
    checkCode({ ...fresh, attempts: MAX_ATTEMPTS }, code, EMAIL, SECRET),
    'locked',
  );
  // ...and it must be checked before expiry, so lapsing does not unlock it.
  assert.strictEqual(
    checkCode({ ...fresh, attempts: MAX_ATTEMPTS, expires_at: Date.now() - 1 }, code, EMAIL, SECRET),
    'locked',
  );

  // Email normalisation decides whether two spellings are one account.
  assert.strictEqual(normaliseEmail('  Foo@Gmail.COM '), 'foo@gmail.com');
  assert.strictEqual(normaliseEmail('no-at-sign'), null);
  assert.strictEqual(normaliseEmail('a@b'), null, 'needs a tld');
  assert.strictEqual(normaliseEmail(''), null);
  assert.strictEqual(normaliseEmail(undefined), null);
  assert.strictEqual(normaliseEmail('a'.repeat(250) + '@b.com'), null, 'absurd length rejected');

  console.log('loginCode tests passed');
} catch (error) {
  console.error(error);
  process.exit(1);
}
