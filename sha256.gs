/**
 * Calculates the SHA-256 hash of a string.
 *
 * @param {string} input The string to hash.
 * @return {string} The hexadecimal representation of the hash.
 */
function sha256(input) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);

  let hexString = '';
  for (let i = 0; i < digest.length; i++) {
    const byte = digest[i];
    // Ensure byte is treated as an unsigned value
    const unsignedByte = byte < 0 ? byte + 256 : byte;
    const hex = unsignedByte.toString(16);
    // Pad with a leading zero if necessary
    hexString += (hex.length === 1) ? '0' + hex : hex;
  }

  return hexString;
}
