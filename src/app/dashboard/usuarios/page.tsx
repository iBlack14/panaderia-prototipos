"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp, User } from '@/context/AppContext';

interface SystemPermission {
  key: string;
  label: string;
  icon: string;
  desc: string;
}

interface CustomRole {
  id: string;
  name: string;
  desc: string;
  permissions: string[];
}

const SYSTEM_PERMISSIONS: SystemPermission[] = [
  { key: 'pos_ventas', label: 'Registrar Ventas (POS)', icon: '🛒', desc: 'Permite ingresar a la vitrina y procesar cobros de panadería' },
  { key: 'caja_operaciones', label: 'Operaciones de Caja', icon: '💰', desc: 'Permite abrir turnos de caja, ingresar fondo inicial y realizar arqueos' },
  { key: 'caja_auditoria', label: 'Auditar Cuadre de Cajas', icon: '🔍', desc: 'Permite auditar balances de caja, ver sobrantes/faltantes y observaciones de auditoría' },
  { key: 'inventario_ver', label: 'Visualizar Inventario', icon: '📦', desc: 'Permite visualizar stock actual de productos y variantes' },
  { key: 'inventario_editar', label: 'Mantenimiento de Insumos/Stock', icon: '🛠️', desc: 'Permite crear o eliminar productos, cambiar precios y registrar mermas o descartes' },
  { key: 'estadisticas_ver', label: 'Estadísticas y KPIs', icon: '📈', desc: 'Acceso a tableros de analítica avanzada, facturación diaria/mensual y flujos contables' },
  { key: 'personal_gestionar', label: 'Gestión de Personal', icon: '👥', desc: 'Acceso a la creación, edición, activación y control de roles de trabajadores' },
];

