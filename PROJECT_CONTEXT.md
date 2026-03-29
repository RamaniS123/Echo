/\*
PROJECT: Echo
TAGLINE: Voice-First Stroke Recovery Coach
HACKATHON: Hack Indy 2026 (36-hour build)

OVERVIEW:
Echo is a web application that helps stroke recovery patients practice guided
movement exercises at home. It uses real-time computer vision to measure
movement and symmetry, and voice-first coaching to guide users through exercises
in an accessible way.

The app is designed for patients recovering from stroke, especially those with
limited access to regular therapy. It focuses on guided practice, visible
feedback, and a calm, accessible user experience.

IMPORTANT PRODUCT BOUNDARIES:

- NOT a medical diagnostic tool
- NOT a replacement for licensed therapy
- NOT intended to clinically evaluate stroke severity
- Intended only as a guided home-practice and feedback tool

TARGET USERS:

- Stroke recovery patients with facial asymmetry
- Patients practicing upper-body or hand recovery movements
- Users with limited access to therapy
- Elderly users who benefit from voice-first guidance and simple UI

PRIMARY PRODUCT DIRECTION:
Echo is no longer focused on speech therapy.
Instead, Echo focuses on guided recovery exercises in three categories:

1. Facial Recovery
2. Arm Movement
3. Hand Recovery

It also includes: 4. Full Session Mode

==================================================
CORE MODES
==================================================

1. FACIAL RECOVERY
   Purpose:

- Practice simple facial recovery exercises
- Track movement and symmetry in real time

MVP exercises:

- Smile
- Eyebrow Raise
- Eye Closure (UI only or later if time)

Implementation status:

- Smile should be functional
- Eyebrow Raise should be functional
- Third facial exercise can exist in UI as placeholder if needed

2. ARM MOVEMENT
   Purpose:

- Practice guided upper-limb movement exercises

Planned exercises:

- Raise Right Arm
- Raise Left Arm
- Hold Arm at Shoulder Height

Implementation status:

- UI should include all 3 exercises
- Only one arm exercise needs to be functional for MVP
- Best first implemented arm exercise:
  - Raise Right Arm

Future tracking likely uses:

- MediaPipe Pose

3. HAND RECOVERY
   Purpose:

- Practice guided hand recovery / mobility exercises

Planned exercises:

- Open Hand
- Close Hand
- Hold Palm Open

Implementation status:

- UI should include all 3 exercises
- Only one hand exercise needs to be functional for MVP
- Best first implemented hand exercise:
  - Open Hand

Future tracking likely uses:

- MediaPipe Hands

4. FULL SESSION
   Purpose:

- Provide a guided sequence of exercises across categories
- Make the app feel like a real rehab routine, not isolated demos

MVP full session flow:

- One facial exercise
- One arm movement exercise
- One hand recovery exercise

Implementation status:

- Build the UI and session flow first
- It can initially walk through the sequence as a guided interface
- It does not need full tracking for every exercise immediately

==================================================
ARCHITECTURE
==================================================

FRONTEND:

- React + Vite
- Handles:
  - webcam access
  - MediaPipe integration
  - deterministic scoring logic
  - UI state
  - session flow
- Frontend owns all real-time movement calculations

BACKEND:

- FastAPI + Uvicorn
- Lightweight proxy layer only
- Keeps external API keys secure
- Handles:
  - ElevenLabs requests
  - Gemini requests

IMPORTANT:

- No heavy backend logic
- No authentication for MVP
- No database required for MVP
- MongoDB Atlas optional only as stretch goal

==================================================
ELEVENLABS USAGE
==================================================

ElevenLabs is a core feature.
It should act as the voice coach for the entire experience.

Default voice:

- Rachel
- Voice ID: EXAVITQu4vr4xnSDxMaL

Default model:

- eleven_monolingual_v1

Suggested settings:

- stability: 0.5
- similarity_boost: 0.75

Use ElevenLabs for:

- spoken greetings
- spoken exercise prompts
- spoken corrective feedback
- spoken encouragement
- spoken transitions between exercises
- spoken end-of-session summary

Voice style:

- warm
- calm
- supportive
- concise
- non-clinical

Examples:

- "Smile as evenly as you can."
- "Raise your right arm slowly."
- "Open your hand and hold it."
- "Great effort. Let's move to the next exercise."
- "Nice work today. You completed your full session."

==================================================
GEMINI USAGE
==================================================

Gemini should be used naturally, not forced.

Gemini IS used for:

- turning deterministic metrics into natural-language feedback
- generating session summaries
- suggesting what exercise to do next
- making spoken feedback sound supportive and human

Gemini is NOT used for:

- real-time scoring
- real-time pass/fail detection
- clinical diagnosis
- primary movement detection

