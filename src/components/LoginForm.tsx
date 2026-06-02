import React, { useState } from 'react';
import { Shield, ShieldAlert, KeyRound, Loader2, Eye, EyeOff, AlertTriangle, HelpCircle } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (session: any) => void;
  onToggleView: () => void;
  securityMode: 'secure' | 'vulnerable';
  setSecurityMode: (mode: 'secure' | 'vulnerable') => void;
}

export function LoginForm({ onLoginSuccess, onToggleView, securityMode, setSecurityMode }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessInfo(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, securityMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      if (data.exploited) {
        setSuccessInfo(data);
        setTimeout(() => {
          onLoginSuccess(data);
        }, 3000);
      } else {
        onLoginSuccess(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getQueryPreview = () => {
    if (securityMode === 'secure') {
      return `// Parameterized Statement (SQL Injection Safe)
db.prepare("SELECT * FROM users WHERE username = ?", ["${username || 'input_user'}"])`;
    } else {
      return `// Vulnerable String Concatenation Query (Dangerous)
SELECT * FROM users WHERE username = '${username || 'input_user'}' AND password = '${password || 'input_pass'}'`;
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center mb-6">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all ${
            securityMode === 'secure'
              ? 'bg-[#EFF6FF] border border-[#BFDBFE] text-blue-600'
              : 'bg-amber-50 border border-amber-200 text-amber-600 animate-pulse'
          }`}
        >
          {securityMode === 'secure' ? <Shield className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
        </div>
        <h2 className="text-xl font-bold text-[#18181B] tracking-tight">System Authentication</h2>
        <p className="text-sm text-[#71717A] mt-1 text-center">
          Authenticate using live security state configurations. Choose your backend engine mode.
        </p>
      </div>

      {/* Security Mode Selector Toggle */}
      <div className="mb-5 bg-gray-100 p-1.5 rounded-xl border border-gray-200 grid grid-cols-2 gap-1.5 text-xs select-none">
        <button
          type="button"
          onClick={() => {
            setSecurityMode('secure');
            setErrorMsg('');
          }}
          className={`py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all outline-none ${
            securityMode === 'secure'
              ? 'bg-white shadow-sm text-blue-700'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Secure Mode
        </button>
        <button
          type="button"
          onClick={() => {
            setSecurityMode('vulnerable');
            setErrorMsg('');
          }}
          className={`py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all outline-none ${
            securityMode === 'vulnerable'
              ? 'bg-amber-50 border border-amber-200 shadow-sm text-amber-800'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Vulnerable Mode
        </button>
      </div>

      {/* Query Simulation Console Bar */}
      <div className="mb-4 bg-zinc-950 rounded-lg p-3 font-mono text-[10px] text-zinc-300 border border-zinc-850 select-text overflow-x-auto relative">
        <span className="absolute right-2 top-2 px-1.5 py-0.5 bg-zinc-800 text-[9px] text-zinc-400 rounded">
          Query Sandbox
        </span>
        <pre className="mt-1 font-mono whitespace-pre-wrap leading-tight">{getQueryPreview()}</pre>
      </div>

      {securityMode === 'vulnerable' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs space-y-1 select-none">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>SQL Injection Vulnerability Active!</span>
          </div>
          <p className="text-[#6B4013]">
            Raw text parameters are interpolated directly. Attacking username using{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-semibold">admin' --</code> or{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-semibold">' OR '1'='1</code> will bypass password checking completely!
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="text-xs leading-normal">{errorMsg}</span>
        </div>
      )}

      {successInfo && successInfo.exploited && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 text-purple-800 rounded-lg text-xs space-y-1 animate-pulse">
          <div className="flex items-center gap-1.5 font-bold">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>EXPLOIT CONFIRMED!</span>
          </div>
          <p className="leading-normal text-[#581C87]">
            The interpolated SQL query matched <strong>{successInfo.matchingRows} database rows</strong> without verifying password keys. Automatically logged in as <strong>"{username || 'database user'}"</strong>!
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#4B5563] uppercase tracking-wider mb-1">
            Username
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
            placeholder={securityMode === 'vulnerable' ? "admin' --" : "admin"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B5563] uppercase tracking-wider mb-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-mono"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required={securityMode === 'secure'} // In vulnerable mode, password might be left blank during SQL injection!
            />
            <button
              type="button"
              className="absolute right-2.5 top-2 text-[#71717A] hover:text-[#18181B]"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
            securityMode === 'secure'
              ? 'bg-[#18181B] hover:bg-neutral-800 text-white'
              : 'bg-amber-600 hover:bg-amber-700 text-white'
          }`}
          disabled={isLoading || !username}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying credentials...
            </>
          ) : securityMode === 'secure' ? (
            'Secure Authenticate'
          ) : (
            'Execute SQL Query (Vulnerable)'
          )}
        </button>
      </form>

      <div className="mt-5 text-center text-xs select-none">
        <span className="text-[#71717A]">New around here? </span>
        <button
          onClick={onToggleView}
          className="text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-2"
        >
          Create secure wallet
        </button>
      </div>

      {/* Preset Hints */}
      <div className="mt-5 border-t border-[#F4F4F5] pt-4 select-none">
        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-2">
          <KeyRound className="w-3.5 h-3.5 text-gray-400" />
          Default Credentials Seed Logs:
        </h4>
        <div className="space-y-1.5 text-xs text-gray-600">
          <div className="flex justify-between items-center text-[11px] bg-gray-50 border border-gray-150 p-1.5 rounded">
            <span><strong>User:</strong> admin / AliceSecure@2026</span>
            <button
              onClick={() => {
                setUsername('alice');
                setPassword('AliceSecure@2026');
              }}
              className="text-[10px] text-blue-600 hover:underline px-1 bg-white border rounded border-blue-200"
            >
              Autofill
            </button>
          </div>
          <div className="flex justify-between items-center text-[11px] bg-gray-50 border border-gray-150 p-1.5 rounded">
            <span><strong>Admin:</strong> admin / AdminP@ss123</span>
            <button
              onClick={() => {
                setUsername('admin');
                setPassword('AdminP@ss123');
              }}
              className="text-[10px] text-blue-600 hover:underline px-1 bg-white border rounded border-blue-200"
            >
              Autofill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
