// One-time: node scripts/gen-license-key.mjs
// Prints (1) the PRIVATE key -> put in Vercel env PLUS_PRIVATE_JWK (keep secret, never commit)
//        (2) the PUBLIC key  -> paste into index.html as PLUS_PUBKEY_JWK
import crypto from "crypto";
const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
console.log("PLUS_PRIVATE_JWK (secret, Vercel env):\n" + JSON.stringify(privateKey.export({ format: "jwk" })) + "\n");
console.log("PLUS_PUBKEY_JWK (public, index.html):\n" + JSON.stringify(publicKey.export({ format: "jwk" })) + "\n");
