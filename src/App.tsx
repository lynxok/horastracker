import React, { useState, useEffect, useMemo } from 'react';
import lynxIconUrl from './assets/lynx_icon.png';
import lynxLogoUrl from './assets/lynx_logo.png';
import {
  Play, Square, History, Settings as SettingsIcon,
  Trash2, Shield, Activity, X,
  Minus, Maximize2, Pencil, BarChart3, Clock,
  Lock, Bird, Zap, Terminal, Hourglass, Cpu, GripVertical, Database, Search,
  Plus, FileText
} from 'lucide-react';
import {
  format, differenceInSeconds, differenceInDays, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, startOfDay, endOfDay,
  isWithinInterval, parseISO, subMonths
} from 'date-fns';
import { ThemeSelector } from './components/ThemeSelector';


const APP_VERSION = '2.3.36';
const LOCALE = 'es-AR';

const formatCurrency = (val: number) => 
  val.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      openWidget: (mode?: string) => void;
      closeWidget: () => void;
      openBackupsFolder: () => Promise<{ success: boolean }>;
      deepScanData: () => Promise<any[]>;
      importDataFromPath: (path: string) => Promise<{ success: boolean; error?: string }>;
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
      onMonitoringDataUpdate: (callback: (data: any) => void) => void;
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
  note?: string;
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
    monotributoStartDate?: string;
  };
  invoicePath?: string;
  theme?: 'cyberpunk' | 'matrix' | 'minimal' | 'deep-ocean' | 'harry-potter' | 'marvel' | 'loki' | 'winamp';
  widgetOpacity: number;
  widgetMode?: 'floating' | 'top-bar';
}

const MONOTRIBUTO_CATEGORIES = [
  { id: 'A', limit: 6450000 },
  { id: 'B', limit: 9450000 },
  { id: 'C', limit: 13250000 },
  { id: 'D', limit: 16450000 },
  { id: 'E', limit: 19350000 },
  { id: 'F', limit: 24250000 },
  { id: 'G', limit: 29000000 },
  { id: 'H', limit: 44000000 }, // Límite para Servicios
  { id: 'I', limit: 48500000 },
  { id: 'J', limit: 56400000 },
  { id: 'K', limit: 68000000 }  // Límite para Venta de Bienes
];

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
  theme: 'cyberpunk',
  widgetOpacity: 0.8,
  widgetMode: 'floating'
};

import { useThematicSounds } from './hooks/useThematicSounds';
import { InvoicingModal } from './components/modals/InvoicingModal';
import { ClientModal } from './components/modals/ClientModal';
import { ManualEntryModal } from './components/modals/ManualEntryModal';


