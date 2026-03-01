const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Lists
  getLists: () => ipcRenderer.invoke('lists:get'),
  createList: (name) => ipcRenderer.invoke('lists:create', name),
  renameList: (id, name) => ipcRenderer.invoke('lists:rename', id, name),
  deleteList: (id) => ipcRenderer.invoke('lists:delete', id),

  // Tasks
  getTasksForList: (listId) => ipcRenderer.invoke('tasks:getForList', listId),
  getTasksByFilter: (filter) => ipcRenderer.invoke('tasks:getByFilter', filter),
  createTask: (listId, title) => ipcRenderer.invoke('tasks:create', listId, title),
  updateTask: (id, changes) => ipcRenderer.invoke('tasks:update', id, changes),
  deleteTask: (id) => ipcRenderer.invoke('tasks:delete', id),

  // Export/Import
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (changes) => ipcRenderer.invoke('settings:update', changes),

  // Events from main
  onDataImported: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('data:imported', handler);
    return () => ipcRenderer.removeListener('data:imported', handler);
  },
});
