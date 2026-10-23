/*
 * Play tab: Wordle Duel (against a friend from your servers) and
 * Tile Drop (arcade, with leaderboards).
 *
 * Duels live in the database, which also checks every guess, so the
 * answer never reaches either phone. While a duel is open the app
 * checks for the other player's moves every couple of seconds.
 */
const ONLINE_WINDOW_MS =
  2 * 60 * 1000;

const DUEL_POLL_MS =
  2000;

const PLAY_POLL_MS =
  15000;

let playFriends =
  [];

let playDuels =
  [];

let playPollTimer =
  null;

let openDuel =
  null;

let duelPollTimer =
  null;

let duelTyping =
  "";

let duelBusy =
  false;

let wordleWords =
  null;

let tileGame =
  null;

const leaderboardView =
  { period: "today", server: null };


function playRpc(name, body) {
  return request(
    "/rest/v1/rpc/" + name,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body || {})
    }
  );
}


function isOnline(friend) {
  return Boolean(
    friend?.last_seen &&
    Date.now() - new Date(friend.last_seen).getTime() < ONLINE_WINDOW_MS
  );
}


function lastSeenText(friend) {
  if (!friend?.last_seen) {
    return "Not on yet";
  }

  if (isOnline(friend)) {
    return "Online now";
  }

  const minutes =
    Math.round((Date.now() - new Date(friend.last_seen).getTime()) / 60000);

  if (minutes < 60) {
    return "Seen " + minutes + " min ago";
  }

  const hours =
    Math.round(minutes / 60);

  return hours < 24
    ? "Seen " + hours + " h ago"
    : "Seen " + Math.round(hours / 24) + " d ago";
}


function friendName(userId) {
  const friend =
    playFriends.find(entry => entry.user_id === userId);

  return friend
    ? "@" + friend.username
    : playerDisplayName(userId);
}


async function sendHeartbeat() {
  if (!session || document.visibilityState !== "visible") {
    return;
  }

  try {
    await playRpc("heartbeat");
  } catch (error) {
    // Not set up yet, or offline: nothing to do.
  }
}

setInterval(sendHeartbeat, 45000);

document.addEventListener("visibilitychange", sendHeartbeat);


/* ---------- Play tab ---------- */

async function loadPlayTab() {
  const signedIn =
    Boolean(session);

  document.getElementById("playSignedOut").classList.toggle("hidden", signedIn);
  document.getElementById("playSignedIn").classList.toggle("hidden", !signedIn);

  clearTimeout(playPollTimer);

  if (!signedIn) {
    return;
  }

  const status =
    document.getElementById("playStatus");

  sendHeartbeat();

  try {
    const [friends, duels] =
      await Promise.all([
        playRpc("server_friends"),
        playRpc("my_duels")
      ]);

    playFriends =
      Array.isArray(friends) ? friends : [];

    playDuels =
      Array.isArray(duels) ? duels : [];

    for (const friend of playFriends) {
      knownProfiles.set(friend.user_id, { user_id: friend.user_id, username: friend.username });
    }

    await loadPlayerCards(playFriends.map(friend => friend.user_id));

    setStatus(status, "");
  } catch (error) {
    console.warn("Play tab failed to load:", error);

    setStatus(
      status,
      "The Play tab isn't set up yet. Run the files in supabase/play first.",
      "error"
    );
  }

  renderPlayOnline();
  renderFriendStrip();
  renderDuelList();
  loadTileDropBest();

  clearTimeout(playPollTimer);

  if (currentTab === "play") {
    playPollTimer = setTimeout(loadPlayTab, PLAY_POLL_MS);
  }
}


function renderPlayOnline() {
  const pill =
    document.getElementById("playOnline");

  const online =
    playFriends.filter(isOnline).length;

  pill.querySelector("span").textContent =
    online + " online";

  pill.classList.toggle("hidden", online === 0);
}


