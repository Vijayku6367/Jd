// api/login.js
// Accepts Instagram credentials, logs in via internal web API, returns session cookies.

const fetch = require('node-fetch');

// Instagram login endpoint (unofficial, mimics web app)
const LOGIN_URL = 'https://www.instagram.com/api/v1/web/accounts/login/ajax/';

module.exports = async (req, res) => {
  // CORS for our frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    // Generate random device ID to avoid detection
    const deviceId = 'android-' + Math.random().toString(36).substring(2, 15);

    // Step 1: Get CSRF token from Instagram's homepage
    const homeRes = await fetch('https://www.instagram.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
      }
    });
    const homeBody = await homeRes.text();
    const csrfMatch = homeBody.match(/csrftoken":"([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';
    const cookies = homeRes.headers.raw()['set-cookie']
      .map(c => c.split(';')[0])
      .join('; ');

    // Step 2: Perform login
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('enc_password', '#PWD_INSTAGRAM_BROWSER:0:' + Date.now() + ':' + password);
    formData.append('queryParams', '{}');
    formData.append('optIntoOneTap', 'false');
    formData.append('stopDeletionNonce', '');
    formData.append('trustedDeviceRecords', '{}');
    formData.append('device_id', deviceId);

    const loginRes = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRFToken': csrfToken,
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
      },
      body: formData.toString(),
      redirect: 'manual'
    });

    const loginJson = await loginRes.json();

    if (loginJson.authenticated) {
      // Extract vital cookies from the response headers
      const authCookies = loginRes.headers.raw()['set-cookie']
        .map(c => c.split(';')[0])
        .concat(cookies)
        .join('; ');

      const sessionId = (authCookies.match(/sessionid=([^;]+)/) || [])[1];
      const dsUserId = (authCookies.match(/ds_user_id=([^;]+)/) || [])[1];
      const newCsrf = loginJson.csrftoken || csrfToken;

      return res.status(200).json({
        status: 'ok',
        cookies: {
          sessionid: sessionId,
          ds_user_id: dsUserId,
          csrftoken: newCsrf,
          raw: authCookies // full cookie string
        },
        userId: loginJson.userId
      });
    } else {
      return res.status(401).json({
        error: 'Login failed',
        message: loginJson.message || 'Check credentials / 2FA'
      });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
};
