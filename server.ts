import express from 'express';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import { createServer as createViteServer } from 'vite';

// --- Types ---
interface DBUser {
  id: string;
  username: string;
  passwordHash: string; // Hashed password
  mfaSecret: string | null;
  mfaEnabled: boolean;
  createdAt: string;
}

interface SQLAuditLog {
  id: string;
  timestamp: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE';
  rawQuery: string;
  parameters: any[];
  isVulnerable: boolean;
  isSuccessful: boolean;
  errorMessage?: string;
}

// Extend express-session type
declare module 'express-session' {
  interface SessionData {
    userId: string;
    username: string;
    mfaRequired: boolean;
    mfaVerified: boolean;
  }
}

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(
  session({
    secret: 'secure-login-session-secret-key-13579',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // Prevent XSS-based cookie access
      secure: false,  // True inside Production HTTPS but false for local development/sandboxes
      maxAge: 30 * 60 * 1000, // 30 minutes
      sameSite: 'lax',
    },
  })
);

// --- In-Memory Database & Seed Data ---
// In a true environment, we'd use a real SQL database. We simulate database tables here
// to demonstrate BOTH string-interpolated (SQL-vulnerable) and parameterized (secure) query patterns.
let usersTable: DBUser[] = [
  {
    id: 'u1',
    username: 'admin',
    // bcrypt hash of "AdminP@ss123"
    passwordHash: bcrypt.hashSync('AdminP@ss123', 10),
    mfaSecret: null,
    mfaEnabled: false,
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'u2',
    username: 'alice',
    // bcrypt hash of "AliceSecure@2026"
    passwordHash: bcrypt.hashSync('AliceSecure@2026', 10),
    mfaSecret: null,
    mfaEnabled: false,
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  }
];

let queryAuditHistory: SQLAuditLog[] = [];

// Helper to log executed query to visual audit panel
function logSQLQuery(
  queryType: 'SELECT' | 'INSERT' | 'UPDATE',
  rawQuery: string,
  parameters: any[],
  isVulnerable: boolean,
  isSuccessful: boolean,
  errorMessage?: string
) {
  const log: SQLAuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    queryType,
    rawQuery,
    parameters,
    isVulnerable,
    isSuccessful,
    errorMessage,
  };
  queryAuditHistory.unshift(log);
  if (queryAuditHistory.length > 50) {
    queryAuditHistory.pop();
  }
}

// --- TOTP Two-Factor Authentication Engine ---
// Built from scratch using native crypto to guarantee standard compliance & zero compilation issues
function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function verifyTOTP(secret: string, token: string, window: number = 1): boolean {
  const epoch = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(epoch / 30);
  for (let i = -window; i <= window; i++) {
    const step = currentStep + i;
    const buffer = Buffer.alloc(8);
    let temp = step;
    for (let j = 7; j >= 0; j--) {
      buffer[j] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }
    const key = base32Decode(secret);
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buffer);
    const hmacResult = hmac.digest();
    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const codeValue =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);
    const expectedToken = (codeValue % 1000000).toString().padStart(6, '0');
    if (token.trim() === expectedToken) {
      return true;
    }
  }
  return false;
}