function friendAvatar(userId, online) {
  const avatar =
    playerAvatar(userId);

  avatar.classList.add("avatar-friend");

  if (online !== undefined) {
    const dot =
      document.createElement("i");

    dot.className =
      "online-dot" + (online ? " on" : "");

    avatar.appendChild(dot);
  }

  return avatar;
}


function renderFriendStrip() {
  const strip =
    document.getElementById("friendStrip");

  strip.innerHTML = "";

  const friends =
    [...playFriends].sort((a, b) => isOnline(b) - isOnline(a));

  if (!friends.length) {
    strip.innerHTML =
      '<p class="status">Join or create a server to play with friends.</p>';
    return;
  }

  for (const friend of friends) {
    const button =
      document.createElement("button");

    button.type =
      "button";

    button.className =
      "friend-chip";

    button.dataset.friend =
      friend.user_id;

    const name =
      document.createElement("span");

    name.textContent =
      friend.username;

    button.append(friendAvatar(friend.user_id, isOnline(friend)), name);

    button.addEventListener("click", () => challengeFriend(friend.user_id));
    strip.appendChild(button);
  }
}


function myDuelProgress(duel) {
  const guesses =
    duel.my_guesses || [];

  const solved =
    guesses.some(entry => entry.pattern === "GGGGG");

  return {
    count: guesses.length,
    solved,
    done: solved || guesses.length >= 6
  };
}


function theirDuelProgress(duel) {
  const patterns =
    duel.their_patterns || [];

  const solved =
    patterns.includes("GGGGG");

  return {
    count: patterns.length,
    solved,
    done: solved || patterns.length >= 6
  };
}


function duelOutcomeText(duel) {
  if (duel.status === "declined") {
    return friendName(duel.opponent) + " declined";
  }

  if (duel.status === "cancelled") {
    return "Challenge called off";
  }

  if (!duel.winner) {
    return "🤝 Draw with " + friendName(duel.opponent);
  }

  return duel.winner === session?.user.id
    ? "🏆 You beat " + friendName(duel.opponent)
    : "👑 " + friendName(duel.opponent) + " won";
}


function renderDuelList() {
  const list =
    document.getElementById("duelList");

  list.innerHTML = "";

  const open =
    playDuels.filter(duel => duel.status === "pending" || duel.status === "active");

  const finished =
    playDuels
      .filter(duel => !open.includes(duel))
      .slice(0, 3);

  for (const duel of [...open, ...finished]) {
    const row =
      document.createElement("div");

    row.className =
      "duel-row" + (open.includes(duel) ? " open" : "");

    row.dataset.duel =
      duel.id;

    const text =
      document.createElement("div");

    text.className =
      "duel-row-text";

    const title =
      document.createElement("b");

    const sub =
      document.createElement("span");

    const mine =
      myDuelProgress(duel);

    const theirs =
      theirDuelProgress(duel);

    const actions =
      document.createElement("div");

    actions.className =
      "duel-row-actions";

    const addButton = (label, action, secondary) => {
      const button =
        document.createElement("button");

      button.type =
        "button";

      button.className =
        "play-go" + (secondary ? " secondary" : "");

      button.dataset.action =
        action;

      button.textContent =
        label;

      actions.appendChild(button);
    };

    if (duel.status === "pending" && !duel.is_challenger) {
      title.textContent = friendName(duel.opponent) + " challenged you";
      sub.textContent = "Wordle Duel";
      addButton("Decline", "decline", true);
      addButton("Accept", "accept");
    } else if (duel.status === "pending") {
      title.textContent = "Waiting for " + friendName(duel.opponent);
      sub.textContent = mine.done ? "You're done. They haven't accepted yet." : "You can start now · " + mine.count + "/6";
      addButton(mine.done ? "See" : "Play", "open");
    } else if (duel.status === "active") {
      title.textContent = mine.done ? "Waiting for " + friendName(duel.opponent) : "Your turn vs " + friendName(duel.opponent);
      sub.textContent = "Wordle Duel · you " + mine.count + "/6 · them " + theirs.count + "/6";
      addButton(mine.done ? "See" : "Play", "open");
    } else {
      title.textContent = duelOutcomeText(duel);
      sub.textContent = duel.answer ? "The word was " + duel.answer.toUpperCase() : "Wordle Duel";
      addButton("See", "open", true);
    }

    text.append(title, sub);
    row.append(friendAvatar(duel.opponent), text, actions);
    list.appendChild(row);
  }
}


