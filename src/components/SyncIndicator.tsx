"use client";

import { SyncStatus } from '@/hooks/useSupabaseRealtime';
import { isSupabaseConfigured } from '@/lib/supabase';

interface SyncIndicatorProps {
  status: SyncStatus;
  lastSyncedAt: Date | null;
}

const STATUS_CONFIG: Record<
  SyncStatus,
  { icon: string; label: string; className: string }
> = {
  synced: { icon: '🟢', label: 'Sincronizado', className: 'sync-chip--synced' },
  syncing: { icon: '🟡', label: 'Sincronizando…', className: 'sync-chip--syncing' },
  polling: { icon: '🔵', label: 'Sync automático', className: 'sync-chip--polling' },
  offline: { icon: '🔴', label: 'Sin conexión', className: 'sync-chip--offline' },
  error: { icon: '🔴', label: 'Error de sync', className: 'sync-chip--error' },
};

function formatLastSync(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function SyncIndicator({ status, lastSyncedAt }: SyncIndicatorProps) {
  if (!isSupabaseConfigured) {
    return (
      <div className="sync-chip sync-chip--local" title="Datos guardados localmente en este dispositivo">
        <span>💾</span>
        <span>Modo local</span>
      </div>
    );
  }

  const config = STATUS_CONFIG[status];
  const lastSync = formatLastSync(lastSyncedAt);

  return (
    <div
      className={`sync-chip ${config.className}`}
      title={lastSync ? `${config.label} · Última sync: ${lastSync}` : config.label}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}