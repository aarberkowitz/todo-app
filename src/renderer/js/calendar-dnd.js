import { $ } from './utils.js';
import * as bus from './event-bus.js';
import * as state from './state.js';

// Duplicated from calendar.js to avoid circular import
const SLOT_HEIGHT = 40;
const START_HOUR = 6;
const END_HOUR = 23;
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2;

let draggedTaskId = null;
let dragSource = null; // 'sidebar' | 'grid'

// Pointer-based move/resize state
let pointerAction = null; // null | 'move' | 'resize'
let pointerTaskId = null;
let pointerStartY = 0;
let pointerOriginalTop = 0;
let pointerOriginalHeight = 0;
let pointerBlock = null;

export function initCalendarDnD() {
  const calendarSidebar = $('#calendar-sidebar');
  const calendarGrid = $('#calendar-grid');
  const gridContainer = $('#calendar-grid-container');

  // --- HTML5 Drag: Sidebar → Grid (Schedule) ---

  calendarSidebar.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.calendar-unscheduled-item');
    if (!item) return;
    draggedTaskId = item.dataset.taskId;
    dragSource = 'sidebar';
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTaskId);
  });

  calendarSidebar.addEventListener('dragend', (e) => {
    const item = e.target.closest('.calendar-unscheduled-item');
    if (item) item.classList.remove('dragging');
    draggedTaskId = null;
    dragSource = null;
  });

  // --- HTML5 Drag: Grid → Sidebar (Unschedule) ---

  calendarGrid.addEventListener('dragstart', (e) => {
    const block = e.target.closest('.calendar-task-block');
    if (!block) return;
    // Don't start HTML5 drag if pointer action is active
    if (pointerAction) {
      e.preventDefault();
      return;
    }
    draggedTaskId = block.dataset.taskId;
    dragSource = 'grid';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTaskId);
  });

  calendarGrid.addEventListener('dragend', () => {
    draggedTaskId = null;
    dragSource = null;
  });

  // --- Drop on Grid (schedule task) ---

  calendarGrid.addEventListener('dragover', (e) => {
    if (!draggedTaskId || dragSource !== 'sidebar') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Highlight slot
    clearSlotHighlights();
    const slot = e.target.closest('.calendar-slot');
    if (slot) slot.classList.add('drag-over');
  });

  calendarGrid.addEventListener('dragleave', (e) => {
    const slot = e.target.closest('.calendar-slot');
    if (slot) slot.classList.remove('drag-over');
  });

  calendarGrid.addEventListener('drop', async (e) => {
    e.preventDefault();
    clearSlotHighlights();

    if (!draggedTaskId || dragSource !== 'sidebar') return;

    const slot = e.target.closest('.calendar-slot');
    if (!slot) return;

    const time = slot.dataset.slotTime;
    const view = state.getView();
    const date = view.id;

    await window.api.updateTask(draggedTaskId, {
      scheduledDate: date,
      scheduledTime: time,
      scheduledDuration: 30,
    });

    draggedTaskId = null;
    dragSource = null;
    bus.emit('tasks-changed');
  });

  // --- Drop on Sidebar (unschedule task) ---

  calendarSidebar.addEventListener('dragover', (e) => {
    if (!draggedTaskId || dragSource !== 'grid') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    calendarSidebar.classList.add('drag-over');
  });

  calendarSidebar.addEventListener('dragleave', () => {
    calendarSidebar.classList.remove('drag-over');
  });

  calendarSidebar.addEventListener('drop', async (e) => {
    e.preventDefault();
    calendarSidebar.classList.remove('drag-over');

    if (!draggedTaskId || dragSource !== 'grid') return;

    await window.api.updateTask(draggedTaskId, {
      scheduledDate: null,
      scheduledTime: null,
      scheduledDuration: null,
    });

    draggedTaskId = null;
    dragSource = null;
    bus.emit('tasks-changed');
  });

  // --- Pointer Events: In-Grid Move & Resize ---

  calendarGrid.addEventListener('pointerdown', (e) => {
    const block = e.target.closest('.calendar-task-block');
    if (!block) return;

    const resizeHandle = e.target.closest('.resize-handle');

    pointerTaskId = block.dataset.taskId;
    pointerBlock = block;
    pointerStartY = e.clientY;
    pointerOriginalTop = parseFloat(block.style.top);
    pointerOriginalHeight = parseFloat(block.style.height);

    if (resizeHandle) {
      pointerAction = 'resize';
    } else {
      pointerAction = 'move';
      block.classList.add('moving');
    }

    block.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  calendarGrid.addEventListener('pointermove', (e) => {
    if (!pointerAction || !pointerBlock) return;

    const deltaY = e.clientY - pointerStartY;

    if (pointerAction === 'move') {
      const newTop = pointerOriginalTop + deltaY;
      // Snap to half-hour increments
      const snapped = Math.round(newTop / SLOT_HEIGHT) * SLOT_HEIGHT;
      const maxTop = (TOTAL_SLOTS - 1) * SLOT_HEIGHT;
      pointerBlock.style.top = `${Math.max(0, Math.min(snapped, maxTop))}px`;
    } else if (pointerAction === 'resize') {
      const newHeight = pointerOriginalHeight + deltaY;
      // Snap to 30-min increments, minimum 30 min
      const snapped = Math.max(SLOT_HEIGHT, Math.round(newHeight / SLOT_HEIGHT) * SLOT_HEIGHT);
      const topSlot = Math.round(pointerOriginalTop / SLOT_HEIGHT);
      const maxSlots = TOTAL_SLOTS - topSlot;
      const maxHeight = maxSlots * SLOT_HEIGHT;
      pointerBlock.style.height = `${Math.min(snapped, maxHeight)}px`;
    }
  });

  calendarGrid.addEventListener('pointerup', async (e) => {
    if (!pointerAction || !pointerBlock) return;

    const block = pointerBlock;
    block.classList.remove('moving');

    if (pointerAction === 'move') {
      const newTop = parseFloat(block.style.top);
      const slotIndex = Math.round(newTop / SLOT_HEIGHT);
      const totalMinutes = START_HOUR * 60 + slotIndex * 30;
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      const newTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      await window.api.updateTask(pointerTaskId, {
        scheduledTime: newTime,
      });
    } else if (pointerAction === 'resize') {
      const newHeight = parseFloat(block.style.height);
      const newDuration = Math.round(newHeight / SLOT_HEIGHT) * 30;

      await window.api.updateTask(pointerTaskId, {
        scheduledDuration: newDuration,
      });
    }

    pointerAction = null;
    pointerTaskId = null;
    pointerBlock = null;
    bus.emit('tasks-changed');
  });

  calendarGrid.addEventListener('pointercancel', () => {
    if (pointerBlock) {
      pointerBlock.classList.remove('moving');
      // Restore original position/size
      pointerBlock.style.top = `${pointerOriginalTop}px`;
      pointerBlock.style.height = `${pointerOriginalHeight}px`;
    }
    pointerAction = null;
    pointerTaskId = null;
    pointerBlock = null;
  });
}

function clearSlotHighlights() {
  const grid = $('#calendar-grid');
  for (const slot of grid.querySelectorAll('.calendar-slot.drag-over')) {
    slot.classList.remove('drag-over');
  }
}
