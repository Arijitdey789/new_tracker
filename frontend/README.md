# SENTINEL PRO — Multi-Camera Live Monitoring Dashboard

> Real-time, tracking-aware surveillance dashboard with "hacking/terminal" aesthetic, automatic mode switching, and async WebSocket backend.

---

## Quick Start

### 1. Frontend Only (No Backend Required)

The frontend works standalone with a built-in simulation mode that generates synthetic tracking events.

Simply open `index.html` in a browser:

```bash
# Windows
start index.html

# Linux / macOS
open index.html
# or
xdg-open index.html
```

Then:
1. Log in as a **User** (any credentials, uses local storage)
2. Navigate to **Live CCTV**
3. Add at least one camera stream (any URL + name + location)
4. Click **Start Live Session**
5. The dashboard will auto-switch to simulation mode and begin generating tracking events

---

### 2. With Backend WebSocket Server

For real-time WebSocket event streaming:

```bash
# Install the ws dependency
npm install ws

# Start the server (defaults to port 8765, 8 cameras, simulation mode)
node src/utils/server.js

# Custom options
node src/utils/server.js --port 9000 --cameras 12
```

The frontend will automatically connect to `ws://localhost:8765`. If the connection fails, it falls back to simulation mode after 3 retries.

---

## Architecture

```
PT/
├── index.html                    # Entry point (loads all CSS/JS)
├── README.md                     # This file
└── src/
    ├── main.js                   # App initialization
    ├── router/
    │   └── router.js             # Hash-based SPA router
    ├── components/
    │   ├── Toast.js              # Toast notifications
    │   ├── Modal.js              # Modal dialogs
    │   ├── Navbar.js             # Top navigation bar
    │   ├── AdminSidebar.js       # Admin panel sidebar
    │   └── UserSidebar.js        # User panel sidebar
    ├── pages/
    │   ├── Home.js               # Landing page
    │   ├── Login.js              # Authentication
    │   ├── Contact.js            # Contact page
    │   ├── admin/                # Admin pages
    │   └── user/
    │       ├── LiveCCTV.js       # ★ MONITORING DASHBOARD (state machine + layout)
    │       ├── EvidenceVault.js   # Evidence management
    │       ├── VideoProcessing.js # Video post-processing
    │       ├── PostProcLive.js   # Live post-processing
    │       └── Profile.js        # User profile
    ├── styles/
    │   ├── index.css             # Design tokens + global styles
    │   ├── livecctv.css          # ★ DASHBOARD THEME (hacker aesthetic + 8:5 grid)
    │   ├── components.css        # Shared component styles
    │   ├── landing.css           # Landing page styles
    │   ├── auth.css              # Login/auth styles
    │   ├── admin.css             # Admin panel styles
    │   └── user.css              # User panel styles
    └── utils/
        ├── helpers.js            # Utility functions
        ├── validators.js         # Form validation
        ├── store.js              # LocalStorage persistence
        ├── auth.js               # Authentication logic
        ├── theme.js              # Theme toggle (dark/light)
        ├── wsClient.js           # ★ WEBSOCKET CLIENT (reconnect + simulation)
        └── server.js             # ★ ASYNC BACKEND (Node.js WebSocket server)
```

---

## State Machine

The monitoring dashboard operates on a 4-state machine:

```
┌─────────────┐  tracking_start(1)  ┌───────────────────┐
│   NORMAL    ├────────────────────►│  SINGLE_TRACKING   │
│   (Grid)    │◄────────────────────┤  (Full viewport)   │
└──────┬──────┘  tracking_stop(0)   └─────────┬─────────┘
       │                                       │
       │ nav click             tracking_start  │ tracking_start(2+)
       ▼                            (2nd cam)  ▼
┌───────────────┐               ┌───────────────────┐
│ MANUAL_FULLSCR │               │  MULTI_TRACKING    │
│ (Independent)  │               │  (Dynamic grid)    │
└───────────────┘               └───────────────────┘
```

### States