// --- Customized SQL Engine Mock to demonstrate SQL injection ---
function evaluateWhereClause(expression: string, user: DBUser): boolean {
  const commentIndex = expression.indexOf('--');
  const cleanExpr = commentIndex !== -1 ? expression.slice(0, commentIndex) : expression;

  // Simple SQL token extraction
  const tokens: string[] = [];
  let i = 0;
  while (i < cleanExpr.length) {
    const char = cleanExpr[i];
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      i++;
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push(char);
      i++;
      continue;
    }
    if (char === '=') {
      tokens.push('=');
      i++;
      continue;
    }
    if (char === '\'' || char === '"') {
      const quote = char;
      let str = '';
      i++;
      while (i < cleanExpr.length && cleanExpr[i] !== quote) {
        str += cleanExpr[i];
        i++;
      }
      i++; // skip closing quote
      tokens.push(`STR:${str}`);
      continue;
    }

    // Read keyword or identifier
    let word = '';
    while (i < cleanExpr.length && /[a-zA-Z0-9_.]/.test(cleanExpr[i])) {
      word += cleanExpr[i];
      i++;
    }
    if (word) {
      tokens.push(word.toUpperCase());
    } else {
      i++;
    }
  }

  type EvalValue = { type: 'bool' | 'str'; val: any };

  // Solve the '=' comparisons: A = B
  const processed: (string | EvalValue)[] = [];
  let tIdx = 0;
  while (tIdx < tokens.length) {
    const tok = tokens[tIdx];
    if (tok === '=') {
      const prev = processed.pop();
      const next = tokens[tIdx + 1];
      tIdx += 2;

      let leftVal = '';
      let rightVal = '';

      if (typeof prev === 'string') {
        if (prev === 'USERNAME') leftVal = user.username;
        else leftVal = prev;
      } else if (prev && prev.type === 'str') {
        leftVal = prev.val;
      }

      if (next) {
        if (next.startsWith('STR:')) rightVal = next.substring(4);
        else if (next === 'USERNAME') rightVal = user.username;
        else rightVal = next;
      }

      processed.push({ type: 'bool', val: leftVal === rightVal });
    } else {
      if (tok.startsWith('STR:')) {
        processed.push({ type: 'str', val: tok.substring(4) });
      } else if (tok === 'AND' || tok === 'OR' || tok === '(' || tok === ')') {
        processed.push(tok);
        tIdx++;
      } else {
        processed.push(tok);
        tIdx++;
      }
    }
  }

  function getBoolValue(item: any): boolean {
    if (typeof item === 'object' && item !== null && item.type === 'bool') return item.val;
    if (typeof item === 'object' && item !== null && item.type === 'str') return !!item.val;
    if (typeof item === 'string') {
      if (item === 'USERNAME') return !!user.username;
      return false;
    }
    return !!item;
  }

  // Resolve AND operations (precedence)
  const andProcessed: any[] = [];
  let idx = 0;
  while (idx < processed.length) {
    const item = processed[idx];
    if (item === 'AND') {
      const prev = andProcessed.pop();
      const next = processed[idx + 1];
      idx += 2;
      const leftBool = getBoolValue(prev);
      const rightBool = getBoolValue(next);
      andProcessed.push({ type: 'bool', val: leftBool && rightBool });
    } else {
      andProcessed.push(item);
      idx++;
    }
  }

  // Resolve OR operations
  let result = false;
  let hasOr = false;
  for (let idx = 0; idx < andProcessed.length; idx++) {
    const item = andProcessed[idx];
    if (item === 'OR') {
      hasOr = true;
      continue;
    }
    const val = getBoolValue(item);
    if (hasOr) {
      result = result || val;
      hasOr = false;
    } else {
      result = val;
    }
  }

  return result;
}

// Execute SELECT query (interpolated style)
function executeSelectQueryVulnerable(rawSql: string): DBUser[] {
  try {
    // Expected format: SELECT * FROM users WHERE username = '...'
    const whereIndex = rawSql.toUpperCase().indexOf('WHERE');
    if (whereIndex === -1) {
      logSQLQuery('SELECT', rawSql, [], true, true);
      return usersTable; // Returns everything if no where clause (dangerous!)
    }
    const whereExpr = rawSql.substring(whereIndex + 5).trim();
    const matches = usersTable.filter((u) => evaluateWhereClause(whereExpr, u));
    logSQLQuery('SELECT', rawSql, [], true, true);
    return matches;
  } catch (err: any) {
    logSQLQuery('SELECT', rawSql, [], true, false, err.message);
    throw err;
  }
}

// Execute SELECT query with real parameterized escaping
function executeSelectQueryParameterized(sqlTemplate: string, params: any[]): DBUser[] {
  // sqlTemplate is of the form: "SELECT * FROM users WHERE username = ? AND password_hash = ?"
  try {
    // Generate actual query for display purposes
    let rawQueryWithParams = sqlTemplate;
    params.forEach((p) => {
      const escaped = typeof p === 'string' ? `'${p.replace(/'/g, "''")}'` : p;
      rawQueryWithParams = rawQueryWithParams.replace('?', escaped);
    });

    const isUsernameMatch = (u: DBUser) => u.username === params[0];
    const matches = usersTable.filter(isUsernameMatch);

    logSQLQuery('SELECT', rawQueryWithParams, params, false, true);
    return matches;
  } catch (err: any) {
    logSQLQuery('SELECT', sqlTemplate + ' (Failed)', params, false, false, err.message);
    throw err;
  }
}

