const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'D0FD26_VRC';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Assurer l'existence du dossier data
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Preset de la grille F1 2026
const DEFAULT_F1_2026_GRID = [
  { id: '1', name: 'Max Verstappen', number: 1, team: 'Red Bull Racing', color: '#3671C6', code: 'VER' },
  { id: '2', name: 'Liam Lawson', number: 30, team: 'Red Bull Racing', color: '#3671C6', code: 'LAW' },
  { id: '3', name: 'Charles Leclerc', number: 16, team: 'Scuderia Ferrari HP', color: '#E8002D', code: 'LEC' },
  { id: '4', name: 'Lewis Hamilton', number: 44, team: 'Scuderia Ferrari HP', color: '#E8002D', code: 'HAM' },
  { id: '5', name: 'Lando Norris', number: 4, team: 'McLaren F1 Team', color: '#FF8000', code: 'NOR' },
  { id: '6', name: 'Oscar Piastri', number: 81, team: 'McLaren F1 Team', color: '#FF8000', code: 'PIA' },
  { id: '7', name: 'George Russell', number: 63, team: 'Mercedes-AMG Petronas', color: '#27F4D2', code: 'RUS' },
  { id: '8', name: 'Kimi Antonelli', number: 12, team: 'Mercedes-AMG Petronas', color: '#27F4D2', code: 'ANT' },
  { id: '9', name: 'Fernando Alonso', number: 14, team: 'Aston Martin Aramco', color: '#229971', code: 'ALO' },
  { id: '10', name: 'Lance Stroll', number: 18, team: 'Aston Martin Aramco', color: '#229971', code: 'STR' },
  { id: '11', name: 'Carlos Sainz', number: 55, team: 'Williams Racing', color: '#64C4FF', code: 'SAI' },
  { id: '12', name: 'Alexander Albon', number: 23, team: 'Williams Racing', color: '#64C4FF', code: 'ALB' },
  { id: '13', name: 'Nico Hülkenberg', number: 27, team: 'Audi F1 Team', color: '#E30613', code: 'HUL' },
  { id: '14', name: 'Gabriel Bortoleto', number: 5, team: 'Audi F1 Team', color: '#E30613', code: 'BOR' },
  { id: '15', name: 'Pierre Gasly', number: 10, team: 'Alpine F1 Team', color: '#0093CC', code: 'GAS' },
  { id: '16', name: 'Jack Doohan', number: 7, team: 'Alpine F1 Team', color: '#0093CC', code: 'DOO' },
  { id: '17', name: 'Esteban Ocon', number: 31, team: 'Haas F1 Team', color: '#B6BABD', code: 'OCO' },
  { id: '18', name: 'Oliver Bearman', number: 87, team: 'Haas F1 Team', color: '#B6BABD', code: 'BEA' },
  { id: '19', name: 'Yuki Tsunoda', number: 22, team: 'Visa Cash App RB', color: '#6692FF', code: 'TSU' },
  { id: '20', name: 'Isack Hadjar', number: 6, team: 'Visa Cash App RB', color: '#6692FF', code: 'HAD' }
];

// État initial de l'application
let state = {
  votingOpen: false,
  raceTitle: 'Grand Prix F1 26',
  showResultsPublicly: true,
  votingStartedAt: null,
  drivers: [...DEFAULT_F1_2026_GRID],
  // Clé: voterToken ou IP, Valeur: driverId
  votes: {}
};

// Chargement depuis le fichier de persistance si existant
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
      console.log('✅ Base de données chargée avec succès.');
    } else {
      saveDatabase();
      console.log('ℹ️ Nouvelle base de données initialisée.');
    }
  } catch (err) {
    console.error('⚠️ Erreur lecture base de données, utilisation état par défaut:', err.message);
  }
}

// Sauvegarde dans le fichier
function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('⚠️ Erreur écriture base de données:', err.message);
  }
}

loadDatabase();

// Calcul des statistiques de votes
function computeStats() {
  const voteCounts = {};
  const totalVotes = Object.keys(state.votes).length;

  state.drivers.forEach(d => {
    voteCounts[d.id] = 0;
  });

  Object.values(state.votes).forEach(driverId => {
    if (voteCounts[driverId] !== undefined) {
      voteCounts[driverId]++;
    }
  });

  const driversWithStats = state.drivers.map(d => {
    const count = voteCounts[d.id] || 0;
    const percentage = totalVotes > 0 ? Number(((count / totalVotes) * 100).toFixed(1)) : 0;
    return {
      ...d,
      votes: count,
      percentage: percentage
    };
  });

  // Trier par nombre de votes décroissant
  const ranking = [...driversWithStats].sort((a, b) => b.votes - a.votes);

  return {
    totalVotes,
    ranking,
    driversWithStats
  };
}

