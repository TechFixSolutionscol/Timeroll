
/*
 * A JavaScript implementation of the SHA256 hash function.
 *
 * FILE:	sha256.js
 * VERSION:	0.8
 * AUTHOR:	Christoph Bichl <christoph.bichl@in.tum.de>
 *
 * Copyright (c) 2003, Christoph Bichl
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

/*
 * Convert a 32-bit number to a hex string with ms-byte first
 */
function tohex(n)
{
  var s = "", v;
  for (var i = 7; i >= 0; i--) { v = (n>>>(i*4))&0f; s += v.toString(16); }
  return s;
}

/*
 * The 32-bit implementation of circular rotate left
 */
function R(x, n)
{
  return (x<<n) | (x>>>(32-n));
}

/*
 * The 32-bit implementation of shift right
 */
function S(x, n)
{
  return x>>>n;
}

/*
 * The 32-bit implementation of the NIST specified Parity function
 */
function P(x, y, z)
{
  return x^y^z;
}

/*
 * The 32-bit implementation of the NIST specified Ch function
 */
function Ch(x, y, z)
{
  return (x&y)^((~x)&z);
}

/*
 * The 32-bit implementation of the NIST specified Maj function
 */
function Maj(x, y, z)
{
  return (x&y)^(x&z)^(y&z);
}

/*
 * The 32-bit implementation of the NIST specified Sigma0 function
 */
function Sigma0(x)
{
  return R(x, 2)^R(x, 13)^R(x, 22);
}

/*
 * The 32-bit implementation of the NIST specified Sigma1 function
 */
function Sigma1(x)
{
  return R(x, 6)^R(x, 11)^R(x, 25);
}

/*
 * The 32-bit implementation of the NIST specified sigma0 function
 */
function sigma0(x)
{
  return R(x, 7)^R(x, 18)^S(x, 3);
}

/*
 * The 32-bit implementation of the NIST specified sigma1 function
 */
function sigma1(x)
{
  return R(x, 17)^R(x, 19)^S(x, 10);
}

/*
 * The core SHA-256 algorithm functions
 */
function sha256_core(message)
{
  var K = new Array(
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2);
  var H = new Array(
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19);

  var m = new Array();
  var i, j, n, l = message.length*8;
  m[l>>5] |= 0x80 << (24 - l % 32);
  m[(((l + 64) >>> 9) << 4) + 15] = l;
  for (i = 0; i < message.length; i++) {
    j = (i>>2); if (!m[j]) m[j] = 0;
    m[j] |= (message.charCodeAt(i)&0xff) << ((3-i%4)*8);
  }

  var w = new Array(64);
  var a, b, c, d, e, f, g, h;
  for (n = 0; n < m.length; n+=16) {
    a = H[0]; b = H[1]; c = H[2]; d = H[3];
    e = H[4]; f = H[5]; g = H[6]; h = H[7];
    for (i = 0; i < 64; i++) {
      if (i < 16) w[i] = m[n+i];
      else w[i] = (sigma1(w[i-2]) + w[i-7] + sigma0(w[i-15]) + w[i-16]) | 0;
      var T1 = (h + Sigma1(e) + Ch(e, f, g) + K[i] + w[i]) | 0;
      var T2 = (Sigma0(a) + Maj(a, b, c)) | 0;
      h = g; g = f; f = e; e = (d + T1) | 0;
      d = c; c = b; b = a; a = (T1 + T2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }

  var hash = "";
  for (i = 0; i < H.length; i++)
    hash += tohex(H[i]);
  return hash;
}
