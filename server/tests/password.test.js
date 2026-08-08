import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verifyPassword } from '../src/utils/password.js';

describe('password security', () => {
  it('hashes passwords and verifies the original value', async () => {
    const password = 'SafeFoundation123';
    const hash = await hashPassword(password);

    assert.notEqual(hash, password);
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword('WrongFoundation123', hash), false);
  });
});
