# To Do

A personal to-do list app inspired by Microsoft To Do. Runs as a standalone desktop application on Windows and Mac with local-only storage.

![Electron](https://img.shields.io/badge/Electron-35-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Task lists** — create, rename, and delete custom lists
- **Tasks** — add, edit, delete, and mark complete with title and notes
- **Due dates** — date picker on each task with overdue highlighting
- **Priority** — none / low / medium / high with color-coded indicators
- **Starred/important** — toggle star on any task
- **My Day** — daily planning view; add tasks from any list, resets each day
- **Smart lists** — My Day, Important, Planned, All Tasks (computed views)
- **Export/import** — JSON file via File menu for backups or moving between machines
- **Keyboard shortcuts** — Ctrl+N (new task), Delete (remove task), Escape (close detail)
- **Window state** — remembers size and position between sessions

## Screenshot

```
+------------------+------------------------------+------------------+
|  SIDEBAR         |     TASK LIST                |  DETAIL PANEL    |
|                  |                              |                  |
|  My Day          |  List Name      [+ Add Task] |  Title (edit)    |
|  Important       |  [ ] Task 1       ★ Mar 2   |  Add to My Day   |
|  Planned         |  [x] Task 2       ★ Mar 1   |  Due date        |
|  All Tasks       |                              |  Priority        |
|  -----------     |  ▸ Completed (2)             |  Notes           |
|  Groceries       |                              |  [Delete]        |
|  Work            |                              |                  |
|  [+ New List]    |                              |                  |
+------------------+------------------------------+------------------+
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)

### Install

```bash
git clone https://github.com/aarberkowitz/todo-app.git
cd todo-app
npm install
```

### Run

```bash
npm start
```

### Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac
```

Packaged installers are output to the `dist/` directory.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Electron |
| Frontend | Vanilla HTML/CSS/JS (ES modules) |
| Storage | lowdb (JSON file database) |
| Packaging | electron-builder |

## Data Storage

All data is stored locally in a `db.json` file in Electron's `userData` directory:

- **Windows:** `%APPDATA%/todo-app/db.json`
- **macOS:** `~/Library/Application Support/todo-app/db.json`

The export file uses the same format as the internal database, making it easy to inspect or edit manually.

## Project Structure

```
todo-app/
├── package.json
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.js        # BrowserWindow setup, app lifecycle
│   │   ├── db.js          # lowdb init + CRUD operations
│   │   ├── ipc-handlers.js
│   │   ├── menu.js        # Native app menu
│   │   └── export-import.js
│   ├── preload/
│   │   └── preload.cjs    # contextBridge API
│   └── renderer/          # UI
│       ├── index.html
│       ├── css/
│       └── js/
└── build/                 # App icons
```

## License

MIT
