<div align="center">

# 🎬 SyncParty

**Production-ready synchronized online Watch Party platform with server-authoritative clock synchronization, multi-provider playback, real-time chat, and Docker support.**

[![CI](https://github.com/newabolup/syncparty/actions/workflows/ci.yml/badge.svg)](https://github.com/newabolup/syncparty/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-black.svg)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## 🌟 Overview

**SyncParty** is a full-featured, real-time synchronized video watch party platform designed to keep every participant in sub-second sync regardless of latency, buffering, network jitter, or reconnection events.

Unlike basic implementations that simply broadcast play and pause triggers, SyncParty implements an **authoritative server clock synchronization engine** (NTP-style clock offset estimation) paired with a **dual-threshold drift correction model**.

---

## ✨ Features

- **Authoritative Server Playback Clock**: Monotonically advancing state engine maintaining absolute time, position, playback rate, and sequence revisions.
- **Sub-Second Synchronization**: Dual-threshold drift correction automatically performs smooth micro-rate speed adjustments (0.95x / 1.05x) for subtle latency differences and hard seeks for major desynchronizations.
- **Multi-Provider Video Engine**:
  - Direct HTML5 video streams (`.mp4`, `.webm`, `.ogg`).
  - Adaptive bitrate HLS (`.m3u8`) streaming with automatic and manual quality level selection (1080p, 720p, 480p, etc.).
  - YouTube video embedding with synchronized timeline and play/pause controls.
- **Autoplay Policy Handling**: Intelligent detection of browser autoplay restrictions with an interactive *"Click to Unmute & Sync"* overlay, ensuring immediate audio/video sync without user frustration.
- **Host Controls & Permissions**:
  - Room creator is automatically designated as Host.
  - Optional **Host-Only Controls** toggle to prevent participants from hijacking playback.
  - Automatic host election and reassignment if the current host disconnects.
- **Room Management & Security**:
  - Unique shareable room URLs (`/room/:roomId`).
  - Optional room password protection hashed with `bcrypt`.
  - IP-based rate limiting on room creation and password verification attempts.
- **Real-Time Room Chat**:
  - Live chat stream with message timestamps, user color tags, and Host badges.
  - System event notifications (e.g. member joined, playback paused at 04:12, host changed).
  - Built-in HTML sanitization and per-socket rate limiting to prevent spam and XSS.
- **Presence & Participant Management**:
  - Real-time online participant roster.
  - Buffering indicators showing when participants are temporarily stalled.
- **Clean Modern UI**:
  - Cinema dark mode built with React, Vite, Tailwind CSS, and Lucide icons.
  - Responsive design supporting mobile, tablet, and desktop viewports.
  - Per-user volume and mute settings persisted locally in `localStorage`.
- **Production-Ready Architecture**:
  - Fully typed npm workspaces monorepo (`@syncparty/shared`, `@syncparty/server`, `@syncparty/client`).
  - Prisma ORM with PostgreSQL database schema and SQLite support for zero-config testing.
  - Multi-stage production `Dockerfile` and `docker-compose.yml`.
  - Comprehensive automated test suites with Vitest.

---

## 📐 Mathematical Synchronization Protocol

### 1. NTP-Style Clock Synchronization

Network latency causes the client's local system clock to differ from the server's clock. To calculate the authoritative video position accurately, each client continuously calculates its clock offset $\Delta_{\text{clock}}$:

$$RTT = (t_3 - t_0) - (t_2 - t_1)$$

$$L = \frac{RTT}{2}$$

$$\Delta_{\text{clock}} = \frac{(t_1 - t_0) + (t_2 - t_3)}{2}$$

Where:
- $t_0$: Timestamp when client dispatches `sync:ping`
- $t_1$: Server timestamp upon receiving `sync:ping`
- $t_2$: Server timestamp upon transmitting `sync:pong`
- $t_3$: Client timestamp upon receiving `sync:pong`

A rolling window of the last 7 samples is filtered using a **median filter** to eliminate latency spikes and jitter.

### 2. Authoritative Position Projection

When playing, the expected video position at any moment is calculated on the client as:

$$T_{\text{server}} = \text{Date.now}() + \Delta_{\text{clock}}$$

$$\Delta t_{\text{elapsed}} = \frac{T_{\text{server}} - \text{State.serverTimestamp}}{1000}$$

$$\text{ExpectedPosition} = \text{State.position} + (\Delta t_{\text{elapsed}} \times \text{State.playbackRate})$$

### 3. Dual-Threshold Drift Correction Model

The difference between the local player's `currentTime` and `ExpectedPosition` defines the drift:

$$\text{Drift} = \text{CurrentTime} - \text{ExpectedPosition}$$

| Drift Range | Action | Description |
|---|---|---|
| $|\text{Drift}| \le 250\text{ms}$ | **In Sync** | Client is in sync. Playback runs at standard rate. |
| $250\text{ms} < \text{Drift} \le 2000\text{ms}$ | **Smooth Slow Down** | Client is slightly ahead. Rate adjusted to $0.95\times$ until aligned. |
| $-2000\text{ms} \le \text{Drift} < -250\text{ms}$ | **Smooth Speed Up** | Client is slightly behind. Rate adjusted to $1.05\times$ until caught up. |
| $|\text{Drift}| > 2000\text{ms}$ | **Hard Seek** | Significant divergence (e.g. late join or seek). Video seeks directly to $\text{ExpectedPosition}$. |

This dual-threshold strategy prevents jarring audio skips and video stutter during minor network fluctuations.

---

## 📂 Project Structure

```
syncparty/
├── .github/workflows/ci.yml       # GitHub Actions CI pipeline
├── docker-compose.yml             # Production Docker Compose (PostgreSQL + App)
├── Dockerfile                     # Optimized multi-stage Docker build
├── package.json                   # Root monorepo workspace configuration
├── .env.example                   # Environment variable templates
├── packages/
│   ├── shared/                    # Shared types, Zod schemas, sync math
│   │   ├── src/
│   │   │   ├── types.ts           # PlaybackState, RoomMember, Socket contracts
│   │   │   ├── constants.ts       # Sync tolerances, thresholds, sample URLs
│   │   │   ├── validation.ts      # Zod input schemas & provider detection
│   │   │   └── sync-math.ts       # Clock offset & drift correction logic
│   │   └── tests/                 # Unit tests for sync algorithms
│   │
│   ├── server/                    # Node.js + Express + Socket.IO backend
│   │   ├── prisma/                # Prisma schema & migrations
│   │   ├── src/
│   │   │   ├── config.ts          # Zod-validated environment config
│   │   │   ├── app.ts             # Express app with security headers & static serving
│   │   │   ├── index.ts           # HTTP & Socket.IO server entry
│   │   │   ├── services/          # Authoritative RoomManager & playback state
│   │   │   ├── socket/            # Socket.IO sync, chat, and lifecycle handlers
│   │   │   ├── routes/            # REST API routes (rooms, health)
│   │   │   └── middleware/        # Rate limiting and error handling
│   │   └── tests/                 # Server playback engine & API test suites
│   │
│   └── client/                    # React 18 + TypeScript + Vite frontend
│       ├── src/
│       │   ├── hooks/             # useSyncEngine synchronization hook
│       │   ├── services/          # REST API & Socket.IO client services
│       │   └── components/
│       │       ├── landing/       # Landing page (Create & Join forms)
│       │       ├── room/          # Watch room layout, participants & settings
│       │       ├── player/        # Multi-provider VideoPlayer & custom controls
│       │       ├── chat/          # Real-time room chat panel
│       │       └── common/        # Navbar, modals, and toast alerts
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js**: `v20.0.0` or later
- **npm**: `v10.0.0` or later

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/newabolup/syncparty.git
cd syncparty
npm install
```

### 2. Configure Environment

Copy the example configuration:

```bash
cp .env.example .env
```

The default `.env` is preconfigured to use SQLite locally for zero external dependencies.

### 3. Initialize Database

Generate the Prisma Client and push the database schema:

```bash
npm run prisma:generate --workspace=@syncparty/server
npm run prisma:push --workspace=@syncparty/server
```

### 4. Run Automated Tests

Execute all synchronization and backend test suites:

```bash
npm test
```

### 5. Start Development Servers

Run both the backend server and frontend Vite server concurrently:

```bash
# Terminal 1: Start backend server (port 5000)
npm run dev:server

# Terminal 2: Start frontend client (port 5173)
npm run dev:client
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🐳 Production Deployment (Docker Compose)

SyncParty includes full Docker support with PostgreSQL 16 and a production build of the unified application.

### 1. Launch with Docker Compose

```bash
docker compose up -d --build
```

This starts:
1. **`syncparty_postgres`**: PostgreSQL 16 Alpine with healthchecks and persistent storage.
2. **`syncparty_app`**: Multi-stage production container running the API, WebSockets, and serving optimized static client assets on port `5000`.

### 2. Verify Deployment

Access the application:
- **Application**: [http://localhost:5000](http://localhost:5000)
- **Healthcheck**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 3. Stop Containers

```bash
docker compose down
```

---

## 📡 API & WebSocket Specification

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Healthcheck returning uptime, memory, and active room count |
| `POST` | `/api/rooms` | Create a new watch room (returns slug and hostToken) |
| `GET` | `/api/rooms/:slug` | Fetch public room metadata |
| `POST` | `/api/rooms/:slug/verify` | Verify password for protected rooms |

### WebSocket Events (Socket.IO)

#### Client $\to$ Server

| Event | Payload | Description |
|---|---|---|
| `room:join` | `{ roomId, username, password?, hostToken? }` | Join or authenticate in a room |
| `sync:ping` | `{ clientSendTime: number }` | NTP clock synchronization ping |
| `playback:action` | `{ action: 'play'\|'pause'\|'seek'\|'rate'\|'change_video', position?, playbackRate?, url? }` | Request playback state update |
| `playback:buffer_state` | `{ isBuffering: boolean, position: number }` | Report buffering status |
| `chat:send` | `{ content: string }` | Send a chat message |
| `room:settings_update` | `{ isHostOnlyControls?, password?, videoUrl? }` | Update room settings (Host only) |

#### Server $\to$ Client

| Event | Payload | Description |
|---|---|---|
| `room:joined` | Full room snapshot (state, members, messages) | Sent immediately upon successful join |
| `sync:pong` | `{ clientSendTime, serverReceiveTime, serverTransmitTime }` | NTP clock response |
| `playback:state_update` | `PlaybackState` | Broadcast authoritative playback changes |
| `room:members_update` | `RoomMember[]` | Broadcast online participant changes |
| `chat:receive` | `ChatMessage` | Broadcast new chat or system message |
| `room:settings_changed` | Updated settings metadata | Broadcast setting modifications |
| `room:error` | `{ message: string, code?: string }` | Error notification |

---

## 🔒 Security & Edge Cases

- **Host Reassignment**: If the host disconnects, leadership is automatically passed to the oldest remaining participant to keep the room functional.
- **Late Join Synchronization**: New participants receive the authoritative `PlaybackState` immediately upon joining, calculate elapsed server time, and seek to the exact current playback frame.
- **Reconnection Handling**: Temporary socket drops automatically reconnect with exponential backoff and request a fresh state sync without resetting playback.
- **XSS Prevention**: All chat inputs are sanitized and escaped before broadcast.
- **Rate Limiting**: Express middleware limits room creation to 30 requests per 15 minutes per IP and password verification to 10 attempts per minute.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
