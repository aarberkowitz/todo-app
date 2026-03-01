import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDB } from './db.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { createAppMenu } from './menu.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable GPU acceleration on environments without GPU support (e.g. WSL2)
app.disableHardwareAcceleration();

let mainWindow;

async function createWindow() {
  const settings = await getWindowSettings();

  mainWindow = new BrowserWindow({
    width: settings.width || 1200,
    height: settings.height || 800,
    x: settings.x,
    y: settings.y,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    const bounds = mainWindow.getBounds();
    initDB().then(({ db }) => {
      db.data.settings.windowBounds = bounds;
      return db.write();
    }).finally(() => {
      mainWindow.destroy();
    });
  });

  createAppMenu(mainWindow);
}

async function getWindowSettings() {
  const { db } = await initDB();
  return db.data.settings.windowBounds || {};
}

app.whenReady().then(async () => {
  await initDB();
  registerIpcHandlers();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
