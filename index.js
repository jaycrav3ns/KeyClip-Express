const video = document.getElementById('video-player');
const timeline = document.getElementById('timeline');
const timelineTicks = document.getElementById('timeline-ticks');
const playhead = document.getElementById('playhead');
const fileInput = document.getElementById('file-input');
const openBtn = document.getElementById('open');
const playPauseBtn = document.getElementById('play-pause');
const closeBtn = document.getElementById('close');
const stopBtn = document.getElementById('stop');
const cutBtn = document.getElementById('cut');
const prevKeyframeBtn = document.getElementById('prev-keyframe');
const nextKeyframeBtn = document.getElementById('next-keyframe');
const setStartBtn = document.getElementById('set-start');
const setEndBtn = document.getElementById('set-end');
const startMarker = document.querySelector('.start-marker');
const endMarker = document.querySelector('.end-marker');
const selectedRange = document.querySelector('.selected-range');
const exportRangeBtn = document.getElementById('export-range');
const exportClipsBtn = document.getElementById('export-clips');
const toggleClipListBtn = document.getElementById('toggle-clip-list');
const clipListPanel = document.getElementById('clip-list-panel');

async function exportClips() {
    if (clips.length === 0) {
        showToast('No clips to export');
        return;
    }
    showToast('Preparing zip...');
    try {
        const response = await fetch('http://localhost:3001/export-zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: currentVideoPath,
                clips: clips.map(({ startTime, endTime, label }) => ({ startTime, endTime, label })),
            }),
        });
        if (!response.ok) throw new Error('Failed to export clips');
        // Download the zip
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'clips.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast('Exported all clips as zip.');
    } catch (err) {
        console.error('Error exporting zip:', err);
        showToast('Error exporting zip');
    }
}

exportClipsBtn.addEventListener('click', exportClips);

async function exportRange() {
    if (!currentVideoPath) {
        showToast('No video loaded');
        return;
    }
    if (startTime >= endTime || startTime < 0 || endTime > video.duration) {
        showToast('Invalid start or end time');
        return;
    }
    try {
        const response = await fetch('http://localhost:3001/clip-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: currentVideoPath,
                startTime,
                endTime,
            }),
        });
        if (!response.ok) throw new Error('Failed to export clip');
        const { outputUrl } = await response.json();
        const a = document.createElement('a');
        a.href = `http://localhost:3001${outputUrl}`;
        a.download = 'clip.mp4';
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Exported clip.');
    } catch (err) {
        console.error('Error exporting clip:', err);
        showToast('Error exporting clip');
    }
}

exportRangeBtn.addEventListener('click', exportRange);

let startTime = 0;
let endTime = 0;
let keyframes = [];
let currentVideoPath = '';
let clips = [];

