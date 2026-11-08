import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  ShieldCheck, 
  Lock, 
  Key, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Loader2
} from 'lucide-react';
import { backupService } from '@/services/backup';
import { useChat } from '@/context/ChatContext';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const { refreshContacts, refreshGroups } = useChat();

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (passphrase.length < 4) {
      setStatusMessage({ text: 'Passphrase must be at least 4 characters.', type: 'error' });
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setStatusMessage({ text: 'Passphrases do not match.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const blob = await backupService.exportBackup(passphrase);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shield-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({ text: 'Encrypted backup generated and downloaded successfully.', type: 'success' });
      setPassphrase('');
      setConfirmPassphrase('');
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Export failed.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!selectedFile) {
      setStatusMessage({ text: 'Please select a backup file to import.', type: 'error' });
      return;
    }
    if (!importPassphrase) {
      setStatusMessage({ text: 'Please enter the decryption passphrase.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const result = await backupService.importBackup(selectedFile, importPassphrase);
      await refreshContacts();
      await refreshGroups();
      setStatusMessage({
        text: `Restored ${result.conversationsCount} conversations and ${result.messagesCount} messages successfully.`,
        type: 'success'
      });
      setSelectedFile(null);
      setImportPassphrase('');
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Import failed. Check password.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-md bg-obsidian-900 border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Data Portability & Backup</h3>
              <p className="text-xs text-slate-400">Zero Cloud · AES-256-GCM E2EE</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-white/[0.04] border border-white/10 rounded-2xl my-4 text-xs font-semibold">
          <button
            onClick={() => { setActiveTab('export'); setStatusMessage(null); }}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
              activeTab === 'export'
                ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Export Backup
          </button>
          <button
            onClick={() => { setActiveTab('import'); setStatusMessage(null); }}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
              activeTab === 'import'
                ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Restore Backup
          </button>
        </div>

        {/* Status notification */}
        {statusMessage && (
          <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 mb-3 ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'export' ? (
            <form onSubmit={handleExport} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Export all local conversations and messages into a single encrypted JSON file. 
                Your backup is protected with <span className="text-cyan-400 font-mono">PBKDF2 (100k rounds)</span> and <span className="text-cyan-400 font-mono">AES-256-GCM</span>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  Set Backup Passphrase
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  placeholder="Enter strong passphrase..."
                  className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm Passphrase
                </label>
                <input
                  type="password"
                  value={confirmPassphrase}
                  onChange={e => setConfirmPassphrase(e.target.value)}
                  placeholder="Confirm passphrase..."
                  className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Download Encrypted Backup</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleImport} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Restore conversations and messages from an encrypted Shield P2P backup file.
              </p>

              {/* File input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  Select Backup File (.json)
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  Passphrase
                </label>
                <input
                  type="password"
                  value={importPassphrase}
                  onChange={e => setImportPassphrase(e.target.value)}
                  placeholder="Enter backup passphrase..."
                  className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>Decrypt &amp; Restore</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
