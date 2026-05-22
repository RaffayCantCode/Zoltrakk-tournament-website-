const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, '../lol-tournament-javascript/data.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            return { tournaments: [], teams: [], players: [] };
        }
    }
    return { tournaments: [], teams: [], players: [] };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const GAMES = {
    'lol': { name: 'League of Legends', icon: '⚔️', mode: '5v5', maxTeamSize: 5 },
    'cs2': { name: 'Counter-Strike 2', icon: '🔫', mode: '5v5', maxTeamSize: 5 },
    'valorant': { name: 'Valorant', icon: '🎯', mode: '5v5', maxTeamSize: 5 },
    'overwatch': { name: 'Overwatch 2', icon: '🦸', mode: '5v5', maxTeamSize: 5 }
};

app.get('/', (req, res) => {
    res.json({ 
        name: 'Zoltraak Arena API', 
        version: '2.0',
        endpoints: [
            '/games - List available games',
            '/tournaments - List tournaments',
            '/tournaments - Create tournament (POST)',
            '/tournaments/:id - Get/Update/Delete tournament',
            '/tournaments/:id/join - Join tournament',
            '/teams - List teams',
            '/players - List players (for PvP mode)'
        ]
    });
});

app.get('/games', (req, res) => {
    const gamesList = Object.entries(GAMES).map(([key, val]) => ({
        id: key,
        ...val
    }));
    res.json({ success: true, data: gamesList });
});

app.get('/tournaments', (req, res) => {
    const data = loadData();
    const { game, status, mode } = req.query;

    let tournaments = data.tournaments;

    if (game) {
        tournaments = tournaments.filter(t => t.game === game);
    }
    if (status) {
        tournaments = tournaments.filter(t => t.status === status);
    }
    if (mode) {
        tournaments = tournaments.filter(t => t.mode === mode);
    }

    res.json({
        success: true,
        count: tournaments.length,
        data: tournaments
    });
});

app.post('/tournaments', (req, res) => {
    const data = loadData();
    const { 
        name, game, mode, maxTeams, startDate, prizePool, format,
        description, hostName, hostId 
    } = req.body;

    if (!name || !game || !mode || !hostName) {
        return res.status(400).json({
            success: false,
            message: "Missing required fields: name, game, mode, hostName"
        });
    }

    if (!GAMES[game]) {
        return res.status(400).json({
            success: false,
            message: "Invalid game. Choose from: lol, cs2, valorant, overwatch"
        });
    }

    const tournament = {
        id: crypto.randomUUID(),
        name,
        game,
        mode,
        status: 'open',
        maxTeams: maxTeams || 10,
        maxPlayers: mode === 'solo' ? 16 : (maxTeams || 10),
        startDate: startDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        prizePool: prizePool || 'TBD',
        format: format || (mode === 'solo' ? 'Single Elimination' : '5v5 Double Elimination'),
        description: description || '',
        hostName,
        hostId: hostId || crypto.randomUUID(),
        registrations: [],
        matches: [],
        createdAt: new Date().toISOString()
    };

    data.tournaments.push(tournament);
    saveData(data);

    res.json({
        success: true,
        message: "Tournament created successfully",
        data: tournament
    });
});

app.get('/tournaments/:id', (req, res) => {
    const data = loadData();
    const { id } = req.params;

    const tournament = data.tournaments.find(t => t.id === id);

    if (!tournament) {
        return res.status(404).json({
            success: false,
            message: "Tournament not found"
        });
    }

    res.json({ success: true, data: tournament });
});

app.put('/tournaments/:id', (req, res) => {
    const data = loadData();
    const { id } = req.params;
    const { hostId, status, matches, ...updates } = req.body;

    const index = data.tournaments.findIndex(t => t.id === id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: "Tournament not found" });
    }

    const tournament = data.tournaments[index];

    if (hostId !== tournament.hostId) {
        return res.status(403).json({ success: false, message: "Only host can modify tournament" });
    }

    if (status) tournament.status = status;
    if (matches) tournament.matches = matches;
    Object.assign(tournament, updates);
    tournament.updatedAt = new Date().toISOString();

    saveData(data);

    res.json({ success: true, message: "Tournament updated", data: tournament });
});

app.delete('/tournaments/:id', (req, res) => {
    const data = loadData();
    const { id } = req.params;
    const { hostId } = req.body;

    const index = data.tournaments.findIndex(t => t.id === id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: "Tournament not found" });
    }

    const tournament = data.tournaments[index];
    if (hostId !== tournament.hostId) {
        return res.status(403).json({ success: false, message: "Only host can delete tournament" });
    }

    data.tournaments.splice(index, 1);
    saveData(data);

    res.json({ success: true, message: "Tournament deleted" });
});

