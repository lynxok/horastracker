import React from 'react';
import { X } from 'lucide-react';
import { format, parseISO, differenceInSeconds } from 'date-fns';
import { formatCurrency } from '../../utils/formatters';

interface InvoicingModalProps {
  sessions: any[];
  selectedSessions: Set<string>;
  onToggleSession: (id: string) => void;
  onGenerate: () => void;
  onClose: () => void;
  isInvoicing: boolean;
}

export const InvoicingModal: React.FC<InvoicingModalProps> = ({
  sessions,
  selectedSessions,
  onToggleSession,
  onGenerate,
  onClose,
  isInvoicing
}) => {
  const pendingSessions = sessions
    .filter(s => s.endTime && !s.invoiced)
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  const totalToInvoice = pendingSessions
    .filter(s => selectedSessions.has(s.id))
    .reduce((acc, s) => {
      const hrs = differenceInSeconds(parseISO(s.endTime!), parseISO(s.startTime)) / 3600;
      return acc + (hrs * s.rate);
    }, 0);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(30px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
      <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--accent-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 className="mono-font" style={{ fontSize: '1.2rem' }}>[ FACTURACIÓN DE SESIONES PENDIENTES ]</h2>
          <button onClick={onClose} className="btn-secondary" style={{ border: 'none' }}><X size={20}/></button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--surface-border)' }}>
              <tr>
                <th style={{ padding: '10px' }}>SEL</th>
                <th>FECHA</th>
                <th>DURACIÓN</th>
                <th style={{ textAlign: 'right', paddingRight: '10px' }}>MONTO</th>
              </tr>
            </thead>
            <tbody className="mono-font" style={{ fontSize: '0.8rem' }}>
              {pendingSessions.map(s => {
                const hrs = differenceInSeconds(parseISO(s.endTime!), parseISO(s.startTime)) / 3600;
                return (
                  <tr key={s.id} onClick={() => onToggleSession(s.id)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', background: selectedSessions.has(s.id) ? 'rgba(14, 165, 233, 0.1)' : 'transparent' }}>
                    <td style={{ padding: '12px 10px' }}><input type="checkbox" checked={selectedSessions.has(s.id)} readOnly style={{ accentColor: 'var(--accent-color)' }} /></td>
                    <td>{format(parseISO(s.startTime), 'dd/MM/yyyy')}</td>
                    <td>{hrs.toFixed(1)} hs</td>
                    <td style={{ textAlign: 'right', paddingRight: '10px', color: 'var(--success)' }}>{formatCurrency(hrs * s.rate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pendingSessions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No hay sesiones pendientes de facturación.</div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div>
              <div className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>TOTAL A FACTURAR</div>
              <div className="mono-font" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)' }}>
                {formatCurrency(totalToInvoice)}
              </div>
           </div>
           <button 
            onClick={onGenerate} 
            disabled={isInvoicing || selectedSessions.size === 0}
            className="btn-primary" 
            style={{ height: '60px', padding: '0 40px', fontSize: '1rem' }}>
             {isInvoicing ? 'EMITIENDO...' : 'EMITIR RECIBO C'}
           </button>
        </div>
      </div>
    </div>
  );
};
