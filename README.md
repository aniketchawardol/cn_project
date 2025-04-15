# Selective Repeat ARQ Protocol Simulator

This project is an interactive simulation of the Selective Repeat ARQ (Automatic Repeat reQuest) protocol, commonly used in computer networks for reliable data transfer. The simulation helps visualize how the protocol handles packet transmission, acknowledgments, timeouts, and error recovery.

## Features

- **Interactive Simulation**: Step-by-step or continuous mode visualization
- **Configurable Parameters**:
  - Set which frames/ACKs will be lost during transmission
  - Adjust simulation speed
- **Visual Elements**:
  - Sliding windows for both sender and receiver
  - Packet timers with adaptive timeout
  - Frame transmission animations
  - ACK transmission animations
  - Error visualization
- **Real-time Status**: Logs showing current transmission state and events

## Technologies Used

- React
- Electron (for desktop application)
- TailwindCSS
- Framer Motion

## Getting Started

### Prerequisites

- Node.js and npm installed

### Installation

```bash
npm i
```

### Development

```bash
npm run dev
```

### Building and Running

```bash
npm run build

npm start  # To start desktop application
```

### Packaging

Create a standalone executable (.exe on Windows):

```bash
electron-packager . MyApp --platform=win32 --arch=x64 --out=release --overwrite --no-package-lock
```

This generates a .exe inside `release/MyApp/` directory.

## How to Use the Simulator

1. **Configure Parameters**:

   - Set which frames to lose (0-3)
   - Set which ACKs to lose (0-3)

2. **Control Simulation**:

   - Use "Previous Step" and "Next Step" buttons for step-by-step simulation
   - Toggle "Continuous" for automatic simulation
   - Adjust speed with the slider
   - Reset simulation at any point

3. **Observe the Protocol**:
   - Watch sender and receiver windows slide
   - See packet timers for unacknowledged frames
   - Observe error recovery through retransmissions

## Learning Objectives

- Understand window-based flow control
- See how selective retransmission works
- Visualize the effects of lost packets and acknowledgments
- Learn about adaptive timeout mechanisms
