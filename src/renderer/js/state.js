import * as bus from './event-bus.js';

const state = {
  // 'list' for user lists, 'filter' for smart lists
  viewType: null,
  // The list ID or filter name ('my-day', 'important', 'planned', 'all')
  viewId: null,
  // Currently selected task ID (for detail panel)
  selectedTaskId: null,
};

export function getView() {
  return { type: state.viewType, id: state.viewId };
}

export function setView(type, id) {
  state.viewType = type;
  state.viewId = id;
  state.selectedTaskId = null;
  bus.emit('view-changed', { type, id });
}

export function getSelectedTaskId() {
  return state.selectedTaskId;
}

export function setSelectedTask(taskId) {
  const prev = state.selectedTaskId;
  state.selectedTaskId = taskId;
  if (taskId !== prev) {
    bus.emit('task-selected', taskId);
  }
}

export function clearSelectedTask() {
  if (state.selectedTaskId) {
    state.selectedTaskId = null;
    bus.emit('task-selected', null);
  }
}
