import { dialog, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import { getDB } from './db.js';

export async function exportData() {
  const win = BrowserWindow.getFocusedWindow();
  const today = new Date().toISOString().split('T')[0];

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export To-Do Data',
    defaultPath: `todo-backup-${today}.json`,
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
  });

  if (canceled || !filePath) return { success: false, canceled: true };

  const db = await getDB();
  const exportObj = {
    lists: db.data.lists,
    tasks: db.data.tasks,
    settings: { lastSelectedListId: db.data.settings.lastSelectedListId },
  };

  await fs.writeFile(filePath, JSON.stringify(exportObj, null, 2), 'utf-8');
  return { success: true, filePath };
}

export async function importData() {
  const win = BrowserWindow.getFocusedWindow();

  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import To-Do Data',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (canceled || filePaths.length === 0) return { success: false, canceled: true };

  const raw = await fs.readFile(filePaths[0], 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { success: false, error: 'Invalid JSON file.' };
  }

  const validation = validateImportData(data);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Cancel', 'Replace All Data'],
    defaultId: 0,
    cancelId: 0,
    title: 'Import Data',
    message: 'This will replace all your current lists and tasks. Continue?',
  });

  if (response === 0) return { success: false, canceled: true };

  const db = await getDB();
  db.data.lists = data.lists;
  db.data.tasks = data.tasks;
  if (data.settings?.lastSelectedListId !== undefined) {
    db.data.settings.lastSelectedListId = data.settings.lastSelectedListId;
  }
  await db.write();

  // Notify renderer
  win.webContents.send('data:imported');

  return { success: true };
}

function validateImportData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'File does not contain a valid object.' };
  }
  if (!Array.isArray(data.lists)) {
    return { valid: false, error: 'Missing or invalid "lists" array.' };
  }
  if (!Array.isArray(data.tasks)) {
    return { valid: false, error: 'Missing or invalid "tasks" array.' };
  }

  const listIds = new Set(data.lists.map((l) => l.id));

  for (const list of data.lists) {
    if (!list.id || !list.name) {
      return { valid: false, error: 'Each list must have an "id" and "name".' };
    }
  }

  for (const task of data.tasks) {
    if (!task.id || !task.listId || !task.title) {
      return { valid: false, error: 'Each task must have "id", "listId", and "title".' };
    }
    if (!listIds.has(task.listId)) {
      return { valid: false, error: `Task "${task.title}" references non-existent list "${task.listId}".` };
    }
  }

  return { valid: true };
}
