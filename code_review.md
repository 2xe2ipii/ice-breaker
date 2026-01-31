# Code Review: Real or AI Game

## 🔴 Critical Issues

### 1. **Socket Memory Leak in useGameSocket.js**
**Location:** `useGameSocket.js` - cleanup function
```javascript
return () => {
    socket.off();
};
```
**Problem:** Calling `socket.off()` without arguments removes ALL listeners, including those from other components. This will break the application if multiple components use the socket.

**Fix:** Remove specific listeners only:
```javascript
return () => {
    socket.off('connect', onConnect);
    socket.off('disconnect', onDisconnect);
    socket.off('state_update');
    socket.off('host_state_update');
    // ... etc for all listeners
};
```

---

### 2. **Race Condition: Player Disconnect Handling**
**Location:** `index.js` - No disconnect handler
**Problem:** When a player disconnects, their `socketId` remains in `playersPersistence`, but the socket no longer exists. The server tries to emit to dead sockets.

**Issue in code:**
```javascript
const playerSocket = io.sockets.sockets.get(player.socketId);
```
This can return `undefined` for disconnected players, but the code doesn't handle reconnection cleanup.

**Fix:** Add disconnect handler:
```javascript
socket.on('disconnect', () => {
    // Find player by socketId and mark as disconnected
    Object.values(playersPersistence).forEach(p => {
        if (p.socketId === socket.id) {
            p.socketId = null;
        }
    });
});
```

---

### 3. **No Authentication on Admin Actions**
**Location:** `index.js` - All admin events
```javascript
socket.on('admin_start_round', () => { ... });
socket.on('admin_show_leaderboard', () => { ... });
socket.on('admin_next_round', () => { ... });
socket.on('admin_hard_reset', () => { ... });
```
**Problem:** ANY connected client can call these admin functions by simply emitting the events. A player could inspect the code and trigger game resets or skip rounds.

**Security Risk:** HIGH - Game can be griefed by any player

**Fix:** Implement host authentication:
```javascript
const hostSessions = new Set();

socket.on('host_login', (password) => {
    if (password === process.env.HOST_PASSWORD) {
        hostSessions.add(socket.id);
        socket.join('host_room');
    }
});

socket.on('admin_start_round', () => {
    if (!hostSessions.has(socket.id)) return; // Verify host
    // ... rest of code
});
```

---

## 🟠 Major Issues

### 4. **Timer Desync on Reconnection**
**Location:** `index.js` - `request_state` handler
**Problem:** When a player reconnects mid-round, they receive `timeLeft` but the timer interval is only running on the server. The client has no way to keep the timer in sync.

**Impact:** Players see frozen or incorrect timers after reconnecting.

**Fix:** Send periodic timer updates or calculate time client-side based on round start timestamp.

---

### 5. **Multiple Votes Possible via Race Condition**
**Location:** `index.js` - `submit_vote` handler
```javascript
if (gameState.status === 'QUESTION' && player && !player.lastVote) {
    player.lastVote = vote;
    gameState.roundVotes[vote]++;
}
```
**Problem:** If a player rapidly clicks both buttons (or uses multiple devices with same sessionId), both votes could be processed before `lastVote` is set, as Socket.IO handles events asynchronously.

**Fix:** Use atomic operations or add vote timestamp validation.

---

### 6. **Unsafe Image Path Handling**
**Location:** `HostView.jsx` and `PlayerView.jsx`
```javascript
const currentImageSrc = gameState.currentImage || `/assets/q${gameState.currentRoundIndex + 1}.webp`;
```
**Problem:** If `gameState.currentImage` contains a malicious URL (XSS vector) or the index is manipulated, this could load unintended content.

**Fix:** Validate image paths server-side and use allowlist of valid image sources.

---

### 7. **Player Name Not Sanitized**
**Location:** `index.js` - `join_game` handler
```javascript
playersPersistence[sessionId].name = name || 'Player';
```
**Problem:** Player names are not validated or sanitized. A player could inject HTML/scripts or use extremely long names.

**Fix:**
```javascript
const sanitizedName = (name || 'Player')
    .trim()
    .slice(0, 20) // Max length
    .replace(/[<>]/g, ''); // Basic XSS prevention
```

---

### 8. **State Reset Clears Connected Players**
**Location:** `index.js` - `admin_hard_reset`
```javascript
playersPersistence = {};
```
**Problem:** This kicks all players out, requiring them to rejoin. The client code tries to auto-reconnect but their session data is deleted.

**Better approach:** Reset scores but keep player persistence for reconnection.

---

## 🟡 Medium Issues

### 9. **No Input Validation on Vote Value**
**Location:** `index.js` - `submit_vote`
```javascript
if (gameState.roundVotes[vote] !== undefined) {
    gameState.roundVotes[vote]++;
}
```
**Problem:** While there's a safety check, votes should be validated to only accept 'AI' or 'REAL'.

**Fix:**
```javascript
const validVotes = ['AI', 'REAL'];
if (!validVotes.includes(vote)) return;
```

---

### 10. **Memory Leak: Timer Not Cleared on Error**
**Location:** `index.js` - Multiple places
**Problem:** If `revealAnswer()` throws an error, the timer interval continues running forever.

