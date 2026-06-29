import { CashHistoryRecord, CashSession } from '@/context/types';
import { num } from './utils';

export function mapCashSessionFromDb(row: Record<string, unknown>): CashSession {
  return {
    id: row.id_cierre_caja as number,
    fec_apertura: row.fec_apertura ? new Date(String(row.fec_apertura)) : new Date(),
    tot_saldo_inicial: num(row.tot_saldo_inicial),
    tot_ventas_efectivo: num(row.tot_ventas_efectivo),
    tot_ventas_otros: num(row.tot_ventas_otros),
    tot_retiros: num(row.tot_retiros),
    estado: 'abierto',
  };
}

export function mapCashHistoryFromDb(row: Record<string, unknown>): CashHistoryRecord {
  return {
    id: row.id_cierre_caja as number,
    fec_apertura: row.fec_apertura ? new Date(String(row.fec_apertura)).toLocaleDateString() : '',
    fec_cierre: row.fec_cierre ? new Date(String(row.fec_cierre)).toLocaleDateString() : '',
    monto_inicial: num(row.tot_saldo_inicial),
    monto_final: num(row.tot_saldo_final),
    ventas_efectivo: num(row.tot_ventas_efectivo),
    ventas_otros: num(row.tot_ventas_otros),
    tot_retiros: num(row.tot_retiros),
    diferencia: num(row.diferencia),
    estado: 'cerrado',
  };
}

export function mapCashHistoryListFromDb(rows: Record<string, unknown>[] | null | undefined): CashHistoryRecord[] {
  if (!rows) return [];
  return rows.map(mapCashHistoryFromDb);
}