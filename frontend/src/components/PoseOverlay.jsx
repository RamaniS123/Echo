import { useEffect } from 'react';
import { areLandmarksValid, drawArmOverlay } from '../utils/armMovementMetrics';

/**
 * PoseOverlay
 *
 * Drives a canvas overlay for the Arm Movement exercise.
 * Runs its own RAF loop reading `landmarksRef.current` every frame so the
 * drawing stays in sync with pose detection without triggering React renders.
 *
 * The component renders nothing itself — it expects the parent to pass an
 * `overlayRef` that is already forwarded to a <canvas> element inside
 * WebcamPanel (via the `overlayRef` prop).
 *
 * Props:
 *   overlayRef   — ref attached to the <canvas> element inside WebcamPanel
 *   landmarksRef — from usePoseTracking; .current = NormalizedLandmark[] | null
 *   isTracking   — when false the canvas is cleared and the RAF loop stops
 */
export default function PoseOverlay({ overlayRef, landmarksRef, isTracking }) {
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
      if (landmarks && areLandmarksValid(landmarks)) {
        drawArmOverlay(ctx, landmarks, w, h);
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [isTracking, overlayRef, landmarksRef]);

  return null;
}
