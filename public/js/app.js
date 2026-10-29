/**
 * F1 26 - Pilote du Jour (Driver of the Day)
 * Public Client Logic & Real-time Synchronization
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- State & Variables ---
  let appState = {
    votingOpen: false,
    raceTitle: 'Grand Prix F1 26',
    showResultsPublicly: true,
    totalVotes: 0,
    drivers: [],
    ranking: [],
    userVote: null
  };

  let activeTeamFilter = 'ALL';
  let searchQuery = '';
  let selectedDriverForModal = null;
  let lightsInterval = null;
  let previousVotingState = null;

  // --- Voter Identity Token (Persistent per device/browser) ---
  let voterToken = localStorage.getItem('f1_voter_token');
  if (!voterToken) {
    voterToken = 'voter_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
    localStorage.setItem('f1_voter_token', voterToken);
  }

  // --- DOM Elements ---
  const elStatusPill = document.getElementById('statusPill');
  const elStatusText = document.getElementById('statusText');
  const elRaceTitle = document.getElementById('raceTitle');
  const elClosedSection = document.getElementById('closedSection');
  const elOpenSection = document.getElementById('openSection');
  const elDriversGrid = document.getElementById('driversGrid');
  const elUserVoteBanner = document.getElementById('userVoteBanner');
  const elVotedDriverName = document.getElementById('votedDriverName');
  const elTeamFilterScroll = document.getElementById('teamFilterScroll');
  const elSearchInput = document.getElementById('driverSearchInput');
  const elTotalVotesDisplay = document.getElementById('totalVotesDisplay');
  const elPublicResultsSection = document.getElementById('publicResultsSection');
  const elPodiumContainer = document.getElementById('podiumContainer');
  const elAudioToggle = document.getElementById('audioToggle');
  const elAudioIcon = document.getElementById('audioIcon');

  // Confirmation Modal Elements
  const elConfirmModal = document.getElementById('confirmVoteModal');
  const elModalDriverPreview = document.getElementById('modalDriverPreview');
  const elBtnCancelVote = document.getElementById('btnCancelVote');
  const elBtnConfirmVote = document.getElementById('btnConfirmVote');
  const elModalCloseBtn = document.getElementById('modalCloseBtn');

  // Toast Container
  const elToastContainer = document.getElementById('toastContainer');

  // --- Audio Toggle Setup ---
  function updateAudioButton() {
    if (window.f1Audio) {
      elAudioIcon.textContent = window.f1Audio.isMuted() ? '🔇' : '🔊';
    }
  }
  updateAudioButton();

  elAudioToggle.addEventListener('click', () => {
    if (window.f1Audio) {
      const isMuted = window.f1Audio.toggleMute();
      updateAudioButton();
      showToast(isMuted ? 'Son désactivé' : 'Son activé', 'info');
    }
  });

  // --- WebSocket Connection ---
  let ws = null;
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Identifier le token pour recevoir le statut personnalisé
      ws.send(JSON.stringify({
        type: 'IDENTIFY',
        voterToken: voterToken,
        isAdminAuth: false
      }));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'PUBLIC_UPDATE') {
          handleStateUpdate(payload.state);
        }
      } catch (err) {
        console.error('Erreur traitement message WebSocket:', err);
      }
    };

    ws.onclose = () => {
      // Reconnexion automatique après 3 secondes
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.warn('Erreur WebSocket, repli sur HTTP:', err);
      ws.close();
    };
  }

  // --- Initial HTTP Fetch (Immediate render) ---
  async function fetchInitialState() {
    try {
      const res = await fetch(`/api/state?token=${encodeURIComponent(voterToken)}`);
      if (res.ok) {
        const data = await res.json();
        handleStateUpdate(data);
      }
    } catch (err) {
      console.error('Erreur récupération état initial:', err);
    }
  }

  // --- Handle State Update ---
  function handleStateUpdate(newState) {
    const wasOpen = previousVotingState;
    appState = { ...appState, ...newState };
    previousVotingState = appState.votingOpen;

    // Son d'ouverture des votes
    if (wasOpen === false && appState.votingOpen === true && window.f1Audio) {
      window.f1Audio.playRadioBeep();
      showToast('🏁 La direction de course a ouvert les votes !', 'success');
    }

    render();
  }

  // --- Master Render Function ---
  function render() {
    // 1. Race title
    if (elRaceTitle) {
      elRaceTitle.textContent = appState.raceTitle || 'Grand Prix F1 26';
    }

    // 2. Status Pill
    if (appState.votingOpen) {
      elStatusPill.className = 'live-pill open';
      elStatusText.textContent = 'En Direct • Votes Ouverts';
    } else {
      elStatusPill.className = 'live-pill closed';
      elStatusText.textContent = 'Votes Fermés';
    }

    // 3. Switch Sections: Closed vs Open
    if (!appState.votingOpen) {
      // FERMÉ: Afficher exactement le message requis
      elClosedSection.style.display = 'block';
      elOpenSection.style.display = 'none';
      startLightsAnimation();
    } else {
      // OUVERT: Afficher la grille de votes
      elClosedSection.style.display = 'none';
      elOpenSection.style.display = 'block';
      stopLightsAnimation();
    }

    // 4. User Vote Banner
    if (appState.userVote && appState.votingOpen) {
      const votedDriver = appState.drivers.find(d => d.id === appState.userVote);
      if (votedDriver) {
        elUserVoteBanner.classList.add('active');
        elVotedDriverName.textContent = `${votedDriver.name} (#${votedDriver.number} - ${votedDriver.team})`;
      } else {
        elUserVoteBanner.classList.remove('active');
      }
    } else {
      elUserVoteBanner.classList.remove('active');
    }

    // 5. Total Votes Count
    if (elTotalVotesDisplay) {
      elTotalVotesDisplay.textContent = appState.totalVotes;
    }

    // 6. Build Team Filter Buttons
    buildTeamFilters();

    // 7. Render Drivers Grid
    renderDriversGrid();

    // 8. Render Podium / Public Results
    renderPublicResults();
  }

  // --- Start Lights Sequential Animation (for Closed state) ---
  function startLightsAnimation() {
    if (lightsInterval) return;
    const bulbs = document.querySelectorAll('.f1-bulb');
    if (!bulbs.length) return;

    let step = 0;
    lightsInterval = setInterval(() => {
      if (step < 5) {
        // Allume les ampoules une par une
        bulbs[step].classList.add('active');
        if (window.f1Audio && step === 0) {
          // premier bip optionnel
        }
        step++;
      } else if (step === 5) {
        // Pause toutes allumées
        step++;
      } else {
        // Éteint tout (départ simulation)
        bulbs.forEach(b => b.classList.remove('active'));
        step = 0;
      }
    }, 900);
  }

  function stopLightsAnimation() {
    if (lightsInterval) {
      clearInterval(lightsInterval);
      lightsInterval = null;
    }
  }

  // --- Build Team Filter Chips ---
  function buildTeamFilters() {
    if (!elTeamFilterScroll) return;
    const teams = Array.from(new Set(appState.drivers.map(d => d.team))).filter(Boolean).sort();

    // Conserver scroll position
    let html = `
      <button class="team-filter-chip ${activeTeamFilter === 'ALL' ? 'active' : ''}" data-team="ALL">
        Toutes les écuries (${appState.drivers.length})
      </button>
    `;

    teams.forEach(team => {
      const count = appState.drivers.filter(d => d.team === team).length;
      html += `
        <button class="team-filter-chip ${activeTeamFilter === team ? 'active' : ''}" data-team="${team}">
          ${team} (${count})
        </button>
      `;
    });

    elTeamFilterScroll.innerHTML = html;

    // Listeners
    elTeamFilterScroll.querySelectorAll('.team-filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.f1Audio) window.f1Audio.playClick();
        activeTeamFilter = btn.dataset.team;
        render();
      });
    });
  }

  // --- Render Drivers Grid ---
  function renderDriversGrid() {
    if (!elDriversGrid) return;

    // Filtrer les pilotes
    const filtered = appState.drivers.filter(driver => {
      const matchTeam = activeTeamFilter === 'ALL' || driver.team === activeTeamFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        driver.name.toLowerCase().includes(q) ||
        driver.team.toLowerCase().includes(q) ||
        String(driver.number).includes(q) ||
        (driver.code && driver.code.toLowerCase().includes(q));

      return matchTeam && matchSearch;
    });

    if (filtered.length === 0) {
      elDriversGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <p style="font-size: 1.2rem; font-family: var(--font-racing);">Aucun pilote ne correspond à votre recherche.</p>
        </div>
      `;
      return;
    }

    elDriversGrid.innerHTML = filtered.map(driver => {
      const isUserVote = appState.userVote === driver.id;
      const teamColor = driver.color || '#E10600';
      const showStats = appState.showResultsPublicly && appState.totalVotes > 0;
      const percentage = driver.percentage !== undefined ? driver.percentage : 0;
      const votes = driver.votes || 0;

      return `
        <div class="driver-card ${isUserVote ? 'voted' : ''}" 
             style="--team-color: ${teamColor}; ${isUserVote ? 'border-color: var(--green-live); box-shadow: 0 0 20px rgba(0,230,118,0.2);' : ''}"
             data-id="${driver.id}">
          
          <div class="driver-card-header">
            <span class="driver-number">${driver.number}</span>
            <span class="driver-code-badge">${driver.code || driver.name.substring(0,3).toUpperCase()}</span>
          </div>

          <div class="driver-info">
            <h3 class="driver-name">${driver.name}</h3>
            <div class="driver-team-row">
              <span class="driver-team-dot"></span>
              <span class="driver-team-name">${driver.team}</span>
            </div>
          </div>

          <div class="driver-card-bottom">
            ${showStats ? `
              <div class="driver-live-stats active">
                <div class="stats-label-row">
                  <span class="stats-percentage">${percentage}%</span>
                  <span class="stats-votes-count">${votes} vote${votes > 1 ? 's' : ''}</span>
                </div>
                <div class="progress-track">
                  <div class="progress-bar-fill" style="width: ${percentage}%;"></div>
                </div>
              </div>
            ` : ''}

            <button class="btn-vote ${isUserVote ? 'has-voted' : ''}" data-driver-id="${driver.id}">
              ${isUserVote ? '✓ Votre Vote' : 'Voter'}
            </button>
          </div>

        </div>
      `;
    }).join('');

    // Attacher les clics sur les boutons de vote
    elDriversGrid.querySelectorAll('.btn-vote:not(.has-voted)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const driverId = btn.dataset.driverId;
        openVoteModal(driverId);
      });
    });

    // Clic sur la carte entière pour faciliter sur mobile
    elDriversGrid.querySelectorAll('.driver-card').forEach(card => {
      card.addEventListener('click', () => {
        const driverId = card.dataset.id;
        if (appState.userVote !== driverId) {
          openVoteModal(driverId);
        }
      });
    });
  }

  // --- Render Public Results (Podium) ---
  function renderPublicResults() {
    if (!elPublicResultsSection || !elPodiumContainer) return;

    if (!appState.showResultsPublicly || appState.totalVotes === 0 || !appState.ranking || appState.ranking.length === 0) {
      elPublicResultsSection.style.display = 'none';
      return;
    }

    elPublicResultsSection.style.display = 'block';

    const top3 = appState.ranking.slice(0, 3);
    const p1 = top3[0];
    const p2 = top3[1];
    const p3 = top3[2];

    elPodiumContainer.innerHTML = `
      <!-- P2 (Gauche) -->
      ${p2 ? `
        <div class="podium-step p2">
          <div class="podium-driver-card" style="border-top: 3px solid ${p2.color || '#E0E0E0'};">
            <span class="podium-rank-badge">2</span>
            <div style="font-family: var(--font-racing); font-weight: 800; font-size: 1.1rem; text-transform: uppercase;">${p2.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${p2.team}</div>
            <div style="font-family: var(--font-racing); font-weight: 900; font-size: 1.2rem; color: var(--silver); margin-top: 0.35rem;">
              ${p2.percentage}% <span style="font-size: 0.75rem; color: var(--text-dim);">(${p2.votes})</span>
            </div>
          </div>
          <div class="podium-block">P2</div>
        </div>
      ` : ''}

      <!-- P1 (Centre - Plus haut) -->
      ${p1 ? `
        <div class="podium-step p1">
          <div class="podium-driver-card" style="border-top: 3px solid ${p1.color || '#FFD700'};">
            <span class="podium-rank-badge">1</span>
            <div style="font-family: var(--font-racing); font-weight: 800; font-size: 1.25rem; text-transform: uppercase;">${p1.name}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">${p1.team}</div>
            <div style="font-family: var(--font-racing); font-weight: 900; font-size: 1.4rem; color: var(--gold); margin-top: 0.35rem;">
              ${p1.percentage}% <span style="font-size: 0.8rem; color: var(--text-dim);">(${p1.votes})</span>
            </div>
          </div>
          <div class="podium-block">P1</div>
        </div>
      ` : ''}

      <!-- P3 (Droite) -->
      ${p3 ? `
        <div class="podium-step p3">
          <div class="podium-driver-card" style="border-top: 3px solid ${p3.color || '#CD7F32'};">
            <span class="podium-rank-badge">3</span>
            <div style="font-family: var(--font-racing); font-weight: 800; font-size: 1.1rem; text-transform: uppercase;">${p3.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${p3.team}</div>
            <div style="font-family: var(--font-racing); font-weight: 900; font-size: 1.2rem; color: var(--bronze); margin-top: 0.35rem;">
              ${p3.percentage}% <span style="font-size: 0.75rem; color: var(--text-dim);">(${p3.votes})</span>
            </div>
          </div>
          <div class="podium-block">P3</div>
        </div>
      ` : ''}
    `;
  }

  // --- Vote Confirmation Modal ---
  function openVoteModal(driverId) {
    if (!appState.votingOpen) {
      showToast('Les votes de pilotes du jour ne sont pas encore ouverts', 'error');
      return;
    }

    const driver = appState.drivers.find(d => d.id === driverId);
    if (!driver) return;

    selectedDriverForModal = driver;
    if (window.f1Audio) window.f1Audio.playClick();

    elModalDriverPreview.innerHTML = `
      <div style="font-family: var(--font-racing); font-size: 2.5rem; font-weight: 900; font-style: italic; color: #fff;">
        #${driver.number}
      </div>
      <div>
        <div style="font-family: var(--font-racing); font-size: 1.3rem; font-weight: 800; text-transform: uppercase;">${driver.name}</div>
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${driver.color || '#E10600'};"></span>
          <span style="font-size: 0.85rem; color: var(--text-muted);">${driver.team}</span>
        </div>
      </div>
    `;

    elConfirmModal.classList.add('active');
  }

  function closeVoteModal() {
    elConfirmModal.classList.remove('active');
    selectedDriverForModal = null;
  }

  elBtnCancelVote.addEventListener('click', closeVoteModal);
  elModalCloseBtn.addEventListener('click', closeVoteModal);
  elConfirmModal.addEventListener('click', (e) => {
    if (e.target === elConfirmModal) closeVoteModal();
  });

  // --- Submit Vote ---
  async function submitVote() {
    if (!selectedDriverForModal) return;
    const driverId = selectedDriverForModal.id;
    const driverName = selectedDriverForModal.name;

    try {
      elBtnConfirmVote.disabled = true;
      elBtnConfirmVote.textContent = 'Enregistrement...';

      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driverId,
          voterToken: voterToken
        })
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        if (window.f1Audio) window.f1Audio.playVoteSuccess();
        appState.userVote = driverId;
        closeVoteModal();
        showToast(resData.message || `Vote enregistré pour ${driverName} !`, 'success');
        render();
      } else {
        closeVoteModal();
        showToast(resData.message || 'Erreur lors de l’enregistrement du vote', 'error');
      }
    } catch (err) {
      console.error('Erreur submitVote:', err);
      closeVoteModal();
      showToast('Erreur réseau. Veuillez réessayer.', 'error');
    } finally {
      elBtnConfirmVote.disabled = false;
      elBtnConfirmVote.textContent = 'Confirmer mon vote';
    }
  }

  elBtnConfirmVote.addEventListener('click', submitVote);

  // --- Search Input Listener ---
  if (elSearchInput) {
    elSearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderDriversGrid();
    });
  }

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

  // --- Init ---
  fetchInitialState();
  connectWebSocket();
});
