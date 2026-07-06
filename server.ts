import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON payloads up to 50MB (to support base64 file uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Folder paths
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// Discord configurations
const DISCORD_SERVER_ID = '1497519182277775475';
const ROLE_JURAGAN = '1505208613269012500';
const ROLE_SULTAN = '1505209732724560044';

// Active Sessions Store (In-Memory)
// Key: session token, Value: User details
const activeSessions = new Map<string, {
  userId: string;
  username: string;
  globalName?: string;
  avatar: string;
  role: 'SULTAN' | 'JURAGAN' | 'MEMBER' | 'NON-MEMBER';
  isSimulated: boolean;
  expiresAt: number;
}>();

// Seed data
const defaultDbData = {
  apps: [
    {
      id: "1",
      name: "Discord Auto-Mod Panel",
      version: "1.2.0",
      description: "Dashboard web untuk mengelola bot moderasi otomatis, log server, dan filter kata kasar secara real-time.",
      category: "Tools",
      filename: "discord-auto-mod-v1.2.0.zip",
      fileSize: "12.4 MB",
      uploadedBy: "Sultan_Dev",
      uploadedAt: "2026-07-06T08:00:00.000Z",
      downloadCount: 42,
      isMock: true,
      filePath: "uploads/discord-auto-mod-v1.2.0.zip"
    },
    {
      id: "2",
      name: "Database JSON Sync CLI",
      version: "2.0.1",
      description: "Alat CLI ringan untuk melakukan sinkronisasi database JSON flat-file secara aman menggunakan atomic writes.",
      category: "Database",
      filename: "json-sync-cli-v2.0.1.tar.gz",
      fileSize: "4.8 MB",
      uploadedBy: "Juragan_Admin",
      uploadedAt: "2026-07-05T12:30:00.000Z",
      downloadCount: 19,
      isMock: true,
      filePath: "uploads/json-sync-cli-v2.0.1.tar.gz"
    },
    {
      id: "3",
      name: "Security Auditing Shield",
      version: "3.5.0",
      description: "Modul proteksi endpoint API dan deteksi intrusi untuk server Express, lengkap dengan visualisasi ancaman.",
      category: "Security",
      filename: "security-auditing-shield.zip",
      fileSize: "8.1 MB",
      uploadedBy: "Juragan_Security",
      uploadedAt: "2026-07-04T15:45:00.000Z",
      downloadCount: 8,
      isMock: true,
      filePath: "uploads/security-auditing-shield.zip"
    }
  ],
  backups: []
};

// Ensure directories and database file exist
async function initStorage() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(BACKUPS_DIR, { recursive: true });

    try {
      await fs.access(DB_PATH);
    } catch {
      // Create empty DB with seed data if not existing
      await atomicWriteJson(DB_PATH, defaultDbData);
      console.log('Database initialized with default seed data.');
    }

    // Create mock files for seed data if not present (so users can test downloading immediately)
    for (const app of defaultDbData.apps) {
      const mockFilePath = path.join(UPLOADS_DIR, app.filename);
      try {
        await fs.access(mockFilePath);
      } catch {
        await fs.writeFile(
          mockFilePath,
          `Mock app binary data for ${app.name} v${app.version}.\nCreated atomically as part of seed.`,
          'utf8'
        );
      }
    }
  } catch (error) {
    console.error('Failed to initialize storage:', error);
  }
}

// ------------------------------------------------------------
// ATOMIC WRITES IMPLEMENTATION
// ------------------------------------------------------------
async function atomicWriteJson(filePath: string, data: any) {
  const tempPath = `${filePath}.tmp`;
  const jsonString = JSON.stringify(data, null, 2);
  
  // 1. Write data to a temporary file
  await fs.writeFile(tempPath, jsonString, 'utf8');
  // 2. Atomically rename the temporary file to the destination path
  await fs.rename(tempPath, filePath);
}

