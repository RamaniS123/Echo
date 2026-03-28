# Echo — Copilot Project Context

## Project Summary

Echo is a web application for guided at-home stroke recovery practice.

It provides a voice-first, highly accessible rehab experience focused on:

- facial symmetry practice
- facial muscle activation practice
- short speech / articulation practice

Echo is designed for users recovering from stroke, including elderly users and users with limited access to frequent therapy sessions.

## Product Boundaries

Echo is:

- a guided practice tool
- a lightweight coaching experience
- an accessibility-focused rehab companion

Echo is NOT:

- a medical diagnostic tool
- a replacement for licensed therapy
- a clinical speech assessment system
- a system that detects stroke severity, dysarthria, or aphasia

All code, copy, and UI should avoid medical claims or diagnostic language.

---

## Core Product Modes

1. Facial Exercise Mode
2. Speech Practice Mode
3. Session Summary Mode

The app should be structured so additional exercises and phrase categories can be added later without rewriting core logic.

---

## Architecture

### Frontend

- React + Vite
- owns all real-time webcam and microphone processing
- runs MediaPipe face tracking in the browser
- computes deterministic movement and symmetry metrics locally
- renders live feedback UI
- sends only structured metrics to backend APIs

### Backend

- FastAPI + Uvicorn
- thin orchestration layer only
- stores API keys in environment variables
- calls ElevenLabs for text-to-speech
- calls Gemini for natural-language coaching and summaries
- does not perform real-time scoring
- does not contain frontend-specific business logic
- no auth required for MVP
- no database required for MVP

### Important Architecture Rule

Frontend owns:

- live tracking
- live scoring
- exercise state
- speech attempt metrics
- fallback logic for unsupported browser features

Backend owns:

- converting structured metrics into short supportive coaching text
- generating spoken prompts and spoken summaries

Do not move real-time scoring into the backend.

---

## Non-Hardcoding Rules

Copilot should avoid hardcoding behavior unless it is clearly isolated in configuration.

### Do NOT hardcode:

- target phrases directly inside components
- exercise definitions directly inside JSX
- landmark indices scattered across files
- movement thresholds scattered across utilities
- feedback strings embedded in scoring logic
- API base URLs inline across the app
- magic numbers for symmetry scoring
- browser feature assumptions
- hardcoded UI status colors in multiple places
- hardcoded exercise progression logic
- model-specific assumptions tightly coupled to business logic

### Prefer:

- central config objects
- typed constants
- reusable mappings
- feature flags
- helper functions
- adapters around third-party APIs
- deterministic utility functions with explicit inputs
- parameterized thresholds
- dependency injection where reasonable

---

## Preferred Frontend Design

The frontend should be modular and driven by data/config.

### Use configuration-driven definitions for:

- available exercise modes
- facial exercises
- speech categories
- speech phrase lists
- landmark groups and facial regions
- score thresholds
- feedback state labels
- session summary labels
- UI copy where possible

### Example concept

Instead of hardcoding:

- "Smile"
- "Raise Eyebrows"
- "Hello"
- threshold values
- route labels

prefer patterns like:

- `FACIAL_EXERCISES`
- `SPEECH_CATEGORIES`
- `PHRASE_SETS`
- `LANDMARK_GROUPS`
- `THRESHOLD_CONFIG`
- `FEEDBACK_RULES`

These should live in dedicated config files.

---

## Suggested Data Model Shape

### Facial exercise definition

Each facial exercise should be represented as structured data, not custom one-off UI logic.

Suggested fields:

- id
- label
- description
- instructionText
- region
- requiredLandmarks
- metricFunctionKey
- thresholds
- enabled

### Speech category definition

Each speech category should be represented as structured data.

Suggested fields:

- id
- label
- description
- enabled
- phrases

### Phrase definition

Each phrase should be represented as data.

Suggested fields:

- id
- text
- difficulty
- enabled

### Feedback state definition

Feedback should be generated from structured state, not from nested inline conditionals spread throughout components.

