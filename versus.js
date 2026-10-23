/*
 * Play tab: Word Race, Trivia Showdown, Higher or Lower and Mind Meld.
 *
 * Like Wordle Duel, each player takes their own turn (the challenger
 * can go first, before the challenge is accepted). The database keeps
 * the answers and the clock, so the app only shows what it's told.
 * Uses play.js (playRpc, friendName, friendAvatar, isOnline...).
 */
const VERSUS_RULES = {
  word_race: [
    "You both get the same 9 letters.",
    "Make as many words as you can in 2 minutes (3 letters or more).",
    "Longer words score more: 3 letters = 1, 4 = 2, 5 = 4, 6 = 7, 7 = 10, 8 = 14, all 9 = 20."
  ],
  trivia: [
    "10 questions, 12 seconds each. You both get the same ones.",
    "Each question's point goes to whoever answers it right faster."
  ],
  higher_lower: [
    "Two things appear. Tap the one with the bigger number.",
    "10 seconds a pick. One miss and your turn is over.",
    "Longest streak wins. A tie goes to whoever was quicker."
  ],
  mind_meld: [
    "You both say any word. Then you see each other's words.",
    "Next, each say a word that links those two, trying to say the same one.",
    "Keep going until you match. Fewer rounds is better. You win together."
  ]
};

const WORD_POINTS =
  { 3: 1, 4: 2, 5: 4, 6: 7, 7: 10, 8: 14, 9: 20 };

let versusDuel =
  null;

let versusTurn =
  null;

let versusPollTimer =
  null;

let versusClock =
  null;

let versusRound =
  null;

let raceWords =
  null;

let racePicked =
  [];

let raceOrder =
  [];

let raceDeadline =
  0;



/* ---------- Shared ---------- */

function versusGame(duel = versusDuel) {
  return gameInfo(duel?.game);
}


// The score line for one player, worded for the game.
function versusScoreText(game, turn, final) {
  const score =
    Number(turn?.score || 0);

  if (game === "word_race") {
    return score + (score === 1 ? " pt" : " pts");
  }

  if (game === "trivia") {
    return final
      ? score + (score === 1 ? " point" : " points")
      : Number(turn?.correct || 0) + " right";
  }

  return "Streak " + score;
}


// Short text for the Play tab list (used by renderDuelList in play.js).
function versusSummary(duel) {
  const name =
    friendName(duel.opponent);

  const game =
    gameInfo(duel.game).name;

  const me =
    duel.me || {};

  const them =
    duel.them || {};

  if (duel.game === "mind_meld") {
    return meldSummary(duel);
  }

  const theirStatus =
    them.finished
      ? "they got " + versusScoreText(duel.game, them, false).toLowerCase()
      : them.started ? "they're playing" : "they haven't played";

  if (duel.status === "pending" && !duel.is_challenger) {
    return { title: name + " challenged you", sub: game, action: "accept" };
  }

  if (duel.status === "pending") {
    return {
      title: "Waiting for " + name,
      sub: game + " · " + (me.finished ? "you're done, they haven't accepted" : "you can play now"),
      button: me.finished ? "See" : "Play"
    };
  }

  if (duel.status === "active") {
    return {
      title: me.finished ? "Waiting for " + name : "Your turn vs " + name,
      sub: game + " · " + (me.finished ? "you got " + versusScoreText(duel.game, me, false).toLowerCase() : theirStatus),
      button: me.finished ? "See" : "Play"
    };
  }

  return {
    title: duelOutcomeText(duel),
    sub: duel.status === "finished"
      ? game + " · you " + versusScoreText(duel.game, me, true) + " · them " + versusScoreText(duel.game, them, true)
      : game,
    button: "See",
    secondary: true
  };
}


function versusEl(tag, className, text) {
  const el =
    document.createElement(tag);

  if (className) {
    el.className = className;
  }

  if (text !== undefined) {
    el.textContent = text;
  }

  return el;
}


function versusBody() {
  return document.getElementById("versusBody");
}


function stopVersusTimers() {
  clearInterval(versusPollTimer);
  clearInterval(versusClock);
  clearTimeout(versusRound?.timeout);
  clearTimeout(versusRound?.nextTimer);
  versusPollTimer = null;
  versusClock = null;
}


async function openVersusScreen(id) {
  const duel =
    await playRpc("duel_state", { p_duel: id });

  versusDuel = duel;
  versusTurn = null;

  document.getElementById("versusScreen").classList.remove("hidden");
  document.body.classList.add("play-screen-open");

  if (duel.game === "word_race") {
    loadRaceWords();
  }

  showVersusStage();
}


function closeVersusScreen(skipConfirm) {
  if (!skipConfirm && versusStage() === "playing" && versusTurn) {
    const message =
      versusDuel.game === "word_race"
        ? "Leave the game? The clock keeps running."
        : "Leave the game? The timer keeps running.";

    if (!confirm(message)) {
      return;
    }
  }

  stopVersusTimers();
  versusDuel = null;
  versusTurn = null;
  versusRound = null;

  document.getElementById("versusScreen").classList.add("hidden");
  document.body.classList.remove("play-screen-open");

  if (!skipConfirm) {
    loadPlayTab();
  }
}