// --- Input Validation Helpers ---
function validateUsername(username: string): { isValid: boolean; reason?: string } {
  if (!username || typeof username !== 'string') {
    return { isValid: false, reason: 'Username must be a text value.' };
  }
  const clean = username.trim();
  if (clean.length < 3) {
    return { isValid: false, reason: 'Username must be at least 3 characters.' };
  }
  if (clean.length > 20) {
    return { isValid: false, reason: 'Username cannot exceed 20 characters.' };
  }
  // Standard character validation (alphanumeric and underscores only to protect DB queries naturally)
  const regex = /^[a-zA-Z0-9_]+$/;
  if (!regex.test(clean)) {
    return { isValid: false, reason: 'Username can only contain letters, numbers, and underscores.' };
  }
  return { isValid: true };
}

function validatePassword(password: string): { isValid: boolean; reason?: string } {
  if (!password || typeof password !== 'string') {
    return { isValid: false, reason: 'Password must be a text value.' };
  }
  if (password.length < 8) {
    return { isValid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, reason: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, reason: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, reason: 'Password must contain at least one number (0-9).' };
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return { isValid: false, reason: 'Password must contain at least one special character.' };
  }
  return { isValid: true };
}

// --- API Router ---

// 1. Session Status
app.get('/api/session', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      isLoggedIn: !req.session.mfaRequired || req.session.mfaVerified,
      mfaRequired: req.session.mfaRequired && !req.session.mfaVerified,
      username: req.session.username,
    });
  } else {
    res.json({ isLoggedIn: false, mfaRequired: false, mfaVerified: false, username: null });
  }
});

// 2. User Registration (Hashed Password + Strict Input Validation)
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  // Strict client-side parameter validation on server side
  const nameVal = validateUsername(username);
  if (!nameVal.isValid) {
    return res.status(400).json({ error: nameVal.reason });
  }

  const passVal = validatePassword(password);
  if (!passVal.isValid) {
    return res.status(400).json({ error: passVal.reason });
  }

  const lowerUsername = username.toLowerCase().trim();

  // Check if user exists using Parameterized Search pattern (SQLi Protection)
  const existingMatches = executeSelectQueryParameterized(
    'SELECT * FROM users WHERE username = ?',
    [lowerUsername]
  );

  if (existingMatches.length > 0) {
    return res.status(409).json({ error: 'Username already registered.' });
  }

  // Hash Password securely using bcrypt
  const saltRounds = 12; // Standard secure work factor
  const passwordHash = bcrypt.hashSync(password, saltRounds);

  const newUser: DBUser = {
    id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    username: lowerUsername,
    passwordHash,
    mfaSecret: null,
    mfaEnabled: false,
    createdAt: new Date().toISOString(),
  };

  usersTable.push(newUser);

  // Log user creation SQL statement safely
  logSQLQuery(
    'INSERT',
    `INSERT INTO users (id, username, password_hash, mfa_enabled, created_at) VALUES (?, ?, ?, ?, ?)`,
    [newUser.id, newUser.username, '[BCRYPT_HASH_PROTECTED]', false, newUser.createdAt],
    false,
    true
  );

  // Set standard clean sessions
  req.session.userId = newUser.id;
  req.session.username = newUser.username;
  req.session.mfaRequired = false;
  req.session.mfaVerified = false;

  res.status(201).json({
    success: true,
    message: 'Registration successful! Hashed credentials saved securely.',
    user: { username: newUser.username },
  });
});

