const TTS_URL = 'http://localhost:8000/api/tts/speak';

let currentAudio = null;

/**
 * Fetch audio from the backend TTS endpoint and play it.
 * Only one clip plays at a time — any playing audio is stopped first.
 * Errors are caught and swallowed so the session is never blocked.
 *
 * @param {string} text
 */
export async function speak(text) {
  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    const response = await fetch(TTS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });

    if (!response.ok) return;

    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);

    currentAudio = audio;

    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    });

    audio.play().catch(() => {
      // Browser may block autoplay — fail silently
      URL.revokeObjectURL(url);
    });
  } catch {
    // Network or decode error — fail silently
  }
}
