import React from 'react';
import { Pencil } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  cuit: string;
  hourlyRate: number;
  domicilio: string;
  condicionIva: string;
  workIp?: string;
}

interface ClientModalProps {
  editClientId: string | null;
  tempClient: Partial<Client>;
  setTempClient: (client: Partial<Client>) => void;
  onSave: () => void;
  onClose: () => void;
  onDetectIp: () => Promise<void>;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  editClientId,
  tempClient,
  setTempClient,
  onSave,
  onClose,
  onDetectIp
}) => {
  return (
    <div className="modal-overlay">
       <div className="premium-card" style={{ width: '100%', maxWidth: '500px' }}>
          <h2 className="mono-font" style={{ fontSize: '1rem', color: 'var(--accent-color)', marginBottom: '32px' }}>
            {editClientId ? 'EDITAR CLIENTE' : 'NUEVO CLIENTE'}
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <div>
                <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>RAZÓN SOCIAL / NOMBRE</label>
                <input type="text" value={tempClient.name || ''} onChange={e => setTempClient({...tempClient, name: e.target.value})}
                  style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>CUIT</label>
                  <input type="text" value={tempClient.cuit || ''} onChange={e => setTempClient({...tempClient, cuit: e.target.value})}
                    style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                </div>
                <div>
                  <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>VALOR HORA ($)</label>
                  <input type="number" value={tempClient.hourlyRate || 0} onChange={e => setTempClient({...tempClient, hourlyRate: Number(e.target.value)})}
                    style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                </div>
             </div>
             <div>
                <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>DOMICILIO</label>
                <input type="text" value={tempClient.domicilio || ''} onChange={e => setTempClient({...tempClient, domicilio: e.target.value})}
                  style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
             </div>
             <div>
                <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>CONDICIÓN IVA</label>
                <select value={tempClient.condicionIva || 'IVA Responsable Inscripto'} onChange={e => setTempClient({...tempClient, condicionIva: e.target.value})}
                  style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }}>
                  <option>IVA Responsable Inscripto</option>
                  <option>IVA Sujeto Exento</option>
                  <option>Consumidor Final</option>
                  <option>Responsable Monotributo</option>
                </select>
             </div>
             <div>
                <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>IP PÚBLICA DE ZONA DE TRABAJO</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={tempClient.workIp || ''} onChange={e => setTempClient({...tempClient, workIp: e.target.value})} placeholder="Ej: 190.11.23.44"
                    style={{ flex: 1, background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'var(--accent-color)', fontFamily: 'monospace' }} />
                  <button 
                    onClick={onDetectIp}
                    className="btn-secondary" style={{ fontSize: '0.7rem', padding: '0 12px' }}>DETECTAR MI IP</button>
                </div>
             </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
             <button onClick={onSave} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>GUARDAR</button>
             <button onClick={onClose} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>CANCELAR</button>
          </div>
       </div>
    </div>
  );
};
