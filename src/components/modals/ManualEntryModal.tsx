import React from 'react';
import { X } from 'lucide-react';
import { format } from 'date-fns';

interface Client {
  id: string;
  name: string;
  hourlyRate: number;
}

interface ManualEntryModalProps {
  clients: Client[];
  manualEntry: {
    clientId: string;
    date: string;
    startTime: string;
    endTime: string;
    description: string;
  };
  setManualEntry: (entry: any) => void;
  onSave: () => void;
  onClose: () => void;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  clients,
  manualEntry,
  setManualEntry,
  onSave,
  onClose
}) => {
  return (
    <div className="modal-overlay">
       <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 className="mono-font" style={{ fontSize: '1rem', color: 'var(--accent-color)' }}>[ CARGA MANUAL DE TURNO ]</h2>
            <button onClick={onClose} className="btn-secondary" style={{ border: 'none' }}><X size={20}/></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <div>
                <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>CLIENTE</label>
                <select value={manualEntry.clientId} onChange={e => setManualEntry({...manualEntry, clientId: e.target.value})}
                  style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }}>
                  <option value="">Seleccionar cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
             </div>
             
             <div>
                <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>FECHA</label>
                <input type="date" value={manualEntry.date} onChange={e => setManualEntry({...manualEntry, date: e.target.value})}
                  style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>INICIO</label>
                  <input type="time" value={manualEntry.startTime} onChange={e => setManualEntry({...manualEntry, startTime: e.target.value})}
                    style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                </div>
                <div>
                  <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>FIN</label>
                  <input type="time" value={manualEntry.endTime} onChange={e => setManualEntry({...manualEntry, endTime: e.target.value})}
                    style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                </div>
             </div>

             <div>
                <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>DESCRIPCIÓN / TAREA</label>
                <textarea value={manualEntry.description} onChange={e => setManualEntry({...manualEntry, description: e.target.value})}
                  placeholder="¿Qué estuviste haciendo?"
                  style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace', minHeight: '80px', resize: 'vertical' }} />
             </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
             <button onClick={onSave} disabled={!manualEntry.clientId || !manualEntry.date || !manualEntry.startTime || !manualEntry.endTime} 
               className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>GUARDAR TURNO</button>
             <button onClick={onClose} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>CANCELAR</button>
          </div>
       </div>
    </div>
  );
};
