"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function RecoveryPage() {
  const router = useRouter();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Validaciones en tiempo real
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[@$!%*?&]/.test(newPassword);
  const isMatch = newPassword === confirmPassword && confirmPassword !== '';

  const isFormValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && isMatch;

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        
        setSuccessMsg('🔒 ¡Contraseña actualizada con éxito! Redirigiendo al login...');
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } catch (err) {
        setErrorMsg(`❌ Error al actualizar: ${err.message}`);
      }
    } else {
      setErrorMsg('⚠️ El modo Supabase no está configurado localmente.');
    }
    setLoading(false);
  };

  return (
    <div className="login-scene">
      <div className="deco-circle dc1"></div>
      <div className="deco-circle dc2"></div>

      <div className="login-container" style={{ gridTemplateColumns: '1fr', maxWidth: '480px' }}>
        <div className="login-right" style={{ padding: '40px' }}>
          <div className="lr-title">Restablecer Contraseña</div>
          <p className="lr-sub">Configura tu nueva contraseña segura en la nube</p>

          {successMsg && (
            <div style={{ background: 'var(--green-bg)', color: 'var(--green)', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: '600' }}>
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: '600' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handlePasswordUpdate}>
            <div className="inp-group">
              <label>Nueva Contraseña</label>
              <div className="inp-wrap">
                <span className="inp-icon">🔐</span>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="inp-group">
              <label>Confirmar Nueva Contraseña</label>
              <div className="inp-wrap">
                <span className="inp-icon">🔐</span>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required 
                />
              </div>
            </div>

            {/* Checklist de requisitos visuales */}
            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', marginBottom: '16px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                Requisitos de Seguridad:
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li style={{ color: hasMinLength ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                  {hasMinLength ? '🟢' : '⚪'} Mínimo 8 caracteres
                </li>
                <li style={{ color: hasUppercase ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                  {hasUppercase ? '🟢' : '⚪'} Al menos una mayúscula (A-Z)
                </li>
                <li style={{ color: hasLowercase ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                  {hasLowercase ? '🟢' : '⚪'} Al menos una minúscula (a-z)
                </li>
                <li style={{ color: hasNumber ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                  {hasNumber ? '🟢' : '⚪'} Al menos un número (0-9)
                </li>
                <li style={{ color: hasSpecial ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                  {hasSpecial ? '🟢' : '⚪'} Al menos un carácter especial (@$!%*?&)
                </li>
                <li style={{ color: isMatch ? 'var(--green)' : 'var(--text-3)', fontWeight: '500' }}>
                  {isMatch ? '🟢' : '⚪'} Las contraseñas coinciden
                </li>
              </ul>
            </div>

            <button 
              type="submit" 
              className="btn-enter" 
              disabled={!isFormValid || loading}
              style={{ opacity: isFormValid ? 1 : 0.6, cursor: isFormValid ? 'pointer' : 'not-allowed' }}
            >
              {loading ? 'Procesando...' : 'Actualizar Contraseña →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