document
  .getElementById("duelList")
  .addEventListener(
    "click",
    async event => {
      const button =
        event.target.closest("[data-action]");

      if (!button) {
        return;
      }

      const id =
        button.closest("[data-duel]").dataset.duel;

      const status =
        document.getElementById("playStatus");

      try {
        if (button.dataset.action === "accept") {
          await playRpc("respond_duel", { p_duel: id, p_accept: true });
          await openDuelScreen(id);
        } else if (button.dataset.action === "decline") {
          await playRpc("respond_duel", { p_duel: id, p_accept: false });
        } else {
          await openDuelScreen(id);
        }
      } catch (error) {
        setStatus(status, error.message || "That didn't work. Try again.", "error");
      }

      loadPlayTab();
    }
  );


/* ---------- Challenging someone ---------- */

function openChallengePicker() {
  const list =
    document.getElementById("challengeList");

  list.innerHTML = "";
  setStatus(document.getElementById("challengeStatus"), "");

  const friends =
    [...playFriends].sort((a, b) => isOnline(b) - isOnline(a));

  if (!friends.length) {
    list.innerHTML =
      '<p class="status">Join or create a server first. You can challenge anyone in your servers.</p>';
  }

  for (const friend of friends) {
    const row =
      document.createElement("button");

    row.type =
      "button";

    row.className =
      "challenge-row";

    row.dataset.friend =
      friend.user_id;

    const text =
      document.createElement("div");

    const name =
      document.createElement("b");

    name.textContent =
      "@" + friend.username;

    const seen =
      document.createElement("span");

    seen.textContent =
      lastSeenText(friend);

    seen.classList.toggle("online", isOnline(friend));

    text.append(name, seen);

    const go =
      document.createElement("span");

    go.className =
      "play-go";

    go.textContent =
      "Challenge";

    row.append(friendAvatar(friend.user_id, isOnline(friend)), text, go);
    row.addEventListener("click", () => challengeFriend(friend.user_id));
    list.appendChild(row);
  }

  document.getElementById("challengeModal").classList.add("open");
}


async function challengeFriend(userId) {
  const status =
    document.getElementById("challengeStatus");

  try {
    const id =
      await playRpc("create_duel", { p_opponent: userId });

    document.getElementById("challengeModal").classList.remove("open");
    await openDuelScreen(id);
    loadPlayTab();
  } catch (error) {
    const message =
      error.message || "The challenge could not be sent.";

    if (document.getElementById("challengeModal").classList.contains("open")) {
      setStatus(status, message, "error");
    } else {
      setStatus(document.getElementById("playStatus"), message, "error");
    }
  }
}


/* ---------- Wordle Duel screen ---------- */

async function loadWordleWords() {
  if (wordleWords) {
    return wordleWords;
  }

  try {
    const response =
      await fetch("data/wordle-words.txt");

    wordleWords =
      new Set((await response.text()).split(/\s+/).filter(Boolean));
  } catch (error) {
    // Without the list, the database still checks the format.
    wordleWords = null;
  }

  return wordleWords;
}


async function openDuelScreen(id) {
  const state =
    await playRpc("duel_state", { p_duel: id });

  openDuel =
    state;

  duelTyping = "";

  document.getElementById("duelScreen").classList.remove("hidden");
  document.body.classList.add("play-screen-open");

  renderDuel();
  loadWordleWords();

  clearInterval(duelPollTimer);
  duelPollTimer = setInterval(pollDuel, DUEL_POLL_MS);
}


