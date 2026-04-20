const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { autoUpdater } = require('electron-updater');
const { Afip } = require('afip.ts');
const forge = require('node-forge');
const QRCode = require('qrcode');
const isDev = process.env.NODE_ENV === 'development';

// Migrate data from old directory if necessary
const migrateData = () => {
  try {
    const oldPath = path.join(app.getPath('appData'), 'registro-de-horas-de-trabajo');
    const newPath = app.getPath('userData');

    if (oldPath === newPath) return; 
    if (!fs.existsSync(oldPath)) return;

    const oldDataFile = path.join(oldPath, 'session_data.json');
    const newDataFile = path.join(newPath, 'session_data.json');

    if (fs.existsSync(oldDataFile)) {
      let shouldMigrate = !fs.existsSync(newDataFile);
      if (!shouldMigrate) {
        const stats = fs.statSync(newDataFile);
        if (stats.size < 1000) shouldMigrate = true; 
      }

      if (shouldMigrate) {
        const items = ['session_data.json', 'afip_tickets', 'facturas', 'certs', 'Local Storage'];
        items.forEach(item => {
          const src = path.join(oldPath, item);
          const dest = path.join(newPath, item);
          if (fs.existsSync(src)) {
            if (fs.lstatSync(src).isDirectory()) {
              fs.cpSync(src, dest, { recursive: true });
            } else {
              fs.copyFileSync(src, dest);
            }
          }
        });
      }
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
};

migrateData();

// Data storage setup
const userDataPath = app.getPath('userData');
const dataFilePath = path.join(userDataPath, 'session_data.json');

let tray = null;
let mainWindow = null;
let minimizeToTray = false; 

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    backgroundColor: '#020617',
    icon: path.join(__dirname, '../public/app_icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (minimizeToTray && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Auto-updater events
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available');
    // Also show toast if window is hidden/minimized
    if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
      createToastWindow({ name: 'Nueva Actualización v' + info.version, type: 'update' });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded');
    createToastWindow({ name: 'Actualización Lista v' + info.version, type: 'update', downloaded: true });
  });

  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('checking-for-update');
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-not-available');
  });

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update-error', err.message);
  });

  // Periodic Update Check (Every 2 hours)
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 1000 * 60 * 60 * 2);
  
  // Initial check on launch
  autoUpdater.checkForUpdatesAndNotify();
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../public/app_icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    
    tray = new Tray(icon);
    tray.setToolTip('Tracker de Horas - LYNX');
    
    // Initial simple menu
    updateTrayMenu([]);

    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (err) {
    console.error('Tray error:', err);
  }
}

function updateTrayMenu(clients = [], activeSession = null) {
  if (!tray) return;

  try {
    const safeClients = Array.isArray(clients) ? clients : [];
    const menuTemplate = [
      { label: 'LYNX Tracker de Horas', enabled: false },
      { type: 'separator' },
      { 
        label: mainWindow && mainWindow.isVisible() ? 'Ocultar Ventana' : 'Mostrar Ventana', 
        click: () => {
          if (mainWindow.isVisible()) mainWindow.hide();
          else { mainWindow.show(); mainWindow.focus(); }
        } 
      },
      { type: 'separator' }
    ];

    if (activeSession) {
      menuTemplate.push({
        label: `🔴 DETENER TURNO (${activeSession.clientName})`,
        click: () => {
          mainWindow.webContents.send('tray-action', 'stop-session');
        }
      });
    } else {
      if (safeClients.length > 0) {
        const clientSubmenu = safeClients.map(c => ({
          label: `Iniciar en: ${c.name}`,
          click: () => {
            mainWindow.webContents.send('tray-action', 'start-session', c);
          }
        }));
        menuTemplate.push({ label: '🚀 INICIAR TURNO RÁPIDO', submenu: clientSubmenu });
      }
    }

    menuTemplate.push({ type: 'separator' });
    menuTemplate.push({ label: 'Salir', click: () => { app.isQuitting = true; app.quit(); } });

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    tray.setContextMenu(contextMenu);
  } catch (err) {
    console.error('Error updating tray menu:', err);
    // Fallback to basic menu
    const fallbackMenu = Menu.buildFromTemplate([
      { label: 'LYNX Tracker', enabled: false },
      { label: 'Mostrar Ventana', click: () => mainWindow.show() },
      { label: 'Salir', click: () => app.quit() }
    ]);
    tray.setContextMenu(fallbackMenu);
  }
}