async function refreshVersus() {
  if (!versusDuel) {
    return;
  }

  versusDuel =
    await playRpc("duel_state", { p_duel: versusDuel.id });

  showVersusStage();
}


function versusStage(duel = versusDuel) {
  if (!duel) {
    return null;
  }

  if (duel.status === "finished") {
    return duel.game === "mind_meld" ? "meld" : "result";
  }

  if (duel.status === "declined" || duel.status === "cancelled") {
    return "closed";
  }

  if (duel.game === "mind_meld") {
    return duel.status === "pending" && !duel.is_challenger ? "intro" : "meld";
  }

  if (duel.me?.finished) {
    return "waiting";
  }

  return duel.me?.started ? "playing" : "intro";
}


function renderVersusHeader() {
  const duel =
    versusDuel;

  const info =
    versusGame();

  const opponentFriend =
    playFriends.find(entry => entry.user_id === duel.opponent);

  document.getElementById("versusTitle").textContent =
    info.name + (info.tag === "together" ? " with " : " vs ") + friendName(duel.opponent);

  document.getElementById("versusOpponentAvatar")
    .replaceChildren(friendAvatar(duel.opponent, isOnline(opponentFriend)));

  document.getElementById("versusOpponentName").textContent =
    friendName(duel.opponent);

  const them =
    duel.them || {};

  const meld =
    duel.meld;

  let status;

  if (meld && duel.status === "finished") {
    status = meld.matched ? "You matched!" : "Game over";
  } else if (meld && duel.status === "pending" && duel.is_challenger) {
    status = "Hasn't accepted yet";
  } else if (meld) {
    status = meld.they_ready ? "Ready ✓" : "Thinking…";
  } else if (duel.status === "finished" || them.finished) {
    status = them.started ? "Done · " + versusScoreText(duel.game, them, duel.status === "finished") : "Didn't play";
  } else if (them.started) {
    status = "Playing now";
  } else if (duel.status === "pending" && duel.is_challenger) {
    status = "Hasn't accepted yet";
  } else {
    status = isOnline(opponentFriend) ? "Online, hasn't played yet" : "Hasn't played yet";
  }

  document.getElementById("versusOpponentStatus").textContent =
    status;

  document.getElementById("versusScore").textContent =
    meld ? "Round " + (duel.status === "finished" ? Math.max(1, meld.rounds.length) : meld.round)
      : duel.me?.started ? versusScoreText(duel.game, duel.me, duel.status === "finished") : "";

  const giveUp =
    document.getElementById("versusGiveUpButton");

  const open =
    duel.status === "active" || (duel.status === "pending" && duel.is_challenger);

  giveUp.classList.toggle("hidden", !open);

  giveUp.textContent =
    duel.status === "pending" ? "Call off" : meld ? "End game" : "Give up";
}


function showVersusStage() {
  stopVersusTimers();

  const stage =
    versusStage();

  if (!stage) {
    return;
  }

  renderVersusHeader();

  if (stage === "intro") {
    renderVersusIntro();
  } else if (stage === "playing") {
    startVersusTurn();
  } else if (stage === "waiting") {
    renderVersusWaiting();
  } else if (stage === "meld") {
    renderMeld();
  } else if (stage === "result") {
    renderVersusResult();
  } else {
    renderVersusClosed();
  }
}


function renderVersusIntro() {
  const duel =
    versusDuel;

  const info =
    versusGame();

  const body =
    versusBody();

  body.replaceChildren();

  const intro =
    versusEl("div", "versus-intro");

  const icon =
    versusEl("span", "play-game-icon big", info.icon);

  icon.style.background = info.color;

  const rules =
    versusEl("ul", "versus-rules");

  for (const rule of VERSUS_RULES[duel.game]) {
    rules.appendChild(versusEl("li", "", rule));
  }

  intro.append(icon, versusEl("h3", "", info.name), rules);

  if (duel.status === "pending" && !duel.is_challenger) {
    intro.appendChild(versusEl("p", "versus-note", "Accept the challenge on the Play tab to start."));
  } else {
    const start =
      versusEl("button", "play-go big", duel.game === "word_race" ? "Start · 2:00 on the clock" : "Start");

    start.type = "button";
    start.id = "versusStartButton";
    start.addEventListener("click", startVersusTurn);
    intro.appendChild(start);

    if (duel.status === "pending") {
      intro.appendChild(versusEl("p", "versus-note", friendName(duel.opponent) + " plays after they accept."));
    }
  }

  body.appendChild(intro);
}


