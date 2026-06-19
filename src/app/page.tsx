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
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
  const [passwordResetDone, setPasswordResetDone] = useState(false);

  // OTP states
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const [otpSendError, setOtpSendError] = useState('');

  // Multi-role states
  const [roleStep, setRoleStep] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Password strength
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[@$!%*?&]/.test(newPassword);
  const isPasswordSecure = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const isPasswordMatch = newPassword === confirmPassword && confirmPassword.length > 0;

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
        body: JSON.stringify({ email: target, code }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setOtpSendError(body?.message || body?.error || 'Error desconocido');
        return false;
      }
      return true;
    } catch {
      setOtpSendError('No se pudo conectar con el servicio de email');
      return false;
    }
  };

  const handleOpenRecovery = () => {
    setShowRecovery(true);
    setIsVerified(false);
    setOtpStep(false);
    setRecEmail('');
    setRecEmailValid(null);
    setOtpSendError('');
    setPasswordResetDone(false);
    setLoginError('');
  };

  // --- HANDLERS ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!username || !password) return;
    setIsLoggingIn(true);
    const res = await login(username, password);
    if (res && res.success && res.user) {
      const u = res.user;
      if (u.rs.length === 1) {
        router.push('/dashboard');
      } else {
        setLoggedInUser(u);
        setSelectedRole(u.rs[0]);
        setRoleStep(true);
        setIsLoggingIn(false);
      }
    } else {
      setLoginError(res?.message || 'Credenciales inválidas o usuario inactivo');
      setIsLoggingIn(false);
    }
  };

  const handleRoleConfirm = () => {
    if (selectedRole) router.push('/dashboard');
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recEmail || !recEmailValid) return;
    setOtpSending(true);
    setOtpSendError('');
    const res = await sendRecoveryEmail(recEmail);
    if (res && res.success) {
      const sent = await generateAndSendOtp(recEmail);
      if (sent) {
        setOtpStep(true);
        startResendTimer();
        if (res.userId !== undefined) setVerifiedUserId(res.userId);
      }
    } else {
      setOtpSendError(res?.message || 'Correo no encontrado en el sistema.');
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
    if (sent) startResendTimer();
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordSecure || !isPasswordMatch) return;
    if (verifiedUserId !== null) {
      await resetPasswordOffline(verifiedUserId, newPassword);
    }
    setPasswordResetDone(true);
  };

  return (
    <div className="login-scene">
      <div className="deco-circle dc1" />
      <div className="deco-circle dc2" />

      <div className={`login-container ${roleStep ? 'wide-mode' : ''}`}>

        {/* ── LEFT PANEL ── */}
        {!roleStep && (
          <div className="login-left">
            <div className="ll-top">
              <img
                src="/asset/logo.png"
                alt="Logo Snack Roque"
                className="bread-icon"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/992/992747.png'; }}
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

        {/* ── RIGHT PANEL ── */}
        <div className="login-right">

          {/* STEP 1 — LOGIN */}
          {!roleStep && !showRecovery && (
            <div>
              <div className="mobile-brand-header">
                <img src="/asset/logo.png" alt="Logo" className="mobile-bread-icon"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/992/992747.png'; }} />
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
                    <input type="text" placeholder="Ej: admin o carlos"
                      value={username} onChange={(e) => { setUsername(e.target.value); setLoginError(''); }} required />
                  </div>
                </div>

                <div className="inp-group">
                  <label>Contraseña</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">🔐</span>
                    <input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                      value={password} onChange={(e) => { setPassword(e.target.value); setLoginError(''); }} required />
                    <button type="button" className="eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div style={{ background: 'rgba(192,72,58,0.08)', border: '1px solid rgba(192,72,58,0.20)', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--red)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⚠️</span> {loginError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
                  <button type="button" onClick={handleOpenRecovery}
                    style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--accent)', fontWeight: '700', cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif', position: 'relative', zIndex: 1 }}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button type="submit" className="btn-enter" disabled={isLoggingIn}>
                  {isLoggingIn ? '⏳ Ingresando...' : 'Ingresar al sistema →'}
                </button>
              </form>
            </div>
          )}

          {/* STEP 2 — MULTI-ROLE SELECTOR */}
          {roleStep && loggedInUser && (
            <div className="role-step" style={{ display: 'block' }}>
              <button className="btn-back-sm" onClick={() => setRoleStep(false)}>← Cambiar usuario</button>
              <div className="lr-title">Selecciona tu rol</div>
              <p className="lr-sub">Hola <strong>{loggedInUser.n.split(' ')[0]}</strong>, elige cómo ingresar hoy</p>
              <div className="roles-stack" style={{ margin: '20px 0' }}>
                {loggedInUser.rs.map((r) => {
                  const icons: Record<string, string> = { Administrador: '👑', Cajero: '🛒', Panadero: '🥖', Supervisor: '🔍', Contador: '📊' };
                  return (
                    <div key={r} className={`role-tile ${selectedRole === r ? 'sel' : ''}`} onClick={() => setSelectedRole(r)}>
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
              <button onClick={handleRoleConfirm} className="btn-enter">Confirmar e ingresar →</button>
            </div>
          )}

          {/* STEP 3 — RECOVERY */}
          {showRecovery && !isVerified && (
            <div>
              <button className="btn-back-sm" onClick={() => { setShowRecovery(false); setOtpStep(false); setOtpSendError(''); }}>
                ← Volver al login
              </button>
              <div className="mobile-brand-header">
                <img src="/asset/logo.png" alt="Logo" className="mobile-bread-icon"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/992/992747.png'; }} />
                <span className="mobile-brand-title">Snack Roque</span>
                <span className="mobile-brand-subtitle">Panadería &amp; Pastelería</span>
              </div>

              <div className="lr-title">Recuperar Acceso</div>

              {/* SUB-STEP A — Email */}
              {!otpStep && (
                <>
                  <p className="lr-sub">Ingresa tu correo registrado y te enviaremos un código de 6 dígitos</p>
                  <form onSubmit={handleSendOtp}>
                    <div className="inp-group">
                      <label>Correo Electrónico</label>
                      <div className={`inp-wrap ${recEmailValid === false ? 'inp-error' : recEmailValid === true ? 'inp-ok' : ''}`}>
                        <span className="inp-icon">📧</span>
                        <input type="email" placeholder="correo@ejemplo.com"
                          value={recEmail} onChange={(e) => handleEmailChange(e.target.value)} required />
                        {recEmailValid === true && <span className="inp-status-icon">✅</span>}
                        {recEmailValid === false && <span className="inp-status-icon">❌</span>}
                      </div>
                      {recEmailValid === false && (
                        <p style={{ fontSize: '11px', color: 'var(--red)', fontWeight: '600', marginTop: '5px' }}>
                          Ingresa un correo electrónico válido
                        </p>
                      )}
                      {otpSendError && (
                        <div style={{ marginTop: '10px', background: 'rgba(192,72,58,0.08)', border: '1px solid rgba(192,72,58,0.20)', borderRadius: '10px', padding: '10px 14px', fontSize: '12.5px', color: 'var(--red)', fontWeight: '600' }}>
                          ⚠️ {otpSendError}
                        </div>
                      )}
                    </div>
                    <button type="submit" className="btn-enter" disabled={!recEmailValid || otpSending}>
                      {otpSending ? '⏳ Enviando código...' : 'Enviar código de verificación →'}
                    </button>
                  </form>
                </>
              )}

              {/* SUB-STEP B — OTP */}
              {otpStep && (
                <>
                  {/* Email badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(176,125,46,0.20)', borderRadius: '12px', padding: '10px 14px', marginBottom: '20px', backdropFilter: 'blur(4px)' }}>
                    <span style={{ fontSize: '20px' }}>📧</span>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600', margin: 0 }}>Código enviado a</p>
                      <p style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '700', margin: 0 }}>{recEmail}</p>
                    </div>
                    <button type="button" onClick={() => { setOtpStep(false); setOtpCode(''); setOtpError(false); }}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '11px', color: 'var(--accent)', fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      Cambiar
                    </button>
                  </div>

                  <p className="lr-sub" style={{ marginBottom: '20px' }}>Ingresa el código de 6 dígitos</p>

                  <form onSubmit={handleVerifyOtp}>
                    <div className="inp-group">
                      <div className="otp-wrap">
                        <input type="text" inputMode="numeric" maxLength={6}
                          placeholder="· · · · · ·"
                          value={otpCode}
                          onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError(false); }}
                          className={`otp-input${otpError ? ' otp-input-error' : ''}`}
                          autoFocus required />
                      </div>
                      {otpError && (
                        <p style={{ fontSize: '12px', color: 'var(--red)', fontWeight: '600', marginTop: '8px', textAlign: 'center' }}>
                          ❌ Código incorrecto. Inténtalo de nuevo.
                        </p>
                      )}
                    </div>

                    {/* Progress dots */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
                      {[0,1,2,3,4,5].map(i => (
                        <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: i < otpCode.length ? 'var(--accent)' : 'rgba(176,125,46,0.20)', transition: 'background 0.2s', boxShadow: i < otpCode.length ? '0 0 6px rgba(176,125,46,0.40)' : 'none' }} />
                      ))}
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                      {otpResendTimer > 0 ? (
                        <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: '500' }}>
                          Reenviar en <strong style={{ color: 'var(--accent)' }}>{otpResendTimer}s</strong>
                        </span>
                      ) : (
                        <button type="button" onClick={handleResendOtp} disabled={otpSending}
                          style={{ background: 'none', border: 'none', fontSize: '12.5px', color: 'var(--accent)', fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                          {otpSending ? 'Reenviando...' : '¿No recibiste el código? Reenviar'}
                        </button>
                      )}
                    </div>

                    {otpSendError && (
                      <div style={{ marginBottom: '14px', background: 'rgba(192,72,58,0.08)', border: '1px solid rgba(192,72,58,0.20)', borderRadius: '10px', padding: '10px 14px', fontSize: '12.5px', color: 'var(--red)', fontWeight: '600' }}>
                        ⚠️ {otpSendError}
                      </div>
                    )}

                    <button type="submit" className="btn-enter" disabled={otpCode.length !== 6}>
                      Verificar código →
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {/* STEP 4 — RESET PASSWORD */}
          {showRecovery && isVerified && !passwordResetDone && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(74,140,92,0.10)', border: '1px solid rgba(74,140,92,0.25)', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px' }}>
                <span style={{ fontSize: '22px' }}>✅</span>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--green)', margin: 0 }}>Identidad verificada</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: 0, marginTop: '2px' }}>Ahora establece tu nueva contraseña</p>
                </div>
              </div>

              <div className="lr-title">Nueva Contraseña</div>
              <p className="lr-sub">Debe tener al menos 8 caracteres, mayúscula, número y símbolo</p>

              <form onSubmit={handleResetSubmit}>
                <div className="inp-group">
                  <label>Nueva Contraseña</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">🔐</span>
                    <input type={showNewPassword ? 'text' : 'password'} placeholder="Mínimo 8 caracteres"
                      value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                    <button type="button" className="eye-btn" onClick={() => setShowNewPassword(v => !v)} tabIndex={-1}>
                      {showNewPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {/* Strength indicators */}
                  {newPassword.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {[
                        { ok: hasMinLength, label: '8+ chars' },
                        { ok: hasUppercase, label: 'Mayúscula' },
                        { ok: hasLowercase, label: 'Minúscula' },
                        { ok: hasNumber, label: 'Número' },
                        { ok: hasSpecial, label: 'Símbolo' },
                      ].map(({ ok, label }) => (
                        <span key={label} style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: ok ? 'rgba(74,140,92,0.12)' : 'rgba(176,125,46,0.08)', color: ok ? 'var(--green)' : 'var(--text-3)', border: `1px solid ${ok ? 'rgba(74,140,92,0.25)' : 'rgba(176,125,46,0.15)'}`, transition: 'all 0.2s' }}>
                          {ok ? '✓' : '○'} {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="inp-group">
                  <label>Confirmar Contraseña</label>
                  <div className={`inp-wrap ${confirmPassword.length > 0 ? (isPasswordMatch ? 'inp-ok' : 'inp-error') : ''}`}>
                    <span className="inp-icon">🔐</span>
                    <input type={showConfirmPassword ? 'text' : 'password'} placeholder="Repite la contraseña"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                    <button type="button" className="eye-btn" onClick={() => setShowConfirmPassword(v => !v)} tabIndex={-1}>
                      {showConfirmPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && !isPasswordMatch && (
                    <p style={{ fontSize: '11px', color: 'var(--red)', fontWeight: '600', marginTop: '5px' }}>Las contraseñas no coinciden</p>
                  )}
                </div>

                <button type="submit" className="btn-enter" disabled={!isPasswordSecure || !isPasswordMatch}>
                  Restablecer Contraseña →
                </button>
              </form>
            </div>
          )}

          {/* STEP 5 — SUCCESS */}
          {showRecovery && isVerified && passwordResetDone && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px', animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>🎉</div>
              <div className="lr-title" style={{ textAlign: 'center' }}>¡Contraseña actualizada!</div>
              <p className="lr-sub" style={{ textAlign: 'center', marginBottom: '28px' }}>
                Tu contraseña ha sido restablecida con éxito. Ya puedes ingresar al sistema.
              </p>
              <button className="btn-enter" onClick={() => {
                setShowRecovery(false);
                setIsVerified(false);
                setPasswordResetDone(false);
                setNewPassword('');
                setConfirmPassword('');
                setUsername('');
                setPassword('');
              }}>
                Ir al inicio de sesión →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
