import { $, createElement } from './utils.js';
import * as bus from './event-bus.js';
import * as state from './state.js';
import { getListName } from './sidebar.js';
import { initCalendarDnD } from './calendar-dnd.js';

// Time grid constants
const SLOT_HEIGHT = 40; // px per 30-min slot
const START_HOUR = 6;   // 6:00 AM
const END_HOUR = 23;    // 11:00 PM (last slot is 11:00 PM)
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2; // 34 half-hour slots

let currentDate = null; // 'YYYY-MM-DD'

export function initCalendar() {
  // Navigation events
  $('#calendar-prev').addEventListener('click', () => navigateDay(-1));
  $('#calendar-next').addEventListener('click', () => navigateDay(1));
  $('#calendar-today').addEventListener('click', () => goToDate(todayStr()));
  $('#calendar-date-picker').addEventListener('change', (e) => {
    if (e.target.value) goToDate(e.target.value);
  });

  // Listen for view/data changes
  bus.on('view-changed', ({ type, id }) => {
    if (type === 'calendar') {
      currentDate = id || todayStr();
      renderCalendar();
    }
  });

  bus.on('tasks-changed', () => {
    const view = state.getView();
    if (view.type === 'calendar') {
      renderCalendar();
    }
  });

  // Initialize drag-and-drop
  initCalendarDnD();
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function navigateDay(offset) {
  const d = new Date(currentDate + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  const newDate = d.toISOString().split('T')[0];
  currentDate = newDate;
  state.setView('calendar', newDate);
}

function goToDate(dateStr) {
  currentDate = dateStr;
  state.setView('calendar', dateStr);
}

async function renderCalendar() {
  if (!currentDate) return;

  updateNavLabel();
  renderTimeGrid();
  await renderScheduledTasks();
  await renderUnscheduledSidebar();
  updateCurrentTimeIndicator();
  autoScrollToNow();
}

function updateNavLabel() {
  const d = new Date(currentDate + 'T00:00:00');
  const label = d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  $('#calendar-date-label').textContent = label;
  $('#calendar-date-picker').value = currentDate;
}

function renderTimeGrid() {
  const grid = $('#calendar-grid');

  // Preserve task blocks if already built, otherwise build from scratch
  // Remove old slots and indicators only
  const existingBlocks = grid.querySelectorAll('.calendar-task-block');
  grid.innerHTML = '';

  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const totalMinutes = (START_HOUR * 60) + (i * 30);
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const isHourStart = minute === 0;

    const slot = createElement('div', {
      className: `calendar-slot${isHourStart ? ' hour-start' : ''}`,
      dataset: {
        slotIndex: String(i),
        slotTime: formatTime24(hour, minute),
      },
    });

    // Only show label on the hour
    if (isHourStart) {
      const label = createElement('span', { className: 'slot-label' }, [
        formatTime12(hour, minute),
      ]);
      slot.appendChild(label);
    }

    grid.appendChild(slot);
  }
}

async function renderScheduledTasks() {
  const grid = $('#calendar-grid');

  // Remove existing task blocks
  for (const block of grid.querySelectorAll('.calendar-task-block')) {
    block.remove();
  }

  // Remove existing time indicator
  const existingIndicator = grid.querySelector('.calendar-time-indicator');
  if (existingIndicator) existingIndicator.remove();

  const tasks = await window.api.getScheduledTasksForDate(currentDate);

  for (const task of tasks) {
    const top = timeToPixels(task.scheduledTime);
    const height = durationToPixels(task.scheduledDuration || 30);
    const endTime = addMinutes(task.scheduledTime, task.scheduledDuration || 30);
    const projectName = getListName(task.listId);

    const block = createElement('div', {
      className: 'calendar-task-block',
      dataset: { taskId: task.id },
      draggable: 'true',
    });

    block.style.top = `${top}px`;
    block.style.height = `${height}px`;

    const titleEl = createElement('div', { className: 'block-title' }, [task.title]);
    block.appendChild(titleEl);

    // Show parent name for subtasks, project name as fallback
    if (task.parentTaskId) {
      const parent = await window.api.getTask(task.parentTaskId);
      if (parent) {
        block.appendChild(createElement('div', { className: 'block-parent' }, [parent.title]));
      }
    }
    if (projectName) {
      block.appendChild(createElement('div', { className: 'block-project' }, [projectName]));
    }

    block.appendChild(createElement('div', { className: 'block-time' }, [
      `${formatTime12FromStr(task.scheduledTime)} - ${formatTime12FromStr(endTime)}`,
    ]));

    // Resize handle
    block.appendChild(createElement('div', { className: 'resize-handle' }));

    grid.appendChild(block);
  }
}

async function renderUnscheduledSidebar() {
  const list = $('#calendar-unscheduled-list');
  list.innerHTML = '';

  const tasks = await window.api.getUnscheduledTasks();

  if (tasks.length === 0) {
    list.appendChild(createElement('div', { className: 'calendar-unscheduled-empty' }, [
      'No unscheduled tasks',
    ]));
    return;
  }

  for (const task of tasks) {
    const projectName = getListName(task.listId);
    const item = createElement('div', {
      className: 'calendar-unscheduled-item',
      dataset: { taskId: task.id },
      draggable: 'true',
    });

    item.appendChild(createElement('div', { className: 'item-title' }, [task.title]));

    // Show parent name for subtasks
    if (task.parentTaskId) {
      const parent = await window.api.getTask(task.parentTaskId);
      if (parent) {
        item.appendChild(createElement('div', { className: 'item-parent' }, [parent.title]));
      }
    }
    if (projectName) {
      item.appendChild(createElement('div', { className: 'item-project' }, [projectName]));
    }

    list.appendChild(item);
  }
}

function updateCurrentTimeIndicator() {
  const grid = $('#calendar-grid');
  const existing = grid.querySelector('.calendar-time-indicator');
  if (existing) existing.remove();

  // Only show on today
  if (currentDate !== todayStr()) return;

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (hours < START_HOUR || hours >= END_HOUR) return;

  const top = ((hours - START_HOUR) * 60 + minutes) / 30 * SLOT_HEIGHT;
  const indicator = createElement('div', { className: 'calendar-time-indicator' });
  indicator.style.top = `${top}px`;
  grid.appendChild(indicator);
}

function autoScrollToNow() {
  const container = $('#calendar-grid-container');
  if (!container) return;

  if (currentDate === todayStr()) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const top = ((hours - START_HOUR) * 60 + minutes) / 30 * SLOT_HEIGHT;
    container.scrollTop = Math.max(0, top - 120);
  } else {
    // Scroll to 8 AM for non-today dates
    const top = ((8 - START_HOUR) * 60) / 30 * SLOT_HEIGHT;
    container.scrollTop = Math.max(0, top - 40);
  }
}

// --- Time Helpers ---

function timeToPixels(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return ((h - START_HOUR) * 60 + m) / 30 * SLOT_HEIGHT;
}

function durationToPixels(minutes) {
  return (minutes / 30) * SLOT_HEIGHT;
}

function formatTime24(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatTime12(hour, minute) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return minute === 0 ? `${h12} ${period}` : `${h12}:${String(minute).padStart(2, '0')} ${period}`;
}

function formatTime12FromStr(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return formatTime12(h, m);
}

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  return formatTime24(Math.floor(total / 60), total % 60);
}

