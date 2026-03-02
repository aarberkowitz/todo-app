import { $ } from './utils.js';

let resolveDialog = null;

export function initDialog() {
  const overlay = $('#dialog-overlay');
  const cancelBtn = $('#dialog-cancel');
  const confirmBtn = $('#dialog-confirm');

  cancelBtn.addEventListener('click', () => close(false));
  confirmBtn.addEventListener('click', () => close(true));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(false);
  });
}

export function showConfirm(message, confirmLabel = 'Delete') {
  const overlay = $('#dialog-overlay');
  const messageEl = $('#dialog-message');
  const confirmBtn = $('#dialog-confirm');

  messageEl.textContent = message;
  confirmBtn.textContent = confirmLabel;
  overlay.style.display = 'flex';

  return new Promise((resolve) => {
    resolveDialog = resolve;
  });
}

function close(result) {
  $('#dialog-overlay').style.display = 'none';
  if (resolveDialog) {
    resolveDialog(result);
    resolveDialog = null;
  }
}

// Rename dialog
let resolveRename = null;

export function initRenameDialog() {
  const overlay = $('#rename-overlay');
  const cancelBtn = $('#rename-cancel');
  const confirmBtn = $('#rename-confirm');
  const input = $('#rename-input');

  cancelBtn.addEventListener('click', () => closeRename(null));
  confirmBtn.addEventListener('click', () => closeRename(input.value.trim()));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') closeRename(input.value.trim());
    if (e.key === 'Escape') closeRename(null);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeRename(null);
  });
}

export function showRename(currentName, title = 'Rename project') {
  const overlay = $('#rename-overlay');
  const input = $('#rename-input');
  const msgEl = $('.dialog-message', overlay);
  if (msgEl) msgEl.textContent = title;
  input.value = currentName;
  overlay.style.display = 'flex';
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);

  return new Promise((resolve) => {
    resolveRename = resolve;
  });
}

function closeRename(result) {
  $('#rename-overlay').style.display = 'none';
  if (resolveRename) {
    resolveRename(result);
    resolveRename = null;
  }
}
