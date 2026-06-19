import React from 'react';
import { User, CustomRole } from '@/context/types';

interface AuthOpsParams {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  role: string | null;
  setRole: React.Dispatch<React.SetStateAction<string | null>>;
  usersList: User[];
  setUsersList: React.Dispatch<React.SetStateAction<User[]>>;
  rolesList: CustomRole[];
  setRolesList: React.Dispatch<React.SetStateAction<CustomRole[]>>;
  toast: (msg: string) => void;
  isSupabaseConfigured: boolean;
  supabase: any;
  saveOffline: (key: string, data: any) => void;
}

export function useAuthOperations({
  user,
  setUser,
  role,
  setRole,
  usersList,
  setUsersList,
  rolesList,
  setRolesList,
  toast,
  isSupabaseConfigured,
  supabase,
  saveOffline
}: AuthOpsParams) {

  const login = async (uIn: string, pIn: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        let emailToUse = uIn;
        let profileData = null;

        if (!uIn.includes('@')) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*, roles(nombre)')
            .eq('username', uIn)
            .maybeSingle();

          if (profile) {
            profileData = profile;
            emailToUse = profile.correo || `${uIn}@snackroque.com`;
          } else {
            emailToUse = `${uIn}@snackroque.com`;
          }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: pIn,
        });
        if (error) throw error;
        
        let prof = profileData;
        if (!prof) {
          const { data: profResp, error: profErr } = await supabase
            .from('profiles')
            .select('*, roles(nombre)')
            .eq('id', data.user.id)
            .single();
          if (profErr) throw profErr;
          prof = profResp;
        }
        
        if (prof) {
          const userObj: User = {
            id: prof.id,
            u: prof.username,
            n: prof.nombre + ' ' + prof.apellido_paterno,
            rs: [prof.roles?.nombre || 'Cajero'],
            email: prof.correo || data.user.email,
            phone: prof.num_telefono || '',
            st: prof.estado
          };
          setUser(userObj);
          setRole(prof.roles?.nombre || 'Cajero');
          toast(`✨ ¡Bienvenido, ${prof.nombre}!`);
          return { success: true, user: userObj };
        }
        return { success: false, message: 'Perfil no encontrado' };
      } catch (err: any) {
        toast(`❌ Error de login: ${err.message}`);
        return { success: false, message: err.message };
      }
    } else {
      const found = usersList.find(x => (x.u === uIn || x.email === uIn) && x.p === pIn && x.st === 'act');
      if (found) {
        setUser(found);
        setRole(found.rs[0]);
        localStorage.setItem('snack_offline_user', JSON.stringify(found));
        toast(`✨ ¡Bienvenido, ${found.n.split(' ')[0]}!`);
        return { success: true, user: found };
      } else {
        toast('❌ Credenciales inválidas o usuario inactivo');
        return { success: false, message: 'Credenciales inválidas' };
      }
    }
  };

  const logout = () => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch(console.error);
    }
    setUser(null);
    setRole(null);
    localStorage.removeItem('snack_offline_user');
    toast('↩ Sesión cerrada');
  };

  const sendRecoveryEmail = async (emailIn: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const res = await fetch('/api/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailIn }),
        });

        const data = await res.json();

        if (!res.ok || !data.found) {
          toast('❌ Correo electrónico no encontrado.');
          return { success: false, message: 'Correo no registrado en el sistema' };
        }

        return { success: true, online: false, userId: data.userId, username: data.username };
      } catch (err: any) {
        toast(`❌ Error verificando correo: ${err.message}`);
        return { success: false, message: err.message };
      }
    } else {
      const found = usersList.find(x => x.email === emailIn);
      if (found) {
        return { success: true, userId: found.id, username: found.u, online: false };
      }
      toast('❌ Correo electrónico no encontrado.');
      return { success: false };
    }
  };

  const resetPasswordOffline = async (userId: number | string, newPass: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const res = await fetch('/api/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, newPassword: newPass })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast(`❌ Error al actualizar contraseña: ${err.error || 'Error desconocido'}`);
          return;
        }
        toast('🔒 Contraseña restablecida con éxito.');
      } catch (err: any) {
        toast(`❌ Error: ${err.message}`);
      }
    } else {
      const updated = usersList.map(u => u.id === userId ? { ...u, p: newPass } : u);
      setUsersList(updated);
      saveOffline('snack_users', updated);
      toast('🔒 Contraseña restablecida con éxito.');
    }
  };

  const saveUser = async (uObj: any) => {
    if (isSupabaseConfigured && supabase) {
      try {
        if (uObj.id) {
          let idRol = 2;
          if (uObj.role === 'Administrador') idRol = 1;
          else if (uObj.role === 'Panadero') idRol = 3;

          const { error } = await supabase.from('profiles').update({
            username: uObj.u,
            nombre: uObj.n.split(' ')[0] || uObj.n,
            apellido_paterno: uObj.n.split(' ').slice(1).join(' ') || '',
            correo: uObj.email,
            num_telefono: uObj.phone,
            id_rol: idRol
          }).eq('id', uObj.id);

          if (error) throw error;
          toast('👤 Colaborador actualizado en la nube');
        } else {
          let idRol = 2;
          if (uObj.role === 'Administrador') idRol = 1;
          else if (uObj.role === 'Panadero') idRol = 3;

          const tempPassword = uObj.p || (uObj.email?.split('@')[0] + '123456') || `Temp${Date.now()}`;

          const authResponse = await fetch('/api/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: uObj.email,
              password: uObj.p || tempPassword,
              userData: {
                username: uObj.u,
                nombre: uObj.n.split(' ')[0] || uObj.n,
                apellido_paterno: uObj.n.split(' ').slice(1).join(' ') || '',
                id_rol: idRol
              }
            })
          });

          const authData = await authResponse.json();

          if (!authResponse.ok && !authData.message?.includes('already exists')) {
            throw new Error(authData.error || 'Error creando usuario en auth');
          }

          const userId = authData.userId;
          if (userId) {
            const { error: updateError } = await supabase.from('profiles').update({
              username: uObj.u,
              nombre: uObj.n.split(' ')[0] || uObj.n,
              apellido_paterno: uObj.n.split(' ').slice(1).join(' ') || '',
              correo: uObj.email,
              num_telefono: uObj.phone || '',
              id_rol: idRol,
              estado: 'act'
            }).eq('id', userId);

            if (updateError) {
              console.warn('Advertencia al actualizar perfil post-trigger:', updateError.message);
            }
          }

          toast(`✅ Colaborador creado. Contraseña temporal: ${tempPassword}`);
        }

        const { data: profs, error: selectError } = await supabase.from('profiles').select('*, roles(nombre)');
        if (selectError) {
          console.error('Error recargar perfiles:', selectError);
        } else if (profs) {
          setUsersList((profs as any[]).map(p => ({
            id: p.id,
            u: p.username || '',
            p: '••••',
            n: (p.nombre || '') + ' ' + (p.apellido_paterno || ''),
            rs: [p.roles?.nombre || 'Cajero'],
            st: p.estado === 1 ? 'act' : 'inact',
            email: p.correo || '',
            phone: p.num_telefono || ''
          })));
        }
      } catch (err: any) {
        console.error('Error en saveUser:', err);
        toast(`❌ Error: ${err.message}`);
        const newUser = { ...uObj, id: `local_${Date.now()}`, st: 'act', rs: [uObj.role] };
        setUsersList([...usersList, newUser]);
        saveOffline('snack_users', [...usersList, newUser]);
        toast('✅ Colaborador guardado localmente (sincronización pendiente)');
      }
    } else {
      let updated;
      if (uObj.id) {
        updated = usersList.map(u => u.id === uObj.id ? { ...u, ...uObj } : u);
        toast('👤 Colaborador actualizado');
      } else {
        const newUser = { ...uObj, id: Date.now(), st: 'act', rs: [uObj.role] };
        updated = [...usersList, newUser];
        toast('👤 Colaborador registrado');
      }
      setUsersList(updated);
      saveOffline('snack_users', updated);
    }
  };

  const toggleUserStatus = async (userId: number | string) => {
    const currentUser = usersList.find(u => u.id === userId);
    const newStatus = currentUser?.st === 'act' ? 'ina' : 'act';
    const updated = usersList.map(u => u.id === userId ? { ...u, st: newStatus } : u);

    setUsersList(updated);
    saveOffline('snack_users', updated);

    if (isSupabaseConfigured && supabase && currentUser) {
      try {
        await supabase.from('profiles').update({ estado: newStatus }).eq('id', userId);
        toast('✅ Estado de colaborador actualizado en la nube');
      } catch (err: any) {
        toast(`❌ Error actualizando estado en la nube: ${err.message}`);
      }
    } else {
      toast('👤 Estado de colaborador actualizado');
    }
  };

  const lookupProfileByDni = async (dni: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('numero_documento', dni)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          const firstName = data.nombre || '';
          const lastName = data.apellido_paterno || '';
          const email = data.correo || '';
          const phone = data.num_telefono || '';

          return {
            firstName: firstName || lastName || '',
            lastName: lastName || '',
            email: email || undefined,
            phone: phone || undefined
          };
        }
        
        return null;
      } catch (err: any) {
        console.error('Error buscando perfil en Supabase:', err);
        throw new Error(`Error al consultar el perfil por DNI en Supabase: ${err.message}`);
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_PROFILE_LOOKUP_URL?.trim() || '';
    if (!baseUrl) {
      throw new Error('No se ha configurado Supabase ni NEXT_PUBLIC_PROFILE_LOOKUP_URL para la búsqueda de perfiles por DNI.');
    }

    const url = baseUrl.includes('{dni}')
      ? baseUrl.replace('{dni}', encodeURIComponent(dni))
      : `${baseUrl.replace(/\/$/, '')}${baseUrl.includes('?') ? '&' : '?'}dni=${encodeURIComponent(dni)}`;

    const authToken = process.env.NEXT_PUBLIC_PROFILE_LOOKUP_AUTH?.trim() || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (authToken) {
      headers.Authorization = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Error al consultar el servicio de perfiles: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data || typeof data !== 'object') return null;

    const firstName =
      (data as any).nombre ||
      (data as any).nombres ||
      (data as any).first_name ||
      (data as any).firstName ||
      '';

    const lastNameParts = [
      (data as any).apellido_paterno,
      (data as any).apellido_materno,
      (data as any).apellido,
      (data as any).last_name,
      (data as any).lastName
    ].filter(Boolean);
    const lastName = lastNameParts.join(' ').trim();

    const email =
      (data as any).email ||
      (data as any).correo ||
      (data as any).correo_electronico ||
      '';
    const phone =
      (data as any).telefono ||
      (data as any).celular ||
      (data as any).phone ||
      (data as any).mobile ||
      '';

    if (!firstName && !lastName && !email && !phone) {
      return null;
    }

    return {
      firstName: firstName || lastName || '',
      lastName: lastName || '',
      email: email || undefined,
      phone: phone || undefined
    };
  };

  const saveRole = async (roleObj: any) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: existing } = await supabase.from('roles').select('id_rol').eq('nombre', roleObj.name).maybeSingle();
        if (existing) {
          const { error } = await supabase.from('roles').update({
            descripcion: roleObj.desc,
            permisos: roleObj.permissions
          }).eq('id_rol', existing.id_rol);
          if (error) throw error;
          toast('🔑 Rol actualizado en la nube');
        } else {
          const { error } = await supabase.from('roles').insert({
            nombre: roleObj.name,
            descripcion: roleObj.desc,
            permisos: roleObj.permissions,
            estado: 1
          });
          if (error) throw error;
          toast('🔑 Rol registrado en la nube');
        }

        const { data } = await supabase.from('roles').select('*').order('id_rol', { ascending: true });
        if (data) {
          setRolesList((data as any[]).map(r => ({
            id: r.nombre,
            name: r.nombre,
            desc: r.descripcion || '',
            permissions: Array.isArray(r.permisos) ? r.permisos : (typeof r.permisos === 'string' ? JSON.parse(r.permisos) : [])
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase al guardar rol: ${err.message}`);
      }
    } else {
      let updated;
      const exists = rolesList.some(r => r.id === roleObj.id || r.name === roleObj.name);
      if (exists) {
        updated = rolesList.map(r => (r.id === roleObj.id || r.name === roleObj.name) ? { ...r, ...roleObj } : r);
        toast('🔑 Rol actualizado');
      } else {
        const newRole = { ...roleObj, id: roleObj.id || roleObj.name.replace(/\s+/g, '') };
        updated = [...rolesList, newRole];
        toast('🔑 Rol registrado');
      }
      setRolesList(updated);
      saveOffline('snack_custom_roles_v1', updated);
    }
  };

  const deleteRole = async (id: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('roles').delete().eq('nombre', id);
        if (error) throw error;
        toast('🔑 Rol eliminado de la nube');

        const { data } = await supabase.from('roles').select('*').order('id_rol', { ascending: true });
        if (data) {
          setRolesList((data as any[]).map(r => ({
            id: r.nombre,
            name: r.nombre,
            desc: r.descripcion || '',
            permissions: Array.isArray(r.permisos) ? r.permisos : (typeof r.permisos === 'string' ? JSON.parse(r.permisos) : [])
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase al eliminar rol: ${err.message}`);
      }
    } else {
      const updated = rolesList.filter(r => r.id !== id);
      setRolesList(updated);
      saveOffline('snack_custom_roles_v1', updated);
      toast('🔑 Rol eliminado');
    }
  };

  return {
    login,
    logout,
    sendRecoveryEmail,
    resetPasswordOffline,
    saveUser,
    toggleUserStatus,
    lookupProfileByDni,
    saveRole,
    deleteRole
  };
}