// Obtenir l'état public (sans les données privées)
function getPublicState(clientIp, voterToken) {
  const stats = computeStats();
  const token = voterToken || clientIp;
  const userVote = state.votes[token] || null;

  return {
    votingOpen: state.votingOpen,
    raceTitle: state.raceTitle,
    showResultsPublicly: state.showResultsPublicly,
    votingStartedAt: state.votingStartedAt,
    totalVotes: stats.totalVotes,
    drivers: state.showResultsPublicly ? stats.driversWithStats : state.drivers.map(d => ({ ...d, votes: 0, percentage: 0 })),
    ranking: state.showResultsPublicly ? stats.ranking : [],
    userVote: userVote
  };
}

// Obtenir l'état complet pour l'admin
function getAdminState() {
  const stats = computeStats();
  return {
    votingOpen: state.votingOpen,
    raceTitle: state.raceTitle,
    showResultsPublicly: state.showResultsPublicly,
    votingStartedAt: state.votingStartedAt,
    totalVotes: stats.totalVotes,
    drivers: stats.driversWithStats,
    ranking: stats.ranking,
    votesRawCount: Object.keys(state.votes).length
  };
}

// Diffusion WebSocket à tous les clients connectés
function broadcastState() {
  const adminPayload = JSON.stringify({ type: 'ADMIN_UPDATE', state: getAdminState() });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      if (client.isAdmin) {
        client.send(adminPayload);
      } else {
        const publicPayload = JSON.stringify({
          type: 'PUBLIC_UPDATE',
          state: getPublicState(client.ip, client.voterToken)
        });
        client.send(publicPayload);
      }
    }
  });
}

// Gestion des connexions WebSocket
wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  ws.ip = ip;
  ws.isAdmin = false;
  ws.voterToken = null;

  // Envoi initial
  ws.send(JSON.stringify({
    type: 'PUBLIC_UPDATE',
    state: getPublicState(ip, null)
  }));

  ws.on('message', message => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'IDENTIFY') {
        ws.voterToken = data.voterToken;
        if (data.isAdminAuth) {
          ws.isAdmin = true;
          ws.send(JSON.stringify({ type: 'ADMIN_UPDATE', state: getAdminState() }));
        } else {
          ws.send(JSON.stringify({
            type: 'PUBLIC_UPDATE',
            state: getPublicState(ws.ip, ws.voterToken)
          }));
        }
      }
    } catch (e) {
      console.error('Erreur parsing WebSocket message:', e);
    }
  });
});

// Middleware d'authentification Admin pour les requêtes HTTP
function requireAdmin(req, res, next) {
  const authHeader = req.headers['x-admin-password'];
  if (authHeader && authHeader === ADMIN_PASSWORD) {
    return next();
  }
  return res.status(401).json({ error: 'Mot de passe administrateur incorrect' });
}

// ROUTES API

// 1. État public
app.get('/api/state', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const voterToken = req.query.token || clientIp;
  res.json(getPublicState(clientIp, voterToken));
});

// 2. Voter pour un pilote
app.post('/api/vote', (req, res) => {
  if (!state.votingOpen) {
    return res.status(403).json({
      success: false,
      message: 'Les votes de pilotes du jour ne sont pas encore ouverts'
    });
  }

  const { driverId, voterToken } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const token = voterToken || clientIp;

  if (!driverId) {
    return res.status(400).json({ success: false, message: 'Identifiant du pilote manquant' });
  }

  const driverExists = state.drivers.some(d => d.id === driverId);
  if (!driverExists) {
    return res.status(404).json({ success: false, message: 'Pilote introuvable' });
  }

  // Enregistrer le vote
  state.votes[token] = driverId;
  saveDatabase();
  broadcastState();

  const driver = state.drivers.find(d => d.id === driverId);
  res.json({
    success: true,
    message: `Vote enregistré avec succès pour ${driver.name} (#${driver.number} - ${driver.team}) !`,
    userVote: driverId
  });
});

// 3. Login Admin
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, message: 'Connexion réussie', state: getAdminState() });
  } else {
    res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
  }
});

// 4. Toggle état des votes
app.post('/api/admin/toggle-votes', requireAdmin, (req, res) => {
  state.votingOpen = !state.votingOpen;
  if (state.votingOpen && !state.votingStartedAt) {
    state.votingStartedAt = Date.now();
  } else if (!state.votingOpen) {
    state.votingStartedAt = null;
  }
  saveDatabase();
  broadcastState();
  res.json({
    success: true,
    votingOpen: state.votingOpen,
    message: state.votingOpen ? 'Les votes sont maintenant OUVERTS !' : 'Les votes sont maintenant FERMÉS.'
  });
});