async function startVersusTurn() {
  const duel =
    versusDuel;

  try {
    versusTurn =
      await playRpc("versus_start", { p_duel: duel.id });

    versusDuel = versusTurn.duel;
  } catch (error) {
    renderVersusMessage(error.message || "The game could not start.");
    return;
  }

  renderVersusHeader();

  if (versusDuel.me?.finished) {
    showVersusStage();
  } else if (duel.game === "word_race") {
    renderRace();
  } else {
    nextVersusRound();
  }
}


function renderVersusMessage(text) {
  const body =
    versusBody();

  body.replaceChildren(versusEl("p", "status error", text));
}


function renderVersusWaiting() {
  const duel =
    versusDuel;

  const body =
    versusBody();

  const box =
    versusEl("div", "versus-wait");

  box.append(
    versusEl("span", "versus-big", versusScoreText(duel.game, duel.me, false)),
    versusEl("b", "", "Nice! You're done."),
    versusEl("span", "", "Waiting for " + friendName(duel.opponent) + " to play. You'll see who won here and on the Play tab.")
  );

  const close =
    versusEl("button", "play-go", "Back to Play");

  close.type = "button";
  close.addEventListener("click", () => closeVersusScreen());
  box.appendChild(close);

  body.replaceChildren(box);

  versusPollTimer = setInterval(async () => {
    try {
      const fresh =
        await playRpc("duel_state", { p_duel: duel.id });

      if (versusDuel?.id === fresh.id && versusStage(fresh) !== "waiting") {
        versusDuel = fresh;
        showVersusStage();
      } else if (versusDuel?.id === fresh.id) {
        versusDuel = fresh;
        renderVersusHeader();
      }
    } catch (error) {
      // Try again next time.
    }
  }, 4000);
}


function renderVersusClosed() {
  const box =
    versusEl("div", "versus-wait");

  box.append(versusEl("b", "", duelOutcomeText(versusDuel)));

  const close =
    versusEl("button", "play-go", "Back to Play");

  close.type = "button";
  close.addEventListener("click", () => closeVersusScreen());
  box.appendChild(close);

  versusBody().replaceChildren(box);
}


async function renderVersusResult() {
  const duel =
    versusDuel;

  const body =
    versusBody();

  const box =
    versusEl("div", "duel-result versus-result");

  const won =
    duel.winner === session?.user.id;

  const headline =
    !duel.winner ? "🤝 It's a draw" : won ? "🏆 You win!" : "👑 " + friendName(duel.opponent) + " wins";

  box.append(
    versusEl("b", "", headline),
    versusEl("span", "", "You " + versusScoreText(duel.game, duel.me, true) + " · " + friendName(duel.opponent) + " " + versusScoreText(duel.game, duel.them, true))
  );

  const details =
    versusEl("div", "versus-details");

  const again =
    versusEl("button", "play-go", "Rematch");

  again.type = "button";
  again.id = "versusRematchButton";
  again.addEventListener("click", () => {
    const opponent = duel.opponent;
    const game = duel.game;
    closeVersusScreen(true);
    challengeFriend(opponent, game);
  });

  box.append(details, again);
  body.replaceChildren(box);

  try {
    const result =
      await playRpc("versus_result", { p_duel: duel.id });

    if (versusDuel?.id !== duel.id) {
      return;
    }

    if (duel.game === "word_race") {
      renderRaceResult(details, result);
    } else if (duel.game === "trivia") {
      renderTriviaResult(details, result);
    } else {
      renderHigherLowerResult(details, result);
    }
  } catch (error) {
    details.appendChild(versusEl("p", "status error", "The details could not be loaded."));
  }
}


// A draining bar for the round timer; calls onTimeout when it runs out.
function startRoundTimer(secondsLeft, total, onTimeout) {
  const bar =
    document.getElementById("versusTimerBar");

  if (bar) {
    bar.style.transition = "none";
    bar.style.width = Math.max(0, secondsLeft / total * 100) + "%";
    void bar.offsetWidth;
    bar.style.transition = "width " + Math.max(0, secondsLeft) + "s linear";
    bar.style.width = "0%";
  }

  versusRound.timeout =
    setTimeout(onTimeout, Math.max(0, secondsLeft) * 1000);
}


function freezeRoundTimer() {
  const bar =
    document.getElementById("versusTimerBar");

  if (bar) {
    bar.style.width = getComputedStyle(bar).width;
    bar.style.transition = "none";
  }

  clearTimeout(versusRound?.timeout);
}


document
  .getElementById("versusCloseButton")
  .addEventListener("click", () => closeVersusScreen());

document
  .getElementById("versusGiveUpButton")
  .addEventListener("click", async () => {
    if (!versusDuel) {
      return;
    }

    const question =
      versusDuel.status === "pending"
        ? "Call off this challenge?"
        : versusDuel.game === "mind_meld"
          ? "End this game for both of you?"
          : "Give up? " + friendName(versusDuel.opponent) + " will win.";

    if (!confirm(question)) {
      return;
    }

    try {
      await playRpc("cancel_duel", { p_duel: versusDuel.id });
      await refreshVersus();
    } catch (error) {
      renderVersusMessage(error.message || "That didn't work. Try again.");
    }
  });