export default function PersonalPage() {
  const { usersList, saveUser, toggleUserStatus, lookupProfileByDni, toast } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'personal' | 'roles'>('personal');

  // --- LOCAL PERSISTED ROLES LIST STATE ---
  const [rolesList, setRolesList] = useState<CustomRole[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('snack_custom_roles_v1');
    if (stored) {
      setRolesList(JSON.parse(stored));
    } else {
      const defaultRoles: CustomRole[] = [
        {
          id: 'Administrador',
          name: 'Administrador',
          desc: 'Control total de la panadería con acceso sin restricciones a todos los módulos.',
          permissions: SYSTEM_PERMISSIONS.map(p => p.key)
        },
        {
          id: 'Cajero',
          name: 'Cajero',
          desc: 'Operador de caja estándar encargado de cobros al detalle y arqueo de turnos básicos.',
          permissions: ['pos_ventas', 'caja_operaciones', 'inventario_ver']
        },
        {
          id: 'Contador',
          name: 'Contador',
          desc: 'Auditor contable enfocado en control fiscal, ingresos consolidados y reportes mensuales.',
          permissions: ['caja_auditoria', 'estadisticas_ver']
        },
        {
          id: 'Supervisor',
          name: 'Supervisor',
          desc: 'Encargado del local. Habilitado para auditar cajas, gestionar descartes de panes y stock.',
          permissions: ['pos_ventas', 'caja_operaciones', 'caja_auditoria', 'inventario_ver', 'inventario_editar', 'estadisticas_ver']
        }
      ];
      setRolesList(defaultRoles);
      localStorage.setItem('snack_custom_roles_v1', JSON.stringify(defaultRoles));
    }
  }, []);

  const saveRolesToStorage = (updated: CustomRole[]) => {
    setRolesList(updated);
    localStorage.setItem('snack_custom_roles_v1', JSON.stringify(updated));
  };

  // --- MODALS STATES ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  // --- USER FORM STATES ---
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [dniLookupLoading, setDniLookupLoading] = useState(false);
  const [dniLookupError, setDniLookupError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedUserRole, setSelectedUserRole] = useState('Cajero');

  // --- EMAIL OTP VERIFICATION STATES ---
  const [emailVerified, setEmailVerified] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);

  // --- ROLE FORM STATES ---
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);

  // --- VALIDATORS ---
  const isUsernameValid = username.length >= 5 && /^[a-zA-Z0-9]+$/.test(username);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPhoneValid = /^9\d{8}$/.test(phone);
  const isDniValid = /^\d{8}$/.test(dni);
  
  const isUsernameTaken = usersList.some(u => u.u === username && u.id !== editingUserId);
  const isEmailTaken = usersList.some(u => u.email === email && u.id !== editingUserId);
  
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);
  const isPasswordSecure = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const isPasswordMatch = password === confirmPassword;

  const isUserFormValid = 
    firstName.trim().length >= 2 && 
    lastName.trim().length >= 2 && 
    isDniValid &&
    isEmailValid && 
    emailVerified &&
    !isEmailTaken &&
    isUsernameValid && 
    !isUsernameTaken &&
    isPasswordSecure && 
    isPasswordMatch && 
    isPhoneValid;
  const isRoleFormValid = roleName.trim().length >= 3 && roleDesc.trim().length >= 8 && rolePermissions.length > 0;

  // --- USER HANDLERS ---
  const handleOpenNewUser = () => {
    setEditingUserId(null);
    setFirstName('');
    setLastName('');
    setDni('');
    setUsername('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSelectedUserRole(rolesList[0]?.id || 'Cajero');
    setEmailVerified(false);
    setOtpCode('');
    setOtpError(false);
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUserId(u.id);
    const nameParts = u.n.split(' ');
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
    setDni((u as any).dni || '');
    setUsername(u.u);
    setEmail(u.email || '');
    setPhone(u.phone || '');
    setPassword(u.p || '12345678'); 
    setConfirmPassword(u.p || '12345678');
    setSelectedUserRole(u.rs[0] || 'Cajero');
    setEmailVerified(true); // Al editar, el correo ya fue verificado antes
    setShowPassword(false);
    setShowConfirmPassword(false);
    setDniLookupError(null);
    setShowUserModal(true);
  };

  const handleLookupDni = async () => {
    if (!isDniValid) return;
    setDniLookupError(null);
    setDniLookupLoading(true);

    try {
      const profile = await lookupProfileByDni(dni);
      if (!profile) {
        setDniLookupError('No se encontraron datos para este DNI.');
        return;
      }

      if (profile.firstName) setFirstName(profile.firstName);
      if (profile.lastName) setLastName(profile.lastName);
      if (profile.email) {
        setEmail(profile.email);
        setEmailVerified(false);
      }
      if (profile.phone) setPhone(profile.phone);
    } catch (err: any) {
      setDniLookupError(err.message || 'Error al consultar el servicio de DNI.');
    } finally {
      setDniLookupLoading(false);
    }
  };

  // OTP helpers
  const startResendTimer = () => {
    setOtpResendTimer(60);
    const interval = setInterval(() => {
      setOtpResendTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtpEmail = async (targetEmail: string, code: string) => {
    const response = await fetch('/api/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: targetEmail, code })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'No se pudo enviar el código por correo.');
    }
  };

  const handleSendOtp = async () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(code);
    setOtpCode('');
    setOtpError(false);
    setOtpSending(true);

    try {
      await sendOtpEmail(email, code);
      setShowOtpModal(true);
      toast('📨 Código enviado por correo. Revisa tu bandeja de entrada.');
      startResendTimer();
    } catch (err: any) {
      console.error(err);
      toast(`❌ ${err.message}`);
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode === generatedOtp) {
      setEmailVerified(true);
      setOtpError(false);
      setShowOtpModal(false);
    } else {
      setOtpError(true);
      setOtpCode('');
    }
  };

  const handleResendOtp = async () => {
    if (otpResendTimer > 0) return;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(code);
    setOtpCode('');
    setOtpError(false);
    setOtpSending(true);

    try {
      await sendOtpEmail(email, code);
      toast('🔁 Código reenviado por correo.');
      startResendTimer();
    } catch (err: any) {
      console.error(err);
      toast(`❌ ${err.message}`);
    } finally {
      setOtpSending(false);
    }
  };

  const handleEmailChange = (val: string) => {
    setEmail(val.trim());
    if (emailVerified) setEmailVerified(false); // Si cambia el correo, requiere re-verificar
  };

  const handleUserFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUserFormValid) return;

    const userObj = {
      id: editingUserId,
      n: `${firstName} ${lastName}`,
      u: username,
      p: password,
      role: selectedUserRole,
      email,
      phone: phone || '-',
      dni
    };

    saveUser(userObj);
    setShowUserModal(false);
  };

  // --- ROLE HANDLERS ---
  const handleOpenNewRole = () => {
    setEditingRoleId(null);
    setRoleName('');
    setRoleDesc('');
    setRolePermissions([]);
    setShowRoleModal(true);
  };

  const handleOpenEditRole = (r: CustomRole) => {
    if (r.id === 'Administrador') return; // Bloqueado
    setEditingRoleId(r.id);
    setRoleName(r.name);
    setRoleDesc(r.desc);
    setRolePermissions(r.permissions);
    setShowRoleModal(true);
  };

  const handleRoleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRoleFormValid) return;

    if (editingRoleId) {
      // Editar rol existente
      const updated = rolesList.map(r => r.id === editingRoleId ? { ...r, name: roleName, desc: roleDesc, permissions: rolePermissions } : r);
      saveRolesToStorage(updated);
    } else {
      // Crear nuevo rol
      const newId = roleName.replace(/\s+/g, '');
      const newRole: CustomRole = {
        id: newId,
        name: roleName,
        desc: roleDesc,
        permissions: rolePermissions
      };
      saveRolesToStorage([...rolesList, newRole]);
    }
    setShowRoleModal(false);
  };

  const handleTogglePermission = (key: string) => {
    if (rolePermissions.includes(key)) {
      setRolePermissions(rolePermissions.filter(p => p !== key));
    } else {
      setRolePermissions([...rolePermissions, key]);
    }
  };

  const handleDeleteRole = (id: string) => {
    if (id === 'Administrador' || id === 'Cajero') return;
    const updated = rolesList.filter(r => r.id !== id);
    saveRolesToStorage(updated);
  };

  const getRolePermissionsCount = (roleId: string) => {
    const roleObj = rolesList.find(r => r.id === roleId);
    return roleObj ? roleObj.permissions.length : 0;
  };

  return (
    <div className="screen active">
      {/* SEGMENTED TAB CONTROLLER */}
      <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-2)', padding: '4px', borderRadius: '999px', border: '1px solid var(--border)', width: 'fit-content', margin: '0 auto 24px auto' }}>
        <button 
          onClick={() => setActiveSubTab('personal')} 
          style={{
            border: 'none',
            padding: '10px 24px',
            borderRadius: '999px',
            fontSize: '12.5px',
            fontWeight: '800',
            cursor: 'pointer',
            background: activeSubTab === 'personal' ? 'var(--bg-card)' : 'transparent',
            color: activeSubTab === 'personal' ? 'var(--accent)' : 'var(--text-3)',
            boxShadow: activeSubTab === 'personal' ? '0 4px 12px rgba(176,125,46,0.12)' : 'none',
            transition: 'all 0.22s var(--ease)'
          }}
        >
          👥 Colaboradores ({usersList.length})
        </button>
        <button 
          onClick={() => setActiveSubTab('roles')} 
          style={{
            border: 'none',
            padding: '10px 24px',
            borderRadius: '999px',
            fontSize: '12.5px',
            fontWeight: '800',
            cursor: 'pointer',
            background: activeSubTab === 'roles' ? 'var(--bg-card)' : 'transparent',
            color: activeSubTab === 'roles' ? 'var(--accent)' : 'var(--text-3)',
            boxShadow: activeSubTab === 'roles' ? '0 4px 12px rgba(176,125,46,0.12)' : 'none',
            transition: 'all 0.22s var(--ease)'
          }}
        >
          🔑 Roles &amp; Permisos ({rolesList.length})
        </button>
      </div>

      {activeSubTab === 'personal' ? (
        <>
          {/* PERSONAL TAB VIEW */}
          <div className="tb-bar">
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ padding: '6px 14px', background: 'var(--accent-bg)', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '11px', fontWeight: '700', color: 'var(--accent)' }}>
                Total: <span>{usersList.length}</span>
              </div>
              <div style={{ padding: '6px 14px', background: 'var(--green-bg)', border: '1px solid rgba(74,140,92,0.2)', borderRadius: '20px', fontSize: '11px', fontWeight: '700', color: 'var(--green)' }}>
                Activos: <span>{usersList.filter(u => u.st === 'act').length}</span>
              </div>
            </div>
            <button className="btn-new" onClick={handleOpenNewUser}>+ Agregar personal</button>
          </div>

          <div className="user-cards">
            {usersList.map((u) => {
              const matchedRole = rolesList.find(r => r.id === u.rs[0]);
              return (
                <div className="uc" key={u.id}>
                  <div className="uc-av">{u.n ? u.n[0].toUpperCase() : '👤'}</div>
                  <div className="uc-name">{u.n}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontWeight: '600' }}>@{u.u}</div>
                  
                  <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '6px', textAlign: 'center', lineHeight: '1.6' }}>
                    {(u as any).dni && (
                      <><span style={{ fontWeight: '700', color: 'var(--text-3)' }}>🪪 DNI:</span> {(u as any).dni}<br /></>
                    )}
                    📧 {u.email || 'sin correo'}<br />
                    📞 {u.phone || 'sin teléfono'}
                  </div>

                  <div className="uc-roles" style={{ marginTop: '10px' }}>
                    {u.rs.map(r => (
                      <span key={r} className={`role-tag ${r === 'Administrador' ? 'rt-a' : 'rt-c'}`} style={{ fontSize: '10px' }}>
                        {r}
                      </span>
                    ))}
                  </div>

                  {matchedRole && (
                    <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-3)', fontWeight: '500', background: 'var(--bg-hover)', padding: '4px 8px', borderRadius: '6px' }}>
                      🔑 {matchedRole.permissions.length === SYSTEM_PERMISSIONS.length ? 'Acceso Total' : `${matchedRole.permissions.length} privilegios`}
                    </div>
                  )}

                  <div className={`uc-status ${u.st === 'act' ? 'on' : 'off'}`} style={{ marginTop: '8px', fontSize: '11px' }}>
                    {u.st === 'act' ? '● Activo' : '○ Inactivo'}
                  </div>

                  <div className="uc-btns" style={{ marginTop: '14px' }}>
                    <button className="uc-btn" onClick={() => handleOpenEditUser(u)}>Editar</button>
                    <button 
                      className="uc-btn" 
                      style={{ color: u.st === 'act' ? 'var(--red)' : 'var(--green)', borderColor: u.st === 'act' ? 'rgba(192,72,58,0.2)' : 'rgba(74,140,92,0.2)', transition: 'all 0.2s' }}
                      onClick={() => toggleUserStatus(u.id)}
                    >
                      {u.st === 'act' ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* ROLES & PERMISSIONS TAB VIEW */}
          <div className="tb-bar">
            <div>
              <h3 style={{ fontFamily: 'DM Serif Display', fontSize: '18px', color: 'var(--text)' }}>Configuración de Perfiles</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Define los privilegios de tu personal sin modificar código.</p>
            </div>
            <button className="btn-new" onClick={handleOpenNewRole}>+ Crear Nuevo Rol</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            {rolesList.map((r) => (
              <div 
                key={r.id} 
                className="panel" 
                style={{ 
                  padding: '20px 24px', 
                  border: '1.5px solid var(--border)', 
                  background: 'var(--bg-card)', 
                  borderRadius: '16px',
                  boxShadow: '0 4px 15px rgba(46, 26, 10, 0.02)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '15.5px', fontWeight: '800', color: 'var(--text)' }}>{r.name}</h4>
                      <span className={`role-tag ${r.id === 'Administrador' ? 'rt-a' : 'rt-c'}`} style={{ fontSize: '9px', padding: '2px 8px' }}>
                        ID: {r.id}
                      </span>
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '6px', maxWidth: '680px', lineHeight: '1.4' }}>
                      {r.desc}
                    </p>
                  </div>
                  
                  {r.id !== 'Administrador' && r.id !== 'Cajero' ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="uc-btn" style={{ padding: '6px 12px' }} onClick={() => handleOpenEditRole(r)}>⚙️ Configurar</button>
                      <button className="uc-btn" style={{ padding: '6px 12px', color: 'var(--red)', borderColor: 'rgba(192,72,58,0.2)' }} onClick={() => handleDeleteRole(r.id)}>🗑️ Borrar</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-3)', fontStyle: 'italic', background: 'var(--bg-hover)', padding: '4px 10px', borderRadius: '6px', fontWeight: '600' }}>
                      🔒 Protegido del Sistema
                    </span>
                  )}
                </div>

                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    Permisos Asignados ({r.permissions.length}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {r.permissions.map(pKey => {
                      const pObj = SYSTEM_PERMISSIONS.find(sp => sp.key === pKey);
                      return pObj ? (
                        <span 
                          key={pKey} 
                          title={pObj.desc}
                          style={{ 
                            fontSize: '11px', 
                            padding: '4px 10px', 
                            background: 'var(--bg-card2)', 
                            border: '1px solid var(--border)', 
                            borderRadius: '8px', 
                            color: 'var(--text)',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{pObj.icon}</span>
                          <span>{pObj.label}</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* --- USER COLLABORATOR MODAL --- */}
      {showUserModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '20px' }}>
              {editingUserId ? 'Editar Colaborador' : 'Nuevo Colaborador'}
            </div>

            <form onSubmit={handleUserFormSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                
                <div className="inp-group">
                  <label>Nombres</label>
                  <input type="text" placeholder="Ej: Ana María" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>

                <div className="inp-group">
                  <label>Apellidos</label>
                  <input type="text" placeholder="Ej: Rodríguez López" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>

                {/* DNI */}
                <div className="inp-group">
                  <label>DNI</label>
                  <input
                    type="text"
                    placeholder="Ej: 12345678"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                    maxLength={8}
                    required
                  />
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontSize: '10px', color: isDniValid ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                      {dni === '' ? '⚪ 8 dígitos numéricos' : isDniValid ? '🟢 DNI válido' : '❌ Debe tener exactamente 8 dígitos'}
                    </span>
                    <button
                      type="button"
                      onClick={handleLookupDni}
                      disabled={!isDniValid || dniLookupLoading}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--border)',
                        background: isDniValid ? 'var(--accent-bg)' : 'var(--bg-card2)',
                        color: isDniValid ? 'var(--accent)' : 'var(--text-3)',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: isDniValid ? 'pointer' : 'not-allowed',
                        opacity: isDniValid ? 1 : 0.5,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {dniLookupLoading ? 'Buscando...' : 'Autocompletar datos'}
                    </button>
                  </div>
                  {dniLookupError && (
                    <div style={{ fontSize: '10px', color: 'var(--red)', marginTop: '4px', fontWeight: '600' }}>
                      {dniLookupError}
                    </div>
                  )}
                </div>

                <div className="inp-group">
                  <label>Rol Asignado</label>
                  <select value={selectedUserRole} onChange={(e) => setSelectedUserRole(e.target.value)}>
                    {rolesList.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.permissions.length} per.)
                      </option>
                    ))}
                  </select>
                </div>

                {/* CORREO + VERIFICACIÓN OTP */}
                <div className="inp-group" style={{ gridColumn: 'span 2' }}>
                  <label>Correo Electrónico</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="email"
                        placeholder="aro@snackroque.com"
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        required
                        style={{ borderColor: emailVerified ? 'var(--green)' : isEmailTaken ? 'var(--red)' : undefined }}
                      />
                      <div style={{ fontSize: '10px', marginTop: '4px', fontWeight: '500', color: emailVerified ? 'var(--green)' : isEmailTaken ? 'var(--red)' : isEmailValid ? 'var(--text-3)' : 'var(--red)' }}>
                        {email === '' ? '⚪ Formato de correo' :
                          isEmailTaken ? '❌ Este correo ya está registrado' :
                          emailVerified ? '✅ Correo verificado' :
                          isEmailValid ? '⚠️ Correo válido — pendiente de verificar' :
                          '❌ Correo inválido'}
                      </div>
                    </div>
                    {!editingUserId && (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={!isEmailValid || isEmailTaken || emailVerified}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--border)',
                          background: emailVerified ? 'var(--green-bg)' : 'var(--accent-bg)',
                          color: emailVerified ? 'var(--green)' : 'var(--accent)',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          cursor: (!isEmailValid || isEmailTaken || emailVerified) ? 'not-allowed' : 'pointer',
                          opacity: (!isEmailValid || isEmailTaken) ? 0.5 : 1,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.18s',
                          flexShrink: 0,
                          marginTop: '0px'
                        }}
                      >
                        {emailVerified ? '✅ Verificado' : '📨 Verificar correo'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="inp-group">
                  <label>Número de Teléfono</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 987654321" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} 
                    maxLength={9}
                    required 
                  />
                  <div style={{ fontSize: '10px', color: isPhoneValid ? 'var(--green)' : 'var(--red)', marginTop: '4px', fontWeight: '500' }}>
                    {phone === '' ? '⚪ 9 dígitos (inicia con 9)' : isPhoneValid ? '🟢 Teléfono válido' : '❌ Debe iniciar con 9 y tener 9 dígitos'}
                  </div>
                </div>

                <div className="inp-group">
                  <label>Usuario (login)</label>
                  <input type="text" placeholder="Ej: arodriguez" value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} required />
                  <div style={{ fontSize: '10px', color: isUsernameTaken ? 'var(--red)' : isUsernameValid ? 'var(--green)' : 'var(--text-3)', marginTop: '4px', fontWeight: '500' }}>
                    {isUsernameTaken ? '❌ Este usuario ya está en uso' : isUsernameValid ? '🟢 Válido' : '⚪ Min. 5 caracteres, alfanumérico'}
                  </div>
                </div>

                <div className="inp-group">
                  <label>Contraseña Acceso</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ paddingRight: '42px' }}
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShowPassword(v => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar' : 'Ver'}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="inp-group">
                  <label>Confirmar Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      style={{ paddingRight: '42px' }}
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Ocultar' : 'Ver'}
                    >
                      {showConfirmPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <div style={{ fontSize: '10px', color: isPasswordMatch ? 'var(--green)' : 'var(--red)', marginTop: '4px', fontWeight: '500' }}>
                    {confirmPassword === '' ? '⚪ Repite la contraseña' : isPasswordMatch ? '🟢 Las contraseñas coinciden' : '❌ Las contraseñas no coinciden'}
                  </div>
                </div>

                {/* PASSWORD CHECKLIST */}
                <div style={{ gridColumn: 'span 2', background: 'var(--bg-card2)', padding: '14px', borderRadius: '12px', border: '1.5px solid var(--border)', marginBottom: '10px' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    🔒 Validación de Contraseña Segura:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <li style={{ color: hasMinLength ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                      {hasMinLength ? '🟢' : '⚪'} Mínimo 8 caracteres
                    </li>
                    <li style={{ color: hasUppercase ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                      {hasUppercase ? '🟢' : '⚪'} Una mayúscula (A-Z)
                    </li>
                    <li style={{ color: hasLowercase ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                      {hasLowercase ? '🟢' : '⚪'} Una minúscula (a-z)
                    </li>
                    <li style={{ color: hasNumber ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                      {hasNumber ? '🟢' : '⚪'} Un número (0-9)
                    </li>
                    <li style={{ color: hasSpecial ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                      {hasSpecial ? '🟢' : '⚪'} Un carácter especial (@$!%*?&)
                    </li>
                    <li style={{ color: isPasswordSecure ? 'var(--green)' : 'var(--text-3)', fontWeight: '700' }}>
                      {isPasswordSecure ? '🟢 SEGURA' : '⚪ Insegura'}
                    </li>
                  </ul>
                </div>

              </div>

              <div className="mc-btns" style={{ marginTop: '22px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowUserModal(false)}>Cancelar</button>
                <button 
                  type="submit" 
                  className="mc-pri" 
                  disabled={!isUserFormValid}
                  style={{ opacity: isUserFormValid ? 1 : 0.6, cursor: isUserFormValid ? 'pointer' : 'not-allowed' }}
                >
                  {editingUserId ? 'Guardar Cambios' : 'Registrar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- OTP EMAIL VERIFICATION MODAL (portal → body) --- */}
      {showOtpModal && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(46,26,10,0.55)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '24px',
              padding: '36px 32px',
              width: '400px',
              maxWidth: '92vw',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(138,95,26,0.22), 0 0 0 1.5px rgba(176,125,46,0.18)',
              animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div style={{ fontSize: '52px', marginBottom: '10px' }}>📨</div>
            <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '22px', color: 'var(--text)', marginBottom: '6px' }}>
              Verificar Correo
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-3)', marginBottom: '22px', lineHeight: '1.6' }}>
              Ingresa el código de 6 dígitos enviado a<br />
              <strong style={{ color: 'var(--text)', fontSize: '13px' }}>{email}</strong>
            </p>

            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="_ _ _ _ _ _"
                  value={otpCode}
                  onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError(false); }}
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    background: otpError ? 'rgba(192,72,58,0.04)' : 'rgba(255,255,255,0.9)',
                    border: `2px solid ${otpError ? 'var(--red)' : 'var(--border)'}`,
                    borderRadius: '14px',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '28px',
                    fontWeight: '800',
                    color: 'var(--text)',
                    textAlign: 'center',
                    letterSpacing: '12px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    animation: otpError ? 'shake 0.35s ease' : 'none',
                  }}
                />
                {otpError && (
                  <p style={{ fontSize: '11px', color: 'var(--red)', fontWeight: '600', marginTop: '8px' }}>
                    ❌ Código incorrecto. Inténtalo de nuevo.
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '20px', minHeight: '20px' }}>
                {otpResendTimer > 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: '500' }}>
                    Reenviar en <strong style={{ color: 'var(--accent)' }}>{otpResendTimer}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--accent)', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    ¿No recibiste el código? Reenviar
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px',
                    border: '1.5px solid var(--border)', background: 'var(--bg-card2)',
                    fontFamily: 'Inter, sans-serif', fontSize: '13.5px', fontWeight: '600',
                    color: 'var(--text-2)', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={otpCode.length !== 6}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px',
                    border: 'none',
                    background: otpCode.length === 6
                      ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))'
                      : 'var(--border)',
                    fontFamily: 'Inter, sans-serif', fontSize: '13.5px', fontWeight: '700',
                    color: 'white', cursor: otpCode.length === 6 ? 'pointer' : 'not-allowed',
                    opacity: otpCode.length === 6 ? 1 : 0.6,
                    transition: 'all 0.2s',
                    boxShadow: otpCode.length === 6 ? '0 4px 14px rgba(176,125,46,0.3)' : 'none',
                  }}
                >
                  Confirmar →
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- ROLE CREATION & EDIT MODAL --- */}
      {showRoleModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '560px', maxHeight: '90vh' }}>
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '8px' }}>
              {editingRoleId ? 'Configurar Rol' : 'Crear Nuevo Rol'}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '20px' }}>
              Asigna permisos específicos. Los usuarios asignados a este rol tendrán estos accesos de forma instantánea.
            </p>

            <form onSubmit={handleRoleFormSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                <div className="inp-group">
                  <label>Nombre del Rol</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Contador, Supervisor, Panadero" 
                    value={roleName} 
                    onChange={(e) => setRoleName(e.target.value)} 
                    required 
                    disabled={!!editingRoleId} // El ID no se cambia
                  />
                </div>

                <div className="inp-group">
                  <label>Descripción Operativa</label>
                  <textarea 
                    placeholder="Describe las responsabilidades de este rol..." 
                    value={roleDesc} 
                    onChange={(e) => setRoleDesc(e.target.value)} 
                    required
                    style={{
                      width: '100%',
                      minHeight: '60px',
                      background: 'var(--bg-card2)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '11px',
                      padding: '11px 15px',
                      fontFamily: 'inherit',
                      fontSize: '13px',
                      color: 'var(--text)',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ fontSize: '10px', color: roleDesc.trim().length >= 8 ? 'var(--green)' : 'var(--text-3)', marginTop: '4px', fontWeight: '500' }}>
                    {roleDesc.trim().length >= 8 ? '🟢 Descripción adecuada' : '⚪ Min. 8 caracteres descriptivos'}
                  </div>
                </div>

                <div className="inp-group">
                  <label style={{ marginBottom: '8px' }}>Lista de Privilegios / Accesos</label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                    {SYSTEM_PERMISSIONS.map(p => {
                      const hasPerm = rolePermissions.includes(p.key);
                      return (
                        <div 
                          key={p.key}
                          onClick={() => handleTogglePermission(p.key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 14px',
                            background: hasPerm ? 'var(--accent-bg)' : 'var(--bg-card2)',
                            border: `1.5px solid ${hasPerm ? 'var(--border2)' : 'var(--border)'}`,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.18s var(--ease)'
                          }}
                        >
                          <div style={{ fontSize: '20px' }}>{p.icon}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text)' }}>{p.label}</div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginTop: '2px', lineHeight: '1.3' }}>{p.desc}</div>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={hasPerm}
                            onChange={() => {}} // Manejado por el click del div
                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '10.5px', color: rolePermissions.length > 0 ? 'var(--green)' : 'var(--text-3)', marginTop: '6px', fontWeight: '600' }}>
                    {rolePermissions.length > 0 ? `🟢 ${rolePermissions.length} privilegios seleccionados` : '⚪ Selecciona al menos 1 privilegio'}
                  </div>
                </div>

              </div>

              <div className="mc-btns" style={{ marginTop: '22px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowRoleModal(false)}>Cancelar</button>
                <button 
                  type="submit" 
                  className="mc-pri" 
                  disabled={!isRoleFormValid}
                  style={{ opacity: isRoleFormValid ? 1 : 0.6, cursor: isRoleFormValid ? 'pointer' : 'not-allowed' }}
                >
                  {editingRoleId ? 'Guardar Cambios' : 'Crear Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
