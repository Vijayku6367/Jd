import axios from 'axios';

// Instagram report endpoint: POST /api/v1/media/{media_id}/flag/ or /web/reports/inappropriate/
// We'll use the web report API with session credentials.
async function reportUser(targetUsername, session, reportType) {
  const baseUrl = process.env.INSTAGRAM_WEB_BASE;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'X-CSRFToken': session.csrftoken,
    'Cookie': `sessionid=${session.sessionid}; csrftoken=${session.csrftoken}`,
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': `${baseUrl}/`,
  };

  // Step 1: Get user ID from username
  const userInfoRes = await axios.get(`${baseUrl}/web/search/topsearch/?query=${targetUsername}`, { headers });
  const user = userInfoRes.data.users.find(u => u.user.username.toLowerCase() === targetUsername.toLowerCase());
  if (!user) throw new Error(`User @${targetUsername} not found.`);
  const targetUserId = user.user.pk;

  // Step 2: Fetch a media ID from that user to report (a post is needed for most report types)
  const mediaRes = await axios.get(`${baseUrl}/graphql/query/?query_hash=e769aa130647d2354c40ea6a439bfc08&variables={"id":"${targetUserId}","first":1}`, { headers });
  const edges = mediaRes.data.data.user.edge_owner_to_timeline_media.edges;
  if (!edges.length) throw new Error('No media found on target profile.');
  const mediaId = edges[0].node.id;

  // Step 3: Build report payload (differs by report type)
  const reportPayload = getReportPayload(reportType, targetUserId, mediaId);

  // Step 4: Send the report via the web API
  const reportUrl = `${baseUrl}/web/reports/inappropriate/`;
  const response = await axios.post(reportUrl, reportPayload, { headers, validateStatus: () => true });
  if (response.status === 200 && response.data.status === 'ok') {
    return true;
  } else {
    console.error('Report failed:', response.data);
    return false;
  }
}

function getReportPayload(reportType, targetUserId, mediaId) {
  // Mapping from UI option to Instagram's internal reason codes
  const reasonMap = {
    'spam': '3',
    'harassment': '2',
    'inappropriate': '1',
    'false_info': '5',
    'impersonation': '8',
  };
  return {
    source_name: 'profile',
    target_user_id: targetUserId,
    media_id: mediaId,
    reason: reasonMap[reportType] || '3',
    // Additional required fields
    is_self_report: '0',
    ... (reportType === 'spam' ? { spam_type: 'other' } : {}),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { session, targetUser, reportCount, reportType } = req.body;

  if (!session || !session.sessionid) {
    return res.status(400).json({ success: false, message: 'Invalid session. Please log in again.' });
  }

  let sent = 0;
  let failed = 0;
  try {
    for (let i = 0; i < reportCount; i++) {
      const success = await reportUser(targetUser, session, reportType);
      if (success) sent++;
      else failed++;
      // Small delay to avoid rate limiting (100ms)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    res.status(200).json({ success: true, sent, failed });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message, sent, failed });
  }
}