/* ---------- Word Race ---------- */

async function loadRaceWords() {
  if (raceWords) {
    return raceWords;
  }

  try {
    const response =
      await fetch("data/word-race-words.txt");

    raceWords =
      new Set((await response.text()).split(/\s+/).filter(Boolean));
  } catch (error) {
    raceWords = null;
  }

  return raceWords;
}


function raceLetters() {
  return versusTurn?.letters || "";
}


function renderRace() {
  const body =
    versusBody();

  racePicked = [];
  raceOrder = [...raceLetters()].map((_, i) => i);

  body.replaceChildren();

  const top =
    versusEl("div", "race-top");

  const clock =
    versusEl("span", "race-clock", "2:00");

  clock.id = "raceClock";

  top.append(clock);

  const word =
    versusEl("button", "race-word");

  word.type = "button";
  word.id = "raceWord";
  word.setAttribute("aria-label", "Clear word");
  word.addEventListener("click", () => {
    racePicked = [];
    drawRace();
  });

  const message =
    versusEl("p", "duel-message", "Tap letters to make a word.");

  message.id = "raceMessage";

  const tiles =
    versusEl("div", "race-tiles");

  tiles.id = "raceTiles";
  tiles.addEventListener("click", event => {
    const tile =
      event.target.closest("[data-tile-index]");

    if (tile) {
      raceTap(Number(tile.dataset.tileIndex));
    }
  });

  const actions =
    versusEl("div", "race-actions");

  for (const [action, label, extra] of [["shuffle", "🔀 Mix", ""], ["back", "⌫", ""], ["enter", "Enter", " primary"]]) {
    const button =
      versusEl("button", "race-action" + extra, label);

    button.type = "button";
    button.dataset.race = action;
    actions.appendChild(button);
  }

  actions.addEventListener("click", event => {
    const button =
      event.target.closest("[data-race]");

    if (button) {
      raceAction(button.dataset.race);
    }
  });

  const found =
    versusEl("div", "race-found");

  found.id = "raceFound";

  body.append(top, word, message, tiles, actions, found);

  raceDeadline =
    Date.now() + Number(versusTurn.seconds_left || 0) * 1000;

  drawRace();
  tickRaceClock();
  versusClock = setInterval(tickRaceClock, 250);
}


function drawRace() {
  const letters =
    raceLetters();

  const word =
    document.getElementById("raceWord");

  if (!word) {
    return;
  }

  word.replaceChildren(
    ...racePicked.map(i => versusEl("span", "race-letter", letters[i].toUpperCase()))
  );

  word.classList.toggle("empty", !racePicked.length);

  const tiles =
    document.getElementById("raceTiles");

  tiles.replaceChildren(...raceOrder.map(i => {
    const tile =
      versusEl("button", "race-tile", letters[i].toUpperCase());

    tile.type = "button";
    tile.dataset.tileIndex = i;
    tile.disabled = racePicked.includes(i);
    return tile;
  }));

  const words =
    versusTurn.words || [];

  const found =
    document.getElementById("raceFound");

  found.replaceChildren(...[...words].reverse().map(entry => {
    const chip =
      versusEl("span", "race-chip", entry.word.toUpperCase());

    chip.appendChild(versusEl("small", "", "+" + entry.points));
    return chip;
  }));

  document.getElementById("versusScore").textContent =
    versusScoreText("word_race", versusTurn.duel.me, false);
}


function raceTap(index) {
  if (racePicked.includes(index) || raceDeadline <= Date.now()) {
    return;
  }

  racePicked.push(index);
  drawRace();
}


function raceMessage(text, tone) {
  const message =
    document.getElementById("raceMessage");

  if (!message) {
    return;
  }

  message.textContent = text;
  message.dataset.tone = tone || "";
}


async function raceAction(action) {
  if (raceDeadline <= Date.now()) {
    return;
  }

  if (action === "shuffle") {
    for (let i = raceOrder.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [raceOrder[i], raceOrder[j]] = [raceOrder[j], raceOrder[i]];
    }

    drawRace();
    return;
  }

  if (action === "back") {
    racePicked.pop();
    drawRace();
    return;
  }

  const letters =
    raceLetters();

  const word =
    racePicked.map(i => letters[i]).join("");

  if (word.length < 3) {
    raceMessage("Words need 3 letters or more", "bad");
    return;
  }

  if ((versusTurn.words || []).some(entry => entry.word === word)) {
    raceMessage("Already found " + word.toUpperCase(), "bad");
    racePicked = [];
    drawRace();
    return;
  }

  const words =
    await loadRaceWords();

  if (words && !words.has(word)) {
    raceMessage(word.toUpperCase() + " isn't in the word list", "bad");
    return;
  }

  racePicked = [];
  drawRace();

  try {
    const turn =
      await playRpc("word_race_word", { p_duel: versusDuel.id, p_word: word });

    versusTurn = { ...versusTurn, ...turn, letters: versusTurn.letters, seconds_left: versusTurn.seconds_left };
    versusDuel = turn.duel;

    raceMessage("+" + (WORD_POINTS[word.length] || 0) + " · " + word.toUpperCase(), "good");
    drawRace();
  } catch (error) {
    raceMessage(error.message || "That word didn't go through.", "bad");

    if (/turn is over/i.test(error.message || "")) {
      refreshVersus();
    }
  }
}