| State | Trigger | Layout | Exit |
|-------|---------|--------|------|
| **NORMAL** | Default / all tracking stopped | Paginated 8:5 grid (auto-fit) | — |
| **SINGLE_TRACKING** | `tracking_start` (1 camera) | Full viewport, single feed | `tracking_stop` (0 remaining) |
| **MULTI_TRACKING** | `tracking_start` (2+ cameras) | Dynamic equal-size grid | `tracking_stop` (≤1 remaining) |
| **MANUAL_FULLSCREEN** | Nav panel click | Single camera override | ESC key / Close button |

### Key Rules

- **Manual fullscreen is independent** — tracking events update background state, UI reflects them only after manual exit
- **Transitions are animated** — 250ms scale/fade for smooth switching
- **8:5 aspect ratio never distorts** — letterbox/pillarbox if needed
- **Auto-revert** — when all tracking stops, returns to NORMAL automatically

---

## WebSocket API

### Event Schema

#### `tracking_start`
```json
{
    "type": "tracking_start",
    "camera_id": "cam_01",
    "target_id": "TGT-A3F2B1",
    "confidence": "87%",
    "coordinates": { "x": 640, "y": 480 },
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### `tracking_stop`
```json
{
    "type": "tracking_stop",
    "camera_id": "cam_01",
    "target_id": "TGT-A3F2B1",
    "timestamp": "2024-01-15T10:30:15.000Z"
}
```

#### `camera_status`
```json
{
    "type": "camera_status",
    "camera_id": "cam_01",
    "status": "online",
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### `ping` (server → client heartbeat)
```json
{ "type": "ping" }
```

Clients should respond with `{ "type": "pong" }`.

---

## Simulating Tracking Events

### Option 1: Built-in Frontend Simulation
If no backend is running, the frontend automatically activates simulation mode after 3 seconds. Random tracking events are generated every 8-18 seconds.

### Option 2: Backend Simulation Server
```bash
node src/utils/server.js --simulate --cameras 12
```
Each camera runs an independent event loop, generating tracking events at random intervals.

### Option 3: Manual WebSocket Trigger
Connect to `ws://localhost:8765` with any WebSocket client and send:
```json
{ "type": "trigger_tracking", "camera_id": "cam_01" }
{ "type": "stop_tracking", "camera_id": "cam_01" }
```

---

## Cross-Platform Compatibility

| Feature | Windows | Linux | macOS |
|---------|---------|-------|-------|
| Frontend (Browser) | ✅ | ✅ | ✅ |
| Backend Server | ✅ | ✅ | ✅ |
| Path handling | `path.join()` | `path.join()` | `path.join()` |
| Signal handling | SIGINT (readline) | SIGINT/SIGTERM | SIGINT/SIGTERM |
| No shell commands | ✅ | ✅ | ✅ |

---

## Visual Theme

The monitoring dashboard uses a **"Hacking / Tracking / Dark Web"** terminal aesthetic:

- **Background**: Near-black (#0a0e0a) with Matrix rain effect
- **Accents**: Matrix green (#00ff41) for normal elements
- **Tracking**: Red (#ff0040) pulsing borders, "TARGET ACQUIRED" HUD overlay
- **Fonts**: Fira Code / JetBrains Mono monospace throughout
- **Effects**: CRT scanlines, glow/text-shadow, blinking cursor accents
- **HUD**: Corner brackets, coordinate readout, confidence display, timestamp overlay

---

## Non-Negotiable Constraints Met

- ✅ **8:5 aspect ratio** never distorts (any mode, any screen size)
- ✅ **Mode transitions** are fully automatic based on backend events
- ✅ **Manual fullscreen** always has a clear exit (ESC key + Close button)
- ✅ **Modular code** — layout engine, WS client, theme, backend are independent
- ✅ **Cross-platform** — runs on Windows, Linux, macOS without modification
- ✅ **Async backend** — each camera is an independent async handler
- ✅ **No polling** — WebSocket push for all real-time events
- ✅ **Reconnection** — exponential backoff with fallback to simulation
