import { initSidebar, refresh as refreshSidebar } from './sidebar.js';
import { initTaskList } from './tasklist.js';
import { initDetailPanel } from './detail-panel.js';
import { initDialog, initRenameDialog } from './dialog.js';
import { initCalendar } from './calendar.js';
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
  initCalendar();

  // Restore last view
  const settings = await window.api.getSettings();
  const lists = await window.api.getLists();

  if (settings.lastViewType === 'calendar') {
    state.setView('calendar', new Date().toISOString().split('T')[0]);
  } else if (settings.lastSelectedListId && lists.some(l => l.id === settings.lastSelectedListId)) {
    state.setView('list', settings.lastSelectedListId);
  } else if (lists.length > 0) {
    state.setView('list', lists[0].id);
  } else {
    state.setView('filter', 'my-day');
  }

  // Toggle visibility and save settings when view changes
  const taskPanel = document.getElementById('task-panel');
  const detailPanel = document.getElementById('detail-panel');
  const calendarView = document.getElementById('calendar-view');

  bus.on('view-changed', async ({ type, id }) => {
    if (type === 'calendar') {
      taskPanel.style.display = 'none';
      detailPanel.style.display = 'none';
      calendarView.style.display = 'flex';
      await window.api.updateSettings({ lastSelectedListId: null, lastViewType: 'calendar' });
    } else {
      calendarView.style.display = 'none';
      taskPanel.style.display = '';
      if (type === 'list') {
        await window.api.updateSettings({ lastSelectedListId: id, lastViewType: 'list' });
      } else {
        await window.api.updateSettings({ lastSelectedListId: null, lastViewType: 'filter' });
      }
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

    let message = 'Delete this task? This cannot be undone.';
    const subtasks = await window.api.getSubtasks(taskId);
    if (subtasks.length > 0) {
      message = `Delete this task and its ${subtasks.length} subtask${subtasks.length !== 1 ? 's' : ''}? This cannot be undone.`;
    }

    const confirmed = await showConfirm(message);
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
