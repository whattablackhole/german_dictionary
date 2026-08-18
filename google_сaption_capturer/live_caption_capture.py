"""
Chrome Live Caption Capture Utility
====================================
Intercepts Chrome's built-in Live Caption text using Windows UI Automation API
and saves transcriptions to a file in real-time.

Usage:
    python live_caption_capture.py              # Start capturing
    python live_caption_capture.py --inspect    # Inspect Chrome UI elements
    python live_caption_capture.py --output custom_output.txt  # Custom output file
"""

import argparse
import datetime
import os
import re
import signal
import sys
import time
from pathlib import Path

try:
    import uiautomation as auto
except ImportError:
    print("Error: uiautomation not installed. Run: pip install uiautomation comtypes")
    sys.exit(1)


# ─── Configuration ───────────────────────────────────────────────────────────

DEFAULT_OUTPUT_DIR = "transcripts"
POLL_INTERVAL = 0.2  # seconds between checks
CHROME_WINDOW_CLASS = "Chrome_WidgetWin_1"
CAPTION_BUBBLE_CLASS = "CaptionBubble"
CAPTION_LABEL_CLASS = "CaptionBubbleLabel"

# How long to wait (in seconds) after text stops changing before flushing
FLUSH_TIMEOUT = 1.5


# ─── Helpers ─────────────────────────────────────────────────────────────────

def get_timestamp() -> str:
    """Return current timestamp string for logging."""
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def get_filename_timestamp() -> str:
    """Return timestamp string suitable for filenames."""
    return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")


def sanitize_text(text: str) -> str:
    """Clean up caption text: strip whitespace, normalize spaces."""
    if not text:
        return ""
    text = text.strip()
    text = re.sub(r'\s+', ' ', text)
    return text


# ─── UI Inspection ───────────────────────────────────────────────────────────

def inspect_chrome_elements():
    """
    Walk through all Chrome windows and print their UI tree.
    Useful for finding the exact Live Caption element path.
    """
    print("=" * 70)
    print("CHROME UI ELEMENT INSPECTOR")
    print("=" * 70)
    print("Make sure Chrome is running with Live Caption enabled.")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            found_caption = False
            for window in _get_chrome_windows():
                try:
                    name = window.Name or "(unnamed)"
                    class_name = window.ClassName or "(no class)"
                    print(f"\nWindow: '{name}' | Class: {class_name}")

                    caption_text = _get_caption_text_from_window(window)
                    if caption_text is not None:
                        found_caption = True
                        print(f"  >>> LIVE CAPTION TEXT: '{caption_text}'")
                    else:
                        # Print top-level children for debugging
                        print("  Children (top-level):")
                        for i, child in enumerate(window.GetChildren()[:10]):
                            cname = child.Name or "(unnamed)"
                            cclass = child.ClassName or "(no class)"
                            print(f"    [{i}] '{cname}' | Class: {cclass}")
                except Exception as e:
                    print(f"  Error inspecting window: {e}")

            if found_caption:
                print("\n✓ Live Caption text found! The capture script will read this.")
                break

            time.sleep(2)

    except KeyboardInterrupt:
        print("\nInspection stopped.")


# ─── Core UI Automation Logic ────────────────────────────────────────────────

def _get_chrome_windows():
    """Get all Chrome windows from the UI Automation tree."""
    chrome_windows = []
    try:
        root = auto.GetRootControl()
        for child in root.GetChildren():
            if child.ClassName and CHROME_WINDOW_CLASS in child.ClassName:
                chrome_windows.append(child)
    except Exception:
        pass
    return chrome_windows