ipcMain.on('sync-tray-data', (event, { clients, activeSession }) => {
  updateTrayMenu(clients, activeSession);
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Windows Controls
ipcMain.on('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.isMaximized() ? win.unmaximize() : win?.maximize();
});
ipcMain.on('window-close', () => {
  const win = BrowserWindow.getFocusedWindow();
  (minimizeToTray && win === mainWindow) ? win.hide() : win?.close();
});

ipcMain.handle('restart-app', () => {
  autoUpdater.quitAndInstall();
});

// Settings Handlers
ipcMain.on('set-minimize-to-tray', (event, value) => { minimizeToTray = value; });
ipcMain.on('update-tray', (event, statusText) => updateTrayMenu(statusText));
ipcMain.handle('set-autostart', (event, autoStart) => {
  try {
    app.setLoginItemSettings({ 
      openAtLogin: autoStart, 
      path: process.execPath,
      args: ['--autostart'] 
    });
    return true;
  } catch (err) {
    console.error('Error setting autostart:', err);
    return false;
  }
});
ipcMain.handle('get-autostart', () => app.getLoginItemSettings().openAtLogin);

// Folder Picker
ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('select-file', async (event, filters) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || []
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('arca-generate-csr', async (event, { cuit, name }) => {
  try {
    if (!cuit) throw new Error('El CUIT es obligatorio para generar el pedido (CSR)');
    
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecciona carpeta para guardar los archivos (.key y .csr)',
      properties: ['openDirectory']
    });

    if (canceled) return { success: false, error: 'Cancelado por el usuario' };
    const folder = filePaths[0];

    // 1. Generate RSA key pair (2048 bits)
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

    // 2. Create CSR
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    csr.setSubject([
      { name: 'commonName', value: name || 'Tracker de Horas' },
      { name: 'serialNumber', value: `CUIT ${cuit.replace(/-/g, '')}` },
      { name: 'organizationName', value: 'LYNX_CONSULTING' }
    ]);
    csr.sign(keys.privateKey);
    const csrPem = forge.pki.certificationRequestToPem(csr);

    // 3. Save files
    const keyPath = path.join(folder, 'privada.key');
    const csrPath = path.join(folder, 'pedido.csr');

    fs.writeFileSync(keyPath, privateKeyPem);
    fs.writeFileSync(csrPath, csrPem);

    return { 
      success: true, 
      folder, 
      keyPath, 
      csrPath,
      msg: '¡Éxito! Archivos privada.key y pedido.csr generados.'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// File Opener
ipcMain.handle('open-file', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
    return { success: true };
  }
  return { success: false, error: 'File not found' };
});

// Data Persistence
ipcMain.handle('save-data', (event, data) => {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-data', () => {
  try {
    return fs.existsSync(dataFilePath) ? JSON.parse(fs.readFileSync(dataFilePath, 'utf8')) : null;
  } catch (error) {
    return null;
  }
});

ipcMain.handle('get-data-path', () => dataFilePath);

// --- ARCA (AFIP) INTEGRATION ---

function getAfipInstance(arcaInfo) {
  const certDir = isDev 
    ? path.join(__dirname, '..', 'certs') 
    : path.join(process.resourcesPath, 'certs');
  
  let certPath = arcaInfo.certPath;
  let keyPath = arcaInfo.keyPath;

  // Auto-detect if not provided or doesn't exist
  if (!certPath || !fs.existsSync(certPath) || !keyPath || !fs.existsSync(keyPath)) {
    if (fs.existsSync(certDir)) {
      const files = fs.readdirSync(certDir);
      certPath = certPath || path.join(certDir, files.find(f => f.endsWith('.crt')) || '');
      keyPath = keyPath || path.join(certDir, files.find(f => f.endsWith('.key')) || '');
    }
  }

  if (!certPath || !keyPath || !fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    throw new Error('No se encontraron los archivos de certificado (.crt) o llave (.key) requeridos.');
  }

  // Ensure tickets directory exists in APPDATA
  const ticketsDir = path.join(userDataPath, 'afip_tickets');
  if (!fs.existsSync(ticketsDir)) {
    fs.mkdirSync(ticketsDir, { recursive: true });
  }

  return new Afip({
    cuit: parseInt(arcaInfo.cuit.replace(/-/g, '')),
    cert: fs.readFileSync(certPath, 'utf8'),
    key: fs.readFileSync(keyPath, 'utf8'),
    production: arcaInfo.productionMode === true,
    ticketPath: ticketsDir
  });
}

// PDF Generation Engine
async function generatePDF(templateData, savePath) {
  return new Promise((resolve, reject) => {
    let pdfWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
    
    // Professional Factura C Template matching AFIP official layout
    const html = `
      <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
            body { font-family: 'Roboto', sans-serif; padding: 20px; color: #000; font-size: 11px; }
            .container { border: 1px solid #000; padding: 10px; }
            .header { border-bottom: 1px solid #000; display: flex; align-items: stretch; min-height: 120px; }
            .header-left { flex: 1; padding: 10px; border-right: 1px solid #000; position: relative; }
            .header-right { flex: 1; padding: 10px; }
            .letter-box { position: absolute; right: -21px; top: -1px; border: 1px solid #000; background: #fff; width: 40px; height: 40px; text-align: center; z-index: 10; font-size: 30px; font-weight: bold; line-height: 40px; }
            .letter-box span { display: block; font-size: 8px; line-height: 10px; }
            
            .emisor-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
            .emisor-info { line-height: 1.4; }
            .invoice-type { font-size: 16px; font-weight: bold; text-align: right; }
            .invoice-nro { font-size: 14px; text-align: right; margin-top: 5px; }
            
            .section-title { background: #eee; padding: 4px 8px; font-weight: bold; border: 1px solid #000; margin-top: 10px; margin-bottom: 0; }
            .client-info { border: 1px solid #000; border-top: none; padding: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #000; }
            th { border: 1px solid #000; background: #eee; padding: 6px; text-align: left; }
            td { border: 1px solid #000; padding: 6px; }
            
            .totals-container { display: flex; justify-content: flex-end; margin-top: 15px; }
            .totals-box { border: 1px solid #000; padding: 10px; min-width: 200px; }
            .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; }
            
            .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #000; padding-top: 10px; }
            .qr-container { display: flex; align-items: center; gap: 10px; }
            .qr-image { width: 80px; height: 80px; }
            .cae-info { text-align: right; line-height: 1.5; font-size: 12px; }
            .cae-label { font-weight: bold; }
            .logo-placeholder { font-weight: bold; color: #000; opacity: 0.8; font-style: italic; font-size: 14px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="header-left">
                <div class="letter-box">${templateData.tipoLetra}<span>Cod. ${templateData.tipoCod}</span></div>
                <div class="logo-placeholder">LYNX CONSULTING</div>
                <div class="emisor-name">${templateData.emisorName}</div>
                <div class="emisor-info">
                  Razon Social: ${templateData.emisorName}<br>
                  Domicilio Comercial: Av. Siempre Viva 123, CABA<br>
                  Condición frente al IVA: <b>Monotributista</b>
                </div>
              </div>
              <div class="header-right">
                <div class="invoice-type">${templateData.tipoNombre}</div>
                <div class="invoice-nro">Punto de Venta: ${templateData.pv.toString().padStart(5, '0')} Comp. Nro: ${templateData.nro.toString().padStart(8, '0')}</div>
                <div style="margin-top: 10px">
                  Fecha de Emisión: <b>${templateData.fecha}</b><br>
                  CUIT: <b>${templateData.emisorCuit}</b><br>
                  Ingresos Brutos: <b>${templateData.emisorCuit}</b><br>
                  Inicio de Actividades: <b>01/01/2020</b>
                </div>
              </div>
            </div>

            <div class="section-title">DATOS DEL RECEPTOR</div>
            <div class="client-info">
              <div>
                CUIT/DNI: <b>${templateData.clienteCuit}</b><br>
                Nombre/Razón Social: <b>${templateData.clienteName}</b>
              </div>
              <div>
                Condición IVA: <b>Consumidor Final</b><br>
                Domicilio: <b>${templateData.clienteDom}</b>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Cod.</th>
                  <th>Descripción / Producto / Servicio</th>
                  <th style="text-align: right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>${templateData.concepto}</td>
                  <td style="text-align: right">$ ${templateData.monto.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                </tr>
              </tbody>
            </table>

            <div class="totals-container">
              <div class="totals-box">
                <div class="total-row">
                  <span>Importe Neto No Gravado:</span>
                  <span>$ 0.00</span>
                </div>
                <div class="total-row">
                  <span>Importe Exento:</span>
                  <span>$ 0.00</span>
                </div>
                <div class="total-row" style="border-top: 1px solid #000; margin-top: 5px; padding-top: 5px; font-size: 16px;">
                  <span>TOTAL:</span>
                  <span>$ ${templateData.monto.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                </div>
              </div>
            </div>

            <div class="footer">
              <div class="qr-container">
                <img class="qr-image" src="${templateData.qrBase64}">
                <div style="font-size: 8px; color: #555;">
                  Comprobante Autorizado por AFIP (ARCA)<br>
                  Este PDF ha sido generado por LYNX_OS v2.7
                </div>
              </div>
              <div class="cae-info">
                <span class="cae-label">CAE:</span> ${templateData.cae}<br>
                <span class="cae-label">Fecha Vto. CAE:</span> ${templateData.caeVe}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    pdfWindow.webContents.on('did-finish-load', () => {
      pdfWindow.webContents.printToPDF({ marginsType: 1, printBackground: true, pageSize: 'A4' }).then(data => {
        fs.writeFileSync(savePath, data);
        pdfWindow.close();
        resolve(savePath);
      }).catch(err => {
        pdfWindow.close();
        reject(err);
      });
    });
  });
}

ipcMain.handle('arca-test-connection', async (event, settings) => {
  try {
    const afip = getAfipInstance(settings.arcaInfo);
    const status = await afip.electronicBillingService.getServerStatus();
    
    // Check if services are UP
    const result = status.FEDummyResult || status;
    if (result && result.AppServer === 'OK') {
      return { success: true, status: result };
    } else {
      return { 
        success: false, 
        error: 'El servidor de AFIP reporta problemas.', 
        status,
        detailed: JSON.stringify(status, null, 2)
      };
    }
  } catch (error) {
    console.error('ARCA Test Connection Error:', error);
    
    // Extract detailed error info for the diagnostic modal
    const detailedError = {
      message: error.message || 'Error desconocido',
      stack: error.stack,
      code: error.code,
      fault: error.fault // SOAP libraries often provide 'fault'
    };
    
    return { 
      success: false, 
      error: error.message || 'Error al conectar con ARCA/AFIP.',
      detailed: JSON.stringify(detailedError, null, 2)
    };
  }
});

ipcMain.handle('get-public-ip', async () => {
  return new Promise((resolve) => {
    https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ success: true, ip: JSON.parse(data).ip });
        } catch (e) {
          resolve({ success: false, error: 'Error parseando IP' });
        }
      });
    }).on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

ipcMain.handle('get-arca-invoice-info', async (event, { settings, number, pv, type }) => {
  try {
    const afip = getAfipInstance(settings.arcaInfo);
    const info = await afip.electronicBillingService.getVoucherInfo(number, pv, type);
    return { success: true, info };
  } catch (error) {
    console.error('ARCA Get Invoice Info Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-version', () => app.getVersion());

// Auto-updater handlers
ipcMain.handle('check-for-updates', () => {
  autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.handle('arca-generate-invoice', async (event, { settings, client, amount, start, end }) => {
  try {
    const afip = getAfipInstance(settings.arcaInfo);
    const pv = settings.arcaInfo.puntoVenta || 2;
    const type = 11; // Factura C (Común para monotributistas)
    
    // Current date in yyyymmdd
    const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '');

    const payload = {
      PtoVta: parseInt(pv),
      CbteTipo: type,
      Concepto: 2, // 2: Servicios
      DocTipo: client.cuit.length > 8 ? 80 : 96, // 80: CUIT, 96: DNI/DNI
      DocNro: parseInt(client.cuit.replace(/-/g, '')),
      CbteFch: parseInt(date),
      ImpTotal: amount,
      ImpTotConc: 0,
      ImpNeto: amount,
      ImpOpEx: 0,
      ImpIVA: 0,
      ImpTrib: 0,
      MonId: 'PES',
      MonCotiz: 1,
      FchServDesde: parseInt(start.replace(/-/g, '').substring(0, 8)),
      FchServHasta: parseInt(end.replace(/-/g, '').substring(0, 8)),
      FchVtoPago: parseInt(date)
    };

    const res = await afip.electronicBillingService.createNextInvoice(payload);
    
    if (res && res.cae) {
      // 1. Prepare QR Data for AFIP (Official JSON Format)
      const qrData = {
        ver: 1,
        fecha: date.substring(0,4) + '-' + date.substring(4,6) + '-' + date.substring(6,8),
        cuit: parseInt(settings.arcaInfo.cuit.replace(/-/g, '')),
        ptoVta: parseInt(pv),
        tipoCmp: type,
        nroCmp: nro,
        importe: amount,
        moneda: "PES",
        ctz: 1,
        tipoDocRec: client.cuit.length > 8 ? 80 : 96,
        nroDocRec: parseInt(client.cuit.replace(/-/g, '')),
        tipoCodAut: "E",
        codAut: parseInt(res.cae)
      };
      
      const qrUrl = 'https://www.afip.gob.ar/fe/qr/?p=' + Buffer.from(JSON.stringify(qrData)).toString('base64');
      const qrBase64 = await QRCode.toDataURL(qrUrl);

      // 2. Generate PDF
      const folder = settings.invoicePath || path.join(userDataPath, 'facturas');
      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
      
      const fileName = `Factura_${nro}_${date}.pdf`;
      const fullPath = path.join(folder, fileName);

      await generatePDF({
        tipoLetra: 'C', tipoCod: type.toString(), tipoNombre: 'FACTURA C',
        emisorName: 'Ignacio Valente', emisorCuit: settings.arcaInfo.cuit,
        clienteName: client.razonSocial, clienteCuit: client.cuit, clienteDom: client.domicilio,
        pv, nro: nro, fecha: new Date().toLocaleDateString('es-AR'),
        concepto: `Servicios de Consultoría - Período ${new Date(start).toLocaleDateString('es-AR')} al ${new Date(end).toLocaleDateString('es-AR')}`,
        monto: amount, cae: res.cae, caeVe: res.caeFchVto, qrBase64
      }, fullPath);

      return { success: true, cae: res.cae, numero: nro, filePath: fullPath };
    } else {
      let errorMsg = 'No se recibió el CAE de AFIP.';
      if (res && res.response && res.response.Errors) {
        const errors = Array.isArray(res.response.Errors.Err) 
          ? res.response.Errors.Err.map(e => `[${e.Code}] ${e.Msg}`).join('\n')
          : `[${res.response.Errors.Err.Code}] ${res.response.Errors.Err.Msg}`;
        errorMsg += '\nErrores de AFIP:\n' + errors;
      }
      // Check observations
      try {
        const detResp = res.response.FeDetResp.FECAEDetResponse[0];
        if (detResp && detResp.Observaciones) {
           const obs = Array.isArray(detResp.Observaciones.Obs)
            ? detResp.Observaciones.Obs.map(o => `[${o.Code}] ${o.Msg}`).join('\n')
            : `[${detResp.Observaciones.Obs.Code}] ${detResp.Observaciones.Obs.Msg}`;
           errorMsg += '\nObservaciones:\n' + obs;
        }
      } catch(e) {}
      
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error('ARCA Invoice Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('arca-generate-credit-note', async (event, { settings, invoice, client }) => {
  try {
    const afip = getAfipInstance(settings.arcaInfo);
    const pv = settings.arcaInfo.puntoVenta || 2;
    const type = 13; // Nota de Crédito C
    
    const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '');

    // Dates for services
    const startS = invoice.serviceStart ? invoice.serviceStart.replace(/-/g, '').split('T')[0] : date;
    const endS = invoice.serviceEnd ? invoice.serviceEnd.replace(/-/g, '').split('T')[0] : date;

    const payload = {
      PtoVta: parseInt(pv),
      CbteTipo: type,
      Concepto: 2,
      DocTipo: client.cuit.length > 8 ? 80 : 96,
      DocNro: parseInt(client.cuit.replace(/-/g, '')),
      CbteFch: parseInt(date),
      ImpTotal: parseFloat(invoice.totalAmount.toFixed(2)),
      ImpTotConc: 0,
      ImpNeto: parseFloat(invoice.totalAmount.toFixed(2)),
      ImpOpEx: 0,
      ImpIVA: 0,
      ImpTrib: 0,
      FchServDesde: parseInt(startS),
      FchServHasta: parseInt(endS),
      FchVtoPago: parseInt(date),
      MonId: 'PES',
      MonCotiz: 1,
      CbtesAsoc: [{
        Tipo: 11, // Factura C asociada
        PtoVta: parseInt(pv),
        Nro: invoice.invoiceNumber
      }]
    };

    const res = await afip.electronicBillingService.createNextInvoice(payload);
    
    if (res && res.cae) {
      const nro = res.response.FeDetResp.FECAEDetResponse[0].CbteHasta;
      
      // 1. Prepare QR Data for AFIP (Official JSON Format)
      const qrData = {
        ver: 1,
        fecha: date.substring(0,4) + '-' + date.substring(4,6) + '-' + date.substring(6,8),
        cuit: parseInt(settings.arcaInfo.cuit.replace(/-/g, '')),
        ptoVta: parseInt(pv),
        tipoCmp: type,
        nroCmp: nro,
        importe: invoice.totalAmount,
        moneda: "PES",
        ctz: 1,
        tipoDocRec: client.cuit.length > 8 ? 80 : 96,
        nroDocRec: parseInt(client.cuit.replace(/-/g, '')),
        tipoCodAut: "E",
        codAut: parseInt(res.cae)
      };
      
      const qrUrl = 'https://www.afip.gob.ar/fe/qr/?p=' + Buffer.from(JSON.stringify(qrData)).toString('base64');
      const qrBase64 = await QRCode.toDataURL(qrUrl);

      // 2. Generate PDF for Credit Note
      const folder = settings.invoicePath || path.join(userDataPath, 'facturas');
      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
      
      const fileName = `Nota_Credito_${nro}_${date}.pdf`;
      const fullPath = path.join(folder, fileName);

      await generatePDF({
        tipoLetra: 'C', tipoCod: type.toString(), tipoNombre: 'NOTA DE CRÉDITO C',
        emisorName: 'Ignacio Valente', emisorCuit: settings.arcaInfo.cuit,
        clienteName: client.razonSocial, clienteCuit: client.cuit, clienteDom: client.domicilio,
        pv, nro: nro, fecha: new Date().toLocaleDateString('es-AR'),
        concepto: `Anulación de Factura C Nro ${invoice.invoiceNumber}`,
        monto: invoice.totalAmount, cae: res.cae, caeVe: res.caeFchVto, qrBase64
      }, fullPath);

      return { success: true, cae: res.cae, numero: nro, filePath: fullPath };
    } else {
      let errorMsg = 'No se recibió el CAE de la Nota de Crédito.';
      if (res && res.response && res.response.Errors) {
        const errors = Array.isArray(res.response.Errors.Err) 
          ? res.response.Errors.Err.map(e => `[${e.Code}] ${e.Msg}`).join('\n')
          : `[${res.response.Errors.Err.Code}] ${res.response.Errors.Err.Msg}`;
        errorMsg += '\nErrores de AFIP:\n' + errors;
      }
      // Check observations
      try {
        const detResp = res.response.FeDetResp.FECAEDetResponse[0];
        if (detResp && detResp.Observaciones) {
           const obs = Array.isArray(detResp.Observaciones.Obs)
            ? detResp.Observaciones.Obs.map(o => `[${o.Code}] ${o.Msg}`).join('\n')
            : `[${detResp.Observaciones.Obs.Code}] ${detResp.Observaciones.Obs.Msg}`;
           errorMsg += '\nObservaciones:\n' + obs;
        }
      } catch(e) {}
      
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error('ARCA Credit Note Error:', error);
    return { success: false, error: error.message };
  }
});

// --- BACKGROUND ZONE MONITORING & TOAST NOTIFICATIONS ---

let monitoringClients = [];
let lastMonitoredIp = null;
let toastWindow = null;

ipcMain.on('sync-monitoring-data', (event, { clients }) => {
  monitoringClients = clients || [];
});

function createToastWindow(client) {
  if (toastWindow) return; // Only one toast at a time

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const toastWidth = 400;
  const toastHeight = 160;
  const x = width - toastWidth - 20;
  const y = height - toastHeight - 20;

  toastWindow = new BrowserWindow({
    width: toastWidth,
    height: toastHeight,
    x, y,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    },
  });

  const toastParams = `view=toast&client=${encodeURIComponent(JSON.stringify(client))}`;
  if (isDev) {
    toastWindow.loadURL(`http://localhost:5173?${toastParams}`);
  } else {
    toastWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { view: 'toast', client: JSON.stringify(client) } });
  }

  toastWindow.on('closed', () => {
    toastWindow = null;
  });
}

ipcMain.on('close-toast', () => {
  if (toastWindow) toastWindow.close();
});

ipcMain.on('toast-action-start', (event, client) => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('start-session-from-toast', client);
  }
  if (toastWindow) toastWindow.close();
});

setInterval(async () => {
  if (!monitoringClients.length) return;

  try {
    const res = await new Promise((resolve) => {
      https.get('https://api.ipify.org?format=json', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ success: true, ip: JSON.parse(data).ip }); } catch (e) { resolve({ success: false }); }
        });
      }).on('error', () => resolve({ success: false }));
    });

    if (res.success) {
      const matchingClient = monitoringClients.find(c => c.workIp === res.ip);
      
      // If we found a match and it's a NEW detection (or reset)
      if (matchingClient && res.ip !== lastMonitoredIp) {
        lastMonitoredIp = res.ip;
        // Only show toast if main window is NOT active/focused
        if (!mainWindow || !mainWindow.isVisible() || mainWindow.isMinimized()) {
          createToastWindow(matchingClient);
        }
      } else if (!matchingClient) {
        lastMonitoredIp = null; // Reset if we leave the zone
      }
    }
  } catch (e) {
    console.error('Background monitoring error:', e);
  }
}, 60000); // Check every minute