function formatTime(time) {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function createTimelineTicks() {
if (!video.duration) return;
timelineTicks.innerHTML = '';
const duration = video.duration;
const tickInterval = duration < 60 ? 5 : duration < 300 ? 30 : 60; // 5s, 30s, or 60s intervals
const majorTickInterval = tickInterval * 4;
for (let time = 0; time <= duration; time += tickInterval) {
const tick = document.createElement('div');
tick.className = time % majorTickInterval === 0 ? 'timeline-tick major' : 'timeline-tick';
tick.style.left = `${(time / duration) * 100}%`;
timelineTicks.appendChild(tick);
if (time % majorTickInterval === 0) {
const label = document.createElement('div');
label.className = 'timeline-tick-label';
label.style.left = `${(time / duration) * 100}%`;
label.textContent = formatTime(time);
timelineTicks.appendChild(label);
}
}
}

function updateTimeline() {
    if (isNaN(video.duration)) {
        // Video duration not yet loaded
        document.getElementById('current-time').textContent = formatTime(video.currentTime);
        document.getElementById('total-time').textContent = '00:00:00';
        return;
    }
  const progress = (video.currentTime / video.duration) * 100;
  playhead.style.left = `${progress}%`;
  document.getElementById('current-time').textContent = formatTime(video.currentTime);
  document.getElementById('total-time').textContent = formatTime(video.duration);
  // Update selection duration
  const selectionDuration = endTime - startTime;
  document.getElementById('selection-duration').textContent = `Selection: ${formatTime(selectionDuration)}`;
}

function updateSelectedRange() {
  const startPosition = (startTime / video.duration) * 100;
  const endPosition = (endTime / video.duration) * 100;
  selectedRange.style.left = `${startPosition}%`;
  selectedRange.style.width = `${endPosition - startPosition}%`;
  startMarker.style.left = `${startPosition}%`;
  endMarker.style.left = `${endPosition}%`;
  // Update selection duration display
  const selectionDuration = endTime - startTime;
  document.getElementById('selection-duration').textContent = `Selection: ${formatTime(selectionDuration)}`;
}

function updateClipHighlights() {
    // Remove old highlights
    document.querySelectorAll('.clip-highlight').forEach(el => el.remove());
    clips.forEach((clip, idx) => {
        const highlight = document.createElement('div');
        highlight.className = 'clip-highlight';
        highlight.style.position = 'absolute';
        highlight.style.height = '100%';
        // Use a color palette or alternate for each clip
        highlight.style.backgroundColor = getClipColor(idx);
        highlight.style.left = (clip.startTime / video.duration * 100) + '%';
        highlight.style.width = ((clip.endTime - clip.startTime) / video.duration * 100) + '%';
        highlight.title = `${clip.label}: ${formatTime(clip.startTime)} - ${formatTime(clip.endTime)}`;
        timeline.appendChild(highlight);
    });
}

// Helper to alternate colors for each clip
function getClipColor(idx) {
    const palette = [
        'rgba(230,196,0,0.4)',
        'rgba(74,144,226,0.3)',
        'rgba(46,204,113,0.3)',
        'rgba(231,76,60,0.3)',
        'rgba(155,89,182,0.3)'
    ];
    return palette[idx % palette.length];
}

function addClip() {
    if (startTime >= endTime || startTime < 0 || endTime > video.duration) {
        showToast('Invalid start or end time');
        return;
    }
    const newClip = {
        id: Date.now(), // Unique identifier
        label: `Clip ${clips.length + 1}`,
        startTime: startTime,
        endTime: endTime,
    };
    clips.push(newClip);
    updateClipList();
    updateClipHighlights();
    showToast(`Added clip: ${newClip.label}`);
}

function updateClipList() {
    const clipList = document.getElementById('clip-list');
    clipList.innerHTML = '';
    clips.forEach((clip) => {
        const li = document.createElement('li');
        // Editable label
        const labelSpan = document.createElement('span');
        labelSpan.contentEditable = true;
        labelSpan.textContent = clip.label;
        labelSpan.className = 'clip-label';
        labelSpan.onblur = () => {
            clip.label = labelSpan.textContent;
        };
        // Jump-to button
        const jumpBtn = document.createElement('button');
        jumpBtn.textContent = 'Jump';
        jumpBtn.onclick = () => {
            video.currentTime = clip.startTime;
        };
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteClip(clip.id);
        li.appendChild(labelSpan);
        li.appendChild(document.createTextNode(`: ${formatTime(clip.startTime)} - ${formatTime(clip.endTime)}`));
        li.appendChild(jumpBtn);
        li.appendChild(deleteBtn);
        clipList.appendChild(li);
    });
    exportClipsBtn.disabled = clips.length === 0;
}

function deleteClip(id) {
    clips = clips.filter((clip) => clip.id !== id);
    updateClipList();
    updateClipHighlights();
    showToast('Clip deleted');
}

toggleClipListBtn.addEventListener('click', () => {
    clipListPanel.style.display = clipListPanel.style.display === 'none' ? 'block' : 'none';
});

cutBtn.addEventListener('click', addClip);

timeline.addEventListener('click', (e) => {
  const rect = timeline.getBoundingClientRect();
  const clickPosition = (e.clientX - rect.left) / rect.width;
  video.currentTime = clickPosition * video.duration;
});

video.addEventListener('timeupdate', updateTimeline);

video.addEventListener('loadedmetadata', () => {
    if (isNaN(video.duration)) {
        // Duration not yet loaded, wait for durationchange event
        video.addEventListener('durationchange', () => {
            endTime = video.duration;
            updateSelectedRange();
            createTimelineTicks();
        }, { once: true }); // Remove listener after it fires once
    } else {
        // Duration already loaded
        endTime = video.duration;
        updateSelectedRange();
        createTimelineTicks();
    }
});

openBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const formData = new FormData();
    formData.append('video', file);
    try {
      const response = await fetch('http://localhost:3001/upload-video', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Failed to upload video');
      }
      const { filename, path } = await response.json();
      currentVideoPath = path;
      const videoURL = URL.createObjectURL(file);
      video.src = videoURL;

      showToast('Scanning frames...', 5000);
      const keyframeResponse = await fetch('http://localhost:3001/get-keyframes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: path }),
      });
      if (!keyframeResponse.ok) {
        const errorData = await keyframeResponse.json();
        throw new Error(errorData.error || 'Error fetching keyframes');
      }
      keyframes = await keyframeResponse.json();
      console.log('Keyframes:', keyframes);
      clips = [];
      updateClipList();
      updateClipHighlights();
      cutBtn.disabled = false;
      exportClipsBtn.disabled = true;
      playPauseBtn.disabled = false;
      prevKeyframeBtn.disabled = keyframes.length === 0;
      nextKeyframeBtn.disabled = keyframes.length === 0;
      showToast(`Loaded ${keyframes.length} keyframes`);
    } catch (err) {
      console.error('Error uploading video:', err);
      showToast(err.message || 'Error uploading video');
    }
  }
});