function tickRaceClock() {
  const left =
    Math.max(0, Math.ceil((raceDeadline - Date.now()) / 1000));

  const clock =
    document.getElementById("raceClock");

  if (!clock) {
    return;
  }

  clock.textContent =
    Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");

  clock.classList.toggle("low", left <= 10);

  if (left === 0) {
    clearInterval(versusClock);
    versusClock = null;

    raceMessage("Time's up!", "");
    document.querySelectorAll(".race-tile, .race-action").forEach(button => {
      button.disabled = true;
    });

    // The database closes the turn a few seconds after the clock.
    versusRound = {
      timeout: setTimeout(refreshVersus, 3500)
    };
  }
}


document.addEventListener("keydown", event => {
  if (
    !versusDuel ||
    versusDuel.game !== "word_race" ||
    !document.getElementById("raceTiles") ||
    event.metaKey || event.ctrlKey || event.altKey
  ) {
    return;
  }

  if (event.key === "Enter") {
    raceAction("enter");
  } else if (event.key === "Backspace") {
    raceAction("back");
  } else if (/^[a-zA-Z]$/.test(event.key)) {
    const letters =
      raceLetters();

    const index =
      raceOrder.find(i => letters[i] === event.key.toLowerCase() && !racePicked.includes(i));

    if (index !== undefined) {
      raceTap(index);
    }
  }
});


// All the words that can be made from the letters, longest first.
function racePossibleWords(letters) {
  if (!raceWords) {
    return [];
  }

  const counts =
    {};

  for (const letter of letters) {
    counts[letter] = (counts[letter] || 0) + 1;
  }

  const fits = word => {
    const left = { ...counts };

    for (const letter of word) {
      if (!left[letter]) {
        return false;
      }

      left[letter] -= 1;
    }

    return true;
  };

  return [...raceWords]
    .filter(word => word.length <= letters.length && fits(word))
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
}


function raceWordList(title, words) {
  const column =
    versusEl("div", "race-result-column");

  column.appendChild(versusEl("b", "", title));

  if (!words.length) {
    column.appendChild(versusEl("span", "versus-note", "No words"));
  }

  for (const entry of words) {
    const row =
      versusEl("span", "race-result-word", entry.word.toUpperCase());

    row.appendChild(versusEl("small", "", "+" + entry.points));
    column.appendChild(row);
  }

  return column;
}


async function renderRaceResult(details, result) {
  details.appendChild(versusEl("p", "versus-note", "The 9-letter word was " + String(result.word || "").toUpperCase()));

  const columns =
    versusEl("div", "race-result");

  columns.append(
    raceWordList("You", result.mine || []),
    raceWordList(friendName(versusDuel.opponent), result.theirs || [])
  );

  details.appendChild(columns);

  await loadRaceWords();

  const taken =
    new Set([...(result.mine || []), ...(result.theirs || [])].map(entry => entry.word));

  const missed =
    racePossibleWords(result.letters || "")
      .filter(word => !taken.has(word))
      .slice(0, 6);

  if (missed.length) {
    details.appendChild(versusEl("p", "versus-note", "Words nobody found: " + missed.map(word => word.toUpperCase()).join(", ")));
  }
}



/* ---------- Trivia and Higher or Lower rounds ---------- */

async function nextVersusRound() {
  const duel =
    versusDuel;

  let round;

  try {
    round =
      await playRpc("versus_next", { p_duel: duel.id });
  } catch (error) {
    if (/turn is over/i.test(error.message || "")) {
      refreshVersus();
    } else {
      renderVersusMessage(error.message || "The next round could not load.");
    }

    return;
  }

  if (versusDuel?.id !== duel.id) {
    return;
  }

  if (round.done) {
    refreshVersus();
    return;
  }

  versusRound = { ...round, answered: false };

  if (duel.game === "trivia") {
    renderTriviaRound(round);
  } else {
    renderHigherLowerRound(round);
  }

  const total =
    duel.game === "trivia" ? 12 : 10;

  startRoundTimer(Number(round.seconds_left), total, () => answerVersusRound(-1));
}


function versusTimer() {
  const timer =
    versusEl("div", "versus-timer");

  const bar =
    versusEl("i");

  bar.id = "versusTimerBar";
  timer.appendChild(bar);
  return timer;
}


