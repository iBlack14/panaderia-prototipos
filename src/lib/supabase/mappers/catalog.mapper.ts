import { CustomRole, PaymentMethod, Provider, User } from '@/context/types';
import { parseJsonField } from './utils';

export function mapCategoryFromDb(row: Record<string, unknown>) {
  return {
    id: row.id_categoria as number,
    name: String(row.nombre ?? ''),
    active: row.estado === 1,
  };
}

export function mapCategoriesFromDb(rows: Record<string, unknown>[] | null | undefined) {
  if (!rows) return [];
  return rows.map(mapCategoryFromDb);
}

export function mapRoleFromDb(row: Record<string, unknown>): CustomRole {
  return {
    id: String(row.nombre ?? ''),
    name: String(row.nombre ?? ''),
    desc: row.descripcion ? String(row.descripcion) : '',
    permissions: parseJsonField<string[]>(row.permisos, []),
  };
}

export function mapRolesFromDb(rows: Record<string, unknown>[] | null | undefined): CustomRole[] {
  if (!rows) return [];
  return rows.map(mapRoleFromDb);
}

export function mapPaymentMethodFromDb(row: Record<string, unknown>): PaymentMethod {
  return {
    id: row.id_metodo_pago as number,
    name: String(row.tipo_pago ?? ''),
    desc: 'Metodo en la nube',
    active: row.estado === 1,
  };
}

export function mapPaymentMethodsFromDb(rows: Record<string, unknown>[] | null | undefined): PaymentMethod[] {
  if (!rows) return [];
  return rows.map(mapPaymentMethodFromDb);
}

export function mapProfileFromDb(row: Record<string, unknown>): User {
  const roles = row.roles as Record<string, unknown> | null | undefined;
  return {
    id: row.id as string,
    u: String(row.username ?? ''),
    p: '••••',
    n: `${row.nombre ?? ''} ${row.apellido_paterno ?? ''}`.trim(),
    rs: [roles?.nombre ? String(roles.nombre) : 'Cajero'],
    st: String(row.estado ?? 'act'),
    email: row.correo ? String(row.correo) : '',
    phone: row.num_telefono ? String(row.num_telefono) : '',
  };
}

export function mapProfilesFromDb(rows: Record<string, unknown>[] | null | undefined): User[] {
  if (!rows) return [];
  return rows.map(mapProfileFromDb);
}

export function mapProviderFromDb(row: Record<string, unknown>): Provider {
  return {
    id: row.id_proveedor as number,
    ruc: String(row.ruc ?? ''),
    name: String(row.nombre_empresa ?? ''),
    phone: row.num_telefono ? String(row.num_telefono) : '',
    address: row.direccion ? String(row.direccion) : '',
    active: row.estado === 1,
  };
}

export function mapProvidersFromDb(rows: Record<string, unknown>[] | null | undefined): Provider[] {
  if (!rows) return [];
  return rows.map(mapProviderFromDb);
}