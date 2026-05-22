const STORAGE_KEY = "tournament_teams";
const API_BASE = "http://localhost:3000";

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) throw new Error('API request failed');
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

async function postAPI(endpoint, data) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

async function deleteAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. CONTACT PAGE LOGIC (Registration)
    // ==========================================
    const teamForm = document.getElementById('teamForm');
    
    if (teamForm) {
        teamForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const result = await fetchAPI('/teams');
            const teams = result?.data || [];
            if (teams.length >= 10) {
                alert("Tournament is full! Max 10 teams allowed.");
                return;
            }

            // Grab the data to show the preview
            const teamName = document.getElementById('teamName').value;
            const names = document.querySelectorAll('.p-name');
            const ids = document.querySelectorAll('.p-id');
            const roles = document.querySelectorAll('.p-role');
            
            const reviewDisplay = document.getElementById('rosterDisplay');
            reviewDisplay.innerHTML = ""; // Clear any old previews
            
            // Generate the preview cards
            for(let i=0; i<5; i++) {
                reviewDisplay.innerHTML += `
                    <div class="player-card" style="background: rgba(10, 200, 245, 0.1); border-color: var(--cyan-accent);">
                        <h3 style="color: var(--gold-main); margin-top: 0;">${i === 0 ? '👑' : '⚔️'} ${names[i].value}</h3>
                        <p style="margin: 5px 0; color: white;"><strong>ID:</strong> ${ids[i].value}</p>
                        <p style="margin: 5px 0; color: var(--cyan-accent);"><strong>Role:</strong> ${roles[i].value}</p>
                    </div>
                `;
            }

            // Hide form, show review screen
            document.getElementById('formContainer').style.display = 'none';
            document.getElementById('reviewContainer').style.display = 'block';
            document.getElementById('reviewTeamName').innerText = "Review Squad: " + teamName;
        });

        document.getElementById('confirmBtn').addEventListener('click', async () => {
            const teamName = document.getElementById('teamName').value;
            const names = document.querySelectorAll('.p-name');
            const ids = document.querySelectorAll('.p-id');
            const roles = document.querySelectorAll('.p-role');

            let players = [];
            for(let i=0; i<5; i++) {
                players.push({ name: names[i].value, id: ids[i].value, role: roles[i].value });
            }

            const result = await postAPI('/teams', { teamName, players, game: 'League of Legends' });

            if (result && result.success) {
                localStorage.setItem('myTeamName', teamName);
                loadTeams();

                document.getElementById('reviewContainer').style.display = 'none';
                const msg = document.getElementById('messageContainer');
                msg.style.display = 'block';
                msg.innerHTML = `
                    <h2 style="color: var(--cyan-accent); font-size: 2.5rem; text-shadow: 0 0 15px rgba(10, 200, 245, 0.5);">✅ Draft Locked!</h2>
                    <p style="font-size: 1.2rem;">Team <strong style="color: var(--gold-main); font-size: 1.5rem;">${teamName}</strong> is officially registered.</p>
                    <div style="margin-top:30px;">
                        <a href="players.html" class="btn">View All Teams</a>
                        <a href="team.html" class="btn" style="margin-left: 10px; border-color: var(--cyan-accent); color: var(--cyan-accent); background: rgba(10,200,245,0.08);">My Team</a>
                        <button onclick="location.reload()" class="btn secondary" style="margin-left: 10px;">Register Another Team</button>
                    </div>`;
            } else {
                alert(result?.message || 'Failed to register team');
            }
        });
    }

    // ==========================================
    // 2. PLAYERS PAGE LOGIC (Roster View)
    // ==========================================
    if (document.getElementById('participantsList')) {
        loadTeams();
    }
});

async function loadTeams() {
    const list = document.getElementById('participantsList');
    const counter = document.getElementById('teamCount');

    if (!list || !counter) return;

    const result = await fetchAPI('/teams');
    const teams = result?.data || [];

    list.innerHTML = "";
    counter.innerText = `Teams Registered: ${teams.length} / 10`;

    if (teams.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 50px; background: var(--glass-bg); border-radius: 16px; border: 1px solid var(--glass-border);">
                <h3 style="color: var(--text-muted);">No squads have locked in yet.</h3>
                <a href="contact.html" class="btn" style="margin-top: 15px;">Register a Team</a>
            </div>`;
        return;
    }

    teams.forEach((team, tIndex) => {
        let card = document.createElement('div');
        card.className = "squad-card";

        let playersHtml = team.players.map((p, pIndex) => `
            <div class="player-row" style="${pIndex === 0 ? 'grid-column: 1 / -1; border-left: 3px solid var(--cyan-accent);' : ''}">
                <span>${pIndex === 0 ? '👑' : '⚔️'} <strong>${p.name}</strong> <span style="color: var(--text-muted); font-size: 0.85rem;">(${p.id})</span></span>
                <span class="role-tag">${p.role}</span>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="squad-header">
                <span class="squad-name">${team.teamName}</span>
                <button class="btn-delete" onclick="removeTeam('${team.teamName}')">Disband Team</button>
            </div>
            <div class="player-grid">
                ${playersHtml}
            </div>
        `;
        list.appendChild(card);
    });
}

async function removeTeam(teamName) {
    if(confirm("Are you sure you want to disband this team from the tournament?")) {
        await deleteAPI(`/teams/${encodeURIComponent(teamName)}`);
        loadTeams();
    }
}

async function clearAllTeams() {
    if(confirm("CRITICAL WARNING: This will permanently delete ALL registered teams! Proceed?")) {
        const result = await fetchAPI('/teams');
        if (result?.data) {
            for (const team of result.data) {
                await deleteAPI(`/teams/${encodeURIComponent(team.teamName)}`);
            }
        }
        loadTeams();
    }
}