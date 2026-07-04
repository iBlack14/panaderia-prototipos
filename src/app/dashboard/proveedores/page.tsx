"use client";

import React, { useState } from 'react';
import { useApp, Provider } from '@/context/AppContext';

export default function ProveedoresPage() {
  const { providers, saveProvider, toggleProvider } = useApp();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  
  // Form states
  const [ruc, setRuc] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [validationError, setValidationError] = useState('');
  const [loadingSunat, setLoadingSunat] = useState(false);
  const [isAutoFilled, setIsAutoFilled] = useState(false);

  const lookupRuc = async (rucVal: string) => {
    if (!rucVal || !/^\d{11}$/.test(rucVal)) return;

    setLoadingSunat(true);
    setValidationError('');
    try {
      const res = await fetch('/api/consulta-ruc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruc: rucVal }),
      });
      const result = await res.json();
      if (res.ok && result.success && result.data) {
        setName(result.data.nombre_o_razon_social || '');
        setAddress(result.data.direccion_completa || result.data.direccion || '');
        setIsAutoFilled(true);
      } else {
        setValidationError(result.message || 'No se encontró el RUC en SUNAT.');
        setIsAutoFilled(false);
      }
    } catch (err) {
      console.error('Error al consultar RUC:', err);
      setValidationError('Error al conectar con la API de SUNAT.');
      setIsAutoFilled(false);
    } finally {
      setLoadingSunat(false);
    }
  };

  const handleRucChange = (val: string) => {
    const cleanVal = val.replace(/\D/g, '').slice(0, 11);
    setRuc(cleanVal);
    if (cleanVal.length === 11) {
      lookupRuc(cleanVal);
    } else {
      setIsAutoFilled(false);
    }
  };

  const filteredProviders = providers.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ruc.includes(searchTerm)
  );

  const handleOpenNew = () => {
    setEditingId(null);
    setRuc('');
    setName('');
    setPhone('');
    setAddress('');
    setValidationError('');
    setIsAutoFilled(false);
    setLoadingSunat(false);
    setShowModal(true);
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('new') === 'true') {
        handleOpenNew();
        // Clear URL search params so the modal does not reopen on manual reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  const handleOpenEdit = (prov: Provider) => {
    setEditingId(prov.id);
    setRuc(prov.ruc);
    setName(prov.name);
    setPhone(prov.phone);
    setAddress(prov.address);
    setValidationError('');
    setIsAutoFilled(prov.ruc.length === 11);
    setLoadingSunat(false);
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // RUC Validation (Exactly 11 digits and numeric)
    const rucRegex = /^\d{11}$/;
    if (!rucRegex.test(ruc)) {
      setValidationError('⚠️ El RUC debe contener exactamente 11 dígitos numéricos.');
      return;
    }

    // Duplicate Validation
    const isDuplicate = providers.some(p => p.ruc === ruc && p.id !== editingId);
    if (isDuplicate) {
      alert('No se puede, este proveedor ya está registrado en el sistema.');
      return;
    }

    // Name Validation (relaxed regex, or skip check if auto-filled)
    if (!isAutoFilled) {
      const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s'\-\.,&/()]+$/;
      if (!nameRegex.test(name.trim())) {
        setValidationError('⚠️ El nombre de la empresa / razón social contiene caracteres no válidos.');
        return;
      }
    }

    // Phone Validation (only digits, max 9)
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone && !/^\d+$/.test(cleanPhone)) {
      setValidationError('⚠️ El número de teléfono solo debe contener números.');
      return;
    }
    if (cleanPhone.length > 9) {
      setValidationError('⚠️ El número de teléfono no debe exceder los 9 dígitos.');
      return;
    }

    const provObj = {
      id: editingId,
      ruc,
      name,
      phone: cleanPhone || '-',
      address: address || '-'
    };

    await saveProvider(provObj);
    setShowModal(false);
  };

  return (
    <div className="screen active">
      {/* TOOLBAR */}
      <div className="tb-bar">
        <div className="tb-left">
          <div className="srch-box">
            <span>🔍</span>
            <input 
              placeholder="Buscar por RUC o Razón Social..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-new" onClick={handleOpenNew}>+ Nuevo proveedor</button>
      </div>

      {/* TABLE PANEL */}
      <div className="panel">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>RUC</th>
              <th style={{ textAlign: 'left' }}>Empresa (Razón Social)</th>
              <th style={{ textAlign: 'left' }}>Teléfono</th>
              <th style={{ textAlign: 'left' }}>Dirección</th>
              <th style={{ textAlign: 'left' }}>Estado</th>
              <th style={{ textAlign: 'left' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProviders.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: '600' }}>
                  Sin proveedores registrados.
                </td>
              </tr>
            ) : (
              filteredProviders.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: '700', color: 'var(--accent)' }}>{p.ruc}</td>
                  <td style={{ fontWeight: '600', color: 'var(--text)' }}>{p.name}</td>
                  <td>{p.phone}</td>
                  <td>{p.address}</td>
                  <td>
                    <span className={`tag ${p.active ? 'tg-ok' : 'tg-err'}`}>
                      {p.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="act-row">
                      <button className="act-btn" onClick={() => handleOpenEdit(p)} title="Editar">✏️</button>
                      <button 
                        className={`act-btn ${p.active ? 'del' : ''}`} 
                        onClick={() => toggleProvider(p.id)}
                        title={p.active ? 'Desactivar' : 'Activar'}
                      >
                        {p.active ? '❌' : '✅'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* REGISTRATION MODAL */}
      {showModal && (
        <div className="modal-overlay open">
          <div className="modal-card">
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '20px' }}>
              {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </div>
            
            {validationError && (
              <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '12px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px', fontWeight: '600' }}>
                {validationError}
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div className="inp-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>RUC (11 dígitos)</label>
                  {loadingSunat && <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 'bold' }}>⚡ Buscando en SUNAT...</span>}
                  {isAutoFilled && <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 'bold' }}>✓ Verificado por SUNAT</span>}
                </div>
                <div className="inp-wrap">
                  <input 
                    type="text" 
                    placeholder="Ej: 20123456789" 
                    value={ruc}
                    onChange={(e) => handleRucChange(e.target.value)}
                    maxLength={11}
                    required 
                  />
                </div>
              </div>

              <div className="inp-group">
                <label>Nombre de la Empresa / Razón Social</label>
                <div className="inp-wrap">
                  <input 
                    type="text" 
                    placeholder="Ej: Harinas del Norte S.A.C." 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required 
                    readOnly={isAutoFilled}
                    style={isAutoFilled ? { backgroundColor: 'var(--bg-hover)', color: 'var(--text-3)', cursor: 'not-allowed' } : {}}
                  />
                </div>
              </div>

              <div className="inp-group">
                <label>Número de Teléfono</label>
                <div className="inp-wrap">
                  <input 
                    type="tel" 
                    placeholder="Ej: 987654321" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    maxLength={9}
                  />
                </div>
              </div>

              <div className="inp-group">
                <label>Dirección Física</label>
                <div className="inp-wrap">
                  <input 
                    type="text" 
                    placeholder="Ej: Av. Industrial 543, Callao" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    readOnly={isAutoFilled}
                    style={isAutoFilled ? { backgroundColor: 'var(--bg-hover)', color: 'var(--text-3)', cursor: 'not-allowed' } : {}}
                  />
                </div>
              </div>

              <div className="mc-btns" style={{ marginTop: '22px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">
                  {editingId ? 'Guardar Cambios' : 'Registrar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