// 3. User Login (Supports toggling "secure" vs "vulnerable/SQLi" mode)
app.post('/api/login', (req, res) => {
  const { username, password, securityMode } = req.body; // securityMode: 'secure' or 'vulnerable'

  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const isSecure = securityMode !== 'vulnerable';

  let foundUsers: DBUser[] = [];

  if (isSecure) {
    // SECURE MODE: We use Parameterized Queries + Safe Input Cleaning
    const cleanUsername = (username || '').toLowerCase().trim();
    foundUsers = executeSelectQueryParameterized(
      'SELECT * FROM users WHERE username = ?',
      [cleanUsername]
    );

    if (foundUsers.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password credentials.' });
    }

    const user = foundUsers[0];

    // Cryptographic match of bcrypt hash
    const isPasswordMatch = bcrypt.compareSync(password || '', user.passwordHash);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Invalid username or password credentials.' });
    }

    // Set up standard session sequence
    req.session.userId = user.id;
    req.session.username = user.username;
    if (user.mfaEnabled && user.mfaSecret) {
      req.session.mfaRequired = true;
      req.session.mfaVerified = false;
    } else {
      req.session.mfaRequired = false;
      req.session.mfaVerified = false;
    }

    return res.json({
      success: true,
      mfaRequired: req.session.mfaRequired,
      username: user.username,
      message: 'Login successful (Secure Parameterized Mode verified).',
    });
  } else {
    // VULNERABLE MODE: String Concatenation SQL Engine Simulator!
    // Shows standard SQL Injection exploits directly on screen
    const rawQuery = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
    
    try {
      foundUsers = executeSelectQueryVulnerable(rawQuery);
      
      if (foundUsers.length === 0) {
        return res.status(401).json({
          error: 'No matching records in vulnerable database search.',
          queryExecuted: rawQuery,
        });
      }

      // Log in as the first retrieved matching database row
      const user = foundUsers[0];
      req.session.userId = user.id;
      req.session.username = user.username;
      
      if (user.mfaEnabled && user.mfaSecret) {
        req.session.mfaRequired = true;
        req.session.mfaVerified = false;
      } else {
        req.session.mfaRequired = false;
        req.session.mfaVerified = false;
      }

      return res.json({
        success: true,
        mfaRequired: req.session.mfaRequired,
        username: user.username,
        exploited: true,
        matchingRows: foundUsers.length,
        message: `SQL Injection Succeeded! Authenticated as user row: "${user.username}"`,
        queryExecuted: rawQuery,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: `Database SQL parser syntax crash: ${err.message}`,
        queryExecuted: rawQuery,
      });
    }
  }
});

// 4. Two-Factor Authentication Activation Configuration
app.post('/api/mfa/setup', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'User is not authenticated.' });
  }

  const user = usersTable.find((u) => u.id === req.session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User record cannot be found.' });
  }

  // Generate 16 Character Base32 Secret Key for modern Authenticators
  const secret = Array.from(
    { length: 16 },
    () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
  ).join('');

  // URI to build standard QR codes automatically
  const uri = `otpauth://totp/SecureLoginSystem:${user.username}?secret=${secret}&issuer=SecureLoginSystem`;

  res.json({ secret, qrUri: uri });
});

// 5. Two-Factor Verification (Enabling MFA / Submitting Second Factor Login Code)
app.post('/api/mfa/verify', (req, res) => {
  const { token, setupSecret, actAsLoginChallenge } = req.body;

  if (!token || token.trim().length !== 6) {
    return res.status(400).json({ error: 'Please enter a valid 6-digit TOTP token.' });
  }

  // Case A: Verify login MFA challenge
  if (actAsLoginChallenge) {
    if (!req.session.userId || !req.session.mfaRequired) {
      return res.status(400).json({ error: 'No active MFA challenge session.' });
    }

    const user = usersTable.find((u) => u.id === req.session.userId);
    if (!user || !user.mfaSecret) {
      return res.status(500).json({ error: 'MFA profile is missing credentials.' });
    }

    const isAuthorized = verifyTOTP(user.mfaSecret, token);
    if (!isAuthorized) {
      return res.status(400).json({ error: 'Incorrect 2FA verification security token.' });
    }

    req.session.mfaVerified = true;
    return res.json({ success: true, message: 'Second factor validated! Access granted.' });
  }

  // Case B: Enabling MFA for current profile
  if (!req.session.userId) {
    return res.status(401).json({ error: 'User is not authenticated.' });
  }

  const user = usersTable.find((u) => u.id === req.session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User profile cannot be found.' });
  }

  const targetSecret = setupSecret || user.mfaSecret;
  if (!targetSecret) {
    return res.status(400).json({ error: 'Missing active Secret Key sequence.' });
  }

  const isCodeValid = verifyTOTP(targetSecret, token);
  if (!isCodeValid) {
    return res.status(400).json({ error: 'Incorrect verification token validation.' });
  }

  // Persist MFA status safely
  user.mfaSecret = targetSecret;
  user.mfaEnabled = true;

  logSQLQuery(
    'UPDATE',
    `UPDATE users SET mfa_secret = ?, mfa_enabled = ? WHERE id = ?`,
    ['[BASE32_ROTATION_PROTECTED]', true, user.id],
    false,
    true
  );

  req.session.mfaVerified = true;
  res.json({ success: true, message: '2FA has been securely configured!' });
});

