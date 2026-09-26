const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID || 'SEU_CLIENT_ID_AQUI';
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || 'SEU_CLIENT_SECRET_AQUI';
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Send-only: the backend only ever calls gmail.users.messages.send, so it
// never needs the full mailbox access of https://mail.google.com/. That
// broader scope is classified by Google as "restricted", which unverified
// apps handle far less reliably (more prone to unexpected token revocation)
// than this narrower "sensitive" scope.
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

console.log('\nAbra esta URL, autorize a conta Gmail, e cole o código retornado:\n');
console.log(authUrl);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('\nCódigo: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\nRefresh Token:\n', tokens.refresh_token);
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    rl.close();
  }
});
