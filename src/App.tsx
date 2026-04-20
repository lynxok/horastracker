import React, { useState, useEffect, useMemo } from 'react';
import lynxIconUrl from './assets/lynx_icon.png';
import lynxLogoUrl from './assets/lynx_logo.png';
import { 
  Play, Square, History, Settings as SettingsIcon, 
  Trash2, Shield, Activity, X, 
  Minus, Maximize2, Pencil, BarChart3, Clock, 
  Lock
} from 'lucide-react';
import { 
  format, differenceInSeconds, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, startOfDay, endOfDay, 
  isWithinInterval, parseISO 
} from 'date-fns';

const APP_VERSION = '2.2.3';

// --- TYPES ---
declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      saveData: (data: any) => Promise<{ success: boolean }>;
      loadData: () => Promise<any>;
      getDataPath: () => Promise<string>;
      setMinimizeToTray: (val: boolean) => void;
      updateTray: (status: string) => void;
      setAutostart: (val: boolean) => Promise<boolean>;
      getAutostart: () => Promise<boolean>;
      onTrayAction: (callback: (action: string, data?: any) => void) => void;
      syncTrayData: (data: { clients: any[]; activeSession: any | null }) => void;
      generateArcaCSR: (data: any) => Promise<{ success: boolean; folder?: string; keyPath?: string; csrPath?: string; msg?: string; error?: string }>;
      testArcaConnection: (settings: any) => Promise<{ success: boolean; status?: any; error?: string; detailed?: string }>;
      generateArcaInvoice: (data: any) => Promise<{ success: boolean; cae?: string; numero?: number; filePath?: string; error?: string }>;
      generateArcaCreditNote: (data: any) => Promise<{ success: boolean; cae?: string; numero?: number; filePath?: string; error?: string }>;
      selectFolder: () => Promise<string | null>;
      selectFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
      openFile: (path: string) => Promise<{ success: boolean; error?: string }>;
      getArcaInvoiceInfo: (data: any) => Promise<{ success: boolean; info?: any; error?: string }>;
      getPublicIp: () => Promise<{ success: boolean; ip?: string; error?: string }>;
      getVersion: () => Promise<string>;
      checkForUpdates: () => void;
      restartApp: () => void;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      onUpdateNotAvailable: (callback: () => void) => void;
      onCheckingForUpdate: (callback: () => void) => void;
      onUpdateError: (callback: (err: string) => void) => void;
      syncMonitoringData: (data: any) => void;
      closeToast: () => void;
      onStartSessionFromToast: (callback: (client: any) => void) => void;
      toastActionStart: (client: any) => void;
    }
  }
}

interface Client {
  id: string;
  name: string;
  cuit: string;
  domicilio: string;
  condicionIva: string;
  hourlyRate: number;
  workIp?: string;
}

interface WorkSession {
  id: string;
  startTime: string;
  endTime?: string;
  rate: number;
  clientId: string;
  clientName: string;
  invoiced?: boolean;
  invoiceId?: string;
}

interface BilledMonth {
  id: string;
  date: string;
  month: string;
  totalHours: number;
  rate: number;
  totalAmount: number;
  status: 'ACTIVE' | 'CANCELLED';
  invoiceNumber?: number;
  cae?: string;
  filePath?: string;
  monthlyGoal?: number;
  sessionsIds: string[];
  clientId?: string;
  clientName?: string;
  serviceStart?: string;
  serviceEnd?: string;
}

interface AppSettings {
  clients: Client[];
  selectedClientId: string;
  minimizeToTray: boolean;
  autoStart: boolean;
  appPassword: string | null;
  monthlyGoal: number;
  arcaInfo: {
    cuit: string;
    puntoVenta: string;
    certPath: string;
    keyPath: string;
    productionMode: boolean;
  };
  invoicePath?: string;
  theme?: 'cyberpunk' | 'matrix' | 'minimal' | 'deep-ocean';
}

const DEFAULT_CLIENTS: Client[] = [
  {
    id: 'default-client',
    name: 'INSTITUTO DE TRAUMATOLOGIA Y ENFERMEDADES OSEAS S R L',
    cuit: '30588898179',
    domicilio: 'San Martin 1247 - Parana, Entre Ríos',
    condicionIva: 'IVA Responsable Inscripto',
    hourlyRate: 5000
  }
];

const DEFAULT_SETTINGS: AppSettings = {
  clients: DEFAULT_CLIENTS,
  selectedClientId: 'default-client',
  minimizeToTray: true,
  autoStart: false,
  appPassword: null,
  monthlyGoal: 500000,
  arcaInfo: { cuit: '20326691314', puntoVenta: '2', certPath: '', keyPath: '', productionMode: true },
  invoicePath: '',
  theme: 'cyberpunk'
};

