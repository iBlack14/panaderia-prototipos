import React from 'react';
import { CashSession, CashHistoryRecord, CashDrop, DenominacionArqueo, User } from '@/context/types';

interface CashOpsParams {
  cashSession: CashSession | null;
  setCashSession: React.Dispatch<React.SetStateAction<CashSession | null>>;
  cashHistory: CashHistoryRecord[];
  setCashHistory: React.Dispatch<React.SetStateAction<CashHistoryRecord[]>>;
  cashDrops: CashDrop[];
  setCashDrops: React.Dispatch<React.SetStateAction<CashDrop[]>>;
  user: User | null;
  toast: (msg: string) => void;
  isSupabaseConfigured: boolean;
  supabase: any;
  saveOffline: (key: string, data: any) => void;
}

export function useCashOperations({
  cashSession,
  setCashSession,
  cashHistory,
  setCashHistory,
  cashDrops,
  setCashDrops,
  user,
  toast,
  isSupabaseConfigured,
  supabase,
  saveOffline
}: CashOpsParams) {

  const openCashSession = async (initialAmount: string | number, shift: string) => {
    const parsedInit = typeof initialAmount === 'string' ? parseFloat(initialAmount) || 0 : initialAmount;
    const newSession: CashSession = {
      id: Date.now(),
      fec_apertura: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString(),
      tot_saldo_inicial: parsedInit,
      tot_ventas_efectivo: 0,
      tot_ventas_otros: 0,
      tot_retiros: 0,
      estado: 'abierto',
      cajero: user ? user.n : 'Carlos Mendoza',
      turno: shift
    };

    setCashSession(newSession);
    saveOffline('snack_session', newSession);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from('cierres_caja').insert({
          id_usuario: user?.id,
          tot_saldo_inicial: parsedInit,
          estado: 'abierto'
        }).select().single();
        if (data) {
          setCashSession({
            ...newSession,
            id: data.id_cierre_caja
          });
        }
      } catch (err) {
        console.error('Error al abrir caja en Supabase', err);
      }
    }
    toast(`💰 Caja abierta en turno ${shift}. Ventas habilitadas.`);
  };

  const closeCashSession = async (countedAmount: string | number, observaciones: string, denominaciones?: DenominacionArqueo) => {
    if (!cashSession) return;

    const parsedCounted = typeof countedAmount === 'string' ? parseFloat(countedAmount) || 0 : countedAmount;
    const totalRetiros = cashSession.tot_retiros || 0;
    const expected = cashSession.tot_saldo_inicial + cashSession.tot_ventas_efectivo - totalRetiros;
    const diff = parsedCounted - expected;

    const closedRecord: CashHistoryRecord = {
      id: cashSession.id,
      fec_apertura: typeof cashSession.fec_apertura === 'string' ? cashSession.fec_apertura : cashSession.fec_apertura.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fec_cierre: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: cashSession.date || new Date().toLocaleDateString(),
      monto_inicial: cashSession.tot_saldo_inicial,
      monto_final: parsedCounted,
      ventas_efectivo: cashSession.tot_ventas_efectivo,
      ventas_otros: cashSession.tot_ventas_otros,
      tot_retiros: totalRetiros,
      diferencia: diff,
      estado: 'cerrado',
      cajero: cashSession.cajero,
      turno: cashSession.turno,
      observaciones: observaciones,
      denominaciones: denominaciones
    };

    const newHistory = [closedRecord, ...cashHistory];
    setCashHistory(newHistory);
    saveOffline('snack_cash_history', newHistory);
    setCashSession(null);
    if (!isSupabaseConfigured) {
      localStorage.removeItem('snack_session');
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('cierres_caja').update({
          fec_cierre: new Date(),
          tot_ventas_efectivo: cashSession.tot_ventas_efectivo,
          tot_ventas_otros: cashSession.tot_ventas_otros,
          tot_saldo_final: parsedCounted,
          diferencia: diff,
          estado: 'cerrado'
        }).eq('id_cierre_caja', cashSession.id);
      } catch (err) {
        console.error('Error al cerrar caja en Supabase', err);
      }
    }

    toast('🔴 Caja cerrada correctamente. POS bloqueado.');
  };

  const registerCashDrop = async (monto: number, motivo: string) => {
    if (!cashSession) {
      toast('⚠️ No hay caja activa para registrar un retiro.');
      return;
    }
    const drop: CashDrop = {
      id: Date.now(),
      sessionId: cashSession.id,
      monto,
      motivo,
      cajero: user?.n || 'Sistema',
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const newDrops = [drop, ...cashDrops];
    setCashDrops(newDrops);
    saveOffline('snack_cash_drops', newDrops);

    const updatedSession: CashSession = {
      ...cashSession,
      tot_retiros: (cashSession.tot_retiros || 0) + monto
    };
    setCashSession(updatedSession);
    saveOffline('snack_session', updatedSession);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('cierres_caja').update({
          tot_ventas_efectivo: updatedSession.tot_ventas_efectivo,
          tot_ventas_otros: updatedSession.tot_ventas_otros
        }).eq('id_cierre_caja', cashSession.id);
      } catch (err) {
        console.error('Error al registrar retiro en Supabase', err);
      }
    }

    toast(`💸 Retiro de S/. ${monto.toFixed(2)} registrado y descontado de caja.`);
  };

  return {
    openCashSession,
    closeCashSession,
    registerCashDrop
  };
}
