import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [targetUser, setTargetUser] = useState('');
  const [reportCount, setReportCount] = useState(50);
  const [reportType, setReportType] = useState('spam'); // spam, harassment, etc.
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);

  // Instagram login via backend API
  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus('Logging in...');
    try {
      const res = await axios.post('/api/login', { username, password });
      if (res.data.success) {
        setSessionData(res.data.session);
        setLoggedIn(true);
        setStatus('Login successful. Session stored.');
      } else {
        setStatus('Login failed: ' + res.data.message);
      }
    } catch (err) {
      setStatus('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  // Start mass reporting
  const startReporting = async () => {
    if (!sessionData || !targetUser || reportCount < 1) {
      setStatus('Fill all fields and ensure you are logged in.');
      return;
    }
    setRunning(true);
    setStatus(`Starting ${reportCount} reports on @${targetUser} for ${reportType}...`);
    try {
      const res = await axios.post('/api/report', {
        session: sessionData,
        targetUser,
        reportCount,
        reportType,
      });
      if (res.data.success) {
        setStatus(`Done! ${res.data.sent} reports sent. (${res.data.failed} failed)`);
      } else {
        setStatus('Failed: ' + res.data.message);
      }
    } catch (err) {
      setStatus('Error: ' + (err.response?.data?.error || err.message));
    }
    setRunning(false);
  };

  return (
    <div className="container">
      <h1>Instagram Mass Report Tool</h1>
      {!loggedIn ? (
        <form onSubmit={handleLogin}>
          <input type="text" placeholder="Instagram username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit">Login & Get Session</button>
        </form>
      ) : (
        <div>
          <p>Logged in as: {sessionData.username}</p>
          <input type="text" placeholder="Target username" value={targetUser} onChange={(e) => setTargetUser(e.target.value)} />
          <input type="number" placeholder="Number of reports" value={reportCount} onChange={(e) => setReportCount(parseInt(e.target.value))} />
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="spam">Spam</option>
            <option value="harassment">Harassment/Bullying</option>
            <option value="inappropriate">Inappropriate Content</option>
            <option value="false_info">False Information</option>
            <option value="impersonation">Impersonation</option>
          </select>
          <button onClick={startReporting} disabled={running}>
            {running ? 'Reporting...' : 'Start Mass Report'}
          </button>
        </div>
      )}
      {status && <div className="status">{status}</div>}
    </div>
  );
}

//
