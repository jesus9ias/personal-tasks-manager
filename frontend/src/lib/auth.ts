const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN as string;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_COGNITO_REDIRECT_URI as string;

interface TokenSet {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const TOKEN_KEY = 'auth_tokens';

function loadTokens(): TokenSet | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as TokenSet) : null;
  } catch {
    return null;
  }
}

function saveTokens(tokens: TokenSet): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
}

let tokenSet: TokenSet | null = loadTokens();

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function signIn(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid email profile',
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.href = `${COGNITO_DOMAIN}/oauth2/authorize?${params}`;
}

export async function handleCallback(code: string): Promise<void> {
  const verifier = sessionStorage.getItem('pkce_verifier');
  if (!verifier) throw new Error('Missing PKCE verifier');

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)');
    throw new Error(`Token exchange failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  tokenSet = {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  saveTokens(tokenSet);
  sessionStorage.removeItem('pkce_verifier');
}

async function refreshTokens(): Promise<void> {
  if (!tokenSet?.refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: tokenSet.refreshToken,
    }),
  });

  if (!res.ok) {
    tokenSet = null;
    clearTokens();
    throw new Error('Refresh failed');
  }

  const data = await res.json();
  tokenSet = {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: tokenSet.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  saveTokens(tokenSet);
}

export async function getIdToken(): Promise<string> {
  if (!tokenSet) throw new Error('Not authenticated');
  if (Date.now() > tokenSet.expiresAt - 60_000) {
    await refreshTokens();
  }
  return tokenSet!.idToken;
}

export function isAuthenticated(): boolean {
  return tokenSet !== null;
}

export function signOut(): void {
  tokenSet = null;
  clearTokens();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: REDIRECT_URI,
  });
  window.location.href = `${COGNITO_DOMAIN}/logout?${params}`;
}
