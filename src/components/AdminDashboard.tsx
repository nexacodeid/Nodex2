import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ShieldAlert,
  Users,
  Database,
  HardDrive,
  Cpu,
  Trash2,
  RefreshCw,
  Clock,
  LogOut,
  AppWindow,
  Tag,
  ShieldAlert as ShieldIcon
} from 'lucide-react';

interface AdminStats {
  dbSizeKb: number;
  uploadsSizeMb: number;
  uploadsCount: number;
  backupsSizeMb: number;
  backupsCount: number;
  activeSessionsCount: number;
  totalApps: number;
  totalDownloads: number;
  memoryHeapUsedMb: number;
  memoryHeapTotalMb: number;
  nodeVersion: string;
  platform: string;
  uptimeSeconds: number;
  categoryData: {
    name: string;
    appsCount: number;
    downloadsCount: number;
  }[];
}

interface UserSessionItem {
  tokenHash: string;
  rawToken: string;
  userId: string;
  username: string;
  globalName?: string;
  avatar: string;
  role: string;
  expiresAt: number;
}

interface AdminDashboardProps {
  token: string | null;
  currentUserToken: string | null;
  currentUser: { userId: string; username: string } | null;
  triggerToast: (text: string, type: 'success' | 'error' | 'info') => void;
  addLog: (action: string, details: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function AdminDashboard({
  token,
  currentUserToken,
  currentUser,
  triggerToast,
  addLog
}: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAdminData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch telemetry stats
      const statsRes = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      // Fetch active sessions
      const sessionsRes = await fetch('/api/admin/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load admin telemetry:', err);
      triggerToast('Gagal menyelaraskan data admin.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 30000); // Auto-refresh statistics every 30s
    return () => clearInterval(interval);
  }, [token]);

  const handleRevokeSession = async (sessionTokenToRevoke: string, usernameToRevoke: string) => {
    if (sessionTokenToRevoke === currentUserToken) {
      triggerToast('Anda tidak dapat mencabut sesi Anda sendiri.', 'error');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin mencabut paksa sesi untuk "${usernameToRevoke}"? Pengguna akan segera dikeluarkan dari portal.`)) {
      return;
    }

    setActionLoading(sessionTokenToRevoke);
    try {
      const res = await fetch('/api/admin/sessions/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tokenToRevoke: sessionTokenToRevoke })
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast(`Sesi "${usernameToRevoke}" berhasil dicabut secara permanen.`, 'success');
        addLog('Session Revoked', `Sesi administrator mencabut akses token untuk user ${usernameToRevoke}.`, 'warning');
        fetchAdminData();
      } else {
        triggerToast(data.message || 'Gagal mencabut sesi.', 'error');
      }
    } catch (err) {
      triggerToast('Terjadi kesalahan koneksi server.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const formatUptime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs}j ${mins}m ${secs}d`;
  };

  if (loading && !stats) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center text-gray-400 space-y-3">
        <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto" />
        <p className="text-sm font-mono">Memuat Metrik & Telemetri Server Admin...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Ringkas */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
            <Cpu className="text-indigo-400" size={20} />
            Dasbor Administrasi Portal
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Pantau statistik database JSON flat-file, penggunaan penyimpanan fisik, dan batalkan sesi otorisasi aktif secara real-time.
          </p>
        </div>
        <button
          onClick={fetchAdminData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-xl border border-white/5 transition duration-150"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Segarkan Data
        </button>
      </div>

      {/* 2. Bento Grid Telemetry */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Database Stats Card */}
          <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 border-l-2 border-l-indigo-500">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Database size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold font-mono text-gray-500 uppercase tracking-wider">DATABASE SIZE</p>
              <p className="text-lg font-bold font-display text-white mt-0.5">{stats.dbSizeKb} KB</p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">Tipe: Flat JSON (Atomic)</p>
            </div>
          </div>

          {/* Uploads Directory Card */}
          <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 border-l-2 border-l-emerald-500">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <HardDrive size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold font-mono text-gray-500 uppercase tracking-wider">PHYSICAL FILES</p>
              <p className="text-lg font-bold font-display text-white mt-0.5">{stats.uploadsSizeMb} MB</p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">{stats.uploadsCount} File Tersimpan</p>
            </div>
          </div>

          {/* Backup Storage Card */}
          <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 border-l-2 border-l-amber-500">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <HardDrive size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold font-mono text-gray-500 uppercase tracking-wider">BACKUPS VAULT</p>
              <p className="text-lg font-bold font-display text-white mt-0.5">{stats.backupsSizeMb} MB</p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">{stats.backupsCount} Titik Cadangan</p>
            </div>
          </div>

          {/* Active Sessions Counter Card */}
          <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 border-l-2 border-l-rose-500">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Users size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold font-mono text-gray-500 uppercase tracking-wider">ACTIVE SESSIONS</p>
              <p className="text-lg font-bold font-display text-white mt-0.5">{stats.activeSessionsCount} Pengguna</p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">Sesi Terdaftar Memori</p>
            </div>
          </div>

        </div>
      )}

      {/* 3. Advanced Specs & Charts */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Server Process Heap Utilization (Custom visual dials / meters) */}
          <div className="lg:col-span-4 glass-panel p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="font-display font-semibold text-gray-200 text-sm mb-4 flex items-center gap-2">
                <Cpu size={16} className="text-indigo-400" />
                Telemetri Proses Server (Node.js)
              </h3>
              
              {/* Circular Gauge / progress chart */}
              <div className="relative w-36 h-36 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-gray-800"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  {/* Foreground Progress */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-indigo-500"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * (stats.memoryHeapUsedMb / stats.memoryHeapTotalMb))}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                  />
                </svg>
                {/* Dial Text Overlay */}
                <div className="absolute text-center">
                  <p className="text-xs text-gray-500 font-mono">HEAP USED</p>
                  <p className="text-base font-bold text-white font-display mt-0.5">
                    {Math.round((stats.memoryHeapUsedMb / stats.memoryHeapTotalMb) * 100)}%
                  </p>
                  <p className="text-[9px] text-indigo-300 font-mono mt-0.5">{stats.memoryHeapUsedMb} MB</p>
                </div>
              </div>

              {/* Status details bar */}
              <div className="space-y-2 text-xs font-mono border-t border-gray-800/80 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Node Engine:</span>
                  <span className="text-gray-300">{stats.nodeVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Platform Host:</span>
                  <span className="text-gray-300 uppercase">{stats.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Uptime Server:</span>
                  <span className="text-indigo-400 flex items-center gap-1">
                    <Clock size={11} />
                    {formatUptime(stats.uptimeSeconds)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Category-wise Distribution and Downloads Chart */}
          <div className="lg:col-span-8 glass-panel p-5 rounded-2xl">
            <h3 className="font-display font-semibold text-gray-200 text-sm mb-4 flex items-center gap-2">
              <Tag size={16} className="text-emerald-400" />
              Statistik Kategori Aplikasi & Unduhan
            </h3>

            {stats.categoryData.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs">
                Belum ada data distribusi kategori aplikasi.
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {stats.categoryData.map(cat => {
                  const maxApps = Math.max(...stats.categoryData.map(c => c.appsCount), 1);
                  const maxDownloads = Math.max(...stats.categoryData.map(c => c.downloadsCount), 1);
                  return (
                    <div key={cat.name} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-gray-300">{cat.name}</span>
                        <span className="text-[10px] font-mono text-gray-500">
                          {cat.appsCount} Apps • {cat.downloadsCount} Unduhan
                        </span>
                      </div>
                      
                      {/* Bar 1: Apps Count */}
                      <div className="space-y-1">
                        <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden border border-white/5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(cat.appsCount / maxApps) * 100}%` }}
                            transition={{ duration: 0.8 }}
                            className="bg-indigo-600 h-full rounded-full"
                          />
                        </div>

                        {/* Bar 2: Downloads Count */}
                        <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(cat.downloadsCount / maxDownloads) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                            className="bg-emerald-500 h-full rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-4 pt-2 text-[10px] font-mono text-gray-500 border-t border-gray-800/60">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-indigo-600 rounded"></span>
                    <span>Distribusi Jumlah Aplikasi</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-1.5 bg-emerald-500 rounded"></span>
                    <span>Tingkat Popularitas (Total Unduhan)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 4. Active Sessions Revocation List */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-800">
          <h3 className="font-display font-semibold text-gray-200 text-sm flex items-center gap-2">
            <Users size={16} className="text-indigo-400" />
            Manajemen Sesi Pengguna Aktif ({sessions.length})
          </h3>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-950/40 border border-indigo-500/20 text-indigo-300">
            Sesi Tersimpan In-Memory
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-xs font-mono">
            [Tidak ada sesi pengguna aktif yang tercatat]
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 font-mono text-[10px] uppercase">
                  <th className="py-3 px-3">Pengguna</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Session Hash</th>
                  <th className="py-3 px-3">Tanggal Kedaluwarsa</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {sessions.map(sess => {
                  const isCurrentUser = sess.userId === currentUser?.userId;
                  return (
                    <tr key={sess.tokenHash} className="hover:bg-white/2 transition">
                      <td className="py-3 px-3 flex items-center gap-2.5">
                        <img
                          src={sess.avatar}
                          alt="Avatar"
                          className="w-7 h-7 rounded-full border border-gray-700"
                        />
                        <div>
                          <p className="font-semibold text-gray-200">
                            {sess.globalName || sess.username}
                            {isCurrentUser && (
                              <span className="ml-1.5 text-[8px] bg-indigo-600 border border-indigo-400/30 text-white px-1.5 py-0.5 rounded">
                                Sesi Anda
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono">ID: {sess.userId}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                          sess.role === 'SULTAN'
                            ? 'bg-amber-950/40 border border-amber-500/20 text-amber-400'
                            : 'bg-emerald-950/40 border border-emerald-500/20 text-emerald-400'
                        }`}>
                          {sess.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-400 text-[10px]">
                        sha256:{sess.tokenHash}...
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-400">
                        {new Date(sess.expiresAt).toLocaleTimeString()} {new Date(sess.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleRevokeSession(sess.rawToken, sess.username)}
                          disabled={isCurrentUser || actionLoading === sess.rawToken}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition duration-150 cursor-pointer ${
                            isCurrentUser
                              ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
                              : 'bg-red-950/20 hover:bg-red-600 hover:text-white border-red-500/20 hover:border-red-500 text-red-400'
                          }`}
                        >
                          <LogOut size={10} />
                          {actionLoading === sess.rawToken ? 'Mencabut...' : 'Cabut Sesi'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
