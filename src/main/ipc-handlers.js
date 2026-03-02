import { ipcMain } from 'electron';
import {
  getLists, createList, renameList, deleteList,
  getTasksForList, getTasksByFilter, createTask, updateTask, deleteTask,
  getScheduledTasksForDate, getUnscheduledTasks,
  getSubtasks, getTask,
  getSettings, updateSettings,
} from './db.js';
import { exportData, importData } from './export-import.js';

export function registerIpcHandlers() {
  // Lists
  ipcMain.handle('lists:get', () => getLists());
  ipcMain.handle('lists:create', (_e, name) => createList(name));
  ipcMain.handle('lists:rename', (_e, id, name) => renameList(id, name));
  ipcMain.handle('lists:delete', (_e, id) => deleteList(id));

  // Tasks
  ipcMain.handle('tasks:getForList', (_e, listId) => getTasksForList(listId));
  ipcMain.handle('tasks:getByFilter', (_e, filter) => getTasksByFilter(filter));
  ipcMain.handle('tasks:create', (_e, listId, title, parentTaskId) => createTask(listId, title, parentTaskId));
  ipcMain.handle('tasks:update', (_e, id, changes) => updateTask(id, changes));
  ipcMain.handle('tasks:delete', (_e, id) => deleteTask(id));
  ipcMain.handle('tasks:getSubtasks', (_e, parentTaskId) => getSubtasks(parentTaskId));
  ipcMain.handle('tasks:get', (_e, id) => getTask(id));
  ipcMain.handle('tasks:getScheduledForDate', (_e, date) => getScheduledTasksForDate(date));
  ipcMain.handle('tasks:getUnscheduled', () => getUnscheduledTasks());

  // Export/Import
  ipcMain.handle('data:export', (_e) => exportData());
  ipcMain.handle('data:import', (_e) => importData());

  // Settings
  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:update', (_e, changes) => updateSettings(changes));
}
