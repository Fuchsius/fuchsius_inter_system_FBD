# Global Activity Tracker

Production-ready Electron application that monitors high-level user activity (mouse movement + keyboard activity) in the background while respecting privacy and explicit user consent.

## Features

- Cross-platform (macOS, Windows, Linux/X11) Electron app using `iohook` for native global input hooks
- Tracks only metadata: mouse movement positions and keyboard activity events without recording key values
- Computes last activity timestamp, idle seconds, and active/idle status in the main process
- Continues monitoring when minimized, hidden, or running from the system tray
- Consent-first workflow with persistent user preferences stored locally
- macOS Accessibility permission detection with quick links and refresh flow
- Wayland detection on Linux with graceful fallback messaging
- Low-power throttling of mouse movement events
- Modern UI exposing tracking toggle, status, idle timer, and diagnostics

## Project structure

```
.
├── main.js               # Electron main process with hooks, tray, IPC, consent handling
├── preload.js            # Secure bridge exposing allowed IPC calls to the renderer
├── src
│   └── renderer
│       ├── index.html    # Renderer UI
│       ├── renderer.js   # UI logic + state updates via IPC
│       └── styles.css    # Visual design
├── package.json
└── README.md
```

## Getting started

### Prerequisites

- Node.js 18+ and npm 9+
- Build tools for native modules:
  - **macOS:** Xcode command line tools
  - **Windows:** Visual Studio Build Tools 2019+ with Desktop C++ workload and Python 3
  - **Linux:** `build-essential`, `python3`, and X11 headers (e.g., `libx11-dev`) plus an X11 session (Wayland cannot run global hooks)

### Installation & rebuild

```bash
npm install
```

`npm install` automatically runs `electron-rebuild` (see `postinstall` script) to recompile `iohook` for your platform. If you update Electron or run into binary issues, rerun:

```bash
npm run rebuild
```

### Development

```bash
npm start
```

The window can be closed to the tray; quit via the tray menu.

## Permissions & platform notes

### macOS

1. Launch the app and click **Grant consent**.
2. When prompted, open **System Settings → Privacy & Security → Accessibility**.
3. Enable the checkbox for **Global Activity Tracker**.
4. Click **Refresh permission** inside the app. Tracking resumes automatically once permission is granted.

Without Accessibility permission, hooks remain paused, and the UI explains what to do.

### Windows

No special permissions are required beyond consent. Hooks should start immediately once consent is granted.

### Linux

- Global hooks are supported on **X11** sessions only. The app detects Wayland (`XDG_SESSION_TYPE=wayland`) and disables tracking with guidance.
- Ensure the `XKB` libraries are available; the app sets `XKB_DEFAULT_RULES=evdev` as a fallback when starting on Linux.

## Privacy & data handling

- The main process handles all tracking logic; the renderer only displays aggregated metadata.
- Only the following data points are stored in memory: last activity timestamp, idle duration, and active/idle status.
- Keyboard events are treated as opaque activity signals—no keycodes, text, or sensitive data are logged or persisted.
- User consent is required before hooks start, and preferences are stored locally under the Electron `userData` directory.
- Revoking consent immediately stops tracking and resets state until consent is granted again.

## Troubleshooting

- **`iohook` fails to load**: Ensure `npm run rebuild` completes without errors and that build toolchains are installed.
- **macOS hooks stay paused**: Verify Accessibility permission is granted. Remove/re-add the app if necessary and restart.
- **Linux Wayland session**: Switch to an X11 session; Wayland restricts global input hooks by design.
- **High CPU usage**: Mouse events are throttled to ~8Hz (`MOUSE_THROTTLE_MS = 120`). Adjust as needed in `main.js`.

## Legal & ethical considerations

- Always disclose tracking behavior to end-users and obtain consent per applicable laws (e.g., GDPR, CCPA).
- Do not extend this application to capture keystrokes, clipboard data, or personal content without explicit legal review and user authorization.
- If distributing binaries, include clear privacy notices and opt-in mechanisms consistent with your compliance requirements.
