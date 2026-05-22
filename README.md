# Zoltrakk Tournament Website

A fun, multi-page tournament website for organizing competitive matches with friends.

Create custom tournaments, build game-accurate team lineups, browse players, register participants, and enjoy a clean dark/light experience.

## Features

- Multi-page website:
  - `index.html`
  - `schedule.html`
  - `players.html`
  - `contact.html`
  - `signup.html`
  - `login.html`
  - `create.html`
  - `tournaments.html`
- Player cards loaded dynamically from JSON with Fetch API.
- Search and filter players by name, game, and rank.
- Registration system with:
  - localStorage persistence
  - max 10 participant limit
  - remove participant
  - live total count
- Signup and login validation with JavaScript.
- Password strength meter and password show/hide emoji toggle.
- Dark mode / light mode preference stored in localStorage.
- Shareable tournament links for friend access.
- Admin controls for tournament creator:
  - delete teams
  - move team order
  - automatic match generation
  - manual match assignment
- Friend join flow:
  - create a new team
  - or join an existing team

## Game-Specific Tournament Creation

Tournament creation is not generic anymore. Each game has its own meaningful team system:

- **League of Legends**
  - Top, Jungle, Mid, ADC, Support
- **Valorant**
  - Duelist, Controller, Initiator, Sentinel, Flex
- **Overwatch**
  - Tank, Damage, Damage, Support, Support
- **CS2**
  - Standard 5-player lineup slots

This makes game differences actually matter while creating tournaments.

## More Games Coming Soon

The platform is built to expand.
Upcoming support can include:

- Rocket League
- Dota 2
- Apex Legends
- PUBG / Fortnite modes

## Local Run

Use a local server for full functionality (especially Fetch):

1. Open project in VS Code.
2. Open `files/players.html` with Live Server.
3. Navigate pages through navbar.

## Backend API (Optional Local Dev)

Basic Express API is included in `backend/`.

1. Open `backend` folder terminal.
2. Install dependencies:
   - `npm install`
3. Start server:
   - `npm start`

## Netlify Deployment

This project is configured for Netlify:

- Static publish folder: `files`
- Netlify Functions folder: `netlify/functions`

Included function:
- `/.netlify/functions/players`

## Project Goal

Create a practical, creative tournament platform where friends can quickly set up and manage game nights while keeping each game's team logic authentic.
