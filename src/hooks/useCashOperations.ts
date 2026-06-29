import React from 'react';
import { CashSession, CashHistoryRecord, CashDrop, DenominacionArqueo, User } from '@/context/types';
import {
  fetchOpenCashSession,
  refetchAfterCashClose,
  refetchAfterCashDrop,
} from '@/lib/supabase/queries/reloadEntity';

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

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('cierres_caja').insert({
          id_usuario: user?.id,
          tot_saldo_inicial: parsedInit,
          estado: 'abierto',
          turno: shift,
        }).select().single();
        if (error) throw error;

        const session = await fetchOpenCashSession(supabase);
        if (session) {
          setCashSession({
            ...session,
            cajero: user ? user.n : 'Carlos Mendoza',
            turno: shift,
          });
        }
        toast(`💰 Caja abierta en turno ${shift}. Ventas habilitadas.`);
      } catch (err) {
        console.error('Error al abrir caja en Supabase', err);
        toast('❌ Error al abrir caja en la nube');
      }
      return;
    }

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
    toast(`💰 Caja abierta en turno ${shift}. Ventas habilitadas.`);
  };

  const closeCashSession = async (countedAmount: string | number, observaciones: string, denominaciones?: DenominacionArqueo) => {
    if (!cashSession) return;

    const parsedCounted = typeof countedAmount === 'string' ? parseFloat(countedAmount) || 0 : countedAmount;
    const totalRetiros = cashSession.tot_retiros || 0;
    const expected = cashSession.tot_saldo_inicial + cashSession.tot_ventas_efectivo - totalRetiros;
    const diff = parsedCounted - expected;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('cierres_caja').update({
          fec_cierre: new Date(),
          tot_ventas_efectivo: cashSession.tot_ventas_efectivo,
          tot_ventas_otros: cashSession.tot_ventas_otros,
          tot_retiros: totalRetiros,
          tot_saldo_final: parsedCounted,
          diferencia: diff,
          estado: 'cerrado',
          turno: cashSession.turno,
          observaciones,
          denominaciones: denominaciones ?? null,
        }).eq('id_cierre_caja', cashSession.id);
        if (error) throw error;

        const { cashHistory: refreshed } = await refetchAfterCashClose(supabase);
        setCashHistory(refreshed);
        setCashSession(null);
        toast('🔴 Caja cerrada correctamente. POS bloqueado.');
      } catch (err) {
        console.error('Error al cerrar caja en Supabase', err);
        toast('❌ Error al cerrar caja en la nube');
      }
      return;
    }

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
    localStorage.removeItem('snack_session');
    toast('🔴 Caja cerrada correctamente. POS bloqueado.');
  };

  const registerCashDrop = async (monto: number, motivo: string) => {
    if (!cashSession) {
      toast('⚠️ No hay caja activa para registrar un retiro.');
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('retiros_caja').insert({
          id_cierre_caja: cashSession.id,
          monto,
          motivo,
          id_usuario: user?.id,
        });
        if (error) throw error;

        const refreshed = await refetchAfterCashDrop(supabase, cashSession.id);
        if (refreshed.cashSession) {
          setCashSession({
            ...refreshed.cashSession,
            cajero: cashSession.cajero,
            turno: cashSession.turno,
          });
        }
        setCashDrops(prev => [
          ...refreshed.cashDrops,
          ...prev.filter(d => d.sessionId !== cashSession.id),
        ]);
        toast(`💸 Retiro de S/. ${monto.toFixed(2)} registrado y descontado de caja.`);
      } catch (err) {
        console.error('Error al registrar retiro en Supabase', err);
        toast('❌ Error al registrar retiro en la nube');
      }
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
    toast(`💸 Retiro de S/. ${monto.toFixed(2)} registrado y descontado de caja.`);
  };

  return {
    openCashSession,
    closeCashSession,
    registerCashDrop
  };
}