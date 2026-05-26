"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, sendRecoveryEmail, resetPasswordOffline, usersList } = useApp();

  // --- FORM STATES ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Recovery states
  const [showRecovery, setShowRecovery] = useState(false);
  const [recUsername, setRecUsername] = useState('');
  const [recEmail, setRecEmail] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Multi-role selection step
  const [roleStep, setRoleStep] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);

  // --- HANDLERS ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;

    const res = await login(username, password);
    if (res && res.success) {
      const u = res.user;
      if (u.rs.length === 1) {
        // Un solo rol -> Redirigir de inmediato a /dashboard
        router.push('/dashboard');
      } else {
        // Multiples roles -> Mostrar selector de roles
        setLoggedInUser(u);
        setSelectedRole(u.rs[0]);
        setRoleStep(true);
      }
    }
  };

  const handleRoleConfirm = () => {
    if (selectedRole) {
      router.push('/dashboard');
    }
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    if (!recUsername || !recEmail) return;

    const res = await sendRecoveryEmail(recUsername, recEmail);
    if (res && res.success) {
      setIsVerified(true);
      setVerifiedUserId(res.userId);
    }
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      alert("Las contraseñas no coinciden");
      return;
    }
    
    // Reglas de contraseña fuerte en recuperación
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passRegex.test(newPassword)) {
      alert("La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&).");
      return;
    }

    resetPasswordOffline(verifiedUserId, newPassword);
    
    // Regresar al login
    setShowRecovery(false);
    setIsVerified(false);
    setNewPassword('');
    setConfirmPassword('');
    setUsername(recUsername);
    setPassword(newPassword);
  };

  return (
    <div className="login-scene">
      <div className="deco-circle dc1"></div>
      <div className="deco-circle dc2"></div>

      <div className={`login-container ${roleStep ? 'wide-mode' : ''}`}>
        {/* Left Side: Brand and Features */}
        {!roleStep && (
          <div className="login-left">
            <div className="ll-top">
              <img src="/asset/logo.png" alt="Logo Snack Roque" className="bread-icon" onError={(e) => { e.target.src = "https://cdn-icons-png.flaticon.com/512/992/992747.png"; }} />
              <div className="ll-features">
                <div className="feature"><div className="f-dot">🥖</div>Pan artesanal y atención al instante</div>
                <div className="feature"><div className="f-dot">📊</div>Dashboard en tiempo real con métricas clave</div>
                <div className="feature"><div className="f-dot">🛒</div>Punto de venta rápido e intuitivo</div>
                <div className="feature"><div className="f-dot">👥</div>Gestión de roles y personal</div>
              </div>
            </div>
            <div className="ll-bottom">Snack Roque · Panadería &amp; Pastelería · v3.1</div>
          </div>
        )}

        {/* Right Side: Form Handler */}
        <div className="login-right">
          {/* STEP 1: LOGIN FORM */}
          {!roleStep && !showRecovery && (
            <div>
              <div className="lr-title">Bienvenido de vuelta</div>
              <p className="lr-sub">Accede a tu estación de trabajo</p>
              
              <form onSubmit={handleLoginSubmit}>
                <div className="inp-group">
                  <label>Usuario</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">👤</span>
                    <input 
                      type="text" 
                      placeholder="Ej: admin" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required 
                    />
                  </div>
                </div>
                
                <div className="inp-group">
                  <label>Contraseña</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">🔐</span>
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span 
                    onClick={() => { setShowRecovery(true); setIsVerified(false); }} 
                    style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600', cursor: 'pointer', fontFamily: 'sans-serif' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </span>
                </div>

                <button type="submit" className="btn-enter">Ingresar al sistema →</button>
              </form>
            </div>
          )}

          {/* STEP 2: MULTI-ROLE SELECTOR */}
          {roleStep && loggedInUser && (
            <div className="role-step" style={{ display: 'block' }}>
              <button 
                className="btn-back-sm" 
                onClick={() => setRoleStep(false)}
              >
                ← Cambiar usuario
              </button>
              <div className="lr-title">Selecciona tu rol</div>
              <p className="lr-sub">Hola <strong>{loggedInUser.n}</strong>, elige cómo ingresar hoy</p>
              
              <div className="roles-stack" style={{ margin: '20px 0' }}>
                {loggedInUser.rs.map((r, idx) => {
                  const icons = { Administrador: '👑', Cajero: '🛒', Panadero: '🥖' };
                  return (
                    <div 
                      key={r}
                      className={`role-tile ${selectedRole === r ? 'sel' : ''}`}
                      onClick={() => setSelectedRole(r)}
                    >
                      <div className="rt-icon">{icons[r] || '👤'}</div>
                      <div className="rt-texts">
                        <div className="rt-name">{r}</div>
                        <div className="rt-desc">Ingresar como {r}</div>
                      </div>
                      <div className="rt-radio">{selectedRole === r ? '✓' : ''}</div>
                    </div>
                  );
                })}
              </div>
              
              <button 
                onClick={handleRoleConfirm} 
                className="btn-enter"
              >
                Confirmar e ingresar →
              </button>
            </div>
          )}

          {/* STEP 3: PASSWORD RECOVERY VIEW */}
          {showRecovery && !isVerified && (
            <div>
              <button className="btn-back-sm" onClick={() => setShowRecovery(false)}>← Volver al login</button>
              <div className="lr-title">Recuperar Acceso</div>
              <p className="lr-sub">Verifica tus datos de personal</p>
              
              <form onSubmit={handleRecoverySubmit}>
                <div className="inp-group">
                  <label>Usuario (login)</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">👤</span>
                    <input 
                      type="text" 
                      placeholder="Ej: admin" 
                      value={recUsername}
                      onChange={(e) => setRecUsername(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <div className="inp-group">
                  <label>Correo Electrónico</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">📧</span>
                    <input 
                      type="email" 
                      placeholder="correo@snackroque.com" 
                      value={recEmail}
                      onChange={(e) => setRecEmail(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <button type="submit" className="btn-enter">Verificar datos →</button>
              </form>
            </div>
          )}

          {/* STEP 4: RESET PASSWORD FORM */}
          {showRecovery && isVerified && (
            <div>
              <div className="lr-title">Nueva Contraseña</div>
              <p className="lr-sub">Establece una contraseña segura</p>
              
              <form onSubmit={handleResetSubmit}>
                <div className="inp-group">
                  <label>Nueva Contraseña</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">🔐</span>
                    <input 
                      type="password" 
                      placeholder="Mínimo 8 caracteres, 1 número, 1 símbolo" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <div className="inp-group">
                  <label>Confirmar Contraseña</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">🔐</span>
                    <input 
                      type="password" 
                      placeholder="Repite la contraseña" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <button type="submit" className="btn-enter">Restablecer Contraseña →</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