function renderTriviaRound(round) {
  const body =
    versusBody();

  const top =
    versusEl("div", "round-top");

  top.append(
    versusEl("span", "", "Question " + round.n + " of " + round.total),
    versusEl("span", "round-tag", round.category)
  );

  const choices =
    versusEl("div", "trivia-choices");

  round.choices.forEach((choice, i) => {
    const button =
      versusEl("button", "round-choice", choice);

    button.type = "button";
    button.dataset.choice = i;
    choices.appendChild(button);
  });

  choices.addEventListener("click", event => {
    const button =
      event.target.closest("[data-choice]");

    if (button) {
      answerVersusRound(Number(button.dataset.choice));
    }
  });

  const message =
    versusEl("p", "duel-message", "");

  message.id = "roundMessage";

  body.replaceChildren(top, versusTimer(), versusEl("h3", "trivia-question", round.question), choices, message);
}


function renderHigherLowerRound(round) {
  const body =
    versusBody();

  const top =
    versusEl("div", "round-top");

  top.append(
    versusEl("span", "", "Streak " + round.streak),
    versusEl("span", "round-tag", HIGHER_LOWER_TAGS[round.category] || "")
  );

  const cards =
    versusEl("div", "hl-cards");

  round.choices.forEach((choice, i) => {
    const card =
      versusEl("button", "round-choice hl-card");

    card.type = "button";
    card.dataset.choice = i;
    card.append(versusEl("b", "", choice), versusEl("span", "hl-value", ""));
    cards.appendChild(card);

    if (i === 0) {
      cards.appendChild(versusEl("span", "hl-vs", "or"));
    }
  });

  cards.addEventListener("click", event => {
    const card =
      event.target.closest("[data-choice]");

    if (card) {
      answerVersusRound(Number(card.dataset.choice));
    }
  });

  const message =
    versusEl("p", "duel-message", "");

  message.id = "roundMessage";

  body.replaceChildren(top, versusTimer(), versusEl("p", "hl-prompt", round.prompt), cards, message);
}


const HIGHER_LOWER_TAGS = {
  population: "🌍 Population",
  us_state: "🇺🇸 States",
  box_office: "🎬 Box office",
  nba_points: "🏀 NBA",
  mlb_home_runs: "⚾ MLB",
  grand_slams: "🎾 Tennis",
  mountain: "⛰️ Mountains"
};


function formatFact(value, unit) {
  const number =
    Number(value);

  const big = (n, suffix) => {
    const short = n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 2 : n < 100 ? 1 : 0 });
    return short + " " + suffix;
  };

  let text;

  if (number >= 1e9) {
    text = big(number / 1e9, "billion");
  } else if (number >= 1e6) {
    text = big(number / 1e6, "million");
  } else {
    text = number.toLocaleString("en-US");
  }

  if (unit === "dollars") {
    return "$" + text;
  }

  if (unit === "meters") {
    return text + " m";
  }

  return text + " " + unit;
}


async function answerVersusRound(choice) {
  const round =
    versusRound;

  const duel =
    versusDuel;

  if (!round || round.answered || !duel) {
    return;
  }

  round.answered = true;
  freezeRoundTimer();

  document.querySelectorAll(".round-choice").forEach(button => {
    button.disabled = true;
  });

  const picked =
    document.querySelector(`.round-choice[data-choice="${choice}"]`);

  picked?.classList.add("picked");

  let result;

  try {
    result =
      await playRpc("versus_answer", { p_duel: duel.id, p_n: round.n, p_choice: choice });
  } catch (error) {
    const message = document.getElementById("roundMessage");
    if (message) message.textContent = error.message || "That answer didn't go through.";
    round.nextTimer = setTimeout(refreshVersus, 1500);
    return;
  }

  if (versusDuel?.id !== duel.id) {
    return;
  }

  document.querySelectorAll(".round-choice").forEach(button => {
    const index =
      Number(button.dataset.choice);

    if (index === result.right_choice) {
      button.classList.add("right");
    } else if (index === choice) {
      button.classList.add("wrong");
    }

    if (result.values) {
      button.querySelector(".hl-value").textContent = formatFact(result.values[index], result.unit);
    }
  });

  const message =
    document.getElementById("roundMessage");

  const seconds =
    (Number(result.ms) / 1000).toFixed(1) + "s";

  if (result.correct) {
    duel.me.score = Number(duel.me.score || 0) + 1;
    duel.me.correct = Number(duel.me.correct || 0) + 1;
    message.textContent = (duel.game === "trivia" ? "Right! " : "Yes! ") + seconds;
    message.dataset.tone = "good";
  } else {
    message.textContent =
      choice < 0 || result.late ? "Time's up" : duel.game === "trivia" ? "Not quite" : "Missed it";
    message.dataset.tone = "bad";
  }

  renderVersusHeader();

  const keepGoing =
    duel.game === "trivia" ? round.n < round.total : result.correct;

  if (duel.game === "higher_lower" && !result.correct) {
    message.textContent += " · your streak ends at " + duel.me.score;
  }

  round.nextTimer =
    setTimeout(keepGoing ? nextVersusRound : refreshVersus, result.values ? 1600 : 1300);
}


