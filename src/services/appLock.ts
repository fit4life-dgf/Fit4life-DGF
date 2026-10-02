/**
 * App lock using the device's own biometrics (fingerprint, Face ID / face unlock, or screen PIN)
 * through the WebAuthn platform authenticator. Nothing biometric ever reaches the app or server:
 * the device only answers "the owner verified". This locks the UI on this device; it does not
 * replace the Supabase sign-in.
 */
const key = (uid: string) => `f4l_lock_${uid}`
const enc = (s: string) => new TextEncoder().encode(s)
const toB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export async function lockSupported(): Promise<boolean> {
  try {
    if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}

export function lockEnabled(uid: string): boolean {
  try { return !!localStorage.getItem(key(uid)) } catch { return false }
}

export async function enableLock(uid: string, name: string): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'FIT4LIFE' },
      user: { id: enc(uid), name, displayName: name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('Biometric setup was cancelled.')
  localStorage.setItem(key(uid), toB64(cred.rawId))
}

export function disableLock(uid: string) {
  try { localStorage.removeItem(key(uid)) } catch { /* ignore */ }
}

/** Resolves true only when the device confirms the owner (fingerprint / face / PIN). */
export async function unlock(uid: string): Promise<boolean> {
  try {
    const id = localStorage.getItem(key(uid))
    if (!id) return true
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: fromB64(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    return !!res
  } catch { return false }
}
