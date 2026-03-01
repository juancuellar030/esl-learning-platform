# 🎮 Real-Time Multiplayer Quiz Game — Feature Specification Prompt

> **Project:** ESL Learning Platform  
> **Target Location:** Tools Section ([tools.html](file:///c:/Users/Admin/Documents/esl-learning-platform/tools.html))  
> **Author:** Juan Diego Cuellar Mazabel  
> **Date:** March 2026  

---

## Context & Background

I am building an **ESL Learning Platform** — a web-based educational tool for elementary-level IT and Science students (grades 3–5). The platform is built with **vanilla HTML, CSS, and JavaScript** (no frameworks) and currently includes:

- **Vocabulary Bank** with 20+ categories (Animals, Colors, Food, Body Parts, Directions, Numbers, Classroom Objects, etc.) with definitions, examples, and audio pronunciation
- **Grammar Bank** with rules, exercises, and instant feedback
- **Practice Modes**: Flashcards, Wordsearch, Matching, Unjumble, Fill-in-the-Word, Crossword, Expressions Quiz
- **Tools Section**: Clock & Timer, Weekly Lesson Planner, Student Behavior Tracker, PDF Library, Student Material Tracker, Classroom Layout Tool, Charades Game, Bingo Generator

**Class specifications:**
- **~30 students per class** (elementary, ages 8–11)
- **2 IT class sessions per day** (each class 50 min)
- Students have access to **school computers or tablets** in the IT lab
- Platform runs locally on a school network (currently no backend server)

---

## Feature Request: Real-Time Multiplayer Quiz Game

### Inspiration
This feature is inspired by **[GimKit](https://www.gimkit.com)** and **[Quizlet Live](https://quizlet.com)** — classroom quiz platforms where:
- The **teacher creates/selects a quiz** and launches a live session
- **Students join via a unique game code** on their devices
- Students answer questions **in real time**, competing individually or in teams
- A **live leaderboard** shows progress on the teacher's screen
- Games include **gamification mechanics** (points, streaks, power-ups, virtual rewards)

### Goal
Build a **GimKit/Quizlet Live-style real-time multiplayer quiz tool** integrated into the ESL Learning Platform's **Tools section**. This tool must support **up to 30+ simultaneous players** per session, use the platform's **existing vocabulary and grammar data**, and provide an engaging, competitive classroom experience.

---

## Core Requirements

### 1. Firebase Real-Time Backend Integration
Since the platform currently has no backend, integrate **Firebase** (free Spark plan) to enable real-time multiplayer functionality:

| Firebase Service | Purpose |
|---|---|
| **Firebase Realtime Database** | Sync game state (questions, scores, player answers) in real time across all connected devices |
| **Firebase Anonymous Authentication** | Allow students to join sessions without creating accounts (just enter a name + game code) |
| **Firebase Hosting** *(optional)* | Host the platform so it's accessible from any device on the school network |

> [!IMPORTANT]
> The Firebase integration should be **modular** — a standalone service file (e.g., `js/firebase-service.js`) that initializes Firebase and exports helper functions. This keeps the existing codebase decoupled from Firebase dependencies.

### 2. Teacher Dashboard — Game Session Management

The teacher interface (accessible from the Tools page) should include:

- **Quiz Creation Panel:**
  - Option 1: **Pull from existing vocabulary/grammar data** — select categories, difficulty levels, and number of questions
  - Option 2: **Custom questions** — teacher types custom questions with 4 multiple-choice answers (mark the correct one)
  - Option 3: **Mix mode** — combine auto-generated questions from the vocabulary bank with custom questions

- **Game Configuration:**
  - **Game mode selector**: Individual vs. Teams (auto-assign or manual)
  - **Timer per question**: 10s / 15s / 20s / 30s / No limit
  - **Number of questions**: 5 / 10 / 15 / 20 / Custom
  - **Point system**: Standard (100pts/correct) / Streak bonus / Time bonus
  - **Power-ups**: Enable/Disable (Double Points, Shield, 50/50 Eliminator)
  - **Shuffle questions order**: Yes/No
  - **Show correct answer after each question**: Yes/No

- **Session Launch:**
  - Generate a **unique 6-digit game code** displayed prominently on screen (large font, projectable)
  - Show a **QR code** for quick joining (optional)
  - Display a **real-time player lobby** showing students who have joined (with their chosen display names)
  - "Start Game" button (enabled when ≥2 players have joined)

### 3. Student Join Experience

Students navigate to the quiz page and:

1. Enter the **6-digit game code**
2. Enter a **display name** (teacher can optionally require real first names)
3. See a **"Waiting for game to start..."** screen with fun animations
4. Once the game starts, receive questions on their individual device

> [!TIP]
> The join page should be extremely simple and fast — one input for the code, one for the name, and a big "Join" button. Elementary students need an interface with minimal friction.

### 4. Real-Time Gameplay

#### Question Display (Student Screen)
- Show the **question text** prominently at the top
- Display **4 answer options** as large, colorful, tappable buttons (GimKit-style: each answer has a distinct color — red, blue, green, yellow)
- Show a **countdown timer** bar that visually drains
- Display current **score/streak** counter
- After answering: immediate **✅ correct** or **❌ incorrect** feedback animation
- If enabled, show the **correct answer** before the next question loads

#### Scoring System
| Event | Points |
|---|---|
| Correct answer | +100 base points |
| Speed bonus | +10 to +50 (faster = more points) |
| Streak bonus | ×1.5 at 3 streak, ×2 at 5 streak, ×3 at 10 streak |
| Incorrect answer | 0 points (streak resets) |

#### Power-Ups (Optional, Toggleable)
| Power-Up | Effect | Cost (in earned points) |
|---|---|---|
| 🛡️ Shield | Prevents streak from resetting on next wrong answer | 200 pts |
| ⏱️ Time Freeze | Pauses the timer for 5 seconds | 150 pts |
| ✂️ 50/50 | Eliminates 2 wrong answers | 250 pts |
| 💰 Double Points | Next correct answer gives ×2 points | 300 pts |

### 5. Live Leaderboard (Teacher's Projected Screen)

The teacher's screen shows:
- **Real-time leaderboard** with player names, scores, and rank animations
- **Current question** and how many students have answered
- **Answer distribution bar chart** (how many picked each option)
- **Streak indicators** next to player names (🔥)
- **Question progress** (e.g., "Question 7 of 15")
- After the game: **Final podium** (🥇🥈🥉) with celebratory confetti animation

### 6. Team Mode (Quizlet Live-Style)

When "Teams" mode is selected:
- Automatically divide players into **teams of 4–5** with random team names/colors
- Each team member sees the **same question** but only **one team member has the correct answer** on their screen — they must communicate!
- Team score advances only on correct answers
- **One wrong answer resets team progress to zero** (encourages accuracy over speed)
- Leaderboard shows **team rankings** instead of individual

### 7. Post-Game Summary

After the final question:
- **Podium animation** with top 3 players/teams
- **Full results table**: rank, name, score, accuracy %, avg response time
- **Teacher can download results** as a JSON or CSV file
- **"Play Again"** button (reshuffles questions, keeps players connected)
- **"New Game"** button (returns to lobby)

---

## Technical Architecture

### File Structure (New Files)
```
esl-learning-platform/
├── quiz-game.html              # Main quiz game page (teacher + student views)
├── css/
│   └── quiz-game.css           # Styles for the multiplayer quiz
├── js/
│   ├── firebase-service.js     # Firebase init, auth, database helpers
│   ├── quiz-game.js            # Core game logic (session management, scoring)
│   ├── quiz-game-teacher.js    # Teacher dashboard, lobby, leaderboard
│   └── quiz-game-student.js    # Student join, answer, feedback UI
```

### Firebase Database Structure
```json
{
  "sessions": {
    "ABC123": {
      "hostId": "teacher_uid",
      "status": "lobby | active | finished",
      "config": {
        "mode": "individual | teams",
        "timerPerQuestion": 15,
        "totalQuestions": 10,
        "powerUps": true,
        "showCorrectAnswer": true
      },
      "questions": [
        {
          "id": 0,
          "text": "What does 'beneath' mean?",
          "options": ["Above", "Below", "Next to", "Behind"],
          "correctIndex": 1,
          "category": "directions"
        }
      ],
      "currentQuestionIndex": 0,
      "players": {
        "player_uid_1": {
          "name": "Sofia",
          "score": 450,
          "streak": 3,
          "answers": [1, 0, 2],
          "team": "blue"
        }
      },
      "teams": {
        "blue": { "name": "Blue Dolphins", "members": ["player_uid_1"], "score": 450 },
        "red": { "name": "Red Tigers", "members": ["player_uid_2"], "score": 300 }
      },
      "questionStartTime": 1709312400000,
      "createdAt": 1709312000000
    }
  }
}
```

### Data Flow
```
Teacher creates game → Firebase creates session with unique code
Students enter code → Firebase Auth (anonymous) → join session
Teacher starts game → Firebase updates status to "active"
Question broadcasts → All clients listen to currentQuestionIndex
Student answers → Write to players/{uid}/answers
Score calculates → Client-side, written to players/{uid}/score  
Leaderboard → All clients listen to players node, sort by score
Game ends → Status → "finished", show results
```

---

## Integration with Existing Data

The quiz should be able to **auto-generate questions** from the platform's existing data:

### From Vocabulary Data ([vocabulary-data.js](file:///c:/Users/Admin/Documents/esl-learning-platform/js/vocabulary-data.js))
- **"What does [word] mean?"** → 4 options (1 correct definition + 3 distractors from same category)
- **"Which word matches this definition: [definition]?"** → 4 word options
- **"Complete the sentence: [example with blank]"** → 4 word options
- **"Which image represents [word]?"** → 4 emoji/icon options (if available)

### From Grammar Data ([grammar-data.js](file:///c:/Users/Admin/Documents/esl-learning-platform/js/grammar-data.js))
- Pull directly from existing exercise formats (fill-in-the-blank, error correction)
- Convert to multiple-choice format with 4 options

### From Quiz Data ([quiz-data.js](file:///c:/Users/Admin/Documents/esl-learning-platform/js/quiz-data.js))
- Import existing quiz questions directly

---

## 🎨 Visual Design & Animation System

> [!IMPORTANT]
> The quiz game must feel **juicy, alive, and premium** while being **stylistically consistent** with the existing ESL Learning Platform. Every interaction should have satisfying visual feedback. The design should feel like a natural extension of the platform, not a separate app bolted on.

### Design Tokens (Must Use Platform's Existing CSS Variables)

```css
/* PRIMARY PALETTE — already defined in styles.css :root */
--indigo-velvet: #3d348b;        /* Headers, primary brand color */
--medium-slate-blue: #7678ed;    /* Backgrounds, active states, page bg */
--dark-slate-blue: #483d8b;      /* Deeper accents */
--amber-flame: #f7b801;          /* Highlights, badges, streaks, CTA accents */
--tiger-orange: #f18701;         /* Secondary actions, hover states */
--cayenne-red: #f35b04;          /* Warnings, incorrect answers, urgency */

/* ANSWER BUTTON COLORS — game-specific additions */
--answer-red: #E74C3C;
--answer-blue: #3498DB;
--answer-green: #2ECC71;
--answer-yellow: #F1C40F;
```

### Typography
- **Font stack**: `'Reddit Sans', 'Google Sans Flex', sans-serif` (platform standard)
- **Game code display**: `5rem`, weight `800`, letter-spacing `8px`
- **Question text**: `clamp(1.5rem, 4vw, 2.5rem)`, weight `700`
- **Score/streak counters**: `font-weight: 800`, use `var(--amber-flame)` for emphasis
- **All labels**: uppercase, `letter-spacing: 1–2px`, weight `600–700`

### Card & Container Style
Match the platform's existing patterns exactly:
- **Border-radius**: `20px` for major containers, `15px` for cards, `25px` for buttons, `50px` for pills
- **Borders**: `3px solid` (platform uses thick visible borders)
- **Box shadows**: `0 10px 40px rgba(0,0,0,0.1)` (cards), `0 20px 60px rgba(0,0,0,0.2)` (elevated panels)
- **Glassmorphism panels**: `background: rgba(255,255,255,0.1); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.15);` (used in charades results)
- **Settings panels**: `background: rgba(255,255,255,0.95); border-radius: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.2);`

### Easing Curves (Platform Standard)
```css
/* Bouncy/springy interactions (buttons, cards lifting) */
transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);

/* Smooth standard transitions */
transition: all 0.3s ease;

/* Quick snappy feedback */
transition: all 0.15s ease;
```

---

### 🎬 Animation Specification by Game Phase

#### Phase 1: Lobby / Join Screen
| Element | Animation | Spec |
|---|---|---|
| Game code digits | **Typewriter pop-in** | Each digit scales from `0` → `1` with `countdownPop` easing, 100ms stagger per digit |
| QR code | **Fade + scale in** | `opacity: 0 → 1`, `scale(0.8) → scale(1)`, `0.5s ease` |
| Player joins lobby | **Slide-up + bounce** | New player card slides from `translateY(30px)` → `0` with spring easing, a subtle `pulse` glow on entry |
| Waiting dots | **Pulsing dots** | 3 dots with staggered `opacity` animation, `1.4s infinite` |
| "Start Game" button | **Pulsating glow** | Reuse platform's existing `@keyframes pulsate` (scale 1 → 1.05 with glowing box-shadow) |
| Player count badge | **Number pop** | On increment: scale `1 → 1.3 → 1` with `0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)` |

#### Phase 2: Game Countdown (3-2-1-GO!)
| Element | Animation | Spec |
|---|---|---|
| Countdown numbers | **countdownPop** | Reuse platform's charades `@keyframes countdownPop`: `scale(2) → scale(0.9) → scale(1)`, `0.6s ease` |
| Background | **Dim overlay** | `background: rgba(0,0,0,0.85)`, same as charades countdown |
| "GO!" text | **Explosion pop** | `scale(0.3) → scale(1.4) → scale(1)` with glow ring expanding outward, then fade-out |

#### Phase 3: Question Display & Answering
| Element | Animation | Spec |
|---|---|---|
| Question card entrance | **Slide-up + fade** | `translateY(40px) → 0`, `opacity: 0 → 1`, `0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)` |
| Answer buttons entrance | **Staggered bounce-in** | Each button delays `80ms` more than the previous: `scale(0.5) → scale(1.05) → scale(1)`, `0.3s` each |
| Answer button hover | **Lift + glow** | `translateY(-5px)`, `box-shadow: 0 12px 30px rgba(color, 0.3)` (color matches button) |
| Answer button press | **Squish** | `scale(0.95)` on `:active`, `0.1s ease` |
| Timer bar | **Smooth drain** | Width `100% → 0%` over question time, color transitions: `var(--medium-slate-blue)` → `var(--amber-flame)` → `var(--cayenne-red)` at 25% remaining |
| Timer urgency | **Shake + pulse red** | When <5s: timer element gets `@keyframes shake` (platform has this) + background throbs red |

#### Phase 4: Answer Feedback
| Element | Animation | Spec |
|---|---|---|
| ✅ Correct answer | **Flash overlay** | Reuse charades pattern: full-screen `rgba(81, 207, 102, 0.35)` overlay, checkmark icon with `flashPop` animation |
| ❌ Wrong answer | **Flash overlay** | Full-screen `rgba(255, 107, 107, 0.35)` overlay, X icon with `flashPop`, match charades `.skip` pattern |
| Score increment | **Flying number** | "+100" text flies from answer button → score counter, fading out along the arc, `0.8s ease-out` |
| Streak counter | **Fire emoji pulse** | On streak ≥3: 🔥 appears next to score, scales `1 → 1.4 → 1` on each increment |
| Streak break | **Glass shatter** | Streak number fades to red, small shake, reset to 0 with a brief deflation effect |
| Points display | **Odometer roll** | Score digits roll upward like an odometer counter, each digit individually |

#### Phase 5: Leaderboard (Teacher Screen)
| Element | Animation | Spec |
|---|---|---|
| Rank changes | **Smooth reorder** | Leaderboard rows animate position with `transform: translateY()`, `0.5s cubic-bezier(0.4, 0, 0.2, 1)` |
| Score bars | **Width growth** | Bar width animates proportional to score, `0.4s ease-out` |
| Answer distribution | **Bars grow in** | Horizontal bars animate from `width: 0` → final width, `0.6s ease-out` with stagger |
| "All answered" indicator | **Checkmark pop** | Green check scales in with `flashPop` when all students have answered |
| Streak fire icons | **Flicker** | Subtle CSS animation: slight random rotation + scale wobble, `0.4s infinite alternate` |
| Question progress | **Progress bar slide** | Smooth width transition matching question count |

#### Phase 6: Post-Game Podium
| Element | Animation | Spec |
|---|---|---|
| Podium platforms | **Rise from bottom** | 3rd place rises first (short), then 2nd (medium), then 1st (tallest) — staggered `0.5s` each, `translateY(100%) → 0` |
| Player names | **Fade in on top of podium** | After platform rises, name fades in `0.3s ease` |
| 🥇🥈🥉 medals | **Drop + bounce** | Medal drops from above with bounce: `translateY(-50px) → translateY(5px) → translateY(0)`, `0.6s` |
| Confetti | **Canvas particle system** | 200+ particles, mix of colors from platform palette, gravity + drift, `5s duration` |
| Score reveal | **Count-up animation** | Numbers count from 0 → final score over `1.5s`, use `requestAnimationFrame` |
| "Play Again" button | **Delayed entrance** | Fades in `1s` after podium completes, with `pulsate` animation |

---

### 🌙 Dark Mode

Follow the platform's existing dark mode conventions:
```css
body.dark-mode {
    /* Backgrounds */
    .card { background: #2a2a3e; border-color: #3a3a50; color: #eee; }
    .input { background: #1e1e2d; border-color: #3a3a50; color: #eee; }
    .panel { background: #1e1e1e; color: #f5f5f5; }
    
    /* Accent swap: indigo-velvet → amber-flame for highlights */
    .highlight-text { color: var(--amber-flame); }
    .active-state { background: var(--amber-flame); color: var(--indigo-velvet); }
    
    /* Checked inputs use amber-flame instead of indigo-velvet */
    input:checked { background-color: var(--amber-flame); border-color: var(--amber-flame); }
}
```

### 🔊 Sound Effects (Optional, Toggleable via Settings)
| Event | Sound | Duration |
|---|---|---|
| Player joins lobby | Soft "pop" / "ding" | ~200ms |
| Countdown 3-2-1 | Deep "tick" | ~300ms each |
| "GO!" | Energetic whoosh | ~500ms |
| Correct answer | Bright chime | ~400ms |
| Wrong answer | Soft buzzer | ~300ms |
| Streak bonus (3+) | Ascending notes | ~500ms |
| Podium reveal | Triumphant fanfare | ~2s |

> [!TIP]
> Use the Web Audio API to generate sounds procedurally (sine/square waves) to keep the bundle tiny. No need for large audio files. Alternatively, use very short base64-encoded WAV clips inlined in the JS.

### 📱 Responsiveness

| View | Target Resolution | Key Requirements |
|---|---|---|
| Teacher dashboard (projected) | 1920×1080 | Large game code, full leaderboard visible, answer distribution charts |
| Student on tablet | 1024×768 min | 4 answer buttons fill the screen, touch targets ≥80px height |
| Student on phone | 375×667 min | Stack answer buttons vertically, ensure timer is always visible |

### ♿ Accessibility
- All interactive elements have **aria-labels** and **role** attributes
- Color is never the **only** indicator — icons accompany colored feedback (✅/❌)
- High contrast ratios (**WCAG AA** minimum, 4.5:1 for text)
- **Keyboard navigation**: Tab through answer buttons, Enter to select
- Answer buttons minimum **80px height**, **16px font-size** for elementary students

---

## Performance & Scalability

- Must handle **30+ simultaneous connections** per session without lag
- Firebase Realtime Database free tier supports **100 simultaneous connections** — sufficient for 1 game session
- Implement **debouncing** on score updates to reduce database writes
- Use Firebase's **`.onDisconnect()`** to handle students who close their browsers mid-game
- **Question data sent once** at game start (not per-question) to minimize reads

---

## Stretch Goals (Future Phases)

These are optional enhancements for later iterations:

1. **Saved Game Templates** — Teachers save quiz configurations for reuse
2. **Student Avatars** — Pick a fun avatar/emoji before joining
3. **Achievement Badges** — "First Place 🥇", "Perfect Score ⭐", "Speed Demon ⚡"
4. **Tournament Mode** — Multiple rounds with eliminations
5. **Homework Assignments** — Students play asynchronously with a deadline
6. **Class Statistics** — Track performance across multiple sessions over time
7. **Custom Themes** — Holiday themes, seasonal designs
8. **Audio Questions** — Play a pronunciation audio clip, students identify the word

---

## Firebase Setup Instructions

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (e.g., `esl-quiz-platform`)
3. Disable Google Analytics (not needed for this use case)

### Step 2: Enable Services
- **Authentication** → Enable "Anonymous" sign-in method
- **Realtime Database** → Create database in your region, start in **test mode** (lock down rules later)

### Step 3: Get Config
Copy the Firebase config object and paste into `firebase-service.js`:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Step 4: Security Rules (Production)
```json
{
  "rules": {
    "sessions": {
      "$sessionId": {
        ".read": "auth != null",
        ".write": "auth != null",
        "players": {
          "$uid": {
            ".write": "$uid === auth.uid"
          }
        }
      }
    }
  }
}
```

---

## Summary

Build a **real-time multiplayer quiz game** for the ESL Learning Platform that:

✅ Lives in the **Tools section** alongside existing tools  
✅ Uses **Firebase Realtime Database** for live synchronization  
✅ Supports **30+ simultaneous players** per session  
✅ Includes **Individual and Team game modes**  
✅ Features **GimKit-style gamification** (points, streaks, power-ups)  
✅ Auto-generates questions from **existing vocabulary and grammar data**  
✅ Has a **teacher dashboard** with lobby, leaderboard, and results export  
✅ Provides a **frictionless student join** experience (code + name only)  
✅ Follows the platform's **existing design language** and dark mode support  
✅ Is built with **vanilla JavaScript** and the Firebase JS SDK (no frameworks)  