function renderTriviaResult(details, result) {
  const list =
    versusEl("div", "trivia-result");

  const them =
    friendName(versusDuel.opponent);

  const mark = entry =>
    entry?.correct ? "✓ " + (entry.ms / 1000).toFixed(1) + "s" : "✗";

  for (const q of result.questions || []) {
    const row =
      versusEl("div", "trivia-result-row");

    const mineFaster =
      q.mine?.correct && (!q.theirs?.correct || q.mine.ms < q.theirs.ms);

    const theirsFaster =
      q.theirs?.correct && !mineFaster;

    const text =
      versusEl("div", "trivia-result-text");

    text.append(versusEl("span", "", q.n + ". " + q.question), versusEl("b", "", q.answer));

    const you =
      versusEl("span", "trivia-mark" + (mineFaster ? " point" : ""), "You " + mark(q.mine));

    const other =
      versusEl("span", "trivia-mark" + (theirsFaster ? " point" : ""), them + " " + mark(q.theirs));

    const marks =
      versusEl("div", "trivia-marks");

    marks.append(you, other);
    row.append(text, marks);
    list.appendChild(row);
  }

  details.appendChild(list);
}


function renderHigherLowerResult(details, result) {
  const line = (who, entry) =>
    who + ": streak of " + Number(entry?.streak || 0) + " in " + (Number(entry?.ms || 0) / 1000).toFixed(1) + "s";

  details.append(
    versusEl("p", "versus-note", line("You", result.mine)),
    versusEl("p", "versus-note", line(friendName(versusDuel.opponent), result.theirs))
  );
}



/* ---------- Mind Meld ---------- */

function meldRoundsText(count) {
  return count + (count === 1 ? " round" : " rounds");
}


// Short text for the Play tab list.
function meldSummary(duel) {
  const name =
    friendName(duel.opponent);

  const meld =
    duel.meld || { rounds: [], round: 1 };

  const rounds =
    meld.rounds.length;

  if (duel.status === "pending" && !duel.is_challenger) {
    return { title: name + " wants to Mind Meld", sub: "Mind Meld · say the same word", action: "accept" };
  }

  if (duel.status === "pending") {
    return { title: "Waiting for " + name, sub: "Mind Meld · they haven't accepted", button: "Open" };
  }

  if (duel.status === "active") {
    return meld.my_word
      ? { title: "Waiting for " + name, sub: "Mind Meld · round " + meld.round, button: "Open" }
      : {
        title: "Your turn with " + name,
        sub: "Mind Meld · round " + meld.round + (meld.they_ready ? " · they're ready" : ""),
        button: "Play"
      };
  }

  if (duel.status === "finished") {
    return meld.matched
      ? { title: "🧠 Mind meld with " + name, sub: "You both said " + meld.matched.toUpperCase() + " in " + meldRoundsText(rounds), button: "See", secondary: true }
      : { title: "Mind Meld with " + name, sub: "Ended after " + meldRoundsText(rounds), button: "See", secondary: true };
  }

  return { title: duelOutcomeText(duel), sub: "Mind Meld", button: "See", secondary: true };
}


// Built once per game; refreshMeld fills it in so typing isn't lost
// when the screen updates.
function renderMeld() {
  const body =
    versusBody();

  body.replaceChildren();

  const head =
    versusEl("div", "meld-head");

  head.append(versusEl("span", "", ""), versusEl("b", "", "You"), versusEl("b", "", friendName(versusDuel.opponent)));

  const rounds =
    versusEl("div", "meld-rounds");

  rounds.id = "meldRounds";

  const prompt =
    versusEl("p", "meld-prompt");

  prompt.id = "meldPrompt";

  const form =
    versusEl("form", "meld-form");

  form.id = "meldForm";

  const input =
    versusEl("input", "meld-input");

  input.id = "meldInput";
  input.type = "text";
  input.maxLength = 30;
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.enterKeyHint = "send";
  input.placeholder = "Your word";
  input.setAttribute("aria-label", "Your word");

  const send =
    versusEl("button", "play-go", "Say it");

  send.type = "submit";
  form.append(input, send);
  form.addEventListener("submit", event => {
    event.preventDefault();
    sayMeldWord();
  });

  const status =
    versusEl("p", "duel-message", "");

  status.id = "meldStatus";

  const done =
    versusEl("div", "duel-result versus-result hidden");

  done.id = "meldDone";

  body.append(head, rounds, prompt, form, status, done);

  versusRound = { shownRounds: -1 };
  refreshMeld();

  if (versusDuel.status !== "finished") {
    versusPollTimer = setInterval(pollMeld, 2500);
  }
}


