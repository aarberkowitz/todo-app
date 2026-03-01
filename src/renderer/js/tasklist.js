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
  'all': 'You have no tasks yet. Create a list and add some!',
  'list': 'No tasks yet. Add one above!',
};

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
  if (!view.type) return;

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

  for (const task of incomplete) {
    taskListEl.appendChild(createTaskRow(task, showListName));
  }

  // Completed section
  if (completed.length > 0) {
    completedSection.style.display = 'block';
    $('#completed-count').textContent = `(${completed.length})`;
    const completedList = $('#completed-list');
    completedList.innerHTML = '';
    for (const task of completed) {
      completedList.appendChild(createTaskRow(task, showListName));
    }
  } else {
    completedSection.style.display = 'none';
  }

  highlightSelected();
}

function createTaskRow(task, showListName) {
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
  if (task.dueDate) {
    const dueCls = isOverdue(task.dueDate) && !task.completed ? 'task-meta-due overdue' : 'task-meta-due';
    metaItems.push(createElement('span', { className: dueCls }, [formatDate(task.dueDate)]));
  }

  const row = createElement('div', {
    className: `task-row${task.completed ? ' completed' : ''}`,
    dataset: { taskId: task.id },
    onClick: () => state.setSelectedTask(task.id),
  }, [
    createElement('button', {
      className: checkboxClass.join(' '),
      onClick: (e) => {
        e.stopPropagation();
        toggleComplete(task);
      },
    }),
    createElement('div', { className: 'task-content' }, [
      createElement('div', { className: 'task-title' }, [task.title]),
      ...(metaItems.length > 0
        ? [createElement('div', { className: 'task-meta' }, metaItems)]
        : []),
    ]),
    createElement('button', {
      className: `task-star${task.starred ? ' starred' : ''}`,
      onClick: (e) => {
        e.stopPropagation();
        toggleStar(task);
      },
    }, [task.starred ? '\u2605' : '\u2606']),
  ]);

  return row;
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

