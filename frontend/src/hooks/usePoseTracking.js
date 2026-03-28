import { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * Reuses the same WASM runtime already deployed for face tracking.
 * The WASM files live in public/mediapipe-wasm/ — no extra copy step needed.
 */
const WASM_PATH = '/mediapipe-wasm';

/**
 * Lite pose model (~3 MB). Hosted on Google CDN; cached by the browser after
 * the first load.  The lite model is fast enough for upper-body arm tracking.
 */
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/**
 * usePoseTracking
 *
 * Initialises MediaPipe PoseLandmarker and, while `isTracking` is true,
 * processes every available webcam frame to detect body pose landmarks.
 *
 * Mirrors the structure of useFaceTracking so the two can coexist without
 * interfering.  Pose tracking only activates when `isTracking` is true —
 * the Arm Movement page controls this flag; Facial Recovery is unaffected.
 *
 * Returns:
 *   poseDetected   — React state boolean; re-renders only when it flips
 *   landmarksRef   — ref whose .current = NormalizedLandmark[] | null
 *                    (33 MediaPipe Pose landmarks, updated every frame)
 *   isLoading      — true while the WASM + model are initialising
 *   error          — string | null if initialisation failed
 *
 * @param {React.RefObject} webcamRef  — forwarded react-webcam ref
 * @param {boolean}         isTracking
 */
export function usePoseTracking(webcamRef, isTracking) {
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState(null);
  const [poseDetected, setPoseDetected] = useState(false);

  const landmarkerRef      = useRef(null); // PoseLandmarker instance
  const landmarksRef       = useRef(null); // latest NormalizedLandmark[] — NOT state
  const rafRef             = useRef(null); // active requestAnimationFrame id
  const lastTimestampRef   = useRef(-1);   // enforce strictly-increasing timestamps
  const lastDetectedRef    = useRef(false);// avoid no-op setState on every frame

  // ── Initialise PoseLandmarker once on mount ─────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode:   'VIDEO',
          numPoses:      1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence:  0.5,
          minTrackingConfidence:      0.5,
        });

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load pose tracker');
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []); // run once

  // ── Frame-processing loop ───────────────────────────────────────────────
  useEffect(() => {
    if (!isTracking || isLoading || error) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (!isTracking) {
        landmarksRef.current     = null;
        lastTimestampRef.current = -1;
        if (lastDetectedRef.current) {
          lastDetectedRef.current = false;
          setPoseDetected(false);
        }
      }
      return;
    }

    function processFrame() {
      const video = webcamRef.current?.video;
      if (!video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const now = performance.now();
      if (now <= lastTimestampRef.current) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastTimestampRef.current = now;

      try {
        const result   = landmarkerRef.current.detectForVideo(video, now);
        const detected = (result.landmarks?.length ?? 0) > 0;

        // Store the first person's landmarks (33 points) without triggering render
        landmarksRef.current = detected ? result.landmarks[0] : null;

        if (detected !== lastDetectedRef.current) {
          lastDetectedRef.current = detected;
          setPoseDetected(detected);
        }
      } catch {
        // Swallow transient per-frame decode errors
      }

      rafRef.current = requestAnimationFrame(processFrame);
    }

    rafRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isTracking, isLoading, error, webcamRef]);

  return { poseDetected, landmarksRef, isLoading, error };
}