// 5. Réinitialiser les votes
app.post('/api/admin/reset-votes', requireAdmin, (req, res) => {
  state.votes = {};
  saveDatabase();
  broadcastState();
  res.json({ success: true, message: 'Tous les votes ont été réinitialisés à zéro.' });
});

// 6. Mettre à jour les paramètres de course
app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const { raceTitle, showResultsPublicly } = req.body;
  if (raceTitle !== undefined) state.raceTitle = raceTitle.trim() || 'Grand Prix F1 26';
  if (showResultsPublicly !== undefined) state.showResultsPublicly = Boolean(showResultsPublicly);
  saveDatabase();
  broadcastState();
  res.json({ success: true, message: 'Paramètres mis à jour.', state: getAdminState() });
});

// 7. Ajouter un pilote
app.post('/api/admin/driver', requireAdmin, (req, res) => {
  const { name, number, team, color, code } = req.body;
  if (!name || !number || !team) {
    return res.status(400).json({ success: false, message: 'Nom, numéro et écurie sont obligatoires.' });
  }

  const num = parseInt(number, 10);
  if (isNaN(num) || num < 0 || num > 99) {
    return res.status(400).json({ success: false, message: 'Numéro invalide (doit être entre 0 et 99).' });
  }

  const newDriver = {
    id: Date.now().toString(),
    name: name.trim(),
    number: num,
    team: team.trim(),
    color: color || '#E10600',
    code: code ? code.toUpperCase().trim() : name.trim().slice(0, 3).toUpperCase()
  };

  state.drivers.push(newDriver);
  saveDatabase();
  broadcastState();
  res.json({ success: true, message: `Pilote ${newDriver.name} (#${newDriver.number}) ajouté !`, driver: newDriver });
});

// 8. Modifier un pilote
app.put('/api/admin/driver/:id', requireAdmin, (req, res) => {
  const driverId = req.params.id;
  const { name, number, team, color, code } = req.body;

  const index = state.drivers.findIndex(d => d.id === driverId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Pilote introuvable' });
  }

  if (name) state.drivers[index].name = name.trim();
  if (number !== undefined) state.drivers[index].number = parseInt(number, 10);
  if (team) state.drivers[index].team = team.trim();
  if (color) state.drivers[index].color = color;
  if (code) state.drivers[index].code = code.toUpperCase().trim();

  saveDatabase();
  broadcastState();
  res.json({ success: true, message: 'Pilote mis à jour.', driver: state.drivers[index] });
});

// 9. Supprimer un pilote
app.delete('/api/admin/driver/:id', requireAdmin, (req, res) => {
  const driverId = req.params.id;
  const initialLength = state.drivers.length;
  state.drivers = state.drivers.filter(d => d.id !== driverId);

  // Nettoyer les votes pour ce pilote
  Object.keys(state.votes).forEach(k => {
    if (state.votes[k] === driverId) {
      delete state.votes[k];
    }
  });

  if (state.drivers.length < initialLength) {
    saveDatabase();
    broadcastState();
    return res.json({ success: true, message: 'Pilote supprimé avec succès.' });
  } else {
    return res.status(404).json({ success: false, message: 'Pilote introuvable.' });
  }
});

// 10. Charger la grille F1 2026 officielle
app.post('/api/admin/load-preset', requireAdmin, (req, res) => {
  const { clearVotes } = req.body;
  state.drivers = JSON.parse(JSON.stringify(DEFAULT_F1_2026_GRID));
  if (clearVotes) {
    state.votes = {};
  }
  saveDatabase();
  broadcastState();
  res.json({ success: true, message: 'Grille F1 2026 chargée avec succès (20 pilotes).', state: getAdminState() });
});

// 11. Vider toute la grille
app.post('/api/admin/clear-grid', requireAdmin, (req, res) => {
  state.drivers = [];
  state.votes = {};
  saveDatabase();
  broadcastState();
  res.json({ success: true, message: 'Grille réinitialisée (0 pilote).', state: getAdminState() });
});

// Redirection propre
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Détection de l'adresse IP locale pour affichage pratique
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Démarrage du serveur
server.listen(PORT, () => {
  const localIp = getLocalIp();
  console.log(`
🏎️  =============================================================
   F1 26 - PILOTE DU JOUR (DRIVER OF THE DAY)
   =============================================================
   🏁 Application démarrée avec succès !
   
   🌐 Accès Public (Votes) :
      - Local :  http://localhost:${PORT}
      - Réseau : http://${localIp}:${PORT}
      
   🛠️  Panel Administrateur :
      - Local :  http://localhost:${PORT}/admin
      - Réseau : http://${localIp}:${PORT}/admin
      - Mot de passe par défaut : ${ADMIN_PASSWORD}
   =============================================================
`);
});
