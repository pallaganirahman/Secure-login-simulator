import React, { useState, useEffect } from 'react';
import { Terminal, Shield, ShieldCheck, ShieldAlert, AlertCircle, RefreshCw, Trash2, KeyRound } from 'lucide-react';
import { SQLAuditLog } from '../types';

interface SqlPlaygroundProps {
  onResetApp: () => void;
  shouldRefreshLogs: boolean;
  setShouldRefreshLogs: (val: boolean) => void;
}

export function SqlPlayground({ onResetApp, shouldRefreshLogs, setShouldRefreshLogs }: SqlPlaygroundProps) {
  const [logs, setLogs] = useState<SQLAuditLog[]>([]);
  const [consoleUser, setConsoleUser] = useState('');
  const [consolePass, setConsolePass] = useState('');
  const [runVulnerable, setRunVulnerable] = useState(false);
  const [isConsoleRunning, setIsConsoleRunning] = useState(false);
  const [consoleResult, setConsoleResult] = useState<any>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/sql-history');
      const data = await res.json();
      setLogs(data.logs);
    } catch {
      // quiet fallback
    }
  };

  useEffect(() => {
    fetchLogs();
    if (shouldRefreshLogs) {
      setShouldRefreshLogs(false);
    }
  }, [shouldRefreshLogs]);

  const handleRunConsole = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConsoleRunning(true);
    setConsoleResult(null);

    try {
      const res = await fetch('/api/sql-console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputUsername: consoleUser,
          inputPassword: consolePass,
          bypassSafety: runVulnerable,
        }),
      });
      const data = await res.json();
      setConsoleResult(data);
      fetchLogs();
    } catch (err: any) {
      setConsoleResult({ success: false, error: err.message });
    } finally {
      setIsConsoleRunning(false);
    }
  };

  const handleResetDatabase = async () => {
    if (confirm('Are you sure you want to flush all custom registered users and reset database to defaults?')) {
      try {
        const res = await fetch('/api/reset-db', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'System flushed.');
        onResetApp();
        fetchLogs();
      } catch (err: any) {
        alert('Reset failed.');
      }
    }
  };

  const loadPreset = (user: string, pass: string, isVuln: boolean) => {
    setConsoleUser(user);
    setConsolePass(pass);
    setRunVulnerable(isVuln);
    setConsoleResult(null);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
      {/* Test Sandbox Panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-4 border-b border-gray-150 pb-3 select-none">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-gray-700 animate-pulse" />
            <h3 className="font-bold text-gray-900 text-sm">Interactive SQL Injection Sandbox</h3>
          </div>
          <button
            onClick={fetchLogs}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
          >
            <RefreshCw className="w-3 h-3" /> Refresh Logs
          </button>
        </div>

        <p className="text-xs text-gray-500 leading-normal select-none">
          Experiment with SQL Injection payloads first-hand. Toggle between direct string interpolation (vulnerable database queries) and prepared parameterized bindings to view the visual execution output.
        </p>

        {/* Payload Presets Helper */}
        <div className="select-none">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-2">
            Select Educational Payloads:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadPreset("admin' --", "", true)}
              className="px-2 py-1.5 border border-amber-300 bg-amber-50 rounded text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Comment Bypass (<code className="font-mono text-stone-700 font-bold">admin' --</code>)
            </button>
            <button
              onClick={() => loadPreset("' OR '1'='1", "' OR '1'='1", true)}
              className="px-2 py-1.5 border border-amber-300 bg-amber-50 rounded text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Or Clause Bypass (<code className="font-mono text-stone-700 font-bold">OR '1'='1</code>)
            </button>
            <button
              onClick={() => loadPreset("alice", "AliceSecure@2026", false)}
              className="px-2 py-1.5 border border-blue-200 bg-blue-50 rounded text-[11px] font-semibold text-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              Secure Standard User (<code className="font-mono text-stone-700">alice</code>)
            </button>
          </div>
        </div>

        <form onSubmit={handleRunConsole} className="space-y-4 select-none">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                Username Query Value
              </label>
              <input
                type="text"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                placeholder="alice_secure"
                value={consoleUser}
                onChange={(e) => setConsoleUser(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                Password / Hash Value
              </label>
              <input
                type="text"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                placeholder="Password strength key"
                value={consolePass}
                onChange={(e) => setConsolePass(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-xs font-semibold text-gray-800">Interpolation Mode</span>
            <div className="flex gap-4 text-xs font-medium">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="sandboxMode"
                  checked={!runVulnerable}
                  onChange={() => setRunVulnerable(false)}
                  className="rounded-full border-blue-500 text-blue-600 focus:ring-blue-500"
                />
                Prepared Parameter
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-amber-800">
                <input
                  type="radio"
                  name="sandboxMode"
                  checked={runVulnerable}
                  onChange={() => setRunVulnerable(true)}
                  className="rounded-full border-amber-500 text-amber-600 focus:ring-amber-500"
                />
                Vulnerable Injected
              </label>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer select-none ${
              runVulnerable ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-750'
            }`}
            disabled={isConsoleRunning || !consoleUser}
          >
            {isConsoleRunning ? 'Compiling Query...' : 'Run Statement on Simulator'}
          </button>
        </form>

        {/* Sandbox Run Evaluation Output */}
        {consoleResult && (
          <div className="border border-gray-200 rounded-lg p-3.5 space-y-3.5 bg-zinc-950 font-mono text-xs text-zinc-300 select-text overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">
                SQL Execution Engine Output Overview
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  consoleResult.safe
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                    : 'bg-red-950 text-red-400 border border-red-900'
                }`}
              >
                {consoleResult.safe ? 'Prepared Standard Statement' : 'Injected Concatenation Statement'}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-zinc-500 block">RAW EXECUTED QUERY:</span>
                <pre className="text-[11px] text-zinc-100 whitespace-pre-wrap font-semibold font-mono leading-tight bg-zinc-900 border border-zinc-850 p-2 rounded mt-1">
                  {consoleResult.sqlUsed}
                </pre>
              </div>

              {consoleResult.success ? (
                <div>
                  <span className="text-[10px] text-zinc-500 block">
                    ROWS RETURNED FROM users TABLE: ({consoleResult.matchCount})
                  </span>
                  {consoleResult.matchCount > 0 ? (
                    <div className="max-h-[120px] overflow-y-auto space-y-1.5 mt-1.5 select-text">
                      {consoleResult.rows.map((row: any) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between text-[10px] bg-zinc-900 p-2 rounded border border-zinc-850 text-zinc-300"
                        >
                          <span className="font-bold text-zinc-100 font-mono">Row User: {row.username}</span>
                          <span className="text-zinc-400 font-mono">MFA: {row.mfa_enabled ? 'True' : 'False'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-500 italic mt-1 bg-zinc-900 p-2 rounded border border-zinc-850">
                      Empty Set. (Authentication rejected due to credential mismatch).
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2.5 bg-red-950/40 border border-red-900 rounded text-red-400 text-[11px]">
                  <strong>Query compilation crash:</strong> {consoleResult.error}
                </div>
              )}
            </div>

            <div className="text-[9px] text-zinc-500 leading-normal border-t border-zinc-850 pt-2 select-none">
              {consoleResult.safe ? (
                <span>
                  <strong>Safe Analysis:</strong> Escaping handles quotes appropriately, transforming `' OR '1'='1` into a literal comparative username rather than breaking SQL logic coordinates.
                </span>
              ) : (
                <span>
                  <strong>Exploit Analysis:</strong> Input escaped the boundaries. Standard SQL compiler reads the `'` to close username early, then appends secondary conditional tests like AND/OR, bypassing validation tests.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SQL Logs / History Dashboard */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-gray-150 pb-3 select-none">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-gray-700" />
            <h3 className="font-bold text-gray-900 text-sm">Database Transaction Audit Logs</h3>
          </div>

          <button
            onClick={handleResetDatabase}
            className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Wipe Simulator Database
          </button>
        </div>

        <p className="text-xs text-gray-500 leading-normal select-none">
          Real-time transaction history recording executed queries. Look for indicators of parameterized protections.
        </p>

        <div className="max-h-[350px] overflow-y-auto space-y-3 pr-1 divide-y divide-gray-100 select-text">
          {logs.length === 0 ? (
            <div className="py-20 text-center text-xs text-gray-400 italic font-medium select-none">
              No transactions recorded yet. Complete registrations or execute sandbox payloads to build records.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="pt-3 first:pt-0">
                <div className="flex items-center justify-between gap-2 mb-2 select-none">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        log.queryType === 'SELECT'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : log.queryType === 'INSERT'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}
                    >
                      {log.queryType}
                    </span>
                    <span
                      className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded border ${
                        log.isVulnerable
                          ? 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      }`}
                    >
                      {log.isVulnerable ? 'Vulnerable String Interpolation' : 'SQL-Safe Parameterized'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 font-mono text-[10px] text-zinc-300 mt-1 scrollbar-none overflow-x-auto relative">
                  <pre className="font-mono whitespace-pre-wrap leading-tight">{log.rawQuery}</pre>
                </div>

                {log.parameters && log.parameters.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] select-none text-gray-500">
                    <span className="font-semibold text-gray-700">Bound Parameters:</span>
                    <div className="flex flex-wrap gap-1">
                      {log.parameters.map((param, pidx) => (
                        <code key={pidx} className="bg-gray-150 px-1 py-0.5 rounded font-mono text-gray-600">
                          {typeof param === 'string' ? `"${param}"` : String(param)}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {log.errorMessage && (
                  <div className="mt-1.5 p-1.5 bg-red-50 text-red-600 rounded text-[10px] border border-red-200 flex items-center gap-1 select-none">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Error: {log.errorMessage}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
