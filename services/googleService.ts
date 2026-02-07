const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REDIRECT_URI = 'http://localhost:54321/callback';

export const getGoogleAuthUrl = (clientId: string, redirectUri: string, scope: string) => {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope,
        access_type: 'offline',
        prompt: 'consent'
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

export const exchangeGoogleCode = async (clientId: string, clientSecret: string, code: string, redirectUri: string) => {
    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error_description || 'Failed to exchange code');
    }

    return response.json();
};