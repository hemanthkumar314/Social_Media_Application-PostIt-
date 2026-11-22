// No dependencies, persistent keys, or request/credential logging.
// The runtime supplies a short-lived API key with only users.read.
export function createHandler({endpoint, projectId, fetchImpl = fetch}) {
  return async ({req, res}) => {
    const reply = (body, status = 200) => res.json(body, status, {'cache-control': 'no-store'});
    if (req.method !== 'POST') return reply({message: 'Method not allowed.'}, 405);
    let body;
    try { body = JSON.parse(req.bodyText); }
    catch { return reply({message: 'Invalid request.'}, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({message: 'Invalid request.'}, 400);
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    if (!/^[a-z0-9_]{2,32}$/.test(username) || !['availability', 'login'].includes(body.action)) {
      return reply({message: 'Invalid request.'}, 400);
    }
    if (body.action === 'login' && (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 256)) {
      return reply({message: 'Invalid username or password.'}, 401);
    }
    try {
      const adminHeaders = {'X-Appwrite-Project': projectId, 'X-Appwrite-Key': req.headers['x-appwrite-key']};
      const options = {headers: adminHeaders, signal: AbortSignal.timeout(12000)};
      const found = await fetchImpl(`${endpoint}/users/u_${username}`, options);
      let user;
      if (found.ok) user = await found.json();
      else if (found.status === 404) {
        // Compatibility with the earlier username-only accounts, which used random IDs.
        const url = new URL(`${endpoint}/users`);
        url.searchParams.append('queries[]', JSON.stringify({method: 'equal', attribute: 'name', values: [username]}));
        url.searchParams.append('queries[]', JSON.stringify({method: 'limit', values: [2]}));
        const legacy = await fetchImpl(url, options);
        if (!legacy.ok) throw new Error('Lookup unavailable');
        const users = (await legacy.json()).users;
        user = users.find(item => item.prefs?.username === username);
      } else throw new Error('Lookup unavailable');
      if (body.action === 'availability') return reply({available: !user});
      if (!user || !user.status) return reply({message: 'Invalid username or password.'}, 401);

      // Never use the privileged key for password authentication. Appwrite validates
      // the password and applies its native email/password endpoint rate limits.
      const sessionResponse = await fetchImpl(`${endpoint}/account/sessions/email`, {
        method: 'POST', headers: {'X-Appwrite-Project': projectId, 'Content-Type': 'application/json'},
        body: JSON.stringify({email: user.email, password: body.password}), signal: AbortSignal.timeout(12000),
      });
      if (!sessionResponse.ok) return reply({message: sessionResponse.status === 429 ? 'Try again later.' : 'Invalid username or password.'}, sessionResponse.status === 429 ? 429 : 401);
      const cookieName = `a_session_${projectId}`;
      const fallback = sessionResponse.headers.get('x-fallback-cookies');
      let session = fallback ? JSON.parse(fallback)[cookieName] : '';
      if (!session) {
        const cookies = sessionResponse.headers.get('set-cookie') ?? '';
        const match = cookies.match(new RegExp(`(?:^|,\\s*)${cookieName}=([^;,]+)`));
        session = match?.[1] ?? '';
      }
      if (!session) throw new Error('Session unavailable');
      // Return only the authenticated session. Never return the private email,
      // full Auth user, API key, or upstream error body.
      return reply({session});
    } catch {
      return reply({message: 'Authentication is temporarily unavailable.'}, 503);
    }
  };
}

export default async function main(context) {
  const handler = createHandler({
    endpoint: process.env.APPWRITE_FUNCTION_API_ENDPOINT,
    projectId: process.env.APPWRITE_FUNCTION_PROJECT_ID,
  });
  return handler(context);
}
