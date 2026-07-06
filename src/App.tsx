import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Download,
  Upload,
  Database,
  RefreshCw,
  Trash2,
  LogOut,
  Plus,
  Search,
  FileText,
  Layers,
  Lock,
  User,
  ExternalLink,
  Clock,
  History,
  Terminal,
  ArrowRight,
  ChevronRight,
  Info,
  Server,
  Key,
  FolderLock,
  Cpu
} from 'lucide-react';
import AdminDashboard from './components/AdminDashboard';

interface AppRecord {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  filename: string;
  fileSize: string;
  uploadedBy: string;
  uploadedAt: string;
  downloadCount: number;
  filePath: string;
  isExternal?: boolean;
}

interface BackupRecord {
  filename: string;
  timestamp: string;
  size: string;
}

interface UserSession {
  userId: string;
  username: string;
  globalName?: string;
  avatar: string;
  role: 'SULTAN' | 'JURAGAN' | 'MEMBER' | 'NON-MEMBER';
  isSimulated?: boolean;
  expiresAt: number;
}

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export default function App() {
  // Session states
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('node_x_token'));
  const [user, setUser] = useState<UserSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Core application states
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'apps' | 'add' | 'backup' | 'logs' | 'admin'>('apps');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // Admin Login credentials form state
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // New application form states
  const [appName, setAppName] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [appCategory, setAppCategory] = useState('Tools');
  const [uploadMode, setUploadMode] = useState<'file' | 'external'>('file');
  const [externalUrl, setExternalUrl] = useState('');
  
  const [dragFile, setDragFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFileBase64, setUploadingFileBase64] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backup & Operation feedback states
  const [operationLoading, setOperationLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Virtual Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Add system / security log helper
  const addLog = (action: string, details: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newLog: AuditLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      action,
      details,
      type
    };
    setAuditLogs(prev => [newLog, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  // Helper for notification toasts
  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  // Check user session on initial mount
  useEffect(() => {
    const verifySession = async () => {
      if (!token) {
        setLoadingSession(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/session', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          addLog('Session Verified', `Sesi pengguna ${data.user.username} terverifikasi.`, 'success');
        } else {
          // Token expired or invalid
          setToken(null);
          localStorage.removeItem('node_x_token');
          addLog('Session Revoked', 'Token sesi kedaluwarsa atau tidak valid.', 'warning');
        }
      } catch (err) {
        console.error('Session verification failed:', err);
      } finally {
        setLoadingSession(false);
      }
    };

    verifySession();
  }, [token]);

  // Fetch applications and backups when authenticated as JURAGAN or SULTAN
  useEffect(() => {
    if (user && (user.role === 'SULTAN' || user.role === 'JURAGAN')) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      // Fetch Apps
      const appsRes = await fetch('/api/apps', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setApps(appsData.apps || []);
      }

      // Fetch Backups
      const backupsRes = await fetch('/api/backups', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (backupsRes.ok) {
        const backupsData = await backupsRes.json();
        setBackups(backupsData.backups || []);
      }
      
      addLog('Data Synchronized', 'Daftar aplikasi dan cadangan database berhasil disinkronkan.', 'info');
    } catch (err) {
      console.error('Failed to fetch data:', err);
      addLog('Sync Failed', 'Gagal memuat data dari database lokal.', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  // Listening for Discord OAuth Popup message callbacks
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      // Validate origin pattern for security
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'DISCORD_AUTH_RESULT') {
        const { token: receivedToken, user: receivedUser } = event.data.session;
        localStorage.setItem('node_x_token', receivedToken);
        setToken(receivedToken);
        setUser(receivedUser);
        addLog('Discord Authorized', `Pengguna ${receivedUser.username} berhasil login via Discord OAuth2.`, 'success');
        triggerToast(`Selamat datang kembali, ${receivedUser.globalName || receivedUser.username}!`);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  // ------------------------------------------------------------
  // AUTHENTICATION CONTROLLERS
  // ------------------------------------------------------------

  // Real Discord Login Flow
  const handleDiscordLogin = async () => {
    addLog('Auth Initiated', 'Membuka popup Discord OAuth2...', 'info');
    try {
      const res = await fetch('/api/auth/url');
      const data = await res.json();

      if (!data.url) {
        triggerToast(data.message || 'Konfigurasi Discord OAuth2 belum lengkap.', 'error');
        addLog('OAuth Config Missing', 'Discord Client ID tidak ditemukan di environment.', 'error');
        return;
      }

      // Open OAuth provider directly in popup as required by skill guidelines
      const width = 600;
      const height = 750;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authWindow = window.open(
        data.url,
        'discord_oauth_popup',
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
      );

      if (!authWindow) {
        triggerToast('Popup terblokir! Silakan izinkan popup untuk website ini.', 'error');
      }
    } catch (err) {
      triggerToast('Gagal memulai login Discord.', 'error');
    }
  };

  // Secure Credential-Based Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername || !adminPassword) {
      triggerToast('Silakan masukkan Username dan Password.', 'error');
      return;
    }

    setLoginLoading(true);
    addLog('Admin Login Request', `Mengevaluasi kredensial admin untuk "${adminUsername}"...`, 'info');
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Kredensial tidak cocok.');
      }

      localStorage.setItem('node_x_token', data.token);
      setToken(data.token);
      setUser(data.user);
      
      // Reset form
      setAdminUsername('');
      setAdminPassword('');
      
      addLog('Admin Login Complete', `Akses Administrator diverifikasi secara lokal.`, 'success');
      triggerToast(`Login berhasil sebagai ${data.user.globalName}!`, 'success');
    } catch (err: any) {
      triggerToast(err.message || 'Gagal login administrator.', 'error');
      addLog('Admin Login Failure', err.message, 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    addLog('Logout Requested', `Mengakhiri sesi pengguna ${user?.username || ''}.`, 'info');
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (e) {
      console.warn('Backend logout failed', e);
    } finally {
      localStorage.removeItem('node_x_token');
      setToken(null);
      setUser(null);
      setApps([]);
      setBackups([]);
      triggerToast('Sesi Anda berhasil diakhiri.', 'info');
    }
  };

  // ------------------------------------------------------------
  // APPLICATION CRUD ACTIONS
  // ------------------------------------------------------------

  // File drag-and-drop mechanics
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    setDragFile(file);
    addLog('File Staged', `Mempersiapkan file upload: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`, 'info');

    // Read file as Base64 to send in payload
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadingFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Register New App (Create)
  const handleAddAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName || !appVersion || !appDescription || !appCategory) {
      triggerToast('Semua kolom utama wajib diisi.', 'error');
      return;
    }

    setOperationLoading(true);
    addLog('Create Initiated', `Membuat data aplikasi "${appName}"...`, 'info');

    try {
      let filePayload = null;
      if (uploadMode === 'file' && dragFile && uploadingFileBase64) {
        filePayload = {
          name: dragFile.name,
          data: uploadingFileBase64
        };
      }

      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: appName,
          version: appVersion,
          description: appDescription,
          category: appCategory,
          externalUrl: uploadMode === 'external' ? externalUrl : '',
          file: filePayload
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal menyimpan aplikasi baru.');
      }

      addLog('Create Completed', `Aplikasi "${appName} v${appVersion}" berhasil disimpan secara atomic.`, 'success');
      addLog('Auto-Backup Triggered', 'Sistem berhasil melakukan pencadangan otomatis (Atomic Write).', 'success');
      triggerToast('Aplikasi berhasil ditambahkan & Database dicadangkan otomatis!');
      
      // Reset form
      setAppName('');
      setAppVersion('');
      setAppDescription('');
      setAppCategory('Tools');
      setExternalUrl('');
      setDragFile(null);
      setUploadingFileBase64('');
      
      // Refresh list
      fetchDashboardData();
      setSelectedTab('apps');
    } catch (err: any) {
      triggerToast(err.message || 'Terjadi kesalahan saat menambahkan aplikasi.', 'error');
      addLog('Create Error', err.message || 'Error dalam memproses tulis atomic database.', 'error');
    } finally {
      setOperationLoading(false);
    }
  };

  // Delete Application
  const handleDeleteApp = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus aplikasi "${name}"? Tindakan ini juga akan menghapus file fisik di server.`)) {
      return;
    }

    addLog('Delete Initiated', `Menghapus aplikasi ID ${id}...`, 'info');
    try {
      const res = await fetch(`/api/apps/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal menghapus aplikasi.');
      }

      addLog('Delete Completed', `Aplikasi "${name}" berhasil dihapus. Database dicadangkan otomatis.`, 'success');
      triggerToast(`Aplikasi "${name}" berhasil dihapus.`);
      fetchDashboardData();
    } catch (err: any) {
      triggerToast(err.message || 'Gagal menghapus aplikasi.', 'error');
      addLog('Delete Error', err.message, 'error');
    }
  };

  // ------------------------------------------------------------
  // DATABASE BACKUP SYSTEM ACTIONS
  // ------------------------------------------------------------

  // Manual Trigger Backup
  const handleTriggerManualBackup = async () => {
    setOperationLoading(true);
    addLog('Manual Backup Requested', 'Memulai pencadangan manual database JSON...', 'info');
    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memicu backup.');

      setBackups(data.backups || []);
      addLog('Manual Backup Success', 'Sesi pencadangan manual selesai. File terenkripsi disimpan.', 'success');
      triggerToast('Backup manual berhasil dibuat!');
    } catch (err: any) {
      triggerToast(err.message || 'Gagal membuat backup database.', 'error');
      addLog('Backup System Error', err.message, 'error');
    } finally {
      setOperationLoading(false);
    }
  };

  // Restore DB from Backup
  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`PERINGATAN: Memulihkan database ke titik "${filename}" akan menimpa seluruh data aplikasi saat ini. Sistem akan membuat cadangan darurat (safety backup) secara otomatis sebelum pemulihan. Lanjutkan?`)) {
      return;
    }

    setOperationLoading(true);
    addLog('Restore Initiated', `Memulai pemulihan database dari file: ${filename}...`, 'warning');
    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filename })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memulihkan database.');

      addLog('Restore Completed', `Database berhasil dipulihkan. Keadaan saat ini dicatat.`, 'success');
      triggerToast('Database berhasil dipulihkan!');
      fetchDashboardData();
    } catch (err: any) {
      triggerToast(err.message || 'Gagal memulihkan database.', 'error');
      addLog('Restore System Error', err.message, 'error');
    } finally {
      setOperationLoading(false);
    }
  };

  // Delete Backup File
  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus file backup "${filename}"? Tindakan ini bersifat permanen.`)) {
      return;
    }

    addLog('Backup Delete Initiated', `Menghapus file backup: ${filename}...`, 'info');
    try {
      const res = await fetch(`/api/backups/${filename}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal menghapus file backup.');
      }

      addLog('Backup Delete Complete', `File backup ${filename} dihapus dari server.`, 'success');
      triggerToast('File backup berhasil dihapus.');
      fetchDashboardData();
    } catch (err: any) {
      triggerToast(err.message || 'Gagal menghapus file backup.', 'error');
      addLog('Backup Action Error', err.message, 'error');
    }
  };

  // Get active download URL for a file (protected behind authorization middleware check)
  const getDownloadUrl = (appId: string) => {
    return `/api/apps/download/${appId}?token=${token}`;
  };

  // Filter apps list based on search query and selected category
  const filteredApps = apps.filter(app => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'Semua' || app.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = ['Semua', 'Tools', 'Database', 'Security', 'Script', 'Game Server', 'Other'];

  // Loading Session view
  if (loadingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen mesh-bg text-gray-300 font-sans">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-gray-800 border-t-indigo-500 animate-spin"></div>
        </div>
        <p className="text-sm font-mono tracking-widest text-indigo-400">LOADING NODE X SESSIONS...</p>
      </div>
    );
  }

  // 1. ACCESS DENIED SCREEN (Logged in but lacks JURAGAN/SULTAN)
  if (user && user.role !== 'SULTAN' && user.role !== 'JURAGAN') {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-900/10 rounded-full blur-[100px] pointer-events-none"></div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg glass-panel border-red-500/30 rounded-2xl p-8 relative z-10 text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-950/50 border border-red-500/40 text-red-500 mb-6">
            <ShieldAlert size={32} className="animate-pulse" />
          </div>

          <h1 className="font-display text-2xl font-bold text-red-400 tracking-tight mb-2">ACCESS DENIED</h1>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Sistem mendeteksi bahwa akun Discord Anda tidak memiliki otoritas akses ke portal ini.
          </p>

          <div className="glass-card rounded-xl p-4 mb-6 flex items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <img src={user.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-gray-700" />
              <div>
                <p className="text-sm font-semibold text-gray-200">{user.globalName || user.username}</p>
                <p className="text-xs font-mono text-gray-400">ID: {user.userId}</p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-mono font-medium bg-red-950/40 border border-red-500/30 text-red-400 uppercase">
              {user.role}
            </span>
          </div>

          <div className="bg-red-950/10 border border-red-500/20 rounded-xl p-5 mb-8 text-left text-xs space-y-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-red-400 font-medium mb-1">
              <Info size={14} />
              <span>Persyaratan Otorisasi Server</span>
            </div>
            <p className="text-gray-400 leading-relaxed">
              Portal **Node X Manager** memerlukan keanggotaan aktif di Server Discord dan salah satu dari role berikut:
            </p>
            <ul className="space-y-1.5 text-gray-300 font-mono mt-1 pl-4 list-disc">
              <li>Role <span className="text-amber-400">SULTAN</span> (ID: <span className="text-gray-400">1505209732724560044</span>)</li>
              <li>Role <span className="text-emerald-400">JURAGAN</span> (ID: <span className="text-gray-400">1505208613269012500</span>)</li>
            </ul>
            <p className="text-gray-500 mt-2 text-[10px]">
              ID Server Discord Target: 1497519182277775475
            </p>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-950/40 hover:bg-red-900/50 text-red-200 text-sm font-semibold rounded-xl transition duration-200 border border-red-500/20"
            >
              <LogOut size={16} />
              Keluar Sesi & Kembali Ke Login
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. WELCOME / LOGIN SCREEN (Not logged in)
  if (!user) {
    return (
      <div className="min-h-screen mesh-bg flex flex-col justify-between p-6 font-sans relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[150px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-900/5 rounded-full blur-[150px] pointer-events-none"></div>

        {/* Top Navbar */}
        <div className="flex items-center justify-between max-w-7xl w-full mx-auto relative z-10 py-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-tight text-white">Node X</span>
              <span className="font-display font-medium text-xs text-indigo-400 ml-1">Manager</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-xs font-mono text-gray-400 tracking-wider">SECURE PORTAL</span>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center my-auto relative z-10 py-10">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 glass-card border-indigo-500/30 rounded-full text-indigo-300 text-xs font-mono">
              <Lock size={12} />
              <span>Gatekeeping Keamanan Berlapis</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
              Portal Penyimpanan <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-200 to-emerald-400">Aplikasi Terproteksi</span>
            </h1>
            <p className="text-gray-400 text-base leading-relaxed max-w-xl">
              Platform internal aman untuk mengunduh, mengunggah, dan mengelola paket biner server serta alat utilitas dengan validasi role Discord secara real-time. Didukung oleh database JSON lokal yang aman dengan penulisan atomic dan sistem pencadangan otomatis.
            </p>

            {/* Key specs list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="flex gap-3 items-start p-4 glass-card rounded-xl">
                <ShieldCheck className="text-emerald-400 shrink-0 mt-1" size={18} />
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">Discord OAuth2 System</h3>
                  <p className="text-xs text-gray-400 mt-1">Validasi instan untuk mengecek keanggotaan server dan ketersediaan role.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start p-4 glass-card rounded-xl">
                <Database className="text-indigo-400 shrink-0 mt-1" size={18} />
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">Atomic Writes & Backups</h3>
                  <p className="text-xs text-gray-400 mt-1">Jaminan integritas file JSON lokal, terbebas dari ancaman file korup saat dibaca-tulis.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 flex justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-md glass-panel rounded-2xl p-8 relative shadow-2xl"
            >
              <div className="text-center pb-6 border-b border-gray-800">
                <h2 className="font-display text-xl font-bold text-white mb-1">Otentikasi Dasbor</h2>
                <p className="text-xs text-gray-400">Pilih metode masuk untuk mengakses aplikasi terproteksi.</p>
              </div>

              {/* METHOD 1: Real Discord Login */}
              <div className="py-6 space-y-4">
                <h3 className="text-xs font-mono font-bold tracking-wider text-gray-400 uppercase">METODE UTAMA (DISCORD)</h3>
                <button
                  onClick={handleDiscordLogin}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-indigo-500/10 group"
                >
                  <svg className="w-5 h-5 shrink-0 fill-current group-hover:scale-105 transition" viewBox="0 0 127.14 96.36">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.9-.65,1.76-1.34,2.58-2a75.58,75.58,0,0,0,72.9,0c.82.71,1.68,1.4,2.58,2a68.1,68.1,0,0,1-10.5,5,78.37,78.37,0,0,0,6.63,10.85,105.28,105.28,0,0,0,31.6-18.83C129.47,48.12,123,25.33,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.93,46,53.93,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.17,46,96.17,53,91,65.69,84.69,65.69Z"/>
                  </svg>
                  Masuk dengan Discord
                </button>
                <p className="text-[10px] text-gray-500 leading-normal">
                  Sistem otomatis memverifikasi ketersediaan role **SULTAN** atau **JURAGAN** pada server id `1497519182277775475`.
                </p>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-800"></div>
                <span className="flex-shrink mx-4 text-[10px] font-mono tracking-widest text-gray-500 uppercase">ATAU</span>
                <div className="flex-grow border-t border-gray-800"></div>
              </div>

              {/* METHOD 2: Credential Admin Login */}
              <form onSubmit={handleAdminLogin} className="pt-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold tracking-wider text-gray-400 uppercase">MASUK SEBAGAI ADMIN</h3>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-400 font-mono">SECURE LOGIN</span>
                </div>
                <p className="text-xs text-gray-400 leading-normal">
                  Masukkan kredensial administrasi lokal jika Discord API tidak dikonfigurasi di server Anda.
                </p>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1">Username Admin</label>
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="Contoh: admin"
                      className="w-full px-3 py-2 bg-black/40 border border-gray-800 focus:border-indigo-500 text-white rounded-xl text-xs transition placeholder:text-gray-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1">Password Admin</label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 bg-black/40 border border-gray-800 focus:border-indigo-500 text-white rounded-xl text-xs transition placeholder:text-gray-600 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition duration-150 shadow-md shadow-indigo-500/15 cursor-pointer disabled:opacity-50"
                >
                  {loginLoading ? 'Memverifikasi...' : 'Otorisasi Akses Admin'}
                  <ArrowRight size={14} />
                </button>
              </form>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-7xl w-full mx-auto relative z-10 py-6 border-t border-gray-900 text-center text-xs text-gray-500 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>© 2026 Node X Manager. All rights reserved.</p>
          <p className="font-mono text-[10px] text-gray-600">Secure File Vault • JSON Database (Atomic Write)</p>
        </div>
      </div>
    );
  }

  // 3. MAIN PORTAL VIEW (Authenticated and Authorized - SULTAN or JURAGAN)
  return (
    <div className="min-h-screen mesh-bg text-gray-200 font-sans flex flex-col">
      {/* Toast notifications */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-red-950/90 border-red-500/30 text-red-200'
                : 'bg-indigo-950/90 border-indigo-500/30 text-indigo-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <ShieldCheck className="text-emerald-400 shrink-0" size={20} />
            ) : statusMessage.type === 'error' ? (
              <ShieldAlert className="text-red-400 shrink-0" size={20} />
            ) : (
              <Info className="text-indigo-400 shrink-0" size={20} />
            )}
            <p className="text-sm font-medium pr-4">{statusMessage.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header / Top bar */}
      <header className="glass-panel border-b border-[#1F293D]/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/15">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-lg tracking-tight text-white">Node X</span>
                <span className="font-display font-medium text-xs text-indigo-400">Manager</span>
              </div>
              <p className="text-[10px] text-gray-500 font-mono">DATABASE: LOCAL JSON (ATOMIC)</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* User Session Profile details */}
            <div className="flex items-center gap-3 glass-card pl-3 pr-4 py-1.5 rounded-full">
              <img
                src={user.avatar}
                alt="Profile Avatar"
                className="w-7 h-7 rounded-full border border-gray-700"
              />
              <div className="text-left">
                <p className="text-xs font-semibold text-gray-200">{user.globalName || user.username}</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[9px] font-mono font-medium text-gray-400 uppercase tracking-wide">
                    {user.userId === 'admin_root' ? 'Admin Portal' : `Discord Active`}
                  </span>
                </div>
              </div>
              <div className="ml-2 pl-2 border-l border-gray-800">
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                  user.role === 'SULTAN' ? 'bg-amber-950 border border-amber-600/40 text-amber-400' : 'bg-emerald-950 border border-emerald-600/40 text-emerald-400'
                }`}>
                  {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2.5 glass-card hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white rounded-xl transition duration-150 cursor-pointer"
              title="Logout Sesi"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main content body */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Navigation Sidebar panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest px-2 mb-3">PANEL NAVIGASI</h3>
            <nav className="space-y-1">
              <button
                onClick={() => setSelectedTab('apps')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  selectedTab === 'apps'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 font-semibold'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FolderLock size={18} />
                  <span>Aplikasi Terproteksi</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#000]/20 font-mono">{apps.length}</span>
              </button>

              <button
                onClick={() => setSelectedTab('add')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  selectedTab === 'add'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 font-semibold'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <Plus size={18} />
                <span>Tambah Aplikasi</span>
              </button>

              <button
                onClick={() => setSelectedTab('backup')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  selectedTab === 'backup'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 font-semibold'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Database size={18} />
                  <span>Cadangan Lokal (Backup)</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#000]/20 font-mono">{backups.length}</span>
              </button>

              <button
                onClick={() => setSelectedTab('logs')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  selectedTab === 'logs'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 font-semibold'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <Terminal size={18} />
                <span>Sistem Monitor & Audit</span>
              </button>

              <button
                onClick={() => setSelectedTab('admin')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  selectedTab === 'admin'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 font-semibold'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <Cpu size={18} />
                <span>Dashboard Admin</span>
              </button>
            </nav>
          </div>

          {/* Quick System specs */}
          <div className="glass-panel rounded-2xl p-4 text-xs space-y-3">
            <h3 className="font-mono font-bold text-gray-500 uppercase tracking-widest px-2">STATUS KEAMANAN</h3>
            <div className="space-y-2 px-2 pt-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Atomic Write:</span>
                <span className="text-emerald-400 font-medium">AKTIF</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Local DB:</span>
                <span className="text-gray-300">data/db.json</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">File Storage:</span>
                <span className="text-gray-300">data/uploads/</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Target Server ID:</span>
                <span className="text-indigo-400">14975191822...</span>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-800/60 px-2 flex items-center gap-1.5 text-[10px] text-gray-400">
              <Server size={12} className="text-indigo-400 shrink-0" />
              <span>Host Container Ingress: Active</span>
            </div>
          </div>
        </div>

        {/* Dynamic Content Panel area */}
        <div className="lg:col-span-9">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: Daftar Aplikasi (Storage Portal) */}
            {selectedTab === 'apps' && (
              <motion.div
                key="apps-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Search & Filter tools */}
                <div className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                  {/* Search box */}
                  <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      type="text"
                      placeholder="Cari aplikasi, versi, atau pengunggah..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full glass-input rounded-xl pl-10 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none transition"
                    />
                  </div>

                  {/* Category filters list */}
                  <div className="flex gap-1 overflow-x-auto w-full md:w-auto scrollbar-none py-1">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition whitespace-nowrap cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 font-semibold'
                            : 'glass-card border-transparent text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Applications list Grid */}
                {loadingData ? (
                  <div className="glass-panel rounded-2xl p-12 text-center text-gray-400 space-y-2">
                    <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto" />
                    <p className="text-sm font-mono">Menyelaraskan data portal...</p>
                  </div>
                ) : filteredApps.length === 0 ? (
                  <div className="glass-panel rounded-2xl p-12 text-center text-gray-400 space-y-4">
                    <FolderLock size={40} className="text-gray-600 mx-auto" />
                    <div>
                      <h4 className="text-base font-semibold text-gray-300">Tidak Ada Aplikasi Ditemukan</h4>
                      <p className="text-xs text-gray-500 mt-1">Coba sesuaikan kata kunci pencarian atau ganti kategori filter.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredApps.map(app => (
                      <div
                        key={app.id}
                        className="glass-card hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 group hover:-translate-y-0.5 relative"
                      >
                        {/* Upper Info */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-semibold bg-indigo-950/40 border border-indigo-500/20 text-indigo-300 backdrop-blur-sm">
                                {app.category}
                              </span>
                              <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition mt-2 font-display">
                                {app.name}
                              </h3>
                            </div>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded glass-card text-gray-300 border border-white/5">
                              v{app.version}
                            </span>
                          </div>

                          <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                            {app.description}
                          </p>
                        </div>

                        {/* Metadata & Actions at the bottom */}
                        <div className="pt-4 mt-4 border-t border-gray-800/60 space-y-3.5">
                          <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              {app.uploadedBy}
                            </span>
                            <span className="flex items-center gap-1" title="Tanggal unggah">
                              <Clock size={12} />
                              {new Date(app.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center justify-between glass-card p-2.5 rounded-xl border border-white/5">
                            <div className="text-left">
                              <p className="text-[10px] font-mono font-bold text-gray-400 truncate max-w-[180px] sm:max-w-[200px]" title={app.filename}>
                                {app.filename}
                              </p>
                              <p className="text-[9px] text-gray-500 font-mono mt-0.5">
                                Ukuran: <span className="text-gray-400">{app.fileSize}</span> • Unduhan: <span className="text-indigo-400 font-bold">{app.downloadCount || 0}x</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={getDownloadUrl(app.id)}
                                onClick={() => addLog('Download Initiated', `Mendownload berkas aplikasi "${app.name} v${app.version}" secara aman.`, 'success')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.03] text-white text-xs font-medium rounded-lg transition duration-150"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download size={12} />
                                Download
                              </a>

                              {/* Allowed actions for Sultan or Juragan */}
                              <button
                                onClick={() => handleDeleteApp(app.id, app.name)}
                                className="p-1.5 bg-red-950/20 hover:bg-red-950/80 border border-red-500/15 hover:border-red-500/30 text-red-400 rounded-lg transition"
                                title="Hapus Aplikasi"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 2: Tambah Aplikasi (Register new files/binaries) */}
            {selectedTab === 'add' && (
              <motion.div
                key="add-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="glass-panel rounded-2xl p-6"
              >
                <div className="pb-4 mb-6 border-b border-gray-800">
                  <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                    <Plus size={18} className="text-indigo-400" />
                    Registrasikan Aplikasi Baru
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Mendaftarkan utilitas baru secara terproteksi ke sistem database atomic writes.</p>
                </div>

                <form onSubmit={handleAddAppSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* App Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">Nama Aplikasi</label>
                      <input
                        type="text"
                        required
                        placeholder="contoh: Discord Music Bot Pro"
                        value={appName}
                        onChange={e => setAppName(e.target.value)}
                        className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-gray-200 outline-none transition"
                      />
                    </div>

                    {/* App Version */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">Nomor Versi (Semantic)</label>
                      <input
                        type="text"
                        required
                        placeholder="contoh: 1.0.0"
                        value={appVersion}
                        onChange={e => setAppVersion(e.target.value)}
                        className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-gray-200 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Category Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">Kategori</label>
                      <select
                        value={appCategory}
                        onChange={e => setAppCategory(e.target.value)}
                        className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-gray-200 outline-none transition"
                      >
                        {categories.filter(c => c !== 'Semua').map(cat => (
                          <option key={cat} value={cat} className="bg-[#0B101D]">{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Source / Download Mode toggle */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">Metode Penyimpanan Berkas</label>
                      <div className="grid grid-cols-2 gap-2 glass-card p-1 rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => setUploadMode('file')}
                          className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                            uploadMode === 'file'
                              ? 'bg-indigo-600 text-white'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          Upload File Lokal
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadMode('external')}
                          className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                            uploadMode === 'external'
                              ? 'bg-indigo-600 text-white'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          Tautan Eksternal
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* App Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300">Deskripsi Aplikasi</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Jelaskan fungsionalitas, cara menjalankan, dan fitur utama dari aplikasi ini..."
                      value={appDescription}
                      onChange={e => setAppDescription(e.target.value)}
                      className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-gray-200 outline-none transition resize-none"
                    ></textarea>
                  </div>

                  {/* File Upload / External Link Input fields */}
                  {uploadMode === 'file' ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                        <span>Unggah File Biner (.zip, .tar.gz, .js, .json)</span>
                        <span className="text-[10px] text-indigo-400">Penyimpanan Terproteksi API</span>
                      </label>

                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                          isDragging
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : dragFile
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-white/10 hover:border-white/20 glass-input bg-white/2 hover:bg-white/5'
                        }`}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        {dragFile ? (
                          <>
                            <div className="w-12 h-12 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 flex items-center justify-center backdrop-blur-sm">
                              <ShieldCheck size={24} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-200">{dragFile.name}</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">
                                {(dragFile.size / (1024 * 1024)).toFixed(2)} MB • File Terverifikasi
                              </p>
                            </div>
                            <span className="text-[10px] text-gray-500">Klik untuk mengganti berkas</span>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-xl glass-card text-indigo-400 flex items-center justify-center">
                              <Upload size={22} className="group-hover:scale-105 transition" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-300">Tarik & Lepaskan Berkas ke Sini</p>
                              <p className="text-xs text-gray-500 mt-1">atau klik untuk menelusuri file lokal komputer</p>
                            </div>
                            <span className="text-[10px] text-gray-600 font-mono">Batas ukuran upload: 50MB</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">Tautan Unduhan Eksternal</label>
                      <div className="relative">
                        <ExternalLink className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                          type="url"
                          required
                          placeholder="https://example.com/downloads/my-package.zip"
                          value={externalUrl}
                          onChange={e => setExternalUrl(e.target.value)}
                          className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-200 outline-none transition"
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 leading-normal">
                        Sistem hanya akan menyimpan link eksternal di database lokal tanpa melakukan penarikan file fisik ke disk.
                      </p>
                    </div>
                  )}

                  {/* Form Submission */}
                  <div className="flex gap-3 justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTab('apps');
                        setDragFile(null);
                        setUploadingFileBase64('');
                      }}
                      className="px-5 py-2.5 glass-card hover:bg-white/10 text-gray-300 text-sm font-semibold rounded-xl transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={operationLoading}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-lg shadow-indigo-500/20"
                    >
                      {operationLoading ? (
                        <>
                          <RefreshCw className="animate-spin" size={16} />
                          Mengeksekusi...
                        </>
                      ) : (
                        <>
                          Simpan Atomic
                          <ChevronRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* TAB 3: Sistem Cadangan (Backup Engine Management) */}
            {selectedTab === 'backup' && (
              <motion.div
                key="backup-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Backup Header card */}
                <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-1">
                    <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                      <Database size={18} className="text-indigo-400" />
                      Mesin Pencadangan Database JSON Flat-File
                    </h2>
                    <p className="text-xs text-gray-400 leading-relaxed max-w-xl">
                      Setiap kali data ditambahkan atau diperbarui, sistem akan secara otomatis membuat backup titik pemulihan baru di folder terproteksi `/data/backups/`. Keamanan biner dilindungi melalui mekanisme penulisan berkas atomic.
                    </p>
                  </div>

                  <button
                    onClick={handleTriggerManualBackup}
                    disabled={operationLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 text-white text-sm font-semibold rounded-xl transition cursor-pointer shrink-0 shadow-lg shadow-indigo-500/20"
                  >
                    <RefreshCw className={operationLoading ? 'animate-spin' : ''} size={16} />
                    Mulai Backup Manual
                  </button>
                </div>

                {/* Backups file list */}
                <div className="glass-panel rounded-2xl p-6">
                  <h3 className="font-display font-semibold text-gray-200 text-sm mb-4 flex items-center gap-2">
                    <History size={16} className="text-gray-400" />
                    Riwayat Titik Cadangan Lokal (Maks. 10 Cadangan Tersimpan)
                  </h3>

                  {backups.length === 0 ? (
                    <div className="text-center p-8 text-gray-500 text-xs font-mono">
                      Tidak ada rekaman cadangan database saat ini. Tambahkan file untuk menghasilkan pencadangan otomatis.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {backups.map(backup => (
                        <div
                          key={backup.filename}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 glass-card rounded-xl gap-4 hover:border-white/10 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                              <p className="text-xs font-mono font-semibold text-gray-200 leading-none truncate max-w-[280px] sm:max-w-[400px]">
                                {backup.filename}
                              </p>
                            </div>
                            <p className="text-[10px] text-gray-500 font-mono flex items-center gap-3">
                              <span>Ukuran: <span className="text-gray-400">{backup.size}</span></span>
                              <span>•</span>
                              <span>Waktu: <span className="text-gray-400">{new Date(backup.timestamp).toLocaleString()}</span></span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleRestoreBackup(backup.filename)}
                              disabled={operationLoading}
                              className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 border border-amber-500/15 hover:border-amber-500/40 text-amber-400 hover:text-white text-xs font-medium rounded-lg transition cursor-pointer"
                              title="Pulihkan Keadaan Database"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handleDeleteBackup(backup.filename)}
                              disabled={operationLoading}
                              className="p-1.5 bg-red-950/20 hover:bg-red-950/80 border border-red-500/15 hover:border-red-500/30 text-red-400 rounded-lg transition cursor-pointer"
                              title="Hapus Backup"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB 4: Sistem Monitor & Keamanan (Audit Logs Panel) */}
            {selectedTab === 'logs' && (
              <motion.div
                key="logs-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                {/* Technical documentation Card */}
                <div className="lg:col-span-6 space-y-6">
                  {/* System Overview */}
                  <div className="glass-panel rounded-2xl p-5 space-y-3">
                    <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                      <ShieldCheck size={16} className="text-emerald-400" />
                      Arsitektur Keamanan File & Database
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Sistem dirancang untuk mencegah korupsi data (corruption) pada file flat JSON di lingkungan multithreading/konkurensi tinggi.
                    </p>

                    <div className="space-y-3.5 pt-2">
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-gray-200">1. Penulisan Atomic Writes</h4>
                        <p className="text-[11px] text-gray-400 leading-normal">
                          Setiap penulisan file ke database dilakukan dengan menulis data ke file `.tmp` terlebih dahulu sebelum melakukan penamaan ulang (rename) secara atomic menggunakan operasi kernel OS.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-gray-200">2. Gatekeeping Unduhan</h4>
                        <p className="text-[11px] text-gray-400 leading-normal">
                          File aplikasi disimpan di luar direktori publik. Pengunduhan dilakukan lewat middleware backend yang memeriksa peran Discord serta validitas token sesi (headers atau parameter token query).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Atomic write function showcase */}
                  <div className="glass-panel rounded-2xl p-5">
                    <h3 className="font-display font-bold text-white text-sm mb-3 flex items-center gap-2">
                      <Terminal size={16} className="text-indigo-400" />
                      Implementasi Kode Atomic Write
                    </h3>
                    <pre className="text-[10px] font-mono text-indigo-300 bg-black/40 glass-card p-4 rounded-xl border border-white/5 overflow-x-auto leading-relaxed scrollbar-none">
{`async function atomicWriteJson(filePath, data) {
  const tempPath = \`\${filePath}.tmp\`;
  const jsonString = JSON.stringify(data, null, 2);
  
  // 1. Tulis ke file temporer terlebih dahulu
  await fs.writeFile(tempPath, jsonString, 'utf8');

  // 2. Lakukan rename secara atomic (kernel lock)
  await fs.rename(tempPath, filePath);
}`}
                    </pre>
                  </div>
                </div>

                {/* Audit trail / Simulation logs panel */}
                <div className="lg:col-span-6">
                  <div className="glass-panel rounded-2xl p-5 flex flex-col h-full min-h-[450px]">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
                      <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                        <Terminal size={16} className="text-indigo-400" />
                        Audit Trail Keamanan & Server
                      </h3>
                      <button
                        onClick={() => setAuditLogs([])}
                        className="text-[10px] font-mono text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                      >
                        Bersihkan Log
                      </button>
                    </div>

                    {/* Virtual audit trail console */}
                    <div className="flex-grow bg-black/30 glass-card p-4 rounded-xl overflow-y-auto max-h-[380px] font-mono text-[11px] space-y-3.5 scrollbar-thin">
                      {auditLogs.length === 0 ? (
                        <div className="text-center py-10 text-gray-600">
                          [Menunggu interaksi server untuk mencatat log audit...]
                        </div>
                      ) : (
                        auditLogs.map(log => (
                          <div key={log.id} className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-gray-500">
                              <span>[{log.timestamp}]</span>
                              <span className={`px-1.5 py-0.2 rounded font-bold uppercase tracking-wide text-[8px] ${
                                log.type === 'success'
                                  ? 'bg-emerald-950/80 text-emerald-400'
                                  : log.type === 'warning'
                                  ? 'bg-amber-950/80 text-amber-400'
                                  : log.type === 'error'
                                  ? 'bg-red-950/80 text-red-400'
                                  : 'bg-indigo-950/80 text-indigo-400'
                              }`}>
                                {log.action}
                              </span>
                            </div>
                            <p className="text-gray-300 leading-normal pl-2 border-l border-indigo-500/20">{log.details}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 5: Dashboard Admin (Advanced Telemetry & Session Management) */}
            {selectedTab === 'admin' && (
              <motion.div
                key="admin-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <AdminDashboard
                  token={token}
                  currentUserToken={token}
                  currentUser={user}
                  triggerToast={triggerToast}
                  addLog={addLog}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </main>

      {/* Main Footer layout */}
      <footer className="glass-panel rounded-t-2xl border-t border-[#1F293D]/20 py-5 text-center text-xs text-gray-500 flex flex-col sm:flex-row justify-between items-center px-6 max-w-7xl w-full mx-auto gap-3">
        <p>© 2026 Node X Manager • Portal Penyimpanan Aplikasi Amandemen.</p>
        <p className="font-mono text-[10px] text-gray-600">Atomic Writes • Sesi SULTAN/JURAGAN Terotentikasi</p>
      </footer>
    </div>
  );
}
