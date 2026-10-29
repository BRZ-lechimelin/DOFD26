# 🏎️ F1 26 - Élection du Pilote du Jour (Driver of the Day)

Site internet interactif pour l'élection en temps réel du **Pilote du Jour** lors d'une course sur le jeu **F1 26**, doté d'un **Panel Administrateur** complet pour gérer les pilotes et contrôler l'ouverture des votes.

---

## 🌟 Fonctionnalités

### 👥 Côté Public (Spectateurs & Votants)
- **État Fermé :** Si les votes ne sont pas ouverts, affichage fidèle du message :  
  > **« Les votes de pilotes du jour ne sont pas encore ouverts »**  
  Accompagné d'une animation séquentielle des 5 feux de départ F1 et d'un indicateur de session en attente.
- **État Ouvert :** Dès que l'administrateur lance les votes :
  - Mise à jour instantanée sans rechargement de page (technologie **WebSockets**).
  - Grille des 20 monoplaces F1 26 avec **Numéro de course**, **Nom**, **Écurie** et **Couleurs officielles**.
  - Moteur de recherche instantané et filtres rapides par écurie (Ferrari, McLaren, Red Bull, Mercedes, Audi, etc.).
  - Bouton de vote avec fenêtre de confirmation pour éviter les clics accidentels.
  - Système de vote unique par spectateur avec bannière de confirmation personnalisée.
  - **Podium et pourcentages en direct** (Top 3 P1, P2, P3) si l'option est activée par l'administrateur.
  - Bruitages de course immersifs F1 (synthétiseur Web Audio API intégré, sans fichiers externes, avec bouton mute).

---

### 🛠️ Côté Administrateur (`/admin`)
- **Accès sécurisé par mot de passe** (par défaut : `f126admin`).
- **Grand bouton poussoir Cockpit :**
  - 🟢 **OUVRIR LES VOTES** : lance immédiatement la session pour tous les spectateurs connectés.
  - 🛑 **FERMER LES VOTES** : verrouille la session et réaffiche le message d'attente.
- **Gestion complète des pilotes (CRUD) :**
  - Formulaire d'ajout : **Nom**, **Numéro**, **Écurie**, **Code 3 lettres**, et **Couleur d'écurie** (avec palette des écuries officielles 2026).
  - Bouton **« Charger Grille F1 2026 »** : pré-remplit instantanément les 20 pilotes officiels de la saison 2026 (Hamilton chez Ferrari, Hülkenberg chez Audi, Verstappen, Norris, etc.).
  - Modification et suppression de n'importe quel pilote à la volée.
- **Tableau de bord des statistiques en temps réel :**
  - Classement dynamique avec barres de progression aux couleurs des écuries.
  - Nombre exact de suffrages et pourcentage de part pour chaque pilote.
  - Métriques clés : Total des votes, Pilote en tête, Pilotes sur la grille.
- **Outils pour les streamers et organisateurs :**
  - **Annoncer le Pilote du Jour :** Génère un visuel graphique "Podium & Vainqueur" avec le pilote gagnant, son pourcentage et ses votes, parfait pour capture d'écran ou diffusion en stream.
  - **QR Code & Partage :** Génère un QR Code direct que les spectateurs ou amis peuvent flasher depuis leur smartphone pour voter instantanément.
  - **Renommer le Grand Prix** (ex: *Grand Prix de Monaco - Ligue F1 26*).
  - **Remise à zéro des votes** en un clic pour la course suivante.

---

## 🚀 Démarrage Rapide

### 1. Installation des dépendances (déjà fait)
```bash
npm install
```

### 2. Lancement du serveur
```bash
npm start
```

### 3. Accès aux pages :
- **Page de vote (Public) :** `http://localhost:3000` (ou l'adresse IP réseau locale affichée dans la console pour voter depuis un téléphone en Wi-Fi)
- **Panel Admin :** `http://localhost:3000/admin`
  - Mot de passe : `f126admin`

---

## 📁 Structure du Projet

```
DOFD26/
├── package.json          # Dépendances et scripts de lancement
├── server.js             # Serveur Node.js (Express + WebSockets + API REST)
├── test-endpoints.js     # Script de tests automatisés
├── data/
│   └── database.json     # Persistance des votes et de la liste des pilotes
└── public/
    ├── index.html        # Page de vote publique (avec gestion états Fermé/Ouvert)
    ├── admin.html        # Panel cockpit administrateur
    ├── css/
    │   ├── style.css     # Design system racing F1 (thème sombre, animations, podium)
    │   └── admin.css     # Styles responsive du cockpit admin
    └── js/
        ├── app.js        # Logique client, WebSocket public, vote, filtres
        ├── admin.js      # Logique admin, gestion des pilotes, stats en direct
        ├── audio.js      # Effets sonores procéduraux F1 (Web Audio API)
        └── qrcode.js     # Générateur de QR Code pour partage mobile/stream
```
