const debug = require('debug')('cloudflare-key-value-worker=>libs=>master_crypto');
const crypto = require('crypto-browserify');

const ivLength = 16;
const saltLength = 64;
const tagLength = 16;
const tagPosition = saltLength + ivLength;
const encryptedPosition = tagPosition + tagLength;


class Cryptr {
  constructor(secret, algorithm = null) {
    this.secret = secret;
    this.algorithm = algorithm || 'aes-256-gcm';
  }

  setSecret(secret) {
    this.secret = secret;
  }

  getKey(salt) {
    if (!this.secret || typeof (this.secret) !== 'string') {
      throw new Error('Cryptr: secret must be a non-0-length string');
    }

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(this.secret, salt, 100000, 16, 'sha512', (err, key) => {
        if (err) {
          debug('crypto.pbkdf2 error', err);
          reject(err);
        }
        else
          resolve(key.toString('hex'));
      });
    });
  };

  async encrypt(value) {
    try {
      if (value === null) {
        throw new Error('encrypt: value must not be null or undefined');
      }

      const salt = crypto.randomBytes(saltLength);
      const iv = crypto.randomBytes(ivLength);

      const key = await this.getKey(salt);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);

      const tag = cipher.getAuthTag();
      return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
    } catch (ex) {
      debug('encrypt: Error', ex);
      return null;
    }
  }

  async decrypt(value) {
    try {
      if (value === null) {
        throw new Error('decrypt: value must not be null or undefined');
      }

      const stringValue = Buffer.from(String(value), 'hex');

      const salt = stringValue.slice(0, saltLength);
      const iv = stringValue.slice(saltLength, tagPosition);
      const tag = stringValue.slice(tagPosition, encryptedPosition);
      const encrypted = stringValue.slice(encryptedPosition);

      const key = await this.getKey(salt);
      // debug('decrypt key', key);
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);

      decipher.setAuthTag(tag);
      return decipher.update(encrypted) + decipher.final('utf8');
    } catch (ex) {
      debug('decrypt: Error', ex);
      return null;
    }
  }
}

module.exports = Cryptr;