Suggested fields:

- id
- conditions
- messageKey
- severity
- spokenVariantAllowed

---

## Facial Exercise MVP

MVP facial exercises:

- smile
- eyebrow raise
- eye closure

At minimum, the codebase must support:

- smile
- one additional facial exercise

The architecture should allow more exercises later without new page-level logic.

### Facial metrics should be:

- deterministic
- interpretable
- based on landmark geometry
- relative to baseline or stable reference points
- smoothed to reduce jitter

### Facial scoring should not:

- claim clinical precision
- imply diagnosis
- assume fixed user anatomy
- rely on single-frame measurements only

### Landmark notes

MediaPipe landmark IDs may change during implementation testing.
Landmark references should be isolated in a single source of truth, such as:

- `landmarks.ts`
- `faceRegions.ts`
- `facialConfig.ts`

Do not scatter landmark IDs across components or utility files.

---

## Speech Practice MVP

Speech mode should support a category-based UI.

The UI may show multiple categories, but MVP only needs one fully working category:

- Common Phrases

Example categories:

- Common Phrases
- Daily Conversation
- Articulation Drills

Only enabled categories should be selectable as active flows.

### Common Phrases MVP

Use a small configurable phrase list for MVP, such as:

- Hello
- Thank you
- Good morning
- I am okay
- I need help
- Water please

These phrases must come from config, not from inline component arrays.

### Speech attempt metrics

Frontend may compute:

- speech detected or not
- duration
- average volume / RMS
- optional browser transcript
- transcript similarity to target phrase
- mouth opening / mouth movement while speaking

Speech mode should combine:

- audio attempt signals
- visible mouth movement signals

### Important speech rule

Do not claim:

- slur detection
- clinical articulation scoring
- diagnosis
- phoneme correctness
- medically authoritative speech evaluation

Speech feedback should remain simple, supportive, and believable.

---

## Speech Feedback Design

Speech feedback should be based on structured metrics, not hardcoded per-phrase branches.

Example metric inputs:

- targetPhraseId
- speechDetected
- durationMs
- averageVolume
- transcript
- transcriptSimilarity
- mouthMovementScore
- attemptCount

Example feedback states:

- no speech detected
- too quiet
- too short
- weak phrase match
- low mouth movement
- good attempt
- strong attempt

Prefer a rule engine or mapping layer over deeply nested `if/else` chains in UI files.

---

## Real-Time Visual Feedback

### Facial Mode UI

Should support:

- webcam feed
- optional landmark overlay
- left movement bar
- right movement bar
- symmetry score
- current instruction
- current status

### Speech Mode UI

Should support:

- target phrase
- mic activity indicator
- mouth movement indicator
- optional transcript if supported
- simple status text

UI should be:

- high contrast
- large and readable
- minimal in text density
- calm and uncluttered
- easy to understand quickly during a demo

Do not bury important status state inside tiny labels.

---

## Accessibility Requirements

Prioritize:

- large click targets
- voice-first interaction
- minimal reading requirement
- keyboard friendliness where possible
- clear camera/microphone fallback messaging
- strong contrast
- simple interaction flow

Accessibility should not be an afterthought or layered in only through CSS overrides.

---

## Performance Requirements

The app should feel smooth and demo-ready.

Prioritize:

- stable webcam rendering
- stable face tracking
- reduced jitter through smoothing
- throttled status updates
- prevention of repeated spoken feedback spam
- lightweight rerenders

Do not write code that recomputes expensive measurements unnecessarily on every render.

Prefer:

- memoized calculations where appropriate
- frame processing hooks
- debounced or thresholded feedback emission
- explicit state transitions

---

## Error Handling

The app must gracefully handle:

- camera permission denied
- microphone permission denied
- face not detected
- low lighting
- speech recognition unavailable
- backend request failure
- ElevenLabs failure

Fallback behavior:

- if TTS fails, show text feedback
- if browser speech recognition fails, continue with volume + duration + face movement only
- if face tracking fails, show camera guidance and allow retry

