import React, { useState, useEffect } from 'react';
import { Key, Smartphone, Copy, Check, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';

interface MfaSetupProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function MfaSetup({ onSuccess, onCancel }: MfaSetupProps) {
  const [secret, setSecret] = useState('');
  const [qrUri, setQrUri] = useState('');
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [setupRunning, setSetupRunning] = useState(true);

  const fetchMfaSetup = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/mfa/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch setup variables');
      setSecret(data.secret);
      setQrUri(data.qrUri);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMfaSetup();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (token.length !== 6 || isNaN(Number(token))) {
      setErrorMsg('Token must be a 6-digit numeric sequence.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, setupSecret: secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification invalid.');
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const qrImageUrl = qrUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUri)}`
    : '';

  return (
    <div className="w-full">
      <div className="flex flex-col items-center mb-5 text-center">
        <div className="w-12 h-12 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl flex items-center justify-center mb-4 text-[#2563EB]">
          <Smartphone className="w-6 h-6 animate-bounce" />
        </div>
        <h2 className="text-xl font-bold text-[#18181B] tracking-tight">Set up Two-Factor Authentication</h2>
        <p className="text-xs text-[#71717A] mt-1 max-w-sm">
          Link standard Multi-Factor Authenticator apps (Google Authenticator, Microsoft, Duo) to elevate security profile.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          {errorMsg}
        </div>
      )}

      {isLoading && !secret ? (
        <div className="py-12 flex flex-col items-center justify-center text-sm text-[#71717A] gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
          <span>Generating multi-factor credentials...</span>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Instructions Step 1 */}
          <div className="bg-[#FAF9F6] border border-[#F4EFE6] rounded-lg p-3 text-xs text-[#52525B] leading-relaxed select-none">
            <span className="font-bold text-[#18181B] block mb-1">Step 1: Synchronize device</span>
            Download a TOTP generator app, then scan this barcode QR or paste the code directly:
          </div>

          {/* QR Code and Secret Key Frame */}
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-around bg-gray-50 border border-gray-150 p-4 rounded-xl">
            {qrImageUrl && (
              <div className="w-[180px] h-[180px] bg-white border border-[#E4E4E7] rounded-lg p-1.5 flex items-center justify-center relative shadow-sm select-none">
                <img
                  src={qrImageUrl}
                  alt="MFA QR Barcode"
                  className="w-full h-full"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <div className="space-y-3 w-full max-w-[200px] text-center sm:text-left select-none">
              <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider block">
                Secret Setup Key
              </span>
              <div className="flex items-center justify-between gap-1.5 bg-white border border-[#E4E4E7] px-2.5 py-1.5 rounded-lg select-all">
                <span className="font-mono text-xs font-semibold text-gray-800 tracking-wider">
                  {secret}
                </span>
                <button
                  onClick={handleCopy}
                  className="text-gray-400 hover:text-gray-900 cursor-pointer p-0.5 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 leading-normal">
                This secret is generated on-demand. Never share it with anyone.
              </p>
              <button
                onClick={fetchMfaSetup}
                className="text-[10px] inline-flex items-center gap-1 text-blue-600 hover:underline select-none cursor-pointer"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                Regenerate key
              </button>
            </div>
          </div>

          {/* Instructions Step 2 */}
          <div className="bg-[#FAF9F6] border border-[#F4EFE6] rounded-lg p-3 text-xs text-[#52525B] leading-relaxed select-none">
            <span className="font-bold text-[#18181B] block mb-1">Step 2: Enter Verification Code</span>
            Verify device synchronization coordinates. Submit the six-digit code that appears in your mobile app:
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <input
                type="text"
                maxLength={6}
                className="w-full text-center tracking-[0.25em] font-mono text-lg font-bold py-2.5 px-3 border border-[#E4E4E7] rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                placeholder="000000"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                disabled={isLoading}
                required
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 px-3 border border-[#E4E4E7] rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700 hover:text-gray-900 cursor-pointer transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                disabled={isLoading || token.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