Frontend calculates:

- movement
- symmetry
- side differences
- hold duration
- tracking state

Backend (Gemini) converts those metrics into:

- short coaching text
- recap summaries
- gentle next-step suggestions

==================================================
CURRENT MVP IMPLEMENTATION PRIORITY
==================================================

1. Facial Recovery

- Smile: functional
- Eyebrow Raise: functional
- Eye Closure: optional / placeholder

2. Arm Movement

- UI for 3 exercises
- Only one needs to become functional in MVP

3. Hand Recovery

- UI for 3 exercises
- Only one needs to become functional in MVP

4. Full Session

- UI and flow should exist
- Can guide user through:
  - one facial exercise
  - one arm exercise
  - one hand exercise

==================================================
UI / UX REQUIREMENTS
==================================================

Global:

- dark theme
- high contrast
- voice-first
- large buttons
- minimal text
- accessible and calm interface

Each exercise screen should include:

- back button
- page title
- webcam panel / placeholder
- exercise title
- short instruction text
- metrics cards
- status card / feedback area
- primary action button
- next exercise button

Facial exercise metrics:

- Left
- Right
- Symmetry Score
- Movement Strength
- Status

Arm movement metrics (placeholder for now):

- Height
- Stability
- Hold Time
- Range of Motion
- Status

Hand recovery metrics (placeholder for now):

- Open/Close
- Finger Spread
- Hold Time
- Movement Quality
- Status

Full session UI should include:

- current exercise
- current category
- progress stepper or progress label
- next step button
- session status / spoken guidance area

==================================================
REAL-TIME CV STACK
==================================================

Facial Recovery:

- MediaPipe Face Landmarker / Face Mesh

Arm Movement:

- MediaPipe Pose (future functional implementation)

Hand Recovery:

- MediaPipe Hands (future functional implementation)

MVP note:
Only Facial Recovery must be fully implemented first.
Arm and Hand can begin as complete UI flows.

==================================================
BUILD ORDER
==================================================

1. Finalize UI shell for all 4 modes:
   - Facial Recovery
   - Arm Movement
   - Hand Recovery
   - Full Session

2. Keep Facial Recovery functional
   - Smile
   - Eyebrow Raise

3. Add arm movement UI
   - 3 exercise cards/screens
   - one eventually becomes functional

4. Add hand recovery UI
   - 3 exercise cards/screens
   - one eventually becomes functional

5. Add Full Session UI flow
   - sequence through one exercise from each category

6. Integrate ElevenLabs prompts and transitions

7. Add Gemini feedback + summaries

8. If time:
   - make one arm exercise functional
   - make one hand exercise functional

==================================================
MVP DEFINITION
==================================================

MUST HAVE:

- Home screen with all 4 modes
- Facial Recovery page with Smile and Eyebrow Raise working
- Arm Movement page with 3 exercise options in UI
- Hand Recovery page with 3 exercise options in UI
- Full Session page / flow in UI
- Voice coaching infrastructure planned for all modes
- Clean, consistent UI

SHOULD HAVE:

- one arm exercise functional
- one hand exercise functional
- ElevenLabs voice prompts and transitions

NICE TO HAVE:

- Gemini coaching text
- Gemini session summary
- third facial exercise
- MongoDB session history

==================================================
FILE STRUCTURE
==================================================

frontend/src/
components/
WebcamPanel.jsx
MetricCard.jsx
SymmetryBars.jsx
ExerciseCard.jsx
SessionProgress.jsx
hooks/
useFaceTracking.js
useSmileMetrics.js
useEyebrowMetrics.js
pages/
Home.jsx
FacialExercise.jsx
ArmMovement.jsx
HandRecovery.jsx
FullSession.jsx
utils/
smileMetrics.js
eyebrowMetrics.js
apiClient.js
App.jsx
App.css
index.css

backend/app/
main.py
routes/
tts.py
feedback.py
summary.py
services/
elevenlabs_service.py
gemini_service.py
models/
schemas.py

==================================================
DEMO FLOW
==================================================

1. Open Echo
2. Show home screen with all categories
3. Enter Facial Recovery
4. Demonstrate Smile and Eyebrow Raise
5. Show Arm Movement UI
6. Show Hand Recovery UI
7. Enter Full Session
8. Show how Echo guides the user through a sequence
9. End with summary / recap

==================================================
JUDGING POSITIONING
==================================================

Innovation:

- voice-first guided rehab using real-time movement tracking

Technical:

- facial tracking now, extensible to pose and hand tracking
- frontend CV + lightweight backend AI/TTS integration

Impact:

- supports home recovery in low-access environments

Presentation:

- highly visual, guided, and easy to understand live
  \*/
