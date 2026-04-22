const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow, widgetWindow, tray;
const configPath = path.join(app.getPath('userData'), 'widget-pos.json');

function loadWidgetPos() {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { return null; }
}

function saveWidgetPos(x, y) {
  try { fs.writeFileSync(configPath, JSON.stringify({ x, y })); } catch {}
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'Finanze Personali',
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.cjs') }
  });
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => { mainWindow.maximize(); mainWindow.show(); });
  // Quando si chiude la finestra principale, nascondila invece di distruggerla
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
    updateTrayMenu();
  });
}

function createWidget() {
  const saved = loadWidgetPos();
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
  const x = saved ? saved.x : sw - 260;
  const y = saved ? saved.y : 20;

  widgetWindow = new BrowserWindow({
    width: 250,
    height: 520,
    x, y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.cjs') }
  });

  widgetWindow.loadFile(path.join(__dirname, 'widget.html'));
  widgetWindow.on('moved', () => {
    const [wx, wy] = widgetWindow.getPosition();
    saveWidgetPos(wx, wy);
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const widgetVisible = widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible();
  const appVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
  const menu = Menu.buildFromTemplate([
    {
      label: widgetVisible ? 'Nascondi widget' : 'Mostra widget',
      click: () => {
        if (!widgetWindow || widgetWindow.isDestroyed()) return;
        widgetVisible ? widgetWindow.hide() : widgetWindow.show();
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: appVisible ? 'Nascondi app' : 'Apri app',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) { createMainWindow(); return; }
        if (mainWindow.isVisible()) { mainWindow.hide(); }
        else { mainWindow.show(); mainWindow.focus(); mainWindow.maximize(); }
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    { label: 'Esci', click: () => { mainWindow.removeAllListeners('close'); app.quit(); } }
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  // Icona 16x16 blu con €
  const size = 16;
  const canvas = nativeImage.createEmpty();
  
  // Usa l'icona dell'app come tray icon
  const iconPath = path.join(__dirname, 'public', 'apple-touch-icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty');
    icon = icon.resize({ width: 16, height: 16 });
  } catch {
    // Fallback: icona colorata generata
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAwklEQVQ4T2NkIAIwEqmHgXQDZs+e/X9WZub/GVOnMpADfv36xXD37l2Gf//+MYSEhDB4eXkxkGqAiooKg7CwMAMjIyNDcHAwgpGRkcHV1RUhh9VA0AA3NzcGDw8PBg8PDwZ3d3cGNzc3Bk9PTwZvb28GHx8fBl9fXwZ/f3+GgIAAhsDAwP8MDg4OhsTERITc5ORkhLCwsP8hISEIYWFh/0NCQhDCwsL+h4SEIISFhf0PDQ1FCAsL+x8aGoowICzsf1hYGEJ/WBgAxDI0sZRmX5MAAAAASUVORK5CYII='
    );
  }

  tray = new Tray(icon);
  tray.setToolTip('Finanze Personali');
  updateTrayMenu();

  tray.on('click', () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    if (widgetWindow.isVisible()) widgetWindow.hide();
    else widgetWindow.show();
    updateTrayMenu();
  });
}

app.whenReady().then(() => {
  createMainWindow();
  createWidget();
  createTray();
});

ipcMain.on('close-widget', () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.hide();
    updateTrayMenu();
  }
});

// Impedisce la chiusura dell'app quando tutte le finestre sono nascoste
app.on('window-all-closed', () => {});