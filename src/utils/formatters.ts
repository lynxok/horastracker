import { format, parseISO } from 'date-fns';

export const formatDuration = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.floor((hours % 1) * 60);
  const s = Math.floor(((hours * 60) % 1) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateStr: string): string => {
  return format(parseISO(dateStr), 'dd/MM/yyyy');
};

export const formatTime = (dateStr: string): string => {
  return format(parseISO(dateStr), 'HH:mm');
};