// ------------------------------------------------------------
// AUTOMATIC BACKUP IMPLEMENTATION
// ------------------------------------------------------------
async function autoBackupDb() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `db_backup_${timestamp}.json`;
    const backupPath = path.join(BACKUPS_DIR, backupFileName);
    
    // Read original database content
    const dbContent = await fs.readFile(DB_PATH, 'utf8');
    
    // Write backup atomically
    await fs.writeFile(backupPath, dbContent, 'utf8');
    console.log(`Automatic backup completed: ${backupFileName}`);
    
    // Read current list, update database backups list
    const stats = await fs.stat(backupPath);
    const db = JSON.parse(dbContent);
    if (!db.backups) db.backups = [];
    
    db.backups.unshift({
      filename: backupFileName,
      timestamp: new Date().toISOString(),
      size: `${(stats.size / 1024).toFixed(2)} KB`
    });

    // Enforce max 10 backups rule to prevent infinite storage growth
    const files = await fs.readdir(BACKUPS_DIR);
    const backupFiles = files
      .filter(f => f.startsWith('db_backup_') && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)

    if (backupFiles.length > 10) {
      const filesToDelete = backupFiles.slice(10);
      for (const file of filesToDelete) {
        await fs.unlink(path.join(BACKUPS_DIR, file));
        console.log(`Pruned old backup file: ${file}`);
      }
      
      // Update DB list to match physical files
      db.backups = db.backups.filter((b: any) => backupFiles.slice(0, 10).includes(b.filename));
    }

    // Save database list updates
    await atomicWriteJson(DB_PATH, db);
  } catch (error) {
    console.error('Automatic backup failed:', error);
  }
}

// Helper to read DB
async function readDb() {
  try {
    const content = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(content);
  } catch {
    return defaultDbData;
  }
}

// Helper to save DB and trigger backup
async function saveDbAndBackup(data: any) {
  await atomicWriteJson(DB_PATH, data);
  await autoBackupDb();
}

// ------------------------------------------------------------
// MIDDLEWARE: Role & Authentication Check
// ------------------------------------------------------------
const checkAuthAndRole = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // We allow token in Authorization header, or as query parameter (for file downloads)
  let token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthenticated', message: 'Token otentikasi tidak ditemukan.' });
  }

  const session = activeSessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'InvalidSession', message: 'Sesi Anda telah kedaluwarsa atau tidak valid.' });
  }

  if (session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'SessionExpired', message: 'Sesi Anda telah kedaluwarsa.' });
  }

  // Gatekeeping Check: Must be SULTAN or JURAGAN
  if (session.role !== 'SULTAN' && session.role !== 'JURAGAN') {
    return res.status(403).json({
      error: 'AccessDenied',
      message: 'Access Denied: Anda memerlukan role SULTAN atau JURAGAN untuk mengakses portal ini.',
      role: session.role
    });
  }

  // Add session info to request
  (req as any).userSession = session;
  next();
};

// ------------------------------------------------------------
// API ROUTES
// ------------------------------------------------------------

// Session validation endpoint
app.get('/api/auth/session', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.json({ user: null });
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) activeSessions.delete(token);
    return res.json({ user: null });
  }

  res.json({ user: session });
});

