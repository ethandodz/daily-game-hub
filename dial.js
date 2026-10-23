/*
 * Play tab: Dial In (like the board game Wavelength), played together.
 *
 * Each round has a scale between two opposites and a hidden target.
 * The clue-giver sees the target and gives a clue; the other player
 * sets the dial. Closer is more points (4, 3 or 2). Six rounds, taking
 * turns giving the clue. The database keeps the targets and only shows
 * one to the clue-giver until the round is guessed.
 * Uses play.js and versus.js (versusDuel, versusBody, versusEl...).
 */
const DIAL_ROUNDS =
  6;

const DIAL_BANDS = [
  { points: 2, reach: 20 },
  { points: 3, reach: 12 },
  { points: 4, reach: 4 }
];


function dialState(duel = versusDuel) {
  return duel?.dial || { round: 1, total: 0, rounds: [] };
}


// The round being played now (not yet guessed), if any.
function dialCurrent(duel = versusDuel) {
  const dial =
    dialState(duel);

  return dial.round <= DIAL_ROUNDS
    ? dial.rounds.find(round => round.round === dial.round)
    : null;
}


function dialIsMyTurn(round) {
  if (!round) {
    return false;
  }

  return round.my_clue ? !round.clue : Boolean(round.clue) && round.guess === null;
}


function dialRating(total, finishedRounds) {
  if (finishedRounds < DIAL_ROUNDS) {
    return "Ended after " + finishedRounds + (finishedRounds === 1 ? " round" : " rounds");
  }

  if (total >= 24) return "Perfect wavelength! 🤯";
  if (total >= 18) return "Totally in sync 🎯";
  if (total >= 12) return "Pretty close 👌";
  if (total >= 6) return "Getting there 🙂";
  return "Opposite brains 😅";
}


// Short text for the Play tab list.
function dialSummary(duel) {
  const name =
    friendName(duel.opponent);

  const dial =
    dialState(duel);

  const current =
    dialCurrent(duel);

  if (duel.status === "pending" && !duel.is_challenger) {
    return { title: name + " wants to play Dial In", sub: "Dial In · read each other's minds", action: "accept" };
  }

  if (duel.status === "pending") {
    return {
      title: "Waiting for " + name,
      sub: "Dial In · they haven't accepted",
      button: current && !current.clue ? "Play" : "Open"
    };
  }

  if (duel.status === "active" && current) {
    const mine =
      dialIsMyTurn(current);

    const step =
      current.my_clue
        ? current.clue ? "they're guessing" : "give a clue"
        : current.clue ? "make your guess" : "they're writing a clue";

    return {
      title: (mine ? "Your turn with " : "Waiting for ") + name,
      sub: "Dial In · round " + dial.round + " of " + DIAL_ROUNDS + " · " + step + " · " + dial.total + " pts",
      button: mine ? "Play" : "Open"
    };
  }

  if (duel.status === "finished") {
    const played =
      dial.rounds.filter(round => round.guess !== null).length;

    return {
      title: "🎯 Dial In with " + name,
      sub: "Team score " + dial.total + " / " + DIAL_ROUNDS * 4 + " · " + dialRating(dial.total, played),
      button: "See",
      secondary: true
    };
  }

  return { title: duelOutcomeText(duel), sub: "Dial In", button: "See", secondary: true };
}


// Header line for the other player.
function dialOpponentStatus(duel) {
  const current =
    dialCurrent(duel);

  if (duel.status === "finished") {
    return "Team score " + dialState(duel).total;
  }

  if (duel.status === "pending" && duel.is_challenger) {
    return "Hasn't accepted yet";
  }

  if (!current) {
    return "";
  }

  if (!current.my_clue && !current.clue) {
    return "Writing a clue…";
  }

  if (current.my_clue && current.clue) {
    return "Guessing…";
  }

  return "Waiting for you";
}


