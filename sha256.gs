/**
 * @fileoverview Provides SHA-256 hashing functionality.
 * This script contains functions to compute SHA-256 hashes, which is
 * essential for securely storing user passwords. It includes a helper
 * for the hashing algorithm itself and a function to hash a password
 * with a salt.
 */

/**
 * Computes the SHA-256 hash of a given string.
 * @param {string} input The string to hash.
 * @returns {string} The SHA-256 hash as a hex string.
 */
function computeSha256(input) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return digest.map(byte => {
    const hex = (byte & 0xFF).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Hashes a password with a given salt using SHA-256.
 * @param {string} password The password to hash.
 * @param {string} salt The salt to use.
 * @returns {string} The resulting hash.
 */
function hashPassword(password, salt) {
  return computeSha256(password + salt);
}
