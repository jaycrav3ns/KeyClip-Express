const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const archiver = require('archiver');
const fs = require('fs').promises;
const app = express();
const port = 3001;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configure CORS
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Ensure uploads and outputs directories exist
fs.mkdir('./uploads', { recursive: true });
fs.mkdir('./outputs', { recursive: true });

// Serve static files (for downloading clipped videos)
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// Upload video
app.post('/upload-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }
    res.json({ filename: req.file.filename, path: req.file.path });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ error: 'Error uploading file' });
  }
});

// Get keyframes and PTS data
app.post('/get-keyframes', async (req, res) => {
  const { videoPath } = req.body;

  if (!videoPath) {
    return res.status(400).json({ error: 'videoPath is required' });
  }

  try {
    const ffprobeCommand = `ffprobe -v error -select_streams v:0 -show_entries frame=key_frame,pts_time -of csv=p=0 "${videoPath}" 2>/dev/null`;
    const { stdout } = await execPromise(ffprobeCommand);

    const keyframes = [];
    const lines = stdout.trim().split('\n');
    let frameIndex = 0;

    for (const line of lines) {
      if (!line.startsWith('1,')) continue;
      const [, ptsTime] = line.split(',');
      const pts = parseFloat(ptsTime);
      if (!isNaN(pts)) {
        frameIndex += 1;
        keyframes.push({
          frameNumber: frameIndex,
          ptsTime: pts,
        });
      }
    }

    if (keyframes.length === 0) {
      console.warn('No keyframes found in video:', videoPath);
    }

    console.log('Keyframes:', keyframes);
    res.json(keyframes);
  } catch (err) {
    console.error('Error extracting keyframes:', err.message, err.stderr || '');
    res.status(500).json({ error: 'Error fetching keyframes', details: err.message });
  }
});

// Clip video
app.post('/clip-video', async (req, res) => {
  const { videoPath, startTime, endTime } = req.body;
  if (!videoPath || startTime == null || endTime == null || startTime >= endTime) {
    return res.status(400).json({ error: 'Invalid input: videoPath, startTime, and endTime required' });
  }

  const outputFile = path.join(__dirname, 'outputs', `clipped-${Date.now()}.mp4`);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .outputOptions('-c:v copy')
        .outputOptions('-c:a copy')
        .output(outputFile)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const outputUrl = `/outputs/${path.basename(outputFile)}`;
    res.json({ outputUrl });
  } catch (err) {
    console.error('Error clipping video:', err);
    res.status(500).json({ error: 'Error clipping video', details: err.message });
  }
});

// Batch export endpoint: Create clips as files, then zip them
app.post('/export-zip', async (req, res) => {
  const { videoPath, clips } = req.body;
  if (!videoPath || !Array.isArray(clips) || clips.length === 0) {
    return res.status(400).json({ error: 'Invalid input: videoPath and clips array required' });
  }

  const tempDir = path.join(__dirname, 'outputs', `temp-${Date.now()}`);
  const zipFilename = `clips-${Date.now()}.zip`;

  try {
    // Create temporary directory for clips
    await fs.mkdir(tempDir, { recursive: true });

    // Generate clips
    const clipFiles = [];
    for (const [index, clip] of clips.entries()) {
      if (clip.startTime == null || clip.endTime == null || clip.startTime >= clip.endTime) {
        console.warn(`Invalid clip ${index}:`, clip);
        continue;
      }
      const label = (clip.label || `clip-${index + 1}`).replace(/[^\w\-]/g, '_');
      const outputFile = path.join(tempDir, `${label}.mp4`);
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .setStartTime(clip.startTime)
          .setDuration(clip.endTime - clip.startTime)
          .outputOptions('-c:v copy')
          .outputOptions('-c:a copy')
          .output(outputFile)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      clipFiles.push({ path: outputFile, name: `${label}.mp4` });
    }

    // Create zip archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    res.attachment(zipFilename);
    archive.pipe(res);

    // Add clips to zip
    for (const clipFile of clipFiles) {
      archive.file(clipFile.path, { name: clipFile.name });
    }

    // Finalize the archive
    await archive.finalize();

    // Clean up temporary files
    for (const clipFile of clipFiles) {
      await fs.unlink(clipFile.path).catch(() => {});
    }
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  } catch (err) {
    console.error('Error exporting zip:', err);
    res.status(500).json({ error: 'Error creating zip', details: err.message });
    // Clean up on error
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

// Merge clips endpoint
app.post('/merge-clips', async (req, res) => {
    const { videoPath, clips } = req.body;
    if (!videoPath || !Array.isArray(clips) || clips.length < 2) {
        return res.status(400).json({ error: 'At least two clips and videoPath required' });
    }

    const tempDir = path.join(__dirname, 'outputs', `temp-merge-${Date.now()}`);
    const outputFile = path.join(__dirname, 'outputs', `merged-${Date.now()}.mp4`);
    const concatListPath = path.join(tempDir, 'concat_list.txt');

    try {
        // Create temporary directory
        await fs.mkdir(tempDir, { recursive: true });

        // Generate individual clips
        const clipFiles = [];
        for (const [index, clip] of clips.entries()) {
            if (clip.startTime == null || clip.endTime == null || clip.startTime >= clip.endTime) {
                console.warn(`Invalid clip ${index}:`, clip);
                continue;
            }
            const clipFile = path.join(tempDir, `clip-${index}.mp4`);
            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .setStartTime(clip.startTime)
                    .setDuration(clip.endTime - clip.startTime)
                    .outputOptions('-c:v copy')
                    .outputOptions('-c:a copy')
                    .output(clipFile)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            clipFiles.push(clipFile);
        }

        // Create concat list file
        const concatListContent = clipFiles.map(file => `file '${file}'`).join('\n');
        await fs.writeFile(concatListPath, concatListContent);

        // Concatenate clips
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(concatListPath)
                .inputOptions('-f concat')
                .inputOptions('-safe 0')
                .outputOptions('-c copy')
                .output(outputFile)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        const outputUrl = `/outputs/${path.basename(outputFile)}`;
        res.json({ outputUrl });

        // Clean up temporary files
        for (const clipFile of clipFiles) {
            await fs.unlink(clipFile).catch(() => {});
        }
        await fs.unlink(concatListPath).catch(() => {});
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    } catch (err) {
        console.error('Error merging clips:', err);
        res.status(500).json({ error: 'Error merging clips', details: err.message });
        // Clean up on error
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
