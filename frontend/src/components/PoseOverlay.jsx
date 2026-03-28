import { useEffect } from 'react';
import { areLandmarksValid, areLandmarksValidLeft, drawArmOverlay, drawLeftArmOverlay } from '../utils/armMovementMetrics';

/**
 * PoseOverlay
 *
 * Drives a canvas overlay for the Arm Movement exercise.
 * Runs its own RAF loop reading `landmarksRef.current` every frame so the
 * drawing stays in sync with pose detection without triggering React renders.
 *
 * Props:
 *   overlayRef   — ref attached to the <canvas> element inside WebcamPanel
 *   landmarksRef — from usePoseTracking; .current = NormalizedLandmark[] | null
 *   isTracking   — when false the canvas is cleared and the RAF loop stops
 *   side         — 'right' (default) | 'left'
 */
export default function PoseOverlay({ overlayRef, landmarksRef, isTracking, side = 'right' }) {
  useEffect(() => {
    const canvas = overlayRef.current;

    if (!isTracking) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const isValid  = side === 'left' ? areLandmarksValidLeft : areLandmarksValid;
    const drawFn   = side === 'left' ? drawLeftArmOverlay    : drawArmOverlay;

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
      if (landmarks && isValid(landmarks)) {
        drawFn(ctx, landmarks, w, h);
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [isTracking, side, overlayRef, landmarksRef]);

  return null;
}
