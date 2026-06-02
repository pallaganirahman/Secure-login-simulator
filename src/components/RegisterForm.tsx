import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface RegisterFormProps {
  onRegisterSuccess: (user: any) => void;
  onToggleView: () => void;
}

export function RegisterForm({ onRegisterSuccess, onToggleView }: RegisterFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Password criteria indicators
  const [checks, setChecks] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false,
  });

  // Username validation
  const [usernameError, setUsernameError] = useState('');

  useEffect(() => {
    setChecks({
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    });
  }, [password]);

  const validateUsernameOnChange = (name: string) => {
    setUsername(name);
    if (!name) {
      setUsernameError('');
      return;
    }
    if (name.length < 3) {
      setUsernameError('Must be at least 3 characters.');
    } else if (name.length > 20) {
      setUsernameError('Cannot exceed 20 characters.');
    } else if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      setUsernameError('Letters, numbers, and underscores only.');
    } else {
      setUsernameError('');
    }
  };

  const isPasswordValid = Object.values(checks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (usernameError || !username) {
      setErrorMsg('Please enter a valid username first.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg('Please meet all secure password criteria requirements.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }
      setSuccessMsg(data.message);
      setUsername('');
      setPassword('');
      setTimeout(() => {
        onRegisterSuccess(data.user);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl flex items-center justify-center mb-4 text-[#059669]">
          <Shield className="w-6 h-6 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-[#18181B] tracking-tight">Create Secure Account</h2>
        <p className="text-sm text-[#71717A] mt-1 text-center">
          Register with cryptographic hashing algorithms and strong input enforcement patterns.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#4B5563] uppercase tracking-wider mb-1">
            Username
          </label>
          <input
            type="text"
            className={`w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
              usernameError
                ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                : 'border-[#E4E4E7] focus:ring-emerald-100 focus:border-emerald-500'
            }`}
            placeholder="alice_secure"
            value={username}
            onChange={(e) => validateUsernameOnChange(e.target.value)}
            disabled={isLoading}
            required
          />
          {usernameError ? (
            <p className="text-xs text-red-500 mt-1 select-none">{usernameError}</p>
          ) : (
            <p className="text-[11px] text-[#9CA3AF] mt-1 select-none">
              Input validation filters out SQL characters like single quotes (') or comments (--).
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B5563] uppercase tracking-wider mb-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all font-mono"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
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

        {/* Live Password Strength Requirements Block */}
        <div className="bg-[#FAF9F6] border border-[#F4EFE6] rounded-lg p-3 text-xs space-y-2 select-none">
          <p className="font-semibold text-gray-700">Cryptographic Defense Standards:</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5">
              {checks.length ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <div className="w-4 h-4 border border-gray-300 rounded-full shrink-0" />
              )}
              <span className={checks.length ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                8+ Characters
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {checks.upper ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <div className="w-4 h-4 border border-gray-300 rounded-full shrink-0" />
              )}
              <span className={checks.upper ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                Uppercase (A-Z)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {checks.lower ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <div className="w-4 h-4 border border-gray-300 rounded-full shrink-0" />
              )}
              <span className={checks.lower ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                Lowercase (a-z)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {checks.number ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <div className="w-4 h-4 border border-gray-300 rounded-full shrink-0" />
              )}
              <span className={checks.number ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                Number (0-9)
              </span>
            </div>
            <div className="flex items-center gap-1.5 col-span-2">
              {checks.special ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <div className="w-4 h-4 border border-gray-300 rounded-full shrink-0" />
              )}
              <span className={checks.special ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                Special Char (!@#$%^&*)
              </span>
            </div>
          </div>
          <div className="border-t border-[#F2EDE2] pt-1.5 mt-1 text-[11px] text-gray-500 leading-normal">
            <strong>Bcrypt Protection:</strong> Hashed passwords use automatic 12-round salt work factors ensuring they are mathematically secure against dictionary cracking or rainbow table lookups.
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-[#18181B] hover:bg-neutral-800 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          disabled={isLoading || usernameError !== '' || !password}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Encrypting & Registering...
            </>
          ) : (
            'Hash and Register'
          )}
        </button>
      </form>

      <div className="mt-5 text-center text-xs">
        <span className="text-[#71717A]">Already have an account? </span>
        <button
          onClick={onToggleView}
          className="text-emerald-600 hover:text-emerald-700 font-semibold underline underline-offset-2"
        >
          Login safely
        </button>
      </div>
    </div>
  );
}
