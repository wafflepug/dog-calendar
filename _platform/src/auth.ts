import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export type VerifiedIdentity = { uid: string; email?: string; email_verified: boolean };
export type TokenVerifierOptions = { projectId: string; emulatorHost?: string; mode: 'local' | 'production' };

/** Creates a Firebase Admin verifier. Emulator use is explicitly development-only. */
export function createTokenVerifier({ projectId, emulatorHost, mode }: TokenVerifierOptions) {
  if (!projectId || !/^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw new Error('A valid Firebase projectId is required');
  const configuredEmulator = emulatorHost ?? process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (mode === 'production' && configuredEmulator) {
    throw new Error('Firebase Auth emulator verification is forbidden in production');
  }
  if (configuredEmulator) {
    if (mode !== 'local' || !projectId.startsWith('demo-') || !/^(localhost|127\.0\.0\.1):\d{1,5}$/.test(configuredEmulator)) {
      throw new Error('Firebase Auth emulator host must be a local development endpoint');
    }
    const port = Number(configuredEmulator.slice(configuredEmulator.lastIndexOf(':') + 1));
    if (port < 1 || port > 65535) throw new Error('Firebase Auth emulator host must include a valid port');
    process.env.FIREBASE_AUTH_EMULATOR_HOST = configuredEmulator;
  }
  const app = getApps().find((candidate) => candidate.options.projectId === projectId)
    ?? initializeApp({ credential: applicationDefault(), projectId }, `api-${projectId}`);
  const auth = getAuth(app);
  return async (token: string): Promise<VerifiedIdentity> => {
    const decoded = await auth.verifyIdToken(token, true);
    if (decoded.aud !== projectId || decoded.iss !== `https://securetoken.google.com/${projectId}` || !decoded.uid) {
      throw new Error('Invalid identity token');
    }
    return { uid: decoded.uid, email: decoded.email, email_verified: decoded.email_verified === true };
  };
}
