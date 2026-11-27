/*
 * Sample team members, pending invites and signed-in sessions for Team and Settings → Security.
 * Deterministic so every reviewer sees the same data. Replace with GET /team, /team/invites and /sessions.
 */
(function () {
  'use strict';

  const members = [
    { id: 'usr_01', name: 'Pocket Admin', email: 'pocket@pocket.com', role: 'Admin', twoFactor: true, lastActive: '2026-11-27T11:58:00Z' },
    { id: 'usr_02', name: 'Leila Haddad', email: 'leila@theorangecard.com', role: 'Admin', twoFactor: true, lastActive: '2026-11-27T09:12:00Z' },
    { id: 'usr_03', name: 'Marco Bianchi', email: 'marco@theorangecard.com', role: 'Developer', twoFactor: true, lastActive: '2026-11-27T10:41:00Z' },
    { id: 'usr_04', name: 'Priya Nair', email: 'priya@theorangecard.com', role: 'Developer', twoFactor: false, lastActive: '2026-11-26T17:05:00Z' },
    { id: 'usr_05', name: 'Tom Okafor', email: 'tom@theorangecard.com', role: 'Finance', twoFactor: true, lastActive: '2026-11-25T08:30:00Z' },
    { id: 'usr_06', name: 'Sofia Lindqvist', email: 'sofia@theorangecard.com', role: 'Viewer', twoFactor: false, lastActive: '2026-11-19T14:22:00Z' },
  ];

  const invites = [
    { id: 'inv_01', email: 'omar@theorangecard.com', role: 'Finance', sent: '2026-11-26T15:00:00Z' },
    { id: 'inv_02', email: 'dev-contractor@studio-nine.io', role: 'Developer', sent: '2026-11-23T10:00:00Z' },
  ];

  const sessions = [
    { id: 'ses_01', device: 'Chrome on macOS', city: 'Dubai', country: 'AE', ip: '94.200.18.4', lastActive: '2026-11-27T11:58:00Z', current: true },
    { id: 'ses_02', device: 'Safari on iPhone', city: 'Dubai', country: 'AE', ip: '94.200.18.77', lastActive: '2026-11-27T07:40:00Z', current: false },
    { id: 'ses_03', device: 'Firefox on Windows', city: 'London', country: 'GB', ip: '81.2.69.160', lastActive: '2026-11-24T16:12:00Z', current: false },
  ];

  window.Portal.data = Object.assign(window.Portal.data || {}, { team: { members, invites, sessions } });
})();
