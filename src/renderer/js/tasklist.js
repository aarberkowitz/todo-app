import { $, createElement, formatDate, isOverdue, todayString } from './utils.js';
import * as bus from './event-bus.js';
import * as state from './state.js';
import { getListName } from './sidebar.js';

const SMART_LIST_TITLES = {
  'my-day': 'My Day',
  'important': 'Important',
  'planned': 'Planned',
  'all': 'All Tasks',
};

const EMPTY_MESSAGES = {
  'my-day': 'Focus on your day. What do you want to get done today?',
  'important': 'Try starring some tasks to see them here.',
  'planned': 'Tasks with due dates will show up here.',
  'all': 'You have no tasks yet. Create a project and add some!',
  'list': 'No tasks yet. Add one above!',
};

// In-memory collapsed state (not persisted)
const collapsedParents = new Set();

export function initTaskList() {
  bus.on('view-changed', renderCurrentView);
  bus.on('tasks-changed', renderCurrentView);
  bus.on('task-selected', highlightSelected);

  // Completed accordion toggle
  $('#completed-toggle').addEventListener('click', () => {
    const list = $('#completed-list');
    const arrow = $('.completed-arrow');
    const isExpanded = list.style.display !== 'none';
    list.style.display = isExpanded ? 'none' : 'block';
    arrow.classList.toggle('expanded', !isExpanded);
  });

  $('#add-task-input').addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const input = e.target;
    const title = input.value.trim();
    if (!title) return;

    const view = state.getView();
    if (view.type === 'list') {
      await window.api.createTask(view.id, title);
    } else if (view.type === 'filter' && view.id === 'my-day') {
      // For My Day, need to pick a list or create a default one
      let lists = await window.api.getLists();
      if (lists.length === 0) {
        await window.api.createList('Tasks');
        lists = await window.api.getLists();
      }
      const task = await window.api.createTask(lists[0].id, title);
      await window.api.updateTask(task.id, { myDay: todayString() });
    }

    input.value = '';
    bus.emit('tasks-changed');
  });
}

async function renderCurrentView() {
  const view = state.getView();
  if (!view.type || view.type === 'calendar') return;

  const titleEl = $('#task-panel-title');
  const addArea = $('#add-task-area');
  const taskListEl = $('#task-list');
  const completedSection = $('#completed-section');
  const emptyState = $('#empty-state');

  // Title
  if (view.type === 'filter') {
    titleEl.textContent = SMART_LIST_TITLES[view.id] || '';
    titleEl.className = 'smart-list-title';
  } else {
    const name = getListName(view.id);
    titleEl.textContent = name;
    titleEl.className = '';
  }

  // Show add task for user lists and my-day
  const canAdd = view.type === 'list' || (view.type === 'filter' && view.id === 'my-day');
  addArea.style.display = canAdd ? 'block' : 'none';

  // Fetch tasks
  let tasks;
  if (view.type === 'list') {
    tasks = await window.api.getTasksForList(view.id);
  } else {
    tasks = await window.api.getTasksByFilter(view.id);
  }

  const incomplete = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  // Separate top-level and subtasks for incomplete
  const topLevel = incomplete.filter((t) => !t.parentTaskId);
  const subtaskMap = new Map();
  for (const t of incomplete) {
    if (t.parentTaskId) {
      if (!subtaskMap.has(t.parentTaskId)) subtaskMap.set(t.parentTaskId, []);
      subtaskMap.get(t.parentTaskId).push(t);
    }
  }

  // Find orphan subtasks (parent is completed or not in current view but subtask is incomplete)
  const topLevelIds = new Set(topLevel.map((t) => t.id));
  const orphans = [];
  for (const [parentId, subs] of subtaskMap) {
    if (!topLevelIds.has(parentId)) {
      orphans.push(...subs);
    }
  }

  // Render incomplete
  taskListEl.innerHTML = '';
  if (incomplete.length === 0 && completed.length === 0) {
    emptyState.style.display = 'flex';
    const key = view.type === 'filter' ? view.id : 'list';
    $('.empty-state-text', emptyState).textContent = EMPTY_MESSAGES[key];
  } else {
    emptyState.style.display = 'none';
  }

  const showListName = view.type === 'filter' && (view.id === 'all' || view.id === 'important' || view.id === 'planned' || view.id === 'my-day');

  for (const task of topLevel) {
    const subtasks = subtaskMap.get(task.id) || [];
    taskListEl.appendChild(createTaskRow(task, showListName, subtasks.length));

    if (subtasks.length > 0 && !collapsedParents.has(task.id)) {
      for (const sub of subtasks) {
        taskListEl.appendChild(createSubtaskRow(sub, showListName));
      }
    }
  }

  // Render orphan subtasks (parent completed but subtask still incomplete)
  for (const task of orphans) {
    taskListEl.appendChild(createSubtaskRow(task, showListName));
  }

  // Completed section — group similarly
  if (completed.length > 0) {
    completedSection.style.display = 'block';
    $('#completed-count').textContent = `(${completed.length})`;
    const completedList = $('#completed-list');
    completedList.innerHTML = '';

    const completedTopLevel = completed.filter((t) => !t.parentTaskId);
    const completedSubMap = new Map();
    for (const t of completed) {
      if (t.parentTaskId) {
        if (!completedSubMap.has(t.parentTaskId)) completedSubMap.set(t.parentTaskId, []);
        completedSubMap.get(t.parentTaskId).push(t);
      }
    }
    const completedTopIds = new Set(completedTopLevel.map((t) => t.id));

    for (const task of completedTopLevel) {
      const subs = completedSubMap.get(task.id) || [];
      completedList.appendChild(createTaskRow(task, showListName, subs.length));
      if (subs.length > 0 && !collapsedParents.has(task.id)) {
        for (const sub of subs) {
          completedList.appendChild(createSubtaskRow(sub, showListName));
        }
      }
    }

    // Orphan completed subtasks
    for (const [parentId, subs] of completedSubMap) {
      if (!completedTopIds.has(parentId)) {
        for (const sub of subs) {
          completedList.appendChild(createSubtaskRow(sub, showListName));
        }
      }
    }
  } else {
    completedSection.style.display = 'none';
  }

  highlightSelected();
}

