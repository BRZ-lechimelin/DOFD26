/**
 * F1 26 - Panel Administrateur
 * Cockpit de contrôle de la course, gestion des pilotes et résultats en direct
 */

document.addEventListener('DOMContentLoaded', () => {
  let adminPassword = sessionStorage.getItem('f1_admin_pwd') || '';
  let adminState = {
    votingOpen: false,
    raceTitle: 'Grand Prix F1 26',
    showResultsPublicly: true,
    totalVotes: 0,
    drivers: [],
    ranking: []
  };

  let editingDriverId = null;

  // --- Preset F1 2026 Team Colors ---
  const TEAM_COLORS = [
    { name: 'Ferrari', color: '#E8002D' },
    { name: 'McLaren', color: '#FF8000' },
    { name: 'Red Bull', color: '#3671C6' },
    { name: 'Mercedes', color: '#27F4D2' },
    { name: 'Aston Martin', color: '#229971' },
    { name: 'Audi', color: '#E30613' },
    { name: 'Williams', color: '#64C4FF' },
    { name: 'Alpine', color: '#0093CC' },
    { name: 'Haas', color: '#B6BABD' },
    { name: 'Racing Bulls', color: '#6692FF' }
  ];

  // --- DOM Elements ---
  const elAuthOverlay = document.getElementById('authOverlay');
  const elLoginForm = document.getElementById('loginForm');
  const elPasswordInput = document.getElementById('adminPasswordInput');
  const elLoginError = document.getElementById('loginError');

  // Cockpit
  const elBtnToggleVoting = document.getElementById('btnToggleVoting');
  const elVotingStatusText = document.getElementById('votingStatusText');
  const elRaceTitleInput = document.getElementById('raceTitleInput');
  const elBtnSaveRaceTitle = document.getElementById('btnSaveRaceTitle');

  // Metrics
  const elMetricTotalVotes = document.getElementById('metricTotalVotes');
  const elMetricLeaderName = document.getElementById('metricLeaderName');
  const elMetricLeaderPercent = document.getElementById('metricLeaderPercent');
  const elMetricDriversCount = document.getElementById('metricDriversCount');

  // Toolbar Actions
  const elTogglePublicResults = document.getElementById('togglePublicResults');
  const elBtnResetVotes = document.getElementById('btnResetVotes');
  const elBtnLoadPreset = document.getElementById('btnLoadPreset');
  const elBtnClearGrid = document.getElementById('btnClearGrid');
  const elBtnAnnounceWinner = document.getElementById('btnAnnounceWinner');
  const elBtnShareQR = document.getElementById('btnShareQR');

  // Leaderboard
  const elLeaderboardBody = document.getElementById('leaderboardBody');

  // Driver Management
  const elDriverForm = document.getElementById('addDriverForm');
  const elDriverName = document.getElementById('driverName');
  const elDriverNumber = document.getElementById('driverNumber');
  const elDriverTeam = document.getElementById('driverTeam');
  const elDriverCode = document.getElementById('driverCode');
  const elDriverColor = document.getElementById('driverColor');
  const elColorPresetsContainer = document.getElementById('colorPresetsContainer');
  const elAdminDriversList = document.getElementById('adminDriversList');

  // Modals
  const elWinnerModal = document.getElementById('winnerModal');
  const elWinnerCardContent = document.getElementById('winnerCardContent');
  const elCloseWinnerModal = document.getElementById('closeWinnerModal');

  const elQrModal = document.getElementById('qrModal');
  const elQrCodeContainer = document.getElementById('qrCodeContainer');
  const elQrUrlText = document.getElementById('qrUrlText');
  const elCloseQrModal = document.getElementById('closeQrModal');

  const elEditDriverModal = document.getElementById('editDriverModal');
  const elEditDriverForm = document.getElementById('editDriverForm');
  const elEditDriverName = document.getElementById('editDriverName');
  const elEditDriverNumber = document.getElementById('editDriverNumber');
  const elEditDriverTeam = document.getElementById('editDriverTeam');
  const elEditDriverCode = document.getElementById('editDriverCode');
  const elEditDriverColor = document.getElementById('editDriverColor');
  const elCloseEditModal = document.getElementById('closeEditModal');

  const elToastContainer = document.getElementById('toastContainer');

  // --- Setup Color Presets in Form ---
  function renderColorSwatches() {
    if (!elColorPresetsContainer) return;
    elColorPresetsContainer.innerHTML = TEAM_COLORS.map(tc => `
      <button type="button" class="color-swatch-btn" style="background-color: ${tc.color};" 
              title="${tc.name}" data-color="${tc.color}">
      </button>
    `).join('');

    elColorPresetsContainer.querySelectorAll('.color-swatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        elDriverColor.value = btn.dataset.color;
        elColorPresetsContainer.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }
  renderColorSwatches();

  // --- WebSocket Setup ---
  let ws = null;
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (adminPassword) {
        ws.send(JSON.stringify({
          type: 'IDENTIFY',
          voterToken: 'admin_panel',
          isAdminAuth: true
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'ADMIN_UPDATE') {
          adminState = { ...adminState, ...payload.state };
          renderAdmin();
        }
      } catch (err) {
        console.error('Erreur WebSocket admin:', err);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
  }

  // --- Authentication ---
  if (adminPassword) {
    tryLogin(adminPassword);
  } else {
    elAuthOverlay.classList.remove('hidden');
  }

  elLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = elPasswordInput.value.trim();
    if (!pwd) return;
    await tryLogin(pwd);
  });

  async function tryLogin(pwd) {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        adminPassword = pwd;
        sessionStorage.setItem('f1_admin_pwd', pwd);
        elAuthOverlay.classList.add('hidden');
        adminState = data.state;
        renderAdmin();
        connectWebSocket();
        showToast('Connexion administrateur réussie', 'success');
      } else {
        elLoginError.textContent = data.message || 'Mot de passe incorrect';
        elLoginError.style.display = 'block';
      }
    } catch (err) {
      elLoginError.textContent = 'Erreur réseau de connexion';
      elLoginError.style.display = 'block';
    }
  }

  // Helper pour les requêtes authentifiées
  async function adminFetch(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'x-admin-password': adminPassword,
      ...(options.headers || {})
    };

    const res = await fetch(endpoint, { ...options, headers });
    if (res.status === 401) {
      sessionStorage.removeItem('f1_admin_pwd');
      adminPassword = '';
      elAuthOverlay.classList.remove('hidden');
      throw new Error('Session expirée ou non autorisée');
    }
    return res;
  }

  // --- Master Render Function ---
  function renderAdmin() {
    // 1. Cockpit Voting State Button
    if (adminState.votingOpen) {
      elBtnToggleVoting.className = 'btn-toggle-voting stop';
      elBtnToggleVoting.innerHTML = '🛑 FERMER LES VOTES';
      elVotingStatusText.innerHTML = '<span style="color: var(--green-live);">● VOTE EN DIRECT</span>';
    } else {
      elBtnToggleVoting.className = 'btn-toggle-voting launch';
      elBtnToggleVoting.innerHTML = '🏁 OUVRIR LES VOTES';
      elVotingStatusText.innerHTML = '<span style="color: #FF5252;">● VOTES FERMÉS</span> ("Les votes de pilotes du jour ne sont pas encore ouverts")';
    }

    // 2. Race Title Input
    if (document.activeElement !== elRaceTitleInput) {
      elRaceTitleInput.value = adminState.raceTitle || 'Grand Prix F1 26';
    }

    // 3. Checkbox Public Results
    elTogglePublicResults.checked = Boolean(adminState.showResultsPublicly);

    // 4. Metrics
    elMetricTotalVotes.textContent = adminState.totalVotes;
    elMetricDriversCount.textContent = adminState.drivers.length;

    const leader = adminState.ranking && adminState.ranking.length > 0 ? adminState.ranking[0] : null;
    if (leader && leader.votes > 0) {
      elMetricLeaderName.textContent = `#${leader.number} ${leader.name}`;
      elMetricLeaderName.style.color = leader.color || '#fff';
      elMetricLeaderPercent.textContent = `${leader.percentage}% (${leader.votes} vote${leader.votes > 1 ? 's' : ''})`;
    } else {
      elMetricLeaderName.textContent = 'En attente...';
      elMetricLeaderName.style.color = '#fff';
      elMetricLeaderPercent.textContent = '0% (0 vote)';
    }

    // 5. Render Leaderboard Table
    renderLeaderboard();

    // 6. Render Drivers List in Management Section
    renderDriversList();
  }

  // --- Render Leaderboard Table ---
  function renderLeaderboard() {
    if (!elLeaderboardBody) return;

    if (!adminState.ranking || adminState.ranking.length === 0) {
      elLeaderboardBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            Aucun pilote inscrit pour le moment.
          </td>
        </tr>
      `;
      return;
    }

    elLeaderboardBody.innerHTML = adminState.ranking.map((driver, index) => {
      let rankClass = '';
      if (index === 0) rankClass = 'gold';
      else if (index === 1) rankClass = 'silver';
      else if (index === 2) rankClass = 'bronze';

      const teamColor = driver.color || '#E10600';
      const percentage = driver.percentage !== undefined ? driver.percentage : 0;
      const votes = driver.votes || 0;

      return `
        <tr>
          <td class="rank-col ${rankClass}">P${index + 1}</td>
          <td>
            <div class="driver-col-content">
              <span class="driver-col-color" style="background-color: ${teamColor};"></span>
              <span class="driver-col-num">#${driver.number}</span>
              <div>
                <div class="driver-col-name">${driver.name}</div>
                <div class="driver-col-team">${driver.team}</div>
              </div>
            </div>
          </td>
          <td class="bar-col">
            <div class="progress-track" style="height: 10px;">
              <div class="progress-bar-fill" style="width: ${percentage}%; background-color: ${teamColor};"></div>
            </div>
          </td>
          <td class="percentage-col">${percentage}%</td>
          <td class="votes-col">${votes}</td>
        </tr>
      `;
    }).join('');
  }

  // --- Render Driver Management Grid ---
  function renderDriversList() {
    if (!elAdminDriversList) return;

    if (!adminState.drivers || adminState.drivers.length === 0) {
      elAdminDriversList.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
          Aucun pilote enregistré. Cliquez sur "Charger la grille officielle F1 2026" ou ajoutez-en un manuellement.
        </div>
      `;
      return;
    }

    // Tri par numéro
    const sorted = [...adminState.drivers].sort((a, b) => a.number - b.number);

    elAdminDriversList.innerHTML = sorted.map(driver => `
      <div class="admin-driver-item" style="--team-color: ${driver.color || '#E10600'};">
        <div class="admin-item-info">
          <div class="admin-item-num">#${driver.number}</div>
          <div class="admin-item-name">${driver.name}</div>
          <div class="admin-item-team">${driver.team}</div>
        </div>
        <div class="admin-item-actions">
          <button class="btn-item-action edit" data-id="${driver.id}" title="Modifier ce pilote">✏️</button>
          <button class="btn-item-action delete" data-id="${driver.id}" title="Supprimer ce pilote">🗑️</button>
        </div>
      </div>
    `).join('');

    // Actions edit & delete
    elAdminDriversList.querySelectorAll('.btn-item-action.edit').forEach(btn => {
      btn.addEventListener('click', () => openEditDriver(btn.dataset.id));
    });

    elAdminDriversList.querySelectorAll('.btn-item-action.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteDriver(btn.dataset.id));
    });
  }

  // --- Toggle Voting Open / Closed ---
  elBtnToggleVoting.addEventListener('click', async () => {
    try {
      const res = await adminFetch('/api/admin/toggle-votes', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (window.f1Audio) window.f1Audio.playRadioBeep();
        showToast(data.message, data.votingOpen ? 'success' : 'info');
      }
    } catch (err) {
      showToast('Erreur lors du basculement des votes', 'error');
    }
  });

  // --- Save Race Title ---
  elBtnSaveRaceTitle.addEventListener('click', async () => {
    const title = elRaceTitleInput.value.trim();
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ raceTitle: title })
      });
      if (res.ok) {
        showToast('Nom du Grand Prix mis à jour !', 'success');
      }
    } catch (err) {
      showToast('Erreur mise à jour titre', 'error');
    }
  });

  // --- Toggle Public Results ---
  elTogglePublicResults.addEventListener('change', async (e) => {
    const isChecked = e.target.checked;
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ showResultsPublicly: isChecked })
      });
      if (res.ok) {
        showToast(`Affichage des résultats publics ${isChecked ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`, 'info');
      }
    } catch (err) {
      showToast('Erreur modification paramètres', 'error');
    }
  });

  // --- Reset All Votes ---
  elBtnResetVotes.addEventListener('click', async () => {
    const confirmReset = confirm('⚠️ Êtes-vous sûr de vouloir remettre tous les votes à zéro ? Cette action est irréversible.');
    if (!confirmReset) return;

    try {
      const res = await adminFetch('/api/admin/reset-votes', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
      }
    } catch (err) {
      showToast('Erreur réinitialisation des votes', 'error');
    }
  });

  // --- Load Official F1 2026 Grid Preset ---
  elBtnLoadPreset.addEventListener('click', async () => {
    const confirmLoad = confirm('Charger la grille officielle F1 2026 (20 pilotes officiels : Ferrari, McLaren, Red Bull, Audi, Mercedes, etc.) ?');
    if (!confirmLoad) return;

    try {
      const res = await adminFetch('/api/admin/load-preset', {
        method: 'POST',
        body: JSON.stringify({ clearVotes: false })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
      }
    } catch (err) {
      showToast('Erreur chargement preset', 'error');
    }
  });

  // --- Clear Grid ---
  elBtnClearGrid.addEventListener('click', async () => {
    const confirmClear = confirm('Supprimer tous les pilotes de la liste ?');
    if (!confirmClear) return;

    try {
      const res = await adminFetch('/api/admin/clear-grid', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'info');
      }
    } catch (err) {
      showToast('Erreur réinitialisation grille', 'error');
    }
  });

  // --- Add Driver Form Submission ---
  elDriverForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = elDriverName.value.trim();
    const number = elDriverNumber.value.trim();
    const team = elDriverTeam.value.trim();
    const code = elDriverCode.value.trim();
    const color = elDriverColor.value.trim() || '#E10600';

    if (!name || !number || !team) {
      showToast('Veuillez remplir le Nom, le Numéro et l’Écurie.', 'error');
      return;
    }

    try {
      const res = await adminFetch('/api/admin/driver', {
        method: 'POST',
        body: JSON.stringify({ name, number, team, code, color })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message, 'success');
        elDriverForm.reset();
        elDriverColor.value = '#E10600';
      } else {
        showToast(data.message || 'Erreur lors de l’ajout du pilote', 'error');
      }
    } catch (err) {
      showToast('Erreur réseau lors de l’ajout', 'error');
    }
  });

  // --- Edit Driver Modal & Submit ---
  function openEditDriver(id) {
    const driver = adminState.drivers.find(d => d.id === id);
    if (!driver) return;

    editingDriverId = id;
    elEditDriverName.value = driver.name;
    elEditDriverNumber.value = driver.number;
    elEditDriverTeam.value = driver.team;
    elEditDriverCode.value = driver.code || '';
    elEditDriverColor.value = driver.color || '#E10600';

    elEditDriverModal.classList.add('active');
  }

  function closeEditModal() {
    elEditDriverModal.classList.remove('active');
    editingDriverId = null;
  }

  elCloseEditModal.addEventListener('click', closeEditModal);
  elEditDriverModal.addEventListener('click', (e) => {
    if (e.target === elEditDriverModal) closeEditModal();
  });

  elEditDriverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingDriverId) return;

    const name = elEditDriverName.value.trim();
    const number = elEditDriverNumber.value.trim();
    const team = elEditDriverTeam.value.trim();
    const code = elEditDriverCode.value.trim();
    const color = elEditDriverColor.value.trim();

    try {
      const res = await adminFetch(`/api/admin/driver/${editingDriverId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, number, team, code, color })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message, 'success');
        closeEditModal();
      } else {
        showToast(data.message || 'Erreur modification pilote', 'error');
      }
    } catch (err) {
      showToast('Erreur réseau modification pilote', 'error');
    }
  });

  // --- Delete Driver ---
  async function deleteDriver(id) {
    const driver = adminState.drivers.find(d => d.id === id);
    if (!driver) return;

    const confirmDel = confirm(`Voulez-vous vraiment supprimer ${driver.name} (#${driver.number}) ?`);
    if (!confirmDel) return;

    try {
      const res = await adminFetch(`/api/admin/driver/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'info');
      }
    } catch (err) {
      showToast('Erreur suppression pilote', 'error');
    }
  }

  // --- Announce Winner Modal (Podium Graphic for Stream) ---
  elBtnAnnounceWinner.addEventListener('click', () => {
    const leader = adminState.ranking && adminState.ranking.length > 0 ? adminState.ranking[0] : null;
    if (!leader || leader.votes === 0) {
      showToast('Aucun vote n’a encore été enregistré pour désigner un vainqueur !', 'error');
      return;
    }

    if (window.f1Audio) window.f1Audio.playVoteSuccess();

    elWinnerCardContent.innerHTML = `
      <div class="winner-graphic" style="border-color: ${leader.color || 'var(--gold)'};">
        <div class="winner-badge" style="background: ${leader.color || 'var(--gold)'};">
          🏆 PILOTE DU JOUR F1 26 🏆
        </div>
        <div class="winner-number" style="color: ${leader.color || 'var(--gold)'};">
          #${leader.number}
        </div>
        <div class="winner-name">${leader.name}</div>
        <div class="winner-team">${leader.team}</div>
        <div class="winner-stat-pill">
          <span>${leader.percentage}% DES SUFFRAGES</span>
          <span>${leader.votes} VOTE${leader.votes > 1 ? 'S' : ''}</span>
        </div>
      </div>
    `;

    elWinnerModal.classList.add('active');
  });

  elCloseWinnerModal.addEventListener('click', () => elWinnerModal.classList.remove('active'));
  elWinnerModal.addEventListener('click', (e) => {
    if (e.target === elWinnerModal) elWinnerModal.classList.remove('active');
  });

  // --- Share / QR Code Modal ---
  elBtnShareQR.addEventListener('click', () => {
    const publicUrl = `${window.location.origin}/`;
    elQrUrlText.textContent = publicUrl;
    if (window.generateQRCode) {
      window.generateQRCode(elQrCodeContainer, publicUrl, 200);
    }
    elQrModal.classList.add('active');
  });

  elCloseQrModal.addEventListener('click', () => elQrModal.classList.remove('active'));
  elQrModal.addEventListener('click', (e) => {
    if (e.target === elQrModal) elQrModal.classList.remove('active');
  });

  // --- Toast Notification Helper ---
  function showToast(message, type = 'info') {
    if (!elToastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '🏁';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    elToastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
});
