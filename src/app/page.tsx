"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, User } from '@/context/AppContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, sendRecoveryEmail, resetPasswordOffline } = useApp();

  // --- FORM STATES ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Recovery states
  const [showRecovery, setShowRecovery] = useState(false);
  const [recEmail, setRecEmail] = useState('');
  const [recEmailValid, setRecEmailValid] = useState<boolean | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState<number | string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [recUsername, setRecUsername] = useState('');

  // OTP states
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const [otpSendError, setOtpSendError] = useState('');

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleEmailChange = (val: string) => {
    setRecEmail(val);
    setRecEmailValid(val.length > 0 ? validateEmail(val) : null);
    if (otpSendError) setOtpSendError('');
  };

  const startResendTimer = () => {
    setOtpResendTimer(60);
    const interval = setInterval(() => {
      setOtpResendTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const generateAndSendOtp = async (emailTarget?: string): Promise<boolean> => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(code);
    setOtpCode('');
    setOtpError(false);
    setOtpSendError('');
    const target = emailTarget || recEmail;
    try {
      const resp = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target, otp: code }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const errMsg = body?.error || 'Error desconocido';
        setOtpSendError(errMsg);
        console.warn('[OTP] Error enviando email:', errMsg);
        return false;
      }
      return true;
    } catch (err) {
      const msg = 'No se pudo conectar con la API de email';
      setOtpSendError(msg);
      console.warn('[OTP] No se pudo conectar con la API de email:', err);
      return false;
    }
  };

  const handleOpenRecovery = () => {
    setShowRecovery(true);
    setIsVerified(false);
    setRecoverySent(false);
    setOtpStep(false);
    setRecEmail('');
    setRecEmailValid(null);
    setOtpSendError('');
  };

  // Multi-role selection step
  const [roleStep, setRoleStep] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // --- HANDLERS ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    const res = await login(username, password);
    if (res && res.success && res.user) {
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recEmail || !recEmailValid) return;

    setOtpSending(true);
    setOtpSendError('');

    const res = await sendRecoveryEmail(recEmail);
    if (res && res.success) {
      if (res.online) {
        // Supabase envía el correo real
        setRecoverySent(true);
      } else {
        // Modo offline (con usuarios locales): enviamos OTP real por Resend
        const sent = await generateAndSendOtp(recEmail);
        if (sent) {
          setOtpStep(true);
          startResendTimer();
          if (res.userId !== undefined) {
            setVerifiedUserId(res.userId);
          }
          if (res.username !== undefined) {
            setRecUsername(res.username);
          }
        }
      }
    }
    setOtpSending(false);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode === generatedOtp) {
      setOtpError(false);
      setIsVerified(true);
      setOtpStep(false);
    } else {
      setOtpError(true);
      setOtpCode('');
    }
  };

  const handleResendOtp = async () => {
    if (otpResendTimer > 0) return;
    setOtpSending(true);
    const sent = await generateAndSendOtp(recEmail);
    setOtpSending(false);
    if (sent) {
      startResendTimer();
    }
  };

  const handleResetSubmit = (e: React.FormEvent) => {
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

    if (verifiedUserId !== null) {
      resetPasswordOffline(verifiedUserId, newPassword);
    }
    
    // Regresar al login
    setShowRecovery(false);
    setIsVerified(false);
    setNewPassword('');
    setConfirmPassword('');
    setUsername('');
    setPassword('');
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
              <img 
                src="/asset/logo.png" 
                alt="Logo Snack Roque" 
                className="bread-icon" 
                onError={(e) => { (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/992/992747.png"; }} 
              />
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
              {/* Responsive Brand Header (visible on mobile/tablet when left panel is hidden) */}
              <div className="mobile-brand-header">
                <img 
                  src="/asset/logo.png" 
                  alt="Logo Snack Roque" 
                  className="mobile-bread-icon" 
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/992/992747.png"; }} 
                />
                <span className="mobile-brand-title">Snack Roque</span>
                <span className="mobile-brand-subtitle">Panadería &amp; Pastelería</span>
              </div>

              <div className="lr-title">Bienvenido de vuelta</div>
              <p className="lr-sub">Accede a tu estación de trabajo</p>
              
              <form onSubmit={handleLoginSubmit}>
                <div className="inp-group">
                  <label>Usuario</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">👤</span>
                    <input 
                      type="text" 
                      placeholder="Ej: admin o carlos" 
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
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShowPassword(v => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span 
                    onClick={handleOpenRecovery} 
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
                {loggedInUser.rs.map((r) => {
                  const icons: Record<string, string> = { Administrador: '👑', Cajero: '🛒', Panadero: '🥖' };
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
              <button className="btn-back-sm" onClick={() => { setShowRecovery(false); setRecoverySent(false); setOtpStep(false); }}>← Volver al login</button>
              
              {/* Responsive Brand Header */}
              <div className="mobile-brand-header">
                <img 
                  src="/asset/logo.png" 
                  alt="Logo Snack Roque" 
                  className="mobile-bread-icon" 
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/992/992747.png"; }} 
                />
                <span className="mobile-brand-title">Snack Roque</span>
                <span className="mobile-brand-subtitle">Panadería &amp; Pastelería</span>
              </div>

              <div className="lr-title">Recuperar Acceso</div>

              {recoverySent ? (
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
                  <p className="lr-sub" style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-1)', marginBottom: '8px' }}>
                    Hemos enviado un enlace de recuperación a <strong>{recEmail}</strong>.
                  </p>
                  <p className="lr-sub" style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.5', marginBottom: '24px' }}>
                    Por favor revisa tu bandeja de entrada (y la carpeta de correo no deseado) y sigue las instrucciones para restablecer tu contraseña en la nube.
                  </p>
                  <button 
                    onClick={() => { setShowRecovery(false); setRecoverySent(false); }} 
                    className="btn-enter"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              ) : !otpStep ? (
                /* SUB-STEP A: Ingresar correo */
                <>
                  <p className="lr-sub">Ingresa tu correo registrado y te enviaremos un código de verificación</p>
                  <form onSubmit={handleSendOtp}>
                    <div className="inp-group">
                      <label>Correo Electrónico</label>
                      <div className={`inp-wrap ${recEmailValid === false ? 'inp-error' : recEmailValid === true ? 'inp-ok' : ''}`}>
                        <span className="inp-icon">📧</span>
                        <input 
                          type="email" 
                          placeholder="correo@ejemplo.com" 
                          value={recEmail}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          required 
                        />
                        {recEmailValid === true && <span className="inp-status-icon">✅</span>}
                        {recEmailValid === false && <span className="inp-status-icon">❌</span>}
                      </div>
                      {recEmailValid === true && (
                        <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: '600', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }}></span>
                          Correo válido
                        </span>
                      )}
                      {recEmailValid === false && (
                        <span style={{ fontSize: '11px', color: 'var(--red)', fontWeight: '600', marginTop: '5px', display: 'block' }}>
                          Ingresa un correo electrónico válido
                        </span>
                      )}
                      {otpSendError && (
                        <span style={{ fontSize: '11.5px', color: 'var(--red)', fontWeight: '600', marginTop: '8px', display: 'block', background: 'rgba(192,72,58,0.06)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(192,72,58,0.15)', textAlign: 'left', lineHeight: '1.4' }}>
                          ❌ Error al enviar: {otpSendError}
                        </span>
                      )}
                    </div>

                    <button 
                      type="submit" 
                      className="btn-enter"
                      disabled={!recEmailValid || otpSending}
                      style={{ opacity: recEmailValid ? 1 : 0.6, cursor: recEmailValid ? 'pointer' : 'not-allowed' }}
                    >
                      {otpSending ? 'Enviando código...' : 'Enviar código de verificación →'}
                    </button>
                  </form>
                </>
              ) : (
                /* SUB-STEP B: Ingresar OTP */
                <>
                  <p className="lr-sub">
                    Ingresa el código de 6 dígitos enviado a <strong>{recEmail}</strong>
                  </p>
                  <form onSubmit={handleVerifyOtp}>
                    <div className="inp-group">
                      <label>Código de Verificación</label>
                      <div className="otp-wrap">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="_ _ _ _ _ _"
                          value={otpCode}
                          onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError(false); }}
                          className={`otp-input${otpError ? ' otp-input-error' : ''}`}
                          autoFocus
                          required
                        />
                      </div>
                      {otpError && (
                        <span style={{ fontSize: '11px', color: 'var(--red)', fontWeight: '600', marginTop: '6px', display: 'block' }}>
                          ❌ Código incorrecto. Inténtalo de nuevo.
                        </span>
                      )}
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                      {otpResendTimer > 0 ? (
                        <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: '500' }}>
                          Reenviar código en <strong style={{ color: 'var(--accent)' }}>{otpResendTimer}s</strong>
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

                    {otpSendError && (
                      <span style={{ fontSize: '11.5px', color: 'var(--red)', fontWeight: '600', marginBottom: '14px', display: 'block', background: 'rgba(192,72,58,0.06)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(192,72,58,0.15)', textAlign: 'left', lineHeight: '1.4' }}>
                        ❌ Error al reenviar: {otpSendError}
                      </span>
                    )}

                    <button 
                      type="submit" 
                      className="btn-enter"
                      disabled={otpCode.length !== 6}
                      style={{ opacity: otpCode.length === 6 ? 1 : 0.6, cursor: otpCode.length === 6 ? 'pointer' : 'not-allowed' }}
                    >
                      Verificar código →
                    </button>

                    <button
                      type="button"
                      className="btn-back-sm"
                      onClick={() => { setOtpStep(false); setOtpCode(''); setOtpError(false); }}
                      style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
                    >
                      ← Cambiar correo
                    </button>
                  </form>
                </>
              )}
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
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres, 1 número, 1 símbolo" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required 
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShowNewPassword(v => !v)}
                      tabIndex={-1}
                      aria-label={showNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showNewPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="inp-group">
                  <label>Confirmar Contraseña</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">🔐</span>
                    <input 
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repite la contraseña" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required 
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showConfirmPassword ? '🙈' : '👁️'}
                    </button>
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