def _get_caption_text_from_window(window) -> str | None:
    """
    Extract Live Caption text from a Chrome window.
    Returns the caption text string, or None if not found.
    """
    try:
        # Navigate the UI tree to find the CaptionBubbleLabel
        # Structure: Window > RootView > NonClientView > CaptionBubbleFrameView >
        #            BoxLayoutView > DialogClientView > CaptionBubble > View > CaptionBubbleLabel
        children = window.GetChildren()
        if len(children) < 2:
            return None

        root_view = children[1]  # RootView
        if root_view.ClassName != "RootView":
            return None

        non_client_children = root_view.GetChildren()
        if not non_client_children:
            return None

        non_client = non_client_children[0]  # NonClientView
        frame_children = non_client.GetChildren()
        if not frame_children:
            return None

        caption_frame = frame_children[0]  # CaptionBubbleFrameView
        box_children = caption_frame.GetChildren()
        if len(box_children) < 2:
            return None

        dialog_client = box_children[1]  # DialogClientView
        dialog_children = dialog_client.GetChildren()
        if not dialog_children:
            return None

        caption_bubble = dialog_children[0]  # CaptionBubble
        if caption_bubble.ClassName != CAPTION_BUBBLE_CLASS:
            return None

        bubble_children = caption_bubble.GetChildren()
        if len(bubble_children) < 2:
            return None

        # The second child of CaptionBubble contains the text
        text_container = bubble_children[1]  # View containing CaptionBubbleLabel
        text_children = text_container.GetChildren()
        if not text_children:
            return None

        caption_label = text_children[0]  # CaptionBubbleLabel
        if caption_label.ClassName != CAPTION_LABEL_CLASS:
            return None

        text = caption_label.Name or ""
        return sanitize_text(text)

    except Exception:
        return None


def find_live_caption_window():
    """
    Find the Chrome window that contains Live Caption.
    Returns the window control if found, None otherwise.
    """
    for window in _get_chrome_windows():
        text = _get_caption_text_from_window(window)
        if text is not None:
            return window
    return None


def get_caption_text(window) -> str:
    """Get the current caption text from a Live Caption window."""
    text = _get_caption_text_from_window(window)
    return text or ""


# ─── Main Capture Logic ──────────────────────────────────────────────────────

