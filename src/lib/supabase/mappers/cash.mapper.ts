import { CashDrop, CashHistoryRecord, CashSession, DenominacionArqueo } from '@/context/types';
import { num, parseJsonField } from './utils';

const EMPTY_DENOMINACIONES: DenominacionArqueo = {
  b100: 0, b50: 0, b20: 0, b10: 0,
  m5: 0, m2: 0, m1: 0, m050: 0, m020: 0, m010: 0,
};

function formatTime(value: unknown): string {
  if (!value) return '';
  return new Date(String(value)).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: unknown): string {
  if (!value) return '';
  return new Date(String(value)).toLocaleDateString();
}

function resolveCajeroFromProfile(profile: Record<string, unknown> | null | undefined): string | undefined {
  if (!profile) return undefined;
  const nombre = String(profile.nombre ?? '').trim();
  const apellido = String(profile.apellido_paterno ?? '').trim();
  const full = [nombre, apellido].filter(Boolean).join(' ');
  return full || undefined;
}

export function mapCashSessionFromDb(row: Record<string, unknown>): CashSession {
  return {
    id: row.id_cierre_caja as number,
    fec_apertura: row.fec_apertura ? new Date(String(row.fec_apertura)) : new Date(),
    date: formatDate(row.fec_apertura),
    tot_saldo_inicial: num(row.tot_saldo_inicial),
    tot_ventas_efectivo: num(row.tot_ventas_efectivo),
    tot_ventas_otros: num(row.tot_ventas_otros),
    tot_retiros: num(row.tot_retiros),
    estado: 'abierto',
    turno: row.turno ? String(row.turno) : undefined,
  };
}

export function mapCashHistoryFromDb(row: Record<string, unknown>): CashHistoryRecord {
  const profile = row.profiles as Record<string, unknown> | null | undefined;
  return {
    id: row.id_cierre_caja as number,
    fec_apertura: formatTime(row.fec_apertura),
    fec_cierre: formatTime(row.fec_cierre),
    date: formatDate(row.fec_apertura),
    monto_inicial: num(row.tot_saldo_inicial),
    monto_final: num(row.tot_saldo_final),
    ventas_efectivo: num(row.tot_ventas_efectivo),
    ventas_otros: num(row.tot_ventas_otros),
    tot_retiros: num(row.tot_retiros),
    diferencia: num(row.diferencia),
    estado: 'cerrado',
    cajero: resolveCajeroFromProfile(profile),
    turno: row.turno ? String(row.turno) : undefined,
    observaciones: row.observaciones ? String(row.observaciones) : undefined,
    denominaciones: row.denominaciones
      ? parseJsonField<DenominacionArqueo>(row.denominaciones, EMPTY_DENOMINACIONES)
      : undefined,
  };
}

export function mapCashHistoryListFromDb(rows: Record<string, unknown>[] | null | undefined): CashHistoryRecord[] {
  if (!rows) return [];
  return rows.map(mapCashHistoryFromDb);
}

export function mapCashDropFromDb(row: Record<string, unknown>): CashDrop {
  const profile = row.profiles as Record<string, unknown> | null | undefined;
  return {
    id: row.id_retiro as number,
    sessionId: row.id_cierre_caja as number,
    monto: num(row.monto),
    motivo: String(row.motivo ?? ''),
    cajero: resolveCajeroFromProfile(profile) || 'Sistema',
    hora: formatTime(row.fec_retiro),
  };
}

export function mapCashDropsFromDb(rows: Record<string, unknown>[] | null | undefined): CashDrop[] {
  if (!rows) return [];
  return rows.map(mapCashDropFromDb);
}