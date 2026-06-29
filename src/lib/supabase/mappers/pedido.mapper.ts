import { Pedido } from '@/context/types';
import { num } from './utils';

export function mapPedidoFromDb(row: Record<string, unknown>): Pedido {
  const clientes = row.clientes as Record<string, unknown> | null | undefined;
  return {
    id: row.id_pedido as number,
    clienteId: row.id_cliente != null ? (row.id_cliente as number) : undefined,
    clienteNombre: clientes?.nombre ? String(clientes.nombre) : 'Cliente Genérico',
    productoTexto: String(row.producto_texto ?? ''),
    fecEntrega: String(row.fec_entrega ?? ''),
    adelanto: num(row.adelanto),
    notas: row.notas ? String(row.notas) : '',
    estado: (row.estado as Pedido['estado']) || 'Pendiente',
    idUsuario: row.id_usuario ? String(row.id_usuario) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function mapPedidosFromDb(rows: Record<string, unknown>[] | null | undefined): Pedido[] {
  if (!rows) return [];
  return rows.map(mapPedidoFromDb);
}