Do not assume all browser capabilities are present.

---

## Backend API Design

Backend should remain thin and predictable.

### `POST /api/tts`

Input:

- text
- type

Returns:

- audio response or streamable payload

### `POST /api/feedback`

Input:

- mode
- exercise
- metrics
- attemptCount

Returns:

- short supportive message

### `POST /api/summary`

Input:

- completed exercise stats
- best scores
- speech attempt stats
- trend notes

Returns:

- short supportive summary

### Backend implementation rules

- keep request/response schemas explicit
- validate payloads with Pydantic
- keep third-party provider code in service modules
- keep prompt construction out of route handlers
- do not embed large prompt strings directly in route functions
- allow fallback non-LLM responses where useful

---

## Prompting / AI Output Rules

Gemini output should be:

- short
- supportive
- clear
- non-clinical
- one or two sentences max

ElevenLabs text should be:

- warm
- calm
- concise
- easy to voice naturally
- never alarmist

Do not generate:

- scary language
- diagnostic statements
- confidence claims about medical status
- overly verbose coaching paragraphs during exercises

---

## Code Organization Preferences

### Frontend

Prefer structure similar to:

- `components/`
- `hooks/`
- `pages/`
- `utils/`
- `config/`
- `types/`
- `services/`

Suggested responsibilities:

- `config/`: exercises, phrases, thresholds, landmarks, labels
- `utils/`: pure measurement functions and scoring helpers
- `hooks/`: camera, face tracking, microphone, speech attempt state
- `services/`: API client wrappers
- `components/`: reusable presentational UI
- `pages/`: mode-level composition only

### Backend

Prefer structure similar to:

- `routes/`
- `services/`
- `models/`
- `core/`

Suggested responsibilities:

- `routes/`: request handling only
- `services/`: ElevenLabs, Gemini, summary generation
- `models/`: Pydantic schemas
- `core/`: settings, environment loading, shared utilities

---

## Coding Style

- use functional React components only
- use hooks, not classes
- favor small pure functions
- separate measurement logic from UI rendering
- separate scoring logic from feedback text generation
- keep components focused and composable
- prefer explicit names over clever abstractions
- comment assumptions around thresholds and landmarks
- use constants/config instead of magic numbers
- avoid tight coupling between pages and exercise internals

---

## Demo Priorities

The demo should feel polished around one complete rehab loop.

Strong demo moments:

- spoken greeting
- live smile or eyebrow tracking
- visible left/right movement bars
- immediate supportive spoken feedback
- speech mode with common phrase practice
- summary screen with recap

Code should prioritize reliability and clarity over unnecessary complexity.

---

## Implementation Guidance for Copilot

When generating code for this project:

1. Prefer config-driven solutions over inline literals.
2. Avoid magic numbers; place thresholds in named config.
3. Keep third-party SDK usage behind wrappers or service helpers.
4. Write pure utility functions for landmark calculations.
5. Keep measurement, scoring, and messaging as separate layers.
6. Assume future exercises and phrase categories will be added.
7. Do not hardcode only-one-exercise assumptions into component structure.
8. Do not hardcode only-one-category assumptions into speech mode.
9. Make unsupported browser features degrade gracefully.
10. Keep the backend thin and the frontend in control of live logic.

---

## Anti-Patterns to Avoid

- giant page components with embedded business logic
- hardcoded phrase arrays inside render functions
- hardcoded thresholds inside conditionals
- repeated landmark indices across files
- direct provider SDK calls from UI components
- mixing score calculation and message wording in the same function
- assuming transcript support always exists
- assuming camera and microphone are always available
- making medical-sounding claims in UI copy or generated text

---

## Goal

Build a demo-quality, accessible, voice-first rehab app that feels real, helpful, and extensible.

The codebase should be organized so that:

- one exercise can be implemented quickly
- a second exercise can be added with minimal friction
- one speech category can work now
- more categories and phrases can be enabled later by configuration
- feedback remains deterministic, modular, and safe
