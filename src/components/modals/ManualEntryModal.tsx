import React from 'react';
import { X, Clock, Calendar, DollarSign, FileText, User } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface Client {
  id: string;
  name: string;
  hourlyRate: number;
}

interface ManualEntryModalProps {
  clients: Client[];
  isEditing?: boolean;
  manualEntry: {
    clientId: string;
    date: string;
    startTime: string;
    endTime: string;
    description: string;
    rate: number;
  };
  setManualEntry: (entry: any) => void;
  onSave: () => void;
  onClose: () => void;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  clients,
  isEditing = false,
  manualEntry,
  setManualEntry,
  onSave,
  onClose
}) => {
  // Calculate total hours
  const calculateHours = (): number => {
    if (!manualEntry.startTime || !manualEntry.endTime) return 0;
    const [sh, sm] = manualEntry.startTime.split(':').map(Number);
    const [eh, em] = manualEntry.endTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
    let diffMin = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMin < 0) diffMin += 24 * 60; // Crosses midnight
    return diffMin / 60;
  };

  const hours = calculateHours();
  const rate = parseFloat(manualEntry.rate as any) || 0;
  const totalAmount = hours * rate;

  const handleClientChange = (clientId: string) => {
    const selected = clients.find(c => c.id === clientId);
    setManualEntry({
      ...manualEntry,
      clientId,
      rate: selected?.hourlyRate ?? manualEntry.rate
    });
  };

  return (
    <div className="modal-overlay">
      <div 
        className="premium-card fade-in" 
        style={{ 
          width: '100%', 
          maxWidth: '520px', 
          background: '#0d121f', 
          border: '1px solid var(--accent-color)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.95)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--accent-color)" />
            <h2 className="mono-font" style={{ fontSize: '1rem', color: 'var(--accent-color)', margin: 0 }}>
              {isEditing ? '[ EDITAR TURNO REGISTRADO ]' : '[ CARGA MANUAL DE TURNO ]'}
            </h2>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ border: 'none', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <p className="mono-font" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
          {isEditing 
            ? 'Modificá la fecha, horarios o tarifa de este turno ya registrado en el historial.'
            : 'Ingresá un turno manual indicando cliente, día y horas trabajadas.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* CLIENTE */}
          <div>
            <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <User size={12} /> CLIENTE
            </label>
            <select 
              value={manualEntry.clientId} 
              onChange={e => handleClientChange(e.target.value)}
              style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px 12px', color: 'white', fontFamily: 'monospace', borderRadius: '4px' }}
            >
              <option value="">Seleccionar cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          {/* FECHA */}
          <div>
            <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Calendar size={12} /> FECHA DEL TURNO
            </label>
            <input 
              type="date" 
              value={manualEntry.date} 
              onChange={e => setManualEntry({ ...manualEntry, date: e.target.value })}
              style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px 12px', color: 'white', fontFamily: 'monospace', borderRadius: '4px' }} 
            />
          </div>

          {/* HORARIOS INICIO Y FIN */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Clock size={12} /> HORA INICIO
              </label>
              <input 
                type="time" 
                value={manualEntry.startTime} 
                onChange={e => setManualEntry({ ...manualEntry, startTime: e.target.value })}
                style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px 12px', color: 'white', fontFamily: 'monospace', borderRadius: '4px' }} 
              />
            </div>
            <div>
              <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Clock size={12} /> HORA FIN
              </label>
              <input 
                type="time" 
                value={manualEntry.endTime} 
                onChange={e => setManualEntry({ ...manualEntry, endTime: e.target.value })}
                style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px 12px', color: 'white', fontFamily: 'monospace', borderRadius: '4px' }} 
              />
            </div>
          </div>

          {/* VALOR POR HORA */}
          <div>
            <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <DollarSign size={12} /> VALOR POR HORA ($)
            </label>
            <input 
              type="number" 
              step="100"
              value={manualEntry.rate || ''} 
              onChange={e => setManualEntry({ ...manualEntry, rate: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px 12px', color: 'white', fontFamily: 'monospace', borderRadius: '4px' }} 
            />
          </div>

          {/* PREVIEW TIEMPO Y TOTAL */}
          <div style={{ 
            background: 'rgba(255,255,255,0.03)', 
            border: '1px solid var(--surface-border)', 
            borderRadius: '4px', 
            padding: '12px 14px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <div className="mono-font" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              DURACIÓN: <strong style={{ color: '#fff' }}>{hours.toFixed(2)} hs</strong>
            </div>
            <div className="mono-font" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>
              +${formatCurrency(totalAmount)}
            </div>
          </div>

          {/* DESCRIPCIÓN */}
          <div>
            <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <FileText size={12} /> DESCRIPCIÓN / TAREA
            </label>
            <textarea 
              value={manualEntry.description} 
              onChange={e => setManualEntry({ ...manualEntry, description: e.target.value })}
              placeholder="¿Qué estuviste haciendo?"
              style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px 12px', color: 'white', fontFamily: 'monospace', minHeight: '60px', resize: 'vertical', borderRadius: '4px' }} 
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '14px', marginTop: '24px' }}>
          <button 
            type="button"
            onClick={onSave} 
            disabled={!manualEntry.clientId || !manualEntry.date || !manualEntry.startTime || !manualEntry.endTime} 
            className="btn-primary" 
            style={{ flex: 1, justifyContent: 'center', padding: '10px' }}
          >
            {isEditing ? 'GUARDAR CAMBIOS' : 'REGISTRAR TURNO'}
          </button>
          <button 
            type="button"
            onClick={onClose} 
            className="btn-secondary" 
            style={{ flex: 1, justifyContent: 'center', padding: '10px' }}
          >
            CANCELAR
          </button>
        </div>
      </div>
    </div>
  );
};
