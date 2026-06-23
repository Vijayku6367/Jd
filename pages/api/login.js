import axios from 'axios';

// Instagram login function using the official API
async function instagramLogin(username, password) {
  const csrftoken = getCsrfToken();
  const headers = {
    'User-Agent': 'Instagram 219.0.0.0.117 Android',
    'X-IG-Capabilities': '3brTvw8=',
    'X-IG-Connection-Type': 'WIFI',
    'Cookie': 'csrftoken=' + csrftoken,
    'Accept-Language': 'en-US',
  };

  // Step 1: Get pre-login data (optional, we just need the CSRF cookie)
  const preLogin = await axios.get(process.env.INSTAGRAM_API_BASE + '/si/fetch_headers/?challenge_type=signup&guid=' + generateGuid(), { headers });

  // Step 2: Login
  const loginPayload = {
    username: username,
    password: password,
    guid: generateGuid(),
    device_id: 'android-' + generateGuid(),
    login_attempt_count: 0,
    csrftoken: csrftoken,
  };

  const loginRes = await axios.post(process.env.INSTAGRAM_API_BASE + '/accounts/login/', loginPayload, { headers });
  if (loginRes.data.status === 'ok') {
    const authenticatedUser = loginRes.data.logged_in_user;
    // Extract session cookies
    const setCookie = loginRes.headers['set-cookie'];
    const sessionId = extractCookieValue(setCookie, 'sessionid');
    const csrf = extractCookieValue(setCookie, 'csrftoken') || csrftoken;
    return {
      success: true,
      session: {
        pk: authenticatedUser.pk,
        username: authenticatedUser.username,
        sessionid: sessionId,
        csrftoken: csrf,
      },
    };
  } else {
    throw new Error(loginRes.data.message || 'Login failed');
  }
}

// Helper: generate random GUID
function generateGuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper: extract CSRF token
function getCsrfToken() {
  return Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
}

// Helper: extract cookie value from set-cookie array
function extractCookieValue(setCookieArray, name) {
  if (!setCookieArray) return null;
  for (const cookieStr of setCookieArray) {
    if (cookieStr.startsWith(name + '=')) {
      return cookieStr.split(';')[0].split('=')[1];
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, password } = req.body;
  try {
    const result = await instagramLogin(username, password);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

// 
