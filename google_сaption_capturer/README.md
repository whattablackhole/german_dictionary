# Chrome Live Caption Capture

A Windows utility that intercepts Chrome's built-in Live Caption text using the Windows UI Automation API and saves transcriptions to a file in real-time.

## How It Works

Chrome's Live Caption displays real-time captions in a native overlay window. This tool uses the **Windows UI Automation API** (via the `uiautomation` Python library) to:

1. Find Chrome's Live Caption UI element
2. Poll its text content every 200ms
3. Detect changes and append new text to a timestamped log file

This approach captures the **exact text** that Chrome's on-device ML generates — no re-recognition, no microphone access needed.

## Requirements

- **Windows** (uses Windows-specific UI Automation API)
- **Python 3.7+**
- **Google Chrome** with Live Caption enabled

## Installation

```bash
# Install dependencies
pip install uiautomation comtypes
```

## Usage

### 1. Enable Chrome Live Caption

1. Open Chrome
2. Go to **Settings** → **Advanced** → **Accessibility**
3. Turn on **"Live Caption"**
4. Play any audio/video content — a small caption window will appear

### 2. Run the capture tool

```bash
# Start capturing (default output: transcripts/transcript_TIMESTAMP.txt)
python live_caption_capture.py

# Specify a custom output file
python live_caption_capture.py --output my_transcript.txt

# Specify a custom output directory
python live_caption_capture.py --dir my_captions

# Inspect Chrome UI elements (debug mode)
python live_caption_capture.py --inspect
```

### 3. Stop capturing

Press **Ctrl+C** to stop gracefully. The transcript file will be finalized.

## Output Format

Transcripts are saved as plain text files with timestamps:

```
============================================================
Chrome Live Caption Transcription
Started: 2026-08-17 14:30:00.123
============================================================

[2026-08-17 14:30:05.456] Hello and welcome to today's presentation
[2026-08-17 14:30:08.789] we're going to discuss some important topics
[2026-08-17 14:30:12.234] first let me introduce myself

============================================================
Capture stopped: 2026-08-17 14:35:22.456
============================================================
```

## Troubleshooting

### "Live Caption not found"
- Make sure Chrome is running
- Ensure Live Caption is enabled in Chrome settings
- Play some audio/video to trigger the caption window
- Try `--inspect` mode to debug

### Permission issues
Run the terminal as Administrator if the tool can't access Chrome's UI elements.

## Limitations

- **Windows only** (uses Windows UI Automation API)
- Chrome must be running with Live Caption enabled
- Polling-based (200ms interval) — may miss very rapid text changes
- The Live Caption window must be visible (not minimized/occluded) for the API to read it

## License

MIT