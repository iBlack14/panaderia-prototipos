import React from 'react';
import { Client, Provider, CashSession, CreditPayment } from '@/context/types';

interface ClientOpsParams {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  providers: Provider[];
  setProviders: React.Dispatch<React.SetStateAction<Provider[]>>;
  cashSession: CashSession | null;
  setCashSession: React.Dispatch<React.SetStateAction<CashSession | null>>;
  toast: (msg: string) => void;
  isSupabaseConfigured: boolean;
  supabase: any;
  saveOffline: (key: string, data: any) => void;
}

export function useClientOps({
  clients,
  setClients,
  providers,
  setProviders,
  cashSession,
  setCashSession,
  toast,
  isSupabaseConfigured,
  supabase,
  saveOffline
}: ClientOpsParams) {

  const saveClient = async (cObj: any): Promise<Client | undefined> => {
    if (isSupabaseConfigured && supabase) {
      try {
        if (cObj.id) {
          const { error } = await supabase.from('clientes').update({
            nombre: cObj.nombre,
            dni: cObj.dni || '',
            telefono: cObj.telefono || '',
            email: cObj.email || '',
            limite_credito: cObj.limiteCred || 0
          }).eq('id_cliente', cObj.id);
          if (error) throw error;
          toast('👤 Cliente actualizado en la nube');
          return clients.find(c => c.id === cObj.id);
        } else {
          const { data, error } = await supabase.from('clientes').insert({
            nombre: cObj.nombre,
            dni: cObj.dni || '',
            telefono: cObj.telefono || '',
            email: cObj.email || '',
            limite_credito: cObj.limiteCred || 0,
            saldo_credito: 0,
            historial_pagos: [],
            estado: 1
          }).select().single();
          if (error) throw error;
          toast('👤 Cliente registrado en la nube');
          if (data) {
            const newCli: Client = {
              id: data.id_cliente,
              nombre: data.nombre,
              dni: data.dni || '',
              telefono: data.telefono || '',
              email: data.email || '',
              limiteCred: parseFloat(data.limite_credito || 0),
              saldoCred: parseFloat(data.saldo_credito || 0),
              historialPagos: [],
              active: true
            };
            setClients(prev => [...prev.filter(c => c.id !== newCli.id), newCli]);
            return newCli;
          }
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      let updated;
      let newClient: Client;
      if (cObj.id && clients.find(c => c.id === cObj.id)) {
        updated = clients.map(c => c.id === cObj.id ? { ...c, ...cObj } : c);
        toast('👤 Cliente actualizado');
        newClient = updated.find(c => c.id === cObj.id)!;
      } else {
        newClient = {
          id: Date.now(),
          nombre: cObj.nombre,
          dni: cObj.dni || '',
          telefono: cObj.telefono || '',
          email: cObj.email || '',
          limiteCred: cObj.limiteCred || 0,
          saldoCred: 0,
          historialPagos: [],
          active: true
        };
        updated = [...clients, newClient];
        toast('👤 Cliente registrado');
      }
      setClients(updated);
      saveOffline('snack_clients', updated);
      return newClient;
    }
    return undefined;
  };

  const toggleClient = async (id: number | string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const c = clients.find(x => x.id === id);
        if (!c) return;
        const newSt = c.active ? 0 : 1;

        const { error } = await supabase.from('clientes').update({
          estado: newSt
        }).eq('id_cliente', id);

        if (error) throw error;
        toast('👤 Estado de cliente actualizado en la nube');

        const { data } = await supabase.from('clientes').select('*').order('id_cliente', { ascending: true });
        if (data) {
          setClients((data as any[]).map(cl => ({
            id: cl.id_cliente,
            nombre: cl.nombre,
            dni: cl.dni || '',
            telefono: cl.telefono || '',
            email: cl.email || '',
            limiteCred: parseFloat(cl.limite_credito || 0),
            saldoCred: parseFloat(cl.saldo_credito || 0),
            historialPagos: cl.historial_pagos ? (typeof cl.historial_pagos === 'string' ? JSON.parse(cl.historial_pagos) : cl.historial_pagos) : [],
            active: cl.estado === 1
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      const updated = clients.map(c => c.id === id ? { ...c, active: !c.active } : c);
      setClients(updated);
      saveOffline('snack_clients', updated);
      toast('👤 Estado de cliente actualizado');
    }
  };

  const payCreditBalance = async (clientId: number | string, monto: number, concepto: string, metodoPago?: string) => {
    const metodoFinal = metodoPago || 'Efectivo';
    const abono: CreditPayment = {
      id: Date.now(),
      fecha: new Date().toLocaleDateString(),
      concepto: `${concepto} (${metodoFinal})`,
      monto,
      tipo: 'abono',
      metodoPago: metodoFinal
    };

    const targetClient = clients.find(c => c.id === clientId);
    if (!targetClient) return;

    const newSaldo = Math.max(0, targetClient.saldoCred - monto);
    const newHistorial = [...targetClient.historialPagos, abono];

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('clientes').update({
          saldo_credito: newSaldo,
          historial_pagos: newHistorial
        }).eq('id_cliente', clientId);
        if (error) throw error;
      } catch (err: any) {
        toast(`❌ Error en Supabase al registrar abono: ${err.message}`);
      }
    }

    const updated = clients.map(c => {
      if (c.id === clientId) {
        return { ...c, saldoCred: newSaldo, historialPagos: newHistorial };
      }
      return c;
    });
    setClients(updated);
    saveOffline('snack_clients', updated);

    if (cashSession) {
      const isEfectivo = metodoFinal.toLowerCase().includes('efectivo');
      const updatedSession: CashSession = {
        ...cashSession,
        tot_ventas_efectivo: cashSession.tot_ventas_efectivo + (isEfectivo ? monto : 0),
        tot_ventas_otros: cashSession.tot_ventas_otros + (!isEfectivo ? monto : 0)
      };
      setCashSession(updatedSession);
      saveOffline('snack_session', updatedSession);
    }
    toast(`✅ Abono de S/. ${monto.toFixed(2)} vía ${metodoFinal} registrado en caja.`);
  };

  const saveProvider = async (pObj: any) => {
    if (isSupabaseConfigured && supabase) {
      try {
        if (pObj.id) {
          await supabase.from('proveedores').update({
            ruc: pObj.ruc,
            nombre_empresa: pObj.name,
            num_telefono: pObj.phone,
            direccion: pObj.address
          }).eq('id_proveedor', pObj.id);
        } else {
          await supabase.from('proveedores').insert({
            ruc: pObj.ruc,
            nombre_empresa: pObj.name,
            num_telefono: pObj.phone,
            direccion: pObj.address,
            estado: 1
          });
        }
        const { data } = await supabase.from('proveedores').select('*');
        if (data) {
          setProviders((data as any[]).map(pr => ({
            id: pr.id_proveedor,
            ruc: pr.ruc,
            name: pr.nombre_empresa,
            phone: pr.num_telefono,
            address: pr.direccion,
            active: pr.estado === 1
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      let updated;
      if (pObj.id) {
        updated = providers.map(p => p.id === pObj.id ? { ...p, ...pObj } : p);
        toast('🏭 Proveedor actualizado');
      } else {
        const newProv: Provider = { ...pObj, id: Date.now(), active: true };
        updated = [...providers, newProv];
        toast('🏭 Proveedor registrado');
      }
      setProviders(updated);
      saveOffline('snack_providers', updated);
    }
  };

  const toggleProvider = async (id: number | string) => {
    const prov = providers.find(p => p.id === id);
    if (!prov) return;
    const newActive = !prov.active;
    const updated = providers.map(p => p.id === id ? { ...p, active: newActive } : p);
    setProviders(updated);
    saveOffline('snack_providers', updated);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('proveedores').update({ estado: newActive ? 1 : 0 }).eq('id_proveedor', id);
        toast('🏭 Estado de proveedor actualizado en la nube');
      } catch (err: any) {
        toast(`❌ Error actualizando proveedor: ${err.message}`);
      }
    } else {
      toast('🏭 Estado de proveedor actualizado');
    }
  };

  return {
    saveClient,
    toggleClient,
    payCreditBalance,
    saveProvider,
    toggleProvider
  };
}
