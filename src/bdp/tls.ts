import { X509Certificate } from "node:crypto";
import http from "node:http";
import tls from "node:tls";

/**
 * bdp.giustizia.it does not send the intermediate that issued its certificate,
 * so Node (which, unlike browsers, never downloads missing intermediates) rejects
 * the connection with UNABLE_TO_VERIFY_LEAF_SIGNATURE.
 *
 * This is that intermediate: "Telecom Italia Trust Technologies RSA OV SSL CA 2",
 * issued by "Sectigo Public Server Authentication Root R46", valid until 2035-11-05.
 * Source: http://crt.sectigo.com/TelecomItaliaTrustTechnologiesRSAOVSSLCA2.crt
 * SHA-256: E8:02:61:13:A7:B2:5D:37:F6:2C:A0:2E:D4:70:A2:E9:D0:57:FB:58:6F:70:B1:09:BE:B9:AB:6C:38:AB:FA:BE
 *
 * Adding it to `ca` grants no trust by itself: OpenSSL still requires the chain to
 * end at a self-signed root in Node's store.
 */
const TELECOM_ITALIA_OV_CA_2 = `-----BEGIN CERTIFICATE-----
MIIGVzCCBD+gAwIBAgIRAOEaor0opVcJSpYtqC32c3kwDQYJKoZIhvcNAQEMBQAw
XzELMAkGA1UEBhMCR0IxGDAWBgNVBAoTD1NlY3RpZ28gTGltaXRlZDE2MDQGA1UE
AxMtU2VjdGlnbyBQdWJsaWMgU2VydmVyIEF1dGhlbnRpY2F0aW9uIFJvb3QgUjQ2
MB4XDTI1MTEwNjAwMDAwMFoXDTM1MTEwNTIzNTk1OVowfDELMAkGA1UEBhMCSVQx
MTAvBgNVBAoTKFRlbGVjb20gSXRhbGlhIFRydXN0IFRlY2hub2xvZ2llcyBTLlIu
TC4xOjA4BgNVBAMTMVRlbGVjb20gSXRhbGlhIFRydXN0IFRlY2hub2xvZ2llcyBS
U0EgT1YgU1NMIENBIDIwggGiMA0GCSqGSIb3DQEBAQUAA4IBjwAwggGKAoIBgQCP
JNr8iA8Esw+1j+Iq8a3bQqv8IPqTzkcZHteLWExwJudhTzwF5P05liJ0OyUuIKXs
ulAVUoaYdtvM1LckJwPRqyHSwuWGzIetcXY5zE/wayn2HYhUZi38s9MNv5GKfxpT
q9XrD//aZgTo/AsTfXOtcEe0pmODYUYoUDcUMtUw7Ug188zvmCGLd/CSuKdEDvYf
+5twsHULhrlm4JyLocW/Bv/3axhdr0AH4aLMahgSQnTD+NaYiS1qZ/yolZnLUj0e
yalPxhNWoRWx1YlXruOt5klXyAiOyePJdEzwEcuuZ3orqsDAmhCFzXrHCz+dAJP5
mxgsO6mRu5Twgi5wqFVUCuCXNZzisiIvGMiVoPnckA8onkvghk737yz1PAeXUZTX
3ylrQfzuR5cSPrKd1jQ/Y/RfrxeLg6LO9y6kqx17kWIJVVfCEDN4vAADIuq96deN
uMzLnOZVuwbTm0NsYQ7C+9l7SOPckRLi3e3jxpClBXt2LC0TBBFRgSAGwjT0SwcC
AwEAAaOCAW8wggFrMB8GA1UdIwQYMBaAFFZzWGSV+ZIasBIqBGJ5oUAViCFJMB0G
A1UdDgQWBBTSLPRdh/MlkFzlt5kXtNXRQBDlOTAOBgNVHQ8BAf8EBAMCAYYwEgYD
VR0TAQH/BAgwBgEB/wIBADATBgNVHSUEDDAKBggrBgEFBQcDATATBgNVHSAEDDAK
MAgGBmeBDAECAjBUBgNVHR8ETTBLMEmgR6BFhkNodHRwOi8vY3JsLnNlY3RpZ28u
Y29tL1NlY3RpZ29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYuY3Js
MIGEBggrBgEFBQcBAQR4MHYwTwYIKwYBBQUHMAKGQ2h0dHA6Ly9jcnQuc2VjdGln
by5jb20vU2VjdGlnb1B1YmxpY1NlcnZlckF1dGhlbnRpY2F0aW9uUm9vdFI0Ni5w
N2MwIwYIKwYBBQUHMAGGF2h0dHA6Ly9vY3NwLnNlY3RpZ28uY29tMA0GCSqGSIb3
DQEBDAUAA4ICAQA8zowmm8V5cSb7wEjAh+Jo5tc9+p2f88mUUj/kCij6q3HKZeuN
0Fh9lyTC3nooYFkQLeiFC24XSQTl74hnmm/dzBh+W2uFwc187ZxuKTvyaUb5srDl
IGFX3pOzJo4TYQGNjOQ48CairQQad6/JZB2S8mCXSbsuM2hDJbJPCa+/b5Sz68G6
F/OzYdHfhtv2zOM4/An1KgYT+7hYGOA9r8UclMr+XCxBGfludRKcJ/onGuPMaSJr
ke+16SUd6S9r5lrwQBkbdMHZURzOq+CopRCwFTwQsp6H71Ytu6507/albiYO6i4w
c9nekeKxVDy5L08AbiB/nJz40uentKvVY+PM0zq5UOp9nS4AFy4fooTKiBMjTk4M
MNNJs1RV9GjlacbDMp3UDNxCVRDzkyyhjD1j68tVh2ZrkHmlLI/YdyL+0CdH80PP
TluG3uj9Vm0cilR7QlnRXXvb5tjjm3+Kg1sXsUDu/eeDUUNumnWtyUmSDrxh8iqs
b2Bdec5d5S95vZ2L6HEGLTwcQuadmxdMidhYeIzH00Zdg1bh25gy7A8puF5hhors
J3A5yJDI+B7OIaUGJpVbiLpKW2h5QeZoyyEVZRvntpVXqYPLt+HYzhoOZ5G2F8eL
5d+hGwQ1z6JXpZw2SgoAYu4TjTPGDUOGmHSJWFnvIMFEdevou6yKYTXs6g==
-----END CERTIFICATE-----
`;