app.post('/tournaments/:id/join', (req, res) => {
    const data = loadData();
    const { id } = req.params;
    const { teamName, players, playerName, playerId } = req.body;

    const tournament = data.tournaments.find(t => t.id === id);
    if (!tournament) {
        return res.status(404).json({ success: false, message: "Tournament not found" });
    }

    if (tournament.status !== 'open') {
        return res.status(400).json({ success: false, message: "Tournament is not open for registration" });
    }

    const currentCount = tournament.mode === 'solo' 
        ? tournament.registrations.filter(r => r.type === 'solo').length
        : tournament.registrations.filter(r => r.type === 'team').length;

    if (currentCount >= tournament.maxTeams) {
        return res.status(400).json({ success: false, message: "Tournament is full" });
    }

    if (tournament.mode === 'team') {
        if (!teamName || !players || !Array.isArray(players)) {
            return res.status(400).json({ success: false, message: "Team name and players required" });
        }

        const existingTeam = tournament.registrations.find(r => r.teamName === teamName);
        if (existingTeam) {
            return res.status(400).json({ success: false, message: "Team name already taken" });
        }

        tournament.registrations.push({
            type: 'team',
            teamName,
            players,
            joinedAt: new Date().toISOString()
        });
    } else {
        if (!playerName) {
            return res.status(400).json({ success: false, message: "Player name required" });
        }

        const existingPlayer = tournament.registrations.find(r => r.playerName === playerName);
        if (existingPlayer) {
            return res.status(400).json({ success: false, message: "Already registered" });
        }

        tournament.registrations.push({
            type: 'solo',
            playerName,
            playerId: playerId || crypto.randomUUID(),
            joinedAt: new Date().toISOString()
        });
    }

    saveData(data);

    res.json({
        success: true,
        message: tournament.mode === 'team' ? `Team "${teamName}" joined!` : `Player "${playerName}" joined!`
    });
});

app.post('/tournaments/:id/leave', (req, res) => {
    const data = loadData();
    const { id } = req.params;
    const { teamName, playerName } = req.body;

    const tournament = data.tournaments.find(t => t.id === id);
    if (!tournament) {
        return res.status(404).json({ success: false, message: "Tournament not found" });
    }

    if (tournament.mode === 'team') {
        const index = tournament.registrations.findIndex(r => r.teamName === teamName);
        if (index !== -1) {
            tournament.registrations.splice(index, 1);
        }
    } else {
        const index = tournament.registrations.findIndex(r => r.playerName === playerName);
        if (index !== -1) {
            tournament.registrations.splice(index, 1);
        }
    }

    saveData(data);
    res.json({ success: true, message: "Left tournament successfully" });
});

app.get('/teams', (req, res) => {
    const data = loadData();
    const { tournamentId } = req.query;

    let teams = data.teams;
    if (tournamentId) {
        const tournament = data.tournaments.find(t => t.id === tournamentId);
        teams = tournament?.registrations.filter(r => r.type === 'team') || [];
    }

    res.json({ success: true, count: teams.length, data: teams });
});

app.get('/players', (req, res) => {
    const data = loadData();
    const { tournamentId } = req.query;

    let players = data.players;
    if (tournamentId) {
        const tournament = data.tournaments.find(t => t.id === tournamentId);
        players = tournament?.registrations.filter(r => r.type === 'solo') || [];
    }

    res.json({ success: true, count: players.length, data: players });
});

app.get('/my-tournaments', (req, res) => {
    const data = loadData();
    const { hostId } = req.query;

    if (!hostId) {
        return res.status(400).json({ success: false, message: "hostId required" });
    }

    const hosted = data.tournaments.filter(t => t.hostId === hostId);
    const joined = data.tournaments.filter(t => 
        t.registrations.some(r => r.hostId === hostId)
    );

    res.json({ success: true, data: { hosted, joined } });
});

app.listen(PORT, () => {
    console.log(`🎮 Zoltraak Arena API running at http://localhost:${PORT}`);
    console.log(`\nAvailable Games:`);
    Object.entries(GAMES).forEach(([key, val]) => {
        console.log(`  - ${key}: ${val.name} (${val.mode})`);
    });
    console.log(`\nEndpoints:`);
    console.log(`  GET    /games`);
    console.log(`  GET    /tournaments?game=lol&mode=team`);
    console.log(`  POST   /tournaments (create tournament)`);
    console.log(`  GET    /tournaments/:id`);
    console.log(`  PUT    /tournaments/:id (host only)`);
    console.log(`  DELETE /tournaments/:id (host only)`);
    console.log(`  POST   /tournaments/:id/join`);
    console.log(`  POST   /tournaments/:id/leave`);
});