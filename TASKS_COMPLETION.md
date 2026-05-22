# Zoltrakk Tournament - Assignment Completion Checklist

## Required Multi-Page Website
- `index.html` created and styled.
- `schedule.html` created and styled.
- `players.html` created and styled.
- `contact.html` created and styled.

## Home Page (`index.html`)
- Header with logo + navigation: Done.
- Hero section (banner): Done.
- About tournament section: Done.

## Schedule Page (`schedule.html`)
- Tournament table: Done.
- Borders and colors: Done.
- Final match row highlighted: Done (`.final-match`).

## Player Page (`players.html`)
- Player cards grid 3x3: Done (9 cards from JSON).
- Each card has image, name, rank: Done.
- Hover effect: Done (scale/flip effect).

## Contact Page (`contact.html`)
- Styled form: Done.
- Required fields: Done.
- DOB with calendar input: Done (`type="date"`).
- Custom buttons: Done.

## Signup Page (`signup.html`)
- Fields: First Name, Last Name, Age, Email, Password, Confirm Password, Submit: Done.
- Non-empty validation for first/last/age: Done.
- Error messages below fields: Done.
- Email RegEx validation: Done.
- Valid/invalid email feedback: Done.
- Password policy checks (8+, upper, lower, number, special): Done.
- Dynamic password strength bar: Done.
- Confirm password match check: Done.
- `event.preventDefault()` and block invalid submit: Done.
- Success message when valid: Done.

## Login Page (`login.html`)
- Email + Password fields + Login button: Done.
- Empty validation and errors: Done.
- Prevent invalid submit: Done.
- Password show/hide toggle with emoji: Done.
- Closed eye (`🙈`) by default, open eye (`👁️`) when visible: Done.

## Registration System
- Add registration form: Done (`players.html`).
- Participants list display: Done.
- localStorage persistence across refresh: Done.
- Limit to 10 players: Done.
- Remove player registration: Done.
- Show total registered players: Done.

## Dynamic Player Cards from JSON + Fetch
- Custom player data in `files/data.json`: Done.
- Fetch JSON data and render cards: Done (`script.js`).
- Search by player name: Done.
- Filter by game: Done.
- Filter by rank: Done.
- Real-time updates on each filter: Done.
- Top-ranked (Diamond) emphasis: Done (diamond badge).
- Card animation during updates/hover: Done.

## UI/UX Enhancement + Preferences
- Dark mode / Light mode: Done.
- Store preference in localStorage: Done.
- Persist across pages: Done.

## Backend API Setup
- `backend/` folder exists: Done.
- Express installed and configured: Done.
- Basic server code added: Done (`backend/server.js`).
- Player API endpoint (`/players`): Done.

## Netlify Deployment Readiness
- `netlify.toml` added with publish directory `files`: Done.
- Netlify Function added for backend player API (`/.netlify/functions/players`): Done.
- Static pages deployment-ready: Done.

## Important Live Server Note
- Fetch from local JSON requires serving via Live Server (not direct file open).
- Open `players.html` with Live Server in VS Code for full Fetch behavior.