class LiveCaptionCapture:
    """
    Captures Chrome Live Caption text and saves it to a file.
    Uses Windows UI Automation to read the caption text from Chrome's UI.
    """

    def __init__(self, output_dir: str = DEFAULT_OUTPUT_DIR, output_file: str = None):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        if output_file:
            self.output_path = Path(output_file)
        else:
            timestamp = get_filename_timestamp()
            self.output_path = self.output_dir / f"transcript_{timestamp}.txt"

        self.last_text = ""
        self.running = False
        self.caption_window = None
        self.last_write_time = time.time()
        self.last_flushed_text = ""  # Last complete text we wrote to file
        self.last_new_text = ""  # Track the last new text we extracted

    def _write_to_file(self, text: str):
        """Append new caption text to the output file with a timestamp."""
        if not text:
            return
        timestamp = get_timestamp()
        line = f"[{timestamp}] {text}\n"

        with open(self.output_path, "a", encoding="utf-8") as f:
            f.write(line)

        print(f"[{timestamp}] {text}")
        self.last_write_time = time.time()

    def _write_header(self):
        """Write a header to the output file."""
        header = (
            f"{'=' * 60}\n"
            f"Chrome Live Caption Transcription\n"
            f"Started: {get_timestamp()}\n"
            f"{'=' * 60}\n\n"
        )
        with open(self.output_path, "a", encoding="utf-8") as f:
            f.write(header)

    def _write_footer(self):
        """Write a footer to the output file."""
        # Flush any remaining text
        if self.last_text and self.last_text != self.last_flushed_text:
            # Extract only the new part
            new_text = self._extract_new_text(self.last_text)
            if new_text:
                self._write_to_file(new_text)

        footer = (
            f"\n{'=' * 60}\n"
            f"Capture stopped: {get_timestamp()}\n"
            f"{'=' * 60}\n"
        )
        with open(self.output_path, "a", encoding="utf-8") as f:
            f.write(footer)

    def _handle_signal(self, signum, frame):
        """Handle Ctrl+C gracefully."""
        print("\n\nStopping capture...")
        self.running = False

    def _extract_new_text(self, current_text: str) -> str:
        """
        Extract only the new portion of text that hasn't been written yet.
        Handles both append-only and rewrite scenarios.
        """
        if not current_text:
            return ""

        # If we haven't written anything yet, return the full text
        if not self.last_flushed_text:
            return current_text

        # If the current text starts with the last flushed text, extract the new part
        if current_text.startswith(self.last_flushed_text):
            new_part = current_text[len(self.last_flushed_text):].strip()
            return new_part

        # If the current text is shorter or completely different, it's a new segment
        # Check if there's any overlap at the end
        # Find the longest suffix of last_flushed that is a prefix of current
        overlap = 0
        min_len = min(len(self.last_flushed_text), len(current_text))
        for i in range(min_len, 0, -1):
            if self.last_flushed_text[-i:] == current_text[:i]:
                overlap = i
                break

        if overlap > 0:
            # There's overlap - extract the new part after the overlap
            new_part = current_text[overlap:].strip()
            return new_part
        else:
            # Completely different text - return as-is (new segment)
            return current_text

    def _process_text_update(self, current_text: str):
        """
        Process a caption text update.
        Uses time-based flushing to avoid writing every single word update.
        """
        if not current_text:
            return

        if current_text == self.last_text:
            # Text hasn't changed - check if we should flush based on timeout
            if (self.last_text and
                self.last_text != self.last_flushed_text and
                time.time() - self.last_write_time > FLUSH_TIMEOUT):
                new_text = self._extract_new_text(self.last_text)
                if new_text:
                    self._write_to_file(new_text)
                    self.last_flushed_text = self.last_text
            return

        # Text changed
        self.last_text = current_text

        # If this looks like a complete sentence (ends with sentence-ending punctuation),
        # write the new part immediately
        if current_text and current_text[-1] in ".!?":
            new_text = self._extract_new_text(current_text)
            if new_text:
                self._write_to_file(new_text)
                self.last_flushed_text = current_text

    def run(self):
        """Main capture loop."""
        signal.signal(signal.SIGINT, self._handle_signal)
        signal.signal(signal.SIGTERM, self._handle_signal)

        print("=" * 60)
        print("Chrome Live Caption Capture")
        print("=" * 60)
        print(f"Output file: {self.output_path}")
        print("Make sure Chrome is running with Live Caption enabled.")
        print("Press Ctrl+C to stop.\n")

        self._write_header()
        self.running = True

        # Wait for Chrome and Live Caption to be available
        print("Waiting for Chrome Live Caption window...")
        while self.running and not self.caption_window:
            self.caption_window = find_live_caption_window()
            if not self.caption_window:
                print(f"  [{get_timestamp()}] Live Caption not found. Is Chrome running with Live Caption enabled?")
                time.sleep(2)

        if not self.running:
            self._write_footer()
            return

        print(f"✓ Live Caption found! Capturing...\n")

        # Main capture loop
        while self.running:
            try:
                current_text = get_caption_text(self.caption_window)
                self._process_text_update(current_text)
                time.sleep(POLL_INTERVAL)

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"  Error: {e}")
                time.sleep(1)

        self._write_footer()
        print(f"\n✓ Capture complete. Saved to: {self.output_path}")


# ─── Entry Point ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Capture Chrome Live Caption text and save to file."
    )
    parser.add_argument(
        "--inspect",
        action="store_true",
        help="Inspect Chrome UI elements to find Live Caption (debug mode)"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default=None,
        help="Custom output file path (default: transcripts/transcript_TIMESTAMP.txt)"
    )
    parser.add_argument(
        "--dir", "-d",
        type=str,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})"
    )

    args = parser.parse_args()

    if args.inspect:
        inspect_chrome_elements()
    else:
        capturer = LiveCaptionCapture(
            output_dir=args.dir,
            output_file=args.output
        )
        capturer.run()


if __name__ == "__main__":
    main()