// Construct real Discord OAuth2 authorization URL
app.get('/api/auth/url', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/callback`;

  if (!clientId) {
    return res.json({
      url: null,
      message: 'Discord Client ID belum diatur. Silakan gunakan Simulated Login atau atur DISCORD_CLIENT_ID di tab Settings.'
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    prompt: 'consent'
  });

  const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  res.json({ url: authUrl });
});

// Real Discord OAuth2 Callback handler
app.get('/api/auth/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.send(`
      <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: sans-serif; background: #111827; color: #f3f4f6; text-align: center; padding-top: 5rem;">
          <h2 style="color: #ef4444;">Login Gagal</h2>
          <p>Kode otentikasi Discord tidak ditemukan.</p>
          <button onclick="window.close()" style="background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer; margin-top: 1rem;">Tutup</button>
        </body>
      </html>
    `);
  }

  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/auth/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Missing Discord Client ID or Client Secret in environment.');
    }

    // 1. Exchange OAuth code for access token
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Failed to swap token:', errorData);
      throw new Error('Gagal menukarkan kode otentikasi Discord.');
    }

    const tokenData = await tokenResponse.json() as any;
    const accessToken = tokenData.access_token;

    // 2. Fetch user profile (@me)
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userResponse.ok) {
      throw new Error('Gagal mengambil profil Discord.');
    }

    const userData = await userResponse.json() as any;

    // 3. Check guild membership and roles in Server ID 1497519182277775475
    let role: 'SULTAN' | 'JURAGAN' | 'MEMBER' | 'NON-MEMBER' = 'NON-MEMBER';
    let hasAccess = false;

    const memberResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${DISCORD_SERVER_ID}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (memberResponse.ok) {
      const memberData = await memberResponse.json() as any;
      const userRoles = memberData.roles as string[];

      if (userRoles.includes(ROLE_SULTAN)) {
        role = 'SULTAN';
        hasAccess = true;
      } else if (userRoles.includes(ROLE_JURAGAN)) {
        role = 'JURAGAN';
        hasAccess = true;
      } else {
        role = 'MEMBER';
      }
    } else if (memberResponse.status === 404) {
      // User is not in the guild at all
      role = 'NON-MEMBER';
    } else {
      console.error('Error checking guild member status:', memberResponse.status, await memberResponse.text());
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 Hours

    const avatarUrl = userData.avatar
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator || '0') % 5}.png`;

    const userSession = {
      userId: userData.id,
      username: userData.username,
      globalName: userData.global_name || userData.username,
      avatar: avatarUrl,
      role,
      isSimulated: false,
      expiresAt
    };

    activeSessions.set(sessionToken, userSession);

    // Communicate back to React App inside iframe via postMessage and close popup
    res.send(`
      <html>
        <body style="background: #111827; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center;">
          <div>
            <h2 style="color: ${hasAccess ? '#10b981' : '#f59e0b'}; margin-bottom: 0.5rem;">
              ${hasAccess ? 'Autentikasi Berhasil!' : 'Akses Ditolak'}
            </h2>
            <p style="color: #9ca3af; margin-bottom: 1.5rem;">
              ${hasAccess ? 'Menghubungkan ke dasbor...' : 'Anda tidak memiliki role yang diperlukan.'}
            </p>
            <script>
              const session = ${JSON.stringify({ token: sessionToken, user: userSession })};
              if (window.opener) {
                window.opener.postMessage({ type: 'DISCORD_AUTH_RESULT', session }, '*');
                window.close();
              } else {
                localStorage.setItem('node_x_token', session.token);
                window.location.href = '/';
              }
            </script>
            <p style="font-size: 0.8rem; color: #6b7280;">Jendela ini akan menutup otomatis.</p>
          </div>
        </body>
      </html>
    `);

  } catch (error: any) {
    console.error('OAuth Callback Error:', error);
    res.send(`
      <html>
        <body style="background: #111827; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center;">
          <div>
            <h2 style="color: #ef4444; margin-bottom: 1rem;">Sistem Error</h2>
            <p style="color: #9ca3af; margin-bottom: 1.5rem;">${error.message || 'Terjadi kesalahan saat memproses login Discord.'}</p>
            <button onclick="window.close()" style="background: #ef4444; color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 0.25rem; cursor: pointer;">Tutup Jendela</button>
          </div>
        </body>
      </html>
    `);
  }
});

// Credential-Based Admin Login (Real secure login instead of simulation)
app.post('/api/auth/admin-login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'adminpass123';

  if (username === adminUser && password === adminPass) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000; // 12 Hours

    const adminSession = {
      userId: 'admin_root',
      username: 'admin',
      globalName: 'Portal Administrator',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=admin_portal_root',
      role: 'SULTAN' as const,
      isSimulated: false, // This is a real authenticated login
      expiresAt
    };

    activeSessions.set(sessionToken, adminSession);
    return res.json({ token: sessionToken, user: adminSession });
  }

  return res.status(401).json({ error: 'Unauthorized', message: 'Username atau Password Admin tidak valid.' });
});

// ------------------------------------------------------------
// ADMIN PANEL COMPONENT API ENDPOINTS
// ------------------------------------------------------------

// List all active sessions in the server memory
app.get('/api/admin/sessions', checkAuthAndRole, (req, res) => {
  const sessionsList = Array.from(activeSessions.entries()).map(([token, sess]) => ({
    tokenHash: crypto.createHash('sha256').update(token).digest('hex').substring(0, 10),
    rawToken: token,
    userId: sess.userId,
    username: sess.username,
    globalName: sess.globalName,
    avatar: sess.avatar,
    role: sess.role,
    expiresAt: sess.expiresAt
  }));
  res.json({ sessions: sessionsList });
});

