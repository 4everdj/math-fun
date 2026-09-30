# Math Fun! ⭐ Kids Math Practice (Ages 5–8)

A polished, kid-friendly educational web app for Kindergarten through 2nd Grade math practice.

## How to Run

**Option 1 – Open directly**  
Double-click `index.html` or open it in any modern browser (Chrome, Firefox, Edge, Safari).

**Option 2 – Local server (recommended)**  
```bash
cd math-fun
python3 -m http.server 8080
# Then open http://localhost:8080
```

No build step, no Node.js required. Works offline after the first load of the CDN scripts.

## Features

### Home Screen
- Three large grade cards: 🟢 Kindergarten · 🔵 1st Grade · 🟣 2nd Grade
- Daily Math, My Progress, Parent buttons
- Extremely simple, large targets, minimal text

### Kindergarten
- Number recognition 0–20
- Counting objects
- Addition within 5 (visual “putting together”)
- Subtraction within 5 (visual “taking away”)
- Shapes (circle, square, triangle, rectangle + sphere/cube)

### 1st Grade
- Addition & subtraction within 20
- Tens & Ones (base-ten blocks)
- Counting / missing numbers to 120
- Time (hour & half-hour) with analog clock
- Halves & quarters (visual fractions)

### 2nd Grade
- Addition & subtraction within 100
- Place value to 1,000
- Money (pennies, nickels, dimes, quarters)
- Time to nearest 5 minutes
- Measurement (ruler + pencil)
- Equal groups (intro to multiplication)

### Learning Design
- Learn mode (visual explanations) + Practice mode
- Dynamic question generation
- Adaptive difficulty
- Encouraging feedback only (“Almost! Try again 😊”)
- Visual hints after repeated mistakes
- Stars, badges, confetti celebrations
- Progress saved in browser localStorage
- Parent/Teacher gate + simple dashboard
- Daily mixed practice sessions
- Keyboard support (Enter/Space, number keys, arrows)
- Speak button (Web Speech API) – can be turned off
- Large buttons, high contrast, clear focus indicators

## Tech Notes
- Single-page React 18 app via CDN + Tailwind CSS via CDN
- No backend, no install, no build
- Designed so a 5-year-old can navigate independently with a mouse or keyboard
- Easy to extend: add new generators in `app.js` under the GENERATORS object

Enjoy practicing math!