playPauseBtn.addEventListener('click', () => {
  const playPauseIcon = document.getElementById('play-pause-icon');
  if (video.paused) {
    video.play();
    playPauseIcon.classList.remove('fa-play');
    playPauseIcon.classList.add('fa-pause');
  } else {
    video.pause();
    playPauseIcon.classList.remove('fa-pause');
    playPauseIcon.classList.add('fa-play');
  }
});

closeBtn.addEventListener('click', () => {
  if (video.src) {
    URL.revokeObjectURL(video.src);
  }
  video.src = '';
  currentVideoPath = '';
  keyframes = [];
  clips = [];
  updateClipList();
  updateClipHighlights();
  cutBtn.disabled = true;
  exportClipsBtn.disabled = true;
  playPauseBtn.disabled = true;
  const playPauseIcon = document.getElementById('play-pause-icon');
  playPauseIcon.classList.remove('fa-pause');
  playPauseIcon.classList.add('fa-play');
  fileInput.value = '';
});

stopBtn.addEventListener('click', () => {
  video.pause();
  video.currentTime = 0;
  const playPauseIcon = document.getElementById('play-pause-icon');
  playPauseIcon.classList.remove('fa-pause');
  playPauseIcon.classList.add('fa-play');
});

setStartBtn.addEventListener('click', () => {
  startTime = video.currentTime;
  updateSelectedRange();
});

setEndBtn.addEventListener('click', () => {
  endTime = video.currentTime;
  updateSelectedRange();
});

let isDragging = false;
let dragTarget = null;

function startDrag(e) {
  isDragging = true;
  dragTarget = e.target;
}

function stopDrag() {
  isDragging = false;
  dragTarget = null;
}

function drag(e) {
  if (!isDragging) return;
  const rect = timeline.getBoundingClientRect();
  const position = (e.clientX - rect.left) / rect.width;
  let time = position * video.duration;
    // Clamp the time value
    time = Math.max(0, Math.min(time, video.duration));
  if (dragTarget === startMarker) {
    startTime = Math.min(time, endTime);
  } else if (dragTarget === endMarker) {
    endTime = Math.max(time, startTime);
  }
  updateSelectedRange();
}

let throttleTimeout;

function throttledDrag(e) {
  if (!throttleTimeout) {
    drag(e); // Call the original drag function
    throttleTimeout = setTimeout(() => {
      throttleTimeout = null;
    }, 50); // Adjust the timeout (in milliseconds) as needed
  }
}

startMarker.addEventListener('mousedown', startDrag);
endMarker.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', throttledDrag);
document.addEventListener('mouseup', stopDrag);

prevKeyframeBtn.addEventListener('click', () => {
  if (keyframes.length === 0) return;
  const prevKeyframe = keyframes
    .filter((kf) => kf.ptsTime < video.currentTime)
    .sort((a, b) => b.ptsTime - a.ptsTime)[0];
  if (prevKeyframe) {
    video.currentTime = prevKeyframe.ptsTime;
  }
});

nextKeyframeBtn.addEventListener('click', () => {
  if (keyframes.length === 0) return;
  const nextKeyframe = keyframes
    .filter((kf) => kf.ptsTime > video.currentTime)
    .sort((a, b) => a.ptsTime - b.ptsTime)[0];
  if (nextKeyframe) {
    video.currentTime = nextKeyframe.ptsTime;
  }
});

function showToast(message, duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    // Show the toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    // Hide and remove the toast after the specified duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300); // Wait for the fade-out transition
    }, duration);
}