const extraIntermediates: string[] = [TELECOM_ITALIA_OV_CA_2];

/**
 * Node's default trust list, including NODE_EXTRA_CA_CERTS and, with
 * --use-system-ca, the OS store (needed behind TLS-inspecting proxies).
 * `getCACertificates` exists from Node 22.15; older 22.x fall back to the bundled roots.
 */
const trustedRoots = (): readonly string[] =>
  typeof tls.getCACertificates === "function" ? tls.getCACertificates("default") : tls.rootCertificates;

export const caBundle = (): string[] => [...trustedRoots(), ...extraIntermediates];

export const isMissingIntermediateError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE";

const AIA_TIMEOUT_MS = 10_000;
/** A certificate is a few kilobytes; the URL comes from an unverified peer, so cap what we read. */
const AIA_MAX_BYTES = 64 * 1024;

const fetchDer = (url: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: AIA_TIMEOUT_MS }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`AIA ${url}: HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > AIA_MAX_BYTES) {
          req.destroy(new Error(`AIA ${url}: oltre ${AIA_MAX_BYTES} byte`));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    const deadline = setTimeout(() => req.destroy(new Error(`AIA ${url}: timeout`)), AIA_TIMEOUT_MS);
    req.on("close", () => clearTimeout(deadline));
    req.on("timeout", () => req.destroy(new Error(`AIA ${url}: timeout`)));
    req.on("error", reject);
  });

const peerLeaf = (host: string): Promise<X509Certificate> =>
  new Promise((resolve, reject) => {
    // Unverified on purpose: this connection only reads the leaf's issuer URL and
    // sends nothing. Anything learnt from it must pass `signedByTrustedRoot`.
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
      const raw = socket.getPeerCertificate().raw;
      socket.end();
      resolve(new X509Certificate(raw));
    });
    socket.setTimeout(AIA_TIMEOUT_MS, () => socket.destroy(new Error(`${host}: TLS timeout`)));
    socket.on("error", reject);
  });

/**
 * A certificate in `ca` can act as a trust anchor, so a downloaded intermediate is
 * accepted only when a root already in Node's store signed it. Otherwise a
 * man-in-the-middle could serve a self-signed "intermediate" and be trusted.
 */
const signedByTrustedRoot = (intermediate: X509Certificate): boolean =>
  intermediate.ca &&
  intermediate.issuer !== intermediate.subject &&
  trustedRoots().some((pem) => {
    const root = new X509Certificate(pem);
    return intermediate.checkIssued(root) && intermediate.verify(root.publicKey);
  });

/**
 * When BDP renews its certificate under a different intermediate, download that
 * intermediate from the URL in the leaf (Authority Information Access), as browsers
 * do. Returns false when nothing new could be added.
 */
export const learnIntermediateFromAia = async (host: string): Promise<boolean> => {
  const leaf = await peerLeaf(host);
  const url = leaf.infoAccess
    ?.split("\n")
    .find((line) => line.startsWith("CA Issuers - URI:"))
    ?.slice("CA Issuers - URI:".length);
  // CAs publish AIA certificates over plain HTTP; the signature check below is what makes them safe.
  if (!url?.startsWith("http://")) return false;

  const intermediate = new X509Certificate(await fetchDer(url));
  if (!leaf.checkIssued(intermediate) || !leaf.verify(intermediate.publicKey)) return false;
  if (!signedByTrustedRoot(intermediate)) return false;

  const pem = intermediate.toString();
  if (extraIntermediates.includes(pem)) return false;
  extraIntermediates.push(pem);
  return true;
};
