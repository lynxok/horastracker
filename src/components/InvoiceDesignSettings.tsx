import React, { useState, useEffect } from "react";
import { Image as ImageIcon, Upload, Save, FileText, RefreshCw, FilePenLine } from "lucide-react";
import { generateInvoicePDF } from "../utils/pdfGenerator";

const mockInvoice = {
  id: "2026-9999",
  ptoVta: 2,
  voucherNumber: 3,
  date: "2026-05-30",
  amount: 206000,
  description: "Servicios de Barbería del día 2026-05-30",
  clientCuit: "20369106539",
  clientName: "CONSUMIDOR FINAL",
  cae: "86238304087136",
  caeVto: "2026-06-14"
};

interface InvoiceDesignSettingsProps {
  settings: any;
  updateSetting: (key: any, value: any) => void;
}

export default function InvoiceDesignSettings({ settings: parentSettings, updateSetting }: InvoiceDesignSettingsProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'logos' | 'spacing'>('design');
  const [saving, setSaving] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>("");

  const initialDesignSettings = {
    invoiceLogo: "",
    pdfColorPalette: "slate",
    pdfLogoPosition: "izquierda",
    pdfLogoSizeWidth: 30,
    pdfLynxLogo: "",
    pdfLynxPosition: "abajo_derecha",
    pdfLynxSize: 25,
    pdfLynxOpacity: 0.08,
    pdfHeaderHeight: 55,
    pdfCompanyNameSize: 16,
    pdfCompanyNameY: 25,
    pdfRightColTitleSize: 18,
    pdfRightColDetailsSize: 9,
    pdfRightColY: 15,
    pdfInvoiceTypeX: 95,
    pdfInvoiceTypeY: 10,
    pdfTableStartY: 98,
    domicilioComercial: parentSettings?.arcaInfo?.domicilioComercial || "",
    nombreFantasia: parentSettings?.arcaInfo?.nombreEmisor || "",
    inicioActividad: parentSettings?.arcaInfo?.monotributoStartDate 
      ? new Date(parentSettings.arcaInfo.monotributoStartDate).toLocaleDateString('es-AR') 
      : "01/05/2026",
    ingresosBrutos: parentSettings?.arcaInfo?.cuit || "",
    pdfLeftColAlign: "centrado",
    pdfLeftColX: 15,
    pdfRightColX: 110,
    pdfLogoX: 15,
    pdfLogoY: 12,
    ...(parentSettings?.invoiceDesign || {})
  };

  const [settings, setSettings] = useState(initialDesignSettings);

  // Sync state if parent settings change
  useEffect(() => {
    if (parentSettings?.invoiceDesign) {
      setSettings((prev: any) => ({
        ...prev,
        ...parentSettings.invoiceDesign
      }));
    }
  }, [parentSettings?.invoiceDesign]);

  // Update real-time PDF preview URL (Debounced)
  useEffect(() => {
    let active = true;
    const updatePreview = async () => {
      try {
        const url = (await generateInvoicePDF(mockInvoice, settings)) as string;
        if (active) {
          setPdfPreviewUrl(url);
        }
      } catch (err) {
        console.error("Error updating PDF preview:", err);
      }
    };

    const timer = setTimeout(() => {
      updatePreview();
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [settings]);

  // Handle logo change for business logo
  const handleBusinessLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setSettings((prev: any) => ({ ...prev, invoiceLogo: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle logo change for LYNX logo
  const handleLynxLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setSettings((prev: any) => ({ ...prev, pdfLynxLogo: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (field: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      updateSetting('invoiceDesign', settings);
      alert("Diseño de factura guardado exitosamente.");
    } catch (error: any) {
      console.error("Error al guardar el diseño:", error);
      alert(`Error al guardar el diseño. Detalle: ${error.message}`);
    }
    setSaving(false);
  };

  const resetLynxLogo = () => {
    setSettings((prev: any) => ({ ...prev, pdfLynxLogo: "" }));
  };

  // Paletas de colores
  const palettes = [
    { id: "slate", name: "Pizarra Clásica", primary: "bg-[#1e293b]", secondary: "bg-[#94a3b8]" },
    { id: "blue", name: "Azul Profesional", primary: "bg-[#1e3a8a]", secondary: "bg-[#60a5fa]" },
    { id: "emerald", name: "Verde Esmeralda", primary: "bg-[#064e3b]", secondary: "bg-[#34d299]" },
    { id: "amber", name: "Ámbar Premium", primary: "bg-[#78350f]", secondary: "bg-[#fbc124]" },
    { id: "monochrome", name: "Monocromo", primary: "bg-[#000000]", secondary: "bg-[#71717a]" },
    { id: "soft_white", name: "Blanco Minimalista", primary: "bg-[#f1f5f9] border border-primary/20", secondary: "bg-[#cbd5e1]" }
  ];

  return (
    <section className="mb-12" style={{ marginTop: '24px' }}>
      <div className="flex items-center gap-3 mb-6" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div className="bg-primary/10 p-2 rounded" style={{ background: 'rgba(var(--accent-color-rgb), 0.1)', padding: '8px', borderRadius: '4px' }}>
          <ImageIcon size={24} style={{ color: 'var(--accent-color)' }} />
        </div>
        <h2 className="mono-font" style={{ fontSize: '0.9rem', color: 'var(--accent-color)', margin: 0 }}>PERSONALIZAR APARIENCIA DEL COMPROBANTE</h2>
      </div>

      <div className="premium-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }} className="grid-designer-container">
          
          {/* Controles de Configuración */}
          <div className="space-y-6" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Tabs Selector */}
            <div className="flex border-b border-primary/20 pb-2 gap-4" style={{ display: 'flex', borderBottom: '1px solid var(--surface-border)', paddingBottom: '8px', gap: '16px' }}>
              <button 
                type="button"
                onClick={() => setActiveTab('design')}
                className="mono-font"
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.7rem', fontWeight: 800, paddingBottom: '8px', 
                  color: activeTab === 'design' ? 'var(--accent-color)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'design' ? '2px solid var(--accent-color)' : 'none'
                }}
              >
                Diseño & Datos
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('logos')}
                className="mono-font"
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.7rem', fontWeight: 800, paddingBottom: '8px', 
                  color: activeTab === 'logos' ? 'var(--accent-color)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'logos' ? '2px solid var(--accent-color)' : 'none'
                }}
              >
                Logos
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('spacing')}
                className="mono-font"
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.7rem', fontWeight: 800, paddingBottom: '8px', 
                  color: activeTab === 'spacing' ? 'var(--accent-color)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'spacing' ? '2px solid var(--accent-color)' : 'none'
                }}
              >
                Alineación & Márgenes
              </button>
            </div>

            {/* TAB: DISEÑO & DATOS */}
            {activeTab === 'design' && (
              <div className="space-y-6" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="mono-font" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>PALETA DE COLORES PRINCIPAL</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {palettes.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleInputChange('pdfColorPalette', p.id)}
                        className="mono-font"
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '12px', background: settings.pdfColorPalette === p.id ? 'rgba(255,255,255,0.05)' : '#000',
                          border: `1px solid ${settings.pdfColorPalette === p.id ? 'var(--accent-color)' : 'var(--surface-border)'}`,
                          color: '#fff', cursor: 'pointer', fontSize: '0.75rem', borderRadius: '4px'
                        }}
                      >
                        <span>{p.name}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span className={`w-4 h-4 rounded-full ${p.primary}`} style={{ width: '14px', height: '14px', borderRadius: '50%', display: 'inline-block' }} />
                          <span className={`w-4 h-4 rounded-full ${p.secondary}`} style={{ width: '14px', height: '14px', borderRadius: '50%', display: 'inline-block' }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ border: '1px solid var(--surface-border)', padding: '16px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 className="mono-font" style={{ fontSize: '0.75rem', color: 'var(--accent-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FilePenLine size={14} /> DATOS FISCALES / COMERCIALES DE EMISOR
                  </h3>
                  
                  <div>
                    <label className="mono-font" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Nombre Comercial / Fantasía (Lado Izquierdo)</label>
                    <input 
                      type="text" 
                      style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px', color: 'white', fontFamily: 'monospace', fontSize: '0.75rem' }}
                      placeholder="Ej: Loaiza Martha"
                      value={settings.nombreFantasia}
                      onChange={(e) => handleInputChange('nombreFantasia', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mono-font" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Dirección Comercial (Lado Izquierdo)</label>
                    <textarea 
                      rows={2}
                      style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px', color: 'white', fontFamily: 'monospace', fontSize: '0.75rem', resize: 'none' }}
                      placeholder="Ej: SAN PEDRITO AV. 248 Piso:PB&#10;Ciudad Autónoma de Buenos Aires"
                      value={settings.domicilioComercial}
                      onChange={(e) => handleInputChange('domicilioComercial', e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="mono-font" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Inicio de Actividad</label>
                      <input 
                        type="text" 
                        style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px', color: 'white', fontFamily: 'monospace', fontSize: '0.75rem' }}
                        placeholder="Ej: 01/05/2026"
                        value={settings.inicioActividad}
                        onChange={(e) => handleInputChange('inicioActividad', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mono-font" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Ingresos Brutos C.M</label>
                      <input 
                        type="text" 
                        style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px', color: 'white', fontFamily: 'monospace', fontSize: '0.75rem' }}
                        placeholder="Ej: 23-95543325-4"
                        value={settings.ingresosBrutos}
                        onChange={(e) => handleInputChange('ingresosBrutos', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: LOGOS */}
            {activeTab === 'logos' && (
              <div className="space-y-6" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Logo del Comercio */}
                <div style={{ border: '1px solid var(--surface-border)', padding: '16px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 className="mono-font" style={{ fontSize: '0.75rem', color: 'var(--accent-color)', margin: 0 }}>LOGO DEL COMERCIO</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label className="mono-font" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>POSICIÓN DEL LOGO</label>
                      <select 
                        style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px', color: 'white', fontFamily: 'monospace', fontSize: '0.75rem' }}
                        value={settings.pdfLogoPosition}
                        onChange={(e) => handleInputChange('pdfLogoPosition', e.target.value)}
                      >
                        <option value="izquierda">Cabecera Izquierda</option>
                        <option value="derecha">Cabecera Derecha</option>
                        <option value="oculto">Ocultar Logo</option>
                      </select>
                    </div>

                    <div>
                      <label className="mono-font" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>ANCHO DEL LOGO ({settings.pdfLogoSizeWidth} mm)</label>
                      <input 
                        type="range"
                        min="15"
                        max="60"
                        style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfLogoSizeWidth}
                        onChange={(e) => handleInputChange('pdfLogoSizeWidth', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {settings.pdfLogoPosition !== "oculto" && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Alineación Horizontal X</span>
                          <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfLogoX} mm</span>
                        </div>
                        <input 
                          type="range" min="5" max="150" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                          value={settings.pdfLogoX}
                          onChange={(e) => handleInputChange('pdfLogoX', Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Alineación Vertical Y</span>
                          <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfLogoY} mm</span>
                        </div>
                        <input 
                          type="range" min="5" max="50" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                          value={settings.pdfLogoY}
                          onChange={(e) => handleInputChange('pdfLogoY', Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ border: '2px dashed var(--surface-border)', padding: '20px', borderRadius: '4px', textAlign: 'center', position: 'relative', cursor: 'pointer' }}>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg" 
                      onChange={handleBusinessLogoChange}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                    <Upload style={{ margin: '0 auto 8px', color: 'var(--text-secondary)' }} size={24} />
                    <p className="mono-font" style={{ fontSize: '0.7rem', margin: 0, fontWeight: 800 }}>Haz clic o arrastra el logo del negocio</p>
                    {settings.invoiceLogo && <p className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--success)', marginTop: '4px', margin: 0 }}>✓ LOGO CARGADO</p>}
                  </div>
                </div>

                {/* Logo de LYNX */}
                <div style={{ border: '1px solid var(--surface-border)', padding: '16px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 className="mono-font" style={{ fontSize: '0.75rem', color: 'var(--accent-color)', margin: 0 }}>LOGO / MARCA DE LYNX (Branding)</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label className="mono-font" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>UBICACIÓN EN HOJA</label>
                      <select 
                        style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '10px', color: 'white', fontFamily: 'monospace', fontSize: '0.75rem' }}
                        value={settings.pdfLynxPosition}
                        onChange={(e) => handleInputChange('pdfLynxPosition', e.target.value)}
                      >
                        <option value="abajo_derecha">Abajo Derecha (Pie de pág.)</option>
                        <option value="abajo_izquierda">Abajo Izquierda (Pie de pág.)</option>
                        <option value="abajo_centro">Abajo al Centro (Pie de pág.)</option>
                        <option value="marca_agua">Centro (Marca de Agua)</option>
                        <option value="oculto">Ocultar de la Factura</option>
                      </select>
                    </div>

                    <div>
                      <label className="mono-font" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>ANCHO DEL LOGO ({settings.pdfLynxSize} mm)</label>
                      <input 
                        type="range"
                        min="10"
                        max="60"
                        style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfLynxSize}
                        onChange={(e) => handleInputChange('pdfLynxSize', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {settings.pdfLynxPosition === "marca_agua" && (
                    <div>
                      <label className="mono-font" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>OPACIDAD DE MARCA DE AGUA ({(settings.pdfLynxOpacity * 100).toFixed(0)}%)</label>
                      <input 
                        type="range"
                        min="0.02"
                        max="0.30"
                        step="0.01"
                        style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfLynxOpacity}
                        onChange={(e) => handleInputChange('pdfLynxOpacity', Number(e.target.value))}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ border: '2px dashed var(--surface-border)', padding: '16px', borderRadius: '4px', textAlign: 'center', position: 'relative', cursor: 'pointer', flex: 1 }}>
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg" 
                        onChange={handleLynxLogoChange}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                      />
                      <Upload style={{ margin: '0 auto 4px', color: 'var(--text-secondary)' }} size={20} />
                      <p className="mono-font" style={{ fontSize: '0.65rem', margin: 0, fontWeight: 800 }}>Subir logo LYNX personalizado</p>
                      {settings.pdfLynxLogo && <p className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--success)', marginTop: '4px', margin: 0 }}>✓ LOGO PERSONALIZADO</p>}
                    </div>

                    {settings.pdfLynxLogo && (
                      <button 
                        type="button" 
                        onClick={resetLynxLogo}
                        className="btn-secondary"
                        style={{ fontSize: '0.65rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                      >
                        Restaurar original
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB: SPACING & ALIGNMENTS */}
            {activeTab === 'spacing' && (
              <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '420px', overflowY: 'auto', paddingRight: '8px' }}>
                
                <div>
                  <h3 className="mono-font" style={{ fontSize: '0.75rem', color: 'var(--accent-color)', margin: '0 0 10px' }}>DIMENSIONES GENERALES DE LA HOJA</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', border: '1px solid var(--surface-border)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Altura de Cabecera</span>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfHeaderHeight} mm</span>
                      </div>
                      <input 
                        type="range" min="35" max="75" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfHeaderHeight}
                        onChange={(e) => handleInputChange('pdfHeaderHeight', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Inicio de Tabla de Ítems</span>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfTableStartY} mm</span>
                      </div>
                      <input 
                        type="range" min="70" max="115" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfTableStartY}
                        onChange={(e) => handleInputChange('pdfTableStartY', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mono-font" style={{ fontSize: '0.75rem', color: 'var(--accent-color)', margin: '0 0 10px' }}>COLUMNA IZQUIERDA (Fantasía)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', border: '1px solid var(--surface-border)' }}>
                    <div>
                      <label className="mono-font" style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Alineación de Texto</label>
                      <select
                        style={{ width: '100%', background: '#000', border: '1px solid var(--surface-border)', padding: '8px', color: 'white', fontFamily: 'monospace', fontSize: '0.75rem' }}
                        value={settings.pdfLeftColAlign}
                        onChange={(e) => handleInputChange('pdfLeftColAlign', e.target.value)}
                      >
                        <option value="centrado">Centrado en bloque izquierdo</option>
                        <option value="izquierda">Alineado a la Izquierda</option>
                      </select>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Posición Horizontal (Margen X)</span>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfLeftColX} mm</span>
                      </div>
                      <input 
                        type="range" min="5" max="50" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfLeftColX}
                        onChange={(e) => handleInputChange('pdfLeftColX', Number(e.target.value))}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Posición Vertical (Alineación Y)</span>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfCompanyNameY} mm</span>
                      </div>
                      <input 
                        type="range" min="12" max="60" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfCompanyNameY}
                        onChange={(e) => handleInputChange('pdfCompanyNameY', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Tamaño de Fuente Nombre</span>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfCompanyNameSize} px</span>
                      </div>
                      <input 
                        type="range" min="10" max="24" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfCompanyNameSize}
                        onChange={(e) => handleInputChange('pdfCompanyNameSize', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mono-font" style={{ fontSize: '0.75rem', color: 'var(--accent-color)', margin: '0 0 10px' }}>COLUMNA DERECHA (FACTURA)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', border: '1px solid var(--surface-border)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Posición Horizontal (Margen X)</span>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfRightColX} mm</span>
                      </div>
                      <input 
                        type="range" min="80" max="140" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfRightColX}
                        onChange={(e) => handleInputChange('pdfRightColX', Number(e.target.value))}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Posición Vertical (Alineación Y)</span>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfRightColY} mm</span>
                      </div>
                      <input 
                        type="range" min="12" max="50" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfRightColY}
                        onChange={(e) => handleInputChange('pdfRightColY', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Tamaño Fuente "FACTURA"</span>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfRightColTitleSize} px</span>
                      </div>
                      <input 
                        type="range" min="12" max="24" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfRightColTitleSize}
                        onChange={(e) => handleInputChange('pdfRightColTitleSize', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Tamaño Fuente Detalles</span>
                        <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfRightColDetailsSize} px</span>
                      </div>
                      <input 
                        type="range" min="7" max="13" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                        value={settings.pdfRightColDetailsSize}
                        onChange={(e) => handleInputChange('pdfRightColDetailsSize', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mono-font" style={{ fontSize: '0.75rem', color: 'var(--accent-color)', margin: '0 0 10px' }}>CAJA COMPROBANTE C (Centro)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', border: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Posición X</span>
                          <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfInvoiceTypeX} mm</span>
                        </div>
                        <input 
                          type="range" min="85" max="115" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                          value={settings.pdfInvoiceTypeX}
                          onChange={(e) => handleInputChange('pdfInvoiceTypeX', Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Posición Y</span>
                          <span className="mono-font" style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>{settings.pdfInvoiceTypeY} mm</span>
                        </div>
                        <input 
                          type="range" min="10" max="40" style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                          value={settings.pdfInvoiceTypeY}
                          onChange={(e) => handleInputChange('pdfInvoiceTypeY', Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            <button 
              type="button"
              onClick={saveSettings} 
              disabled={saving}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', fontWeight: 800, marginTop: '16px' }}
            >
              <Save size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
              {saving ? 'GUARDANDO CONFIGURACIÓN...' : 'GUARDAR DISEÑO FINAL'}
            </button>
          </div>

          {/* Live Preview Pane */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '620px' }} className="preview-pane-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="mono-font" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={14} style={{ color: 'var(--accent-color)' }} /> VISTA PREVIA DEL PDF EN VIVO
              </label>
              <span className="mono-font" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RefreshCw size={10} className="animate-pulse" style={{ color: 'var(--success)' }} /> Auto-Regenerando
              </span>
            </div>
            
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.6)', border: '1px solid var(--surface-border)', padding: '6px', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pdfPreviewUrl ? (
                <iframe 
                  src={pdfPreviewUrl} 
                  style={{ width: '100%', height: '100%', borderRadius: '2px', border: 'none', background: '#fff' }}
                  title="Vista Previa de Factura PDF"
                />
              ) : (
                <div style={{ textAlign: 'center', opacity: 0.3 }}>
                  <ImageIcon size={48} style={{ margin: '0 auto 8px', color: 'var(--accent-color)' }} />
                  <p className="mono-font" style={{ fontSize: '0.65rem' }}>Generando Vista Previa...</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
