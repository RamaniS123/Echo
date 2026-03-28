import { useEffect } from 'react';
import { isHandLandmarksValid, drawHandOverlay } from '../utils/handRecoveryMetrics';

/**
 * HandOverlay
 *
 * Drives a canvas overlay for the Hand Recovery exercise.
 * Runs its own RAF loop reading `landmarksRef.current` every frame so drawing
 * stays in sync with hand detection without triggering React renders.
 *
 * Renders nothing itself — expects the parent to pass an `overlayRef` already
 * forwarded to a <canvas> element inside WebcamPanel via the `overlayRef` prop.
 *
 * Props:
 *   overlayRef   — ref attached to the <canvas> inside WebcamPanel
 *   landmarksRef — from useHandTracking; .current = NormalizedLandmark[21] | null
 *   isTracking   — when false the canvas is cleared and the RAF loop stops
 *   isOpen       — whether the hand currently meets the open threshold (colours the overlay)
 */
export default function HandOverlay({ overlayRef, landmarksRef, isTracking, isOpen = false }) {
  useEffect(() => {
    const canvas = overlayRef.current;

    if (!isTracking) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    let rafId;

    function draw() {
      const cvs = overlayRef.current;
      if (!cvs) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      // Keep canvas pixel resolution in sync with its CSS rendered size
      const w = cvs.offsetWidth;
      const h = cvs.offsetHeight;
      if (cvs.width !== w || cvs.height !== h) {
        cvs.width  = w;
        cvs.height = h;
      }

      const ctx = cvs.getContext('2d');
      ctx.clearRect(0, 0, w, h);

      const landmarks = landmarksRef.current;
      if (landmarks && isHandLandmarksValid(landmarks)) {
        drawHandOverlay(ctx, landmarks, w, h, isOpen);
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [isTracking, isOpen, overlayRef, landmarksRef]);

  return null;
}
