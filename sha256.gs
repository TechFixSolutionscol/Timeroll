// sha256.gs
// This script provides SHA-256 hashing functionality.

/**
 * Creates a SHA-256 hash of a given string.
 * @param {string} str The string to hash.
 * @returns {string} The SHA-256 hash, as a hex string.
 */
function sha256(str) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  var hex = bytes.map(function(byte) {
    var v = (byte < 0) ? 256 + byte : byte;
    return ("0" + v.toString(16)).slice(-2);
  }).join("");
  return hex;
}

/**
 * Generates a random salt.
 * @returns {string} A random salt.
 */
function generateSalt() {
  return Utilities.getUuid();
}

/**
 * Hashes a password with a given salt.
 * @param {string} password The password to hash.
 * @param {string} salt The salt to use.
 * @returns {string} The hashed password.
 */
function hashPassword(password, salt) {
  return sha256(password + salt);
}
