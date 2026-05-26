"use client";

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function PersonalPage() {
  const { usersList, saveUser, toggleUserStatus } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Cajero');

  // --- PASSWORD & USERNAME STRENGTH INDICATORS ---
  const isUsernameValid = username.length >= 5 && /^[a-zA-Z0-9]+$/.test(username);
  
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);

  const isPasswordSecure = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  // El formulario es válido si el usuario y la contraseña cumplen todos los requisitos de seguridad
  const isFormValid = firstName && lastName && email && isUsernameValid && isPasswordSecure;

  const handleOpenNew = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setUsername('');
    setEmail('');
    setPhone('');
    setPassword('');
    setRole('Cajero');
    setShowModal(true);
  };

  const handleOpenEdit = (u) => {
    setEditingId(u.id);
    
    // Separamos nombres y apellidos del nombre guardado
    const nameParts = u.n.split(' ');
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
    
    setUsername(u.u);
    setEmail(u.email || '');
    setPhone(u.phone || '');
    setPassword(u.p || '1234'); // Para el mock
    setRole(u.rs[0] || 'Cajero');
    setShowModal(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    const userObj = {
      id: editingId,
      n: `${firstName} ${lastName}`,
      u: username,
      p: password,
      role,
      email,
      phone: phone || '-'
    };

    saveUser(userObj);
    setShowModal(false);
  };

  const activeCount = usersList.filter(u => u.st === 'act').length;

  return (
    <div className="screen active">
      {/* TOOLBAR & METRICS */}
      <div className="tb-bar">
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ padding: '6px 14px', background: 'var(--accent-bg)', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '11px', fontWeight: '700', color: 'var(--accent)' }}>
            Total: <span>{usersList.length}</span>
          </div>
          <div style={{ padding: '6px 14px', background: 'var(--green-bg)', border: '1px solid rgba(74,140,92,0.2)', borderRadius: '20px', fontSize: '11px', fontWeight: '700', color: 'var(--green)' }}>
            Activos: <span>{activeCount}</span>
          </div>
        </div>
        <button className="btn-new" onClick={handleOpenNew}>+ Agregar personal</button>
      </div>

      {/* USER CARDS GRID */}
      <div className="user-cards">
        {usersList.map((u) => (
          <div className="uc" key={u.id}>
            <div className="uc-av">{u.n ? u.n[0].toUpperCase() : '👤'}</div>
            <div className="uc-name">{u.n}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>@{u.u}</div>
            
            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px', textAlign: 'center' }}>
              📧 {u.email || 'sin correo'}<br />
              📞 {u.phone || 'sin teléfono'}
            </div>

            <div className="uc-roles" style={{ marginTop: '8px' }}>
              {u.rs.map(r => (
                <span key={r} className={`role-tag ${r === 'Administrador' ? 'rt-a' : 'rt-c'}`}>
                  {r}
                </span>
              ))}
            </div>

            <div className={`uc-status ${u.st === 'act' ? 'on' : 'off'}`} style={{ marginTop: '6px' }}>
              {u.st === 'act' ? '● Activo' : '○ Inactivo'}
            </div>

            <div className="uc-btns" style={{ marginTop: '12px' }}>
              <button className="uc-btn" onClick={() => handleOpenEdit(u)}>Editar</button>
              <button 
                className="uc-btn" 
                style={{ color: u.st === 'act' ? 'var(--red)' : 'var(--green)', borderColor: u.st === 'act' ? 'rgba(192,72,58,0.2)' : 'rgba(74,140,92,0.2)' }}
                onClick={() => toggleUserStatus(u.id)}
              >
                {u.st === 'act' ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* USER COLLABORATOR MODAL WITH STRENGTH CHECKLIST */}
      {showProductModal || showModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '520px' }}>
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '20px' }}>
              {editingId ? 'Editar Colaborador' : 'Nuevo Colaborador'}
            </div>

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                
                <div className="inp-group">
                  <label>Nombres</label>
                  <input type="text" placeholder="Ej: Ana María" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>

                <div className="inp-group">
                  <label>Apellidos</label>
                  <input type="text" placeholder="Ej: Rodríguez López" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>

                <div className="inp-group">
                  <label>Usuario (login - alfanumérico)</label>
                  <input type="text" placeholder="Ej: arodriguez" value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} required />
                  <div style={{ fontSize: '10px', color: isUsernameValid ? 'var(--green)' : 'var(--text-3)', marginTop: '4px', fontWeight: '500' }}>
                    {isUsernameValid ? '🟢 Válido' : '⚪ Min. 5 caracteres, sin espacios ni símbolos'}
                  </div>
                </div>

                <div className="inp-group">
                  <label>Rol</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="Cajero">🛒 Cajero</option>
                    <option value="Administrador">⚙️ Administrador</option>
                  </select>
                </div>

                <div className="inp-group">
                  <label>Correo Electrónico</label>
                  <input type="email" placeholder="aro@snackroque.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>

                <div className="inp-group">
                  <label>Número de Teléfono</label>
                  <input type="text" placeholder="Ej: 987654321" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>

                <div className="inp-group" style={{ gridColumn: 'span 2' }}>
                  <label>Contraseña Acceso</label>
                  <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>

                {/* VISUAL PASSWORD STRENGTH CHECKLIST */}
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
                <button type="button" className="mc-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                <button 
                  type="submit" 
                  className="mc-pri" 
                  disabled={!isFormValid}
                  style={{ opacity: isFormValid ? 1 : 0.6, cursor: isFormValid ? 'pointer' : 'not-allowed' }}
                >
                  {editingId ? 'Guardar Cambios' : 'Registrar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