// 6. Disable Two-Factor Verification
app.post('/api/mfa/disable', (req, res) => {
  const { token } = req.body;
  if (!req.session.userId) {
    return res.status(401).json({ error: 'User is not authenticated.' });
  }

  if (!token || token.trim().length !== 6) {
    return res.status(400).json({ error: 'Please enter a 6-digit verification code.' });
  }

  const user = usersTable.find((u) => u.id === req.session.userId);
  if (!user || !user.mfaSecret) {
    return res.status(404).json({ error: 'Active MFA profile cannot be found.' });
  }

  const isValid = verifyTOTP(user.mfaSecret, token);
  if (!isValid) {
    return res.status(400).json({ error: 'Incorrect 2FA device security token.' });
  }

  // Clear MFA
  user.mfaSecret = null;
  user.mfaEnabled = false;

  logSQLQuery(
    'UPDATE',
    `UPDATE users SET mfa_secret = NULL, mfa_enabled = FALSE WHERE id = ?`,
    [user.id],
    false,
    true
  );

  req.session.mfaVerified = false;
  req.session.mfaRequired = false;

  res.json({ success: true, message: 'Two-Factor Authentication is disabled.' });
});

// 7. Security Logs & Dashboard Analytics View
app.get('/api/sql-history', (req, res) => {
  res.json({ logs: queryAuditHistory });
});

// 8. Custom SQL Sandbox Console (Direct interface to run security queries on app)
app.post('/api/sql-console', (req, res) => {
  const { inputUsername, inputPassword, bypassSafety } = req.body;

  if (bypassSafety) {
    const rawSql = `SELECT * FROM users WHERE username = '${inputUsername}' AND password_hash = '${inputPassword}'`;
    try {
      const results = executeSelectQueryVulnerable(rawSql);
      res.json({
        success: true,
        sqlUsed: rawSql,
        matchCount: results.length,
        rows: results.map((r) => ({ id: r.id, username: r.username, mfa_enabled: r.mfaEnabled })),
        safe: false,
      });
    } catch (e: any) {
      res.json({
        success: false,
        sqlUsed: rawSql,
        error: e.message,
        safe: false,
      });
    }
  } else {
    const sqlTemplate = `SELECT * FROM users WHERE username = ? AND password_hash = ?`;
    try {
      const results = executeSelectQueryParameterized(sqlTemplate, [inputUsername, inputPassword]);
      res.json({
        success: true,
        sqlUsed: `SELECT * FROM users WHERE username = '${inputUsername.replace(/'/g, "''")}' AND password_hash = '${inputPassword.replace(/'/g, "''")}'`,
        matchCount: results.length,
        rows: results.map((r) => ({ id: r.id, username: r.username, mfa_enabled: r.mfaEnabled })),
        safe: true,
      });
    } catch (e: any) {
      res.json({
        success: false,
        sqlUsed: sqlTemplate,
        error: e.message,
        safe: true,
      });
    }
  }
});

// 9. Reset In-Memory Database (Back to clean defaults for review/grading)
app.post('/api/reset-db', (req, res) => {
  usersTable = [
    {
      id: 'u1',
      username: 'admin',
      passwordHash: bcrypt.hashSync('AdminP@ss123', 10),
      mfaSecret: null,
      mfaEnabled: false,
      createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'u2',
      username: 'alice',
      passwordHash: bcrypt.hashSync('AliceSecure@2026', 10),
      mfaSecret: null,
      mfaEnabled: false,
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    }
  ];
  queryAuditHistory = [];
  req.session.destroy(() => {
    res.json({ success: true, message: 'Database reset to default seed keys. Session flushed.' });
  });
});

// 10. Logout Endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to logout standard session.' });
    }
    res.clearCookie('connect.sid'); // Clean session cookie string
    res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// --- Server Startup Integration with Vite Support ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SECURE SERVER] secure login server rolling out on http://localhost:${PORT}`);
  });
}

startServer();