// The scale: two ends, the scoring bands (when you can see the target),
// the target line and the guess needle.
function dialMeter(round, { interactive = false, value = 50 } = {}) {
  const meter =
    versusEl("div", "dial-meter");

  const track =
    versusEl("div", "dial-track");

  if (round.target !== null && round.target !== undefined) {
    for (const band of DIAL_BANDS) {
      const from = Math.max(0, round.target - band.reach);
      const to = Math.min(100, round.target + band.reach);
      const el = versusEl("i", "dial-band p" + band.points);

      el.style.left = from + "%";
      el.style.width = (to - from) + "%";
      el.title = band.points + " points";
      track.appendChild(el);
    }

    const target =
      versusEl("i", "dial-target");

    target.style.left = round.target + "%";
    track.appendChild(target);
  }

  const shownGuess =
    interactive ? value : round.guess;

  if (shownGuess !== null && shownGuess !== undefined) {
    const needle =
      versusEl("i", "dial-needle");

    needle.id = interactive ? "dialNeedle" : "";
    needle.style.left = shownGuess + "%";
    track.appendChild(needle);
  }

  if (interactive) {
    const slider =
      versusEl("input", "dial-slider");

    slider.type = "range";
    slider.min = 0;
    slider.max = 100;
    slider.value = value;
    slider.id = "dialSlider";
    slider.setAttribute("aria-label", "Move the dial between " + round.left + " and " + round.right);
    slider.addEventListener("input", () => {
      document.getElementById("dialNeedle").style.left = slider.value + "%";
    });
    track.appendChild(slider);
  }

  const ends =
    versusEl("div", "dial-ends");

  ends.append(versusEl("span", "", "← " + round.left), versusEl("span", "", round.right + " →"));

  meter.append(track, ends);
  return meter;
}


function renderDial() {
  const duel =
    versusDuel;

  const dial =
    dialState(duel);

  const body =
    versusBody();

  versusRound = { key: dialKey(duel) };

  body.replaceChildren();

  const finished =
    duel.status === "finished";

  const guessed =
    dial.rounds.filter(round => round.guess !== null);

  // The last round's result (or every round at the end).
  const shown =
    finished ? guessed : guessed.slice(-1);

  if (finished) {
    const done =
      versusEl("div", "duel-result versus-result");

    done.append(
      versusEl("span", "versus-big", dial.total + " / " + DIAL_ROUNDS * 4),
      versusEl("b", "", dialRating(dial.total, guessed.length))
    );

    const again =
      versusEl("button", "play-go", "Play again");

    again.type = "button";
    again.id = "versusRematchButton";
    again.addEventListener("click", () => {
      const opponent = duel.opponent;
      closeVersusScreen(true);
      challengeFriend(opponent, "dial_in");
    });

    done.appendChild(again);
    body.appendChild(done);
  }

  for (const round of shown) {
    const card =
      versusEl("div", "dial-card dial-result p" + round.points);

    const head =
      versusEl("div", "dial-card-head");

    head.append(
      versusEl("span", "", "Round " + round.round + " · " + (round.my_clue ? "your clue" : friendName(duel.opponent) + "'s clue")),
      versusEl("b", "dial-points", round.points === 4 ? "🎯 4 pts" : round.points + " pts")
    );

    card.append(head, versusEl("b", "dial-clue", "“" + round.clue + "”"), dialMeter(round));
    body.appendChild(card);
  }

  const current =
    dialCurrent(duel);

  if (!finished && current) {
    body.appendChild(renderDialRound(current));
  }

  // Quick rules until the first round is done.
  if (!finished && !guessed.length) {
    const rules =
      versusEl("ul", "versus-rules");

    for (const rule of VERSUS_RULES.dial_in) {
      rules.appendChild(versusEl("li", "", rule));
    }

    body.appendChild(rules);
  }

  renderVersusHeader();

  if (!finished) {
    versusPollTimer = setInterval(pollDial, 2500);
  }
}


