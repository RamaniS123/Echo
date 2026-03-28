import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * Path to the WASM runtime files copied into public/mediapipe-wasm/.
 * Must stay in sync with the installed @mediapipe/tasks-vision version.
 * Run: cp -r node_modules/@mediapipe/tasks-vision/wasm public/mediapipe-wasm
 */
const WASM_PATH = '/mediapipe-wasm';

/**
 * Face Landmarker model hosted on Google's CDN.
 * ~4 MB, downloaded once and cached by the browser.
 */
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/**
 * useFaceTracking
 *
 * Initialises MediaPipe Face Landmarker and, while `isTracking` is true,
 * processes every available webcam frame to detect facial landmarks.
 *
 * Performance notes:
 * - `faceDetected` is React state — re-renders only when detection *changes*.
 * - `landmarksRef` is a plain ref whose `.current` holds the latest
 *   478-point array without triggering any re-render. Callers that need
 *   per-frame precision (e.g. metric computation) should read it inside
 *   their own RAF loop or effect rather than subscribing via state.
 *
 * @param {React.RefObject} webcamRef  — ref forwarded to the react-webcam
 *   <Webcam> element; underlying video is at webcamRef.current?.video.
 * @param {boolean}         isTracking — when true the frame loop runs;
 *   when false the loop stops and face state is cleared.
 *
 * @returns {{
 *   faceDetected: boolean,
 *   landmarksRef:  React.RefObject,   // current = NormalizedLandmark[] | null
 *   isLoading:    boolean,
 *   error:        string | null,
 * }}
 */
export function useFaceTracking(webcamRef, isTracking) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);

  const landmarkerRef    = useRef(null); // FaceLandmarker instance
  const landmarksRef     = useRef(null); // latest NormalizedLandmark[] — NOT state
  const rafRef           = useRef(null); // active requestAnimationFrame id
  const lastTimestampRef = useRef(-1);   // enforce strictly-increasing timestamps
  const lastDetectedRef  = useRef(false);// avoid no-op setState on every frame

  // ── Initialise Face Landmarker once on mount ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load face tracker');
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
    // Cancel any running loop when tracking stops or tracker not ready
    if (!isTracking || isLoading || error) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (!isTracking) {
        landmarksRef.current  = null;
        lastTimestampRef.current = -1;
        if (lastDetectedRef.current) {
          lastDetectedRef.current = false;
          setFaceDetected(false);
        }
      }
      return;
    }

    function processFrame() {
      // Guard: video element must be ready
      const video = webcamRef.current?.video;
      if (!video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // MediaPipe requires a strictly increasing timestamp (milliseconds)
      const now = performance.now();
      if (now <= lastTimestampRef.current) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastTimestampRef.current = now;

      try {
        const result = landmarkerRef.current.detectForVideo(video, now);
        const detected = (result.faceLandmarks?.length ?? 0) > 0;

        // Update the landmarks ref every frame (no re-render)
        landmarksRef.current = detected ? result.faceLandmarks[0] : null;

        // Only call setState when the boolean actually flips
        if (detected !== lastDetectedRef.current) {
          lastDetectedRef.current = detected;
          setFaceDetected(detected);
        }
      } catch {
        // Swallow transient per-frame errors (e.g. video decode glitches)
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

  return { faceDetected, landmarksRef, isLoading, error };
}
