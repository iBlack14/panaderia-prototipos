"use client";

import { PlanPedidoResult } from '@/lib/production/planPedido';

interface MateriaPrimaPanelProps {
  plan: PlanPedidoResult;
  compact?: boolean;
}

export function MateriaPrimaPanel({ plan, compact = false }: MateriaPrimaPanelProps) {
  if (plan.requerimientos.length === 0 && plan.sinReceta.length === 0) {
    return null;
  }

  const hasMissingRecipes = plan.sinReceta.length > 0;
  const allAvailable = plan.todosDisponibles && !hasMissingRecipes;

  let title = '';
  if (allAvailable) {
    title = '✅ Materia prima disponible';
  } else if (hasMissingRecipes && plan.requerimientos.length === 0) {
    title = '⚠️ Falta receta (No descontará insumos)';
  } else {
    title = '⚠️ Revisar materia prima / recetas';
  }

  return (
    <div
      style={{
        background: allAvailable
          ? 'rgba(34, 197, 94, 0.06)'
          : 'rgba(234, 179, 8, 0.08)',
        border: `1px solid ${allAvailable ? 'rgba(34, 197, 94, 0.25)' : 'rgba(234, 179, 8, 0.35)'}`,
        borderRadius: '10px',
        padding: compact ? '8px 10px' : '10px 12px',
        fontSize: compact ? '11px' : '12px',
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: '6px', color: 'var(--text)' }}>
        {title}
        {!compact && plan.costoMateriaPrima > 0 && (
          <span style={{ fontWeight: 600, color: 'var(--text-3)', marginLeft: '8px' }}>
            · Costo est.: S/. {plan.costoMateriaPrima.toFixed(2)}
          </span>
        )}
      </div>

      {hasMissingRecipes && (
        <div style={{ color: 'var(--amber)', marginBottom: '6px', fontSize: '11px', fontWeight: 700 }}>
          Sin receta: {plan.sinReceta.join(', ')}
        </div>
      )}

      {plan.requerimientos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {plan.requerimientos.map(req => (
            <div
              key={req.insumoId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
                color: req.suficiente ? 'var(--text-2)' : 'var(--red)',
              }}
            >
              <span>
                {req.suficiente ? '•' : '✗'} {req.insumoNombre}
              </span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {req.cantidadNecesaria.toFixed(3)} {req.unidad}
                {!compact && ` / ${req.stockDisponible.toFixed(3)}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}