// Revoke an active user session by its token
app.post('/api/admin/sessions/revoke', checkAuthAndRole, (req, res) => {
  const { tokenToRevoke } = req.body;
  if (!tokenToRevoke) {
    return res.status(400).json({ error: 'MissingToken', message: 'Token yang akan dicabut wajib diisi.' });
  }

  // Prevent self-revocation
  const currentToken = req.headers.authorization?.split(' ')[1];
  if (currentToken === tokenToRevoke) {
    return res.status(400).json({ error: 'SelfRevocation', message: 'Anda tidak dapat mencabut sesi Anda sendiri.' });
  }

  const deleted = activeSessions.delete(tokenToRevoke);
  res.json({ success: deleted, message: deleted ? 'Sesi berhasil dicabut secara permanen.' : 'Sesi tidak ditemukan.' });
});

// Fetch advanced system, database, and storage telemetry
app.get('/api/admin/stats', checkAuthAndRole, async (req, res) => {
  try {
    const db = await readDb();

    // 1. Database File Size
    let dbSizeKb = 0;
    try {
      const dbStats = await fs.stat(DB_PATH);
      dbSizeKb = parseFloat((dbStats.size / 1024).toFixed(2));
    } catch {}

    // 2. Uploads Directory Telemetry
    let uploadsSizeMb = 0;
    let uploadsCount = 0;
    try {
      const files = await fs.readdir(UPLOADS_DIR);
      uploadsCount = files.length;
      for (const file of files) {
        const fileStats = await fs.stat(path.join(UPLOADS_DIR, file));
        uploadsSizeMb += fileStats.size;
      }
      uploadsSizeMb = parseFloat((uploadsSizeMb / (1024 * 1024)).toFixed(2));
    } catch {}

    // 3. Backups Directory Telemetry
    let backupsSizeMb = 0;
    let backupsCount = 0;
    try {
      const files = await fs.readdir(BACKUPS_DIR);
      backupsCount = files.length;
      for (const file of files) {
        const fileStats = await fs.stat(path.join(BACKUPS_DIR, file));
        backupsSizeMb += fileStats.size;
      }
      backupsSizeMb = parseFloat((backupsSizeMb / (1024 * 1024)).toFixed(2));
    } catch {}

    // 4. Category-wise and Download statistics
    const categoryStats: Record<string, number> = {};
    const downloadStats: Record<string, number> = {};

    db.apps.forEach((app: any) => {
      const cat = app.category || 'Other';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
      downloadStats[cat] = (downloadStats[cat] || 0) + (app.downloadCount || 0);
    });

    const categoryData = Object.keys(categoryStats).map(cat => ({
      name: cat,
      appsCount: categoryStats[cat],
      downloadsCount: downloadStats[cat] || 0
    }));

    const memoryUsage = process.memoryUsage();
    const serverStats = {
      dbSizeKb,
      uploadsSizeMb,
      uploadsCount,
      backupsSizeMb,
      backupsCount,
      activeSessionsCount: activeSessions.size,
      totalApps: db.apps?.length || 0,
      totalDownloads: db.apps?.reduce((acc: number, app: any) => acc + (app.downloadCount || 0), 0) || 0,
      memoryHeapUsedMb: parseFloat((memoryUsage.heapUsed / (1024 * 1024)).toFixed(2)),
      memoryHeapTotalMb: parseFloat((memoryUsage.heapTotal / (1024 * 1024)).toFixed(2)),
      nodeVersion: process.version,
      platform: process.platform,
      uptimeSeconds: Math.floor(process.uptime()),
      categoryData
    };

    res.json({ stats: serverStats });
  } catch (error: any) {
    res.status(500).json({ error: 'StatsFailed', message: 'Gagal memuat statistik server.' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// ------------------------------------------------------------
// APPLICATION CRUD ENDPOINTS (PROTECTED BY DISCORD ROLE)
// ------------------------------------------------------------

// List all applications
app.get('/api/apps', checkAuthAndRole, async (req, res) => {
  const db = await readDb();
  res.json({ apps: db.apps || [] });
});

// Create Application (Safe JSON CRUD with Atomic Writes)
app.post('/api/apps', checkAuthAndRole, async (req, res) => {
  const { name, version, description, category, file, externalUrl } = req.body;
  const userSession = (req as any).userSession;

  if (!name || !version || !description || !category) {
    return res.status(400).json({ error: 'MissingFields', message: 'Semua kolom utama wajib diisi.' });
  }

  try {
    const db = await readDb();
    const newId = crypto.randomUUID();

    let filename = '';
    let fileSize = 'External Link';
    let filePath = '';

    if (file && file.data) {
      // Decode Base64 and write physically to uploads dir (outside public directory)
      const base64Data = file.data.split(';base64,').pop();
      if (!base64Data) {
        throw new Error('Format file tidak valid.');
      }

      filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      filePath = path.join(UPLOADS_DIR, filename);
      
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(filePath, buffer);
      
      // Format file size
      const bytes = buffer.length;
      if (bytes < 1024 * 1024) {
        fileSize = `${(bytes / 1024).toFixed(1)} KB`;
      } else {
        fileSize = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      }
    } else if (externalUrl) {
      filename = 'Tautan Eksternal';
      filePath = externalUrl;
    } else {
      // Create a mock binary app zip for testing
      filename = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_v${version}.zip`;
      filePath = path.join(UPLOADS_DIR, filename);
      await fs.writeFile(
        filePath,
        `Simulated Binary Zip for ${name} v${version}.\nCreated atomically.`,
        'utf8'
      );
      fileSize = '1.5 MB';
    }

    const newApp = {
      id: newId,
      name,
      version,
      description,
      category,
      filename,
      fileSize,
      uploadedBy: userSession.globalName || userSession.username,
      uploadedAt: new Date().toISOString(),
      downloadCount: 0,
      filePath: file || !externalUrl ? `uploads/${filename}` : filePath,
      isExternal: !!externalUrl
    };

    if (!db.apps) db.apps = [];
    db.apps.push(newApp);

    // Save and backup atomically!
    await saveDbAndBackup(db);

    res.status(201).json({ success: true, app: newApp });
  } catch (error: any) {
    console.error('Error adding application:', error);
    res.status(500).json({ error: 'SaveFailed', message: 'Gagal menyimpan aplikasi baru.', details: error.message });
  }
});

// Update Application
app.put('/api/apps/:id', checkAuthAndRole, async (req, res) => {
  const { id } = req.params;
  const { name, version, description, category, externalUrl } = req.body;

  try {
    const db = await readDb();
    const appIndex = db.apps.findIndex((a: any) => a.id === id);

    if (appIndex === -1) {
      return res.status(404).json({ error: 'NotFound', message: 'Aplikasi tidak ditemukan.' });
    }

    db.apps[appIndex] = {
      ...db.apps[appIndex],
      name: name || db.apps[appIndex].name,
      version: version || db.apps[appIndex].version,
      description: description || db.apps[appIndex].description,
      category: category || db.apps[appIndex].category,
      filePath: externalUrl ? externalUrl : db.apps[appIndex].filePath,
      isExternal: externalUrl ? true : db.apps[appIndex].isExternal
    };

    await saveDbAndBackup(db);
    res.json({ success: true, app: db.apps[appIndex] });
  } catch (error: any) {
    res.status(500).json({ error: 'UpdateFailed', message: 'Gagal memperbarui data aplikasi.' });
  }
});

// Delete Application
app.delete('/api/apps/:id', checkAuthAndRole, async (req, res) => {
  const { id } = req.params;

  try {
    const db = await readDb();
    const appToDelete = db.apps.find((a: any) => a.id === id);

    if (!appToDelete) {
      return res.status(404).json({ error: 'NotFound', message: 'Aplikasi tidak ditemukan.' });
    }

    // Delete physically if it is a local file
    if (!appToDelete.isExternal && appToDelete.filePath && appToDelete.filePath.startsWith('uploads/')) {
      const physicalPath = path.join(DATA_DIR, appToDelete.filePath);
      try {
        await fs.unlink(physicalPath);
      } catch (e) {
        console.warn(`Could not delete physical file: ${physicalPath}`, e);
      }
    }

    db.apps = db.apps.filter((a: any) => a.id !== id);
    await saveDbAndBackup(db);

    res.json({ success: true, message: 'Aplikasi berhasil dihapus.' });
  } catch (error: any) {
    res.status(500).json({ error: 'DeleteFailed', message: 'Gagal menghapus aplikasi.' });
  }
});

// Secure Download Route (File Protections - Direct access forbidden)
// Requires a valid authentication token via query parameter ?token=<token>
app.get('/api/apps/download/:id', checkAuthAndRole, async (req, res) => {
  const { id } = req.params;

  try {
    const db = await readDb();
    const appRecord = db.apps.find((a: any) => a.id === id);

    if (!appRecord) {
      return res.status(404).send('<h2>Aplikasi tidak ditemukan</h2>');
    }

    if (appRecord.isExternal) {
      // For external URLs, increment downloads and redirect
      appRecord.downloadCount = (appRecord.downloadCount || 0) + 1;
      await saveDbAndBackup(db);
      return res.redirect(appRecord.filePath);
    }

    // Physical file serving
    const physicalPath = path.join(DATA_DIR, appRecord.filePath);

    try {
      await fs.access(physicalPath);
    } catch {
      return res.status(404).send('<h2>File fisik aplikasi tidak ditemukan di server.</h2>');
    }

    // Increment download count
    appRecord.downloadCount = (appRecord.downloadCount || 0) + 1;
    await saveDbAndBackup(db);

    // Download headers to protect file and enforce filename
    res.setHeader('Content-Disposition', `attachment; filename="${appRecord.filename}"`);
    res.download(physicalPath, appRecord.filename);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).send('<h2>Terjadi kesalahan pada server saat mendownload file.</h2>');
  }
});

// ------------------------------------------------------------
// DATABASE BACKUP MANAGEMENT
// ------------------------------------------------------------

// List backups
app.get('/api/backups', checkAuthAndRole, async (req, res) => {
  const db = await readDb();
  res.json({ backups: db.backups || [] });
});

// Trigger Manual Backup
app.post('/api/backups', checkAuthAndRole, async (req, res) => {
  try {
    await autoBackupDb();
    const db = await readDb();
    res.json({ success: true, message: 'Backup manual berhasil dibuat.', backups: db.backups });
  } catch (error: any) {
    res.status(500).json({ error: 'BackupFailed', message: 'Gagal membuat backup database.' });
  }
});

// Restore database backup
app.post('/api/backups/restore', checkAuthAndRole, async (req, res) => {
  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'MissingFileName', message: 'Nama file backup diperlukan.' });
  }

  try {
    const backupPath = path.join(BACKUPS_DIR, filename);
    await fs.access(backupPath);

    // Make an immediate safety backup of current state
    const currentTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safetyBackupPath = path.join(BACKUPS_DIR, `db_backup_PRE_RESTORE_${currentTimestamp}.json`);
    const currentData = await fs.readFile(DB_PATH, 'utf8');
    await fs.writeFile(safetyBackupPath, currentData, 'utf8');

    // Read and atomically overwrite current DB with restored backup data
    const backupContent = await fs.readFile(backupPath, 'utf8');
    const restoredData = JSON.parse(backupContent);

    // Keep backups list of the restored state intact
    await atomicWriteJson(DB_PATH, restoredData);

    res.json({ success: true, message: 'Database berhasil dipulihkan ke titik cadangan ini.' });
  } catch (error: any) {
    console.error('Restore failed:', error);
    res.status(500).json({ error: 'RestoreFailed', message: 'Gagal memulihkan database dari backup.', details: error.message });
  }
});

// Delete backup file
app.delete('/api/backups/:filename', checkAuthAndRole, async (req, res) => {
  const { filename } = req.params;

  try {
    const backupPath = path.join(BACKUPS_DIR, filename);
    await fs.unlink(backupPath);

    const db = await readDb();
    db.backups = (db.backups || []).filter((b: any) => b.filename !== filename);
    await atomicWriteJson(DB_PATH, db);

    res.json({ success: true, message: 'File backup berhasil dihapus.' });
  } catch (error: any) {
    res.status(500).json({ error: 'DeleteBackupFailed', message: 'Gagal menghapus file backup.' });
  }
});


// ------------------------------------------------------------
// SERVER SETUP & STARTUP
// ------------------------------------------------------------
async function startServer() {
  // Initialize storage setup
  await initStorage();

  // Vite Integration for Asset Serving & HMR
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Node X Manager running on http://localhost:${PORT}`);
  });
}

startServer();