function renderDialRound(round) {
  const duel =
    versusDuel;

  const card =
    versusEl("div", "dial-card dial-now");

  const head =
    versusEl("div", "dial-card-head");

  head.append(
    versusEl("span", "", "Round " + round.round + " of " + DIAL_ROUNDS),
    versusEl("b", "round-tag", round.my_clue ? "You give the clue" : "You guess")
  );

  card.appendChild(head);

  const status =
    versusEl("p", "duel-message", "");

  status.id = "dialStatus";

  if (round.my_clue && !round.clue) {
    const tip =
      versusEl("p", "dial-tip");

    tip.append(
      "The target is the green spot. Give a clue that sits right there between ",
      versusEl("b", "", round.left),
      " and ",
      versusEl("b", "", round.right),
      "."
    );

    const form =
      versusEl("form", "meld-form");

    const input =
      versusEl("input", "meld-input");

    input.id = "dialClueInput";
    input.maxLength = 40;
    input.autocomplete = "off";
    input.enterKeyHint = "send";
    input.placeholder = "Your clue";
    input.setAttribute("aria-label", "Your clue");

    const send =
      versusEl("button", "play-go", "Send clue");

    send.type = "submit";
    form.append(input, send);
    form.addEventListener("submit", event => {
      event.preventDefault();
      sendDialClue();
    });

    card.append(tip, dialMeter(round), form, status);
  } else if (round.my_clue) {
    status.textContent = "Waiting for " + friendName(duel.opponent) + " to guess…";
    card.append(versusEl("b", "dial-clue", "“" + round.clue + "”"), dialMeter(round), status);
  } else if (!round.clue) {
    status.textContent = "Waiting for " + friendName(duel.opponent) + "'s clue…";
    card.append(dialMeter(round), status);
  } else {
    const lock =
      versusEl("button", "play-go big", "Lock it in");

    lock.type = "button";
    lock.id = "dialLockButton";
    lock.addEventListener("click", sendDialGuess);

    card.append(
      versusEl("p", "dial-tip", "Slide the dial to where you think the clue fits."),
      versusEl("b", "dial-clue", "“" + round.clue + "”"),
      dialMeter(round, { interactive: true }),
      lock,
      status
    );
  }

  return card;
}


// What has to change for the screen to be redrawn (so typing or
// sliding isn't interrupted by the regular check-in).
function dialKey(duel) {
  const current =
    dialCurrent(duel);

  return [
    duel.status,
    dialState(duel).round,
    current?.clue ? 1 : 0,
    current?.guess ?? "-"
  ].join("|");
}


async function pollDial() {
  const duel =
    versusDuel;

  if (!duel || duel.game !== "dial_in") {
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
    } else if (dialKey(fresh) !== versusRound?.key) {
      stopVersusTimers();
      renderDial();
    } else {
      renderVersusHeader();
    }
  } catch (error) {
    // Try again next time.
  }
}


function dialMessage(text) {
  const status =
    document.getElementById("dialStatus");

  if (status) {
    status.textContent = text;
    status.dataset.tone = "bad";
  }
}


async function sendDialClue() {
  const input =
    document.getElementById("dialClueInput");

  const clue =
    input.value.trim();

  if (!clue) {
    dialMessage("Type a clue first.");
    return;
  }

  try {
    versusDuel =
      await playRpc("dial_clue", { p_duel: versusDuel.id, p_clue: clue });

    stopVersusTimers();
    renderDial();
  } catch (error) {
    dialMessage(error.message || "The clue didn't go through.");
  }
}


async function sendDialGuess() {
  const slider =
    document.getElementById("dialSlider");

  const button =
    document.getElementById("dialLockButton");

  button.disabled = true;

  try {
    versusDuel =
      await playRpc("dial_guess", { p_duel: versusDuel.id, p_guess: Number(slider.value) });

    stopVersusTimers();
    renderDial();
  } catch (error) {
    button.disabled = false;
    dialMessage(error.message || "The guess didn't go through.");
  }
}
