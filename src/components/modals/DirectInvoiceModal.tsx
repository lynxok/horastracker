import React, { useState, useEffect } from 'react';
import { X, Zap, Calendar, Clock, DollarSign, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/formatters';

interface Client {
  id: string;
  name: string;
  cuit: string;
  domicilio: string;
  condicionIva: string;
  hourlyRate: number;
}

export interface DirectInvoiceData {
  clientId: string;
  date: string;
  periodMonth?: string;
  serviceStart: string;
  serviceEnd: string;
  hours: number;
  rate: number;
  totalAmount: number;
  description: string;
  createSessionRecord: boolean;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const getMonthLabel = (yyyyMm: string) => {
  const parts = yyyyMm.split('-');
  if (parts.length < 2) return yyyyMm;
  const mIndex = parseInt(parts[1], 10) - 1;
  return `${MONTH_NAMES[mIndex] || parts[1]} ${parts[0]}`;
};

const getMonthRange = (yyyyMm: string) => {
  const parts = yyyyMm.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const start = `${yyyyMm}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${yyyyMm}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

interface DirectInvoiceModalProps {
  clients: Client[];
  defaultClientId?: string;
  onGenerate: (data: DirectInvoiceData) => Promise<void>;
  onClose: () => void;
  isInvoicing: boolean;
}

export const DirectInvoiceModal: React.FC<DirectInvoiceModalProps> = ({
  clients,
  defaultClientId,
  onGenerate,
  onClose,
  isInvoicing
}) => {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentMonthStr = format(today, 'yyyy-MM');

  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthStr = format(prevMonthDate, 'yyyy-MM');

  const [clientId, setClientId] = useState<string>(defaultClientId || (clients[0]?.id || ''));
  const [hours, setHours] = useState<string>('1');
  const [rate, setRate] = useState<string>('0');
  const [totalAmount, setTotalAmount] = useState<string>('0');
  const [date, setDate] = useState<string>(todayStr); // Fecha de emisión oficial
  
  // Período al que se debe la factura
  const [periodType, setPeriodType] = useState<'month' | 'range' | 'single'>('month');
  const [periodMonth, setPeriodMonth] = useState<string>(currentMonthStr);
  const [serviceStart, setServiceStart] = useState<string>(() => getMonthRange(currentMonthStr).start);
  const [serviceEnd, setServiceEnd] = useState<string>(() => getMonthRange(currentMonthStr).end);

  const [description, setDescription] = useState<string>(() => `Servicios de desarrollo y consultoría - Período ${getMonthLabel(currentMonthStr)}`);
  const [createSessionRecord, setCreateSessionRecord] = useState<boolean>(true);

  const selectedClient = clients.find(c => c.id === clientId);

  // Sync rate when client changes
  useEffect(() => {
    if (selectedClient) {
      const clientRate = selectedClient.hourlyRate || 0;
      setRate(clientRate.toString());
      const numHours = parseFloat(hours) || 0;
      setTotalAmount((numHours * clientRate).toFixed(2));
    }
  }, [clientId]);

  // Recalculate total when hours or rate changes
  const handleHoursChange = (val: string) => {
    setHours(val);
    const numHours = parseFloat(val) || 0;
    const numRate = parseFloat(rate) || 0;
    setTotalAmount((numHours * numRate).toFixed(2));
  };

  const handleRateChange = (val: string) => {
    setRate(val);
    const numHours = parseFloat(hours) || 0;
    const numRate = parseFloat(val) || 0;
    setTotalAmount((numHours * numRate).toFixed(2));
  };

  const handleTotalChange = (val: string) => {
    setTotalAmount(val);
    const numTotal = parseFloat(val) || 0;
    const numHours = parseFloat(hours) || 0;
    if (numHours > 0) {
      setRate((numTotal / numHours).toFixed(2));
    }
  };

  const handleSelectMonth = (mStr: string) => {
    setPeriodMonth(mStr);
    const range = getMonthRange(mStr);
    setServiceStart(range.start);
    setServiceEnd(range.end);
    // Sugerir actualización en la descripción si contiene "Período"
    setDescription(prev => {
      if (prev.includes('Período')) {
        return prev.replace(/Período.*$/, `Período ${getMonthLabel(mStr)}`);
      }
      return `${prev} - Período ${getMonthLabel(mStr)}`;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numHours = parseFloat(hours);
    const numRate = parseFloat(rate);
    const numTotal = parseFloat(totalAmount);

    if (!selectedClient) {
      alert('Por favor selecciona un cliente');
      return;
    }
    if (isNaN(numHours) || numHours <= 0) {
      alert('Ingresa una cantidad de horas válida');
      return;
    }
    if (isNaN(numTotal) || numTotal <= 0) {
      alert('El monto total a facturar debe ser mayor a 0');
      return;
    }

    const effectiveStart = periodType === 'single' ? date : serviceStart;
    const effectiveEnd = periodType === 'single' ? date : serviceEnd;
    const effectivePeriodMonth = periodType === 'month' 
      ? periodMonth 
      : (effectiveStart ? effectiveStart.substring(0, 7) : periodMonth);

    onGenerate({
      clientId,
      date,
      periodMonth: effectivePeriodMonth,
      serviceStart: effectiveStart,
      serviceEnd: effectiveEnd,
      hours: numHours,
      rate: numRate,
      totalAmount: numTotal,
      description: description.trim() || `Servicios profesionales (${numHours} hs) - Período ${getMonthLabel(effectivePeriodMonth)}`,
      createSessionRecord
    });
  };

  return (
    <div className="modal-overlay">
      <div 
        className="premium-card fade-in" 
        style={{ 
          width: '100%', 
          maxWidth: '650px', 
          maxHeight: '90vh', 
          overflowY: 'auto',
          border: '1px solid var(--accent-color)',
          background: '#0d121f',
          boxShadow: '0 20px 60px rgba(0,0,0,0.95)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={20} color="var(--accent-color)" />
            <h2 className="mono-font" style={{ fontSize: '1.1rem', margin: 0, color: 'var(--accent-color)' }}>
              [ FACTURACIÓN DIRECTA ]
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isInvoicing}
            className="btn-secondary" 
            style={{ border: 'none', padding: '6px' }}
          >
            <X size={20}/>
          </button>
        </div>

        <p className="mono-font" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Generá una factura oficial electrónica (ARCA/AFIP) directamente indicando cliente, horas, monto y el período correspondiente.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Cliente */}
          <div>
            <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              CLIENTE
            </label>
            <select 
              value={clientId} 
              onChange={e => setClientId(e.target.value)}
              disabled={isInvoicing}
              style={{ 
                width: '100%', 
                background: '#000', 
                border: '1px solid var(--surface-border)', 
                padding: '10px 12px', 
                color: 'white', 
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                borderRadius: '4px'
              }}
            >
              <option value="">Seleccionar cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.cuit ? `(CUIT: ${c.cuit})` : ''}
                </option>
              ))}
            </select>

            {selectedClient && (
              <div className="mono-font" style={{ marginTop: '6px', fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', gap: '15px' }}>
                <span>CUIT: <strong style={{ color: '#fff' }}>{selectedClient.cuit || 'Sin CUIT'}</strong></span>
                <span>Condición: <strong style={{ color: '#fff' }}>{selectedClient.condicionIva || 'Consumidor Final'}</strong></span>
              </div>
            )}
          </div>

          {/* Horas y Valor Hora */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Clock size={12} /> CANTIDAD DE HORAS
              </label>
              <input 
                type="number" 
                step="0.25"
                min="0.25"
                value={hours} 
                onChange={e => handleHoursChange(e.target.value)}
                disabled={isInvoicing}
                placeholder="Ej: 10"
                style={{ 
                  width: '100%', 
                  background: '#000', 
                  border: '1px solid var(--surface-border)', 
                  padding: '10px 12px', 
                  color: 'white', 
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  borderRadius: '4px'
                }} 
              />
            </div>

            <div>
              <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <DollarSign size={12} /> VALOR POR HORA ($)
              </label>
              <input 
                type="number" 
                step="100"
                value={rate} 
                onChange={e => handleRateChange(e.target.value)}
                disabled={isInvoicing}
                style={{ 
                  width: '100%', 
                  background: '#000', 
                  border: '1px solid var(--surface-border)', 
                  padding: '10px 12px', 
                  color: 'white', 
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  borderRadius: '4px'
                }} 
              />
            </div>
          </div>

          {/* Total calculado editable */}
          <div style={{ 
            background: 'rgba(255,255,255,0.03)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            borderRadius: '6px', 
            padding: '14px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>TOTAL A FACTURAR (FINAL)</div>
              <div className="mono-font" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                ${formatCurrency(parseFloat(totalAmount) || 0)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Ajuste manual:</span>
              <input 
                type="number"
                step="1"
                value={totalAmount}
                onChange={e => handleTotalChange(e.target.value)}
                disabled={isInvoicing}
                style={{ 
                  width: '130px', 
                  background: '#000', 
                  border: '1px solid var(--accent-color)', 
                  padding: '6px 10px', 
                  color: '#fff', 
                  fontFamily: 'monospace', 
                  fontSize: '0.9rem',
                  textAlign: 'right',
                  borderRadius: '4px'
                }}
              />
            </div>
          </div>

          {/* PERÍODO AL QUE CORRESPONDE LA FACTURA */}
          <div style={{ 
            border: '1px solid var(--accent-color)', 
            background: 'rgba(14, 165, 233, 0.04)', 
            padding: '14px', 
            borderRadius: '6px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={13} /> PERÍODO FACTURADO (A QUÉ PERÍODO SE DEBE)
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPeriodType('month');
                    handleSelectMonth(periodMonth);
                  }}
                  className="mono-font"
                  style={{
                    background: periodType === 'month' ? 'var(--accent-color)' : 'transparent',
                    color: periodType === 'month' ? '#000' : 'var(--text-secondary)',
                    border: '1px solid var(--accent-color)',
                    padding: '3px 8px',
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                    borderRadius: '3px'
                  }}
                >
                  Mes Completo
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType('range')}
                  className="mono-font"
                  style={{
                    background: periodType === 'range' ? 'var(--accent-color)' : 'transparent',
                    color: periodType === 'range' ? '#000' : 'var(--text-secondary)',
                    border: '1px solid var(--accent-color)',
                    padding: '3px 8px',
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                    borderRadius: '3px'
                  }}
                >
                  Rango Fechas
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType('single')}
                  className="mono-font"
                  style={{
                    background: periodType === 'single' ? 'var(--accent-color)' : 'transparent',
                    color: periodType === 'single' ? '#000' : 'var(--text-secondary)',
                    border: '1px solid var(--accent-color)',
                    padding: '3px 8px',
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                    borderRadius: '3px'
                  }}
                >
                  Fecha Única
                </button>
              </div>
            </div>

            {/* Sub-UI según periodType */}
            {periodType === 'month' && (
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleSelectMonth(currentMonthStr)}
                    className="btn-secondary"
                    style={{
                      fontSize: '0.65rem',
                      padding: '4px 10px',
                      background: periodMonth === currentMonthStr ? 'rgba(14, 165, 233, 0.2)' : 'transparent',
                      borderColor: periodMonth === currentMonthStr ? 'var(--accent-color)' : 'var(--surface-border)'
                    }}
                  >
                    Mes actual ({getMonthLabel(currentMonthStr)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectMonth(prevMonthStr)}
                    className="btn-secondary"
                    style={{
                      fontSize: '0.65rem',
                      padding: '4px 10px',
                      background: periodMonth === prevMonthStr ? 'rgba(14, 165, 233, 0.2)' : 'transparent',
                      borderColor: periodMonth === prevMonthStr ? 'var(--accent-color)' : 'var(--surface-border)'
                    }}
                  >
                    Mes anterior ({getMonthLabel(prevMonthStr)})
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      SELECCIONAR MES Y AÑO
                    </span>
                    <input 
                      type="month"
                      value={periodMonth}
                      onChange={e => handleSelectMonth(e.target.value)}
                      disabled={isInvoicing}
                      style={{ 
                        width: '100%', 
                        background: '#000', 
                        border: '1px solid var(--accent-color)', 
                        padding: '8px 12px', 
                        color: 'white', 
                        fontFamily: 'monospace',
                        borderRadius: '4px',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                  <div className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>Rango AFIP: <strong style={{ color: '#fff' }}>{serviceStart}</strong> al <strong style={{ color: '#fff' }}>{serviceEnd}</strong></div>
                    <div style={{ color: 'var(--accent-color)', marginTop: '2px' }}>Período fiscal: {getMonthLabel(periodMonth)}</div>
                  </div>
                </div>
              </div>
            )}

            {periodType === 'range' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>SERVICIO DESDE</span>
                  <input 
                    type="date" 
                    value={serviceStart} 
                    onChange={e => setServiceStart(e.target.value)}
                    disabled={isInvoicing}
                    style={{ 
                      width: '100%', 
                      background: '#000', 
                      border: '1px solid var(--surface-border)', 
                      padding: '8px 12px', 
                      color: 'white', 
                      fontFamily: 'monospace',
                      borderRadius: '4px'
                    }} 
                  />
                </div>
                <div>
                  <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>SERVICIO HASTA</span>
                  <input 
                    type="date" 
                    value={serviceEnd} 
                    onChange={e => setServiceEnd(e.target.value)}
                    disabled={isInvoicing}
                    style={{ 
                      width: '100%', 
                      background: '#000', 
                      border: '1px solid var(--surface-border)', 
                      padding: '8px 12px', 
                      color: 'white', 
                      fontFamily: 'monospace',
                      borderRadius: '4px'
                    }} 
                  />
                </div>
              </div>
            )}

            {periodType === 'single' && (
              <div>
                <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>FECHA DEL SERVICIO</span>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => {
                    setDate(e.target.value);
                    setServiceStart(e.target.value);
                    setServiceEnd(e.target.value);
                  }}
                  disabled={isInvoicing}
                  style={{ 
                    width: '100%', 
                    background: '#000', 
                    border: '1px solid var(--surface-border)', 
                    padding: '8px 12px', 
                    color: 'white', 
                    fontFamily: 'monospace',
                    borderRadius: '4px'
                  }} 
                />
              </div>
            )}
          </div>

          {/* Fecha de Emisión Fiscal (ARCA) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
            <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={12} /> FECHA DE EMISIÓN DE LA FACTURA (FECHA FISCAL AFIP)
            </label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              disabled={isInvoicing}
              style={{ 
                width: '100%', 
                background: '#000', 
                border: '1px solid var(--surface-border)', 
                padding: '8px 12px', 
                color: 'white', 
                fontFamily: 'monospace',
                borderRadius: '4px'
              }} 
            />
          </div>

          {/* Concepto / Descripción */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={12} /> CONCEPTO / DETALLE DE FACTURA
              </label>
              <button
                type="button"
                onClick={() => {
                  const pLabel = periodType === 'month' 
                    ? getMonthLabel(periodMonth) 
                    : (serviceStart === serviceEnd ? serviceStart : `${serviceStart} al ${serviceEnd}`);
                  setDescription(`Servicios profesionales (${hours} hs) - Período ${pLabel}`);
                }}
                className="mono-font"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-color)',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Insertar período en concepto
              </button>
            </div>
            <input 
              type="text" 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              disabled={isInvoicing}
              placeholder="Ej: Servicios de desarrollo y consultoría técnica"
              style={{ 
                width: '100%', 
                background: '#000', 
                border: '1px solid var(--surface-border)', 
                padding: '10px 12px', 
                color: 'white', 
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                borderRadius: '4px'
              }} 
            />
          </div>

          {/* Checkbox: Guardar como sesión en historial */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            padding: '10px 14px', 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid var(--surface-border)',
            borderRadius: '4px'
          }}>
            <input 
              type="checkbox" 
              id="createSessionCheck"
              checked={createSessionRecord} 
              onChange={e => setCreateSessionRecord(e.target.checked)}
              disabled={isInvoicing}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            <label htmlFor="createSessionCheck" className="mono-font" style={{ fontSize: '0.72rem', color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
              Registrar sesión en el historial de turnos (computa para gráficos y horas mensuales en el período seleccionado)
            </label>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
            <button 
              type="submit" 
              disabled={isInvoicing || !clientId || parseFloat(hours) <= 0 || parseFloat(totalAmount) <= 0} 
              className="btn-primary" 
              style={{ flex: 2, justifyContent: 'center', padding: '12px', fontSize: '0.85rem' }}
            >
              {isInvoicing ? 'EMITIENDO FACTURA EN ARCA...' : 'EMITIR FACTURA (ARCA / AFIP)'}
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isInvoicing} 
              className="btn-secondary" 
              style={{ flex: 1, justifyContent: 'center', padding: '12px', fontSize: '0.85rem' }}
            >
              CANCELAR
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
