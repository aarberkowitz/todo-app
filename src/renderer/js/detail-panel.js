import { $, todayString } from './utils.js';
import * as bus from './event-bus.js';
import * as state from './state.js';
import { showConfirm } from './dialog.js';

let currentTask = null;
let saveTimeout = null;

export function initDetailPanel() {
  bus.on('task-selected', onTaskSelected);

  // Close button
  $('#detail-close').addEventListener('click', () => {
    state.clearSelectedTask();
  });

  // Title change
  $('#detail-title').addEventListener('input', () => scheduleSave());
  $('#detail-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
  });

  // Due date
  $('#detail-due-date').addEventListener('change', () => scheduleSave());

  // Priority
  $('#detail-priority').addEventListener('change', () => scheduleSave());

  // Notes
  $('#detail-notes').addEventListener('input', () => scheduleSave());

  // My Day toggle
  $('#detail-myday').addEventListener('click', async () => {
    if (!currentTask) return;
    const today = todayString();
    const isMyDay = currentTask.myDay === today;
    await window.api.updateTask(currentTask.id, { myDay: isMyDay ? null : today });
    currentTask.myDay = isMyDay ? null : today;
    updateMyDayButton();
    bus.emit('tasks-changed');
  });

  // Delete
  $('#detail-delete').addEventListener('click', async () => {
    if (!currentTask) return;

    let message = `Delete "${currentTask.title}"? This cannot be undone.`;

    // Check for subtasks if this is a top-level task
    if (!currentTask.parentTaskId) {
      const subtasks = await window.api.getSubtasks(currentTask.id);
      if (subtasks.length > 0) {
        message = `Delete "${currentTask.title}" and its ${subtasks.length} subtask${subtasks.length !== 1 ? 's' : ''}? This cannot be undone.`;
      }
    }

    const confirmed = await showConfirm(message);
    if (confirmed) {
      await window.api.deleteTask(currentTask.id);
      state.clearSelectedTask();
      bus.emit('tasks-changed');
    }
  });
}

async function onTaskSelected(taskId) {
  const panel = $('#detail-panel');

  if (!taskId) {
    panel.style.display = 'none';
    currentTask = null;
    return;
  }

  // Fetch the latest task data
  const view = state.getView();
  let tasks;
  if (view.type === 'list') {
    tasks = await window.api.getTasksForList(view.id);
  } else {
    tasks = await window.api.getTasksByFilter(view.id);
  }

  currentTask = tasks.find((t) => t.id === taskId);

  // Fallback: task not in current view's list (e.g. subtask selected from calendar)
  if (!currentTask) {
    currentTask = await window.api.getTask(taskId);
  }

  if (!currentTask) {
    panel.style.display = 'none';
    return;
  }

  await populatePanel();
  panel.style.display = 'flex';
}

async function populatePanel() {
  if (!currentTask) return;

  // Parent info
  const parentInfoEl = $('#detail-parent-info');
  if (currentTask.parentTaskId) {
    const parent = await window.api.getTask(currentTask.parentTaskId);
    if (parent) {
      parentInfoEl.textContent = `Subtask of: ${parent.title}`;
      parentInfoEl.style.display = 'block';
    } else {
      parentInfoEl.style.display = 'none';
    }
  } else {
    parentInfoEl.style.display = 'none';
  }

  $('#detail-title').value = currentTask.title;
  $('#detail-due-date').value = currentTask.dueDate || '';
  $('#detail-priority').value = currentTask.priority;
  $('#detail-notes').value = currentTask.notes || '';
  updateMyDayButton();
}

function updateMyDayButton() {
  const btn = $('#detail-myday');
  const label = $('#detail-myday-label');
  const today = todayString();
  const isMyDay = currentTask && currentTask.myDay === today;
  btn.classList.toggle('active', isMyDay);
  label.textContent = isMyDay ? 'Added to My Day' : 'Add to My Day';
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveChanges, 400);
}

async function saveChanges() {
  if (!currentTask) return;

  const title = $('#detail-title').value.trim();
  if (!title) return;

  const changes = {
    title,
    dueDate: $('#detail-due-date').value || null,
    priority: $('#detail-priority').value,
    notes: $('#detail-notes').value,
  };

  await window.api.updateTask(currentTask.id, changes);
  Object.assign(currentTask, changes);
  bus.emit('tasks-changed');
}