function closeDuelScreen() {
  clearInterval(duelPollTimer);
  duelPollTimer = null;
  openDuel = null;

  document.getElementById("duelScreen").classList.add("hidden");
  document.body.classList.remove("play-screen-open");

  loadPlayTab();
}


async function pollDuel() {
  if (!openDuel || duelBusy) {
    return;
  }

  try {
    const state =
      await playRpc("duel_state", { p_duel: openDuel.id });

    if (openDuel && state.id === openDuel.id) {
      openDuel = state;
      renderDuel();
    }
  } catch (error) {
    // Try again next time.
  }

  if (openDuel && openDuel.status === "finished") {
    clearInterval(duelPollTimer);
  }
}


function duelSquare(letter, pattern, small) {
  const square =
    document.createElement("span");

  square.className =
    "duel-square" + (small ? " small" : "");

  if (pattern) {
    square.dataset.mark = pattern;
  }

  square.textContent =
    small ? "" : (letter || "").toUpperCase();

  return square;
}


function keyMarks(guesses) {
  const marks =
    {};

  const rank =
    { B: 1, Y: 2, G: 3 };

  for (const { guess, pattern } of guesses) {
    [...guess].forEach((letter, i) => {
      const mark =
        pattern[i];

      if (!marks[letter] || rank[mark] > rank[marks[letter]]) {
        marks[letter] = mark;
      }
    });
  }

  return marks;
}


function renderDuel() {
  const duel =
    openDuel;

  if (!duel) {
    return;
  }

  const mine =
    myDuelProgress(duel);

  const theirs =
    theirDuelProgress(duel);

  const opponentFriend =
    playFriends.find(entry => entry.user_id === duel.opponent);

  document.getElementById("duelTitle").textContent =
    "Wordle Duel vs " + friendName(duel.opponent);

  const avatarSpot =
    document.getElementById("duelOpponentAvatar");

  avatarSpot.replaceChildren(friendAvatar(duel.opponent, isOnline(opponentFriend)));

  document.getElementById("duelOpponentName").textContent =
    friendName(duel.opponent);

  let theirStatus;

  if (duel.status === "pending") {
    theirStatus = duel.is_challenger ? "Hasn't accepted yet" : "Waiting for you to accept";
  } else if (theirs.solved) {
    theirStatus = "Solved in " + theirs.count + "!";
  } else if (theirs.done) {
    theirStatus = "Out of guesses";
  } else if (theirs.count) {
    theirStatus = "Guess " + theirs.count + " of 6";
  } else {
    theirStatus = isOnline(opponentFriend) ? "Online, hasn't guessed yet" : "Hasn't guessed yet";
  }

  document.getElementById("duelOpponentStatus").textContent =
    theirStatus;

  const mini =
    document.getElementById("duelTheirBoard");

  mini.innerHTML = "";

  for (let row = 0; row < 6; row += 1) {
    const line =
      document.createElement("div");

    line.className =
      "duel-row-squares";

    const pattern =
      duel.their_patterns[row] || "";

    for (let i = 0; i < 5; i += 1) {
      line.appendChild(duelSquare("", pattern[i], true));
    }

    mini.appendChild(line);
  }

  const board =
    document.getElementById("duelMyBoard");

  board.innerHTML = "";

  for (let row = 0; row < 6; row += 1) {
    const line =
      document.createElement("div");

    line.className =
      "duel-row-squares";

    const entry =
      duel.my_guesses[row];

    const typing =
      !entry && row === duel.my_guesses.length && !mine.done;

    for (let i = 0; i < 5; i += 1) {
      const square =
        entry
          ? duelSquare(entry.guess[i], entry.pattern[i])
          : duelSquare(typing ? duelTyping[i] : "");

      if (typing && duelTyping[i]) {
        square.classList.add("typed");
      }

      line.appendChild(square);
    }

    board.appendChild(line);
  }

  const finished =
    duel.status === "finished" || duel.status === "declined" || duel.status === "cancelled";

  const message =
    document.getElementById("duelMessage");

  if (!finished) {
    if (mine.solved) {
      message.textContent = "Solved in " + mine.count + "! Waiting for " + friendName(duel.opponent) + ".";
    } else if (mine.done) {
      message.textContent = "Out of guesses. Waiting for " + friendName(duel.opponent) + ".";
    } else if (!message.dataset.sticky) {
      message.textContent = "Guess the word. Fewest guesses wins.";
    }
  } else {
    message.textContent = "";
  }

  const result =
    document.getElementById("duelResult");

  result.classList.toggle("hidden", !finished);

  if (finished) {
    result.innerHTML = "";

    const headline =
      document.createElement("b");

    headline.textContent =
      duel.status === "finished"
        ? (!duel.winner ? "🤝 It's a draw" : duel.winner === session?.user.id ? "🏆 You win!" : "👑 " + friendName(duel.opponent) + " wins")
        : duelOutcomeText(duel);

    const word =
      document.createElement("span");

    word.textContent =
      duel.answer ? "The word was " + duel.answer.toUpperCase() : "";

    const again =
      document.createElement("button");

    again.type =
      "button";

    again.className =
      "play-go";

    again.id =
      "duelRematchButton";

    again.textContent =
      "Rematch";

    again.addEventListener("click", () => {
      closeDuelScreen();
      challengeFriend(duel.opponent);
    });

    result.append(headline, word, again);
  }

  const giveUp =
    document.getElementById("duelGiveUpButton");

  giveUp.classList.toggle("hidden", finished || (duel.status === "pending" && !duel.is_challenger));

  giveUp.textContent =
    duel.status === "pending" ? "Call off" : "Give up";

  renderDuelKeyboard(!finished && !mine.done && (duel.status === "active" || duel.is_challenger));
}


