import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Lock, Unlock, Key, Terminal, Smartphone, Loader2, Info } from 'lucide-react';
import { SecureCard } from './components/SecureCard';
import { RegisterForm } from './components/RegisterForm';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { SqlPlayground } from './components/SqlPlayground';
import { UserSession } from './types';

export default function App() {
  const [userSession, setUserSession] = useState<UserSession>({
    isLoggedIn: false,
    mfaRequired: false,
    mfaVerified: false,
    username: null,
  });

  const [showRegister, setShowRegister] = useState(false);
  const [securityMode, setSecurityMode] = useState<'secure' | 'vulnerable'>('secure');
  
  // MFA login challenge states
  const [mfaCode, setMfaCode] = useState('');
  const [mfaIsLoading, setMfaIsLoading] = useState(false);
  const [mfaErrorMsg, setMfaErrorMsg] = useState('');

  // Playground Sync triggers
  const [shouldRefreshLogs, setShouldRefreshLogs] = useState(false);

  const fetchSessionStatus = async () => {
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      setUserSession({
        isLoggedIn: data.isLoggedIn,
        mfaRequired: data.mfaRequired,
        mfaVerified: !data.mfaRequired,
        username: data.username,
      });
    } catch {
      // quiet fallback
    }
  };

  useEffect(() => {
    fetchSessionStatus();
  }, []);

  const handleLoginSuccess = (data: any) => {
    setShouldRefreshLogs(true);
    if (data.mfaRequired) {
      setUserSession({
        isLoggedIn: false,
        mfaRequired: true,
        mfaVerified: false,
        username: data.username,
      });
    } else {
      setUserSession({
        isLoggedIn: true,
        mfaRequired: false,
        mfaVerified: false,
        username: data.username,
      });
    }
  };

  const handleRegisterSuccess = (user: any) => {
    setShouldRefreshLogs(true);
    setShowRegister(false);
    fetchSessionStatus();
  };

  const handleMfaChallengeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaErrorMsg('');
    setMfaIsLoading(true);

    try {
      const res = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mfaCode, actAsLoginChallenge: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid passcode token.');
      }

      setUserSession({
        isLoggedIn: true,
        mfaRequired: false,
        mfaVerified: true,
        username: userSession.username,
      });
      setMfaCode('');
      setShouldRefreshLogs(true);
    } catch (err: any) {
      setMfaErrorMsg(err.message);
    } finally {
      setMfaIsLoading(false);
    }
  };

  const handleLogoutSuccess = () => {
    setUserSession({
      isLoggedIn: false,
      mfaRequired: false,
      mfaVerified: false,
      username: null,
    });
    setShouldRefreshLogs(true);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans antialiased text-[#18181B] selection:bg-neutral-200">
      {/* Dynamic Top Status Alert */}
      <div className="bg-neutral-900 text-white text-xs py-2 px-4 shadow select-none flex items-center justify-between gap-4 font-mono font-medium">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
          <span className="text-zinc-300 truncate">
            {userSession.isLoggedIn
              ? `SESSION IDLE SECURE: logged as u_alias:@"${userSession.username}"`
              : `UNAUTHENTICATED CLIENT STATE: bcrypt_sha256 cipher rules activated`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-2 h-2 rounded-full ${securityMode === 'secure' ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
          <span className="hidden sm:inline uppercase text-[10px]">
            {securityMode === 'secure' ? 'Sanitization: Strict Enabled' : 'Sanitization: Disabled'}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Main Brand Title bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#18181B] border border-neutral-700 rounded-xl flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 font-sans">
                Secure Login Simulator
              </h1>
              <span className="text-xs text-gray-500 font-medium">
                Defense and analysis playground for authentication, password hashing, SQLi, and TOTP.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-gray-400" />
              PBKDF-Level Cryptography
            </span>
          </div>
        </div>

        {/* Layout Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main User login interaction card */}
          <div className="lg:col-span-4 lg:sticky lg:top-8 space-y-6">
            <SecureCard id="login-container-card">
              {userSession.isLoggedIn ? (
                // Dashboard Profile Screen
                <div id="dashboard-wrapper">
                  <Dashboard
                    username={userSession.username || 'User'}
                    onLogout={handleLogoutSuccess}
                  />
                </div>
              ) : userSession.mfaRequired ? (
                // Two factor verification screen during login challenge
                <div id="mfa-challenge-wrapper" className="space-y-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-600 mb-4 animate-bounce">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 tracking-tight">Two-Factor Authentication</h3>
                    <p className="text-xs text-gray-500 max-w-sm mt-1">
                      Account protection is active. Enter the 6-digit passcode generated by your Authenticator app.
                    </p>
                  </div>

                  {mfaErrorMsg && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs leading-normal">
                      {mfaErrorMsg}
                    </div>
                  )}

                  <form onSubmit={handleMfaChallengeSubmit} className="space-y-4">
                    <div>
                      <input
                        type="text"
                        maxLength={6}
                        className="w-full text-center tracking-[0.2em] font-mono text-xl font-bold py-2.5 px-3 border border-[#E4E4E7] rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="000000"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                        disabled={mfaIsLoading}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-[#18181B] hover:bg-neutral-800 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      disabled={mfaIsLoading || mfaCode.length !== 6}
                    >
                      {mfaIsLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        'Verify and Authorize'
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleLogoutSuccess}
                      className="w-full text-center text-xs text-blue-600 hover:underline inline-block mt-2 font-medium"
                    >
                      Return to authentication login screen
                    </button>
                  </form>
                </div>
              ) : showRegister ? (
                // Safe registration flow card
                <div id="register-wrapper">
                  <RegisterForm
                    onRegisterSuccess={handleRegisterSuccess}
                    onToggleView={() => setShowRegister(false)}
                  />
                </div>
              ) : (
                // Authentication login screen layout card
                <div id="login-wrapper">
                  <LoginForm
                    onLoginSuccess={handleLoginSuccess}
                    onToggleView={() => setShowRegister(true)}
                    securityMode={securityMode}
                    setSecurityMode={setSecurityMode}
                  />
                </div>
              )}
            </SecureCard>

            {/* Quick Education Callout Banner */}
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 select-none">
              <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider flex items-center gap-1 mb-2">
                <Info className="w-3.5 h-3.5 shrink-0" /> Architectural Overview
              </span>
              <p className="text-[11px] text-[#1E3A8A] leading-relaxed">
                Notice the difference when you toggle <strong>Secure Mode</strong> vs <strong>Vulnerable Mode</strong>. Using standard string concatenation causes the login database engine to match rows directly whenever boolean expressions evaluate to true, completely bypassing password checking hashes!
              </p>
            </div>
          </div>

          {/* Right SQL Sandbox console + Database audit views */}
          <div className="lg:col-span-8 space-y-6">
            <SqlPlayground
              onResetApp={handleLogoutSuccess}
              shouldRefreshLogs={shouldRefreshLogs}
              setShouldRefreshLogs={setShouldRefreshLogs}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
