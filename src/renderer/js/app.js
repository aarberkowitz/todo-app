import { initSidebar, refresh as refreshSidebar } from './sidebar.js';
import { initTaskList } from './tasklist.js';
import { initDetailPanel } from './detail-panel.js';
import { initDialog, initRenameDialog } from './dialog.js';
import * as state from './state.js';
import * as bus from './event-bus.js';

async function init() {
  // Init dialogs
  initDialog();
  initRenameDialog();

  // Init modules
  await initSidebar();
  initTaskList();
  initDetailPanel();

  // Restore last view
  const settings = await window.api.getSettings();
  if (settings.lastSelectedListId) {
    state.setView('list', settings.lastSelectedListId);
  } else {
    state.setView('filter', 'my-day');
  }

  // Save selected view to settings when it changes
  bus.on('view-changed', async ({ type, id }) => {
    if (type === 'list') {
      await window.api.updateSettings({ lastSelectedListId: id });
    } else {
      await window.api.updateSettings({ lastSelectedListId: null });
    }
  });

  // Handle data import from main process
  window.api.onDataImported(async () => {
    await refreshSidebar();
    state.setView('filter', 'my-day');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape closes detail panel
    if (e.key === 'Escape') {
      state.clearSelectedTask();
    }

    // Ctrl+N / Cmd+N focuses add task input
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      const input = document.getElementById('add-task-input');
      if (input && input.offsetParent !== null) {
        input.focus();
      }
    }

    // Delete key deletes selected task (only when not in an input)
    if (e.key === 'Delete' && !isInputFocused()) {
      const taskId = state.getSelectedTaskId();
      if (taskId) {
        bus.emit('delete-selected-task', taskId);
      }
    }
  });

  // Handle delete shortcut
  bus.on('delete-selected-task', async (taskId) => {
    const { showConfirm } = await import('./dialog.js');
    const confirmed = await showConfirm('Delete this task? This cannot be undone.');
    if (confirmed) {
      await window.api.deleteTask(taskId);
      state.clearSelectedTask();
      bus.emit('tasks-changed');
    }
  });
}

function isInputFocused() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable;
}

init();
