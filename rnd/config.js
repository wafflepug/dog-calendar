// Release A R&D only. This file contains browser-safe Supabase publishable
// configuration for the dedicated free R&D project. Never place privileged
// credentials in frontend files.
const WAFFLE_RND_AUTH_REDIRECT = 'https://wafflepug.github.io/dog-calendar/rnd-preview/';

window.WAFFLE_RND_CONFIG = Object.freeze({
  environment: 'rnd',
  supabaseUrl: 'https://bzlmqsvueoctrfnjmosq.supabase.co',
  supabaseAnonKey: 'sb_publishable_CENAyc84KUaJl-PyUC9QmQ_9JF1YyKR',
  authRedirectUrl: WAFFLE_RND_AUTH_REDIRECT
});

// The first R&D build predated the hosted preview and inherited Supabase's
// localhost Site URL. Keep the app's existing signUp call compatible while
// forcing every new confirmation email to return to the isolated Pages shell.
const originalCreateClient = window.supabase && window.supabase.createClient;
if (originalCreateClient) {
  window.supabase.createClient = (...args) => {
    const client = originalCreateClient(...args);
    const originalSignUp = client.auth.signUp.bind(client.auth);
    client.auth.signUp = credentials => originalSignUp({
      ...credentials,
      options: {
        ...(credentials && credentials.options ? credentials.options : {}),
        emailRedirectTo: WAFFLE_RND_AUTH_REDIRECT
      }
    });
    return client;
  };
}

function showRndAuthMessage(text, isError = false) {
  const node = document.getElementById('authMessage');
  if (!node) return;
  node.textContent = text;
  node.dataset.kind = isError ? 'error' : 'ok';
}

function installRndConfirmationRecovery() {
  const createAccount = document.getElementById('signUpButton');
  const emailInput = document.getElementById('authEmail');
  if (!createAccount || !emailInput || !originalCreateClient) return;

  let resend = document.getElementById('resendConfirmationButton');
  if (!resend) {
    resend = document.createElement('button');
    resend.id = 'resendConfirmationButton';
    resend.className = 'ghost';
    resend.type = 'button';
    resend.textContent = 'Resend confirmation email';
    createAccount.parentElement.appendChild(resend);
  }

  resend.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) {
      showRndAuthMessage('Enter your email first, then resend the confirmation.', true);
      emailInput.focus();
      return;
    }

    resend.disabled = true;
    showRndAuthMessage('Sending a fresh confirmation email…');
    try {
      const recoveryClient = originalCreateClient(
        window.WAFFLE_RND_CONFIG.supabaseUrl,
        window.WAFFLE_RND_CONFIG.supabaseAnonKey,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      );
      const { error } = await recoveryClient.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: WAFFLE_RND_AUTH_REDIRECT }
      });
      showRndAuthMessage(
        error ? error.message : 'Fresh confirmation email sent. Use the newest email only.',
        Boolean(error)
      );
    } catch (error) {
      showRndAuthMessage(error && error.message ? error.message : String(error), true);
    } finally {
      resend.disabled = false;
    }
  });

  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (hash.get('error_code') === 'otp_expired') {
    showRndAuthMessage('That confirmation link has expired or was already used. Enter your email and choose “Resend confirmation email”.', true);
    history.replaceState(null, '', location.pathname + location.search);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installRndConfirmationRecovery, { once: true });
} else {
  installRndConfirmationRecovery();
}

// When the R&D shell is hosted under the production Pages origin, install a
// narrower pass-through service worker so the production Waffle PWA worker
// cannot cache, rewrite, or offline-fallback this isolated preview path.
if ('serviceWorker' in navigator && /\/rnd-preview\//.test(location.pathname)) {
  navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(error => {
    console.warn('R&D preview isolation worker could not be registered:', error);
  });
}
