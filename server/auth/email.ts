/**
 * Transactional email via Resend's REST API.
 *
 * ponytail: plain fetch, no SDK. Sending is one POST, and the SDK is a wrapper
 * around exactly this call. Swap in a provider SDK only if we start needing
 * templates, batching or webhooks.
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function sendLoginCode(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  // Without a provider configured, print the code instead of failing. Sign-in
  // stays usable in local development, and the log line makes it obvious this
  // is not a configuration anyone should ship.
  if (!apiKey || !from) {
    console.warn(`[email] RESEND_API_KEY/EMAIL_FROM not set. Login code for ${to}: ${code}`);
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: `${code} is your sign-in code`,
      // Subject carries the code too, so most people never open the mail.
      text: `Your Turing Test Challenge sign-in code is ${code}.\n\n`
        + `It expires in 10 minutes and can only be used once.\n\n`
        + `If you did not ask to sign in, you can ignore this - nobody can get `
        + `into your account without this code.`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`[email] Resend rejected the send: ${response.status} ${detail}`);
    throw new Error('Could not send the sign-in code');
  }
}
