import { google } from 'googleapis';
import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = join(__dirname, 'token.json');
const CREDENTIALS_PATH = join(__dirname, 'credentials.json');

/**
 * Get and store new token after prompting for user authorization
 */
async function authorize() {
  let credentials;

  try {
    credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8'));
  } catch (err) {
    console.error('Error loading credentials file:', err);
    console.error('\nPlease ensure you have downloaded credentials.json from Google Cloud Console');
    console.error('See SETUP.md for detailed instructions');
    return;
  }

  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token
  try {
    const token = readFileSync(TOKEN_PATH, 'utf8');
    oAuth2Client.setCredentials(JSON.parse(token));
    console.log('✅ Token already exists and is valid!');
    console.log('If you need to re-authorize, delete token.json and run this script again.');
    return;
  } catch (err) {
    // No token exists, get a new one
    return getNewToken(oAuth2Client);
  }
}

/**
 * Get new token by prompting user authorization
 */
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\n🔐 Authorize this app by visiting this URL:\n');
  console.log(authUrl);
  console.log('\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();

      oAuth2Client.getToken(code, (err, token) => {
        if (err) {
          console.error('❌ Error retrieving access token:', err);
          reject(err);
          return;
        }

        oAuth2Client.setCredentials(token);

        // Store the token to disk for later program executions
        try {
          writeFileSync(TOKEN_PATH, JSON.stringify(token));
          console.log('\n✅ Token stored successfully to', TOKEN_PATH);
          console.log('✅ Authorization complete! You can now run the application.');
        } catch (err) {
          console.error('❌ Error saving token:', err);
          reject(err);
          return;
        }

        resolve(oAuth2Client);
      });
    });
  });
}

// Run the authorization
console.log('📅 Google Calendar Authorization Script');
console.log('=====================================\n');

authorize().catch(console.error);