// --- COMPONENT ---
const App: React.FC = () => {
  // Data State
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [billedMonths, setBilledMonths] = useState<BilledMonth[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  // App Infrastructure State
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [lockInput, setLockInput] = useState('');
  const [activeTab, setActiveTab] = useState<'tracker' | 'dashboard' | 'history' | 'settings'>('tracker');
  const [dataPath, setDataPath] = useState<string>('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // ARCA Specific State
  const [arcaTesting, setArcaTesting] = useState(false);
  const [arcaStatus, setArcaStatus] = useState<{ msg: string; type: 'success' | 'error' | 'idle' }>({ msg: '', type: 'idle' });
  const [activeZoneClient, setActiveZoneClient] = useState<Client | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'available' | 'downloaded' | 'idle' | 'checking' | 'not-available' | 'error'>('idle');
  const [appVersion, setAppVersion] = useState<string>('...');
  const [isToastView, setIsToastView] = useState(false);
  const [toastData, setToastData] = useState<any>(null);
  const [isInvoicing, setIsInvoicing] = useState(false);

  // Modal States
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [manualStartDate, setManualStartDate] = useState("");
  const [manualStartTime, setManualStartTime] = useState("");
  const [manualEndDate, setManualEndDate] = useState("");
  const [manualEndTime, setManualEndTime] = useState("");
  const [manualRate, setManualRate] = useState<number>(0);

  const [showInvoicingModal, setShowInvoicingModal] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [arcaDetailedError, setArcaDetailedError] = useState('');
  const [editClientId, setEditClientId] = useState<string | null>(null);
  
  const [tempClient, setTempClient] = useState<Client>({
    id: '', name: '', cuit: '', domicilio: '', condicionIva: 'IVA Responsable Inscripto', hourlyRate: 5000, workIp: ''
  });

  // Initialize
  useEffect(() => {
    const init = async () => {
      let savedSessions = [];
      let savedBilled = [];
      let savedSettings = DEFAULT_SETTINGS;

      if (window.electronAPI) {
        const data = await window.electronAPI?.loadData();
        const path = await window.electronAPI?.getDataPath();
        setDataPath(path);
        
        if (data) {
          savedSessions = data.sessions || [];
          savedBilled = data.billedMonths || [];
          savedSettings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
          
          // Migration from old single client format
          if (!savedSettings.clients && (data.settings?.clientInfo || data.clientInfo)) {
            const legacyClient = data.settings?.clientInfo || data.clientInfo;
            savedSettings.clients = [
              {
                id: 'default-client',
                name: legacyClient.razonSocial,
                cuit: legacyClient.cuit,
                domicilio: legacyClient.domicilio,
                condicionIva: legacyClient.condicionIva || 'IVA Responsable Inscripto',
                hourlyRate: data.hourlyRate || 5000
              }
            ];
            savedSettings.selectedClientId = 'default-client';
          }
        }
        
        // Sync OS setting with saved intent on load
        if (savedSettings.autoStart) {
          window.electronAPI?.setAutostart(true);
        }
        
      } else {
        const d = localStorage.getItem('lynx_v2_data');
        if (d) {
          const p = JSON.parse(d);
          savedSessions = p.sessions || [];
          savedBilled = p.billedMonths || [];
          savedSettings = { ...DEFAULT_SETTINGS, ...(p.settings || {}) };
        }
      }

      setSessions(savedSessions);
      setBilledMonths(savedBilled.map((m: any) => ({
        ...m,
        status: m.status === 'BILLED' ? 'ACTIVE' : (m.status === 'PENDING' ? 'ACTIVE' : m.status),
        date: m.date || new Date().toISOString(),
        sessionsIds: m.sessionsIds || []
      })));
      setSettings(savedSettings);

      const active = savedSessions.find((s: any) => !s.endTime);
      if (active) setActiveSessionId(active.id);

      // Lock gate 
      if (savedSettings.appPassword && savedSettings.appPassword.length > 0) {
        setIsUnlocked(false);
      }

      setIsLoaded(true);

      if (window.electronAPI) {
        window.electronAPI?.setMinimizeToTray(savedSettings.minimizeToTray);
        const version = await window.electronAPI?.getVersion();
        setAppVersion(version);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI?.syncMonitoringData({ clients: settings.clients });
    }
  }, [settings.clients, isLoaded]);

  // Save on change
  useEffect(() => {
    if (!isLoaded) return;
    
    const payload = { sessions, billedMonths, settings };
    
    if (window.electronAPI) {
      window.electronAPI?.saveData(payload);
    } else {
      localStorage.setItem('lynx_v2_data', JSON.stringify(payload));
    }
  }, [sessions, billedMonths, settings, isLoaded]);

  useEffect(() => {
    // Zone Detection Logic (Local fallback removed, now handled by main.cjs)
    // We still listen for detections from main
    if (window.electronAPI) {
      window.electronAPI?.onStartSessionFromToast((client: any) => {
        // Find the full client object just in case
        const fullClient = settings.clients.find(c => c.id === client.id) || client;
        startSession(fullClient);
      });
    }
  }, [settings.clients, isLoaded]);

  // Toast Detection Logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'toast') {
      setIsToastView(true);
      const clientData = params.get('client');
      if (clientData) {
        try {
          const parsed = JSON.parse(clientData);
          setToastData(parsed);
        } catch (e) {
          console.error('Error parsing toast data', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI?.onCheckingForUpdate(() => setUpdateStatus('checking'));
    window.electronAPI?.onUpdateAvailable(() => setUpdateStatus('available'));
    window.electronAPI?.onUpdateDownloaded(() => setUpdateStatus('downloaded'));
    window.electronAPI?.onUpdateNotAvailable(() => setUpdateStatus('not-available'));
    window.electronAPI?.onUpdateError(() => setUpdateStatus('error'));

    // Check on startup
    window.electronAPI?.checkForUpdates();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'cyberpunk');
  }, [settings.theme]);
  // IPC Background Tray Actions
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI?.onTrayAction((action, data) => {
        if (action === 'restore') {
          // Window show/hide is handled by main.cjs now via context menu
        } else if (action === 'stop-session') {
          handlePunchOut();
        } else if (action === 'start-session') {
          startSession(data);
        }
      });
    }
  }, [sessions, activeSessionId, settings.clients]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI?.syncTrayData({
        clients: settings.clients,
        activeSession: activeSessionId ? sessions.find(s => s.id === activeSessionId) : null
      });
    }
  }, [settings.clients, activeSessionId, sessions]);


  // Tick & Tray Sync
  useEffect(() => {
    const interval = setInterval(() => {
      const currentDate = new Date();
      setNow(currentDate);

      // Sync to Tray
      if (window.electronAPI) {
         if (activeSessionId) {
            const activeSession = sessions.find(s => s.id === activeSessionId);
            if (activeSession) {
               const secs = differenceInSeconds(currentDate, parseISO(activeSession.startTime));
               window.electronAPI?.updateTray(`Turno Activo: ${formatDuration(secs / 3600)}`);
            }
         } else {
            window.electronAPI?.updateTray('En Espera');
         }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSessionId, sessions]);


  // Helper Math Functions
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const s = Math.floor(((hours - h) * 60 - m) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const calculateStatsForInterval = (start: Date, end: Date) => {
    let totalSecs = 0;
    let earnings = 0;
    sessions.forEach(s => {
      const sStart = parseISO(s.startTime);
      const sEnd = s.endTime ? parseISO(s.endTime) : now;
      if (isWithinInterval(sStart, { start, end })) {
        const secs = differenceInSeconds(sEnd, sStart);
        totalSecs += secs;
        earnings += (secs / 3600) * s.rate;
      }
    });
    return { hours: totalSecs / 3600, earnings };
  };

  // Memoized Stats
  const dailyStats = useMemo(() => calculateStatsForInterval(startOfDay(now), endOfDay(now)), [sessions, now]);
  const weeklyStats = useMemo(() => calculateStatsForInterval(startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })), [sessions, now]);
  const monthlyStats = useMemo(() => calculateStatsForInterval(startOfMonth(now), endOfMonth(now)), [sessions, now]);
  
  const allTimeBilled = useMemo(() => {
    // Solo suma facturas ACTIVAS - las anuladas se restan efectivamente al no contarse
    return billedMonths
      .filter(m => m.status === 'ACTIVE')
      .reduce((sum, m) => sum + m.totalAmount, 0);
  }, [billedMonths]);

  const historicalMonthlyStats = useMemo(() => {
    const activeBilled = billedMonths.filter(m => m.status === 'ACTIVE');
    const groups: { [key: string]: { month: string, total: number, goal: number, hours: number } } = {};

    activeBilled.forEach(m => {
      const d = parseISO(m.date);
      const key = format(d, 'yyyy-MM'); 
      const display = format(d, 'MMMM yyyy').toUpperCase();
      
      if (!groups[key]) {
        groups[key] = { month: display, total: 0, goal: m.monthlyGoal || settings.monthlyGoal, hours: 0 };
      }
      groups[key].total += m.totalAmount;
      groups[key].hours += m.totalHours;
    });

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a)) 
      .map(key => groups[key]);
  }, [billedMonths, settings.monthlyGoal]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Handlers
  const startSession = (client: Client) => {
    if (activeSessionId) return;
    const newS: WorkSession = {
      id: crypto.randomUUID(),
      startTime: new Date().toISOString(),
      rate: client.hourlyRate,
      clientId: client.id,
      clientName: client.name
    };
    setSessions([...sessions, newS]);
    setActiveSessionId(newS.id);
  };

  const handlePunchIn = () => {
    const activeClient = settings.clients.find(c => c.id === settings.selectedClientId) || settings.clients[0];
    const newS: WorkSession = {
      id: crypto.randomUUID(),
      startTime: new Date().toISOString(),
      rate: activeClient.hourlyRate,
      clientId: activeClient.id,
      clientName: activeClient.name
    };
    setSessions([...sessions, newS]);
    setActiveSessionId(newS.id);
  };

  const handlePunchOut = () => {
    if (!activeSessionId) return;
    setSessions(sessions.map(s => 
      s.id === activeSessionId ? { ...s, endTime: new Date().toISOString() } : s
    ));
    setActiveSessionId(null);
  };

  const handleManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const manualStart = `${manualStartDate}T${manualStartTime}`;
    const manualEnd = `${manualEndDate}T${manualEndTime}`;
    const targetClient = settings.clients.find(c => c.id === settings.selectedClientId) || settings.clients[0];
    
    if (editSessionId) {
      setSessions(sessions.map(s => {
        if (s.id === editSessionId) {
          if (s.invoiced) return s; // Protect invoiced
          return { 
            ...s, 
            startTime: parseISO(manualStart).toISOString(), 
            endTime: parseISO(manualEnd).toISOString(), 
            rate: manualRate,
            clientId: targetClient.id,
            clientName: targetClient.name
          };
        }
        return s;
      }));
    } else {
      setSessions([...sessions, {
        id: crypto.randomUUID(),
        startTime: parseISO(manualStart).toISOString(),
        endTime: parseISO(manualEnd).toISOString(),
        rate: manualRate,
        clientId: targetClient.id,
        clientName: targetClient.name
      }]);
    }
    setShowManualEntry(false);
    setEditSessionId(null);
  };

  const openManualModal = (session?: WorkSession) => {
    if (session) {
      if (session.invoiced) return alert("Esta sesión ya fue facturada y está bloqueada.");
      setEditSessionId(session.id);
      const start = format(parseISO(session.startTime), "yyyy-MM-dd'T'HH:mm");
      const end = session.endTime ? format(parseISO(session.endTime), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm");
      setManualStartDate(start.split('T')[0]);
      setManualStartTime(start.split('T')[1]);
      setManualEndDate(end.split('T')[0]);
      setManualEndTime(end.split('T')[1]);
      setManualRate(session.rate);
      updateSetting('selectedClientId', session.clientId);
    } else {
      const activeClient = settings.clients.find(c => c.id === settings.selectedClientId) || settings.clients[0];
      setEditSessionId(null);
      const now = format(new Date(), "yyyy-MM-dd'T'HH:mm");
      setManualStartDate(now.split('T')[0]);
      setManualStartTime(now.split('T')[1]);
      setManualEndDate(now.split('T')[0]);
      setManualEndTime(now.split('T')[1]);
      setManualRate(activeClient.hourlyRate);
    }
    setShowManualEntry(true);
  };

  const deleteSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session?.invoiced) return alert("No se puede eliminar una sesión ya facturada.");
    if (confirm('¿Eliminar el registro por completo?')) {
      if (id === activeSessionId) setActiveSessionId(null);
      setSessions(sessions.filter(s => s.id !== id));
    }
  };

  const generateCSR = async () => {
    if (!settings.arcaInfo.cuit) {
      setArcaStatus({ type: 'error', msg: 'Primero ingresa tu CUIT en la configuración.' });
      return;
    }
    setArcaTesting(true);
    const res = await window.electronAPI?.generateArcaCSR({ 
      cuit: settings.arcaInfo.cuit, 
      name: 'LYNX_OS' 
    });
    setArcaTesting(false);
    if (res?.success) {
      const msg = `¡Éxito! Archivos generados en:\n${res.folder}\n\n1. Sube el pedido.csr a AFIP.\n2. Descarga el .crt y cárgalo aquí.`;
      setArcaStatus({ type: 'success', msg: res.msg! });
      alert(msg);
    } else {
      setArcaStatus({ type: 'error', msg: res?.error || 'Error desconocido' });
    }
  };

  // --- CLIENT MANAGEMENT ---
  const saveClient = () => {
    let newClients = [...settings.clients];
    if (editClientId) {
      newClients = newClients.map(c => c.id === editClientId ? { ...tempClient, id: editClientId } : c);
    } else {
      newClients.push({ ...tempClient, id: Date.now().toString() });
    }
    updateSetting('clients', newClients);
    setShowClientModal(false);
  };

  const deleteClient = (id: string) => {
    if (settings.clients.length <= 1) return alert("Debe haber al menos un cliente.");
    if (!confirm("¿Eliminar este cliente? Las sesiones existentes no se verán afectadas pero no podrás asignar nuevas a este cliente.")) return;
    const newClients = settings.clients.filter(c => c.id !== id);
    updateSetting('clients', newClients);
    if (settings.selectedClientId === id) updateSetting('selectedClientId', newClients[0].id);
  };

  const openClientModal = (c?: Client) => {
    if (c) {
      setTempClient(c);
      setEditClientId(c.id);
    } else {
      setTempClient({ id: '', name: '', cuit: '', domicilio: '', condicionIva: 'IVA Responsable Inscripto', hourlyRate: 5000, workIp: '' });
      setEditClientId(null);
    }
    setShowClientModal(true);
  };

  const finalizeMonth = () => {
    setShowInvoicingModal(true);
    setSelectedSessions(new Set(sessions.filter(s => s.endTime && !s.invoiced).map(s => s.id)));
  };

  const handleToggleSession = (id: string) => {
    const next = new Set(selectedSessions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSessions(next);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockInput === settings.appPassword) {
      setIsUnlocked(true);
      setLockInput('');
    } else {
      alert("CÓDIGO DE ACCESO DENEGADO.");
    }
  };

  const updateSetting = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'minimizeToTray' && window.electronAPI) window.electronAPI?.setMinimizeToTray(value);
    if (key === 'autoStart' && window.electronAPI) window.electronAPI?.setAutostart(value);
  };

  const updateArcaSetting = (key: keyof AppSettings['arcaInfo'], value: any) => {
    setSettings(prev => ({ ...prev, arcaInfo: { ...prev.arcaInfo, [key]: value } }));
  };

  const testArca = async () => {
    if (!window.electronAPI) return;
    setArcaTesting(true);
    setArcaStatus({ msg: 'Conectando con servidores de AFIP...', type: 'idle' });
    
    const res = await window.electronAPI?.testArcaConnection(settings);
    if (res.success) {
      setArcaStatus({ msg: `CONEXIÓN EXITOSA. Servidor App: ${res.status.AppServer}, DB: ${res.status.DbServer}`, type: 'success' });
      setArcaDetailedError('');
    } else {
      setArcaStatus({ msg: `ERROR DE CONEXIÓN: ${res.error}`, type: 'error' });
      setArcaDetailedError(res.detailed || 'No hay detalles técnicos adicionales.');
    }
    setArcaTesting(false);
  };

  const handleGenerateInvoice = async () => {
    if (!window.electronAPI) return;
    const selectedList = sessions.filter(s => selectedSessions.has(s.id));
    if (selectedList.length === 0) return;

    const totalAmount = selectedList.reduce((acc, s) => acc + (differenceInSeconds(parseISO(s.endTime!), parseISO(s.startTime)) / 3600) * s.rate, 0);
    const totalHours = selectedList.reduce((acc, s) => acc + (differenceInSeconds(parseISO(s.endTime!), parseISO(s.startTime)) / 3600), 0);

    const earliest = format(parseISO(selectedList.sort((a,b) => a.startTime.localeCompare(b.startTime))[0].startTime), 'yyyy-MM-dd');
    const latest = format(parseISO(selectedList.sort((a,b) => b.startTime.localeCompare(a.startTime))[0].endTime!), 'yyyy-MM-dd');

    const targetClientId = selectedList[0].clientId;
    const client = settings.clients.find(c => c.id === targetClientId) || settings.clients[0];
    
    // Ensure all sessions belong to the same client
    if (selectedList.some(s => s.clientId !== targetClientId)) {
      alert("Error: No se pueden facturar sesiones de distintos clientes en un mismo comprobante.");
      return;
    }

    if (!confirm(`¿Emitir factura oficial para ${client.name} por $${Math.floor(totalAmount).toLocaleString()}?`)) return;

    setIsInvoicing(true);
    const res = await window.electronAPI?.generateArcaInvoice({
      settings, 
      client: {
        razonSocial: client.name,
        cuit: client.cuit,
        domicilio: client.domicilio,
        condicionIva: client.condicionIva
      },
      amount: Math.floor(totalAmount),
      start: earliest,
      end: latest
    });

    if (res.success) {
      const invoiceId = crypto.randomUUID();
      const newInvoice: BilledMonth = {
        id: invoiceId,
        date: new Date().toISOString(),
        month: `${format(parseISO(earliest), 'dd/MM')} al ${format(parseISO(latest), 'dd/MM')}`,
        totalHours,
        rate: client.hourlyRate,
        totalAmount,
        status: 'ACTIVE',
        invoiceNumber: res.numero,
        cae: res.cae,
        filePath: res.filePath,
        monthlyGoal: settings.monthlyGoal,
        sessionsIds: Array.from(selectedSessions),
        clientId: client.id,
        clientName: client.name,
        serviceStart: earliest,
        serviceEnd: latest
      };

      setBilledMonths([newInvoice, ...billedMonths]);
      setSessions(sessions.map(s => selectedSessions.has(s.id) ? { ...s, invoiced: true, invoiceId } : s));
      setShowInvoicingModal(false);
      
      if (confirm("FACTURA GENERADA CON ÉXITO. ¿Desea abrir el archivo PDF?")) {
        window.electronAPI?.openFile(res.filePath!);
      }
    } else {
      alert(`ERROR AFIP: ${res.error}`);
    }
    setIsInvoicing(false);
  };

  const handleAnnullInvoice = async (invoice: BilledMonth) => {
    if (!window.electronAPI) return;
    if (!confirm(`¿Estás seguro de anular la factura N° ${invoice.invoiceNumber}? Se generará una Nota de Crédito en AFIP.`)) return;

    setIsInvoicing(true);
    const client = settings.clients.find(c => c.id === invoice.clientId) || settings.clients[0];
    
    const res = await window.electronAPI?.generateArcaCreditNote({
      settings, 
      invoice, 
      client: {
        razonSocial: client.name,
        cuit: client.cuit,
        domicilio: client.domicilio,
        condicionIva: client.condicionIva
      }
    });

    if (res.success) {
      setBilledMonths(billedMonths.map(m => m.id === invoice.id ? { ...m, status: 'CANCELLED' } : m));
      // Release sessions
      setSessions(sessions.map(s => s.invoiceId === invoice.id ? { ...s, invoiced: false, invoiceId: undefined } : s));
      
      if (confirm(`ANULACIÓN COMPLETADA (N. Crédito: ${res.numero}). ¿Desea abrir el archivo comprobante?`)) {
        window.electronAPI?.openFile(res.filePath!);
      }
    } else {
      alert(`ERROR AFIP: ${res.error}`);
    }
    setIsInvoicing(false);
  };

  const verifyInvoiceInAfip = async (m: BilledMonth) => {
    try {
      const type = m.status === 'ACTIVE' ? 11 : 13;
      const pv = settings.arcaInfo.puntoVenta || 2;
      const res = await window.electronAPI?.getArcaInvoiceInfo({
        settings,
        number: m.invoiceNumber,
        pv,
        type
      });

      if (res?.success) {
        if (!res.info) {
          if (confirm(`ARCA informa que este comprobante NO EXISTE.\n\n¿Deseas eliminarlo de tu historial local para limpiar la lista y liberar las horas?`)) {
            handleDeleteRecord(m, true);
          }
          return;
        }
        const info = res.info;
        alert(`VERIFICACIÓN EXITOSA EN ARCA:\n\nComprobante #${m.invoiceNumber}\nCliente: ${m.clientName}\nImporte: $${info.ImpTotal}\nEstado: APROBADO (CAE: ${info.CodAutorizacion})\nFecha AFIP: ${info.CbteFch}`);
      } else {
        const errMsg = res?.error || '';
        if (errMsg.includes('no existe') || errMsg.includes('601')) {
          if (confirm(`ARCA informa que este comprobante NO EXISTE.\n\n¿Deseas eliminarlo de tu historial local para limpiar la lista y liberar las horas?`)) {
            handleDeleteRecord(m, true);
          }
        } else {
          alert(`ERROR DE VERIFICACIÓN:\n${errMsg || 'No se pudo contactar con ARCA'}`);
        }
      }
    } catch (err: any) {
      alert("Falla crítica al conectar con ARCA: " + err.message);
    }
  };

  const handleDeleteRecord = (record: BilledMonth, silent = false) => {
    if (!silent) {
      if (!confirm(`¿Estás seguro de ELIMINAR este registro del historial? Esta acción no anula el comprobante en AFIP, solo lo borra de la App.`)) return;
    }
    
    setBilledMonths(prev => prev.filter(m => m.id !== record.id));
    
    if (record.status === 'ACTIVE') {
      setSessions(prev => prev.map(s => s.invoiceId === record.id ? { ...s, invoiced: false, invoiceId: undefined } : s));
    }
  };

  const pickFolder = async () => {
    const path = await window.electronAPI?.selectFolder();
    if (path) updateSetting('invoicePath', path);
  };

  const pickCert = async () => {
    const path = await window.electronAPI?.selectFile([{ name: 'Certificados AFIP', extensions: ['crt'] }]);
    if (path) updateArcaSetting('certPath', path);
  };

  const pickKey = async () => {
    const path = await window.electronAPI?.selectFile([{ name: 'Claves Privadas', extensions: ['key'] }]);
    if (path) updateArcaSetting('keyPath', path);
  };

  if (!isLoaded) return null;

  if (isToastView && toastData) {
    const isUpdate = toastData.type === 'update';
    
    return (
      <div className="fade-in" style={{ 
        width: '400px', 
        height: '160px', 
        overflow: 'hidden', 
        padding: '16px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px', 
        border: '1px solid var(--surface-border)', 
        background: 'rgba(15, 23, 42, 0.6)', 
        backdropFilter: 'blur(30px)', 
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)', 
        color: 'white',
        position: 'relative'
      }}>
        {/* Reflection top border */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: isUpdate ? 'var(--success)' : 'var(--accent-color)', 
              boxShadow: `0 0 10px ${isUpdate ? 'var(--success-glow)' : 'var(--accent-glow)'}` 
            }}></div>
            <span className="mono-font" style={{ fontSize: '0.7rem', color: isUpdate ? 'var(--success)' : 'var(--accent-color)', letterSpacing: '2px' }}>
              {isUpdate ? 'SISTEMA LYNX' : 'ZONA DETECTADA'}
            </span>
          </div>
          <button onClick={() => window.electronAPI?.closeToast()} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={16}/></button>
        </div>
        
        <div style={{ flex: 1 }}>
          <h2 className="mono-font" style={{ fontSize: '1rem', margin: '0 0 4px 0' }}>{toastData.name}</h2>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
            {isUpdate 
              ? 'Una nueva versión ha sido preparada e instalada automáticamente. Reinicia para aplicar.' 
              : 'Estás conectado a la red de este cliente. ¿Deseas iniciar el trackeo?'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {isUpdate ? (
            <button 
              onClick={() => window.electronAPI?.restartApp()} 
              className="btn-primary" 
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '10px' }}
            >
              REINICIAR AHORA
            </button>
          ) : (
            <>
              <button 
                onClick={() => window.electronAPI?.toastActionStart(toastData)} 
                className="btn-primary" 
                style={{ flex: 2, justifyContent: 'center', fontSize: '0.8rem', padding: '10px' }}
              >
                INICIAR TURNO
              </button>
              <button 
                onClick={() => window.electronAPI?.closeToast()} 
                className="btn-secondary" 
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '10px', background: 'rgba(255,255,255,0.05)' }}
              >
                IGNORAR
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render LOCK SCREEN
  if (!isUnlocked) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <div className="premium-card fade-in" style={{ width: '400px', border: '1px solid var(--danger)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Lock size={48} color="var(--danger)" />
          </div>
          <h2 className="mono-font" style={{ color: 'var(--danger)', marginBottom: '10px' }}>SISTEMA BLOQUEADO</h2>
          <p className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '30px' }}>INGRESE CLAVE DE OPERADOR LYNX</p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
              type="password" 
              value={lockInput}
              onChange={e => setLockInput(e.target.value)}
              autoFocus
              className="mono-font"
              style={{ width: '100%', background: '#000', border: '1px solid var(--danger)', color: 'white', padding: '16px', textAlign: 'center', letterSpacing: '4px' }}
            />
            <button type="submit" className="btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)', justifyContent: 'center' }}>
              DESBLOQUEAR
            </button>
          </form>
        </div>
      </div>
    );
  }

  // APP RENDER
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      {/* OS DRAG BAR */}
      {window.electronAPI && (
        <div style={{ 
          height: '40px', background: 'rgba(2, 6, 23, 0.6)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--surface-border)',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 10px',
          ...( { WebkitAppRegion: 'drag' } as any )
        }}>
          <div style={{ display: 'flex', gap: '8px', ...( { WebkitAppRegion: 'no-drag' } as any ) }}>
            <button onClick={() => window.electronAPI?.minimize()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px' }}><Minus size={16} /></button>
            <button onClick={() => window.electronAPI?.maximize()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px' }}><Maximize2 size={16} /></button>
            <button onClick={() => window.electronAPI?.close()} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '5px' }}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* HEADER NAV */}
      <header style={{ padding: '0 40px', height: '100px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', background: 'rgba(15, 23, 42, 0.2)', backdropFilter: 'blur(30px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={lynxIconUrl} alt="LYNX Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(255,100,0,0.6))' }} />
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Tracker de Horas de Trabajo</h1>
            <p className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', letterSpacing: '2px' }}>
              LYNX_OS_V{APP_VERSION}
            </p>
          </div>
        </div>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          <button onClick={() => setActiveTab('tracker')} className={`btn-secondary ${activeTab === 'tracker' ? 'active-tab' : ''}`} style={{ borderColor: activeTab === 'tracker' ? 'var(--accent-color)' : '' }}>
            <Clock size={16} /> EL RELOJ
          </button>
          <button onClick={() => setActiveTab('dashboard')} className={`btn-secondary ${activeTab === 'dashboard' ? 'active-tab' : ''}`} style={{ borderColor: activeTab === 'dashboard' ? 'var(--accent-color)' : '' }}>
            <BarChart3 size={16} /> DASHBOARD
          </button>
          <button onClick={() => setActiveTab('settings')} className={`btn-secondary ${activeTab === 'settings' ? 'active-tab' : ''}`} style={{ borderColor: activeTab === 'settings' ? 'var(--accent-color)' : '' }}>
            <SettingsIcon size={16} /> SISTEMA
          </button>
        </div>
      </header>

      {updateStatus === 'downloaded' && (
        <div className="update-banner" onClick={() => (window as any).electronAPI.restartApp()}>
          &lt; NUEVA VERSIÓN LISTA: HAZ CLIC PARA REINICIAR E INSTALAR &gt;
        </div>
      )}

      {/* MAIN VIEW CONTENT */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '40px' }} className="fade-in">

        {/* ----------------- TRACKER TAB ----------------- */}
        {activeTab === 'tracker' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 400px', gap: '40px' }}>
            <section style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
              <div className="premium-card" style={{ background: activeSessionId ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, var(--surface-color) 100%)' : 'var(--surface-color)', padding: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 className={activeSessionId ? "status-active" : ""} style={{ fontSize: '1rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Shield size={20} /> {activeSessionId ? 'TURNO ACTIVO' : 'SISTEMA EN ESPERA'}
                    </h2>
                    
                    {!activeSessionId && (
                      <div style={{ marginBottom: '16px' }}>
                        <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>CLIENTE DESTINO</label>
                        <select 
                          value={settings.selectedClientId} 
                          onChange={(e) => updateSetting('selectedClientId', e.target.value)}
                          style={{ background: '#000', border: '1px solid var(--surface-border)', color: 'var(--accent-color)', padding: '8px 16px', fontSize: '0.9rem', fontFamily: 'monospace', cursor: 'pointer', width: '300px' }}>
                          {settings.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    )}

                    {activeSessionId && (
                       <div className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--accent-color)', marginBottom: '16px', borderLeft: '2px solid var(--accent-color)', paddingLeft: '12px' }}>
                        &lt; TRABAJANDO PARA: {sessions.find(s => s.id === activeSessionId)?.clientName} &gt;
                       </div>
                    )}

                    <div style={{ fontSize: '6rem', fontWeight: 800, letterSpacing: '-4px', marginBottom: '16px', lineHeight: 1, color: activeSessionId ? 'var(--text-primary)' : 'var(--text-secondary)' }} className="mono-font">
                      {activeSessionId && activeSession ? formatDuration(differenceInSeconds(now, parseISO(activeSession.startTime)) / 3600) : "00:00:00"}
                    </div>
                  </div>
                  <button onClick={activeSessionId ? handlePunchOut : handlePunchIn} className="btn-primary"
                    style={{ width: '120px', height: '120px', borderRadius: '0', justifyContent: 'center', background: activeSessionId ? 'var(--danger)' : 'transparent', borderColor: activeSessionId ? 'var(--danger)' : 'var(--accent-color)', color: activeSessionId ? 'white' : 'var(--accent-color)', boxShadow: activeSessionId ? '0 0 40px var(--danger-glow)' : '0 0 30px var(--accent-glow)' }}>
                    {activeSessionId ? <Square fill="currentColor" size={40} /> : <Play fill="currentColor" size={40} style={{ marginLeft: '8px' }} />}
                  </button>
                </div>
              </div>

              <div className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                  <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}><History size={18} /> HISTORIAL DE TURNOS</h2>
                  <button onClick={() => openManualModal()} className="btn-secondary" style={{ fontSize: '0.7rem' }}>+ CARGA MANUAL</button>
                </div>

                {/* --- PENDIENTES DE FACTURAR --- */}
                {sessions.filter(s => s.endTime && !s.invoiced).length > 0 && (
                  <>
                    <div className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--accent-color)', marginBottom: '8px', letterSpacing: '2px' }}>▸ SIN FACTURAR</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'var(--surface-border)', marginBottom: '24px', border: '1px solid var(--accent-color)', boxShadow: '0 0 8px var(--accent-glow)' }}>
                      {sessions.filter(s => s.endTime && !s.invoiced).sort((a, b) => b.startTime.localeCompare(a.startTime)).map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-color)' }}>
                          <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                            <div className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.8rem', width: '100px' }}>{format(parseISO(s.startTime), "dd/MM/yyyy")}</div>
                            <div style={{ width: '250px' }}>
                               <div className="mono-font" style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{s.clientName}</div>
                               <div className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{format(parseISO(s.startTime), "HH:mm")} &gt;&gt; {format(parseISO(s.endTime!), "HH:mm")}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{ textAlign: 'right', minWidth: '100px' }}>
                              <span className="mono-font" style={{ fontWeight: 800, fontSize: '1rem' }}>{formatDuration(differenceInSeconds(parseISO(s.endTime!), parseISO(s.startTime)) / 3600)}</span>
                            </div>
                            <div style={{ color: 'var(--success)', fontWeight: 700, minWidth: '100px', textAlign: 'right' }} className="mono-font">
                              +${Math.floor((differenceInSeconds(parseISO(s.endTime!), parseISO(s.startTime)) / 3600) * s.rate).toLocaleString()}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => openManualModal(s)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', padding: '4px', opacity: 0.5 }} title="Editar"><Pencil size={16} /></button>
                              <button onClick={() => deleteSession(s.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px', opacity: 0.5 }} title="Eliminar"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* --- YA FACTURADAS --- */}
                {sessions.filter(s => s.endTime && s.invoiced).length > 0 && (
                  <>
                    <div className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '2px' }}>▸ YA FACTURADAS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'var(--surface-border)', opacity: 0.6 }}>
                      {sessions.filter(s => s.endTime && s.invoiced).sort((a, b) => b.startTime.localeCompare(a.startTime)).map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-color)' }}>
                          <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                            <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', width: '100px' }}>{format(parseISO(s.startTime), "dd/MM/yyyy")}</div>
                            <div style={{ width: '250px' }}>
                               <div className="mono-font" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.clientName}</div>
                               <div className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{format(parseISO(s.startTime), "HH:mm")} &gt;&gt; {format(parseISO(s.endTime!), "HH:mm")}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{ textAlign: 'right', minWidth: '100px' }}>
                              <span className="mono-font" style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-secondary)' }}>{formatDuration(differenceInSeconds(parseISO(s.endTime!), parseISO(s.startTime)) / 3600)}</span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontWeight: 700, minWidth: '100px', textAlign: 'right' }} className="mono-font">
                              [FACTURADO]
                            </div>
                            <Lock size={14} style={{ opacity: 0.3 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {sessions.filter(s => s.endTime).length === 0 && (
                  <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textAlign: 'center', padding: '40px' }}>SIN REGISTROS AÚN</div>
                )}
              </div>
            </section>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
              <div className="premium-card">
                 <h3 className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.7rem', marginBottom: '16px' }}>ESTADO DEL MES EN CURSO</h3>
                 <div style={{ fontSize: '3rem', fontWeight: 800 }} className="mono-font">{monthlyStats.hours.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 400 }}>HS</span></div>
                 <div style={{ position: 'relative', marginTop: '30px' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '4px', background: 'var(--accent-color)', width: '100%', opacity: 0.2 }}></div>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '4px', background: 'var(--accent-color)', width: '60%', boxShadow: '0 0 10px var(--accent-glow)' }}></div>
                 </div>
              </div>

              <div className="premium-card" style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, #000 100%)', border: '1px solid var(--accent-color)' }}>
                <h3 className="mono-font" style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px', color: 'var(--accent-color)' }}>GESTIÓN DE FACTURACIÓN</h3>
                <p className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>Selecciona sesiones pendientes para generar un nuevo comprobante oficial.</p>
                <button onClick={finalizeMonth} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>PREPARAR FACTURA NUEVA</button>
              </div>
            </aside>
          </div>
        )}

        {/* ----------------- DASHBOARD TAB ----------------- */}
        {activeTab === 'dashboard' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '40px' }}>
            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}><Activity size={24} /> ANALÍTICA FINANCIERA</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
              <div className="premium-card">
                 <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', marginBottom: '12px' }}>HOY / DIARIO</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 800 }} className="mono-font">{dailyStats.hours.toFixed(1)} <span style={{fontSize: '0.8rem'}}>HS</span></div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--success)' }} className="mono-font">${Math.floor(dailyStats.earnings).toLocaleString()}</div>
              </div>
              <div className="premium-card">
                 <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', marginBottom: '12px' }}>ESTA SEMANA</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 800 }} className="mono-font">{weeklyStats.hours.toFixed(1)} <span style={{fontSize: '0.8rem'}}>HS</span></div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--success)' }} className="mono-font">${Math.floor(weeklyStats.earnings).toLocaleString()}</div>
              </div>
              <div className="premium-card">
                 <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', marginBottom: '12px' }}>ESTE MES</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 800 }} className="mono-font">{monthlyStats.hours.toFixed(1)} <span style={{fontSize: '0.8rem'}}>HS</span></div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--success)' }} className="mono-font">${Math.floor(monthlyStats.earnings).toLocaleString()}</div>
              </div>
              <div className="premium-card" style={{ borderLeft: '3px solid var(--accent-secondary)' }}>
                 <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', marginBottom: '12px' }}>PROYECCIÓN CIERRE</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-secondary)' }} className="mono-font">
                   ${Math.floor((monthlyStats.earnings / (new Date().getDate())) * (endOfMonth(new Date()).getDate())).toLocaleString()}
                 </div>
              </div>
              <div className="premium-card" style={{ borderLeft: '3px solid var(--success)' }}>
                 <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', marginBottom: '12px' }}>TOTAL COBRADO</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }} className="mono-font">
                   ${Math.floor(allTimeBilled).toLocaleString()}
                 </div>
              </div>
            </div>

            <div className="premium-card" style={{ border: '1px solid var(--accent-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div className="mono-font" style={{ color: 'var(--accent-secondary)', fontSize: '0.8rem', fontWeight: 800 }}>META DE INGRESOS MENSUAL</div>
                <div className="mono-font" style={{ fontSize: '0.8rem' }}>{Math.floor((monthlyStats.earnings / settings.monthlyGoal) * 100)}% COMPLETADO</div>
              </div>
              
              <div className="revenue-progress-container">
                <div 
                  className="revenue-progress-bar" 
                  style={{ width: `${Math.min(100, (monthlyStats.earnings / settings.monthlyGoal) * 100)}%` }}
                ></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }} className="mono-font">
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>ACTUAL: </span>
                  <span style={{ fontWeight: 800 }}>${Math.floor(monthlyStats.earnings).toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>OBJETIVO: </span>
                  <span style={{ fontWeight: 800 }}>${settings.monthlyGoal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="premium-card">
              <h3 className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.8rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={14} /> HISTORIAL DE COMPROBANTES EMITIDOS
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {billedMonths.length === 0 ? (
                  <div className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>SIN COMPROBANTES REGISTRADOS</div>
                ) : (
                  billedMonths.sort((a, b) => b.date.localeCompare(a.date)).map(bm => (
                    <div key={bm.id} className="premium-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ background: 'var(--success)', padding: '8px', borderRadius: '4px' }}>
                           <Activity size={18} color="black" />
                        </div>
                        <div>
                          <div className="mono-font" style={{ fontSize: '0.8rem', fontWeight: 800 }}>{bm.clientName || 'Cliente General'}</div>
                          <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                            {format(parseISO(bm.date), "MMMM yyyy").toUpperCase()} • COMPROBANTE: {bm.invoiceNumber || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div className="mono-font" style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--success)' }}>${bm.totalAmount.toLocaleString()}</div>
                          <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{bm.totalHours.toFixed(1)} HS</div>
                        </div>
                        {bm.filePath && (
                          <button 
                            onClick={() => window.electronAPI?.openFile(bm.filePath!)}
                            className="btn-secondary" 
                            style={{ fontSize: '0.6rem', padding: '8px 12px' }}
                          >
                            VER PDF
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="premium-card">
               <h3 className="mono-font" style={{ color: 'var(--accent-secondary)', fontSize: '0.8rem', marginBottom: '24px', fontWeight: 800 }}>RENDIMIENTO VS OBJETIVO (HISTÓRICO)</h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                 {historicalMonthlyStats.length === 0 ? (
                   <p className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sin datos históricos registrados.</p>
                 ) : (
                   historicalMonthlyStats.map(stat => {
                     const percent = Math.floor((stat.total / stat.goal) * 100);
                     return (
                       <div key={stat.month}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                           <span className="mono-font" style={{ fontWeight: 800, fontSize: '0.75rem' }}>{stat.month}</span>
                           <span className="mono-font" style={{ fontSize: '0.75rem', color: percent >= 100 ? 'var(--success)' : 'white' }}>
                             {percent}% {percent >= 100 ? '[META CUMPLIDA]' : ''}
                           </span>
                         </div>
                         <div className="revenue-progress-container" style={{ height: '8px' }}>
                           <div 
                             className="revenue-progress-bar" 
                             style={{ 
                               width: `${Math.min(100, percent)}%`, 
                               height: '100%',
                               background: percent >= 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'var(--accent-secondary)'
                             }}
                           ></div>
                         </div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }} className="mono-font">
                           <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>LIQUIDADO: ${Math.floor(stat.total).toLocaleString()}</span>
                           <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>OBJETIVO: ${stat.goal.toLocaleString()}</span>
                         </div>
                       </div>
                     );
                   })
                 )}
               </div>
            </div>

            <div className="premium-card">
               <h3 className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.8rem', marginBottom: '24px' }}>HISTORIAL DE COMPROBANTES</h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 {billedMonths.map(m => (
                   <div key={m.id} style={{ padding: '16px', background: m.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                       <div>
                         <div className="mono-font" style={{ fontWeight: 800, fontSize: '0.9rem', color: m.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)' }}>
                           {m.status === 'ACTIVE' ? 'RECIBO C' : 'ANULADA'} #{m.invoiceNumber}
                         </div>
                         <div className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                           FECHA: {format(parseISO(m.date), 'dd/MM/yyyy')} | PERIODO: {m.month}
                         </div>
                       </div>
                       <div className="mono-font" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                         ${Math.floor(m.totalAmount).toLocaleString()}
                       </div>
                     </div>
                     
                     <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          onClick={() => handleDeleteRecord(m)} 
                          className="btn-secondary" 
                          title="Eliminar"
                          style={{ fontSize: '0.6rem', padding: '6px 8px', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
                          <Trash2 size={12} />
                        </button>
                       {m.filePath && (
                         <button onClick={() => window.electronAPI?.openFile(m.filePath!)} className="btn-secondary" style={{ fontSize: '0.6rem', padding: '6px 12px' }}>
                           ABRIR PDF
                         </button>
                       )}
                       {m.status === 'ACTIVE' && (
                         <button 
                           onClick={() => handleAnnullInvoice(m)} 
                           disabled={isInvoicing}
                           className="btn-secondary" 
                           style={{ fontSize: '0.6rem', padding: '6px 12px', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                           {isInvoicing ? '...' : 'ANULAR'}
                         </button>
                       )}
                       <button 
                         onClick={() => verifyInvoiceInAfip(m)} 
                         className="btn-secondary" 
                         style={{ fontSize: '0.6rem', padding: '6px 12px', background: 'rgba(255,255,255,0.05)' }}>
                         VERIFICAR EN ARCA
                       </button>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {/* ----------------- SETTINGS TAB ----------------- */}
        {activeTab === 'settings' && (
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <SettingsIcon size={24} /> PANEL DE CONTROL MAESTRO
            </h2>

            {/* SECCION 0 - TEMAS */}
            <div className="premium-card" style={{ borderLeft: '4px solid var(--accent-color)' }}>
              <h3 className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.9rem', marginBottom: '24px' }}>0. NÚCLEO ESTÉTICO (TEMAS)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {[
                  { id: 'cyberpunk', name: 'CYBERPUNK', color: '#0ea5e9', desc: 'Futurista Neón' },
                  { id: 'matrix', name: 'MATRIX', color: '#00ff41', desc: 'Digital Rain' },
                  { id: 'minimal', name: 'MINIMAL', color: '#0f172a', desc: 'Limpio y Claro' },
                  { id: 'deep-ocean', name: 'DEEP OCEAN', color: '#38bdf8', desc: 'Abismo Profundo' }
                ].map(t => (
                  <div 
                    key={t.id}
                    onClick={() => updateSetting('theme', t.id)}
                    style={{ 
                      padding: '16px', 
                      background: settings.theme === t.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                      border: `1px solid ${settings.theme === t.id ? 'var(--accent-color)' : 'var(--surface-border)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      textAlign: 'center'
                    }}>
                    <div style={{ width: '24px', height: '24px', background: t.color, margin: '0 auto 12px', borderRadius: '4px', boxShadow: `0 0 10px ${t.color}` }}></div>
                    <div className="mono-font" style={{ fontSize: '0.7rem', fontWeight: 800, color: settings.theme === t.id ? 'var(--accent-color)' : 'white' }}>{t.name}</div>
                    <div className="mono-font" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>



            <div className="premium-card">
              <h3 className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.9rem', marginBottom: '24px' }}>1. CONFIGURACIÓN FINANCIERA</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                   <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>META DE INGRESOS MENSUAL ($)</label>
                   <input 
                    type="number" 
                    value={settings.monthlyGoal} 
                    onChange={e => updateSetting('monthlyGoal', Number(e.target.value))}
                    style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} 
                   />
                </div>
              </div>
            </div>

            {/* SECCION 2 */}
            <div className="premium-card">
              <h3 className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.9rem', marginBottom: '24px' }}>2. INTEGRACIÓN VIRTUAL DEL SO</h3>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '24px' }}>
                <input type="checkbox" checked={settings.autoStart} onChange={e => updateSetting('autoStart', e.target.checked)} style={{ width: '20px', height: '20px', accentColor: 'var(--accent-color)' }} />
                <span className="mono-font" style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>AUTO-ARRANQUE CON WINDOWS</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.minimizeToTray} onChange={e => updateSetting('minimizeToTray', e.target.checked)} style={{ width: '20px', height: '20px', accentColor: 'var(--accent-color)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="mono-font" style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>INVISIBILIDAD EN BANDEJA DE SISTEMA</span>
                  <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Si la cajita roja (X) minimiza o cierra de verdad la aplicación.</span>
                </div>
              </label>
            </div>

            {/* SECCION 3 */}
            <div className="premium-card">
              <h3 className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.9rem', marginBottom: '24px' }}>3. SEGURIDAD Y ARCHIVOS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>CARPETA DESTINO DE FACTURAS (PDF)</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input type="text" readOnly value={settings.invoicePath || 'Carpeta predeterminada del sistema'}
                      style={{ flex: 1, background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }} />
                    <button onClick={pickFolder} className="btn-secondary">CAMBIAR</button>
                  </div>
                </div>
                <div>
                  <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>CLAVE DE ACCESO LOCAL</label>
                  <input type="password" value={settings.appPassword || ''} onChange={e => updateSetting('appPassword', e.target.value)} placeholder="Dejar vacío para desactivar"
                    style={{ width: '100%', maxWidth: '400px', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                </div>
              </div>
            </div>

            {/* SECCION 4 - ARCA */}
            <div className="premium-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>4. CLUSTER FISCAL ARCA (EX AFIP)</h3>
                <button onClick={() => setShowHelpModal(true)} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.7rem' }}>¿CÓMO CONFIGURAR?</button>
              </div>

              {/* MODO DE ENTORNO */}
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-border)', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 800 }}>ENTORNO DIGITAL AFIP</div>
                    <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {settings.arcaInfo.productionMode 
                        ? 'CONECTADO A: SERVIDOR DE PRODUCCIÓN (Real)' 
                        : 'CONECTADO A: SERVIDOR DE HOMOLOGACIÓN (Pruebas)'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className="mono-font" style={{ fontSize: '0.7rem' }}>MODO PRODUCCIÓN</span>
                    <div 
                      onClick={() => updateArcaSetting('productionMode', !settings.arcaInfo.productionMode)}
                      style={{ 
                        width: '46px', height: '22px', background: settings.arcaInfo.productionMode ? 'var(--success)' : '#333', 
                        borderRadius: '11px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s' 
                      }}>
                      <div style={{ 
                        width: '18px', height: '18px', background: 'white', borderRadius: '50%', 
                        position: 'absolute', top: '2px', left: settings.arcaInfo.productionMode ? '26px' : '2px', 
                        transition: 'all 0.3s' 
                      }} />
                    </div>
                  </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div>
                  <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>CUIT DEL EMISOR</label>
                  <input type="text" value={settings.arcaInfo.cuit} onChange={e => updateArcaSetting('cuit', e.target.value)} placeholder="Ej: 20304445551"
                    style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                </div>
                <div>
                  <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>PUNTO DE VENTA HAB.</label>
                  <input type="text" value={settings.arcaInfo.puntoVenta} onChange={e => updateArcaSetting('puntoVenta', e.target.value)} placeholder="Ej: 2"
                    style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>UBICACIÓN DEL CERTIFICADO (.CRT)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" value={settings.arcaInfo.certPath} title={settings.arcaInfo.certPath} readOnly
                      style={{ flex: 1, background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.65rem' }} />
                    <button onClick={pickCert} className="btn-secondary" style={{ padding: '0 12px', fontSize: '0.65rem' }}>CARGAR</button>
                  </div>
                </div>
                <div>
                  <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>UBICACIÓN CLAVE PRIVADA (.KEY)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" value={settings.arcaInfo.keyPath} title={settings.arcaInfo.keyPath} readOnly
                      style={{ flex: 1, background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.65rem' }} />
                    <button onClick={pickKey} className="btn-secondary" style={{ padding: '0 12px', fontSize: '0.65rem' }}>CARGAR</button>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
                  <button onClick={testArca} disabled={arcaTesting} className="btn-secondary" style={{ flex: 1, padding: '16px' }}>
                    {arcaTesting ? 'CONECTANDO...' : 'PROBAR COMUNICACIÓN'}
                  </button>
                  <button onClick={generateCSR} disabled={arcaTesting} className="btn-secondary" style={{ flex: 1, padding: '16px', borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}>
                    GENERAR KEY Y PEDIDO (CSR)
                  </button>
              </div>

              {arcaStatus.type !== 'idle' && (
                <div style={{ 
                  marginTop: '16px', padding: '12px', background: arcaStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                  border: `1px solid ${arcaStatus.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span className="mono-font" style={{ fontSize: '0.7rem', color: arcaStatus.type === 'success' ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>
                    {arcaStatus.msg.toUpperCase()}
                  </span>
                  {arcaStatus.type === 'error' && (
                    <button onClick={() => setShowLogsModal(true)} className="btn-secondary" style={{ fontSize: '0.6rem', padding: '4px 8px', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                      VER LOGS TÉCNICOS
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* SECCION 5 - GESTIÓN DE CLIENTES */}
            <div className="premium-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>5. GESTIÓN DE CLIENTES</h3>
                <button onClick={() => openClientModal()} className="btn-primary" style={{ padding: '4px 16px', fontSize: '0.7rem' }}>+ NUEVO CLIENTE</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {settings.clients.map(c => (
                  <div key={c.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                       <div style={{ width: '4px', height: '30px', background: settings.selectedClientId === c.id ? 'var(--accent-color)' : 'transparent' }}></div>
                       <div>
                          <div className="mono-font" style={{ fontWeight: 800 }}>{c.name} {settings.selectedClientId === c.id && <span style={{fontSize: '0.6rem', color: 'var(--accent-color)'}}>[ACTIVO]</span>}</div>
                          <div className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>CUIT: {c.cuit} | TARIFA: ${c.hourlyRate}/hs</div>
                       </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => updateSetting('selectedClientId', c.id)} className="btn-secondary" style={{ padding: '8px', fontSize: '0.6rem' }}>USAR ESTE</button>
                      <button onClick={() => openClientModal(c)} className="btn-secondary" style={{ padding: '8px' }}><Pencil size={14}/></button>
                      <button onClick={() => deleteClient(c.id)} className="btn-secondary" style={{ padding: '8px', color: 'var(--danger)' }}><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCION 6 - SISTEMA */}
            <div className="premium-card">
              <h3 className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.9rem', marginBottom: '24px' }}>6. NÚCLEO DEL SISTEMA Y ACTUALIZACIONES</h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ 
                    width: '50px', height: '50px', borderRadius: '50%', background: 'var(--surface-border)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent-color)'
                  }}>
                    <Shield size={24} color="var(--accent-color)" />
                  </div>
                  <div>
                    <div className="mono-font" style={{ fontSize: '0.9rem', fontWeight: 800 }}>CHRONOS LABOR OS</div>
                    <div className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>VERSIÓN ACTUAL: {appVersion}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                   <button 
                    onClick={() => window.electronAPI?.checkForUpdates()} 
                    disabled={updateStatus === 'checking'}
                    className="btn-secondary" 
                    style={{ padding: '8px 24px', fontSize: '0.7rem' }}>
                    {updateStatus === 'checking' ? 'BUSCANDO...' : 'BUSCAR ACTUALIZACIÓN'}
                   </button>
                   
                   <div className="mono-font" style={{ fontSize: '0.6rem' }}>
                    {updateStatus === 'idle' && <span style={{color: 'var(--text-secondary)'}}>SISTEMA SINCRONIZADO</span>}
                    {updateStatus === 'checking' && <span style={{color: 'var(--accent-color)'}}>CONECTANDO CON SERVIDOR LYNX...</span>}
                    {updateStatus === 'available' && <span style={{color: 'var(--warning)'}}>NUEVA VERSIÓN DETECTADA - DESCARGANDO...</span>}
                    {updateStatus === 'downloaded' && <span style={{color: 'var(--success)'}}>¡ACTUALIZACIÓN LISTA PARA INSTALAR!</span>}
                    {updateStatus === 'not-available' && <span style={{color: 'var(--success)'}}>EL SOFTWARE ESTÁ ACTUALIZADO</span>}
                    {updateStatus === 'error' && <span style={{color: 'var(--danger)'}}>ERROR EN LA CONEXIÓN DE ACTUALIZACIÓN</span>}
                   </div>
                </div>
              </div>
              
              {updateStatus === 'downloaded' && (
                <button 
                  onClick={() => window.electronAPI?.restartApp()} 
                  className="btn-primary" 
                  style={{ width: '100%', marginTop: '16px', padding: '16px', fontWeight: 800 }}>
                  REINICIAR E INSTALAR AHORA
                </button>
              )}
            </div>
          </div>
        )}

        {/* HELP MODAL */}
        {showHelpModal && (
          <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)' }}>
             <div className="premium-card" style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                  <h2 className="mono-font" style={{ fontSize: '1.2rem', color: 'var(--accent-color)' }}>GUÍA DE CONFIGURACIÓN ARCA (AFIP)</h2>
                  <button onClick={() => setShowHelpModal(false)} className="btn-secondary"><X /></button>
                </div>
                
                <div className="mono-font" style={{ fontSize: '0.8rem', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
                  <p style={{ color: 'white', fontWeight: 800, marginBottom: '16px' }}>PASO 1: GENERAR ARCHIVOS TÉCNICOS</p>
                  <p>Haz clic en el botón <span style={{color: 'var(--accent-color)'}}>"GENERAR KEY Y PEDIDO (CSR)"</span> en la configuración. El sistema te pedirá una carpeta y creará dos archivos:</p>
                  <ul>
                    <li><b>privada.key:</b> Tu llave ultra-secreta. No la compartas con nadie.</li>
                    <li><b>pedido.csr:</b> Este archivo es el que debes subir a AFIP.</li>
                  </ul>

                  <p style={{ color: 'white', fontWeight: 800, margin: '24px 0 16px' }}>PASO 2: OBTENER EL CERTIFICADO EN AFIP</p>
                  <ol>
                    <li>Ingresa a la web de AFIP con tu clave fiscal.</li>
                    <li>Busca el servicio <b>"Administración de Certificados Digitales"</b>.</li>
                    <li>Sube el archivo <span style={{color: 'var(--accent-color)'}}>pedido.csr</span> que generó la aplicación.</li>
                    <li>AFIP te permitirá descargar un archivo <b>.crt</b>.</li>
                  </ol>

                  <p style={{ color: 'white', fontWeight: 800, margin: '24px 0 16px' }}>PASO 3: DAR DE ALTA EL PUNTO DE VENTA</p>
                  <ol>
                    <li>Entra a <b>"Regcom"</b> &gt; <b>"Puntos de venta"</b>.</li>
                    <li>Crea un nuevo punto de venta.</li>
                    <li><b>IMPORTANTE:</b> Selecciona el tipo <b>"Factura Electrónica - Web Services"</b>.</li>
                  </ol>

                  <p style={{ color: 'white', fontWeight: 800, margin: '24px 0 16px' }}>PASO 4: VINCULAR SERVICIO (DELEGACIÓN)</p>
                  <ol>
                    <li>Entra a <b>"Administrador de Relaciones de Clave Fiscal"</b>.</li>
                    <li>Haz clic en <b>"Nueva Relación"</b> &gt; <b>"Buscar"</b> &gt; <b>"AFIP"</b> &gt; <b>"WebServices"</b>.</li>
                    <li>Busca y selecciona <b>"Facturación Electrónica"</b>.</li>
                    <li>En el campo <b>"Representante"</b>, haz clic en Buscar y selecciona el <b>Alias</b> que creaste anteriormente (ej: LYNX_PROD). No pongas tu CUIT manualmente, selecciona el alias de la lista.</li>
                    <li>Haz clic en <b>"Confirmar"</b>.</li>
                  </ol>

                  <div style={{ background: 'rgba(255, 120, 0, 0.1)', padding: '20px', border: '1px solid #ff7800', margin: '32px 0' }}>
                    <p style={{ color: '#ff7800', fontWeight: 800, marginBottom: '8px' }}>⚠️ PARA MODO HOMOLOGACIÓN (PRUEBAS)</p>
                    <p style={{ fontSize: '0.7rem' }}>Si estás usando el botón "Modo Producción" apagado, AFIP requiere que también habilites el certificado en su servidor de pruebas:</p>
                    <ol style={{ fontSize: '0.7rem', marginTop: '12px' }}>
                      <li>Busca el servicio <b>"WSASS" - Autogestión de Certificados de Homologación</b>.</li>
                      <li>Sube allí el archivo .csr o selecciona el Alias que ya diste de alta.</li>
                      <li>Luego entra a <b>"Autorizar CUIT a acceder a Web-Services de Homologación"</b>.</li>
                      <li>Vincula tu CUIT con el servicio <b>wsfe</b> y el certificado de pruebas.</li>
                    </ol>
                  </div>

                  <div style={{ background: 'rgba(14, 165, 233, 0.1)', padding: '20px', border: '1px solid var(--accent-color)', margin: '32px 0' }}>
                     <p style={{ color: 'var(--accent-color)', margin: 0 }}>Una vez completado, carga el .crt y el .key en la sección de configuración de LYNX y haz la prueba de comunicación.</p>
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* CLIENT MODAL */}
        {showClientModal && (
          <div className="modal-overlay">
             <div className="premium-card" style={{ width: '100%', maxWidth: '500px' }}>
                <h2 className="mono-font" style={{ fontSize: '1rem', color: 'var(--accent-color)', marginBottom: '32px' }}>
                  {editClientId ? 'EDITAR CLIENTE' : 'NUEVO CLIENTE'}
                </h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                   <div>
                      <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>RAZÓN SOCIAL / NOMBRE</label>
                      <input type="text" value={tempClient.name} onChange={e => setTempClient({...tempClient, name: e.target.value})}
                        style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>CUIT</label>
                        <input type="text" value={tempClient.cuit} onChange={e => setTempClient({...tempClient, cuit: e.target.value})}
                          style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                      </div>
                      <div>
                        <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>VALOR HORA ($)</label>
                        <input type="number" value={tempClient.hourlyRate} onChange={e => setTempClient({...tempClient, hourlyRate: Number(e.target.value)})}
                          style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                      </div>
                   </div>
                   <div>
                      <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>DOMICILIO</label>
                      <input type="text" value={tempClient.domicilio} onChange={e => setTempClient({...tempClient, domicilio: e.target.value})}
                        style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                   </div>
                   <div>
                      <label className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>CONDICIÓN IVA</label>
                      <select value={tempClient.condicionIva} onChange={e => setTempClient({...tempClient, condicionIva: e.target.value})}
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
                          onClick={async () => {
                            const res = await window.electronAPI?.getPublicIp();
                            if (res?.success) setTempClient({...tempClient, workIp: res.ip});
                          }}
                          className="btn-secondary" style={{ fontSize: '0.7rem', padding: '0 12px' }}>DETECTAR MI IP</button>
                      </div>
                   </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
                   <button onClick={saveClient} className="btn-primary" style={{ flex: 1 }}>GUARDAR</button>
                   <button onClick={() => setShowClientModal(false)} className="btn-secondary" style={{ flex: 1 }}>CANCELAR</button>
                </div>
             </div>
          </div>
        )}
        {/* ZONE DETECTION PROMPT */}
        {activeZoneClient && !activeSessionId && (
          <div className="zone-prompt premium-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div className="mono-font" style={{ color: 'var(--accent-color)', fontWeight: 800, fontSize: '0.8rem' }}>DETECCIÓN DE ZONA</div>
              <button onClick={() => setActiveZoneClient(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <p className="mono-font" style={{ fontSize: '0.75rem', marginBottom: '20px', lineHeight: '1.4' }}>
              Te encuentras en la red de <span style={{ color: 'var(--accent-color)', fontWeight: 800 }}>{activeZoneClient.name}</span>.<br/>
              ¿Deseas iniciar el registro de horas?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => {
                  updateSetting('selectedClientId', activeZoneClient.id);
                  handlePunchIn();
                  setActiveZoneClient(null);
                }}
                className="btn-primary" style={{ flex: 1, fontSize: '0.7rem' }}>SÍ, INICIAR</button>
              <button onClick={() => setActiveZoneClient(null)} className="btn-secondary" style={{ flex: 1, fontSize: '0.7rem' }}>IGNORAR</button>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER - LYNX CONSULTING */}
      <footer style={{ padding: '16px 40px', background: '#000', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', opacity: 0.7 }}>
          <img src={lynxLogoUrl} alt="LYNX CONSULTING" style={{ height: '30px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>
        <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'flex', gap: '20px' }}>
          <span>APP_SECURE: TRUE</span>
          <span>{dataPath || 'LOCAL_MEMORY'}</span>
        </div>
      </footer>

      {/* MODAL DE FACTURACIÓN POR LOTES */}
      {showInvoicingModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(30px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
          <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--accent-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="mono-font" style={{ fontSize: '1.2rem' }}>[ FACTURACIÓN DE SESIONES PENDIENTES ]</h2>
              <button onClick={() => setShowInvoicingModal(false)} className="btn-secondary" style={{ border: 'none' }}><X size={20}/></button>
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
                  {sessions.filter(s => s.endTime && !s.invoiced).sort((a,b) => b.startTime.localeCompare(a.startTime)).map(s => {
                    const hrs = differenceInSeconds(parseISO(s.endTime!), parseISO(s.startTime)) / 3600;
                    return (
                      <tr key={s.id} onClick={() => handleToggleSession(s.id)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', background: selectedSessions.has(s.id) ? 'rgba(14, 165, 233, 0.1)' : 'transparent' }}>
                        <td style={{ padding: '12px 10px' }}><input type="checkbox" checked={selectedSessions.has(s.id)} readOnly style={{ accentColor: 'var(--accent-color)' }} /></td>
                        <td>{format(parseISO(s.startTime), 'dd/MM/yyyy')}</td>
                        <td>{hrs.toFixed(1)} hs</td>
                        <td style={{ textAlign: 'right', paddingRight: '10px', color: 'var(--success)' }}>${Math.floor(hrs * s.rate).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sessions.filter(s => s.endTime && !s.invoiced).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No hay sesiones pendientes de facturación.</div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <div className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>TOTAL A FACTURAR</div>
                  <div className="mono-font" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)' }}>
                    ${Math.floor(sessions.filter(s => selectedSessions.has(s.id)).reduce((acc, s) => acc + (differenceInSeconds(parseISO(s.endTime!), parseISO(s.startTime)) / 3600) * s.rate, 0)).toLocaleString()}
                  </div>
               </div>
               <button 
                onClick={handleGenerateInvoice} 
                disabled={isInvoicing || selectedSessions.size === 0}
                className="btn-primary" 
                style={{ height: '60px', padding: '0 40px', fontSize: '1rem' }}>
                 {isInvoicing ? 'EMITIENDO...' : 'EMITIR RECIBO C'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CARGA MANUAL */}
      {showManualEntry && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(30px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '450px', border: '1px solid var(--accent-color)' }}>
            <h2 style={{ marginBottom: '24px', fontSize: '1.2rem' }}>{editSessionId ? '[ EDITAR TURNO ]' : '[ CARGA MANUAL DE TURNO ]'}</h2>
            <form onSubmit={handleManualEntry} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--accent-color)', marginBottom: '10px' }}>HORA DE ENTRADA</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input 
                    type="date" 
                    value={manualStartDate} 
                    onChange={(e) => setManualStartDate(e.target.value)}
                    style={{ padding: '12px', background: '#111', border: '1px solid var(--accent-color)', color: 'white', outline: 'none', fontFamily: 'monospace', colorScheme: 'dark', cursor: 'pointer' }} 
                  />
                  <input 
                    type="time" 
                    value={manualStartTime} 
                    onChange={(e) => setManualStartTime(e.target.value)}
                    style={{ padding: '12px', background: '#111', border: '1px solid var(--accent-color)', color: 'white', outline: 'none', fontFamily: 'monospace', colorScheme: 'dark', cursor: 'pointer' }} 
                  />
                </div>
              </div>
              <div>
                <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--accent-color)', marginBottom: '10px' }}>HORA DE SALIDA</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input 
                    type="date" 
                    value={manualEndDate} 
                    onChange={(e) => setManualEndDate(e.target.value)}
                    style={{ padding: '12px', background: '#111', border: '1px solid var(--accent-color)', color: 'white', outline: 'none', fontFamily: 'monospace', colorScheme: 'dark', cursor: 'pointer' }} 
                  />
                  <input 
                    type="time" 
                    value={manualEndTime} 
                    onChange={(e) => setManualEndTime(e.target.value)}
                    style={{ padding: '12px', background: '#111', border: '1px solid var(--accent-color)', color: 'white', outline: 'none', fontFamily: 'monospace', colorScheme: 'dark', cursor: 'pointer' }} 
                  />
                </div>
              </div>
              <div>
                <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--accent-color)', marginBottom: '10px' }}>VALOR POR HORA (ARS)</label>
                <input type="number" value={manualRate} onChange={(e) => setManualRate(Number(e.target.value))} style={{ width: '100%', padding: '12px', background: '#000', border: '1px solid var(--surface-border)', color: 'white', outline: 'none', fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>GUARDAR</button>
                <button type="button" onClick={() => { setShowManualEntry(false); setEditSessionId(null); }} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>CANCELAR</button>
              </div>
            </form>
          </div>
        </div>
      )}
        {/* LOGS MODAL */}
        {showLogsModal && (
          <div className="modal-overlay">
             <div className="premium-card" style={{ width: '90%', maxWidth: '900px', maxHeight: '90vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 className="mono-font" style={{ fontSize: '1rem', color: 'var(--danger)' }}>DIAGNÓSTICO TÉCNICO ARCA</h2>
                  <button onClick={() => setShowLogsModal(false)} className="btn-secondary"><X /></button>
                </div>
                <div style={{ background: '#000', padding: '20px', border: '1px solid var(--surface-border)', maxHeight: '60vh', overflowY: 'auto' }}>
                  <pre className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {arcaDetailedError || "No hay logs disponibles."}
                  </pre>
                </div>
                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => {
                    navigator.clipboard.writeText(arcaDetailedError);
                    alert('Copiado al portapapeles');
                  }} className="btn-secondary" style={{ fontSize: '0.7rem' }}>COPIAR LOGS</button>
                  <button onClick={() => setShowLogsModal(false)} className="btn-secondary" style={{ fontSize: '0.7rem' }}>CERRAR</button>
                </div>
             </div>
          </div>
        )}
      </div>
  );
};

export default App;
