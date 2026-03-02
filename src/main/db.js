import { app } from 'electron';
import path from 'node:path';
import { JSONFilePreset } from 'lowdb/node';

let dbInstance = null;

const defaultData = {
  lists: [],
  tasks: [],
  settings: {
    lastSelectedListId: null,
    windowBounds: {},
  },
};

export async function initDB() {
  if (dbInstance) return { db: dbInstance };

  const dbPath = path.join(app.getPath('userData'), 'db.json');
  dbInstance = await JSONFilePreset(dbPath, defaultData);
  await dbInstance.read();

  // Ensure structure exists
  dbInstance.data.lists ??= [];
  dbInstance.data.tasks ??= [];
  dbInstance.data.settings ??= { lastSelectedListId: null, windowBounds: {} };

  // Create default "Tasks" project on first launch
  if (dbInstance.data.lists.length === 0) {
    const defaultList = {
      id: crypto.randomUUID(),
      name: 'Tasks',
      createdAt: new Date().toISOString(),
      sortOrder: 0,
    };
    dbInstance.data.lists.push(defaultList);
    dbInstance.data.settings.lastSelectedListId = defaultList.id;
    await dbInstance.write();
  }

  return { db: dbInstance };
}

export async function getDB() {
  if (!dbInstance) await initDB();
  return dbInstance;
}

// --- Lists ---

export async function getLists() {
  const db = await getDB();
  return db.data.lists.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function createList(name) {
  const db = await getDB();
  const list = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    sortOrder: db.data.lists.length,
  };
  db.data.lists.push(list);
  await db.write();
  return list;
}

export async function renameList(id, name) {
  const db = await getDB();
  const list = db.data.lists.find((l) => l.id === id);
  if (!list) return null;
  list.name = name;
  await db.write();
  return list;
}

export async function deleteList(id) {
  const db = await getDB();
  db.data.lists = db.data.lists.filter((l) => l.id !== id);
  db.data.tasks = db.data.tasks.filter((t) => t.listId !== id);
  await db.write();
  return true;
}

// --- Tasks ---

export async function getTasksForList(listId) {
  const db = await getDB();
  return db.data.tasks
    .filter((t) => t.listId === listId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getTasksByFilter(filter) {
  const db = await getDB();
  const today = new Date().toISOString().split('T')[0];

  switch (filter) {
    case 'my-day':
      return db.data.tasks
        .filter((t) => t.myDay === today && !t.completed)
        .sort((a, b) => a.sortOrder - b.sortOrder);

    case 'important':
      return db.data.tasks
        .filter((t) => t.starred && !t.completed)
        .sort((a, b) => a.sortOrder - b.sortOrder);

    case 'planned':
      return db.data.tasks
        .filter((t) => t.dueDate && !t.completed)
        .sort((a, b) => {
          if (a.dueDate < b.dueDate) return -1;
          if (a.dueDate > b.dueDate) return 1;
          return a.sortOrder - b.sortOrder;
        });

    case 'all':
      return db.data.tasks.slice().sort((a, b) => a.sortOrder - b.sortOrder);

    default:
      return [];
  }
}

export async function createTask(listId, title, parentTaskId = null) {
  const db = await getDB();
  const listTasks = db.data.tasks.filter((t) => t.listId === listId);
  const task = {
    id: crypto.randomUUID(),
    listId,
    title,
    notes: '',
    completed: false,
    completedAt: null,
    starred: false,
    priority: 'none',
    dueDate: null,
    myDay: null,
    scheduledDate: null,
    scheduledTime: null,
    scheduledDuration: null,
    parentTaskId: parentTaskId || null,
    createdAt: new Date().toISOString(),
    sortOrder: listTasks.length,
  };
  db.data.tasks.push(task);
  await db.write();
  return task;
}

export async function updateTask(id, changes) {
  const db = await getDB();
  const task = db.data.tasks.find((t) => t.id === id);
  if (!task) return null;

  for (const [key, value] of Object.entries(changes)) {
    if (key === 'id' || key === 'createdAt' || key === 'parentTaskId') continue;
    task[key] = value;
  }

  if (changes.completed === true && !task.completedAt) {
    task.completedAt = new Date().toISOString();
  } else if (changes.completed === false) {
    task.completedAt = null;
  }

  await db.write();
  return task;
}

export async function deleteTask(id) {
  const db = await getDB();
  db.data.tasks = db.data.tasks.filter((t) => t.id !== id && t.parentTaskId !== id);
  await db.write();
  return true;
}

export async function getSubtasks(parentTaskId) {
  const db = await getDB();
  return db.data.tasks
    .filter((t) => t.parentTaskId === parentTaskId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getTask(id) {
  const db = await getDB();
  return db.data.tasks.find((t) => t.id === id) || null;
}

// --- Calendar Queries ---

export async function getScheduledTasksForDate(date) {
  const db = await getDB();
  return db.data.tasks
    .filter((t) => t.scheduledDate === date && !t.completed)
    .sort((a, b) => {
      if (a.scheduledTime < b.scheduledTime) return -1;
      if (a.scheduledTime > b.scheduledTime) return 1;
      return a.sortOrder - b.sortOrder;
    });
}

export async function getUnscheduledTasks() {
  const db = await getDB();
  return db.data.tasks
    .filter((t) => !t.scheduledDate && !t.completed)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// --- Settings ---

export async function getSettings() {
  const db = await getDB();
  return db.data.settings;
}

export async function updateSettings(changes) {
  const db = await getDB();
  Object.assign(db.data.settings, changes);
  await db.write();
  return db.data.settings;
}
