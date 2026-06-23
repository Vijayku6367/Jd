// api/report-batch.js
// Sends a batch of report requests using the authenticated session cookies.

const fetch = require('node-fetch');

// Instagram internal report endpoint (account reporting)
const REPORT_URL = 'https://i.instagram.com/api/v1/users/REPLACE_USER_ID/flag/';

// Reason mapping (official IDs used by Instagram)
const REASONS = [
  { value: 1, label: 'Spam' },
  { value: 2, label: 'Harassment or bullying' },
  { value: 3, label: 'Suicide, self-injury or eating disorders' },
  { value: 4, label: 'Hate speech or symbols' },
  { value: 5, label: 'Violence or dangerous organisations' },
  { value: 6, label: 'Nudity or sexual activity' },
  { value: 7, label: 'Scam, fraud or deception' }
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { targetUsername, count = 5, cookies, reasonIndex = 0 } = req.body;
  if (!targetUsername || !cookies) return res.status(400).json({ error: 'targetUsername and cookies required' });

  const batchSize = Math.min(parseInt(count) || 1, 15); // safety limit per call
  const results = [];

  try {
    // First, resolve target username to Instagram user ID
    const userInfoRes = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${targetUsername}`, {
      headers: {
        'Cookie': cookies.raw || cookies.sessionid ? `sessionid=${cookies.sessionid}; ds_user_id=${cookies.ds_user_id}; csrftoken=${cookies.csrftoken}` : '',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
      }
    });
    const userData = await userInfoRes.json();
    const targetUserId = userData?.data?.user?.id;
    if (!targetUserId) {
      return res.status(404).json({ error: 'Target user not found or blocked' });
    }

    const reportEndPoint = REPORT_URL.replace('REPLACE_USER_ID', targetUserId);
    const chosenReason = REASONS[reasonIndex] || REASONS[0];

    // Send each report in sequence with slight random delay
    for (let i = 0; i < batchSize; i++) {
      const form = new URLSearchParams();
      form.append('reason_id', chosenReason.value);
      form.append('source_name', 'profile');
      form.append('is_spam', reasonIndex === 0 ? 'true' : 'false');
      form.append('_csrftoken', cookies.csrftoken);
      form.append('_uuid', 'android-' + Math.random().toString(36).substring(2, 15));

      const resp = await fetch(reportEndPoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': `sessionid=${cookies.sessionid}; ds_user_id=${cookies.ds_user_id}; csrftoken=${cookies.csrftoken}`,
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
          'X-CSRFToken': cookies.csrftoken
        },
        body: form.toString()
      });

      const body = await resp.text();
      results.push({
        attempt: i + 1,
        status: resp.status,
        ok: resp.ok,
        body: body.substring(0, 100)
      });

      // random delay 200–800ms to appear human
      await new Promise(r => setTimeout(r, 200 + Math.random() * 600));
    }

    return res.status(200).json({
      batch_size: batchSize,
      target_user_id: targetUserId,
      reason: chosenReason.label,
      results: results
    });

  } catch (e) {
    return res.status(500).json({ error: 'Report batch failed', details: e.message });
  }
};