function refreshMeld() {
  const duel =
    versusDuel;

  const meld =
    duel.meld || { rounds: [], round: 1 };

  const rounds =
    document.getElementById("meldRounds");

  if (!rounds) {
    return;
  }

  const finished =
    duel.status === "finished";

  // Add rounds that are new since last time, with a little reveal.
  if (versusRound.shownRounds !== meld.rounds.length) {
    const fresh =
      versusRound.shownRounds >= 0;

    rounds.replaceChildren(...meld.rounds.map((round, i) => {
      const row =
        versusEl("div", "meld-round" + (round.mine === round.theirs ? " match" : "") + (fresh && i >= versusRound.shownRounds ? " fresh" : ""));

      row.append(
        versusEl("span", "meld-num", String(i + 1)),
        versusEl("span", "meld-word", round.mine.toUpperCase()),
        versusEl("span", "meld-word", round.theirs.toUpperCase())
      );

      return row;
    }));

    if (fresh) {
      document.getElementById("meldInput").value = "";
    }

    versusRound.shownRounds = meld.rounds.length;
    rounds.lastElementChild?.scrollIntoView({ block: "nearest" });
  }

  const last =
    meld.rounds[meld.rounds.length - 1];

  const prompt =
    document.getElementById("meldPrompt");

  prompt.replaceChildren();

  if (!finished && !last) {
    prompt.append("Round 1: say any word to start.");
  } else if (!finished) {
    prompt.append("Round " + meld.round + ": say a word that links ");
    prompt.append(versusEl("b", "", last.mine.toUpperCase()), " and ", versusEl("b", "", last.theirs.toUpperCase()));
  }

  const form =
    document.getElementById("meldForm");

  const waiting =
    Boolean(meld.my_word);

  form.classList.toggle("hidden", finished || waiting);

  const status =
    document.getElementById("meldStatus");

  if (!finished && waiting) {
    status.textContent = "You said " + meld.my_word.toUpperCase() + ". Waiting for " + friendName(duel.opponent) + "…";
    status.dataset.tone = "";
  } else if (!finished && meld.they_ready && (!status.dataset.tone || !versusRound.theyReady)) {
    status.textContent = friendName(duel.opponent) + " is ready ✓";
    status.dataset.tone = "";
  } else if (!finished && !meld.they_ready && !status.dataset.tone) {
    status.textContent = "";
  } else if (finished) {
    status.textContent = "";
  }

  versusRound.theyReady =
    Boolean(meld.they_ready);

  const done =
    document.getElementById("meldDone");

  done.classList.toggle("hidden", !finished);

  if (finished && !done.childElementCount) {
    const count =
      meld.rounds.length;

    done.append(
      versusEl("b", "", meld.matched ? "🧠 Mind meld!" : "Game over"),
      versusEl("span", "", meld.matched
        ? "You both said " + meld.matched.toUpperCase() + " in " + meldRoundsText(count) + "."
        : "No match after " + meldRoundsText(count) + ".")
    );

    const again =
      versusEl("button", "play-go", "Play again");

    again.type = "button";
    again.id = "versusRematchButton";
    again.addEventListener("click", () => {
      const opponent = duel.opponent;
      closeVersusScreen(true);
      challengeFriend(opponent, "mind_meld");
    });

    done.appendChild(again);
  }

  renderVersusHeader();
}


async function sayMeldWord() {
  const input =
    document.getElementById("meldInput");

  const status =
    document.getElementById("meldStatus");

  const word =
    input.value.trim().toLowerCase().replace(/\s+/g, " ");

  if (!word) {
    return;
  }

  if (!/^[a-z]+([ '-][a-z]+)*$/.test(word)) {
    status.textContent = "Use a word (letters only).";
    status.dataset.tone = "bad";
    return;
  }

  const said =
    (versusDuel.meld?.rounds || []).flatMap(round => [round.mine, round.theirs]);

  if (said.includes(word)) {
    status.textContent = word.toUpperCase() + " was already said. Try another.";
    status.dataset.tone = "bad";
    return;
  }

  try {
    versusDuel =
      await playRpc("mind_meld_say", { p_duel: versusDuel.id, p_word: word });

    status.dataset.tone = "";
    input.blur();
    refreshMeld();

    if (versusDuel.status === "finished") {
      stopVersusTimers();
    }
  } catch (error) {
    status.textContent = error.message || "That word didn't go through.";
    status.dataset.tone = "bad";
  }
}


async function pollMeld() {
  const duel =
    versusDuel;

  if (!duel || duel.game !== "mind_meld") {
    return;
  }

  try {
    const fresh =
      await playRpc("duel_state", { p_duel: duel.id });

    if (versusDuel?.id !== fresh.id) {
      return;
    }

    versusDuel = fresh;

    if (fresh.status === "declined" || fresh.status === "cancelled") {
      showVersusStage();
      return;
    }

    refreshMeld();

    if (fresh.status === "finished") {
      stopVersusTimers();
    }
  } catch (error) {
    // Try again next time.
  }
}
