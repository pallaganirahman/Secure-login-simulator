import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, KeyRound, Clock, LogOut, CheckCircle2, Lock, Smartphone, RefreshCw, Loader2, ChevronRight, HelpCircle } from 'lucide-react';
import { MfaSetup } from './MfaSetup';

interface DashboardProps {
  username: string;
  onLogout: () => void;
}

export function Dashboard({ username, onLogout }: DashboardProps) {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mfaTokenInput, setMfaTokenInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [securityScore, setSecurityScore] = useState(65);

  const checkMfaStatus = async () => {
    setIsRefreshing(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      // To get real MFA status, let's fetch from user history or simple profile values
      setMfaEnabled(data.isLoggedIn && !data.mfaRequired);
      
      // Let's call another API / Fetch details specifically on user profile
      const sqlRes = await fetch('/api/sql-history');
      const sqlData = await sqlRes.json();
      // Find if we had an update turning on MFA for this username
      const mfaUpdate = sqlData.logs.some(
        (log: any) =>
          log.queryType === 'UPDATE' &&
          log.rawQuery.includes('mfa_enabled = ?') &&
          log.parameters[1] === true
      );
      
      setMfaEnabled(mfaUpdate);
      setSecurityScore(mfaUpdate ? 100 : 65);
    } catch {
      // safe fallback
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkMfaStatus();
  }, [showMfaSetup]);

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (mfaTokenInput.length !== 6) {
      setErrorMsg('Token must be a 6-digit number sequence.');
      return;
    }

    try {
      const res = await fetch('/api/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mfaTokenInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification invalid.');
      setSuccessMsg(data.message);
      setMfaTokenInput('');
      setMfaEnabled(false);
      setSecurityScore(65);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/logout', { method: 'POST' });
      if (res.ok) {
        onLogout();
      }
    } catch {
      onLogout(); // Force local logout anyway
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-150 pb-5">
        <div>
          <span className="text-[10px] bg-emerald-50 border border-emerald-250 text-emerald-700 px-2 py-0.5 rounded font-mono font-bold select-none tracking-wider uppercase inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Session Authenticated
          </span>
          <h2 className="text-2xl font-bold font-sans text-gray-900 tracking-tight mt-1.5 select-text">
            Welcome back, <span className="text-gray-950 font-extrabold">{username}</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1 select-none">
            Review cryptographic security indicators, active sessions, or configure key parameters.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="bg-white border border-[#E4E4E7] hover:bg-gray-50 hover:text-[#18181B] text-[#71717A] px-3.5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer outline-none shadow-sm select-none"
        >
          <LogOut className="w-4 h-4" />
          Secure Logout
        </button>
      </div>

      {showMfaSetup ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <MfaSetup
            onSuccess={() => {
              setShowMfaSetup(false);
              setMfaEnabled(true);
              setSecurityScore(100);
            }}
            onCancel={() => setShowMfaSetup(false)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main profile section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick dashboard cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-150 rounded-xl p-4 flex items-center gap-3 shadow-sm select-none">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 border border-emerald-150 rounded-lg flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                    Security Score
                  </span>
                  <span className="text-lg font-bold text-gray-800">{securityScore}%</span>
                  <span className="text-[10px] font-medium text-emerald-600 block">
                    {securityScore === 100 ? 'Defense Tier: High' : 'Defense Tier: Fair'}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-gray-150 rounded-xl p-4 flex items-center gap-3 shadow-sm select-none">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 border border-blue-150 rounded-lg flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                    Cipher Format
                  </span>
                  <span className="text-sm font-semibold text-gray-800 block mt-0.5">Bcrypt Work_Factor 12</span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">Salted Dynamic Round Key</span>
                </div>
              </div>

              <div className="bg-white border border-gray-150 rounded-xl p-4 flex items-center gap-3 shadow-sm select-none">
                <div className="w-10 h-10 bg-zinc-50 text-zinc-500 border border-zinc-200 rounded-lg flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                    Session Timeout
                  </span>
                  <span className="text-sm font-semibold text-gray-800 block mt-0.5">30 Minutes</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">Expires on browser idle</span>
                </div>
              </div>
            </div>

            {/* Account settings / MFA */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 select-none">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-gray-700" />
                  <h3 className="font-semibold text-gray-900 text-sm">Two-Factor Authentication (MFA)</h3>
                </div>
                <button
                  onClick={checkMfaStatus}
                  className="p-1.5 text-gray-400 hover:text-gray-900 rounded hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {mfaEnabled ? (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex gap-2.5 items-start">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">MFA Protection is ACTIVE</span>
                      <p className="mt-0.5 text-emerald-700 leading-normal">
                        Your account requires a dynamic Google Authenticator verification token in addition to your standard password hash during login attempts. Keep your mobile device synced.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleDisableMfa} className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2.5">
                    <span className="font-bold text-red-800 text-xs flex items-center gap-1 shrink-0 select-none">
                      Disable Multi-Factor Protection
                    </span>
                    <p className="text-[11px] text-red-600 leading-normal select-none">
                      Warning: Disabling 2FA reduces account credentials security, exposing the profile to offline wordlists if your query or sessions are bypassed. Enter your 6-digit mobile token code to disable:
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        className="font-mono text-center tracking-widest text-[#991B1B] text-xs px-3 py-1.5 border border-red-300 rounded-lg bg-white w-full sm:max-w-[150px] focus:outline-none focus:ring-1 focus:ring-red-400"
                        placeholder="000000"
                        value={mfaTokenInput}
                        onChange={(e) => setMfaTokenInput(e.target.value.replace(/\D/g, ''))}
                      />
                      <button
                        type="submit"
                        className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors"
                      >
                        Deactivate protection
                      </button>
                    </div>

                    {errorMsg && <p className="text-xs text-red-700 mt-1 select-none">{errorMsg}</p>}
                    {successMsg && <p className="text-xs text-emerald-700 mt-1 select-none">{successMsg}</p>}
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-250 text-amber-800 rounded-lg text-xs flex gap-2.5 items-start">
                    <Shield className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">MFA Protection is INACTIVE (Recommended Setup)</span>
                      <p className="mt-0.5 text-amber-700 leading-normal">
                        Without 2FA, your profile relies entirely on the strength of your password. Secure your records against credential stuffing and brute-force cracking.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowMfaSetup(true)}
                    className="w-full sm:w-auto bg-[#18181B] hover:bg-neutral-800 text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    Configure Authenticator App
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Education panel */}
          <div className="space-y-6">
            <div className="bg-gray-50 border border-gray-250 rounded-xl p-5 shadow-sm space-y-4 select-none">
              <h3 className="font-bold font-sans text-gray-900 text-sm flex items-center gap-1.5 select-none">
                <Lock className="w-4 h-4 text-blue-600" />
                Security Implementation
              </h3>

              <div className="space-y-3.5 text-xs text-gray-650">
                <div className="border-b border-gray-200 pb-2">
                  <span className="font-bold text-gray-900 block">Password Hashing Cryptography</span>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                    Passwords are never stored directly. Generates a random Salt, combining it with the cleartext before feeding into <strong>Bcrypt Type-2a blowfish</strong> keys. This blocks decryption even if data is exposed.
                  </p>
                </div>

                <div className="border-b border-gray-200 pb-2">
                  <span className="font-bold text-gray-900 block">HTTP Session Cookie Integrity</span>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                    Our cookies include <code className="bg-gray-150 px-1 py-0.5 rounded text-[10px] font-mono">HttpOnly=true</code>. This blocks browser access to the session ID, neutralizing common XSS cookie theft vectors.
                  </p>
                </div>

                <div>
                  <span className="font-bold text-gray-900 block">Escaping vs Prepared SQL</span>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                    By binding custom parameters as literals <code className="font-mono text-[9px] bg-gray-150 px-1 py-0.5 rounded">?</code>, SQL statement compilers treat text input strictly as characters rather than executable commands, neutralizing injection tricks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
