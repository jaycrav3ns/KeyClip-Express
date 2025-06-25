# KeyClip-Express

**KeyClip-Express** is a fast, browser-based video clipper and exporter, inspired by [LosslessCut](https://github.com/mifi/lossless-cut).  
It lets you visually select, label, and export multiple video clips with frame accuracy—right in your browser!
Powered by a local Node.js/Express/FFmpeg backend.

## Features

- **Import Video**: Load local videos for instant preview and editing.
- **Visual Timeline**: Select start/end points, drag handles, and view all keyframes.
- **Multiple Clips**: Mark and label as many clips as you want before exporting.
- **Clip List Panel**: Organize, jump to, and rename your clips.
- **Batch Export**: Download all clips at once as a ZIP file, processed via FFmpeg.
- **Keyframe Navigation**: Jump to previous/next keyframe for perfect cuts.
- **Modern UI**: Clean, dark-themed interface with intuitive controls.

---

## Screenshots

![keyclip-express1](https://github.com/user-attachments/assets/e528c151-3e8b-4768-9165-8742adbffa15)

![Untitled](https://github.com/user-attachments/assets/e4fc4901-b160-4aa9-b06d-d99b426c8d4b)

---

## Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [FFmpeg](https://ffmpeg.org/) installed and in your PATH

### 2. Installation

```bash
git clone https://github.com/jaycrav3ns/KeyClip-Express.git
cd KeyClip-Express
npm install
```

### 3. Start the Server

```bash
node server.js
```
The app will be available at [http://localhost:3001](http://localhost:3001).

### 4. Usage

1. Open the web app in your browser.
2. Click **Open** (folder icon) to load a video from your computer.
3. Use the timeline and controls to select your desired clip range(s).
4. Click **Cut** to add clips to your list, rename if desired.
5. When ready, click **Export All** to download every clip as a ZIP.

---

## Why KeyClip-Express?

- **No Uploads:** Your videos never leave your computer—processing is local.
- **Super Fast:** Powered FFmpeg. Keyframe segmenting enables direct stream copying.
- **Batch Workflow:** Prepare all your clips first, then export in one go.
- **Modern Experience:** Clean UI, keyboard shortcuts (coming soon!), and a focus on usability.

---

## Roadmap & Contributions

- [ ] Drag-and-drop video loading
- [ ] Keyboard shortcuts
- [ ] Visual clip color-coding on timeline
- [ ] Clip reorder and merge
- [ ] Settings (output format, etc.)

**Pull requests and suggestions are very welcome!**  
Open an issue for bug reports or feature requests.

---

## License

CC0-1.0 license

---

### Credits

- Built by [jaycrav3ns](https://github.com/jaycrav3ns)
- Inspired by [LosslessCut](https://github.com/mifi/lossless-cut)
