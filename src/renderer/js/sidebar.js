import { $, $$, createElement } from './utils.js';
import * as bus from './event-bus.js';
import * as state from './state.js';
import { showConfirm, showRename } from './dialog.js';

let lists = [];
let contextMenuListId = null;

export async function initSidebar() {
  await loadLists();
  renderUserLists();
  bindEvents();
  await updateCounts();

  bus.on('view-changed', updateActive);
  bus.on('tasks-changed', updateCounts);
}

async function loadLists() {
  lists = await window.api.getLists();
}

function renderUserLists() {
  const container = $('#user-lists');
  container.innerHTML = '';

  for (const list of lists) {
    const item = createElement('div', { className: 'user-list-item' }, [
      createElement('button', {
        className: 'sidebar-item',
        dataset: { listId: list.id },
        onClick: () => state.setView('list', list.id),
        onContextmenu: (e) => showContextMenu(e, list.id),
      }, [
        createElement('span', { className: 'sidebar-icon' }, ['\u{1F4CB}']),
        createElement('span', { className: 'sidebar-label' }, [list.name]),
        createElement('span', { className: 'sidebar-count', dataset: { listCount: list.id } }),
      ]),
    ]);
    container.appendChild(item);
  }
}

function bindEvents() {
  // Smart list clicks
  for (const btn of $$('.smart-lists .sidebar-item')) {
    btn.addEventListener('click', () => {
      state.setView('filter', btn.dataset.filter);
    });
  }

  // Add list button
  $('#add-list-btn').addEventListener('click', async () => {
    const name = await showRename('', 'New list');
    if (!name) return;
    await window.api.createList(name);
    await loadLists();
    renderUserLists();
    // Select the new list
    const newList = lists[lists.length - 1];
    if (newList) state.setView('list', newList.id);
  });

  // Context menu actions
  const ctxMenu = $('#context-menu');
  for (const item of $$('.context-menu-item', ctxMenu)) {
    item.addEventListener('click', () => handleContextAction(item.dataset.action));
  }

  // Close context menu on click elsewhere
  document.addEventListener('click', () => {
    ctxMenu.style.display = 'none';
  });
}

function showContextMenu(e, listId) {
  e.preventDefault();
  e.stopPropagation();
  contextMenuListId = listId;
  const menu = $('#context-menu');
  menu.style.display = 'block';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
}

async function handleContextAction(action) {
  const ctxMenu = $('#context-menu');
  ctxMenu.style.display = 'none';
  if (!contextMenuListId) return;

  const list = lists.find((l) => l.id === contextMenuListId);
  if (!list) return;

  if (action === 'rename') {
    const newName = await showRename(list.name);
    if (newName && newName !== list.name) {
      await window.api.renameList(list.id, newName);
      await loadLists();
      renderUserLists();
      updateActive();
      bus.emit('list-renamed', { id: list.id, name: newName });
    }
  } else if (action === 'delete') {
    const confirmed = await showConfirm(
      `Delete "${list.name}" and all its tasks? This cannot be undone.`
    );
    if (confirmed) {
      const view = state.getView();
      await window.api.deleteList(list.id);
      await loadLists();
      renderUserLists();
      if (view.type === 'list' && view.id === list.id) {
        state.setView('filter', 'my-day');
      }
      bus.emit('tasks-changed');
    }
  }

  contextMenuListId = null;
}

function updateActive() {
  const view = state.getView();

  // Clear all active
  for (const el of $$('.sidebar-item.active')) {
    el.classList.remove('active');
  }

  if (view.type === 'filter') {
    const el = $(`.sidebar-item[data-filter="${view.id}"]`);
    if (el) el.classList.add('active');
  } else if (view.type === 'list') {
    const el = $(`.sidebar-item[data-list-id="${view.id}"]`);
    if (el) el.classList.add('active');
  }
}

async function updateCounts() {
  // Smart list counts
  const filters = ['my-day', 'important', 'planned', 'all'];
  for (const filter of filters) {
    const tasks = await window.api.getTasksByFilter(filter);
    const incomplete = filter === 'all'
      ? tasks.filter((t) => !t.completed).length
      : tasks.length;
    const el = $(`[data-count="${filter}"]`);
    if (el) el.textContent = incomplete > 0 ? incomplete : '';
  }

  // User list counts
  for (const list of lists) {
    const tasks = await window.api.getTasksForList(list.id);
    const incomplete = tasks.filter((t) => !t.completed).length;
    const el = $(`[data-list-count="${list.id}"]`);
    if (el) el.textContent = incomplete > 0 ? incomplete : '';
  }
}

export async function refresh() {
  await loadLists();
  renderUserLists();
  updateActive();
  await updateCounts();
}

export function getListName(listId) {
  const list = lists.find((l) => l.id === listId);
  return list ? list.name : '';
}
