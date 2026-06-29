import { BreadLog } from '@/context/types';
import { num } from './utils';

function formatFecRegistro(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  return (
    d.toLocaleDateString() +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

function resolveProdName(row: Record<string, unknown>): string {
  const producto = row.productos as Record<string, unknown> | null | undefined;
  const version = row.producto_versiones as Record<string, unknown> | null | undefined;
  const base = producto?.nombre ? String(producto.nombre) : 'Producto';
  const verName = version?.nombre_version ? String(version.nombre_version) : '';
  return verName ? `${base} (${verName})` : base;
}

function resolveCajero(row: Record<string, unknown>): string | undefined {
  const profile = row.profiles as Record<string, unknown> | null | undefined;
  if (!profile) return undefined;
  const nombre = String(profile.nombre ?? '').trim();
  const apellido = String(profile.apellido_paterno ?? '').trim();
  const full = [nombre, apellido].filter(Boolean).join(' ');
  return full || undefined;
}

export function mapBreadLogFromDb(row: Record<string, unknown>): BreadLog {
  const tipo = String(row.tipo_registro ?? 'produccion') as BreadLog['type'];
  const motivo = row.motivo_descarte ? String(row.motivo_descarte) : '';

  return {
    id: row.id_registro as number,
    d: formatFecRegistro(row.fec_registro),
    prodName: resolveProdName(row),
    type: tipo === 'descarte' ? 'descarte' : 'produccion',
    qty: num(row.num_cantidad),
    reason:
      motivo ||
      (tipo === 'descarte' ? 'Descarte registrado' : 'Ingreso de producción'),
    cajero: resolveCajero(row),
    ref_id: String(row.id_registro),
  };
}

export function mapBreadLogsFromDb(
  rows: Record<string, unknown>[] | null | undefined
): BreadLog[] {
  if (!rows) return [];
  return rows.map(mapBreadLogFromDb);
}