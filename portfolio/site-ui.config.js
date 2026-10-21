// Which UI the public sees, and the lock for the owner's UI switch.
//
// LIVE_UI: 'classic' (current design) or 'new' (editorial redesign). This is what every visitor gets.
//   It can also be overridden without touching code by a Vercel environment variable LIVE_UI
//   (Project → Settings → Environment Variables), followed by a redeploy.
//
// OWNER_KEY_SHA256: SHA-256 (hex) of the owner key. Only the hash lives in the repo; the key itself
//   is kept privately by the owner. A long random key cannot be recovered from its hash.
//   To rotate: generate a new key, put its SHA-256 here, deploy. Old unlocks stop working at once.
export const LIVE_UI = 'classic';
export const OWNER_KEY_SHA256 = 'e2c588436179aaa5604b816c3ecc3e00fc2ca5d1d4d7fdec62fed3f879e8a00a';
