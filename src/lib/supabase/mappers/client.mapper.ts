import { Client } from '@/context/types';
import { num, parseJsonField } from './utils';

export function mapClientFromDb(row: Record<string, unknown>): Client {
  return {
    id: row.id_cliente as number,
    nombre: String(row.nombre ?? ''),
    dni: row.dni ? String(row.dni) : '',
    telefono: row.telefono ? String(row.telefono) : '',
    email: row.email ? String(row.email) : '',
    saldoCred: num(row.saldo_credito),
    historialPagos: parseJsonField(row.historial_pagos, []),
    active: row.estado === 1,
  };
}

export function mapClientsFromDb(rows: Record<string, unknown>[] | null | undefined): Client[] {
  if (!rows) return [];
  return rows.map(mapClientFromDb);
}