function createTaskRow(task, showListName, subtaskCount = 0) {
  const checkboxClass = ['task-checkbox'];
  if (task.completed) checkboxClass.push('checked');
  if (task.priority !== 'none' && !task.completed) checkboxClass.push(`priority-${task.priority}`);

  const metaItems = [];
  if (showListName) {
    const listName = getListName(task.listId);
    if (listName) {
      metaItems.push(createElement('span', { className: 'task-meta-list' }, [listName]));
    }
  }
  if (subtaskCount > 0) {
    metaItems.push(createElement('span', { className: 'task-meta-subtasks' }, [
      `${subtaskCount} subtask${subtaskCount !== 1 ? 's' : ''}`,
    ]));
  }
  if (task.dueDate) {
    const dueCls = isOverdue(task.dueDate) && !task.completed ? 'task-meta-due overdue' : 'task-meta-due';
    metaItems.push(createElement('span', { className: dueCls }, [formatDate(task.dueDate)]));
  }

  const leftItems = [];

  // Expand/collapse chevron for tasks with subtasks
  if (subtaskCount > 0) {
    const isExpanded = !collapsedParents.has(task.id);
    leftItems.push(createElement('button', {
      className: `subtask-toggle${isExpanded ? ' expanded' : ''}`,
      onClick: (e) => {
        e.stopPropagation();
        if (collapsedParents.has(task.id)) {
          collapsedParents.delete(task.id);
        } else {
          collapsedParents.add(task.id);
        }
        bus.emit('tasks-changed');
      },
    }, ['\u25B6']));
  }

  leftItems.push(createElement('button', {
    className: checkboxClass.join(' '),
    onClick: (e) => {
      e.stopPropagation();
      toggleComplete(task);
    },
  }));

  leftItems.push(createElement('div', { className: 'task-content' }, [
    createElement('div', { className: 'task-title' }, [task.title]),
    ...(metaItems.length > 0
      ? [createElement('div', { className: 'task-meta' }, metaItems)]
      : []),
  ]));

  // "+" button to add subtask (not on subtask rows — handled by not passing to createSubtaskRow)
  if (!task.parentTaskId) {
    leftItems.push(createElement('button', {
      className: 'task-add-subtask',
      title: 'Add subtask',
      onClick: (e) => {
        e.stopPropagation();
        promptCreateSubtask(task);
      },
    }, ['+']));
  }

  leftItems.push(createElement('button', {
    className: `task-star${task.starred ? ' starred' : ''}`,
    onClick: (e) => {
      e.stopPropagation();
      toggleStar(task);
    },
  }, [task.starred ? '\u2605' : '\u2606']));

  const row = createElement('div', {
    className: `task-row${task.completed ? ' completed' : ''}`,
    dataset: { taskId: task.id },
    onClick: () => state.setSelectedTask(task.id),
  }, leftItems);

  return row;
}

function createSubtaskRow(task, showListName) {
  const row = createTaskRow(task, showListName, 0);
  row.classList.add('subtask-row');
  // Remove the "+" button from subtask rows (prevent sub-subtasks)
  const addBtn = row.querySelector('.task-add-subtask');
  if (addBtn) addBtn.remove();
  return row;
}

function promptCreateSubtask(parentTask) {
  // Remove any existing subtask input
  const existing = document.querySelector('.subtask-input-wrapper');
  if (existing) existing.remove();

  // Find the parent row
  const parentRow = document.querySelector(`.task-row[data-task-id="${parentTask.id}"]`);
  if (!parentRow) return;

  const wrapper = createElement('div', { className: 'subtask-input-wrapper' });
  const input = createElement('input', {
    className: 'subtask-inline-input',
    type: 'text',
    placeholder: 'Add subtask...',
  });
  wrapper.appendChild(input);

  parentRow.after(wrapper);
  input.focus();

  const cleanup = () => {
    if (wrapper.parentNode) wrapper.remove();
  };

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const title = input.value.trim();
      if (!title) { cleanup(); return; }
      await window.api.createTask(parentTask.listId, title, parentTask.id);
      // Expand parent
      collapsedParents.delete(parentTask.id);
      cleanup();
      bus.emit('tasks-changed');
    } else if (e.key === 'Escape') {
      cleanup();
    }
  });

  input.addEventListener('blur', () => {
    // Small delay to allow Enter to fire first
    setTimeout(cleanup, 150);
  });
}

async function toggleComplete(task) {
  await window.api.updateTask(task.id, { completed: !task.completed });
  bus.emit('tasks-changed');
}

async function toggleStar(task) {
  await window.api.updateTask(task.id, { starred: !task.starred });
  bus.emit('tasks-changed');
}

function highlightSelected() {
  const selectedId = state.getSelectedTaskId();
  const rows = document.querySelectorAll('.task-row');
  for (const row of rows) {
    row.classList.toggle('selected', row.dataset.taskId === selectedId);
  }
}