**Fix:** Wrap in try-catch and always clear interval:
```javascript
try {
    revealAnswer();
} catch (err) {
    console.error('Error revealing answer:', err);
} finally {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}
```

---

### 11. **localStorage Used Without Error Handling**
**Location:** `PlayerView.jsx` - Multiple locations
```javascript
localStorage.setItem('player_name', name);
```
**Problem:** In private browsing mode or with storage disabled, this will throw exceptions.

**Fix:**
```javascript
try {
    localStorage.setItem('player_name', name);
} catch (err) {
    console.warn('localStorage not available:', err);
}
```

---

### 12. **No Rate Limiting on Vote Submissions**
**Location:** `index.js` - `submit_vote`
**Problem:** A malicious player could spam vote requests, potentially causing server load or vote count manipulation before the duplicate check kicks in.

**Fix:** Implement rate limiting per sessionId.

---

### 13. **Question Array Out of Bounds**
**Location:** `index.js` - `admin_start_round`
```javascript
const roundData = questions[gameState.currentRoundIndex];
if (!roundData) return;
```
**Problem:** Silent failure if questions array is empty or index is invalid. Game appears frozen.

**Fix:** Send error to host or reset to lobby with error message.

---

### 14. **useEffect Infinite Loop Risk**
**Location:** `useGameSocket.js`
```javascript
useEffect(() => {
    // ... setup
    if (socket.connected) onConnect();
    else socket.connect();
}, [isHost]);
```
**Problem:** If `isHost` changes (unlikely but possible), this will disconnect and reconnect the socket, potentially losing state.

**Better approach:** Use separate useEffect for connection and isHost handling.

---

## 🟢 Minor Issues / Improvements

### 15. **Mixed Answer Format Compatibility**
**Location:** `index.js` - `revealAnswer()`
```javascript
let dbAnswer = String(currentQ.answer || '').toUpperCase();
if (dbAnswer === 'HUMAN') dbAnswer = 'REAL';
```
**Problem:** This is a bandaid fix suggesting inconsistent data. The questions data should be normalized on load.

---

### 16. **Hardcoded Port Number**
**Location:** `index.js`
```javascript
server.listen(3001, () => console.log('SERVER RUNNING ON 3001'));
```
**Problem:** Should use environment variable for deployment flexibility.

**Fix:**
```javascript
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`SERVER RUNNING ON ${PORT}`));
```

---

### 17. **No Error Boundaries in React Components**
**Location:** All React components
**Problem:** If any component crashes, the entire app breaks with white screen.

**Fix:** Wrap main components in Error Boundaries.

---

### 18. **Emoji Encoding Issue**
**Location:** `PlayerView.jsx`
```javascript
<div className="text-6xl mb-4">ðŸ'€</div>
```
**Problem:** Emoji appears corrupted (should be 👀). This is a character encoding issue in the file.

**Fix:** Ensure file is saved as UTF-8.

---

### 19. **Potential Division by Zero**
**Location:** `HostView.jsx`
```javascript
const realPercent = totalVotes === 0 ? 50 : ((gameState.roundVotes?.REAL || 0) / totalVotes) * 100;
```
**Good:** This is actually handled correctly! Just noting for completeness.

---

### 20. **No Timeout for Round Start**
**Location:** `index.js`
**Problem:** If host never clicks "Start Round", players wait indefinitely in lobby.

**Improvement:** Add auto-start timer or timeout to return to lobby.

---

### 21. **Inconsistent State Checks**
**Location:** `useGameSocket.js`
```javascript
socket.on('stats_update', (roundVotes) => {
    setGameState(prev => {
        if (!prev) return prev; // Good null check
        return { ...prev, roundVotes };
    });
});
```
**Problem:** Other socket handlers don't have null checks. Should be consistent.

---

### 22. **Missing Loading States**
**Location:** `HostView.jsx` and `PlayerView.jsx`
**Problem:** Image loading isn't tracked. Large images may not be loaded when round starts.

**Improvement:** Use image `onLoad` handlers to show loading indicators.

---

### 23. **Browser Back Button Breaks Flow**
**Location:** `PlayerView.jsx`
**Problem:** If user uses browser back button, localStorage data persists but game state is lost.

**Improvement:** Use `beforeunload` handler or disable back button navigation.

---

### 24. **No Connection Status Indicator**
**Location:** Both view components
**Problem:** Players/host don't know if they're disconnected until they try to interact.

**Fix:** Display connection status using the `isConnected` state that's already available.

---

### 25. **Hard-Coded Styling Values**
**Location:** All components
**Problem:** Colors like `#00fffd`, `#fd00ff`, `#fffd00` are repeated throughout. Should be in a theme/constants file.

---

## 📊 Summary

| Severity | Count | Examples |
|----------|-------|----------|
| Critical | 3 | Socket memory leak, No auth on admin actions, Player disconnect handling |
| Major | 5 | Timer desync, Race conditions, Unsafe image paths, Unsanitized names |
| Medium | 6 | Input validation, Memory leaks, localStorage errors |
| Minor | 11 | Code quality, UX improvements, best practices |

## 🎯 Recommended Priority Fixes

1. **Implement admin authentication** (Security)
2. **Fix socket cleanup** (Memory leak)
3. **Add disconnect handler** (Connection stability)
4. **Sanitize player inputs** (XSS prevention)
5. **Add proper error handling** (Robustness)