function renderDuelKeyboard(enabled) {
  const keyboard =
    document.getElementById("duelKeyboard");

  keyboard.innerHTML = "";
  keyboard.classList.toggle("hidden", !enabled);

  if (!enabled) {
    return;
  }

  const marks =
    keyMarks(openDuel.my_guesses);

  for (const row of ["qwertyuiop", "asdfghjkl", "+zxcvbnm-"]) {
    const line =
      document.createElement("div");

    line.className =
      "duel-key-row";

    for (const key of row) {
      const button =
        document.createElement("button");

      button.type =
        "button";

      button.className =
        "duel-key" + (key === "+" || key === "-" ? " wide" : "");

      button.dataset.key =
        key === "+" ? "enter" : key === "-" ? "back" : key;

      button.textContent =
        key === "+" ? "Enter" : key === "-" ? "⌫" : key.toUpperCase();

      if (marks[key]) {
        button.dataset.mark = marks[key];
      }

      line.appendChild(button);
    }

    keyboard.appendChild(line);
  }
}


function duelMessage(text) {
  const message =
    document.getElementById("duelMessage");

  message.textContent = text;
  message.dataset.sticky = "1";

  clearTimeout(duelMessage.timer);

  duelMessage.timer = setTimeout(() => {
    delete message.dataset.sticky;
    renderDuel();
  }, 1800);
}


async function duelKey(key) {
  if (!openDuel || duelBusy) {
    return;
  }

  if (key === "back") {
    duelTyping = duelTyping.slice(0, -1);
    renderDuel();
    return;
  }

  if (key !== "enter") {
    if (/^[a-z]$/.test(key) && duelTyping.length < 5) {
      duelTyping += key;
      renderDuel();
    }

    return;
  }

  if (duelTyping.length < 5) {
    duelMessage("Not enough letters");
    return;
  }

  const words =
    await loadWordleWords();

  if (words && !words.has(duelTyping)) {
    duelMessage("Not in word list");
    return;
  }

  duelBusy = true;

  try {
    openDuel =
      await playRpc("duel_guess", { p_duel: openDuel.id, p_guess: duelTyping });

    duelTyping = "";

    clearTimeout(duelMessage.timer);
    delete document.getElementById("duelMessage").dataset.sticky;
  } catch (error) {
    duelMessage(error.message || "That guess didn't go through. Try again.");
  } finally {
    duelBusy = false;
  }

  renderDuel();
}


