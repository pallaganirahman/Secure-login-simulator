export interface User {
  id: string;
  username: string;
  passwordHash: string;
  mfaSecret?: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface SQLAuditLog {
  id: string;
  timestamp: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE';
  rawQuery: string;
  parameters: any[];
  isVulnerable: boolean;
  isSuccessful: boolean;
  errorMessage?: string;
}

export interface SecurityMetric {
  id: string;
  title: string;
  value: string | number;
  status: 'secure' | 'warning' | 'danger';
  description: string;
}

export interface UserSession {
  username: string | null;
  mfaRequired: boolean;
  mfaVerified: boolean;
  isLoggedIn: boolean;
}
