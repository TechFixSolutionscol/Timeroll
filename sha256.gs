/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// sha256.gs - Funciones para hashing SHA-256

/**
 * Genera un 'salt' aleatorio para el hashing de contraseñas.
 * @returns {string} Un string hexadecimal de 16 bytes.
 */
function generateSalt() {
  const bytes = [];
  for (let i = 0; i < 16; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return bytes.map(byte => ('0' + byte.toString(16)).slice(-2)).join('');
}

/**
 * Hashea una contraseña usando SHA-256 con un 'salt'.
 * @param {string} password - La contraseña a hashear.
 * @param {string} salt - El salt a usar.
 * @returns {string} El hash SHA-256 en formato hexadecimal.
 */
function hashPassword(password, salt) {
  const saltedPassword = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saltedPassword);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Verifica una contraseña contra un hash y salt almacenados.
 * @param {string} password - La contraseña a verificar.
 * @param {string} salt - El salt almacenado.
 * @param {string} hash - El hash almacenado.
 * @returns {boolean} True si la contraseña es correcta, false en caso contrario.
 */
function verifyPassword(password, salt, hash) {
  const newHash = hashPassword(password, salt);
  return newHash === hash;
}