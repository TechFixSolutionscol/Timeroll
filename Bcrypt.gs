// Forked from https://github.com/dpw/bcrypt-google-apps-script
// Originally from https://github.com/dcodeIO/bcrypt.js
var bcrypt = (function() {
    "use strict";

    /**
     * @alias bcrypt
     * @namespace
     */
    var bcrypt = {};

    /**
     * The bcrypt namespace.
     * @type {Object}
     */
    bcrypt.bcrypt = bcrypt;

    /**
     * bcrypt's salt length in bytes.
     * @type {number}
     */
    bcrypt.SALT_LENGTH = 16;

    /**
     * bcrypt's pseudo random number generator.
     * @type {function(number):!Array.<number>}
     */
    bcrypt.random = null;

    var
        // Pre-calculated expensive Blowfish constants
        p_orig,
        s_orig,
        // Initial state
        p_init,
        s_init,
        // Key derivation state
        p_key,
        s_key,
        // Expensive key schedule state
        p_exp,
        s_exp;

    var
        // Major version
        MAJOR = "2",
        // Minor version
        MINOR = "a";

    /**
     * Caches the original Blowfish constants.
     * @inner
     */
    function cacheConstants() {
        if (p_orig)
            return;
        p_orig = new Uint32Array(18);
        s_orig = new Uint32Array(4*256);
        var i = 0, j;
        for (j=0; j<p_orig.length; ++j)
            p_orig[j] = parseInt(constants[i++], 16);
        for (j=0; j<s_orig.length; ++j)
            s_orig[j] = parseInt(constants[i++], 16);
    }

    /**
     * Resets the scheduled subkeys.
     * @inner
     */
    function resetScheduledSubkeys() {
        cacheConstants();
        if (!p_init) {
            p_init = new Uint32Array(p_orig);
            s_init = new Uint32Array(s_orig);
        }
        p_key = new Uint32Array(p_init);
        s_key = new Uint32Array(s_init);
        p_exp = new Uint32Array(p_init);
        s_exp = new Uint32Array(s_init);
    }

    /**
     * Converts a string to UTF8 bytes.
     * @param {string} s String
     * @returns {!Array.<number>} UTF8 bytes
     * @inner
     */
    function stringToBytes(s) {
        var bytes = [], i=0;
        for (i=0; i<s.length; ++i) {
            var c = s.charCodeAt(i);
            if (c < 128)
                bytes.push(c);
            else if (c < 2048)
                bytes.push(192 | c>>6, 128 | c&63);
            else if (c < 55296 || c >= 57344)
                bytes.push(224 | c>>12, 128 | c>>6&63, 128 | c&63);
            else
                bytes.push(240 | (c = 0x10000 + ((c&1023)<<10 | s.charCodeAt(++i)&1023))>>18, 128 | c>>12&63, 128 | c>>6&63, 128 | c&63);
        }
        return bytes;
    }

    /**
     * Converts UTF8 bytes to a string.
     * @param {!Array.<number>} bytes UTF8 bytes
     * @returns {string} String
     * @inner
     */
    function bytesToString(bytes) {
        var s = [], i=0;
        for (i=0; i<bytes.length; ++i)
            s.push(String.fromCharCode(bytes[i]));
        return s.join('');
    }

    var base64_code = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var base64_reverse;

    /**
     * Encodes a byte array to base64.
     * @param {!Array.<number>} b Byte array
     * @param {number} len Maximum number of bytes to encode
     * @returns {string} Base64 encoded string
     * @inner
     */
    function base64_encode(b, len) {
        if (!base64_reverse) {
            base64_reverse = {};
            for (var i=0; i<base64_code.length; ++i)
                base64_reverse[base64_code.charAt(i)] = i;
        }
        var off = 0,
            rs = [],
            c1, c2;
        if (len <= 0 || len > b.length)
            throw Error("len out of range: "+len);
        while (off < len) {
            c1 = b[off++] & 0xff;
            rs.push(base64_code.charAt(c1 >> 2));
            c1 = (c1 & 0x03) << 4;
            if (off >= len) {
                rs.push(base64_code.charAt(c1));
                break;
            }
            c2 = b[off++] & 0xff;
            c1 |= c2 >> 4;
            rs.push(base64_code.charAt(c1));
            c1 = (c2 & 0x0f) << 2;
            if (off >= len) {
                rs.push(base64_code.charAt(c1));
                break;
            }
            c2 = b[off++] & 0xff;
            c1 |= c2 >> 6;
            rs.push(base64_code.charAt(c1));
            rs.push(base64_code.charAt(c2 & 0x3f));
        }
        return rs.join('');
    }

    /**
     * Decodes a base64 encoded string to a byte array.
     * @param {string} s Base64 encoded string
     * @param {number} maxLen Maximum number of bytes to decode
     * @returns {!Array.<number>} Byte array
     * @throws {Error} If a character is not valid base64
     * @inner
     */
    function base64_decode(s, maxLen) {
        if (!base64_reverse) {
            base64_reverse = {};
            for (var i=0; i<base64_code.length; ++i)
                base64_reverse[base64_code.charAt(i)] = i;
        }
        var off = 0,
            slen = s.length,
            olen = 0,
            rs = [],
            c1, c2, c3, c4, o;
        if (maxLen <= 0)
            throw Error("maxLen out of range: "+maxLen);
        while (off < slen - 1 && olen < maxLen) {
            c1 = base64_reverse[s.charAt(off++)];
            c2 = base64_reverse[s.charAt(off++)];
            if (c1 === undefined || c2 === undefined)
                throw Error("invalid base64 character");
            o = c1 << 2 | c2 >> 4;
            rs.push(o);
            if (++olen >= maxLen)
                break;
            c3 = base64_reverse[s.charAt(off++)];
            if (c3 === undefined)
                throw Error("invalid base64 character");
            o = (c2 & 0x0f) << 4 | c3 >> 2;
            rs.push(o);
            if (++olen >= maxLen)
                break;
            c4 = base64_reverse[s.charAt(off++)];
            if (c4 === undefined)
                throw Error("invalid base64 character");
            o = (c3 & 0x03) << 6 | c4;
            rs.push(o);
            ++olen;
        }
        return rs;
    }

    /**
     * Blowfish encipher a single 64-bit block.
     * @param {!Array.<number>} lr
     * @param {number} off
     * @param {!Array.<number>} p
     * @param {!Array.<number>} s
     * @inner
     */
    function encipher(lr, off, p, s) {
        var i, n, l = lr[off], r = lr[off+1];
        l ^= p[0];
        for (i=0; i<16; i+=2) {
            n = s[(l >> 24) & 0xff];
            n += s[0x100 | ((l >> 16) & 0xff)];
            n ^= s[0x200 | ((l >> 8) & 0xff)];
            n += s[0x300 | (l & 0xff)];
            r ^= n ^ p[i+1];
            n = s[(r >> 24) & 0xff];
            n += s[0x100 | ((r >> 16) & 0xff)];
            n ^= s[0x200 | ((r >> 8) & 0xff)];
            n += s[0x300 | (r & 0xff)];
            l ^= n ^ p[i+2];
        }
        lr[off] = r ^ p[17];
        lr[off+1] = l;
    }

    /**
     * Schedules the subkeys required by the Blowfish cipher.
     * @param {!Array.<number>} key
     * @param {!Array.<number>} p
     * @param {!Array.<number>} s
     * @inner
     */
    function key(key, p, s) {
        var i, j, k,
            lr = [0, 0];
        for (i=0; i<18; ++i)
            p[i] ^= (key[(i*4)%key.length] & 0xff) | ((key[(i*4+1)%key.length] & 0xff) << 8) | ((key[(i*4+2)%key.length] & 0xff) << 16) | ((key[(i*4+3)%key.length] & 0xff) << 24);

        for (i=0; i<18; i+=2) {
            encipher(lr, 0, p, s);
            p[i] = lr[0];
            p[i+1] = lr[1];
        }
        for (i=0; i<4; ++i) {
            for (j=0; j<256; j+=2) {
                encipher(lr, 0, p, s);
                s[i*256+j] = lr[0];
                s[i*256+j+1] = lr[1];
            }
        }
    }

    /**
     * Performs an expensive key schedule.
     * @param {!Array.<number>} data
     * @param {!Array.<number>} salt
     * @param {!Array.<number>} p
     * @param {!Array.<number>} s
     * @inner
     */
    function ekskey(data, salt, p, s) {
        key(salt, p, s);
        key(data, p, s);
    }

    /**
     * Calculates the Blowfish hash of a password and salt.
     * @param {!Array.<number>} password Password bytes
     * @param {!Array.<number>} salt Salt bytes
     * @param {number} cost Log2 of the number of rounds
     * @param {function(!Array.<number>)} callback Callback getting the hash bytes
     * @inner
     */
    function crypt(password, salt, cost, callback) {
        resetScheduledSubkeys();

        ekskey(password, salt, p_key, s_key);

        var rounds = 1 << cost;
        var i, j=0;
        for (i=0; i<rounds; ++i) {
            key(password, p_exp, s_exp);
            key(salt, p_exp, s_exp);
        }

        var data = new Uint32Array([0x4f727068, 0x65616e42, 0x65617574, 0x79466973, 0x6842616e, 0x67486173, 0x684b6579, 0x00000000]); // "OrpheanBeatyFishBangHashKey"
        var clen = data.length/2;
        for (i=0; i<64; ++i) {
            for (j=0; j<clen; j+=2)
                encipher(data, j, p_exp, s_exp);
        }

        var hash = new Array(clen*4);
        var off = 0;
        for (i=0; i<clen; ++i) {
            hash[off++] = (data[i] >> 24) & 0xff;
            hash[off++] = (data[i] >> 16) & 0xff;
            hash[off++] = (data[i] >> 8) & 0xff;
            hash[off++] = data[i] & 0xff;
        }
        callback(hash);
    }

    /**
     * Generates a salt.
     * @param {number} cost Log2 of the number of rounds
     * @param {function(string)} callback Callback getting the salt
     */
    bcrypt.genSalt = function(cost, callback) {
        var salt = [];
        for (var i=0; i<bcrypt.SALT_LENGTH; ++i)
            salt.push(Math.floor(Math.random()*256)); // FIXME: Is this cryptographically secure?
        var s = "";
        s += "$";
        s += MAJOR;
        s += MINOR;
        s += "$";
        if (cost < 10)
            s += "0";
        s += cost;
        s += "$";
        s += base64_encode(salt, salt.length);
        callback(s);
    };

    /**
     * Hashes a password.
     * @param {string} s Password
     * @param {string} salt Salt to hash with
     * @param {function(string)} callback Callback getting the hash
     * @throws {Error} If the salt is invalid
     */
    bcrypt.hash = function(s, salt, callback) {
        if (typeof salt === 'function') {
            callback = salt;
            salt = undefined;
        }
        if (typeof salt === 'number')
            salt = bcrypt.genSaltSync(salt);
        if (typeof salt === 'undefined') {
            bcrypt.genSalt(10, function(newSalt) {
                bcrypt.hash(s, newSalt, callback);
            });
            return;
        }
        var re = new RegExp("^\\$"+MAJOR+"([abx])?\\$([0-9]{2})\\$");
        var match = salt.match(re);
        if (!match)
            throw Error("invalid salt");
        var cost = parseInt(match[2], 10);
        var minor = match[1] || "";
        var salt_bytes = base64_decode(salt.substring(salt.lastIndexOf("$")+1), 16);
        var s_bytes = stringToBytes(s+(minor === "a" ? "\0" : ""));
        crypt(s_bytes, salt_bytes, cost, function(hash) {
            var ret = "";
            ret += "$";
            ret += MAJOR;
            ret += minor;
            ret += "$";
            if (cost < 10)
                ret += "0";
            ret += cost;
            ret += "$";
            ret += base64_encode(hash, salt_bytes.length*4);
            callback(ret);
        });
    };

    /**
     * Compares a password against a hash.
     * @param {string} s Password
     * @param {string} hash Hash
     * @param {function(boolean)} callback Callback getting the result
     * @throws {Error} If the hash is invalid
     */
    bcrypt.compare = function(s, hash, callback) {
        bcrypt.hash(s, hash, function(newHash) {
            callback(hash === newHash);
        });
    };

    // Synchronous variants

    /**
     * Generates a salt synchronously.
     * @param {number=} cost Log2 of the number of rounds. Default: 10
     * @returns {string} Salt
     */
    bcrypt.genSaltSync = function(cost) {
        cost = cost || 10;
        var salt_bytes = [];
        for (var i=0; i<bcrypt.SALT_LENGTH; ++i)
            salt_bytes.push(Math.floor(Math.random()*256)); // FIXME: Is this cryptographically secure?
        var s = "";
        s += "$";
        s += MAJOR;
        s += MINOR;
        s += "$";
        if (cost < 10)
            s += "0";
        s += cost;
        s += "$";
        s += base64_encode(salt_bytes, salt_bytes.length);
        return s;
    };

    /**
     * Hashes a password synchronously.
     * @param {string} s Password
     * @param {string|number=} salt Salt to hash with. Default: 10
     * @returns {string} Hash
     * @throws {Error} If the salt is invalid
     */
    bcrypt.hashSync = function(s, salt) {
        salt = salt || 10;
        if (typeof salt === 'number')
            salt = bcrypt.genSaltSync(salt);
        var hash;
        bcrypt.hash(s, salt, function(ret) {
            hash = ret;
        });
        return hash;
    };

    /**
     * Compares a password against a hash synchronously.
     * @param {string} s Password
     * @param {string} hash Hash
     * @returns {boolean}
     * @throws {Error} If the hash is invalid
     */
    bcrypt.compareSync = function(s, hash) {
        var comp;
        bcrypt.compare(s, hash, function(ret) {
            comp = ret;
        });
        return comp;
    };

    // Blowfish constants
    var constants = [
        "243f6a88", "85a308d3", "13198a2e", "03707344", "a4093822", "299f31d0", "082efa98", "ec4e6c89",
        "452821e6", "38d01377", "be5466cf", "34e90c6c", "c0ac29b7", "c97c50dd", "3f84d5b5", "b5470917",
        "9216d5d9", "8979fb1b", "d1310ba6", "98dfb5ac", "2ffd72db", "d01adfb7", "b8e1afed", "6a267e96",
        "ba7c9045", "f12c7f99", "24a19947", "b3916cf7", "0801f2e2", "858efc16", "636920d8", "71574e69",
        "a458fea3", "f4933d7e", "0d95748f", "728eb658", "718bcd58", "82154aee", "7b54a41d", "c25a59b5",
        "9c30d539", "2af26013", "c5d1b023", "286085f0", "ca417918", "b8db38ef", "8e79dcb0", "603a180e",
        "6c9e0e8b", "b01e8a3e", "d71577c1", "bd314b27", "78af2fda", "55605c60", "e65525f3", "aa55ab94",
        "57489862", "63e81440", "55ca396a", "2aab10b6", "b4cc5c34", "1141e8ce", "a15486af", "7c72e993",
        ...
    ];

    return bcrypt;
})();
