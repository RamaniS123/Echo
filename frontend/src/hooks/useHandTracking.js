import { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * Reuses the same WASM runtime already deployed for face and pose tracking.
 * The WASM files live in public/mediapipe-wasm/ — no extra copy step needed.
 */
const WASM_PATH = '/mediapipe-wasm';

/**
 * Hand Landmarker model (~8 MB). Hosted on Google CDN; cached after first load.
 */
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * useHandTracking
 *
 * Initialises MediaPipe HandLandmarker and, while `isTracking` is true,
 * processes every available webcam frame to detect hand landmarks.
 *
 * Mirrors the structure of usePoseTracking and useFaceTracking so the three
 * trackers coexist without interfering with each other.  Hand tracking only
 * activates when `isTracking` is true — Hand Recovery controls this flag;
 * Facial Recovery and Arm Movement are unaffected.
 *
 * Returns:
 *   handDetected  — React state boolean; re-renders only when it flips
 *   landmarksRef  — ref whose .current = NormalizedLandmark[21] | null
 *   handednessRef — ref whose .current = handedness category array | null
 *   isLoading     — true while the WASM + model are initialising
 *   error         — string | null if initialisation failed
 *
 * @param {React.RefObject} webcamRef  — forwarded react-webcam ref
 * @param {boolean}         isTracking
 */
export function useHandTracking(webcamRef, isTracking) {
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState(null);
  const [handDetected, setHandDetected] = useState(false);

  const landmarkerRef    = useRef(null); // HandLandmarker instance
  const landmarksRef     = useRef(null); // latest NormalizedLandmark[21] — NOT state
  const handednessRef    = useRef(null); // latest handedness info — NOT state
  const rafRef           = useRef(null); // active requestAnimationFrame id
  const lastTimestampRef = useRef(-1);   // enforce strictly-increasing timestamps
  const lastDetectedRef  = useRef(false);// avoid no-op setState on every frame

  // ── Initialise HandLandmarker once on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode:                'VIDEO',
          numHands:                   1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence:  0.5,
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
          setError(err?.message ?? 'Failed to load hand tracker');
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

  // ── Frame-processing loop ────────────────────────────────────────────────
  useEffect(() => {
    if (!isTracking || isLoading || error) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (!isTracking) {
        landmarksRef.current     = null;
        handednessRef.current    = null;
        lastTimestampRef.current = -1;
        if (lastDetectedRef.current) {
          lastDetectedRef.current = false;
          setHandDetected(false);
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

        // Store the first detected hand's landmarks (21 points) without triggering re-render
        landmarksRef.current  = detected ? result.landmarks[0]   : null;
        handednessRef.current = detected ? result.handedness?.[0] : null;

        if (detected !== lastDetectedRef.current) {
          lastDetectedRef.current = detected;
          setHandDetected(detected);
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

  return { handDetected, landmarksRef, handednessRef, isLoading, error };
}