// --- CONFIGURACIÓN DE TIPOS ---
const App: React.FC = () => {
  // Data State
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [billedMonths, setBilledMonths] = useState<BilledMonth[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  // App Infrastructure State
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [lockInput, setLockInput] = useState('');
  
  const { playThematicSound } = useThematicSounds();

  const isWidgetView = window.location.search.includes('view=widget');
  const isToastView = window.location.search.includes('view=toast');

  // Fix for widget background transparency
  useEffect(() => {
    if (isWidgetView || isToastView) {
      document.body.classList.add('is-widget');
    } else {
      document.body.classList.remove('is-widget');
    }
  }, [isWidgetView, isToastView]);

  const [activeTab, setActiveTab] = useState<'tracker' | 'dashboard' | 'history' | 'settings'>('tracker');
  const [dataPath, setDataPath] = useState<string>('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // ARCA Specific State
  const [arcaTesting, setArcaTesting] = useState(false);
  const [arcaStatus, setArcaStatus] = useState<{ msg: string; type: 'success' | 'error' | 'idle' }>({ msg: '', type: 'idle' });
  const [recoveryFiles, setRecoveryFiles] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [activeZoneClient, setActiveZoneClient] = useState<Client | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'available' | 'downloaded' | 'idle' | 'checking' | 'not-available' | 'error'>('idle');
  const [appVersion, setAppVersion] = useState<string>('...');
  const [currentNote, setCurrentNote] = useState('');
  const [toastData, setToastData] = useState<any>(null);
  const [isInvoicing, setIsInvoicing] = useState(false);
  const [isWidgetHovered, setIsWidgetHovered] = useState(false);

  const [showManualEntry, setShowManualEntry] = useState(false);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState({
    clientId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '17:00',
    description: '',
    rate: 0
  });



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

  const [showManualInvoiceModal, setShowManualInvoiceModal] = useState(false);
  const [manualInvoice, setManualInvoice] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    clientName: '',
    invoiceNumber: '',
    totalAmount: '',
    totalHours: ''
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
      } else {
        setIsUnlocked(true);
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
        if (!isLoaded) return;
        // Don't prompt or start if already running for this client
        const activeS = sessions.find(s => s.id === activeSessionId);
        if (activeS && activeS.clientId === client.id) return;

        const fullClient = settings.clients.find(c => c.id === client.id) || client;
        startSession(fullClient);
      });
    }
  }, [settings.clients, isLoaded]);

  // Toast Detection Logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'toast') {
      const clientData = params.get('client');
      if (clientData) {
        try {
          const parsed = JSON.parse(clientData);
          setToastData(parsed);
        } catch (e) {
          console.error('Error parsing toast data', e);
        }
      }
    } else if (params.get('view') === 'widget') {
      // Force transparency for widget mode
      document.body.style.background = 'transparent';
      document.body.style.backgroundImage = 'none';
      document.documentElement.style.background = 'transparent';
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

  // Sync monitoring and tray data whenever clients or active session change
  useEffect(() => {
    if (isLoaded && window.electronAPI) {
      const activeS = sessions.find(s => s.id === activeSessionId);
      
      // Sync IP Monitoring and Widget State
      window.electronAPI.syncMonitoringData({ 
        clients: settings.clients,
        activeClientId: activeS ? activeS.clientId : null,
        activeSessionId: activeSessionId,
        settings: settings,
        sessions: sessions // Sync full sessions to ensure consistency
      });

      // Sync Tray Menu Clients
      window.electronAPI.syncTrayData({
        clients: settings.clients,
        activeSession: activeS || null
      });
    }
  }, [isLoaded, settings, activeSessionId, sessions]);

  // Listen for sync from other windows
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onMonitoringDataUpdate((data: any) => {
        if (data.activeSessionId !== undefined && data.activeSessionId !== activeSessionId) {
          setActiveSessionId(data.activeSessionId);
        }
        if (data.sessions && JSON.stringify(data.sessions) !== JSON.stringify(sessions)) {
          setSessions(data.sessions);
        }
        if (data.settings && JSON.stringify(data.settings) !== JSON.stringify(settings)) {
          setSettings(data.settings);
        }
      });
    }
  }, [activeSessionId, sessions, settings]);

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
  
  const twelveMonthStats = useMemo(() => {
    const twelveMonthsAgo = startOfMonth(subMonths(now, 11));
    const baseStats = calculateStatsForInterval(twelveMonthsAgo, endOfMonth(now));
    
    // Include manual historical invoices (those with no sessions linked) in the ARCA calculation
    const manualBilledLast12 = billedMonths
      .filter(m => m.status === 'ACTIVE' && parseISO(m.date) >= twelveMonthsAgo && (!m.sessionsIds || m.sessionsIds.length === 0))
      .reduce((sum, m) => sum + m.totalAmount, 0);

    return {
      hours: baseStats.hours,
      earnings: baseStats.earnings + manualBilledLast12
    };
  }, [sessions, billedMonths, now]);
  const annualizedMonotributoStats = useMemo(() => {
    let earnings = twelveMonthStats.earnings;
    let isAnnualized = false;
    let daysActive = 365;

    if (settings.arcaInfo?.monotributoStartDate) {
      const startDate = parseISO(settings.arcaInfo.monotributoStartDate);
      daysActive = differenceInDays(now, startDate);
      
      // If enrolled less than a year (e.g. < 365 days) and more than 30 days (for stability)
      if (daysActive >= 30 && daysActive < 365) {
        earnings = (earnings / daysActive) * 365;
        isAnnualized = true;
      }
    }

    return { earnings, isAnnualized, daysActive };
  }, [twelveMonthStats, settings.arcaInfo?.monotributoStartDate, now]);

  const currentMonotributoCat = useMemo(() => {
    return MONOTRIBUTO_CATEGORIES.find(cat => annualizedMonotributoStats.earnings <= cat.limit) || MONOTRIBUTO_CATEGORIES[MONOTRIBUTO_CATEGORIES.length - 1];
  }, [annualizedMonotributoStats]);

  const nextMonotributoCat = useMemo(() => {
    const idx = MONOTRIBUTO_CATEGORIES.findIndex(cat => cat.id === currentMonotributoCat.id);
    if (idx < MONOTRIBUTO_CATEGORIES.length - 1) return MONOTRIBUTO_CATEGORIES[idx + 1];
    return null;
  }, [currentMonotributoCat]);
  
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

  // Recovery Assistant Handlers
  const scanHistoricalData = async () => {
    if (!window.electronAPI) return;
    setIsScanning(true);
    try {
      const results = await window.electronAPI.deepScanData();
      setRecoveryFiles(results);
      if (results.length === 0) {
        alert("No se encontraron archivos de sesiones anteriores en las carpetas conocidas.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const importHistoricalData = async (filePath: string) => {
    if (!window.electronAPI) return;
    if (!confirm("¿Estás seguro de que quieres importar estos datos? Se reemplazará el historial actual (aunque se guardará un backup de seguridad).")) return;
    
    try {
      const res = await window.electronAPI.importDataFromPath(filePath);
      if (res.success) {
        alert("¡Datos importados con éxito! La aplicación se reiniciará para cargar los cambios.");
        window.electronAPI.restartApp();
      } else {
        alert("Error al importar: " + res.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers
  const startSession = (client: Client) => {
    if (activeSessionId) return;
    const newS: WorkSession = {
      id: crypto.randomUUID(),
      startTime: new Date().toISOString(),
      rate: client.hourlyRate,
      clientId: client.id,
      clientName: client.name,
      note: currentNote
    };
    setSessions(prev => [...prev, newS]);
    setActiveSessionId(newS.id);
    playThematicSound(settings.theme || 'cyberpunk', 'punch-in');

  };

  const handlePunchIn = () => {
    if (!isLoaded) return; // Critical safety check
    const activeClient = settings.clients.find(c => c.id === settings.selectedClientId) || settings.clients[0];
    const newS: WorkSession = {
      id: crypto.randomUUID(),
      startTime: new Date().toISOString(),
      rate: activeClient.hourlyRate,
      clientId: activeClient.id,
      clientName: activeClient.name,
      note: currentNote
    };
    setSessions(prev => [...prev, newS]);
    setActiveSessionId(newS.id);
    playThematicSound(settings.theme || 'cyberpunk', 'punch-in');

  };

  const handlePunchOut = () => {
    if (!activeSessionId) return;
    setSessions(sessions.map(s => 
      s.id === activeSessionId ? { ...s, endTime: new Date().toISOString(), note: currentNote } : s
    ));
    setActiveSessionId(null);
    setCurrentNote(''); // Clear note after session ends
    playThematicSound(settings.theme || 'cyberpunk', 'punch-out');

  };

  const handleManualEntrySave = () => {
    const manualStart = `${manualEntry.date}T${manualEntry.startTime}`;
    const manualEnd = `${manualEntry.date}T${manualEntry.endTime}`;
    const targetClient = settings.clients.find(c => c.id === manualEntry.clientId) || settings.clients[0];
    
    if (editSessionId) {
      setSessions(sessions.map(s => {
        if (s.id === editSessionId) {
          if (s.invoiced) return s; 
          return { 
            ...s, 
            startTime: parseISO(manualStart).toISOString(), 
            endTime: parseISO(manualEnd).toISOString(), 
            rate: manualEntry.rate,
            clientId: targetClient.id,
            clientName: targetClient.name,
            note: manualEntry.description
          };
        }
        return s;
      }));
    } else {
      setSessions([...sessions, {
        id: crypto.randomUUID(),
        startTime: parseISO(manualStart).toISOString(),
        endTime: parseISO(manualEnd).toISOString(),
        rate: manualEntry.rate,
        clientId: targetClient.id,
        clientName: targetClient.name,
        note: manualEntry.description
      }]);
    }
    setShowManualEntry(false);
    setEditSessionId(null);
  };


  const openManualModal = (session?: WorkSession) => {
    if (session) {
      if (session.invoiced) return alert("Esta sesión ya fue facturada y está bloqueada.");
      setEditSessionId(session.id);
      const start = parseISO(session.startTime);
      const end = session.endTime ? parseISO(session.endTime) : new Date();
      
      setManualEntry({
        clientId: session.clientId,
        date: format(start, 'yyyy-MM-dd'),
        startTime: format(start, 'HH:mm'),
        endTime: format(end, 'HH:mm'),
        description: session.note || '',
        rate: session.rate
      });
    } else {
      const activeClient = settings.clients.find(c => c.id === settings.selectedClientId) || settings.clients[0];
      setEditSessionId(null);
      setManualEntry({
        clientId: activeClient.id,
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: format(new Date(), 'HH:mm'),
        endTime: format(new Date(), 'HH:mm'),
        description: '',
        rate: activeClient.hourlyRate
      });
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
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'widgetMode' && window.electronAPI) {
        window.electronAPI.openWidget(value);
      }
      return next;
    });
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

    if (!confirm(`¿Emitir factura oficial para ${client.name} por $${formatCurrency(totalAmount)}?`)) return;

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

  const handleSaveManualInvoice = async () => {
    if (!manualInvoice.clientName || !manualInvoice.totalAmount || !manualInvoice.date) return;
    
    const newInvoice: BilledMonth = {
      id: crypto.randomUUID(),
      date: new Date(manualInvoice.date).toISOString(),
      month: manualInvoice.date.substring(0, 7), // YYYY-MM
      totalHours: parseFloat(manualInvoice.totalHours) || 0,
      rate: 0,
      totalAmount: parseFloat(manualInvoice.totalAmount),
      status: 'ACTIVE',
      invoiceNumber: manualInvoice.invoiceNumber ? parseInt(manualInvoice.invoiceNumber) : undefined,
      sessionsIds: [], // Empty to denote manual entry
      clientName: manualInvoice.clientName
    };

    const newBilled = [...billedMonths, newInvoice];
    setBilledMonths(newBilled);
    setShowManualInvoiceModal(false);
  };

  // --- WIDGET LOGIC & CONFIG (Moved to top level to avoid conditional hook violations) ---
  const widgetMode = new URLSearchParams(window.location.search).get('mode') || 'floating';
  const isTopBar = widgetMode === 'top-bar';
  
  const getThemeWidgetConfig = () => {
    switch(settings.theme) {
      case 'harry-potter':
        return {
          icon: <Bird size={24} color="#5d4037" />,
          borderRadius: '12px',
          border: '8px double #5d4037',
          background: 'linear-gradient(to bottom, #f3e5ab 0%, #e5d392 100%)',
          label: '🦉 CARTA DE HOGWARTS',
          labelColor: '#5d4037',
          accentColor: '#5d4037',
          customStyle: {
            boxShadow: '2px 2px 10px rgba(0,0,0,0.3)',
            fontFamily: '"Cinzel", serif', 
            color: '#5d4037'
          }
        };
      case 'marvel':
        return {
          icon: <Zap size={24} color="#0ea5e9" />,
          borderRadius: '0',
          border: '1px solid #0ea5e9',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
          label: '🛡️ PROTOCOLO STARK',
          labelColor: '#0ea5e9',
          accentColor: '#0ea5e9',
          customStyle: {
            clipPath: 'polygon(0 0, 100% 0, 100% 85%, 90% 100%, 0 100%)', 
            borderLeft: '4px solid #0ea5e9',
            boxShadow: '0 0 20px rgba(14, 165, 233, 0.3)'
          }
        };
      case 'loki':
        return {
          icon: <Clock size={24} color="#d47522" />,
          borderRadius: '4px',
          border: '1px solid #d47522',
          background: 'rgba(26, 21, 15, 0.95)',
          label: '⏳ TIEMPO RESTANTE',
          labelColor: '#d47522',
          accentColor: '#d47522',
          customStyle: {
            borderLeft: '10px solid #d47522',
            boxShadow: '0 0 15px rgba(212, 117, 34, 0.3)'
          }
        };
      case 'winamp':
        return {
          icon: <Music size={24} color="#00ff00" />,
          borderRadius: '0',
          border: '2px solid #555',
          background: '#000',
          label: '📻 LYNX AMP v2.0',
          labelColor: '#00ff00',
          accentColor: '#00ff00',
          customStyle: {
            boxShadow: 'inset 0 0 10px #00ff00',
            fontFamily: 'monospace'
          }
        };
      default:
        return {
          icon: <Activity size={24} color="var(--accent-color)" />,
          borderRadius: '4px',
          border: '1px solid var(--surface-border)',
          background: 'rgba(15, 23, 42, 0.8)',
          label: isWidgetHovered && activeSessionId ? '💰 CRÉDITOS ACUMULADOS' : '⚡ ENLACE NEURAL',
          labelColor: 'var(--accent-color)',
          accentColor: 'var(--accent-color)',
          customStyle: {
            boxShadow: '0 0 30px var(--accent-glow), inset 0 0 10px rgba(13, 148, 136, 0.2)',
            border: '1px solid rgba(13, 148, 136, 0.5)'
          }
        };
    }
  };

  const widgetConfig = getThemeWidgetConfig() as any;
  const activeS = sessions.find(s => s.id === activeSessionId);
  const earnings = activeS ? (differenceInSeconds(now, parseISO(activeS.startTime)) / 3600) * activeS.rate : 0;
  const monthlyStats = calculateStatsForInterval(startOfMonth(now), endOfMonth(now));

  // Handle Click-through for Top Bar
  useEffect(() => {
    if (isWidgetView && isTopBar && window.electronAPI) {
      if (isWidgetHovered) {
        window.electronAPI.setIgnoreMouseEvents(false);
      } else {
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }, [isWidgetHovered, isTopBar, isWidgetView]);

  // Fallback for Top Bar hover detection when ignoring mouse events
  useEffect(() => {
    if (!isWidgetView || !isTopBar) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 10 && !isWidgetHovered) {
        setIsWidgetHovered(true);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isWidgetView, isTopBar, isWidgetHovered]);

  // Handle Sync Request from Widget
  useEffect(() => {
    if (isWidgetView && window.electronAPI) {
      window.electronAPI.requestSync();
    }
  }, [isWidgetView]);

  // Handle Sync Request from Main
  useEffect(() => {
    if (window.electronAPI && !isWidgetView && !isToastView) {
      const cleanup = window.electronAPI.onRequestSyncFromMain(() => {
        if (!isLoaded) return;
        window.electronAPI?.syncMonitoringData({ 
          clients: settings.clients,
          activeClientId: activeS ? activeS.clientId : null,
          activeSessionId: activeSessionId,
          settings: settings,
          sessions: sessions 
        });
      });
      return cleanup;
    }
  }, [isWidgetView, isToastView, isLoaded, sessions, settings, activeSessionId, activeS]);

  if (isWidgetView) {
    return (
      <div 
        style={{ 
          width: '100vw', 
          height: isTopBar ? '80px' : '100vh', 
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          overflow: 'hidden'
        }}>
        
        {/* Actual Widget Content */}
        <div 
          className={`fade-in widget-container ${isTopBar ? 'top-bar-widget' : ''}`}
          style={{ 
            width: isTopBar ? '100%' : '300px', 
            height: isTopBar ? '60px' : '100px', 
            padding: isTopBar ? '0 40px' : '0 24px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            border: isTopBar ? 'none' : widgetConfig.border, 
            borderBottom: `2px solid ${widgetConfig.accentColor || 'var(--accent-color)'}`,
            background: widgetConfig.background, 
            backdropFilter: 'blur(25px)', 
            color: widgetConfig.labelColor || 'white',
            position: 'absolute',
            top: 0,
            left: 0,
            overflow: 'hidden',
            borderRadius: isTopBar ? '0' : widgetConfig.borderRadius,
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            opacity: isTopBar ? (isWidgetHovered ? 1 : 0.4) : (isWidgetHovered ? 1 : (settings.widgetOpacity || 0.4)),
            transform: isTopBar && !isWidgetHovered ? 'translateY(-56px)' : 'translateY(0)',
            boxShadow: isTopBar && isWidgetHovered ? `0 4px 30px ${widgetConfig.accentColor || 'var(--accent-glow)'}` : 'none',
            pointerEvents: 'auto', 
            ...(!isTopBar ? widgetConfig.customStyle : {})
          }}>
          
          {/* HIT AREA & SENSOR (only for Top Bar) */}
          {isTopBar && (
            <div 
              onMouseEnter={() => setIsWidgetHovered(true)}
              onMouseLeave={() => setIsWidgetHovered(false)}
              style={{ 
                position: 'fixed', top: 0, left: 0, right: 0, 
                height: isWidgetHovered ? '80px' : '15px', 
                zIndex: 10001, 
                pointerEvents: 'auto',
                background: 'transparent'
              }} 
            />
          )}

          {/* Peeking Indicator (only when collapsed) */}
          {isTopBar && !isWidgetHovered && (
            <div style={{ 
              position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: '80px', height: '4px', background: widgetConfig.accentColor || 'var(--accent-color)',
              borderRadius: '0 0 4px 4px', opacity: 1, boxShadow: `0 0 15px ${widgetConfig.accentColor || 'var(--accent-color)'}`
            }} />
          )}

          {/* Drag handle - only for floating */}
          {!isTopBar && (
            <div style={{ 
              position: 'absolute', top: 0, left: 0, bottom: 0, width: '24px', 
              background: activeSessionId ? (widgetConfig.accentColor || 'var(--accent-color)') : 'rgba(255,255,255,0.05)',
              opacity: 0.8,
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: `1px solid ${widgetConfig.accentColor || 'rgba(255,255,255,0.1)'}`,
              ...( { WebkitAppRegion: 'drag' } as any )
            }}>
              <GripVertical size={14} color={activeSessionId ? 'black' : (widgetConfig.accentColor || 'white')} style={{ opacity: 0.5 }} />
            </div>
          )}

          <div style={{ marginLeft: isTopBar ? '0' : '20px' }} className={activeSessionId ? 'active-pulse' : ''}>
            {widgetConfig.icon}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: isTopBar ? 'row' : 'column', alignItems: isTopBar ? 'center' : 'stretch', gap: isTopBar ? '30px' : '0px', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: isTopBar ? '160px' : '0' }}>
              <div className="mono-font" style={{ fontSize: '0.5rem', color: widgetConfig.accentColor || 'var(--accent-color)', letterSpacing: '1px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {widgetConfig.label}
              </div>
              
              <div className="mono-font" style={{ fontSize: isTopBar ? '1.1rem' : '1.2rem', fontWeight: 800, letterSpacing: '-0.5px', color: activeSessionId ? (widgetConfig.labelColor || 'white') : 'rgba(128,128,128,0.5)', marginTop: '-2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isWidgetHovered && activeSessionId ? (
                  <span style={{ color: 'var(--success)' }}>${formatCurrency(earnings)}</span>
                ) : (
                  activeSessionId && activeS ? formatDuration(differenceInSeconds(now, parseISO(activeS.startTime)) / 3600) : "00:00:00"
                )}
              </div>
            </div>

            {/* Monthly Progress / Missing Hours - only when hovered */}
            {isWidgetHovered && settings.monthlyGoal > monthlyStats.earnings && (
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: isTopBar ? '100px' : '0', borderLeft: isTopBar ? `1px solid ${widgetConfig.accentColor || 'rgba(255,255,255,0.1)'}` : 'none', paddingLeft: isTopBar ? '20px' : '0' }}>
                <div className="mono-font" style={{ fontSize: '0.45rem', color: widgetConfig.accentColor || 'var(--accent-color)', opacity: 0.8, letterSpacing: '1px' }}>FALTAN</div>
                <div className="mono-font" style={{ fontSize: '0.9rem', fontWeight: 800, color: widgetConfig.accentColor || 'white' }}>
                  {((settings.monthlyGoal - monthlyStats.earnings) / (settings.clients.find(c => c.id === settings.selectedClientId)?.hourlyRate || settings.clients[0].hourlyRate)).toFixed(1)} <span style={{ fontSize: '0.6rem' }}>HS</span>
                </div>
              </div>
            )}

            {/* Quick Note Input - smaller on top bar */}
            <input 
              type="text" 
              placeholder="¿Qué estás haciendo?" 
              value={currentNote}
              onChange={e => setCurrentNote(e.target.value)}
              className="mono-font"
              style={{ 
                background: 'rgba(255,255,255,0.03)', 
                border: 'none', 
                borderBottom: `1px solid ${widgetConfig.accentColor || 'rgba(255,255,255,0.1)'}`, 
                color: widgetConfig.accentColor || 'var(--accent-color)', 
                fontSize: '0.7rem', 
                flex: 1,
                maxWidth: isTopBar ? '400px' : '100%',
                padding: '4px 8px',
                outline: 'none',
                marginTop: isTopBar ? '0' : '4px',
                borderRadius: '4px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button 
              onClick={activeSessionId ? handlePunchOut : handlePunchIn} 
              className="btn-primary"
              style={{ 
                width: '32px', height: '32px', padding: 0, justifyContent: 'center',
                background: activeSessionId ? 'var(--danger)' : 'transparent',
                borderColor: activeSessionId ? 'var(--danger)' : (widgetConfig.accentColor || 'var(--accent-color)'),
                boxShadow: activeSessionId ? '0 0 15px var(--danger-glow)' : `0 0 10px ${widgetConfig.accentColor || 'var(--accent-glow)'}`,
                color: activeSessionId ? 'white' : (widgetConfig.accentColor || 'var(--accent-color)')
              }}>
              {activeSessionId ? <Square fill="currentColor" size={14} /> : <Play fill="currentColor" size={14} style={{ marginLeft: '2px' }} />}
            </button>
            
            <button 
              onClick={() => window.electronAPI?.closeWidget()}
              className="btn-secondary"
              style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: 'none', color: widgetConfig.accentColor || 'white' }}>
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
        
        {/* Invisible hit area to trigger expansion when mouse is near the top */}
        {isTopBar && (
          <div 
            onMouseEnter={() => setIsWidgetHovered(true)}
            style={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '15px', 
              background: 'transparent', pointerEvents: 'auto', zIndex: 10000 
            }} 
          />
        )}
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

  // --- TOAST VIEW ---
  if (isToastView) {
    return (
      <div className="fade-in" style={{ height: '100vh', padding: '16px', background: 'rgba(15, 23, 42, 0.98)', border: '1px solid var(--accent-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="mono-font" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.65rem', fontWeight: 800 }}>
             <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></div>
             SISTEMA LYNX
          </div>
          <button onClick={() => window.electronAPI?.closeToast()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16}/></button>
        </div>

        {updateStatus === 'downloaded' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 className="mono-font" style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '8px', letterSpacing: '1px' }}>ACTUALIZACIÓN LISTA</h2>
            <p className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.4 }}>Se ha instalado la versión <b>v{appVersion}</b> automáticamente. Reinicia para aplicar los cambios.</p>
            <button 
              onClick={() => window.electronAPI?.restartApp()} 
              className="btn-primary" 
              style={{ width: '100%', padding: '14px', fontWeight: 800, borderColor: 'var(--danger)', color: 'white', background: 'rgba(239, 68, 68, 0.1)', boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)' }}>
              REINICIAR AHORA
            </button>
          </div>
        ) : toastData ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 className="mono-font" style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '6px' }}>ZONA DETECTADA</h2>
            <p className="mono-font" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Estás en la red de <b>{toastData.name}</b>. ¿Quieres iniciar el cronómetro?</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => {
                  window.electronAPI?.toastActionStart(toastData);
                  window.electronAPI?.closeToast();
                }}
                className="btn-primary" style={{ flex: 1, padding: '12px', fontSize: '0.7rem' }}>SÍ, INICIAR</button>
              <button onClick={() => window.electronAPI?.closeToast()} className="btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '0.7rem' }}>IGNORAR</button>
            </div>
          </div>
        ) : null}
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

                    <div style={{ fontSize: '6rem', fontWeight: 800, letterSpacing: '-4px', marginBottom: '8px', lineHeight: 1, color: activeSessionId ? 'var(--text-primary)' : 'var(--text-secondary)' }} className="mono-font">
                      {activeSessionId && activeSession ? formatDuration(differenceInSeconds(now, parseISO(activeSession.startTime)) / 3600) : "00:00:00"}
                    </div>
                    {/* Quick Note Input in Main View */}
                    <input 
                      type="text" 
                      placeholder="¿Qué estás haciendo ahora?" 
                      value={currentNote}
                      onChange={e => setCurrentNote(e.target.value)}
                      className="mono-font"
                      style={{ 
                        background: 'rgba(255,255,255,0.05)', 
                        border: 'none', 
                        borderBottom: '1px solid var(--accent-glow)', 
                        color: 'var(--accent-color)', 
                        fontSize: '0.8rem', 
                        width: '400px', 
                        padding: '8px 12px',
                        outline: 'none',
                        marginBottom: '16px'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button onClick={activeSessionId ? handlePunchOut : handlePunchIn} className="btn-primary"
                      style={{ width: '120px', height: '120px', borderRadius: '0', justifyContent: 'center', background: activeSessionId ? 'var(--danger)' : 'transparent', borderColor: activeSessionId ? 'var(--danger)' : 'var(--accent-color)', color: activeSessionId ? 'white' : 'var(--accent-color)', boxShadow: activeSessionId ? '0 0 40px var(--danger-glow)' : '0 0 30px var(--accent-glow)' }}>
                      {activeSessionId ? <Square fill="currentColor" size={40} /> : <Play fill="currentColor" size={40} style={{ marginLeft: '8px' }} />}
                    </button>
                    <button 
                      onClick={() => window.electronAPI?.openWidget(settings.widgetMode)}
                      className="btn-secondary" 
                      style={{ fontSize: '0.6rem', padding: '8px', justifyContent: 'center', gap: '8px', borderStyle: 'dashed' }}>
                      <Minus size={14} /> MODO WIDGET
                    </button>
                  </div>
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
                               {s.note && <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', opacity: 0.8, marginTop: '4px' }}>📝 {s.note}</div>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{ textAlign: 'right', minWidth: '100px' }}>
                              <span className="mono-font" style={{ fontWeight: 800, fontSize: '1rem' }}>{formatDuration(differenceInSeconds(parseISO(s.endTime!), parseISO(s.startTime)) / 3600)}</span>
                            </div>
                            <div style={{ color: 'var(--success)', fontWeight: 700, minWidth: '100px', textAlign: 'right' }} className="mono-font">
                              +${formatCurrency((differenceInSeconds(parseISO(s.endTime!), parseISO(s.startTime)) / 3600) * s.rate)}
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
                               {s.note && <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.8, marginTop: '4px' }}>📝 {s.note}</div>}
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
                 <div style={{ fontSize: '0.8rem', color: 'var(--success)' }} className="mono-font">${formatCurrency(dailyStats.earnings)}</div>
              </div>
              <div className="premium-card">
                 <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', marginBottom: '12px' }}>ESTA SEMANA</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 800 }} className="mono-font">{weeklyStats.hours.toFixed(1)} <span style={{fontSize: '0.8rem'}}>HS</span></div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--success)' }} className="mono-font">${formatCurrency(weeklyStats.earnings)}</div>
              </div>
              <div className="premium-card">
                 <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', marginBottom: '12px' }}>ESTE MES</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 800 }} className="mono-font">{monthlyStats.hours.toFixed(1)} <span style={{fontSize: '0.8rem'}}>HS</span></div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--success)' }} className="mono-font">${formatCurrency(monthlyStats.earnings)}</div>
              </div>
              <div className="premium-card" style={{ borderLeft: '3px solid var(--accent-secondary)' }}>
                 <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', marginBottom: '12px' }}>PROYECCIÓN CIERRE</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-secondary)' }} className="mono-font">
                   ${formatCurrency((monthlyStats.earnings / (new Date().getDate())) * (endOfMonth(new Date()).getDate()))}
                 </div>
              </div>
              <div className="premium-card" style={{ borderLeft: '3px solid var(--success)' }}>
                 <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', marginBottom: '12px' }}>TOTAL COBRADO</div>
                 <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }} className="mono-font">
                   ${formatCurrency(allTimeBilled)}
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
                  <span style={{ fontWeight: 800 }}>${formatCurrency(monthlyStats.earnings)}</span>
                </div>
                {settings.monthlyGoal > monthlyStats.earnings && (
                  <div style={{ textAlign: 'center', border: '1px dashed var(--accent-secondary)', padding: '2px 12px', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--accent-secondary)' }}>FALTAN: </span>
                    <span style={{ fontWeight: 800, color: 'var(--accent-secondary)' }}>
                      {((settings.monthlyGoal - monthlyStats.earnings) / (settings.clients.find(c => c.id === settings.selectedClientId)?.hourlyRate || settings.clients[0].hourlyRate)).toLocaleString('es-AR', { maximumFractionDigits: 1 })} HS
                    </span>
                  </div>
                )}
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>OBJETIVO: </span>
                  <span style={{ fontWeight: 800 }}>${formatCurrency(settings.monthlyGoal)}</span>
                </div>
              </div>
            </div>
            
            {/* --- PROYECCIÓN MONOTRIBUTO --- */}
            <div className="premium-card" style={{ border: '1px solid var(--accent-color)', background: 'rgba(14, 165, 233, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.8rem', fontWeight: 800 }}>PROYECCIÓN CATEGORÍA MONOTRIBUTO</div>
                  <div style={{ background: 'var(--accent-color)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 900 }}>CAT {currentMonotributoCat.id}</div>
                </div>
                <div className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>ÚLTIMOS 12 MESES</div>
              </div>

              <div className="revenue-progress-container" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div 
                  className="revenue-progress-bar" 
                  style={{ 
                    width: `${Math.min(100, (twelveMonthStats.earnings / currentMonotributoCat.limit) * 100)}%`,
                    background: (twelveMonthStats.earnings / currentMonotributoCat.limit) > 0.9 ? 'var(--danger)' : 'var(--accent-color)',
                    boxShadow: (twelveMonthStats.earnings / currentMonotributoCat.limit) > 0.9 ? '0 0 15px var(--danger-glow)' : '0 0 15px var(--accent-glow)'
                  }}
                ></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }} className="mono-font">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                   <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                     <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>TOTAL FACTURADO (12M): </span>
                     <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--success)' }}>${formatCurrency(twelveMonthStats.earnings)}</span>
                   </div>
                   
                   {annualizedMonotributoStats.isAnnualized && (
                     <div style={{ padding: '8px 12px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '4px', marginTop: '8px' }}>
                       <div style={{ fontSize: '0.65rem', color: 'var(--warning)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                         <Activity size={12} /> PROYECCIÓN ANUALIZADA (ARCA):
                       </div>
                       <div style={{ fontSize: '1.1rem', color: 'white', fontWeight: 900, marginTop: '2px' }}>
                         ${formatCurrency(annualizedMonotributoStats.earnings)}
                       </div>
                       <div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                         Basado en {annualizedMonotributoStats.daysActive} días de actividad.
                       </div>
                     </div>
                   )}
                </div>
                
                {nextMonotributoCat && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>PRÓXIMA CAT ({nextMonotributoCat.id}) DESDE: </span>
                    <span style={{ fontWeight: 800 }}>${formatCurrency(currentMonotributoCat.limit + 1)}</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--surface-border)', borderRadius: '4px' }}>
                 <div className="mono-font" style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>SALDO PARA MANTENER CATEGORÍA:</span>
                    <span style={{ color: (currentMonotributoCat.limit - annualizedMonotributoStats.earnings) < 500000 ? 'var(--danger)' : 'var(--success)', fontWeight: 800 }}>
                      ${formatCurrency(currentMonotributoCat.limit - annualizedMonotributoStats.earnings)}
                    </span>
                 </div>
                 {(currentMonotributoCat.limit - annualizedMonotributoStats.earnings) < 500000 && (
                   <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--danger)', marginTop: '8px', fontWeight: 800 }}>
                     ⚠️ ATENCIÓN: ESTÁS CERCA DEL LÍMITE DE RECATEGORIZACIÓN
                   </div>
                 )}
              </div>
            </div>

            <div className="premium-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 className="mono-font" style={{ color: 'var(--accent-color)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Lock size={14} /> HISTORIAL DE COMPROBANTES EMITIDOS
                </h3>
                <button 
                  onClick={() => setShowManualInvoiceModal(true)} 
                  className="btn-secondary" 
                  style={{ fontSize: '0.7rem', padding: '6px 12px' }}
                >
                  <Plus size={12} /> AÑADIR HISTÓRICO
                </button>
              </div>
              
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
                          <div className="mono-font" style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--success)' }}>${formatCurrency(bm.totalAmount)}</div>
                          <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{bm.totalHours.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} HS</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {bm.filePath && (
                            <button 
                              onClick={() => window.electronAPI?.openFile(bm.filePath!)}
                              className="btn-secondary" 
                              style={{ fontSize: '0.6rem', padding: '8px 12px' }}
                            >
                              VER PDF
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteRecord(bm)}
                            className="btn-secondary" 
                            style={{ padding: '8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                            title="Eliminar registro"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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
                           <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>LIQUIDADO: ${formatCurrency(stat.total)}</span>
                           <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>OBJETIVO: ${formatCurrency(stat.goal)}</span>
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
                         ${formatCurrency(m.totalAmount)}
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

            {/* SECCION 0 - TEMAS PREMIUM */}
            <ThemeSelector
              currentTheme={settings.theme || 'cyberpunk'}
              onThemeChange={(newTheme) => {
                updateSetting('theme', newTheme);
              }}
            />



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

              <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-border)' }}>
                <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>MODO DE PRESENTACIÓN DEL WIDGET</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={() => updateSetting('widgetMode', 'floating')}
                    className={settings.widgetMode === 'floating' ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1, fontSize: '0.7rem', padding: '10px' }}>
                    VENTANA FLOTANTE
                  </button>
                  <button 
                    onClick={() => updateSetting('widgetMode', 'top-bar')}
                    className={settings.widgetMode === 'top-bar' ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1, fontSize: '0.7rem', padding: '10px' }}>
                    BARRA SUPERIOR
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-border)' }}>
                <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  TRANSPARENCIA "FANTASMA" DEL WIDGET ({Math.round(settings.widgetOpacity * 100)}%)
                </label>
                <input 
                  type="range" 
                  min="0.05" 
                  max="1" 
                  step="0.05" 
                  value={settings.widgetOpacity} 
                  onChange={e => updateSetting('widgetOpacity', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  <span className="mono-font" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)' }}>INVISIBLE</span>
                  <span className="mono-font" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)' }}>OPACO</span>
                </div>
              </div>
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
                
                {/* BACKUP SYSTEM UI */}
                <div style={{ marginTop: '12px', padding: '16px', background: 'rgba(14, 165, 233, 0.05)', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="mono-font" style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Database size={14} /> SISTEMA DE PROTECCIÓN DE DATOS
                      </div>
                      <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        UBICACIÓN: {dataPath || 'Cargando...'}
                      </div>
                    </div>
                    <button 
                      onClick={() => window.electronAPI?.openBackupsFolder()} 
                      className="btn-secondary" 
                      style={{ padding: '8px 16px', fontSize: '0.65rem', borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}>
                      ABRIR CARPETA DE BACKUPS
                    </button>
                  </div>
                  <div className="mono-font" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', marginTop: '12px' }}>
                    * Se crea una copia de seguridad automática cada vez que se guardan cambios. El sistema conserva los últimos 10 estados para recuperación ante fallos.
                  </div>
                </div>

                {/* RECOVERY ASSISTANT UI */}
                <div style={{ marginTop: '24px', padding: '24px', background: 'rgba(255, 255, 255, 0.03)', border: '1px dashed var(--accent-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <div className="mono-font" style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Search size={14} /> ASISTENTE DE RECUPERACIÓN LYNX
                      </div>
                      <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Si perdiste tus horas al actualizar, usa esta herramienta para rastrear archivos antiguos.
                      </div>
                    </div>
                    <button 
                      onClick={scanHistoricalData} 
                      disabled={isScanning}
                      className="btn-primary" 
                      style={{ padding: '10px 24px', fontSize: '0.7rem' }}>
                      {isScanning ? 'ESCANEANDO PC...' : 'BUSCAR DATOS PERDIDOS'}
                    </button>
                  </div>

                  {recoveryFiles.length > 0 && (
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--warning)', fontWeight: 800 }}>RESULTADOS ENCONTRADOS:</div>
                      {recoveryFiles.map((file, idx) => (
                        <div key={idx} style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div className="mono-font" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Carpeta: {file.folderName}</div>
                            <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                              SESIONES: {file.sessions} | FACTURAS: {file.months} | ULTIMO USO: {new Date(file.mtime).toLocaleString(LOCALE)}
                            </div>
                          </div>
                          <button 
                            onClick={() => importHistoricalData(file.path)}
                            className="btn-secondary" 
                            style={{ padding: '8px 16px', fontSize: '0.65rem', borderColor: 'var(--success)', color: 'var(--success)' }}>
                            IMPORTAR ESTE ARCHIVO
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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

              <div style={{ marginBottom: '24px' }}>
                <label className="mono-font" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>FECHA DE INSCRIPCIÓN AL MONOTRIBUTO</label>
                <input type="date" value={settings.arcaInfo.monotributoStartDate || ''} onChange={e => updateArcaSetting('monotributoStartDate', e.target.value)} 
                  style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '12px', color: 'white', fontFamily: 'monospace' }} />
                <div className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Usado para anualizar tus ingresos en caso de que lleves menos de 12 meses inscripto.
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
          <ClientModal
            editClientId={editClientId}
            tempClient={tempClient}
            setTempClient={(c) => setTempClient(prev => ({...prev, ...c}))}

            onSave={saveClient}
            onClose={() => setShowClientModal(false)}
            onDetectIp={async () => {
              const res = await window.electronAPI?.getPublicIp();
              if (res?.success) setTempClient({...tempClient, workIp: res.ip});
            }}
          />
        )}

        {/* ZONE DETECTION PROMPT */}
        {isLoaded && activeZoneClient && !activeSessionId && (
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
        <InvoicingModal
          sessions={sessions}
          selectedSessions={selectedSessions}
          onToggleSession={handleToggleSession}
          onGenerate={handleGenerateInvoice}
          onClose={() => setShowInvoicingModal(false)}
          isInvoicing={isInvoicing}
        />
      )}

      {/* MODAL CARGA MANUAL */}
      {showManualEntry && (
        <ManualEntryModal
          clients={settings.clients}
          manualEntry={manualEntry}
          setManualEntry={setManualEntry}
          onSave={handleManualEntrySave}
          onClose={() => setShowManualEntry(false)}
        />
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
        {/* --- MANUAL INVOICE MODAL --- */}
      {showManualInvoiceModal && (
        <div className="modal-overlay" onClick={() => setShowManualInvoiceModal(false)}>
          <div className="modal-content premium-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 className="mono-font" style={{ color: 'var(--accent-color)', marginBottom: '20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={20} /> AÑADIR COMPROBANTE HISTÓRICO
            </h2>
            <p className="mono-font" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Estos comprobantes se sumarán al acumulado de 12 meses para el cálculo del Monotributo, pero no tendrán sesiones ni PDF asociados en LYNX.
            </p>
            
            <div className="settings-group" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>Fecha de Emisión</label>
                <input type="date" style={{ width: '100%' }} value={manualInvoice.date} onChange={e => setManualInvoice({ ...manualInvoice, date: e.target.value })} />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>Cliente (Razón Social)</label>
                <input type="text" style={{ width: '100%' }} placeholder="Ej. ACME Corp" value={manualInvoice.clientName} onChange={e => setManualInvoice({ ...manualInvoice, clientName: e.target.value })} />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>Número de Comprobante (Opcional)</label>
                <input type="number" style={{ width: '100%' }} placeholder="Ej. 12" value={manualInvoice.invoiceNumber} onChange={e => setManualInvoice({ ...manualInvoice, invoiceNumber: e.target.value })} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>Monto Total ($)</label>
                  <input type="number" style={{ width: '100%' }} placeholder="Ej. 150000" value={manualInvoice.totalAmount} onChange={e => setManualInvoice({ ...manualInvoice, totalAmount: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>Horas (Opcional)</label>
                  <input type="number" style={{ width: '100%' }} step="0.5" placeholder="Ej. 25.5" value={manualInvoice.totalHours} onChange={e => setManualInvoice({ ...manualInvoice, totalHours: e.target.value })} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
              <button className="btn-primary" onClick={handleSaveManualInvoice} style={{ flex: 1, justifyContent: 'center' }}>GUARDAR COMPROBANTE</button>
              <button className="btn-secondary" onClick={() => setShowManualInvoiceModal(false)}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
