/**
 * Google Sign-In verification.
 *
 * Uses Google's own tokeninfo endpoint rather than verifying the JWT locally.
 * That trades one outbound request per sign-in for not hand-rolling JWKS
 * fetching, key rotation and signature checks - the part of OAuth that is
 * easiest to get subtly, silently wrong. At this app's volume the request is
 * free; revisit only if sign-ins ever get hot enough to matter.
 *
 * ponytail: tokeninfo call per login, cache JWKS locally if volume demands it.
 */
export interface GoogleIdentity {
  email: string;
  name?: string;
}

interface TokenInfo {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  exp?: string;
}

export function isGoogleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google sign-in is not configured');
  if (typeof idToken !== 'string' || idToken.length < 10 || idToken.length > 8000) {
    throw new Error('Invalid Google token');
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!response.ok) throw new Error('Invalid Google token');

  const info = (await response.json()) as TokenInfo;

  // The signature is Google's problem; these three claims are ours. Skipping
  // the audience check is the classic hole: a valid token minted for someone
  // else's app would otherwise sign its bearer in here.
  if (info.aud !== clientId) throw new Error('Invalid Google token');
  if (info.email_verified !== true && info.email_verified !== 'true') {
    throw new Error('Google account has no verified email');
  }
  if (!info.email) throw new Error('Google account has no email');

  return { email: info.email.toLowerCase(), name: info.name };
}
