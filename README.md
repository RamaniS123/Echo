# Mirror
A voice-guided recovery coach for at-home rehabilitation

---

## Project Description

Mirror is a computer vision–powered web application that helps patients perform rehabilitation exercises at home with real-time feedback and guidance.

It is designed for individuals recovering from stroke, brain injury, or other conditions that affect motor function. Mirror tracks facial, arm, and hand movements using a webcam, analyzes performance, and provides immediate feedback to help users complete exercises correctly.

The goal is to bring structured, guided therapy into the home, where support is often limited after clinical sessions.

---

## What I Built

During the hackathon, I built a fully functional end-to-end system that:

- Tracks facial, arm, and hand movements in real time
- Computes movement quality metrics such as symmetry, strength, and range of motion
- Provides instant feedback on whether exercises are performed correctly
- Guides users through structured recovery sessions
- Includes voice-based coaching to improve accessibility
- Supports multiple exercise modes:
  - Facial Recovery (Smile, Eyebrow Raise)
  - Arm Movement (Raise Arm)
  - Hand Recovery (Open Hand, Hold Palm Open)
  - Full Session mode combining all exercises

This functions as an interactive rehabilitation assistant rather than a static demo.

---

## Technologies and Frameworks Used

- Frontend: React, Vite, JavaScript  
- Backend: FastAPI, Python  
- Computer Vision: MediaPipe (Face, Pose, Hand Landmarkers)  
- Voice: ElevenLabs API (Text-to-Speech)  
- Core Concepts: Real-time computer vision, movement analysis, rule-based evaluation  

---

## How Mirror Decides if an Exercise Is "Correct"

Mirror uses deterministic rules (not AI judgment) to evaluate movement quality in real time.

### 1) Shared logic across all exercises

- Calibration first: the app records a neutral resting position for about one second  
- Normalize by body or face size: measurements are scaled so distance from camera has less impact  
- Smooth motion: values are smoothed to reduce jitter  
- Threshold and hold timers: exercises are only considered successful when conditions are sustained  

---

### 2) Facial: Smile and Eyebrow Raise

Smile:
- Tracks upward movement of mouth corners from baseline  
- Computes strength and symmetry between left and right sides  
- Requires minimum movement and sustained activation  
- Detects asymmetry and provides corrective feedback  

Eyebrow Raise:
- Measures increase in distance between eyebrows and eyes  
- Applies similar symmetry and threshold logic  
- Ensures balanced movement across both sides  

---

### 3) Arm: Raise Arm

- Uses shoulder, elbow, and wrist landmarks  
- Determines correctness based on:
  - Wrist position relative to shoulder  
  - Proper arm posture (to avoid false positives)  
- Tracks height, range of motion, stability, and hold duration  
- Completion requires holding the correct position over time  

---

### 4) Hand: Open Hand and Hold Palm Open

- Measures finger extension relative to the wrist  
- Tracks hand openness, finger spread, and stability  
- Completion logic:
  - Open Hand: reach threshold and hold  
  - Hold Palm Open: stricter thresholds with longer hold duration  

---

### 5) Full Session Progression

Mirror guides users through a sequence of exercises.

The session advances automatically when each step’s completion condition is met:
- Facial movement sustained above threshold  
- Arm held in correct position  
- Hand exercise completed  

---

## AI / Tool Usage Disclosure

This project was developed with assistance from:

- ChatGPT for ideation, debugging, and documentation  
- GitHub Copilot for code scaffolding and development assistance  

---

## Key Takeaways

- Translating computer vision data into meaningful feedback requires calibration and normalization  
- Real-time systems require smoothing and timing logic to remain stable  
- Accessibility and simplicity are critical for rehabilitation-focused applications  

---

## Future Improvements

- Integrate AI-generated feedback for more adaptive coaching  
- Add persistence and session tracking to monitor improvement over time  
- Improve accuracy across different users and environments  
- Expand the exercise library and personalization  
- Enable adaptive sessions based on user performance  

---

## Summary

Mirror transforms at-home rehabilitation into a guided, interactive experience. By combining real-time tracking, feedback, and voice guidance, it helps make recovery more accessible, consistent, and effective.