document
  .getElementById("duelKeyboard")
  .addEventListener("click", event => {
    const key =
      event.target.closest("[data-key]");

    if (key) {
      duelKey(key.dataset.key);
    }
  });

document.addEventListener("keydown", event => {
  if (!openDuel || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (event.key === "Enter") {
    duelKey("enter");
  } else if (event.key === "Backspace") {
    duelKey("back");
  } else if (/^[a-zA-Z]$/.test(event.key)) {
    duelKey(event.key.toLowerCase());
  } else if (event.key === "Escape") {
    closeDuelScreen();
  }
});

document
  .getElementById("duelCloseButton")
  .addEventListener("click", closeDuelScreen);

document
  .getElementById("duelGiveUpButton")
  .addEventListener("click", async () => {
    if (!openDuel) {
      return;
    }

    const question =
      openDuel.status === "pending"
        ? "Call off this challenge?"
        : "Give up? " + friendName(openDuel.opponent) + " will win.";

    if (!confirm(question)) {
      return;
    }

    try {
      await playRpc("cancel_duel", { p_duel: openDuel.id });
      openDuel = await playRpc("duel_state", { p_duel: openDuel.id });
      renderDuel();
    } catch (error) {
      duelMessage(error.message || "That didn't work. Try again.");
    }
  });

document
  .getElementById("wordleDuelButton")
  .addEventListener("click", openChallengePicker);


/* ---------- Tile Drop ---------- */

function tileSeed() {
  return TODAY + ":tile_drop";
}


function openTileDrop() {
  const screen =
    document.getElementById("tileDropScreen");

  screen.classList.remove("hidden");
  document.body.classList.add("play-screen-open");
  document.getElementById("tileOver").classList.add("hidden");

  tileGame?.stop();

  tileGame = TileDrop.createGame({
    seed: tileSeed(),
    canvas: document.getElementById("tileCanvas"),
    nextCanvas: document.getElementById("tileNext"),
    onChange: ({ score, lines, level }) => {
      document.getElementById("tileScore").textContent = score.toLocaleString("en-US");
      document.getElementById("tileLines").textContent = lines;
      document.getElementById("tileLevel").textContent = level;
    },
    onGameOver: finishTileDrop
  });
}


function closeTileDrop() {
  tileGame?.stop();
  tileGame = null;

  document.getElementById("tileDropScreen").classList.add("hidden");
  document.body.classList.remove("play-screen-open");

  loadTileDropBest();
}


async function finishTileDrop({ score, lines }) {
  const over =
    document.getElementById("tileOver");

  over.innerHTML = "";
  over.classList.remove("hidden");

  const title =
    document.createElement("b");

  title.textContent =
    "Game over";

  const points =
    document.createElement("span");

  points.className =
    "tile-over-score";

  points.textContent =
    score.toLocaleString("en-US");

  const detail =
    document.createElement("span");

  detail.textContent =
    lines + (lines === 1 ? " line" : " lines") + " · saving…";

  const again =
    document.createElement("button");

  again.type =
    "button";

  again.className =
    "play-go";

  again.id =
    "tilePlayAgain";

  again.textContent =
    "Play again";

  again.addEventListener("click", openTileDrop);

  const board =
    document.createElement("button");

  board.type =
    "button";

  board.className =
    "play-go secondary";

  board.textContent =
    "🏆 Leaderboard";

  board.addEventListener("click", () => openLeaderboard());

  over.append(title, points, detail, again, board);

  try {
    const saved =
      await playRpc("submit_arcade_score", {
        p_game: "tile_drop",
        p_play_date: TODAY,
        p_score: score,
        p_lines: lines
      });

    const board =
      await playRpc("arcade_leaderboard", {
        p_game: "tile_drop",
        p_period: "today",
        p_server: null,
        p_today: TODAY
      });

    detail.textContent =
      lines + (lines === 1 ? " line" : " lines") +
      " · best today " + Number(saved?.best_today || score).toLocaleString("en-US") +
      (board?.me ? " · #" + board.me.rank + " today" : "");
  } catch (error) {
    detail.textContent =
      lines + (lines === 1 ? " line" : " lines") + " · score not saved";
  }
}


async function loadTileDropBest() {
  if (!session) {
    return;
  }

  const line =
    document.getElementById("tileDropBest");

  try {
    const board =
      await playRpc("arcade_leaderboard", {
        p_game: "tile_drop",
        p_period: "today",
        p_server: null,
        p_today: TODAY
      });

    line.textContent =
      board?.me
        ? "Best today " + Number(board.me.score).toLocaleString("en-US") + " · #" + board.me.rank + " of " + board.rows.length
        : "Clear lines, beat the leaderboard.";
  } catch (error) {
    line.textContent = "Clear lines, beat the leaderboard.";
  }
}


// Hold a button to keep moving.
document
  .querySelectorAll("[data-tile]")
  .forEach(button => {
    let repeat = null;

    const stopRepeat = () => {
      clearTimeout(repeat);
      clearInterval(repeat);
      repeat = null;
    };

    button.addEventListener("pointerdown", event => {
      event.preventDefault();

      const move =
        button.dataset.tile;

      tileGame?.act(move);

      if (move === "left" || move === "right" || move === "down") {
        repeat = setTimeout(() => {
          repeat = setInterval(() => tileGame?.act(move), 60);
        }, 180);
      }
    });

    button.addEventListener("pointerup", stopRepeat);
    button.addEventListener("pointerleave", stopRepeat);
    button.addEventListener("pointercancel", stopRepeat);
  });


// Swipe on the board: sideways moves, a quick swipe down drops,
// a tap rotates.
(() => {
  const canvas =
    document.getElementById("tileCanvas");

  let start = null;

  canvas.addEventListener("pointerdown", event => {
    start = { x: event.clientX, y: event.clientY, moved: 0, time: Date.now() };
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener("pointermove", event => {
    if (!start) {
      return;
    }

    const steps =
      Math.trunc((event.clientX - start.x) / 28) - start.moved;

    for (let i = 0; i < Math.abs(steps); i += 1) {
      tileGame?.act(steps > 0 ? "right" : "left");
    }

    start.moved += steps;
  });

  canvas.addEventListener("pointerup", event => {
    if (!start) {
      return;
    }

    const dx =
      event.clientX - start.x;

    const dy =
      event.clientY - start.y;

    if (dy > 60 && Math.abs(dy) > Math.abs(dx) && Date.now() - start.time < 400) {
      tileGame?.act("drop");
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      tileGame?.act("rotate");
    }

    start = null;
  });
})();

document.addEventListener("keydown", event => {
  if (!tileGame || document.getElementById("tileDropScreen").classList.contains("hidden")) {
    return;
  }

  const moves = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowUp: "rotate",
    " ": "drop"
  };

  if (moves[event.key]) {
    event.preventDefault();
    tileGame.act(moves[event.key]);
  } else if (event.key === "Escape") {
    closeTileDrop();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    tileGame?.pause();
  } else {
    tileGame?.resume();
  }
});

document
  .getElementById("tileDropButton")
  .addEventListener("click", openTileDrop);

document
  .getElementById("tileDropCloseButton")
  .addEventListener("click", closeTileDrop);


/* ---------- Leaderboard ---------- */

async function openLeaderboard() {
  if (!myServers.length) {
    try {
      myServers =
        await request("/rest/v1/servers?select=id,name&order=created_at.asc", { headers: authHeaders() }) || [];
    } catch (error) {
      myServers = [];
    }
  }

  if (leaderboardView.server && !myServers.some(server => server.id === leaderboardView.server)) {
    leaderboardView.server = null;
  }

  document.getElementById("leaderboardModal").classList.add("open");
  renderLeaderboardChips();
  loadLeaderboard();
}


function renderLeaderboardChips() {
  document
    .querySelectorAll("#leaderboardPeriods [data-period]")
    .forEach(button => {
      button.classList.toggle("active", button.dataset.period === leaderboardView.period);
    });

  const scopes =
    document.getElementById("leaderboardScopes");

  scopes.innerHTML = "";

  for (const scope of [{ id: "", name: "Everyone" }, ...myServers]) {
    const button =
      document.createElement("button");

    button.type =
      "button";

    button.className =
      "filter-button" + ((leaderboardView.server || "") === scope.id ? " active" : "");

    button.dataset.server =
      scope.id;

    button.textContent =
      scope.name;

    scopes.appendChild(button);
  }
}


async function loadLeaderboard() {
  const list =
    document.getElementById("leaderboardList");

  list.innerHTML =
    '<p class="status">Loading…</p>';

  try {
    const board =
      await playRpc("arcade_leaderboard", {
        p_game: "tile_drop",
        p_period: leaderboardView.period,
        p_server: leaderboardView.server,
        p_today: TODAY
      });

    list.innerHTML = "";

    for (const entry of board?.rows || []) {
      const row =
        document.createElement("div");

      row.className =
        "leaderboard-row" + (entry.is_me ? " me" : "");

      const rank =
        document.createElement("span");

      rank.className =
        "leaderboard-rank";

      rank.textContent =
        entry.rank === 1 ? "👑" : "#" + entry.rank;

      const name =
        document.createElement("span");

      name.className =
        "leaderboard-name";

      name.textContent =
        entry.username ? "@" + entry.username : "Player";

      if (entry.is_me) {
        name.textContent += " (you)";
      }

      const score =
        document.createElement("b");

      score.textContent =
        Number(entry.score).toLocaleString("en-US");

      row.append(rank, name, score);
      list.appendChild(row);
    }

    if (!list.children.length) {
      list.innerHTML =
        '<p class="status">No scores yet. Be the first!</p>';
    } else if (board.me && !board.rows.some(entry => entry.is_me)) {
      const me =
        document.createElement("p");

      me.className =
        "status";

      me.textContent =
        "You: #" + board.me.rank + " · " + Number(board.me.score).toLocaleString("en-US");

      list.appendChild(me);
    }
  } catch (error) {
    list.innerHTML =
      '<p class="status error">The leaderboard could not be loaded.</p>';
  }
}


document
  .getElementById("leaderboardPeriods")
  .addEventListener("click", event => {
    const button =
      event.target.closest("[data-period]");

    if (button) {
      leaderboardView.period = button.dataset.period;
      renderLeaderboardChips();
      loadLeaderboard();
    }
  });

document
  .getElementById("leaderboardScopes")
  .addEventListener("click", event => {
    const button =
      event.target.closest("[data-server]");

    if (button) {
      leaderboardView.server = button.dataset.server || null;
      renderLeaderboardChips();
      loadLeaderboard();
    }
  });

document
  .getElementById("tileDropBoardButton")
  .addEventListener("click", () => openLeaderboard());

document
  .getElementById("playLoginButton")
  .addEventListener("click", () => {
    document.getElementById("accountModal").classList.add("open");
  });


// Called from app.js on sign out.
function resetPlay() {
  closeDuelScreenQuietly();
  closeTileDropQuietly();
  playFriends = [];
  playDuels = [];
  clearTimeout(playPollTimer);
}


function closeDuelScreenQuietly() {
  clearInterval(duelPollTimer);
  openDuel = null;
  document.getElementById("duelScreen").classList.add("hidden");
  document.body.classList.remove("play-screen-open");
}


function closeTileDropQuietly() {
  tileGame?.stop();
  tileGame = null;
  document.getElementById("tileDropScreen").classList.add("hidden");
  document.body.classList.remove("play-screen-open");
}


// The Play tab may already be showing (it was the last tab used).
if (currentTab === "play") {
  loadPlayTab();
}
