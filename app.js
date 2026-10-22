// Daily Game Hub app script (moved from index.html)

const SUPABASE_URL =
  "https://ibffwmegxjymmulfgoqu.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_v-YaLSlXnipQLhgN5-lHcw_ovmUbwvU";

const TODAY =
  new Date().toLocaleDateString("en-CA");

const COMPLETED_KEY =
  "dailyGameHubCompleted-" + TODAY;

const FAVORITES_KEY =
  "dailyGameHubFavorites";

const SESSION_KEY =
  "dailyGameHubSession";

const GAME_ORDER_KEY =
  "dailyGameHubOrder";

const ACTIVE_FILTER_KEY =
  "dailyGameHubActiveFilter";

const SCROLL_GAME_KEY =
  "dailyGameHubScrollGame";

const SCROLL_OFFSET_KEY =
  "dailyGameHubScrollOffset";

const SCROLL_POSITION_KEY =
  "dailyGameHubScrollPosition";

let completedGames =
  safeParse(
    localStorage.getItem(COMPLETED_KEY),
    []
  );

let favoriteGames =
  safeParse(
    localStorage.getItem(FAVORITES_KEY),
    []
  );

let session =
  safeParse(
    localStorage.getItem(SESSION_KEY),
    null
  );

let currentFilter =
  localStorage.getItem(
ACTIVE_FILTER_KEY
  ) ||
  "favorites";

let selectedFeedbackType =
  "bug";

let selectedScoreGame =
  "";

let todaysScores =
  [];

let defaultGameOrder =
  [];

let currentGameOrder =
  safeParse(
localStorage.getItem(
  GAME_ORDER_KEY
),
[]
  );

let draggedGameId =
  null;

let librarySyncTimer =
  null;

let userGameLibrary =
  [];

let gameCatalog =
  new Map();

let selectedCustomGameKey =
  null;

let onboardingSelectedGames =
  new Set();


function safeParse(
  value,
  fallback
) {
  try {
    return value
      ? JSON.parse(value)
      : fallback;
  } catch (error) {
    return fallback;
  }
}


function cards() {
  return Array.from(
    document.querySelectorAll(
      ".game-card"
    )
  );
}


function setStatus(
  element,
  message,
  type = ""
) {
  element.textContent =
    message;

  element.classList.remove(
    "success",
    "error"
  );

  if (type) {
    element.classList.add(type);
  }
}


function saveLocal() {
  localStorage.setItem(
    COMPLETED_KEY,
    JSON.stringify(completedGames)
  );

  localStorage.setItem(
    FAVORITES_KEY,
    JSON.stringify(favoriteGames)
  );
}


function publicHeaders() {
  return {
    "Content-Type":
      "application/json",

    "apikey":
      SUPABASE_KEY
  };
}


function authHeaders(
  prefer = ""
) {
  const headers = {
    "Content-Type":
      "application/json",

    "apikey":
      SUPABASE_KEY,

    "Authorization":
      "Bearer " +
      session.access_token
  };

  if (prefer) {
    headers.Prefer =
      prefer;
  }

  return headers;
}

  async function refreshSession() {
  if (
    !session ||
    !session.refresh_token
  ) {
    throw new Error(
      "Your session expired. Please log in again."
    );
  }

  const response =
    await fetch(
      SUPABASE_URL +
      "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "apikey":
            SUPABASE_KEY
        },

        body:
          JSON.stringify({
            refresh_token:
              session.refresh_token
          })
      }
    );

  const responseText =
    await response.text();

  let refreshedSession =
    null;

  try {
    refreshedSession =
      responseText
        ? JSON.parse(responseText)
        : null;
  } catch (error) {
    refreshedSession =
      null;
  }

  if (
    !response.ok ||
    !refreshedSession?.access_token
  ) {
    session = null;

    localStorage.removeItem(
      SESSION_KEY
    );

    showSessionUI();

    throw new Error(
      "Your session expired. Please log in again."
    );
  }

  session = {
    ...session,
    ...refreshedSession,

    user:
      refreshedSession.user ||
      session.user
  };

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(session)
  );

  return session;
}



async function request(
  path,
  options = {},
  allowRefresh = true
) {
  const response =
    await fetch(
      SUPABASE_URL + path,
      options
    );

  const responseText =
    await response.text();

  let responseData =
    null;

  try {
    responseData =
      responseText
        ? JSON.parse(responseText)
        : null;
  } catch (error) {
    responseData =
      responseText;
  }

  const errorMessage =
    String(
      responseData?.message ||
      responseData?.error_description ||
      responseData?.msg ||
      responseData ||
      ""
    );

  const tokenExpired =
    response.status === 401 &&
    (
      errorMessage
        .toLowerCase()
        .includes("jwt expired") ||

      errorMessage
        .toLowerCase()
        .includes("token has expired")
    );

  const isAuthenticationRequest =
    path.startsWith(
      "/auth/v1/"
    );

  if (
    tokenExpired &&
    allowRefresh &&
    !isAuthenticationRequest &&
    session?.refresh_token
  ) {
    await refreshSession();

    const retryOptions = {
      ...options,

      headers: {
        ...(options.headers || {}),

        "apikey":
          SUPABASE_KEY,

        "Authorization":
          "Bearer " +
          session.access_token
      }
    };

    return request(
      path,
      retryOptions,
      false
    );
  }

  if (!response.ok) {
    throw new Error(
      errorMessage ||
      "Request failed"
    );
  }

  return responseData;
}

function captureDefaultGameOrder() {
  defaultGameOrder =
cards().map(
  card =>
    card.dataset.id
);

  if (
!Array.isArray(
  currentGameOrder
) ||
currentGameOrder.length === 0
  ) {
currentGameOrder =
  [...defaultGameOrder];
  }
}


function normalizeGameOrder(
  savedOrder
) {
  const validGameIds =
new Set(
  defaultGameOrder
);

  const normalizedOrder =
Array.isArray(savedOrder)
  ? savedOrder.filter(
      gameId =>
        validGameIds.has(
          gameId
        )
    )
  : [];


  for (
const gameId
of defaultGameOrder
  ) {
if (
  !normalizedOrder.includes(
    gameId
  )
) {
  normalizedOrder.push(
    gameId
  );
}
  }


  return normalizedOrder;
}


function applyGameOrder(
  order
) {
  const normalizedOrder =
normalizeGameOrder(
  order
);

  const gameGrid =
document.getElementById(
  "gameGrid"
);


  normalizedOrder.forEach(
gameId => {
  const gameCard =
    document.querySelector(
      '.game-card[data-id="' +
      gameId +
      '"]'
    );

  if (gameCard) {
    gameGrid.appendChild(
      gameCard
    );
  }
}
  );


  currentGameOrder =
normalizedOrder;

  localStorage.setItem(
GAME_ORDER_KEY,
JSON.stringify(
  currentGameOrder
)
  );
}

function createCustomGameKey(
  gameName
) {
  const baseKey =
gameName
  .toLowerCase()
  .trim()
  .replace(
    /[^a-z0-9]+/g,
    "-"
  )
  .replace(
    /^-+|-+$/g,
    ""
  );

  return (
"custom-" +
session.user.id.slice(0, 8) +
"-" +
Date.now() +
"-" +
(
  baseKey ||
  "game"
)
  );
}

function getCategoryLabel(
  category
) {
  const labels = {
word: "Word & Logic",
geography: "Geography",
movies: "Movies",
sports: "Sports",
trivia: "Trivia",
other: "Other"
  };

  return (
labels[category] ||
"Other"
  );
}

function getGameName(
  gameId
) {
  const gameCard =
document.querySelector(
  '.game-card[data-id="' +
  gameId +
  '"]'
);

  return (
gameCard?.dataset.name ||
gameId
  );
}


function moveArrangeItem(
  gameId,
  direction
) {
  const currentIndex =
currentGameOrder.indexOf(
  gameId
);

  const newIndex =
currentIndex +
direction;


  if (
currentIndex < 0 ||
newIndex < 0 ||
newIndex >=
  currentGameOrder.length
  ) {
return;
  }


  const reordered =
[...currentGameOrder];

  const movedGame =
reordered.splice(
  currentIndex,
  1
)[0];

  reordered.splice(
newIndex,
0,
movedGame
  );


  currentGameOrder =
reordered;

  renderArrangeList();
}


function renderArrangeList() {
  const arrangeList =
document.getElementById(
  "arrangeList"
);

  arrangeList.innerHTML =
"";


  currentGameOrder.forEach(
(
  gameId,
  index
) => {
  const row =
    document.createElement(
      "div"
    );

  row.className =
    "arrange-item";

  row.draggable =
    true;

  row.dataset.gameId =
    gameId;


  const handle =
    document.createElement(
      "span"
    );

  handle.className =
    "arrange-handle";

  handle.textContent =
    "☰";

  handle.title =
    "Drag to rearrange";


  const gameName =
    document.createElement(
      "span"
    );

  gameName.className =
    "arrange-name";

  gameName.textContent =
    getGameName(
      gameId
    );


  const moveUpButton =
    document.createElement(
      "button"
    );

  moveUpButton.type =
    "button";

  moveUpButton.className =
    "arrange-move";

  moveUpButton.textContent =
    "↑";

  moveUpButton.disabled =
    index === 0;

  moveUpButton.setAttribute(
    "aria-label",
    "Move " +
    getGameName(gameId) +
    " up"
  );

  moveUpButton.addEventListener(
    "click",
    () => {
      moveArrangeItem(
        gameId,
        -1
      );
    }
  );


  const moveDownButton =
    document.createElement(
      "button"
    );

  moveDownButton.type =
    "button";

  moveDownButton.className =
    "arrange-move";

  moveDownButton.textContent =
    "↓";

  moveDownButton.disabled =
    index ===
    currentGameOrder.length -
    1;

  moveDownButton.setAttribute(
    "aria-label",
    "Move " +
    getGameName(gameId) +
    " down"
  );

  moveDownButton.addEventListener(
    "click",
    () => {
      moveArrangeItem(
        gameId,
        1
      );
    }
  );


  row.addEventListener(
    "dragstart",
    event => {
      draggedGameId =
        gameId;

      row.classList.add(
        "dragging"
      );

      event.dataTransfer
        .setData(
          "text/plain",
          gameId
        );

      event.dataTransfer
        .effectAllowed =
          "move";
    }
  );


  row.addEventListener(
    "dragend",
    () => {
      draggedGameId =
        null;

      row.classList.remove(
        "dragging"
      );

      document
        .querySelectorAll(
          ".arrange-item"
        )
        .forEach(item => {
          item.classList.remove(
            "dragging"
          );
        });
    }
  );


  row.addEventListener(
    "dragover",
    event => {
      event.preventDefault();

      event.dataTransfer
        .dropEffect =
          "move";
    }
  );


  row.addEventListener(
    "drop",
    event => {
      event.preventDefault();

      const droppedGameId =
        row.dataset.gameId;

      const sourceGameId =
        draggedGameId ||
        event.dataTransfer
          .getData(
            "text/plain"
          );


      if (
        !sourceGameId ||
        sourceGameId ===
          droppedGameId
      ) {
        return;
      }


      const sourceIndex =
        currentGameOrder
          .indexOf(
            sourceGameId
          );

      const targetIndex =
        currentGameOrder
          .indexOf(
            droppedGameId
          );


      if (
        sourceIndex < 0 ||
        targetIndex < 0
      ) {
        return;
      }


      const reordered =
        [...currentGameOrder];

      const movedGame =
        reordered.splice(
          sourceIndex,
          1
        )[0];

      reordered.splice(
        targetIndex,
        0,
        movedGame
      );


      currentGameOrder =
        reordered;

      renderArrangeList();
    }
  );


  row.append(
    handle,
    gameName,
    moveUpButton,
    moveDownButton
  );

  arrangeList.appendChild(
    row
  );
}
  );
}




async function loadUserGameLibrary() {
  if (!session) {
return;
  }

  try {
userGameLibrary =
  await request(
    "/rest/v1/user_games" +
    "?user_id=eq." +
    encodeURIComponent(
      session.user.id
    ) +
    "&select=" +
    "game_key," +
    "is_visible," +
    "is_favorite," +
    "sort_order" +
    "&order=sort_order.asc",
    {
      headers:
        authHeaders()
    }
  ) || [];

   if (
  userGameLibrary.length === 0
) {
  const onboardingModal =
document.getElementById(
  "onboardingModal"
);


  /*
   * Only initialize onboarding
   * the first time it opens.
   *
   * Do not clear selections during
   * background syncs.
   */
  if (
!onboardingModal
  .classList
  .contains("open")
  ) {
onboardingSelectedGames =
  new Set();


renderOnboardingGames();


document
  .getElementById(
    "selectAllGamesButton"
  )
  .textContent =
    "Select All";


setStatus(
  onboardingStatus,
  ""
);


onboardingModal
  .classList
  .add("open");
  }


  return;
}

favoriteGames =
  userGameLibrary
.filter(
  game =>
    game.is_favorite
)
.map(
  game =>
    game.game_key
);


localStorage.setItem(
  FAVORITES_KEY,
  JSON.stringify(
favoriteGames
  )
);

currentGameOrder =
  userGameLibrary
.filter(
  game =>
    game.is_visible
)
.sort(
  (
    firstGame,
    secondGame
  ) =>
    Number(
      firstGame.sort_order
    ) -
    Number(
      secondGame.sort_order
    )
)
.map(
  game =>
    game.game_key
);


cards().forEach(card => {
  const gameId =
card.dataset.id;

  const libraryGame =
userGameLibrary.find(
  game =>
    game.game_key ===
    gameId
);

  if (
libraryGame?.is_visible &&
!currentGameOrder.includes(
  gameId
)
  ) {
currentGameOrder.push(
  gameId
);
  }
});


localStorage.setItem(
  GAME_ORDER_KEY,
  JSON.stringify(
currentGameOrder
  )
);


applyGameOrder(
  currentGameOrder
);

applyUserGameVisibility();
renderManageGames();
updateLocalUI();

  } catch (error) {
console.error(
  "Game library loading failed:",
  error
);
  }
}

async function syncUserGameLibrary() {
  if (!session) {
return;
  }


  const onboardingOpen =
document
  .getElementById(
    "onboardingModal"
  )
  .classList
  .contains("open");


  if (onboardingOpen) {
return;
  }


  const arrangeModalOpen =
document
  .getElementById(
    "arrangeModal"
  )
  .classList
  .contains("open");


  if (arrangeModalOpen) {
return;
  }


  /*
   * Remember which game is currently
   * visible before the library sync
   * rearranges the DOM.
   */
  saveCurrentGamePosition();


  await loadUserGameLibrary();


  /*
   * Put the user back on the same
   * game after the DOM has updated.
   */
  requestAnimationFrame(
() => {
  requestAnimationFrame(
    () => {
      restoreGamePosition();
    }
  );
}
  );


  if (
document
  .getElementById(
    "manageGamesModal"
  )
  .classList
  .contains("open")
  ) {
renderManageGames();
  }
}

function startLibrarySync() {
  if (librarySyncTimer) {
clearInterval(
  librarySyncTimer
);
  }


  if (!session) {
librarySyncTimer =
  null;

return;
  }


  librarySyncTimer =
setInterval(
  () => {
    if (
      document.visibilityState ===
      "visible"
    ) {
      syncUserGameLibrary();
    }
  },
  5000
);
}

function applyUserGameVisibility() {
  if (
!session ||
userGameLibrary.length === 0
  ) {
return;
  }

  const visibleGames =
new Set(
  userGameLibrary
    .filter(
      game =>
        game.is_visible
    )
    .map(
      game =>
        game.game_key
    )
);

  cards().forEach(card => {
card.dataset.userVisible =
  visibleGames.has(
    card.dataset.id
  )
    ? "true"
    : "false";
  });
}

 async function setGameVisibility(
  gameId,
  isVisible
) {
  if (!session) {
return;
  }


  try {
const existingLibraryGame =
  userGameLibrary.find(
    game =>
      game.game_key ===
      gameId
  );


/*
 * ADD A GAME THAT DOESN'T
 * HAVE A user_games ROW YET.
 */
if (
  isVisible &&
  !existingLibraryGame
) {
  const highestSortOrder =
    userGameLibrary.reduce(
      (
        highest,
        game
      ) =>
        Math.max(
          highest,
          Number(
            game.sort_order
          ) || 0
        ),
      0
    );


  await request(
    "/rest/v1/user_games",
    {
      method:
        "POST",

      headers:
        authHeaders(
          "return=minimal"
        ),

      body:
        JSON.stringify({
          user_id:
            session.user.id,

          game_key:
            gameId,

          is_visible:
            true,

          is_favorite:
            false,

          sort_order:
            highestSortOrder + 1
        })
    }
  );


  await loadUserGameLibrary();


  setStatus(
    manageGamesStatus,
    "Game added to the bottom.",
    "success"
  );


  return;
}


/*
 * EXISTING LIBRARY GAME.
 */
let newSortOrder =
  null;


if (isVisible) {
  const highestSortOrder =
    userGameLibrary.reduce(
      (
        highest,
        game
      ) =>
        Math.max(
          highest,
          Number(
            game.sort_order
          ) || 0
        ),
      0
    );


  newSortOrder =
    highestSortOrder + 1;
}


const updateRecord = {
  is_visible:
    isVisible
};


if (
  newSortOrder !== null
) {
  updateRecord.sort_order =
    newSortOrder;
}


await request(
  "/rest/v1/user_games" +
  "?user_id=eq." +
  encodeURIComponent(
    session.user.id
  ) +
  "&game_key=eq." +
  encodeURIComponent(
    gameId
  ),
  {
    method:
      "PATCH",

    headers:
      authHeaders(
        "return=minimal"
      ),

    body:
      JSON.stringify(
        updateRecord
      )
  }
);


await loadUserGameLibrary();


setStatus(
  manageGamesStatus,
  isVisible
    ? "Game added to the bottom."
    : "Game removed.",
  "success"
);


  } catch (error) {
setStatus(
  manageGamesStatus,
  error.message,
  "error"
);
  }
}

function renderOnboardingGames() {
  const container =
document.getElementById(
  "onboardingGames"
);


  if (!container) {
return;
  }


  container.innerHTML =
"";


  const catalogGames =
Array.from(
  gameCatalog.values()
)
  .filter(
    game =>
      game.is_official
  );


  catalogGames.forEach(
game => {
  const row =
    document.createElement(
      "label"
    );

  row.className =
    "onboarding-game";


  const checkbox =
    document.createElement(
      "input"
    );

  checkbox.type =
    "checkbox";

  checkbox.className =
    "onboarding-checkbox";

  checkbox.value =
    game.game_key;

  checkbox.checked =
    onboardingSelectedGames.has(
      game.game_key
    );


  const info =
    document.createElement(
      "div"
    );

  info.className =
    "onboarding-game-info";


  const name =
    document.createElement(
      "div"
    );

  name.className =
    "onboarding-game-name";

  name.textContent =
    game.name;


  const category =
    document.createElement(
      "div"
    );

  category.className =
    "onboarding-game-category";

  category.textContent =
    getCategoryLabel(
      game.category
    );


  info.append(
    name,
    category
  );


  checkbox.addEventListener(
    "change",
    () => {
      if (checkbox.checked) {
        onboardingSelectedGames.add(
          game.game_key
        );
      } else {
        onboardingSelectedGames.delete(
          game.game_key
        );
      }


      row.classList.toggle(
        "selected",
        checkbox.checked
      );
    }
  );


  row.classList.toggle(
    "selected",
    checkbox.checked
  );


  row.append(
    checkbox,
    info
  );


  container.appendChild(
    row
  );
}
  );
}

function selectAllOnboardingGames() {
  const officialGames =
Array.from(
  gameCatalog.values()
)
  .filter(
    game =>
      game.is_official
  );


  if (
onboardingSelectedGames.size ===
officialGames.length
  ) {
onboardingSelectedGames.clear();
  } else {
onboardingSelectedGames =
  new Set(
    officialGames.map(
      game =>
        game.game_key
    )
  );
  }


  renderOnboardingGames();


  document
.getElementById(
  "selectAllGamesButton"
)
.textContent =
  onboardingSelectedGames.size ===
    officialGames.length
    ? "Clear All"
    : "Select All";
}

async function finishGameOnboarding() {
  if (!session) {
return;
  }


  const selectedGames =
Array.from(
  onboardingSelectedGames
);


  if (
selectedGames.length === 0
  ) {
setStatus(
  onboardingStatus,
  "Choose at least one game.",
  "error"
);

return;
  }


  try {
setStatus(
  onboardingStatus,
  "Setting up your games..."
);


const libraryRows =
  selectedGames.map(
    (
      gameKey,
      index
    ) => ({
      user_id:
        session.user.id,

      game_key:
        gameKey,

      is_visible:
        true,

      is_favorite:
        false,

      sort_order:
        index + 1
    })
  );


await request(
  "/rest/v1/user_games",
  {
    method: "POST",

    headers:
      authHeaders(
        "return=minimal"
      ),

    body:
      JSON.stringify(
        libraryRows
      )
  }
);


onboardingSelectedGames.clear();


await loadUserGameLibrary();


document
  .getElementById(
    "onboardingModal"
  )
  .classList
  .remove("open");


setStatus(
  onboardingStatus,
  ""
);


  } catch (error) {
setStatus(
  onboardingStatus,
  error.message,
  "error"
);
  }
}

function renderManageGames() {
  const myGamesList =
document.getElementById(
  "myGamesList"
);

  const availableGamesList =
document.getElementById(
  "availableGamesList"
);


  if (
!myGamesList ||
!availableGamesList
  ) {
return;
  }


  myGamesList.innerHTML =
"";

  availableGamesList.innerHTML =
"";


  /*
   * USE THE FULL CATALOG,
   * NOT ONLY user_games.
   */
  const catalogGames =
Array.from(
  gameCatalog.values()
);


  catalogGames.forEach(
catalogGame => {
  const libraryGame =
    userGameLibrary.find(
      game =>
        game.game_key ===
        catalogGame.game_key
    );


  const isVisible =
    Boolean(
      libraryGame?.is_visible
    );


  const row =
    document.createElement(
      "div"
    );

  row.className =
    "manage-game";


  const info =
    document.createElement(
      "div"
    );

  info.className =
    "manage-game-info";


  const name =
    document.createElement(
      "div"
    );

  name.className =
    "manage-game-name";

  name.textContent =
    catalogGame.name;


  const category =
    document.createElement(
      "div"
    );

  category.className =
    "manage-game-category";

  category.textContent =
    getCategoryLabel(
      catalogGame.category
    );


  info.append(
    name,
    category
  );


  const actionContainer =
    document.createElement(
      "div"
    );

  actionContainer.className =
    "friend-actions";


  /*
   * CUSTOM GAME CREATOR
   * GETS EDIT.
   */
  if (
    !catalogGame.is_official &&
    catalogGame.created_by ===
      session?.user?.id
  ) {
    const editButton =
      document.createElement(
        "button"
      );

    editButton.type =
      "button";

    editButton.className =
      "small-button";

    editButton.textContent =
      "Edit";


    editButton.addEventListener(
      "click",
      () => {
        openCustomGameEditor(
          catalogGame.game_key
        );
      }
    );


    actionContainer.appendChild(
      editButton
    );
  }


  const actionButton =
    document.createElement(
      "button"
    );

  actionButton.type =
    "button";

  actionButton.className =
    "manage-game-button " +
    (
      isVisible
        ? "remove"
        : "add"
    );


  actionButton.textContent =
    isVisible
      ? "Remove"
      : "+ Add";


  actionButton.addEventListener(
    "click",
    () => {
      setGameVisibility(
        catalogGame.game_key,
        !isVisible
      );
    }
  );


  actionContainer.appendChild(
    actionButton
  );


  row.append(
    info,
    actionContainer
  );


  if (isVisible) {
    myGamesList.appendChild(
      row
    );
  } else {
    availableGamesList
      .appendChild(
        row
      );
  }
}
  );


  if (
myGamesList.children.length ===
0
  ) {
myGamesList.innerHTML =
  '<p class="status">' +
  "You have not added any games yet." +
  "</p>";
  }


  if (
availableGamesList
  .children
  .length === 0
  ) {
availableGamesList.innerHTML =
  '<p class="status">' +
  "All available games are already in your library." +
  "</p>";
  }
}


async function saveGameOrder() {
  applyGameOrder(
currentGameOrder
  );


  localStorage.setItem(
GAME_ORDER_KEY,
JSON.stringify(
  currentGameOrder
)
  );


  if (!session) {
setStatus(
  arrangeStatus,
  "Order saved on this device.",
  "success"
);

return;
  }


  try {
setStatus(
  arrangeStatus,
  "Saving game order..."
);


for (
  let index = 0;
  index <
    currentGameOrder.length;
  index += 1
) {
  const gameId =
    currentGameOrder[index];


  await request(
    "/rest/v1/user_games" +
    "?user_id=eq." +
    encodeURIComponent(
      session.user.id
    ) +
    "&game_key=eq." +
    encodeURIComponent(
      gameId
    ),
    {
      method: "PATCH",

      headers:
        authHeaders(
          "return=minimal"
        ),

      body:
        JSON.stringify({
          sort_order:
            index + 1
        })
    }
  );


  const libraryGame =
    userGameLibrary.find(
      game =>
        game.game_key ===
        gameId
    );


  if (libraryGame) {
    libraryGame.sort_order =
      index + 1;
  }
}


setStatus(
  arrangeStatus,
  "Game order saved.",
  "success"
);

  } catch (error) {
setStatus(
  arrangeStatus,
  error.message,
  "error"
);
  }
}

   async function saveFavoriteState(
  gameId,
  isFavorite
) {
  localStorage.setItem(
FAVORITES_KEY,
JSON.stringify(
  favoriteGames
)
  );


  if (!session) {
return;
  }


  try {
await request(
  "/rest/v1/user_games" +
  "?user_id=eq." +
  encodeURIComponent(
    session.user.id
  ) +
  "&game_key=eq." +
  encodeURIComponent(
    gameId
  ),
  {
    method:
      "PATCH",

    headers:
      authHeaders(
        "return=minimal"
      ),

    body:
      JSON.stringify({
        is_favorite:
          isFavorite
      })
  }
);


const libraryGame =
  userGameLibrary.find(
    game =>
      game.game_key ===
      gameId
  );


if (libraryGame) {
  libraryGame.is_favorite =
    isFavorite;
}

  } catch (error) {
console.error(
  "Favorite sync failed:",
  error
);
  }
}



function getFilterLabel() {
  const labels = {
    all: "All Games",
    favorites: "Favorites",
    word: "Word & Logic",
    geography: "Geography",
    movies: "Movies",
    sports: "Sports",
    trivia: "Trivia",
    unfinished: "Not Played",
    completed: "Played"
  };

  return labels[currentFilter] || "Games";
}


function getScopedCards() {
  const searchValue =
    document
      .getElementById(
        "searchInput"
      )
      .value
      .trim()
      .toLowerCase();

  const categoryFilters = [
    "word",
    "geography",
    "movies",
    "sports",
    "trivia"
  ];

  return cards().filter(card => {
    const gameId =
      card.dataset.id;

    const category =
      card.dataset.category;

    const searchText =
      card.dataset.search
        .toLowerCase();

    let included =
      searchText.includes(
        searchValue
      );

    if (
  session &&
  card.dataset.userVisible ===
"false"
) {
  included = false;
}

    if (
      categoryFilters.includes(
        currentFilter
      ) &&
      category !== currentFilter
    ) {
      included = false;
    }

    if (
      currentFilter ===
        "favorites" &&
      !favoriteGames.includes(
        gameId
      )
    ) {
      included = false;
    }

    if (
      currentFilter ===
        "completed" &&
      !completedGames.includes(
        gameId
      )
    ) {
      included = false;
    }

    if (
      currentFilter ===
        "unfinished" &&
      completedGames.includes(
        gameId
      )
    ) {
      included = false;
    }

    return included;
  });
}


function updateProgress() {
  const scopedCards =
    getScopedCards();

  const totalGames =
    scopedCards.length;

  const playedCount =
    scopedCards.filter(card =>
      completedGames.includes(
        card.dataset.id
      )
    ).length;

  const percentage =
    totalGames === 0
      ? 0
      : Math.round(
          playedCount /
          totalGames *
          100
        );

  document
    .querySelector(
      ".eyebrow"
    )
    .textContent =
      "TODAY · " +
      getFilterLabel()
        .toUpperCase();

  document
    .getElementById(
      "progressCount"
    )
    .textContent =
      playedCount +
      " of " +
      totalGames +
      " played today";

  document
    .getElementById(
      "percentage"
    )
    .textContent =
      percentage + "%";

  document
    .getElementById(
      "progressFill"
    )
    .style
    .width =
      percentage + "%";
}


function updateLocalUI() {
  cards().forEach(card => {
    const gameId =
      card.dataset.id;

    card.classList.toggle(
      "completed",
      completedGames.includes(
        gameId
      )
    );

    const favoriteButton =
      card.querySelector(
        ".favorite-button"
      );

    favoriteButton.classList.toggle(
      "favorite",
      favoriteGames.includes(
        gameId
      )
    );
  });

  applyFilters();
  updateProgress();
}

/*
 * Read the search box. Browsers and password managers sometimes
 * put a saved email in it, which hid every game; game names never
 * contain "@", so a value like that is cleared instead of used.
 */
function currentSearchText() {
  const input =
    document.getElementById("searchInput");

  if (input.value.includes("@")) {
    input.value = "";
  }

  document
    .getElementById("clearSearchButton")
    .classList
    .toggle("hidden", input.value === "");

  return input.value.trim();
}


function applyFilters() {
  const searchValue =
    currentSearchText()
      .toLowerCase();

  const categoryFilters = [
    "word",
    "geography",
    "movies",
    "sports",
    "trivia"
  ];

  let visibleCount =
    0;

  cards().forEach(card => {
    const gameId =
      card.dataset.id;

    const category =
      card.dataset.category;

    const searchText =
      card.dataset.search
        .toLowerCase();

    let visible =
      searchText.includes(
        searchValue
      );

    if (
  session &&
  card.dataset.userVisible ===
"false"
) {
  visible = false;
}

    if (
      categoryFilters.includes(
        currentFilter
      ) &&
      category !== currentFilter
    ) {
      visible = false;
    }

    if (
      currentFilter ===
        "favorites" &&
      !favoriteGames.includes(
        gameId
      )
    ) {
      visible = false;
    }

    if (
      currentFilter ===
        "completed" &&
      !completedGames.includes(
        gameId
      )
    ) {
      visible = false;
    }

    if (
      currentFilter ===
        "unfinished" &&
      completedGames.includes(
        gameId
      )
    ) {
      visible = false;
    }

    card.style.display =
      visible
        ? "flex"
        : "none";

    if (visible) {
      visibleCount += 1;
    }
  });

  const emptyMessage =
    document.getElementById(
      "emptyMessage"
    );

  emptyMessage.style.display =
    visibleCount > 0
      ? "none"
      : "block";

  emptyMessage.textContent =
    searchValue
      ? "No games match “" + currentSearchText() + "”. Tap ✕ in the search box to see your games."
      : "No games match your search or selected filter.";
}

document
  .querySelectorAll(
"[data-complete]"
  )
  .forEach(button => {
button.addEventListener(
  "click",
  () => {
    toggleGameCompleted(
      button.dataset.complete
    );
  }
);
  });



document
  .querySelectorAll(
"[data-favorite]"
  )
  .forEach(button => {
button.addEventListener(
  "click",
  async () => {
    const gameId =
      button.dataset.favorite;


    const becomingFavorite =
      !favoriteGames.includes(
        gameId
      );


    if (becomingFavorite) {
      favoriteGames.push(
        gameId
      );
    } else {
      favoriteGames =
        favoriteGames.filter(
          id =>
            id !== gameId
        );
    }


    saveLocal();

    updateLocalUI();


    await saveFavoriteState(
      gameId,
      becomingFavorite
    );
  }
);
  });


document
  .querySelectorAll(
    "[data-filter]"
  )
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        currentFilter =
          button.dataset.filter;

        localStorage.setItem(
  ACTIVE_FILTER_KEY,
  currentFilter
);

        document
          .querySelectorAll(
            "[data-filter]"
          )
          .forEach(
            filterButton => {
              filterButton
                .classList
                .toggle(
                  "active",
                  filterButton ===
                    button
                );
            }
          );

        updateLocalUI();
      }
    );
  });


document
  .getElementById(
"searchInput"
  )
  .addEventListener(
"input",
updateLocalUI
  );

document
  .getElementById("clearSearchButton")
  .addEventListener(
    "click",
    () => {
      const input =
        document.getElementById("searchInput");

      input.value = "";
      updateLocalUI();
      input.focus();
    }
  );


document
  .getElementById(
    "randomButton"
  )
  .addEventListener(
    "click",
    () => {
      let availableCards =
        cards().filter(
          card =>
            !completedGames.includes(
              card.dataset.id
            )
        );

      if (
        availableCards.length === 0
      ) {
        availableCards =
          cards();
      }

      if (
        availableCards.length === 0
      ) {
        return;
      }

      const randomCard =
        availableCards[
          Math.floor(
            Math.random() *
            availableCards.length
          )
        ];

      const playLink =
        randomCard.querySelector(
          ".play-button"
        );

      if (playLink) {
        playLink.click();
      }
    }
  );


document
  .querySelectorAll(
    "[data-close]"
  )
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        document
          .getElementById(
            button.dataset.close
          )
          .classList
          .remove("open");
      }
    );
  });


document
  .getElementById(
    "accountLoginButton"
  )
  .addEventListener(
    "click",
    () => {
      document
        .getElementById(
          "accountModal"
        )
        .classList
        .add("open");
    }
  );

document
  .getElementById(
"homeLoginButton"
  )
  .addEventListener(
"click",
() => {
  document
    .getElementById(
      "accountModal"
    )
    .classList
    .add("open");
}
  );



document
  .getElementById(
"arrangeGamesButton"
  )
  .addEventListener(
"click",
() => {
  renderArrangeList();

  setStatus(
    arrangeStatus,
    ""
  );

  document
    .getElementById(
      "arrangeModal"
    )
    .classList
    .add("open");
}
  );

   document
  .getElementById(
"manageGamesButton"
  )
  .addEventListener(
"click",
() => {
  if (!session) {
    document
      .getElementById(
        "accountModal"
      )
      .classList
      .add("open");

    setStatus(
      authStatus,
      "Log in to manage your games.",
      "error"
    );

    return;
  }

  renderManageGames();

  setStatus(
    manageGamesStatus,
    ""
  );

  document
    .getElementById(
      "manageGamesModal"
    )
    .classList
    .add("open");
}
  );


document
  .getElementById(
"openAddGameButton"
  )
  .addEventListener(
"click",
() => {
  selectedCustomGameKey =
    null;

  document
    .getElementById(
      "customGameModalTitle"
    )
    .textContent =
      "Add Custom Game";

  document
    .getElementById(
      "saveCustomGameButton"
    )
    .textContent =
      "Add Game";

  document
    .getElementById(
      "customGameName"
    )
    .value = "";

  document
    .getElementById(
      "customGameUrl"
    )
    .value = "";

  document
    .getElementById(
      "customGameCategory"
    )
    .value =
      "word";

  document
    .getElementById(
      "customGameIcon"
    )
    .value = "";

  document
    .getElementById(
      "customGameDescription"
    )
    .value = "";

  setStatus(
    addGameStatus,
    ""
  );

  document
    .getElementById(
      "addGameModal"
    )
    .classList
    .add("open");
}
  );


document
  .getElementById(
"saveCustomGameButton"
  )
  .addEventListener(
"click",
createCustomGame
  );

document
  .getElementById(
"selectAllGamesButton"
  )
  .addEventListener(
"click",
selectAllOnboardingGames
  );


document
  .getElementById(
"finishOnboardingButton"
  )
  .addEventListener(
"click",
finishGameOnboarding
  );


document
  .getElementById(
"saveGameOrderButton"
  )
  .addEventListener(
"click",
async () => {
  await saveGameOrder();

  updateLocalUI();

  document
    .getElementById(
      "arrangeModal"
    )
    .classList
    .remove("open");
}
  );

document
  .getElementById(
"resetGameOrderButton"
  )
  .addEventListener(
"click",
() => {
  currentGameOrder =
    [...defaultGameOrder];

  renderArrangeList();

  setStatus(
    arrangeStatus,
    "Default order restored. Select Save Order to keep it.",
    "success"
  );
}
  );

window.addEventListener(
  "focus",
  () => {
saveCurrentGamePosition();

syncUserGameLibrary();
  }
);


document.addEventListener(
  "visibilitychange",
  () => {
if (
  document.visibilityState ===
  "visible"
) {
  syncUserGameLibrary();
}
  }
);


function showSessionUI() {
  const signedIn =
    Boolean(
      session?.access_token &&
      session?.user
    );

  document
  .getElementById(
"signedOutHome"
  )
  .classList
  .toggle(
"hidden",
signedIn
  );

  document
  .getElementById(
"gameGrid"
  )
  .classList
  .toggle(
"hidden",
!signedIn
  );

  document.body.classList.toggle(
    "signed-out",
    !signedIn
  );

  document
    .getElementById(
      "accountSignedOut"
    )
    .classList
    .toggle(
      "hidden",
      signedIn
    );

  if (signedIn) {
    document
      .getElementById(
        "accountModal"
      )
      .classList
      .remove("open");
  }

  document
    .getElementById(
      "signedOutView"
    )
    .classList
    .toggle(
      "hidden",
      signedIn
    );

  document
    .getElementById(
      "signedInView"
    )
    .classList
    .toggle(
      "hidden",
      !signedIn
    );

  document
    .getElementById(
      "friendsSignedOutMessage"
    )
    .classList
    .toggle(
      "hidden",
      signedIn
    );

  document
    .getElementById(
      "friendsSignedInContent"
    )
    .classList
    .toggle(
      "hidden",
      !signedIn
    );

  document
    .getElementById(
      "sendFriendButton"
    )
    .disabled =
      !signedIn;

  if (signedIn) {
    document
      .getElementById(
        "accountEmail"
      )
      .textContent =
        session.user.email || "";

    document
      .getElementById(
        "accountName"
      )
      .textContent =
        session.user.email ||
        "Signed in";

   loadProfile();
    loadMyCard();
    loadDailyGameStatus();
  loadTodayScores();
  loadStreaks();
  

loadGameCatalog()
  .then(
loadUserGameLibrary
  )
  .then(() => {
/*
 * Scores and streaks can finish loading
 * before the cards exist. Apply them again
 * now that every card is on the page.
 */
loadTodayScores();
loadStreaks();
renderMyCard();
backfillMyScoreNumbers();
joinPendingInvite();
loadYesterdayBanner();

if (currentTab === "social") {
  loadServers();
}

if (currentTab === "activity") {
  loadActivity();
}
  });

startLibrarySync();

    


  }
}


async function signUp() {
  const email =
    document
      .getElementById(
        "authEmail"
      )
      .value
      .trim();

  const password =
    document
      .getElementById(
        "authPassword"
      )
      .value;

  if (
    !email ||
    password.length < 6
  ) {
    setStatus(
      authStatus,
      "Enter a valid email and a password with at least 6 characters.",
      "error"
    );

    return;
  }

  try {
    setStatus(
      authStatus,
      "Creating account..."
    );

    const data =
      await request(
        "/auth/v1/signup",
        {
          method: "POST",

          headers:
            publicHeaders(),

          body:
            JSON.stringify({
              email: email,
              password: password
            })
        }
      );

    const identities =
      data?.identities ?? data?.user?.identities;

    // Supabase answers an already-registered email without an
    // error (and without sending mail), with no identities.
    if (
      !data?.access_token &&
      Array.isArray(identities) &&
      identities.length === 0
    ) {
      setStatus(
        authStatus,
        EXISTING_ACCOUNT_MESSAGE,
        "error"
      );

      return;
    }

    if (
      data?.access_token
    ) {
      session = data;

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(session)
      );

      showSessionUI();

      setStatus(
        authStatus,
        "Account created and signed in.",
        "success"
      );
    } else {
      setStatus(
        authStatus,
        "Account created. Check your email to confirm it.",
        "success"
      );
    }
  } catch (error) {
    setStatus(
      authStatus,
      /already (been )?registered|already exists/i.test(error.message)
        ? EXISTING_ACCOUNT_MESSAGE
        : error.message,
      "error"
    );
  }
}


async function signIn() {
  const email =
    document
      .getElementById(
        "authEmail"
      )
      .value
      .trim();

  const password =
    document
      .getElementById(
        "authPassword"
      )
      .value;

  if (
    !email ||
    !password
  ) {
    setStatus(
      authStatus,
      "Enter your email and password.",
      "error"
    );

    return;
  }

  try {
    setStatus(
      authStatus,
      "Signing in..."
    );

    session =
      await request(
        "/auth/v1/token?grant_type=password",
        {
          method: "POST",

          headers:
            publicHeaders(),

          body:
            JSON.stringify({
              email: email,
              password: password
            })
        }
      );

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(session)
    );

    setStatus(
      authStatus,
      "Signed in.",
      "success"
    );

    showSessionUI();
  } catch (error) {
    setStatus(
      authStatus,
      error.message,
      "error"
    );
  }
}


document
  .getElementById(
    "signUpButton"
  )
  .addEventListener(
    "click",
    signUp
  );


document
  .getElementById(
    "signInButton"
  )
  .addEventListener(
    "click",
    signIn
  );


document
  .getElementById(
    "signOutButton"
  )
  .addEventListener(
    "click",
    () => {
      session = null;
      myProfile = null;
      myCardStats = null;
      myAchievements = null;
      myCoins = null;
      shopItems = null;
      myPurchases = new Set();
      playerCards.clear();

      document.getElementById("settingsModal").classList.remove("open");

      const accountSection =
        document.getElementById("accountSection");

      accountSection.classList.remove("player-tint");
      delete accountSection.dataset.frame;

      localStorage.removeItem(
        SESSION_KEY
      );

      if (librarySyncTimer) {
  clearInterval(
librarySyncTimer
  );

  librarySyncTimer =
null;
}

      showSessionUI();

      switchTab("games");

      document
        .getElementById(
          "accountModal"
        )
        .classList
        .remove("open");
    }
  );

async function loadProfile() {
  if (!session) {
    return;
  }

  try {
    const profileRows =
      await request(
        "/rest/v1/profiles" +
        "?user_id=eq." +
        encodeURIComponent(
          session.user.id
        ) +
        "&select=" +
        "user_id,username,display_name",
        {
          headers:
            authHeaders()
        }
      );

    if (
      profileRows &&
      profileRows.length > 0
    ) {
      const profile =
        profileRows[0];

      myProfile =
        profile;

      renderMyCard();

      document
        .getElementById(
          "usernameInput"
        )
        .value =
          profile.username || "";

      document
        .getElementById(
          "accountName"
        )
        .textContent =
          profile.display_name ||
          "@" + profile.username;

      setAccountAttention(
        !profile.username
      );
    } else {
      setAccountAttention(true);

      document
        .getElementById(
          "accountName"
        )
        .textContent =
          session.user.email ||
          "Signed in";

      setStatus(
        profileStatus,
        "Choose a username to finish setting up your profile."
      );
    }
  } catch (error) {
    setStatus(
      profileStatus,
      error.message,
      "error"
    );
  }
}


/*
 * Save the player's username (this creates their profile).
 * Used by the Account tab and the "Choose your username" window.
 * Resolves true when saved.
 */
async function saveUsername(rawUsername, statusElement) {
      if (!session) {
        setStatus(
          statusElement,
          "Log in before saving a username.",
          "error"
        );

        return;
      }

      const username =
        String(rawUsername || "")
          .trim()
          .toLowerCase();

      const usernameIsValid =
        /^[a-z0-9_]{3,24}$/
          .test(username);

      if (!usernameIsValid) {
        setStatus(
          statusElement,
          "Use 3–24 lowercase letters, numbers, or underscores.",
          "error"
        );

        return;
      }

      try {
        setStatus(
          statusElement,
          "Saving username..."
        );

        await request(
          "/rest/v1/profiles" +
          "?on_conflict=user_id",
          {
            method: "POST",

            headers:
              authHeaders(
                "resolution=merge-duplicates,return=minimal"
              ),

            body:
              JSON.stringify({
                user_id:
                  session.user.id,

                username:
                  username
              })
          }
        );

        setStatus(
          statusElement,
          "Username saved.",
          "success"
        );

        await loadProfile();
        return true;
 } catch (error) {
        const errorMessage =
          String(
            error.message || ""
          );

        if (
          errorMessage.includes(
            "profiles_username_unique"
          ) ||
          errorMessage.includes(
            "duplicate key"
          ) ||
          errorMessage.includes(
            "23505"
          )
        ) {
          setStatus(
            statusElement,
            "That username is already taken.",
            "error"
          );
        } else if (
          errorMessage.includes(
            "profiles_username_format"
          )
        ) {
          setStatus(
            statusElement,
            "Username must be 3–24 characters using only lowercase letters, numbers, or underscores.",
            "error"
          );
        } else {
          setStatus(
            statusElement,
            errorMessage ||
              "Could not save username.",
            "error"
          );
        }
      }


      return false;
}


document
  .getElementById(
    "saveProfileButton"
  )
  .addEventListener(
    "click",
    () => {
      saveUsername(
        document.getElementById("usernameInput").value,
        profileStatus
      );
    }
  );


async function getProfile(
  userId
) {
  const profileRows =
    await request(
      "/rest/v1/profiles" +
      "?user_id=eq." +
      encodeURIComponent(
        userId
      ) +
      "&select=" +
      "user_id,username,display_name",
      {
        headers:
          authHeaders()
      }
    );

  if (
    profileRows &&
    profileRows.length > 0
  ) {
    return profileRows[0];
  }

  return {
    user_id: userId,
    username: "unknown",
    display_name: null
  };
}


document
  .getElementById(
    "sendFriendButton"
  )
  .addEventListener(
    "click",
    async () => {
      if (!session) {
        document
          .getElementById(
            "accountModal"
          )
          .classList
          .add("open");

        setStatus(
          authStatus,
          "Log in before sending a friend request.",
          "error"
        );

        return;
      }

      const username =
        document
          .getElementById(
            "friendSearch"
          )
          .value
          .trim()
          .toLowerCase();

      if (!username) {
        setStatus(
          friendStatus,
          "Enter a username.",
          "error"
        );

        return;
      }

      try {
        setStatus(
          friendStatus,
          "Searching for username..."
        );

        const profileRows =
          await request(
            "/rest/v1/profiles" +
            "?username=eq." +
            encodeURIComponent(
              username
            ) +
            "&select=" +
            "user_id,username,display_name",
            {
              headers:
                authHeaders()
            }
          );

        if (
          !profileRows ||
          profileRows.length === 0
        ) {
          throw new Error(
            "Username not found."
          );
        }

        const friendProfile =
          profileRows[0];

        if (
          friendProfile.user_id ===
          session.user.id
        ) {
          throw new Error(
            "You cannot add yourself."
          );
        }

        await request(
          "/rest/v1/friendships",
          {
            method: "POST",

            headers:
              authHeaders(
                "return=minimal"
              ),

            body:
              JSON.stringify({
                requester_id:
                  session.user.id,

                addressee_id:
                  friendProfile.user_id,

                status:
                  "pending"
              })
          }
        );

        document
          .getElementById(
            "friendSearch"
          )
          .value = "";

        setStatus(
          friendStatus,
          "Friend request sent.",
          "success"
        );

        await loadFriends();
      } catch (error) {
        let message =
          error.message;

        if (
          message.includes(
            "duplicate key"
          ) ||
          message.includes(
            "friendships_unique_direction"
          )
        ) {
          message =
            "A request or friendship with that user already exists.";
        }

        setStatus(
          friendStatus,
          message,
          "error"
        );
      }
    }
  );


async function loadFriends() {
  if (!session) {
    return;
  }

  const requestList =
    document.getElementById(
      "requestList"
    );

  const friendList =
    document.getElementById(
      "friendList"
    );

  requestList.innerHTML =
    "";

  friendList.innerHTML =
    "";

  try {
    const friendshipRows =
      await request(
        "/rest/v1/friendships" +
        "?or=(" +
        "requester_id.eq." +
        session.user.id +
        "," +
        "addressee_id.eq." +
        session.user.id +
        ")" +
        "&select=*",
        {
          headers:
            authHeaders()
        }
      );

    for (
      const friendship
      of friendshipRows || []
    ) {
      const otherUserId =
        friendship.requester_id ===
        session.user.id
          ? friendship.addressee_id
          : friendship.requester_id;

      const otherProfile =
        await getProfile(
          otherUserId
        );

      const displayName =
        otherProfile.display_name ||
        "@" +
        otherProfile.username;

      const isIncomingRequest =
        friendship.status ===
          "pending" &&
        friendship.addressee_id ===
          session.user.id;

      if (isIncomingRequest) {
        const requestRow =
          document.createElement(
            "div"
          );

        requestRow.className =
          "friend-row";

        const nameElement =
          document.createElement(
            "span"
          );

        nameElement.textContent =
          displayName;

        const actionContainer =
          document.createElement(
            "div"
          );

        actionContainer.className =
          "friend-actions";

        const acceptButton =
          document.createElement(
            "button"
          );

        acceptButton.className =
          "small-button";

        acceptButton.type =
          "button";

        acceptButton.textContent =
          "Accept";

        acceptButton.addEventListener(
          "click",
          () => {
            respondToFriendRequest(
              friendship.id,
              "accepted"
            );
          }
        );

        const declineButton =
          document.createElement(
            "button"
          );

        declineButton.className =
          "small-button";

        declineButton.type =
          "button";

        declineButton.textContent =
          "Decline";

        declineButton.addEventListener(
          "click",
          () => {
            respondToFriendRequest(
              friendship.id,
              "declined"
            );
          }
        );

        actionContainer.append(
          acceptButton,
          declineButton
        );

        requestRow.append(
          nameElement,
          actionContainer
        );

        requestList.appendChild(
          requestRow
        );
      }

      if (
        friendship.status ===
        "accepted"
      ) {
        const friendRow =
          document.createElement(
            "div"
          );

        friendRow.className =
          "friend-row";

        const nameElement =
          document.createElement(
            "span"
          );

        nameElement.textContent =
          displayName;

        const removeButton =
          document.createElement(
            "button"
          );

        removeButton.className =
          "small-button";

        removeButton.type =
          "button";

        removeButton.textContent =
          "Remove";

        removeButton.addEventListener(
          "click",
          () => {
            removeFriendship(
              friendship.id
            );
          }
        );

        friendRow.append(
          nameElement,
          removeButton
        );

        friendList.appendChild(
          friendRow
        );
      }
    }

    if (
      requestList.children.length ===
      0
    ) {
      requestList.innerHTML =
        '<p class="status">' +
        "No incoming requests." +
        "</p>";
    }

    if (
      friendList.children.length ===
      0
    ) {
      friendList.innerHTML =
        '<p class="status">' +
        "No friends yet." +
        "</p>";
    }
  } catch (error) {
    setStatus(
      friendStatus,
      error.message,
      "error"
    );
  }
}


async function respondToFriendRequest(
  friendshipId,
  newStatus
) {
  try {
    setStatus(
      friendStatus,
      newStatus === "accepted"
        ? "Accepting request..."
        : "Declining request..."
    );

    await request(
      "/rest/v1/friendships" +
      "?id=eq." +
      encodeURIComponent(
        friendshipId
      ),
      {
        method: "PATCH",

        headers:
          authHeaders(
            "return=minimal"
          ),

        body:
          JSON.stringify({
            status:
              newStatus
          })
      }
    );

    setStatus(
      friendStatus,
      newStatus === "accepted"
        ? "Friend request accepted."
        : "Friend request declined.",
      "success"
    );

    await loadFriends();
    await loadTodayScores();
  } catch (error) {
    setStatus(
      friendStatus,
      error.message,
      "error"
    );
  }
}


async function removeFriendship(
  friendshipId
) {
  try {
    setStatus(
      friendStatus,
      "Removing friend..."
    );

    await request(
      "/rest/v1/friendships" +
      "?id=eq." +
      encodeURIComponent(
        friendshipId
      ),
      {
        method: "DELETE",

        headers:
          authHeaders(
            "return=minimal"
          )
      }
    );

    setStatus(
      friendStatus,
      "Friend removed.",
      "success"
    );

    await loadFriends();
    await loadTodayScores();
  } catch (error) {
    setStatus(
      friendStatus,
      error.message,
      "error"
    );
  }
}

function openScoreModalForGame(
  gameCard
) {
  if (!session) {
document
  .getElementById(
    "accountModal"
  )
  .classList
  .add("open");

setStatus(
  authStatus,
  "Log in before entering a shared result.",
  "error"
);

return;
  }


  selectedScoreGame =
gameCard.dataset.id;


  const existingScore =
todaysScores.find(
  score =>
    score.user_id ===
      session.user.id &&
    score.game_id ===
      selectedScoreGame
);


  document
.getElementById(
  "scoreTitle"
)
.textContent =
  existingScore
    ? "Edit " +
      gameCard.dataset.name +
      " Result"
    : "Enter " +
      gameCard.dataset.name +
      " Result";


  document
.getElementById(
  "resultText"
)
.value =
  cleanResultText(existingScore?.result_text);


  document
.getElementById(
  "numericScore"
)
.value =
  existingScore?.numeric_score ??
  "";


  document
.getElementById(
  "scoreUnit"
)
.value =
  existingScore?.score_unit ||
  "";


  setStatus(
scoreStatus,
""
  );

  prepareScoreReading();

  document
.getElementById(
  "scoreModal"
)
.classList
.add("open");
}

function createGameCard(
  game,
  forceRecreate = false
) {
  const existingCard =
document.querySelector(
  '.game-card[data-id="' +
  game.game_key +
  '"]'
);


  /*
   * Do not duplicate one of the
   * existing hard-coded cards.
   */
 if (
  existingCard &&
  !forceRecreate
) {
  existingCard.dataset.createdBy =
game.created_by || "";

  existingCard.dataset.official =
game.is_official
  ? "true"
  : "false";

  return existingCard;
}


if (
  existingCard &&
  forceRecreate
) {
  existingCard.remove();
}


  const card =
document.createElement(
  "article"
);


  card.className =
"game-card";


  card.dataset.id =
game.game_key;

  card.dataset.name =
game.name;

  card.dataset.category =
game.category || "other";

  card.dataset.createdBy =
  game.created_by || "";

card.dataset.official =
  game.is_official
? "true"
: "false";

  card.dataset.search =
[
  game.name,
  game.category,
  game.description
]
  .filter(Boolean)
  .join(" ")
  .toLowerCase();


  card.style.setProperty(
"--game-color",
game.color ||
  "#7c3aed"
  );


  const cardTop =
document.createElement(
  "div"
);

  cardTop.className =
"card-top";


  const icon =
document.createElement(
  "div"
);

  icon.className =
"game-icon";

  icon.textContent =
game.icon ||
"🎮";


  const favoriteButton =
document.createElement(
  "button"
);

  favoriteButton.type =
"button";

  favoriteButton.className =
"favorite-button";

  favoriteButton.dataset.favorite =
game.game_key;

  favoriteButton.textContent =
"★";

  favoriteButton.setAttribute(
"aria-label",
"Favorite " +
game.name
  );


 favoriteButton.addEventListener(
  "click",
  async () => {
const gameId =
  game.game_key;


const becomingFavorite =
  !favoriteGames.includes(
    gameId
  );


if (becomingFavorite) {
  favoriteGames.push(
    gameId
  );
} else {
  favoriteGames =
    favoriteGames.filter(
      id =>
        id !== gameId
    );
}


saveLocal();

updateLocalUI();


await saveFavoriteState(
  gameId,
  becomingFavorite
);
  }
);



  const expandButton =
document.createElement(
  "button"
);

  expandButton.type =
"button";

  expandButton.className =
"expand-button";

  expandButton.setAttribute(
"aria-label",
"Open " +
game.name
  );

  expandButton.innerHTML =
'<svg class="icon-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>' +
'<svg class="icon-close" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  expandButton.addEventListener(
"click",
() => {
  setCardExpanded(
    card,
    !card.classList.contains(
      "expanded"
    )
  );
}
  );

  const cardActions =
document.createElement(
  "div"
);

  cardActions.className =
"card-top-actions";

  const streakBadge =
document.createElement(
  "span"
);

  streakBadge.className =
"streak-badge";

  cardActions.append(
streakBadge,
favoriteButton,
expandButton
  );

  cardTop.append(
icon,
cardActions
  );


  const title =
document.createElement(
  "h3"
);

  title.textContent =
game.name;


  const category =
document.createElement(
  "div"
);

  category.className =
"category";

  category.textContent =
getCategoryLabel(
  game.category
);


  const description =
document.createElement(
  "p"
);

  description.className =
"description";

  description.textContent =
game.description ||
"A custom daily game.";


  const cardButtons =
document.createElement(
  "div"
);

  cardButtons.className =
"card-buttons";


  const playButton =
document.createElement(
  "a"
);

  playButton.className =
"play-button";

  playButton.href =
game.url;

  playButton.target =
"_blank";

  playButton.rel =
"noopener noreferrer";

  playButton.textContent =
"Play ↗";


  const completeButton =
document.createElement(
  "button"
);

  completeButton.type =
"button";

  completeButton.className =
"complete-button";

  completeButton.dataset.complete =
game.game_key;

  completeButton.textContent =
"✓";

  completeButton.setAttribute(
"aria-label",
"Mark " +
game.name +
" complete"
  );


  completeButton.addEventListener(
  "click",
  () => {
toggleGameCompleted(
  game.game_key
);
  }
);


  const resultButton =
document.createElement(
  "button"
);

  resultButton.type =
"button";

  resultButton.className =
"result-button";

  resultButton.dataset.result =
game.game_key;

  resultButton.textContent =
"Enter Result";

  resultButton.addEventListener(
"click",
() => {
  openScoreModalForGame(
    card
  );
}
  );


  const historyButton =
document.createElement(
  "button"
);

  historyButton.type =
"button";

  historyButton.className =
"history-button";

  historyButton.textContent =
"📅 History";


  historyButton.addEventListener(
"click",
() => {
  if (!session) {
    document
      .getElementById(
        "accountModal"
      )
      .classList
      .add("open");

    setStatus(
      authStatus,
      "Log in to view your result history.",
      "error"
    );

    return;
  }


  openGameHistory(
    game.game_key
  );
}
  );


  cardButtons.append(
playButton,
completeButton,
resultButton,
historyButton
  );


  const resultSummary =
document.createElement(
  "div"
);

  resultSummary.className =
"result-summary";

  resultSummary.dataset
.resultSummary =
  game.game_key;


  card.append(
cardTop,
title,
category,
description,
cardButtons,
resultSummary
  );


  document
.getElementById(
  "gameGrid"
)
.appendChild(
  card
);


  return card;
}

async function loadGameCatalog() {
  if (!session) {
return;
  }


  try {
const gameRows =
  await request(
    "/rest/v1/games" +
    "?select=" +
    "game_key," +
    "name," +
    "url," +
    "category," +
    "description," +
    "icon," +
    "color," +
    "is_official," +
    "created_by" +
    "&order=created_at.asc",
    {
      headers:
        authHeaders()
    }
  ) || [];

gameCatalog =
  new Map(
gameRows.map(
  game => [
    game.game_key,
    game
  ]
)
  );


gameRows.forEach(
  game => {
createGameCard(
  game,
  true
);
  }
);


/*
 * Add any database-generated
 * cards to the current order.
 */
cards().forEach(card => {
  if (
    !defaultGameOrder.includes(
      card.dataset.id
    )
  ) {
    defaultGameOrder.push(
      card.dataset.id
    );
  }

  if (
    !currentGameOrder.includes(
      card.dataset.id
    )
  ) {
    currentGameOrder.push(
      card.dataset.id
    );
  }
});


applyGameOrder(
  currentGameOrder
);

updateLocalUI();

  } catch (error) {
console.error(
  "Game catalog loading failed:",
  error
);
  }
}

function openCustomGameEditor(
  gameKey
) {
  const game =
gameCatalog.get(
  gameKey
);


  if (
!game ||
game.is_official ||
game.created_by !==
  session?.user?.id
  ) {
return;
  }


  selectedCustomGameKey =
gameKey;


  document
.getElementById(
  "customGameModalTitle"
)
.textContent =
  "Edit Custom Game";


  document
.getElementById(
  "saveCustomGameButton"
)
.textContent =
  "Save Changes";


  document
.getElementById(
  "customGameName"
)
.value =
  game.name || "";


  document
.getElementById(
  "customGameUrl"
)
.value =
  game.url || "";


  document
.getElementById(
  "customGameCategory"
)
.value =
  game.category || "other";


  document
.getElementById(
  "customGameIcon"
)
.value =
  game.icon || "";


  document
.getElementById(
  "customGameDescription"
)
.value =
  game.description || "";


  setStatus(
addGameStatus,
""
  );


  document
.getElementById(
  "addGameModal"
)
.classList
.add("open");
}

async function createCustomGame() {
  if (!session) {
return;
  }


  const gameName =
document
  .getElementById(
    "customGameName"
  )
  .value
  .trim();


  let gameUrl =
document
  .getElementById(
    "customGameUrl"
  )
  .value
  .trim();


  const gameCategory =
document
  .getElementById(
    "customGameCategory"
  )
  .value;


  const gameIcon =
document
  .getElementById(
    "customGameIcon"
  )
  .value
  .trim() ||
"🎮";


  const gameDescription =
document
  .getElementById(
    "customGameDescription"
  )
  .value
  .trim();


  if (!gameName) {
setStatus(
  addGameStatus,
  "Enter a game name.",
  "error"
);

return;
  }


  if (
!gameUrl.startsWith(
  "https://"
) &&
!gameUrl.startsWith(
  "http://"
)
  ) {
setStatus(
  addGameStatus,
  "Enter the full game URL beginning with https://",
  "error"
);

return;
  }

 if (selectedCustomGameKey) {
  try {
setStatus(
  addGameStatus,
  "Saving changes..."
);


await request(
  "/rest/v1/games" +
  "?game_key=eq." +
  encodeURIComponent(
    selectedCustomGameKey
  ),
  {
    method: "PATCH",

    headers:
      authHeaders(
        "return=minimal"
      ),

    body:
      JSON.stringify({
        name:
          gameName,

        url:
          gameUrl,

        category:
          gameCategory,

        description:
          gameDescription,

        icon:
          gameIcon
      })
  }
);


const updatedGame = {
  ...gameCatalog.get(
    selectedCustomGameKey
  ),

  name:
    gameName,

  url:
    gameUrl,

  category:
    gameCategory,

  description:
    gameDescription,

  icon:
    gameIcon
};


gameCatalog.set(
  selectedCustomGameKey,
  updatedGame
);


const existingCard =
  document.querySelector(
    '.game-card[data-id="' +
    selectedCustomGameKey +
    '"]'
  );


if (existingCard) {
  existingCard.dataset.name =
    gameName;

  existingCard.dataset.category =
    gameCategory;

  existingCard.dataset.search =
    [
      gameName,
      gameCategory,
      gameDescription
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();


  existingCard
    .querySelector(
      ".game-icon"
    )
    .textContent =
      gameIcon;


  existingCard
    .querySelector(
      "h3"
    )
    .textContent =
      gameName;


  existingCard
    .querySelector(
      ".category"
    )
    .textContent =
      getCategoryLabel(
        gameCategory
      );


  existingCard
    .querySelector(
      ".description"
    )
    .textContent =
      gameDescription ||
      "A custom daily game.";


  existingCard
    .querySelector(
      ".play-button"
    )
    .href =
      gameUrl;


  existingCard
    .querySelector(
      ".favorite-button"
    )
    .setAttribute(
      "aria-label",
      "Favorite " +
      gameName
    );
}


selectedCustomGameKey =
  null;


setStatus(
  addGameStatus,
  "Changes saved.",
  "success"
);


document
  .getElementById(
    "addGameModal"
  )
  .classList
  .remove("open");


renderManageGames();
renderArrangeList();
updateLocalUI();

  } catch (error) {
setStatus(
  addGameStatus,
  error.message,
  "error"
);
  }


  return;
} 


  const gameKey =
createCustomGameKey(
  gameName
);


  try {
setStatus(
  addGameStatus,
  "Adding game..."
);


/*
 * Create the custom game.
 */
await request(
  "/rest/v1/games",
  {
    method: "POST",

    headers:
      authHeaders(
        "return=minimal"
      ),

    body:
      JSON.stringify({
        game_key:
          gameKey,

        name:
          gameName,

        url:
          gameUrl,

        category:
          gameCategory,

        description:
          gameDescription,

        icon:
          gameIcon,

        color:
          "#7c3aed",

        is_official:
          false,

        created_by:
          session.user.id
      })
  }
);


const visibleGames =
  userGameLibrary.filter(
    game =>
      game.is_visible
  );


const highestSortOrder =
  visibleGames.reduce(
    (
      highest,
      game
    ) =>
      Math.max(
        highest,
        Number(
          game.sort_order
        ) || 0
      ),
    0
  );


/*
 * Add it to this user's library
 * at the bottom.
 */
await request(
  "/rest/v1/user_games",
  {
    method: "POST",

    headers:
      authHeaders(
        "return=minimal"
      ),

    body:
      JSON.stringify({
        user_id:
          session.user.id,

        game_key:
          gameKey,

        is_visible:
          true,

        is_favorite:
          false,

        sort_order:
          highestSortOrder + 1
      })
  }
);


/*
 * Create its card.
 */
createGameCard({
  game_key:
    gameKey,

  name:
    gameName,

  url:
    gameUrl,

  category:
    gameCategory,

  description:
    gameDescription,

  icon:
    gameIcon,

  color:
    "#7c3aed"
});


currentGameOrder =
  currentGameOrder.filter(
    id =>
      id !== gameKey
  );

currentGameOrder.push(
  gameKey
);


defaultGameOrder.push(
  gameKey
);


applyGameOrder(
  currentGameOrder
);


await saveGameOrder();

await loadUserGameLibrary();


document
  .getElementById(
    "customGameName"
  )
  .value = "";

document
  .getElementById(
    "customGameUrl"
  )
  .value = "";

document
  .getElementById(
    "customGameIcon"
  )
  .value = "";

document
  .getElementById(
    "customGameDescription"
  )
  .value = "";


setStatus(
  addGameStatus,
  "Game added.",
  "success"
);


document
  .getElementById(
    "addGameModal"
  )
  .classList
  .remove("open");


renderManageGames();
updateLocalUI();

  } catch (error) {
setStatus(
  addGameStatus,
  error.message,
  "error"
);
  }
}

function addHistoryButtons() {
  cards().forEach(card => {
if (
  card.querySelector(
    ".history-button"
  )
) {
  return;
}

const gameId =
  card.dataset.id;

const historyButton =
  document.createElement(
    "button"
  );

historyButton.type =
  "button";

historyButton.className =
  "history-button";

historyButton.textContent =
  "📅 History";

historyButton.addEventListener(
  "click",
  () => {
    if (!session) {
      document
        .getElementById(
          "accountModal"
        )
        .classList
        .add("open");

      setStatus(
        authStatus,
        "Log in to view your result history.",
        "error"
      );

      return;
    }

    openGameHistory(
      gameId
    );
  }
);

const cardButtons =
  card.querySelector(
    ".card-buttons"
  );

cardButtons.appendChild(
  historyButton
);
  });
}

function formatHistoryDate(
  dateString
) {
  if (
dateString === TODAY
  ) {
return "Today";
  }

  const historyDate =
new Date(
  dateString +
  "T12:00:00"
);

  const yesterday =
new Date(
  TODAY +
  "T12:00:00"
);

  yesterday.setDate(
yesterday.getDate() - 1
  );

  if (
dateString ===
yesterday.toLocaleDateString(
  "en-CA"
)
  ) {
return "Yesterday";
  }

  return historyDate
.toLocaleDateString(
  undefined,
  {
    month: "short",
    day: "numeric",
    year: "numeric"
  }
);
}


async function openGameHistory(
  gameId
) {
  const gameCard =
document.querySelector(
  '.game-card[data-id="' +
  gameId +
  '"]'
);

  const gameName =
gameCard?.dataset.name ||
gameId;


  document
.getElementById(
  "historyTitle"
)
.textContent =
  gameName +
  " History";


  const historyList =
document.getElementById(
  "historyList"
);

  historyList.innerHTML =
"";


  setStatus(
historyStatus,
"Loading history..."
  );


  document
.getElementById(
  "historyModal"
)
.classList
.add("open");


  try {
const historyRows =
  await request(
    "/rest/v1/daily_scores" +
    "?user_id=eq." +
    encodeURIComponent(
      session.user.id
    ) +
    "&game_id=eq." +
    encodeURIComponent(
      gameId
    ) +
    "&select=" +
    "play_date," +
    "result_text," +
    "numeric_score," +
    "score_unit" +
    "&order=play_date.desc" +
    "&limit=30",
    {
      headers:
        authHeaders()
    }
  );


if (
  !historyRows ||
  historyRows.length === 0
) {
  setStatus(
    historyStatus,
    "No submitted results yet."
  );

  return;
}


setStatus(
  historyStatus,
  ""
);


historyRows.forEach(
  score => {
    const historyEntry =
      document.createElement(
        "div"
      );

    historyEntry.className =
      "history-entry";


    const historyDate =
      document.createElement(
        "div"
      );

    historyDate.className =
      "history-date";

    historyDate.textContent =
      formatHistoryDate(
        score.play_date
      );


    const historyResult =
      document.createElement(
        "div"
      );

    historyResult.className =
      "history-result";

    historyResult.textContent =
      formatScore(
        score
      );


    historyEntry.append(
      historyDate,
      historyResult
    );


    historyList.appendChild(
      historyEntry
    );
  }
);

  } catch (error) {
setStatus(
  historyStatus,
  error.message,
  "error"
);
  }
}

document
  .querySelectorAll(
    "[data-result]"
  )
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        if (!session) {
          document
            .getElementById(
              "accountModal"
            )
            .classList
            .add("open");

          setStatus(
            authStatus,
            "Log in before entering a shared result.",
            "error"
          );

          return;
        }

        selectedScoreGame =
          button.dataset.result;

        const gameCard =
          button.closest(
            ".game-card"
          );

        const existingScore =
  todaysScores.find(
score =>
  score.user_id ===
    session.user.id &&
  score.game_id ===
    selectedScoreGame
  );

        document
  .getElementById(
"scoreTitle"
  )
  .textContent =
existingScore
  ? "Edit " +
    gameCard.dataset.name +
    " Result"
  : "Enter " +
    gameCard.dataset.name +
    " Result";


        if (existingScore) {
  document
.getElementById(
  "resultText"
)
.value =
  cleanResultText(existingScore.result_text);

  document
.getElementById(
  "numericScore"
)
.value =
  existingScore.numeric_score ??
  "";

  document
.getElementById(
  "scoreUnit"
)
.value =
  existingScore.score_unit ||
  "";

} else {
  document
.getElementById(
  "resultText"
)
.value = "";

  document
.getElementById(
  "numericScore"
)
.value = "";

  document
.getElementById(
  "scoreUnit"
)
.value = "";
}

        setStatus(
          scoreStatus,
          ""
        );

        prepareScoreReading();

        document
          .getElementById(
            "scoreModal"
          )
          .classList
          .add("open");
      }
    );
  });


document
  .getElementById(
    "saveScoreButton"
  )
  .addEventListener(
    "click",
    async () => {
      if (!session) {
        setStatus(
          scoreStatus,
          "Log in before saving a result.",
          "error"
        );

        return;
      }

      if (needsUsername) {
        setStatus(
          scoreStatus,
          USERNAME_FIRST_MESSAGE,
          "error"
        );

        return;
      }

      const resultTextValue =
        document
          .getElementById(
            "resultText"
          )
          .value
          .trim();

      const numericScoreValue =
        document
          .getElementById(
            "numericScore"
          )
          .value;

      const scoreUnitValue =
        document
          .getElementById(
            "scoreUnit"
          )
          .value
          .trim();

      if (
        !resultTextValue &&
        numericScoreValue === ""
      ) {
        setStatus(
          scoreStatus,
          "Enter a result or numeric score.",
          "error"
        );

        return;
      }

      const readScore =
        readGameScore(
          selectedScoreGame,
          resultTextValue
        );

      const useReadScore =
        readScore &&
        numericScoreValue === "";

      const scoreRecord = {
        user_id:
          session.user.id,
        game_id:
          selectedScoreGame,
        play_date:
          TODAY,
        completed:
          !readScore?.failed,

        result_text:
          cleanResultText(resultTextValue) ||
          null,

        numeric_score:
          useReadScore
            ? readScore.score
            : numericScoreValue === ""
              ? null
              : Number(
                  numericScoreValue
                ),
        score_unit:
          (useReadScore
            ? readScore.unit
            : scoreUnitValue) ||
          null
      };

      try {
        setStatus(
          scoreStatus,
          "Saving result..."
        );

        await request(
          "/rest/v1/daily_scores" +
          "?on_conflict=" +
          "user_id,game_id,play_date",
          {
            method: "POST",

            headers:
              authHeaders(
                "resolution=merge-duplicates,return=minimal"
              ),

            body:
              JSON.stringify(
                scoreRecord
              )
          }
        );

        if (
          !completedGames.includes(
            selectedScoreGame
          )
        ) {
          completedGames.push(
            selectedScoreGame
          );

          saveLocal();
          updateLocalUI();
        }

        setStatus(
  scoreStatus,
  "Result saved.",
  "success"
);

await loadTodayScores();
await loadStreaks();
      } catch (error) {
        setStatus(
          scoreStatus,
          error.message.includes("daily_scores_user_id_fkey")
            ? USERNAME_FIRST_MESSAGE
            : error.message,
          "error"
        );
      }
    }
  );


function formatScore(
  score
) {
  const cleanedText =
    cleanResultText(score.result_text);

  if (cleanedText) {
    return cleanedText;
  }

  if (
    score.numeric_score !==
    null &&
    score.numeric_score !==
    undefined
  ) {
    const scoreParts = [
      score.numeric_score,
      score.score_unit
    ].filter(Boolean);

    return scoreParts.join(" ");
  }

  return "Completed";
}

    async function loadStreaks() {
  if (!session) {
    return;
  }

  try {
    const scoreHistory =
      await request(
        "/rest/v1/daily_scores" +
        "?user_id=eq." +
        encodeURIComponent(
          session.user.id
        ) +
        "&select=" +
        "game_id,play_date",
        {
          headers:
            authHeaders()
        }
      );


    const datesByGame =
      new Map();


    for (
      const score
      of scoreHistory || []
    ) {
      if (
        !datesByGame.has(
          score.game_id
        )
      ) {
        datesByGame.set(
          score.game_id,
          new Set()
        );
      }

      datesByGame
        .get(score.game_id)
        .add(score.play_date);
    }


    cards().forEach(card => {
      const gameId =
        card.dataset.id;


      let streakElement =
        card.querySelector(
          ".streak"
        );


      if (!streakElement) {
        streakElement =
          document.createElement(
            "div"
          );

        streakElement.className =
          "streak";


        const category =
          card.querySelector(
            ".category"
          );


        category.insertAdjacentElement(
          "afterend",
          streakElement
        );
      }


      const gameDates =
        datesByGame.get(
          gameId
        ) ||
        new Set();


      let streak =
        0;


      const currentDate =
        new Date(
          TODAY +
          "T12:00:00"
        );


      /*
       * If today's result hasn't been
       * submitted yet, allow the current
       * streak to continue from yesterday.
       */

      const todayString =
        currentDate
          .toLocaleDateString(
            "en-CA"
          );


      if (
        !gameDates.has(
          todayString
        )
      ) {
        currentDate.setDate(
          currentDate.getDate() - 1
        );
      }


      while (true) {
        const dateString =
          currentDate
            .toLocaleDateString(
              "en-CA"
            );


        if (
          !gameDates.has(
            dateString
          )
        ) {
          break;
        }


        streak += 1;


        currentDate.setDate(
          currentDate.getDate() - 1
        );
      }


      if (streak > 0) {
        streakElement.textContent =
          "🔥 " +
          streak +
          (
            streak === 1
              ? " day"
              : " days"
          );

        streakElement.classList.add(
          "visible"
        );
      } else {
        streakElement.textContent =
          "";

        streakElement.classList.remove(
          "visible"
        );
      }

      const streakBadge =
        card.querySelector(
          ".streak-badge"
        );

      if (streakBadge) {
        streakBadge.textContent =
          streak > 0
            ? "🔥 " + streak
            : "";

        streakBadge.setAttribute(
          "aria-label",
          streak > 0
            ? streak + " day streak"
            : ""
        );
      }
    });

            requestAnimationFrame(
      () => {
        restoreGamePosition();
      }
    );

  } catch (error) {
    console.error(
      "Streak loading failed:",
      error
    );
  }
}

function calculateStreak(
  dateValues
) {
  const dates =
new Set(
  dateValues || []
);

  let streak =
0;

  const currentDate =
new Date(
  TODAY +
  "T12:00:00"
);

  const todayString =
currentDate
  .toLocaleDateString(
    "en-CA"
  );


  /*
   * A streak stays active during
   * today even if the player has
   * not submitted today's result yet.
   */

  if (
!dates.has(
  todayString
)
  ) {
currentDate.setDate(
  currentDate.getDate() - 1
);
  }


  while (true) {
const dateString =
  currentDate
    .toLocaleDateString(
      "en-CA"
    );


if (
  !dates.has(
    dateString
  )
) {
  break;
}


streak += 1;


currentDate.setDate(
  currentDate.getDate() - 1
);
  }


  return streak;
}

async function loadDailyGameStatus() {
  if (!session) {
return;
  }


  try {
const statusRows =
  await request(
    "/rest/v1/daily_game_status" +
    "?user_id=eq." +
    encodeURIComponent(
      session.user.id
    ) +
    "&play_date=eq." +
    encodeURIComponent(
      TODAY
    ) +
    "&completed=eq.true" +
    "&select=game_key",
    {
      headers:
        authHeaders()
    }
  ) || [];


completedGames =
  Array.from(
    new Set(
      statusRows.map(
        row =>
          row.game_key
      )
    )
  );


saveLocal();
updateLocalUI();

  } catch (error) {
console.error(
  "Daily game status loading failed:",
  error
);
  }
}

async function toggleGameCompleted(
  gameId
) {
  const currentlyCompleted =
completedGames.includes(
  gameId
);


  /*
   * Logged-out users continue
   * using local storage.
   */
  if (!session) {
if (currentlyCompleted) {
  completedGames =
    completedGames.filter(
      id =>
        id !== gameId
    );
} else {
  completedGames.push(
    gameId
  );
}

saveLocal();
updateLocalUI();

return;
  }


  try {
if (currentlyCompleted) {
  /*
   * DELETE today's status row
   * when unchecking Played.
   */
  await request(
    "/rest/v1/daily_game_status" +
    "?user_id=eq." +
    encodeURIComponent(
      session.user.id
    ) +
    "&game_key=eq." +
    encodeURIComponent(
      gameId
    ) +
    "&play_date=eq." +
    encodeURIComponent(
      TODAY
    ),
    {
      method: "DELETE",

      headers:
        authHeaders(
          "return=minimal"
        )
    }
  );


  completedGames =
    completedGames.filter(
      id =>
        id !== gameId
    );

} else {
  /*
   * UPSERT today's Played state.
   */
  await request(
    "/rest/v1/daily_game_status" +
    "?on_conflict=" +
    "user_id,game_key,play_date",
    {
      method: "POST",

      headers:
        authHeaders(
          "resolution=merge-duplicates,return=minimal"
        ),

      body:
        JSON.stringify({
          user_id:
            session.user.id,

          game_key:
            gameId,

          play_date:
            TODAY,

          completed:
            true,

          updated_at:
            new Date()
              .toISOString()
        })
    }
  );


  if (
    !completedGames.includes(
      gameId
    )
  ) {
    completedGames.push(
      gameId
    );
  }
}


saveLocal();
updateLocalUI();

  } catch (error) {
console.error(
  "Played status saving failed:",
  error
);
  }
}

async function loadTodayScores() {
  if (!session) {
    return;
  }

  try {
    const scoreRows =
      await request(
        "/rest/v1/daily_scores" +
        "?play_date=eq." +
        encodeURIComponent(
          TODAY
        ) +
        "&select=" +
        "user_id," +
        "game_id," +
        "result_text," +
        "numeric_score," +
        "score_unit," +
        "completed",
        {
          headers:
            authHeaders()
        }
      );

    todaysScores =
  scoreRows || [];

            
    const submittedGameIds =
      (scoreRows || [])
        .filter(
          score =>
            score.user_id ===
            session.user.id
        )
        .map(
          score =>
            score.game_id
        );


    completedGames =
      Array.from(
        new Set([
          ...completedGames,
          ...submittedGameIds
        ])
      );


    saveLocal();
    updateLocalUI();

            const scoreHistory =
      await request(
        "/rest/v1/daily_scores" +
        "?select=" +
        "user_id," +
        "game_id," +
        "play_date",
        {
          headers:
            authHeaders()
        }
      );


    const profileCache =
      new Map();


    async function getCachedProfile(
      userId
    ) {
      if (
        profileCache.has(
          userId
        )
      ) {
        return profileCache.get(
          userId
        );
      }

      const profile =
        await getProfile(
          userId
        );

      profileCache.set(
        userId,
        profile
      );

      return profile;
    }


    /*
     * First reset every game card.
     * This also displays your own result.
     */

    cards().forEach(card => {
      const gameId =
        card.dataset.id;

      const resultSummary =
        card.querySelector(
          ".result-summary"
        );


      const myScore =
        scoreRows?.find(
          score =>
            score.user_id ===
              session.user.id &&
            score.game_id ===
              gameId
        );

      const resultButton =
  card.querySelector(
".result-button"
  );

resultButton.textContent =
  myScore
? "✏️ Edit Result"
: "Enter Result";


      if (myScore) {
        resultSummary.style.display =
          "block";

        resultSummary.textContent =
          "Your result:\n" +
          formatScore(
            myScore
          );
      } else {
        resultSummary.style.display =
          "none";

        resultSummary.textContent =
          "";
      }


      /*
       * Create the Friends Today box
       * if this card doesn't have one yet.
       */

      let friendResults =
        card.querySelector(
          ".friend-results"
        );


      if (!friendResults) {
        friendResults =
          document.createElement(
            "div"
          );

        friendResults.className =
          "friend-results";

        card.appendChild(
          friendResults
        );
      }


      /*
       * Clear yesterday/old data before
       * rebuilding the card.
       */

      friendResults.innerHTML =
        "";

      friendResults
        .classList
        .remove(
          "visible"
        );
    });


    /*
     * Separate other people's scores
     * from your own.
     */

    const friendScores =
      (scoreRows || []).filter(
        score =>
          score.user_id !==
          session.user.id
      );


    /*
     * Group scores by game.
     */

    const scoresByGame =
      new Map();


    for (
      const friendScore
      of friendScores
    ) {
      const gameId =
        friendScore.game_id;


      if (
        !scoresByGame.has(
          gameId
        )
      ) {
        scoresByGame.set(
          gameId,
          []
        );
      }


      scoresByGame
        .get(gameId)
        .push(
          friendScore
        );
    }


    /*
     * Put each group directly underneath
     * the correct game.
     */

    for (
      const [
        gameId,
        gameScores
      ]
      of scoresByGame
    ) {

      const gameCard =
        document.querySelector(
          '[data-id="' +
          gameId +
          '"]'
        );


      if (!gameCard) {
        continue;
      }


      const friendResults =
        gameCard.querySelector(
          ".friend-results"
        );


      const title =
        document.createElement(
          "div"
        );

      title.className =
        "friend-results-title";

      title.textContent =
        "Others today";

      friendResults.appendChild(
        title
      );


                /*
       * Add friend scores.
       * Show the first 3 automatically.
       * If there are more than 3,
       * add a View More button.
       */

      const visibleLimit =
        3;


      for (
        let index = 0;
        index < gameScores.length;
        index += 1
      ) {
        const friendScore =
          gameScores[index];


        const friendProfile =
          await getCachedProfile(
            friendScore.user_id
          );

                    const friendGameDates =
          (scoreHistory || [])
            .filter(
              historicalScore =>
                historicalScore
                  .user_id ===
                  friendScore.user_id &&
                historicalScore
                  .game_id ===
                  friendScore.game_id
            )
            .map(
              historicalScore =>
                historicalScore
                  .play_date
            );


        const friendStreak =
          calculateStreak(
            friendGameDates
          );


        const displayName =
          friendProfile.display_name ||
          "@" +
          friendProfile.username;


        const resultRow =
          document.createElement(
            "div"
          );

        resultRow.className =
          "friend-result-row";


        if (
          index >= visibleLimit
        ) {
          resultRow.classList.add(
            "hidden"
          );

          resultRow.dataset.extraResult =
            "true";
        }


                   const resultHeader =
          document.createElement(
            "div"
          );

        resultHeader.className =
          "friend-result-header";


        const nameElement =
          document.createElement(
            "div"
          );

        nameElement.className =
          "friend-result-name";

        nameElement.textContent =
          displayName;


        const streakElement =
          document.createElement(
            "span"
          );

        streakElement.className =
          "friend-result-streak";


        if (
          friendStreak > 0
        ) {
          streakElement.textContent =
            "🔥 " +
            friendStreak +
            (
              friendStreak === 1
                ? " day"
                : " days"
            );
        }


        resultHeader.append(
          nameElement
        );


        if (
          friendStreak > 0
        ) {
          resultHeader.append(
            streakElement
          );
        }


        const scoreElement =
          document.createElement(
            "div"
          );

        scoreElement.className =
          "friend-result-score";

        scoreElement.textContent =
          formatScore(
            friendScore
          );


        resultRow.append(
          resultHeader,
          scoreElement
        );


        friendResults.appendChild(
          resultRow
        );
      }


      /*
       * Only add an expand button
       * when there are more than
       * 3 friend results.
       */

      if (
        gameScores.length >
        visibleLimit
      ) {
        const hiddenCount =
          gameScores.length -
          visibleLimit;


        const toggleButton =
          document.createElement(
            "button"
          );


        toggleButton.type =
          "button";

        toggleButton.className =
          "friend-results-toggle";

        toggleButton.textContent =
          "View " +
          hiddenCount +
          (
            hiddenCount === 1
              ? " more result"
              : " more results"
          ) +
          " ▾";


        let expanded =
          false;


        toggleButton.addEventListener(
          "click",
          () => {
            expanded =
              !expanded;


            friendResults
              .querySelectorAll(
                '[data-extra-result="true"]'
              )
              .forEach(
                result => {
                  result.classList.toggle(
                    "hidden",
                    !expanded
                  );
                }
              );


            if (expanded) {
              toggleButton.textContent =
                "Show less ▴";
            } else {
              toggleButton.textContent =
                "View " +
                hiddenCount +
                (
                  hiddenCount === 1
                    ? " more result"
                    : " more results"
                ) +
                " ▾";
            }
          }
        );


        friendResults.appendChild(
          toggleButton
        );
      }


      friendResults
        .classList
        .add(
          "visible"
        );
    }


    /*
     * The bottom Friends section no longer
     * needs to duplicate every score.
     */

    const friendScoreList =
      document.getElementById(
        "friendScores"
      );


    if (
      friendScores.length === 0
    ) {
      friendScoreList.innerHTML =
        '<p class="status">' +
        "No friend results yet today." +
        "</p>";
    } else {
      await renderSocialFriendResults(
        friendScoreList,
        friendScores,
        scoreHistory,
        getCachedProfile
      );
    }

            requestAnimationFrame(
      () => {
        restoreGamePosition();
      }
    );

  } catch (error) {
    console.error(
      "Score loading failed:",
      error
    );

    const friendScoreList =
      document.getElementById(
        "friendScores"
      );

    friendScoreList.innerHTML =
      '<p class="status error">' +
      "Friend results could not be loaded." +
      "</p>";
  }
}




document
  .querySelectorAll(
    "[data-feedback-type]"
  )
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        selectedFeedbackType =
          button.dataset
            .feedbackType;

        document
          .querySelectorAll(
            "[data-feedback-type]"
          )
          .forEach(
            feedbackButton => {
              feedbackButton
                .classList
                .toggle(
                  "selected",
                  feedbackButton ===
                    button
                );
            }
          );
      }
    );
  });


document
  .getElementById(
    "feedbackForm"
  )
  .addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      const submitButton =
        document
          .getElementById(
            "submitFeedbackButton"
          );

      const feedbackMessageValue =
        document
          .getElementById(
            "feedbackMessage"
          )
          .value
          .trim();

      if (
        feedbackMessageValue
          .length < 3
      ) {
        setStatus(
          feedbackStatus,
          "Enter at least 3 characters.",
          "error"
        );

        return;
      }

      const feedbackRecord = {
        type:
          selectedFeedbackType,

        game:
          document
            .getElementById(
              "feedbackGame"
            )
            .value ||
          null,

        message:
          feedbackMessageValue,

        name:
          document
            .getElementById(
              "feedbackName"
            )
            .value
            .trim() ||
          null,

        email:
          document
            .getElementById(
              "feedbackEmail"
            )
            .value
            .trim() ||
          null,

        status:
          "new"
      };

      submitButton.disabled =
        true;

      setStatus(
        feedbackStatus,
        "Sending feedback..."
      );

      try {
        await request(
          "/rest/v1/feedback",
          {
            method: "POST",

            headers: {
              ...publicHeaders(),

              "Authorization":
                "Bearer " +
                SUPABASE_KEY,

              "Prefer":
                "return=minimal"
            },

            body:
              JSON.stringify(
                feedbackRecord
              )
          }
        );

        document
          .getElementById(
            "feedbackForm"
          )
          .reset();

        selectedFeedbackType =
          "bug";

        document
          .querySelectorAll(
            "[data-feedback-type]"
          )
          .forEach(button => {
            button.classList.toggle(
              "selected",
              button.dataset
                .feedbackType ===
                "bug"
            );
          });

        setStatus(
          feedbackStatus,
          "Thanks! Feedback sent.",
          "success"
        );
      } catch (error) {
        setStatus(
          feedbackStatus,
          error.message,
          "error"
        );
      } finally {
        submitButton.disabled =
          false;
      }
    }
  );


document
  .getElementById(
    "currentDate"
  )
  .textContent =
    new Date()
      .toLocaleDateString(
        undefined,
        {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric"
        }
      );


captureDefaultGameOrder();
applyGameOrder(
  currentGameOrder
);

document
  .querySelectorAll(
"[data-filter]"
  )
  .forEach(button => {
button.classList.toggle(
  "active",
  button.dataset.filter ===
    currentFilter
);
  });

let scrollSaveTimer =
  null;


function saveCurrentGamePosition() {
  const visibleCards =
cards().filter(card => {
  if (
    card.style.display ===
    "none"
  ) {
    return false;
  }

  const rect =
    card.getBoundingClientRect();

  return (
    rect.bottom > 0 &&
    rect.top <
      window.innerHeight
  );
});


  if (
visibleCards.length === 0
  ) {
return;
  }


  const currentCard =
visibleCards[0];


  const rect =
currentCard
  .getBoundingClientRect();


  sessionStorage.setItem(
SCROLL_GAME_KEY,
currentCard.dataset.id
  );


  sessionStorage.setItem(
SCROLL_OFFSET_KEY,
String(
  rect.top
)
  );
}


window.addEventListener(
  "scroll",
  () => {
clearTimeout(
  scrollSaveTimer
);

scrollSaveTimer =
  setTimeout(
    saveCurrentGamePosition,
    100
  );
  },
  {
passive: true
  }
);

function restoreGamePosition() {
  const gameId =
sessionStorage.getItem(
  SCROLL_GAME_KEY
);

  if (!gameId) {
return;
  }


  const savedOffset =
Number(
  sessionStorage.getItem(
    SCROLL_OFFSET_KEY
  ) || 0
);


  const gameCard =
document.querySelector(
  '.game-card[data-id="' +
  gameId +
  '"]'
);


  if (
!gameCard ||
gameCard.style.display ===
  "none" ||
gameCard.offsetParent === null
  ) {
return;
  }


  const currentTop =
gameCard
  .getBoundingClientRect()
  .top;


  window.scrollBy(
0,
currentTop -
savedOffset
  );
}


/*
 * Score reading: turn a pasted share result into a number
 * so servers can rank results and build stats.
 * Each reader returns { score, unit, failed } or null.
 * A failed game (e.g. Wordle X/6) scores one worse than the
 * worst possible finish and is saved with completed = false.
 */
/*
 * Clean a shared result for display and saving: remove links that
 * games append, so everyone's results look the same. Scores and game
 * detection read the original text first (some rely on the link).
 */
function cleanResultText(text) {
  if (!text) {
    return "";
  }

  return String(text)
    .replace(/\r\n?/g, "\n")
    // https://framed.wtf, https://www.minutecryptic.com/?utm_source=share
    .replace(/[ \t]*https?:\/\/\S+/gi, "")
    // "www.maptap.gg October 17" -> "MapTap October 17"
    .replace(/\bwww\.([a-z0-9-]+)\.[a-z.]+\S*/gi, (match, site) =>
      gameCatalog.get(site.toLowerCase())?.name || ""
    )
    .split("\n")
    .map(line => line.replace(/[ \t]+$/, ""))
    // lines that are only hashtags (#globle), only a web address
    // (boxofficega.me) or an emptied label ("Play at:")
    .filter(line =>
      !/^\s*(#[\w-]+\s*)+$/.test(line) &&
      !/^\s*[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\/?\s*$/i.test(line) &&
      !/^\s*[A-Za-z][A-Za-z ]{0,24}:\s*$/.test(line)
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


function readGuessFraction(text, pattern, maxGuesses) {
  const match =
    text.match(pattern);

  if (!match) {
    return null;
  }

  if (match[1].toUpperCase() === "X") {
    return {
      score: maxGuesses + 1,
      unit: "guesses",
      failed: true
    };
  }

  const guesses =
    Number(match[1]);

  return guesses >= 1 && guesses <= maxGuesses
    ? { score: guesses, unit: "guesses", failed: false }
    : null;
}


function readNumber(text, pattern, unit) {
  const match =
    text.match(pattern);

  return match
    ? { score: Number(match[1]), unit, failed: false }
    : null;
}


// Perceptle was added as a custom game, so it keeps that key.
const PERCEPTLE_KEY =
  "custom-d624eb38-1792591388191-perceptle";


const SCORE_READERS = {
  wordle: text =>
    readGuessFraction(text, /Wordle\s+[\d,.]+\s+([1-6X])\/6/i, 6),

  worldle: text =>
    readGuessFraction(text, /Worldle\s+#\d+[^\n]*?\b([1-6X])\/6/i, 6),

  weddle: text =>
    readGuessFraction(text, /Weddle\b[^\n]*?\s([1-8X])\/8\b/i, 8),

  poeltl: text =>
    readGuessFraction(text, /Poeltl\s+#\d+\s*\|\s*([1-8X])\/8/i, 8),

  poople: text =>
    readNumber(text, /Poople\s+#\d+\s+(\d+)\/\d+/i, "guesses"),

  globle: text => {
    const matches =
      [...text.matchAll(/=\s*(\d+)\s*$/gm)];

    return matches.length
      ? {
          score: Number(matches[matches.length - 1][1]),
          unit: "guesses",
          failed: false
        }
      : null;
  },

  contexto: text =>
    readNumber(text, /got it in\s+(\d+)\s+guess/i, "guesses"),

  framed: text => {
    const line =
      text
        .split("\n")
        .find(row => row.includes("🎥"));

    if (!line) {
      return null;
    }

    const squares =
      [...line.matchAll(/🟥|🟩|⬛/g)].map(match => match[0]);

    if (squares.length !== 6) {
      return null;
    }

    const solvedAt =
      squares.indexOf("🟩");

    return solvedAt === -1
      ? { score: 7, unit: "guesses", failed: true }
      : { score: solvedAt + 1, unit: "guesses", failed: false };
  },

  connections: text => {
    const rows =
      text
        .split("\n")
        .map(row => [...row.matchAll(/🟨|🟩|🟦|🟪/g)].map(match => match[0]))
        .filter(row => row.length === 4);

    if (rows.length === 0) {
      return null;
    }

    const solved =
      rows.filter(row => row.every(square => square === row[0])).length;

    const mistakes =
      rows.length - solved;

    // A game ends after 4 groups or 4 mistakes;
    // anything else is a partial paste.
    if (solved < 4 && mistakes < 4) {
      return null;
    }

    return {
      score: Math.min(mistakes, 4),
      unit: "mistakes",
      failed: solved < 4
    };
  },

  strands: text => {
    if (!/Strands\s+#\d+/i.test(text)) {
      return null;
    }

    return {
      score: (text.match(/💡/g) || []).length,
      unit: "hints",
      failed: false
    };
  },

  minutecryptic: text => {
    if (/no hints/i.test(text)) {
      return { score: 0, unit: "hints", failed: false };
    }

    return readNumber(text, /(\d+)\s+hints?\b/i, "hints");
  },

  guesslist: text =>
    readNumber(text, /Score:\s*(\d+)\s*\/\s*\d+/i, "points"),

  krillion: text =>
    readNumber(text, /Krillion\s+#\d+[^\n]*\n\s*(\d+)\s*(\n|$)/i, "points"),

  magnitudle: text =>
    readNumber(text, /Overall Score\s+(\d+)/i, "points"),

  maptap: text =>
    readNumber(text, /Final score:\s*(\d+)/i, "points"),

  whentaken: text =>
    readNumber(text, /I scored\s+(\d+)\s*\/\s*1000/i, "points"),

  boxoffice: text =>
    readNumber(text, /🏆\s*(\d+)/, "points"),

  duotrigordle: text => {
    const match =
      text.match(/Guesses:\s*(\d+|X)\s*\/\s*37\b/i);

    if (!match) {
      return null;
    }

    // Unsolved boards show as 🟥🟥.
    return match[1].toUpperCase() === "X" || text.includes("🟥")
      ? { score: 38, unit: "guesses", failed: true }
      : { score: Number(match[1]), unit: "guesses", failed: false };
  },

  // Rarity already counts each missed square as 100, so lower always wins.
  immaculate: text =>
    readNumber(text, /Rarity:\s*(\d+)/i, "rarity"),

  [PERCEPTLE_KEY]: text =>
    readNumber(text, /Perceptle\s+#\d+[^\n]*?\((\d+)\)/i, "points")
};


function readGameScore(gameId, resultText) {
  const reader =
    SCORE_READERS[gameId];

  if (!reader || !resultText) {
    return null;
  }

  try {
    return reader(resultText);
  } catch (error) {
    return null;
  }
}


let scoreNumberEdited =
  false;


/*
 * Show what was read from the pasted result and fill the
 * score box, unless the player typed their own number.
 */
function showDetectedScore(fillInputs) {
  const resultTextValue =
    document.getElementById("resultText").value.trim();

  const readScore =
    readGameScore(selectedScoreGame, resultTextValue);

  const detected =
    document.getElementById("scoreDetected");

  if (readScore) {
    detected.textContent =
      readScore.failed
        ? "Read as: not solved (counts as " +
          readScore.score + " " + readScore.unit + ")"
        : "Read as: " + readScore.score + " " +
          (readScore.score === 1
            ? readScore.unit.replace(/s$/, "")
            : readScore.unit);

    if (fillInputs && !scoreNumberEdited) {
      document.getElementById("numericScore").value =
        readScore.score;

      document.getElementById("scoreUnit").value =
        readScore.unit;
    }
  } else if (
    resultTextValue &&
    SCORE_READERS[selectedScoreGame]
  ) {
    detected.textContent =
      "Couldn’t read a score from this. You can type it below.";
  } else {
    detected.textContent = "";
  }
}


function prepareScoreReading() {
  scoreNumberEdited = false;

  showDetectedScore(
    document.getElementById("numericScore").value === ""
  );
}


document
  .getElementById("resultText")
  .addEventListener(
    "input",
    () => {
      showDetectedScore(true);
    }
  );

document
  .getElementById("numericScore")
  .addEventListener(
    "input",
    () => {
      scoreNumberEdited = true;
    }
  );


const SCORE_BACKFILL_KEY =
  "dailyGameHubScoreBackfill";

const SCORE_READERS_VERSION =
  "2";


/*
 * One-time pass over the player's own saved results that
 * have no number yet. Runs again only when the readers change.
 */
async function backfillMyScoreNumbers() {
  if (!session) {
    return;
  }

  const doneKey =
    SCORE_BACKFILL_KEY + "-" + session.user.id;

  try {
    if (localStorage.getItem(doneKey) === SCORE_READERS_VERSION) {
      return;
    }
  } catch (error) {}

  try {
    const rows =
      await request(
        "/rest/v1/daily_scores" +
        "?user_id=eq." +
        encodeURIComponent(session.user.id) +
        "&numeric_score=is.null" +
        "&result_text=not.is.null" +
        "&select=id,game_id,result_text",
        {
          headers: authHeaders()
        }
      );

    for (const row of rows || []) {
      const readScore =
        readGameScore(row.game_id, row.result_text);

      if (!readScore) {
        continue;
      }

      await request(
        "/rest/v1/daily_scores?id=eq." + row.id,
        {
          method: "PATCH",
          headers: authHeaders("return=minimal"),
          body: JSON.stringify({
            numeric_score: readScore.score,
            score_unit: readScore.unit,
            completed: !readScore.failed
          })
        }
      );
    }

    try {
      localStorage.setItem(doneKey, SCORE_READERS_VERSION);
    } catch (error) {}
  } catch (error) {
    console.error(
      "Score number backfill failed:",
      error
    );
  }
}


/*
 * loadTodayScores rebuilds the friend rows on each
 * card. Run calls one after another so two loads
 * can never interleave and duplicate rows.
 */
loadTodayScores = (load => {
  let running =
    Promise.resolve();

  return () => {
    running =
      running.then(load, load);

    return running;
  };
})(loadTodayScores);


/*
 * "Paste a result": read the clipboard, work out which game the
 * share text is from, and open that game's Enter Result window
 * filled in, so saving is one tap.
 */
const GAME_SIGNATURES = {
  wordle: /^\s*Wordle\s+[\d,.]+\s+[1-6X]\/6/im,
  worldle: /#Worldle\b/i,
  weddle: /\bWeddle\b/i,
  poeltl: /\bPoeltl\s+#\d+/i,
  poople: /\bPoople\s+#\d+/i,
  globle: /globle|🌎[^\n]*🌍/i,
  contexto: /contexto/i,
  framed: /\bFramed\s+#\d+|framed\.wtf/i,
  connections: /^\s*Connections\b[\s\S]*Puzzle\s+#\d+/im,
  strands: /\bStrands\s+#\d+/i,
  minutecryptic: /Minute Cryptic|minutecryptic/i,
  guesslist: /\bGuessList\b/i,
  krillion: /\bKrillion\b/i,
  magnitudle: /Size It Up|magnitudle/i,
  maptap: /maptap/i,
  whentaken: /#?WhenTaken\b/i,
  // Also its shape, so a copy without the web address is still recognised.
  boxoffice: /boxofficega\.me|Box Office Game|^[✅❌] ?\d+\s*$[\s\S]*^🏆 ?\d+\s*$/im,
  duotrigordle: /Duotrigordle/i,
  immaculate: /Immaculate Grid/i,
  [PERCEPTLE_KEY]: /Perceptle/i
};


function detectGameFromText(text) {
  return Object.keys(GAME_SIGNATURES).find(gameId =>
    GAME_SIGNATURES[gameId].test(text || "")
  ) || null;
}


function libraryCard(gameId) {
  const card =
    document.querySelector('.game-card[data-id="' + gameId + '"]');

  return card && card.dataset.userVisible !== "false" ? card : null;
}


function openResultForGame(gameId, text) {
  const card =
    libraryCard(gameId);

  if (!card) {
    return false;
  }

  document.getElementById("pasteModal").classList.remove("open");
  openScoreModalForGame(card);

  if (!session || needsUsername) {
    return true;
  }

  // The pasted text replaces whatever was in the window, without links.
  document.getElementById("resultText").value = cleanResultText(text);
  document.getElementById("numericScore").value = "";
  document.getElementById("scoreUnit").value = "";
  showDetectedScore(true);

  setStatus(
    scoreStatus,
    "Pasted as " + card.dataset.name + ". Check it, then Save Result."
  );

  return true;
}


function openPasteWindow(text, message) {
  document.getElementById("pasteText").value = text || "";
  document.getElementById("pasteGameField").classList.add("hidden");
  setStatus(pasteStatus, message || "");
  document.getElementById("pasteModal").classList.add("open");
}


function handlePastedText(text) {
  const trimmed =
    String(text || "").trim();

  if (!trimmed) {
    openPasteWindow("", "Your clipboard is empty. Copy the share text from the game, or paste it here.");
    return;
  }

  const gameId =
    detectGameFromText(trimmed);

  if (gameId && openResultForGame(gameId, trimmed)) {
    return;
  }

  openPasteWindow(
    cleanResultText(trimmed),
    gameId
      ? "This looks like " + getCatalogGame(gameId).name +
        ", which isn’t in your games. Add it in Manage Games, or pick a game below."
      : "Couldn’t tell which game this is. Pick it below."
  );

  const select =
    document.getElementById("pasteGameSelect");

  select.innerHTML = "";

  cards()
    .filter(card => card.dataset.userVisible !== "false")
    .forEach(card => {
      const option = document.createElement("option");
      option.value = card.dataset.id;
      option.textContent = card.dataset.name;
      select.appendChild(option);
    });

  document.getElementById("pasteGameField").classList.remove("hidden");
}


async function pasteResult() {
  if (!session) {
    document.getElementById("accountModal").classList.add("open");
    setStatus(authStatus, "Log in to save results.", "error");
    return;
  }

  let text = null;

  try {
    text = await navigator.clipboard.readText();
  } catch (error) {
    text = null;
  }

  if (text === null) {
    openPasteWindow("", "Paste your result here.");
    document.getElementById("pasteText").focus();
    return;
  }

  handlePastedText(text);
}


document
  .getElementById("pasteResultButton")
  .addEventListener("click", pasteResult);

document
  .getElementById("pasteContinueButton")
  .addEventListener(
    "click",
    () => {
      const text =
        document.getElementById("pasteText").value;

      const pickedGame =
        document.getElementById("pasteGameField").classList.contains("hidden")
          ? null
          : document.getElementById("pasteGameSelect").value;

      if (pickedGame && text.trim()) {
        openResultForGame(pickedGame, text);
        return;
      }

      handlePastedText(text);
    }
  );


/*
 * A game card can open full screen to show
 * everything (description, history, your result,
 * friends). It is the same card element, so all
 * existing buttons and live updates keep working.
 */
function setCardExpanded(card, open) {
  if (open) {
    document
      .querySelectorAll(".game-card.expanded")
      .forEach(otherCard => {
        if (otherCard !== card) {
          setCardExpanded(otherCard, false);
        }
      });
  }

  card.classList.toggle("expanded", open);

  document.body.classList.toggle(
    "card-open",
    Boolean(
      document.querySelector(".game-card.expanded")
    )
  );

  const expandButton =
    card.querySelector(".expand-button");

  expandButton.setAttribute(
    "aria-label",
    (open ? "Close " : "Open ") +
    card.dataset.name
  );

  expandButton.setAttribute(
    "aria-expanded",
    String(open)
  );

  if (open) {
    card.scrollTop = 0;
  }
}


document.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Escape" &&
      !document.querySelector(".modal.open")
    ) {
      document
        .querySelectorAll(".game-card.expanded")
        .forEach(card => {
          setCardExpanded(card, false);
        });
    }
  }
);


function getCatalogGame(gameId) {
  return gameCatalog.get(gameId) || {
    game_key: gameId,
    name: getGameName(gameId),
    icon: "🎮"
  };
}


function createGameBadge(gameId) {
  const game =
    getCatalogGame(gameId);

  const badge =
    document.createElement("div");

  badge.className =
    "activity-icon";

  badge.textContent =
    game.icon || "🎮";

  return badge;
}


/*
 * Order game keys like the user's library,
 * with games outside the library last.
 */
function sortByGameOrder(gameIds) {
  const position = gameId => {
    const index =
      currentGameOrder.indexOf(gameId);

    return index === -1
      ? Number.MAX_SAFE_INTEGER
      : index;
  };

  return [...gameIds].sort(
    (a, b) => position(a) - position(b)
  );
}


/*
 * Social tab: today's friend results grouped by game.
 * Uses the same rows as the results under each game card.
 */
async function renderSocialFriendResults(
  container,
  friendScores,
  scoreHistory,
  getProfile
) {
  const scoresByGame =
    new Map();

  for (const score of friendScores) {
    if (!scoresByGame.has(score.game_id)) {
      scoresByGame.set(score.game_id, []);
    }

    scoresByGame.get(score.game_id).push(score);
  }

  const fragment =
    document.createDocumentFragment();

  for (
    const gameId
    of sortByGameOrder(scoresByGame.keys())
  ) {
    const block =
      document.createElement("div");

    block.className =
      "social-game";

    const header =
      document.createElement("div");

    header.className =
      "social-game-header";

    const name =
      document.createElement("div");

    name.className =
      "social-game-name";

    name.textContent =
      getCatalogGame(gameId).name;

    header.append(
      createGameBadge(gameId),
      name
    );

    block.appendChild(header);

    for (const friendScore of scoresByGame.get(gameId)) {
      const friendProfile =
        await getProfile(friendScore.user_id);

      const friendStreak =
        calculateStreak(
          (scoreHistory || [])
            .filter(
              row =>
                row.user_id === friendScore.user_id &&
                row.game_id === friendScore.game_id
            )
            .map(row => row.play_date)
        );

      const resultRow =
        document.createElement("div");

      resultRow.className =
        "friend-result-row";

      const resultHeader =
        document.createElement("div");

      resultHeader.className =
        "friend-result-header";

      const nameElement =
        document.createElement("div");

      nameElement.className =
        "friend-result-name";

      nameElement.textContent =
        friendProfile.display_name ||
        "@" + friendProfile.username;

      resultHeader.append(nameElement);

      if (friendStreak > 0) {
        const streakElement =
          document.createElement("span");

        streakElement.className =
          "friend-result-streak";

        streakElement.textContent =
          "🔥 " +
          friendStreak +
          (friendStreak === 1 ? " day" : " days");

        resultHeader.append(streakElement);
      }

      const scoreElement =
        document.createElement("div");

      scoreElement.className =
        "friend-result-score";

      scoreElement.textContent =
        formatScore(friendScore);

      resultRow.append(
        resultHeader,
        scoreElement
      );

      block.appendChild(resultRow);
    }

    fragment.appendChild(block);
  }

  container.innerHTML = "";
  container.appendChild(fragment);
}


function longestStreak(dateValues) {
  const days =
    [...new Set(dateValues)]
      .map(date =>
        Math.round(
          new Date(date + "T12:00:00").getTime() /
          86400000
        )
      )
      .sort((a, b) => a - b);

  let best = 0;
  let run = 0;

  days.forEach((day, index) => {
    run =
      index > 0 && day - days[index - 1] === 1
        ? run + 1
        : 1;

    best = Math.max(best, run);
  });

  return best;
}


function formatDays(count) {
  return count + (count === 1 ? " day" : " days");
}


/*
 * Activity: last 16 weeks as a calendar (columns are weeks,
 * Monday at the top), shaded by how many games were played.
 */
function renderActivityCalendar(scores) {
  const calendar =
    document.getElementById("activityCalendar");

  const perDay =
    new Map();

  scores.forEach(score => {
    perDay.set(score.play_date, (perDay.get(score.play_date) || 0) + 1);
  });

  const weeks =
    16;

  const firstDay =
    addDays(periodStartDate("week", TODAY), -7 * (weeks - 1));

  const level =
    count =>
      count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4;

  calendar.innerHTML = "";

  let week = null;

  for (let offset = 0; offset < weeks * 7; offset += 1) {
    if (offset % 7 === 0) {
      week = document.createElement("div");
      week.className = "calendar-week";
      calendar.appendChild(week);
    }

    const date =
      addDays(firstDay, offset);

    const cell =
      document.createElement("button");

    cell.type =
      "button";

    const count =
      perDay.get(date) || 0;

    const label =
      new Date(date + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric"
      }) +
      ": " +
      (count === 1 ? "1 game" : count + " games");

    cell.className =
      "calendar-cell level-" + level(count) +
      (date === TODAY ? " today" : "") +
      (date > TODAY ? " future" : "");

    cell.title = label;
    cell.setAttribute("aria-label", label);

    cell.addEventListener(
      "click",
      () => {
        document.getElementById("activityCalendarNote").textContent = label;
      }
    );

    week.appendChild(cell);
  }
}


/*
 * All of the player's results, oldest first. Supabase returns at most
 * 1000 rows per request, so this reads page by page.
 */
async function loadMyScoreHistory() {
  const rows =
    [];

  const pageSize =
    1000;

  for (let offset = 0; ; offset += pageSize) {
    const page =
      await request(
        "/rest/v1/daily_scores" +
        "?user_id=eq." + encodeURIComponent(session.user.id) +
        "&select=id,game_id,play_date,numeric_score,score_unit,completed" +
        "&order=play_date.asc,id.asc" +
        "&limit=" + pageSize +
        "&offset=" + offset,
        {
          headers: authHeaders()
        }
      ) || [];

    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}


const ACTIVITY_SHOW_ALL_KEY =
  "dailyGameHubActivityShowAll";

const ACTIVITY_TOP_COUNT =
  5;

let activityShowAll =
  false;

try {
  activityShowAll =
    localStorage.getItem(ACTIVITY_SHOW_ALL_KEY) === "true";
} catch (error) {}


/*
 * Activity: one row per game (most played first) with the current
 * streak, average, personal best and games played. Top 5 by default;
 * the rest behind "Show all". Fails count at their fail score in the
 * average; best ignores fails. Tap a row for that game's history.
 */
function renderActivityGames(scores, datesByGame) {
  const table =
    document.getElementById("activityGames");

  const toggle =
    document.getElementById("activityGamesToggle");

  const byGame =
    new Map();

  scores.forEach(score => {
    if (!byGame.has(score.game_id)) {
      byGame.set(score.game_id, []);
    }

    byGame.get(score.game_id).push(score);
  });

  const games =
    [...byGame.entries()]
      .map(([gameId, results]) => {
        const direction =
          gameDirections.get(gameId) || "none";

        const numbered =
          results.filter(result =>
            result.numeric_score !== null &&
            result.numeric_score !== undefined
          );

        const solved =
          numbered
            .filter(result => result.completed !== false)
            .map(result => Number(result.numeric_score));

        return {
          gameId,
          played: results.length,
          streak: calculateStreak(datesByGame.get(gameId) || []),
          average:
            numbered.length
              ? numbered.reduce((sum, result) => sum + Number(result.numeric_score), 0) / numbered.length
              : null,
          best:
            !solved.length || direction === "none"
              ? null
              : direction === "lower"
                ? Math.min(...solved)
                : Math.max(...solved)
        };
      })
      .sort((a, b) =>
        b.played - a.played ||
        getCatalogGame(a.gameId).name.localeCompare(getCatalogGame(b.gameId).name)
      );

  document.getElementById("activityGamesNote").textContent =
    games.length > ACTIVITY_TOP_COUNT && !activityShowAll
      ? "top " + ACTIVITY_TOP_COUNT + " by played"
      : games.length
        ? "by played · tap a game for history"
        : "";

  const body =
    table.querySelector("tbody");

  body.innerHTML = "";

  if (!games.length) {
    table.classList.add("hidden");
    toggle.classList.add("hidden");
    document.getElementById("activityGamesEmpty").classList.remove("hidden");
    return;
  }

  table.classList.remove("hidden");
  document.getElementById("activityGamesEmpty").classList.add("hidden");

  const shown =
    activityShowAll ? games : games.slice(0, ACTIVITY_TOP_COUNT);

  for (const game of shown) {
    const row =
      document.createElement("tr");

    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", getCatalogGame(game.gameId).name + " history");

    const cells = [
      getCatalogGame(game.gameId).name,
      game.streak > 0 ? String(game.streak) : "–",
      formatStatNumber(game.average),
      formatStatNumber(game.best),
      String(game.played)
    ];

    cells.forEach((text, index) => {
      const cell =
        document.createElement("td");

      cell.textContent = text;

      if (index === 1) {
        cell.className = game.streak > 0 ? "activity-streak-cell" : "muted-cell";
      }

      row.appendChild(cell);
    });

    const open =
      () => {
        openGameHistory(game.gameId);
      };

    row.addEventListener("click", open);
    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });

    body.appendChild(row);
  }

  toggle.classList.toggle("hidden", games.length <= ACTIVITY_TOP_COUNT);

  toggle.textContent =
    activityShowAll
      ? "Show top " + ACTIVITY_TOP_COUNT + " ▴"
      : "Show all " + games.length + " games ▾";

  toggle.onclick =
    () => {
      activityShowAll = !activityShowAll;

      try {
        localStorage.setItem(ACTIVITY_SHOW_ALL_KEY, String(activityShowAll));
      } catch (error) {}

      renderActivityGames(scores, datesByGame);
    };
}


let activityLoaded =
  false;


/*
 * Activity tab: summary, active streaks and recent results.
 * Read-only; streaks count submitted results only.
 */
async function loadActivity() {
  if (!session) {
    activityLoaded = false;

    setStatus(
      activityStatus,
      "Log in to see your streaks and game stats."
    );

    return;
  }

  if (!activityLoaded) {
    setStatus(activityStatus, "Loading activity...");
  }

  try {
    const allScores =
      await loadMyScoreHistory();

    // Summary tiles
    const libraryGames =
      new Set(
        userGameLibrary
          .filter(row => row.is_visible !== false)
          .map(row => row.game_key)
      );

    const playedToday =
      completedGames.filter(
        gameId => libraryGames.has(gameId)
      ).length;

    document.getElementById("statPlayedToday").textContent =
      String(playedToday);

    document.getElementById("statPlayedTodaySub").textContent =
      "of " + libraryGames.size + " games";

    const datesByGame =
      new Map();

    for (const score of allScores || []) {
      if (!datesByGame.has(score.game_id)) {
        datesByGame.set(score.game_id, []);
      }

      datesByGame.get(score.game_id).push(score.play_date);
    }

    const streaks =
      [...datesByGame.entries()]
        .map(([gameId, dates]) => ({
          gameId,
          current: calculateStreak(dates),
          best: longestStreak(dates)
        }))
        .filter(streak => streak.current > 0)
        .sort(
          (a, b) =>
            b.current - a.current ||
            b.best - a.best
        );

    document.getElementById("statTopStreak").textContent =
      streaks.length ? "🔥 " + streaks[0].current : "0";

    document.getElementById("statTopStreakSub").textContent =
      streaks.length
        ? getCatalogGame(streaks[0].gameId).name
        : "days";

    document.getElementById("statResults").textContent =
      String((allScores || []).length);

    renderActivityCalendar(allScores);

    if (!gameDirections.size) {
      await loadGameDirections();
    }

    renderActivityGames(allScores, datesByGame);

    activityLoaded = true;
    setStatus(activityStatus, "");
  } catch (error) {
    console.error(
      "Activity loading failed:",
      error
    );

    setStatus(
      activityStatus,
      "Activity could not be loaded.",
      "error"
    );
  }
}


/*
 * Servers: private groups that compete on the same games.
 * Membership and visibility are enforced by Supabase RLS
 * (see supabase/servers); the UI only reflects it.
 */
const SELECTED_SERVER_KEY =
  "dailyGameHubSelectedServer";

const PENDING_JOIN_KEY =
  "dailyGameHubPendingJoin";

let myServers =
  [];

let selectedServerId =
  null;

let selectedServerGames =
  [];

let gameDirections =
  new Map();

try {
  selectedServerId =
    localStorage.getItem(SELECTED_SERVER_KEY);
} catch (error) {}


function getSelectedServer() {
  return myServers.find(
    server => server.id === selectedServerId
  ) || null;
}


function isSelectedServerOwner() {
  return Boolean(
    session &&
    getSelectedServer()?.owner_id === session.user.id
  );
}


function describeDirection(direction) {
  if (direction === "lower") {
    return "lower wins";
  }

  if (direction === "higher") {
    return "higher wins";
  }

  return "no winner";
}


function formatServerDate(dateString) {
  return new Date(dateString + "T12:00:00")
    .toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
}


async function loadGameDirections() {
  try {
    const rows =
      await request(
        "/rest/v1/games?select=game_key,score_direction",
        {
          headers: authHeaders()
        }
      );

    gameDirections =
      new Map(
        (rows || []).map(row => [
          row.game_key,
          row.score_direction
        ])
      );
  } catch (error) {
    console.error(
      "Game directions failed to load:",
      error
    );
  }
}


async function loadServers() {
  if (!session) {
    myServers = [];
    renderServers();
    return;
  }

  try {
    const [servers] =
      await Promise.all([
        request(
          "/rest/v1/servers" +
          "?select=id,name,owner_id,invite_code,start_date,created_at" +
          "&order=created_at.asc",
          {
            headers: authHeaders()
          }
        ),
        gameDirections.size
          ? Promise.resolve()
          : loadGameDirections()
      ]);

    myServers =
      servers || [];

    if (!getSelectedServer()) {
      selectedServerId =
        myServers[0]?.id || null;
    }

    renderServers();
    await loadServerDetail();
  } catch (error) {
    console.error(
      "Servers failed to load:",
      error
    );

    setStatus(
      serverStatus,
      "Servers could not be loaded.",
      "error"
    );
  }
}


function rememberSelectedServer(serverId) {
  selectedServerId =
    serverId;

  try {
    localStorage.setItem(SELECTED_SERVER_KEY, serverId);
  } catch (error) {}
}


function selectServer(serverId) {
  rememberSelectedServer(serverId);
  setStatus(serverStatus, "");
  renderServers();
  loadServerDetail();
}


function renderServers() {
  const switcher =
    document.getElementById("serverSwitcher");

  switcher.innerHTML = "";

  for (const server of myServers) {
    const chip =
      document.createElement("button");

    chip.type =
      "button";

    chip.className =
      "filter-button" +
      (server.id === selectedServerId ? " active" : "");

    chip.textContent =
      server.name;

    chip.addEventListener(
      "click",
      () => {
        selectServer(server.id);
      }
    );

    switcher.appendChild(chip);
  }

  const hasServers =
    myServers.length > 0;

  document
    .querySelector(".server-bar")
    .classList
    .toggle("hidden", !hasServers);

  document
    .getElementById("serversEmpty")
    .classList
    .toggle("hidden", hasServers);

  document
    .getElementById("serverDetail")
    .classList
    .toggle("hidden", !getSelectedServer());

  document.body.classList.toggle(
    "server-owner",
    isSelectedServerOwner()
  );

  applySocialPanel();
}


async function loadServerDetail() {
  const server =
    getSelectedServer();

  if (!server) {
    return;
  }

  document.getElementById("serverMeta").textContent =
    "Since " +
    new Date(server.start_date + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        server.start_date.slice(0, 4) === TODAY.slice(0, 4)
          ? undefined
          : "numeric"
    });

  document.getElementById("serverInviteCode").textContent =
    server.invite_code;

  try {
    const [members, games] =
      await Promise.all([
        request(
          "/rest/v1/server_members" +
          "?server_id=eq." + encodeURIComponent(server.id) +
          "&select=user_id,role,joined_at" +
          "&order=joined_at.asc",
          {
            headers: authHeaders()
          }
        ),
        request(
          "/rest/v1/server_games" +
          "?server_id=eq." + encodeURIComponent(server.id) +
          "&select=game_key,sort_order,score_direction" +
          "&order=sort_order.asc",
          {
            headers: authHeaders()
          }
        )
      ]);

    if (server.id !== selectedServerId) {
      return;
    }

    selectedServerGames =
      games || [];

    const userIds =
      (members || []).map(member => member.user_id);

    const profiles =
      userIds.length
        ? await request(
            "/rest/v1/profiles" +
            "?user_id=in.(" + userIds.join(",") + ")" +
            "&select=user_id,username,display_name",
            {
              headers: authHeaders()
            }
          )
        : [];

    await loadPlayerCards(userIds);

    selectedServerMembers =
      members || [];

    selectedServerProfiles =
      new Map(
        (profiles || []).map(profile => [profile.user_id, profile])
      );

    renderServerMembers(
      selectedServerMembers,
      selectedServerProfiles
    );

    renderServerGames();
    await loadServerBoard();
    await loadServerStats();
  } catch (error) {
    console.error(
      "Server details failed to load:",
      error
    );

    setStatus(
      serverStatus,
      "Server details could not be loaded.",
      "error"
    );
  }
}


function renderServerMembers(members, profilesById) {
  const list =
    document.getElementById("serverMembers");

  list.innerHTML = "";

  for (const member of members) {
    const profile =
      profilesById.get(member.user_id);

    const row =
      document.createElement("div");

    row.className =
      "friend-row";

    const name =
      document.createElement("div");

    name.className =
      "server-member-name";

    name.textContent =
      profile
        ? profile.display_name || "@" + profile.username
        : "Player";

    if (member.user_id === session.user.id) {
      name.textContent += " (you)";
    }

    name.prepend(playerAvatar(member.user_id, "sm"));
    makePlayerLink(name, member.user_id);

    if (member.role === "owner") {
      const badge =
        document.createElement("span");

      badge.className =
        "owner-badge";

      badge.textContent =
        "Owner";

      name.append(" ", badge);
    }

    row.appendChild(name);

    if (
      isSelectedServerOwner() &&
      member.user_id !== session.user.id
    ) {
      const removeButton =
        document.createElement("button");

      removeButton.type =
        "button";

      removeButton.className =
        "small-button";

      removeButton.textContent =
        "Remove";

      removeButton.addEventListener(
        "click",
        () => {
          removeServerMember(
            member.user_id,
            name.textContent
          );
        }
      );

      row.appendChild(removeButton);
    }

    list.appendChild(row);
  }
}


function renderServerGames() {
  const list =
    document.getElementById("serverGames");

  list.innerHTML = "";

  if (selectedServerGames.length === 0) {
    list.innerHTML =
      '<p class="status">No games yet.</p>';
    return;
  }

  for (const serverGame of selectedServerGames) {
    const row =
      document.createElement("div");

    row.className =
      "server-game-row";

    const name =
      document.createElement("div");

    name.className =
      "activity-name";

    name.textContent =
      getCatalogGame(serverGame.game_key).name;

    const rule =
      document.createElement("div");

    rule.className =
      "activity-sub";

    rule.textContent =
      describeDirection(
        serverGame.score_direction ||
        gameDirections.get(serverGame.game_key)
      );

    row.append(
      createGameBadge(serverGame.game_key),
      name,
      rule
    );

    list.appendChild(row);
  }
}


/*
 * Checkbox list of games: the player's library first,
 * then other official games, then anything already chosen.
 */
function renderServerGamePicker(container, selectedKeys) {
  const myCustomOrOfficial =
    game =>
      game.is_official ||
      game.created_by === session.user.id ||
      selectedKeys.has(game.game_key);

  const keys =
    sortByGameOrder(
      [...gameCatalog.values()]
        .filter(myCustomOrOfficial)
        .map(game => game.game_key)
    );

  container.innerHTML = "";

  for (const gameKey of keys) {
    const game =
      getCatalogGame(gameKey);

    const label =
      document.createElement("label");

    label.className =
      "onboarding-game" +
      (selectedKeys.has(gameKey) ? " selected" : "");

    const checkbox =
      document.createElement("input");

    checkbox.type =
      "checkbox";

    checkbox.className =
      "onboarding-checkbox";

    checkbox.value =
      gameKey;

    checkbox.checked =
      selectedKeys.has(gameKey);

    checkbox.addEventListener(
      "change",
      () => {
        label.classList.toggle("selected", checkbox.checked);
      }
    );

    const info =
      document.createElement("div");

    info.className =
      "onboarding-game-info";

    const name =
      document.createElement("div");

    name.className =
      "onboarding-game-name";

    name.textContent =
      (game.icon ? game.icon + " " : "") + game.name;

    const rule =
      document.createElement("div");

    rule.className =
      "onboarding-game-category";

    rule.textContent =
      describeDirection(gameDirections.get(gameKey));

    info.append(name, rule);
    label.append(checkbox, info);
    container.appendChild(label);
  }
}


function pickedGameKeys(container) {
  return [...container.querySelectorAll("input:checked")]
    .map(checkbox => checkbox.value);
}


async function openCreateServer() {
  if (!session) {
    document.getElementById("accountModal").classList.add("open");
    return;
  }

  if (!gameDirections.size) {
    await loadGameDirections();
  }

  document.getElementById("serverNameInput").value = "";

  renderServerGamePicker(
    document.getElementById("createServerGames"),
    new Set(favoriteGames)
  );

  setStatus(createServerStatus, "");
  document.getElementById("createServerModal").classList.add("open");
}


async function createServer() {
  const name =
    document.getElementById("serverNameInput").value.trim();

  const gameKeys =
    pickedGameKeys(document.getElementById("createServerGames"));

  if (!name) {
    setStatus(createServerStatus, "Give your server a name.", "error");
    return;
  }

  if (gameKeys.length === 0) {
    setStatus(createServerStatus, "Pick at least one game.", "error");
    return;
  }

  const button =
    document.getElementById("createServerButton");

  button.disabled = true;
  setStatus(createServerStatus, "Creating server...");

  try {
    const serverId =
      await request(
        "/rest/v1/rpc/create_server",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            p_name: name,
            p_game_keys: gameKeys,
            p_start_date: TODAY
          })
        }
      );

    rememberSelectedServer(serverId);
    document.getElementById("createServerModal").classList.remove("open");
    await loadServers();
    setStatus(serverStatus, "Server created. Share the invite to bring people in.", "success");
  } catch (error) {
    setStatus(createServerStatus, error.message, "error");
  } finally {
    button.disabled = false;
  }
}


function openJoinServer() {
  if (!session) {
    document.getElementById("accountModal").classList.add("open");
    return;
  }

  document.getElementById("joinCodeInput").value = "";
  setStatus(joinServerStatus, "");
  document.getElementById("joinServerModal").classList.add("open");
}


async function joinServer(code, statusElement) {
  const cleanCode =
    String(code || "").trim().toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
    setStatus(statusElement, "Invite codes are 6 letters and numbers.", "error");
    return false;
  }

  setStatus(statusElement, "Joining...");

  try {
    const serverId =
      await request(
        "/rest/v1/rpc/join_server",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            p_invite_code: cleanCode
          })
        }
      );

    rememberSelectedServer(serverId);
    await loadServers();

    setStatus(
      serverStatus,
      "You joined " + (getSelectedServer()?.name || "the server") + ".",
      "success"
    );

    return true;
  } catch (error) {
    setStatus(statusElement, error.message, "error");
    return false;
  }
}


async function openServerGames() {
  if (!gameDirections.size) {
    await loadGameDirections();
  }

  renderServerGamePicker(
    document.getElementById("serverGamesPicker"),
    new Set(selectedServerGames.map(game => game.game_key))
  );

  setStatus(serverGamesStatus, "");
  document.getElementById("serverGamesModal").classList.add("open");
}


async function saveServerGames() {
  const server =
    getSelectedServer();

  const picked =
    pickedGameKeys(document.getElementById("serverGamesPicker"));

  if (picked.length === 0) {
    setStatus(serverGamesStatus, "Keep at least one game.", "error");
    return;
  }

  const current =
    new Set(selectedServerGames.map(game => game.game_key));

  const toRemove =
    [...current].filter(key => !picked.includes(key));

  const toAdd =
    picked.filter(key => !current.has(key));

  setStatus(serverGamesStatus, "Saving...");

  try {
    if (toRemove.length) {
      await request(
        "/rest/v1/server_games" +
        "?server_id=eq." + encodeURIComponent(server.id) +
        "&game_key=in.(" + toRemove.map(encodeURIComponent).join(",") + ")",
        {
          method: "DELETE",
          headers: authHeaders("return=minimal")
        }
      );
    }

    if (toAdd.length) {
      const nextOrder =
        selectedServerGames.reduce(
          (highest, game) => Math.max(highest, game.sort_order),
          0
        ) + 1;

      await request(
        "/rest/v1/server_games",
        {
          method: "POST",
          headers: authHeaders("return=minimal"),
          body: JSON.stringify(
            toAdd.map((gameKey, index) => ({
              server_id: server.id,
              game_key: gameKey,
              sort_order: nextOrder + index
            }))
          )
        }
      );
    }

    document.getElementById("serverGamesModal").classList.remove("open");
    await loadServerDetail();
    setStatus(serverStatus, "Games updated.", "success");
  } catch (error) {
    setStatus(serverGamesStatus, error.message, "error");
  }
}


async function shareInvite() {
  const server =
    getSelectedServer();

  const link =
    location.origin +
    location.pathname +
    "?join=" +
    server.invite_code;

  const text =
    "Join my Daily Game Hub server “" + server.name + "”. " +
    "Invite code: " + server.invite_code;

  try {
    if (navigator.share) {
      await navigator.share({
        title: server.name,
        text: text,
        url: link
      });
      return;
    }

    await navigator.clipboard.writeText(text + "\n" + link);
    setStatus(serverStatus, "Invite link copied.", "success");
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }

    window.prompt("Copy this invite link:", link);
  }
}


async function renameServer() {
  const server =
    getSelectedServer();

  const name =
    window.prompt("New server name:", server.name);

  if (name === null || !name.trim() || name.trim() === server.name) {
    return;
  }

  try {
    await request(
      "/rest/v1/servers?id=eq." + encodeURIComponent(server.id),
      {
        method: "PATCH",
        headers: authHeaders("return=minimal"),
        body: JSON.stringify({
          name: name.trim().slice(0, 40)
        })
      }
    );

    await loadServers();
    setStatus(serverStatus, "Server renamed.", "success");
  } catch (error) {
    setStatus(serverStatus, error.message, "error");
  }
}


async function resetInviteCode() {
  const server =
    getSelectedServer();

  if (!window.confirm(
    "Make a new invite code? The current code and links will stop working."
  )) {
    return;
  }

  try {
    await request(
      "/rest/v1/rpc/reset_invite_code",
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          p_server_id: server.id
        })
      }
    );

    await loadServers();
    setStatus(serverStatus, "New invite code ready.", "success");
  } catch (error) {
    setStatus(serverStatus, error.message, "error");
  }
}


async function removeServerMember(userId, displayName) {
  if (!window.confirm("Remove " + displayName + " from this server?")) {
    return;
  }

  try {
    await request(
      "/rest/v1/server_members" +
      "?server_id=eq." + encodeURIComponent(selectedServerId) +
      "&user_id=eq." + encodeURIComponent(userId),
      {
        method: "DELETE",
        headers: authHeaders("return=minimal")
      }
    );

    await loadServerDetail();
    setStatus(serverStatus, displayName + " was removed.", "success");
  } catch (error) {
    setStatus(serverStatus, error.message, "error");
  }
}


async function leaveServer() {
  const server =
    getSelectedServer();

  if (!window.confirm("Leave " + server.name + "?")) {
    return;
  }

  try {
    await request(
      "/rest/v1/server_members" +
      "?server_id=eq." + encodeURIComponent(server.id) +
      "&user_id=eq." + encodeURIComponent(session.user.id),
      {
        method: "DELETE",
        headers: authHeaders("return=minimal")
      }
    );

    selectedServerId = null;
    await loadServers();
    setStatus(serverStatus, "You left " + server.name + ".", "success");
  } catch (error) {
    setStatus(serverStatus, error.message, "error");
  }
}


async function deleteServer() {
  const server =
    getSelectedServer();

  if (!window.confirm(
    "Delete " + server.name + " for everyone? " +
    "Members’ results are kept, but the server and its members list are removed."
  )) {
    return;
  }

  try {
    await request(
      "/rest/v1/servers?id=eq." + encodeURIComponent(server.id),
      {
        method: "DELETE",
        headers: authHeaders("return=minimal")
      }
    );

    selectedServerId = null;
    await loadServers();
    setStatus(serverStatus, server.name + " was deleted.", "success");
  } catch (error) {
    setStatus(serverStatus, error.message, "error");
  }
}


const SOCIAL_PANEL_KEY =
  "dailyGameHubSocialPanel";

let socialPanel =
  "today";

try {
  socialPanel =
    localStorage.getItem(SOCIAL_PANEL_KEY) || "today";
} catch (error) {}


/*
 * The Servers tab shows one panel at a time: Today, Stats or
 * Members.
 */
function applySocialPanel() {
  const hasServers =
    Boolean(session) && myServers.length > 0;

  if (!["today", "stats", "members"].includes(socialPanel)) {
    socialPanel = "today";
  }

  const panel =
    socialPanel;

  document
    .getElementById("socialSegments")
    .classList
    .toggle("hidden", !hasServers);

  document
    .querySelectorAll("[data-social-panel]")
    .forEach(button => {
      const active =
        button.dataset.socialPanel === panel;

      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });

  document
    .querySelectorAll("[data-social-section]")
    .forEach(section => {
      section.classList.toggle(
        "hidden",
        section.dataset.socialSection !== panel
      );
    });
}


document
  .querySelectorAll("[data-social-panel]")
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        socialPanel = button.dataset.socialPanel;

        try {
          localStorage.setItem(SOCIAL_PANEL_KEY, socialPanel);
        } catch (error) {}

        applySocialPanel();
        window.scrollTo(0, 0);

        // The chart measures its width, so draw it once Stats is visible.
        if (socialPanel === "stats") {
          renderServerStats();
        }
      }
    );
  });


document
  .getElementById("openServerSettingsButton")
  .addEventListener(
    "click",
    () => {
      const server =
        getSelectedServer();

      if (!server) {
        return;
      }

      document.getElementById("serverSettingsTitle").textContent =
        server.name;

      document.getElementById("serverSettingsModal").classList.add("open");
    }
  );

[
  "editServerGamesButton",
  "renameServerButton",
  "resetInviteButton",
  "deleteServerButton",
  "leaveServerButton"
].forEach(id => {
  document
    .getElementById(id)
    .addEventListener(
      "click",
      () => {
        document.getElementById("serverSettingsModal").classList.remove("open");
      }
    );
});

document
  .getElementById("serversLoginButton")
  .addEventListener(
    "click",
    () => {
      document.getElementById("accountModal").classList.add("open");
    }
  );

document
  .getElementById("openNewServerButton")
  .addEventListener(
    "click",
    () => {
      document.getElementById("newServerModal").classList.add("open");
    }
  );

document
  .getElementById("newServerCreateButton")
  .addEventListener(
    "click",
    () => {
      document.getElementById("newServerModal").classList.remove("open");
      openCreateServer();
    }
  );

document
  .getElementById("newServerJoinButton")
  .addEventListener(
    "click",
    () => {
      document.getElementById("newServerModal").classList.remove("open");
      openJoinServer();
    }
  );


/*
 * Live updates: while the app is on screen, refresh the server
 * board every 30 seconds (Servers → Today) and the results under
 * game cards every 60 seconds (Games), so new scores show up
 * without reopening anything.
 */
const BOARD_REFRESH_MS =
  30000;

const CARD_RESULTS_REFRESH_MS =
  60000;

let lastCardResultsRefresh =
  Date.now();


function refreshLiveViews(force) {
  if (!session || document.visibilityState !== "visible") {
    return;
  }

  // After midnight, reload onto the new day instead of refreshing old data.
  if (new Date().toLocaleDateString("en-CA") !== TODAY) {
    location.reload();
    return;
  }

  if (
    currentTab === "social" &&
    socialPanel === "today" &&
    getSelectedServer()
  ) {
    loadServerBoard();
  }

  if (
    currentTab === "games" &&
    (force || Date.now() - lastCardResultsRefresh >= CARD_RESULTS_REFRESH_MS)
  ) {
    lastCardResultsRefresh = Date.now();
    loadTodayScores();
  }
}


setInterval(
  () => {
    refreshLiveViews(false);
  },
  BOARD_REFRESH_MS
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (document.visibilityState === "visible") {
      refreshLiveViews(true);
    }
  }
);


/*
 * Games tab banner: yesterday's final winners in each server.
 * Loaded with a few requests for all servers together; hidden
 * until tomorrow once dismissed.
 */
const YESTERDAY_DISMISSED_KEY =
  "dailyGameHubYesterdayDismissed";


async function loadYesterdayBanner() {
  const banner =
    document.getElementById("yesterdayBanner");

  banner.classList.add("hidden");

  let dismissedOn = null;

  try {
    dismissedOn = localStorage.getItem(YESTERDAY_DISMISSED_KEY);
  } catch (error) {}

  if (!session || dismissedOn === TODAY) {
    return;
  }

  const yesterday =
    addDays(TODAY, -1);

  try {
    const servers =
      (await request(
        "/rest/v1/servers?select=id,name,start_date&order=created_at.asc",
        { headers: authHeaders() }
      ) || []).filter(server => server.start_date <= yesterday);

    if (!servers.length) {
      return;
    }

    const ids =
      servers.map(server => server.id).join(",");

    const [serverGames, members] =
      await Promise.all([
        request(
          "/rest/v1/server_games?server_id=in.(" + ids + ")&select=server_id,game_key,score_direction",
          { headers: authHeaders() }
        ),
        request(
          "/rest/v1/server_members?server_id=in.(" + ids + ")&select=server_id,user_id",
          { headers: authHeaders() }
        ),
        gameDirections.size ? Promise.resolve() : loadGameDirections()
      ]);

    const userIds =
      [...new Set((members || []).map(member => member.user_id))];

    const gameKeys =
      [...new Set((serverGames || []).map(game => game.game_key))];

    if (!userIds.length || !gameKeys.length) {
      return;
    }

    const [scores, profiles] =
      await Promise.all([
        request(
          "/rest/v1/daily_scores" +
          "?play_date=eq." + yesterday +
          "&game_id=in.(" + gameKeys.map(encodeURIComponent).join(",") + ")" +
          "&user_id=in.(" + userIds.join(",") + ")" +
          "&select=user_id,game_id,numeric_score,completed",
          { headers: authHeaders() }
        ),
        request(
          "/rest/v1/profiles?user_id=in.(" + userIds.join(",") + ")&select=user_id,username,display_name",
          { headers: authHeaders() }
        )
      ]);

    const nameOf =
      userId => {
        if (userId === session.user.id) {
          return "you";
        }

        const profile =
          (profiles || []).find(entry => entry.user_id === userId);

        return profile
          ? profile.display_name || "@" + profile.username
          : "Player";
      };

    const lines =
      [];

    for (const server of servers) {
      const memberIds =
        new Set(
          (members || [])
            .filter(member => member.server_id === server.id)
            .map(member => member.user_id)
        );

      const wins =
        new Map();

      (serverGames || [])
        .filter(game => game.server_id === server.id)
        .forEach(game => {
          const direction =
            game.score_direction ||
            gameDirections.get(game.game_key) ||
            "none";

          rankGameResults(
            (scores || []).filter(score =>
              score.game_id === game.game_key &&
              memberIds.has(score.user_id)
            ),
            direction
          )
            .ranked
            .filter(entry => entry.winner)
            .forEach(entry => {
              wins.set(
                entry.result.user_id,
                (wins.get(entry.result.user_id) || 0) + 1
              );
            });
        });

      if (!wins.size) {
        continue;
      }

      const ranking =
        [...wins.entries()].sort((a, b) => b[1] - a[1]);

      const mine =
        wins.get(session.user.id) || 0;

      const others =
        ranking
          .filter(([userId]) => userId !== session.user.id)
          .slice(0, 2)
          .map(([userId, count]) => nameOf(userId) + " " + count)
          .join(" · ");

      lines.push({
        serverId: server.id,
        text:
          (mine ? "👑 " : "") +
          "Yesterday in " + server.name + ": " +
          (mine
            ? "you won " + mine + (mine === 1 ? " game" : " games")
            : "you won none") +
          (others ? " · " + others : "")
      });
    }

    const container =
      document.getElementById("yesterdayLines");

    container.innerHTML = "";

    lines.forEach(line => {
      const button =
        document.createElement("button");

      button.type =
        "button";

      button.className =
        "yesterday-line";

      button.textContent =
        line.text;

      button.addEventListener(
        "click",
        () => {
          rememberSelectedServer(line.serverId);
          serverBoardDay = "yesterday";
          socialPanel = "today";
          switchTab("social");
        }
      );

      container.appendChild(button);
    });

    banner.classList.toggle("hidden", lines.length === 0);
  } catch (error) {
    console.error(
      "Yesterday banner failed to load:",
      error
    );
  }
}


document
  .getElementById("yesterdayCloseButton")
  .addEventListener(
    "click",
    () => {
      try {
        localStorage.setItem(YESTERDAY_DISMISSED_KEY, TODAY);
      } catch (error) {}

      document.getElementById("yesterdayBanner").classList.add("hidden");
    }
  );


/*
 * Invite links look like ...?join=ABC123. The code is kept
 * until the player is signed in, then joined automatically.
 */
function captureInviteLink() {
  const params =
    new URLSearchParams(location.search);

  const code =
    params.get("join");

  if (!code) {
    return;
  }

  try {
    localStorage.setItem(PENDING_JOIN_KEY, code);
  } catch (error) {}

  if (!session) {
    document.getElementById("accountModal").classList.add("open");

    setStatus(
      authStatus,
      "Log in or create an account to join the server."
    );
  }

  params.delete("join");

  const query =
    params.toString();

  history.replaceState(
    null,
    "",
    location.pathname + (query ? "?" + query : "") + location.hash
  );
}


async function joinPendingInvite() {
  let code = null;

  try {
    code = localStorage.getItem(PENDING_JOIN_KEY);
  } catch (error) {}

  if (!code || !session) {
    return;
  }

  try {
    localStorage.removeItem(PENDING_JOIN_KEY);
  } catch (error) {}

  switchTab("social");
  await joinServer(code, serverStatus);
}


[
  ["openCreateServerButton", openCreateServer],
  ["createServerButton", createServer],
  ["openJoinServerButton", openJoinServer],
  ["editServerGamesButton", openServerGames],
  ["saveServerGamesButton", saveServerGames],
  ["shareInviteButton", shareInvite],
  ["renameServerButton", renameServer],
  ["resetInviteButton", resetInviteCode],
  ["leaveServerButton", leaveServer],
  ["deleteServerButton", deleteServer]
].forEach(([id, handler]) => {
  document
    .getElementById(id)
    .addEventListener("click", handler);
});

document
  .getElementById("joinServerButton")
  .addEventListener(
    "click",
    async () => {
      const joined =
        await joinServer(
          document.getElementById("joinCodeInput").value,
          joinServerStatus
        );

      if (joined) {
        document.getElementById("joinServerModal").classList.remove("open");
      }
    }
  );

document
  .getElementById("joinCodeInput")
  .addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        document.getElementById("joinServerButton").click();
      }
    }
  );

captureInviteLink();


/*
 * Rank one game's results for a day.
 * direction: "lower", "higher" or "none".
 * Ties share a rank (1, 1, 3) and share the crown.
 * A failed game ranks by its fail score but can never win.
 * Results without a number are listed after the ranked ones.
 */
function rankGameResults(results, direction) {
  const hasNumber =
    result =>
      result.numeric_score !== null &&
      result.numeric_score !== undefined &&
      result.numeric_score !== "";

  if (direction !== "lower" && direction !== "higher") {
    return {
      ranked: [],
      unranked: [...results]
    };
  }

  const sign =
    direction === "lower" ? 1 : -1;

  const sorted =
    results
      .filter(hasNumber)
      .sort(
        (a, b) =>
          (a.completed === false) - (b.completed === false) ||
          sign * (Number(a.numeric_score) - Number(b.numeric_score))
      );

  const bestWinning =
    sorted.find(result => result.completed !== false);

  const ranked =
    sorted.map((result, index) => {
      let rank = index + 1;

      for (let earlier = index - 1; earlier >= 0; earlier -= 1) {
        const previous = sorted[earlier];

        if (
          Number(previous.numeric_score) === Number(result.numeric_score) &&
          (previous.completed === false) === (result.completed === false)
        ) {
          rank = earlier + 1;
        } else {
          break;
        }
      }

      return {
        result,
        rank,
        winner:
          Boolean(bestWinning) &&
          result.completed !== false &&
          Number(result.numeric_score) === Number(bestWinning.numeric_score)
      };
    });

  return {
    ranked,
    unranked: results.filter(result => !hasNumber(result))
  };
}


let serverBoardDay =
  "today";

const openBoardGames =
  new Set();

let selectedServerMembers =
  [];

let selectedServerProfiles =
  new Map();


function boardDate() {
  if (serverBoardDay === "today") {
    return TODAY;
  }

  const yesterday =
    new Date(TODAY + "T12:00:00");

  yesterday.setDate(yesterday.getDate() - 1);

  return yesterday.toLocaleDateString("en-CA");
}


function memberName(userId) {
  const profile =
    selectedServerProfiles.get(userId);

  const name =
    profile
      ? profile.display_name || "@" + profile.username
      : "Player";

  return userId === session?.user.id
    ? name + " (you)"
    : name;
}


function shortMemberName(userId) {
  if (userId === session?.user.id) {
    return "you";
  }

  const profile =
    selectedServerProfiles.get(userId);

  return profile
    ? profile.display_name || "@" + profile.username
    : "Player";
}


function describeBoardScore(result) {
  if (result.completed === false) {
    return "Not solved";
  }

  if (
    result.numeric_score === null ||
    result.numeric_score === undefined
  ) {
    return "No score";
  }

  const unit =
    result.score_unit || "";

  return (
    result.numeric_score +
    (unit
      ? " " + (Number(result.numeric_score) === 1 ? unit.replace(/s$/, "") : unit)
      : "")
  );
}


function createBoardRow(result, rank, winner) {
  const row =
    document.createElement("details");

  row.className =
    "board-row" + (winner ? " winner" : "");

  const summary =
    document.createElement("summary");

  const place =
    document.createElement("span");

  place.className =
    "board-rank";

  place.textContent =
    winner ? "👑" : rank ? String(rank) : "–";

  const name =
    document.createElement("span");

  name.className =
    "board-name";

  name.textContent =
    memberName(result.user_id);

  name.prepend(playerAvatar(result.user_id, "sm"));
  makePlayerLink(name, result.user_id);

  const score =
    document.createElement("span");

  score.className =
    "board-score";

  score.textContent =
    describeBoardScore(result);

  summary.append(place, name, score);
  row.appendChild(summary);

  const full =
    document.createElement("div");

  full.className =
    "friend-result-score board-full";

  full.textContent =
    formatScore(result);

  row.appendChild(full);

  return row;
}


async function loadServerBoard() {
  const server =
    getSelectedServer();

  const board =
    document.getElementById("serverBoard");

  const summaryLine =
    document.getElementById("serverBoardSummary");

  if (!server) {
    return;
  }

  document
    .querySelectorAll("[data-board-day]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.boardDay === serverBoardDay
      );
    });

  const date =
    boardDate();

  if (date < server.start_date) {
    summaryLine.textContent = "";
    board.innerHTML =
      '<p class="status">Scores count from ' +
      formatServerDate(server.start_date) +
      ".</p>";
    return;
  }

  const gameKeys =
    selectedServerGames.map(game => game.game_key);

  const memberIds =
    selectedServerMembers.map(member => member.user_id);

  if (gameKeys.length === 0 || memberIds.length === 0) {
    board.innerHTML = "";
    summaryLine.textContent = "";
    return;
  }

  let results =
    [];

  try {
    results =
      await request(
        "/rest/v1/daily_scores" +
        "?play_date=eq." + date +
        "&game_id=in.(" + gameKeys.map(encodeURIComponent).join(",") + ")" +
        "&user_id=in.(" + memberIds.join(",") + ")" +
        "&select=user_id,game_id,result_text,numeric_score,score_unit,completed",
        {
          headers: authHeaders()
        }
      ) || [];
  } catch (error) {
    console.error(
      "Server board failed to load:",
      error
    );

    board.innerHTML =
      '<p class="status error">Results could not be loaded.</p>';
    return;
  }

  if (
    server.id !== selectedServerId ||
    date !== boardDate()
  ) {
    return;
  }

  const isToday =
    serverBoardDay === "today";

  const leadCounts =
    new Map();

  const fragment =
    document.createDocumentFragment();

  for (const serverGame of selectedServerGames) {
    const direction =
      serverGame.score_direction ||
      gameDirections.get(serverGame.game_key) ||
      "none";

    const gameResults =
      results.filter(result => result.game_id === serverGame.game_key);

    const { ranked, unranked } =
      rankGameResults(gameResults, direction);

    const block =
      document.createElement("div");

    block.className =
      "board-game" +
      (openBoardGames.has(serverGame.game_key) ? " open" : "");

    const header =
      document.createElement("button");

    header.type =
      "button";

    header.className =
      "board-game-header";

    header.setAttribute(
      "aria-expanded",
      String(openBoardGames.has(serverGame.game_key))
    );

    const name =
      document.createElement("span");

    name.className =
      "board-game-name";

    name.textContent =
      getCatalogGame(serverGame.game_key).name;

    const winners =
      ranked.filter(entry => entry.winner);

    const lead =
      document.createElement("span");

    lead.className =
      "board-lead" + (winners.length ? " has-winner" : "");

    lead.textContent =
      winners.length
        ? "👑 " +
          winners.map(entry => shortMemberName(entry.result.user_id)).join(", ") +
          " · " + describeBoardScore(winners[0].result)
        : gameResults.length
          ? gameResults.length + " played"
          : isToday
            ? "no results yet"
            : "nobody played";

    const chevron =
      document.createElement("span");

    chevron.className =
      "board-chevron";

    chevron.textContent =
      "›";

    header.append(
      createGameBadge(serverGame.game_key),
      name,
      lead,
      chevron
    );

    header.addEventListener(
      "click",
      () => {
        const open =
          !block.classList.contains("open");

        block.classList.toggle("open", open);
        header.setAttribute("aria-expanded", String(open));

        if (open) {
          openBoardGames.add(serverGame.game_key);
        } else {
          openBoardGames.delete(serverGame.game_key);
        }
      }
    );

    const body =
      document.createElement("div");

    body.className =
      "board-game-body";

    const rule =
      document.createElement("div");

    rule.className =
      "activity-sub board-rule";

    rule.textContent =
      describeDirection(direction) +
      (winners.length > 1 ? " · tie for " + (isToday ? "the lead" : "the win") : "");

    body.appendChild(rule);
    block.append(header, body);

    if (winners.length) {
      winners.forEach(entry => {
        leadCounts.set(
          entry.result.user_id,
          (leadCounts.get(entry.result.user_id) || 0) + 1
        );
      });
    }

    ranked.forEach(entry => {
      body.appendChild(
        createBoardRow(entry.result, entry.rank, entry.winner)
      );
    });

    unranked.forEach(result => {
      body.appendChild(
        createBoardRow(result, null, false)
      );
    });

    const played =
      new Set(gameResults.map(result => result.user_id));

    const waiting =
      selectedServerMembers
        .map(member => member.user_id)
        .filter(userId => !played.has(userId));

    if (waiting.length) {
      const waitingNote =
        document.createElement("div");

      waitingNote.className =
        "board-waiting";

      waitingNote.textContent =
        (isToday ? "Not played yet: " : "Didn’t play: ") +
        waiting.map(memberName).join(", ");

      body.appendChild(waitingNote);
    }

    fragment.appendChild(block);
  }

  board.innerHTML = "";
  board.appendChild(fragment);

  const leaders =
    [...leadCounts.entries()]
      .sort((a, b) => b[1] - a[1]);

  summaryLine.textContent =
    leaders.length
      ? "👑 " +
        leaders
          .map(([userId, count]) =>
            shortMemberName(userId) + " " + count
          )
          .join(" · ") +
        (isToday ? " (leading so far)" : " (final)")
      : isToday
        ? "No winners yet today."
        : "No winners yesterday.";
}


document
  .querySelectorAll("[data-board-day]")
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        serverBoardDay = button.dataset.boardDay;
        loadServerBoard();
      }
    );
  });


function addDays(dateString, days) {
  const date =
    new Date(dateString + "T12:00:00");

  date.setDate(date.getDate() + days);

  return date.toLocaleDateString("en-CA");
}


function daysBetween(fromDate, toDate) {
  return Math.round(
    (new Date(toDate + "T12:00:00") - new Date(fromDate + "T12:00:00")) /
    86400000
  );
}


/*
 * First day of a stats period. Weeks start on Monday.
 */
function periodStartDate(period, today) {
  const date =
    new Date(today + "T12:00:00");

  if (period === "week") {
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  } else if (period === "month") {
    date.setDate(1);
  } else if (period === "year") {
    date.setMonth(0, 1);
  } else {
    return null;
  }

  return date.toLocaleDateString("en-CA");
}


/*
 * Compare two results for head-to-head: 1 if a beat b,
 * -1 if b beat a, 0 for a tie, null if they can't be compared.
 */
function compareResults(a, b, direction) {
  const hasNumber =
    result =>
      result.numeric_score !== null &&
      result.numeric_score !== undefined;

  if (
    (direction !== "lower" && direction !== "higher") ||
    !hasNumber(a) ||
    !hasNumber(b)
  ) {
    return null;
  }

  const aFailed = a.completed === false;
  const bFailed = b.completed === false;

  if (aFailed || bFailed) {
    return aFailed === bFailed ? 0 : aFailed ? -1 : 1;
  }

  const difference =
    Number(a.numeric_score) - Number(b.numeric_score);

  if (difference === 0) {
    return 0;
  }

  return (difference < 0) === (direction === "lower") ? 1 : -1;
}


/*
 * Server stats over finished days (fromDate..toDate inclusive).
 * rows: daily_scores rows for the server's members and games.
 * games: [{ game_key, direction }]. Only gameKey (or all) counted.
 */
function computeServerStats({ rows, memberIds, games, gameKey, fromDate, toDate, me }) {
  const dayCount =
    fromDate > toDate ? 0 : daysBetween(fromDate, toDate) + 1;

  const counted =
    games.filter(game => !gameKey || game.game_key === gameKey);

  const directionOf =
    new Map(counted.map(game => [game.game_key, game.direction]));

  const inRange =
    rows.filter(row =>
      directionOf.has(row.game_id) &&
      memberIds.includes(row.user_id) &&
      row.play_date >= fromDate &&
      row.play_date <= toDate
    );

  const players =
    new Map(
      memberIds.map(userId => [userId, {
        userId,
        played: 0,
        wins: 0,
        scored: 0,
        total: 0,
        best: null,
        worst: null,
        winDays: new Set(),
        currentWinStreak: 0,
        bestWinStreak: 0
      }])
    );

  const byGameDay =
    new Map();

  for (const row of inRange) {
    const key =
      row.game_id + "|" + row.play_date;

    if (!byGameDay.has(key)) {
      byGameDay.set(key, []);
    }

    byGameDay.get(key).push(row);

    const player =
      players.get(row.user_id);

    player.played += 1;

    const direction =
      directionOf.get(row.game_id);

    if (
      gameKey &&
      row.numeric_score !== null &&
      row.numeric_score !== undefined
    ) {
      const score =
        Number(row.numeric_score);

      player.scored += 1;
      player.total += score;

      if (direction === "lower" || direction === "higher") {
        const better =
          (x, y) => direction === "lower" ? x < y : x > y;

        if (
          row.completed !== false &&
          (player.best === null || better(score, player.best))
        ) {
          player.best = score;
        }

        if (player.worst === null || better(player.worst, score)) {
          player.worst = score;
        }
      }
    }
  }

  for (const [key, dayRows] of byGameDay) {
    const [game, date] =
      key.split("|");

    rankGameResults(dayRows, directionOf.get(game))
      .ranked
      .filter(entry => entry.winner)
      .forEach(entry => {
        const player = players.get(entry.result.user_id);

        player.wins += 1;
        player.winDays.add(date);
      });
  }

  // Win streaks: consecutive calendar days with at least one win.
  for (const player of players.values()) {
    let run = 0;

    for (let offset = 0; offset < dayCount; offset += 1) {
      run = player.winDays.has(addDays(fromDate, offset)) ? run + 1 : 0;
      player.bestWinStreak = Math.max(player.bestWinStreak, run);
    }

    player.currentWinStreak = run;
  }

  const possible =
    dayCount * counted.length;

  const leaderboard =
    [...players.values()]
      .map(player => ({
        userId: player.userId,
        played: player.played,
        playedRate: possible ? player.played / possible : 0,
        wins: player.wins,
        winRate: player.played ? player.wins / player.played : 0,
        average: player.scored ? player.total / player.scored : null,
        best: player.best,
        worst: player.worst,
        currentWinStreak: player.currentWinStreak,
        bestWinStreak: player.bestWinStreak
      }))
      .sort(
        (a, b) =>
          b.wins - a.wins ||
          b.winRate - a.winRate ||
          b.played - a.played
      );

  // Head-to-head: me against each other member.
  const headToHead =
    new Map(
      memberIds
        .filter(userId => userId !== me)
        .map(userId => [userId, { wins: 0, losses: 0, ties: 0 }])
    );

  for (const [key, dayRows] of byGameDay) {
    const mine =
      dayRows.find(row => row.user_id === me);

    if (!mine) {
      continue;
    }

    const direction =
      directionOf.get(key.split("|")[0]);

    for (const theirs of dayRows) {
      const record =
        headToHead.get(theirs.user_id);

      if (!record) {
        continue;
      }

      const outcome =
        compareResults(mine, theirs, direction);

      if (outcome === 1) {
        record.wins += 1;
      } else if (outcome === -1) {
        record.losses += 1;
      } else if (outcome === 0) {
        record.ties += 1;
      }
    }
  }

  return {
    dayCount,
    leaderboard,
    headToHead,
    winDaysByPlayer:
      new Map([...players.values()].map(player => [player.userId, player.winDays])),
    winCountsByDay:
      [...byGameDay].reduce((counts, [key, dayRows]) => {
        const date = key.split("|")[1];

        rankGameResults(dayRows, directionOf.get(key.split("|")[0]))
          .ranked
          .filter(entry => entry.winner)
          .forEach(entry => {
            const id = entry.result.user_id + "|" + date;
            counts.set(id, (counts.get(id) || 0) + 1);
          });

        return counts;
      }, new Map()),
    rows: inRange
  };
}


let statsPeriod =
  "month";

let statsGameKey =
  "";

let statsRowsCache =
  { serverId: null, rows: [] };


function memberColor(userId) {
  const index =
    selectedServerMembers.findIndex(member => member.user_id === userId);

  return index >= 0 && index < 8
    ? "var(--series-" + (index + 1) + ")"
    : "var(--muted)";
}


function formatStatNumber(value) {
  if (value === null || value === undefined) {
    return "–";
  }

  return Math.abs(value) >= 100 || Number.isInteger(value)
    ? String(Math.round(value))
    : value.toFixed(1);
}


function formatPercent(rate) {
  return Math.round(rate * 100) + "%";
}


function serverGameDirection(serverGame) {
  return (
    serverGame.score_direction ||
    gameDirections.get(serverGame.game_key) ||
    "none"
  );
}


/*
 * All of the server's results from its start through yesterday,
 * fetched in pages (Supabase returns at most 1000 rows per request).
 */
async function loadServerStatsRows(server, toDate) {
  const gameKeys =
    selectedServerGames.map(game => game.game_key);

  const memberIds =
    selectedServerMembers.map(member => member.user_id);

  const rows =
    [];

  if (!gameKeys.length || !memberIds.length) {
    return rows;
  }

  const pageSize =
    1000;

  for (let offset = 0; ; offset += pageSize) {
    const page =
      await request(
        "/rest/v1/daily_scores" +
        "?play_date=gte." + server.start_date +
        "&play_date=lte." + toDate +
        "&game_id=in.(" + gameKeys.map(encodeURIComponent).join(",") + ")" +
        "&user_id=in.(" + memberIds.join(",") + ")" +
        "&select=user_id,game_id,play_date,numeric_score,score_unit,completed" +
        "&order=play_date.asc,id.asc" +
        "&limit=" + pageSize +
        "&offset=" + offset,
        {
          headers: authHeaders()
        }
      ) || [];

    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}


async function loadServerStats() {
  const server =
    getSelectedServer();

  if (!server) {
    return;
  }

  const yesterday =
    addDays(TODAY, -1);

  if (server.start_date > yesterday) {
    statsRowsCache = { serverId: server.id, rows: [] };
    renderServerStats();
    return;
  }

  try {
    const rows =
      await loadServerStatsRows(server, yesterday);

    if (server.id !== selectedServerId) {
      return;
    }

    statsRowsCache = { serverId: server.id, rows };
    renderServerStats();
  } catch (error) {
    console.error(
      "Server stats failed to load:",
      error
    );

    setStatus(statsStatus, "Stats could not be loaded.", "error");
  }
}


function renderStatsControls() {
  document
    .querySelectorAll("[data-stats-period]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.statsPeriod === statsPeriod
      );
    });

  const select =
    document.getElementById("statsGame");

  if (!selectedServerGames.some(game => game.game_key === statsGameKey)) {
    statsGameKey = "";
  }

  select.innerHTML = "";

  const allOption =
    document.createElement("option");

  allOption.value = "";
  allOption.textContent = "All games";
  select.appendChild(allOption);

  for (const serverGame of selectedServerGames) {
    const option =
      document.createElement("option");

    option.value = serverGame.game_key;
    option.textContent = getCatalogGame(serverGame.game_key).name;
    select.appendChild(option);
  }

  select.value = statsGameKey;
}


function renderServerStats() {
  const server =
    getSelectedServer();

  if (!server || statsRowsCache.serverId !== server.id) {
    return;
  }

  renderStatsControls();
  setStatus(statsStatus, "");

  const yesterday =
    addDays(TODAY, -1);

  const leaderboardList =
    document.getElementById("statsLeaderboard");

  const headToHeadList =
    document.getElementById("statsHeadToHead");

  const chartWrap =
    document.getElementById("statsChartWrap");

  leaderboardList.innerHTML = "";
  headToHeadList.innerHTML = "";

  const statsStarted =
    server.start_date <= yesterday;

  document.querySelector(".stats-periods").classList.toggle("hidden", !statsStarted);
  document.getElementById("statsGame").classList.toggle("hidden", !statsStarted);

  if (!statsStarted) {
    document.getElementById("statsRange").textContent =
      "Stats start after the first full day. Check back tomorrow.";
    document.getElementById("statsHeadToHeadTitle").classList.add("hidden");
    chartWrap.classList.add("hidden");
    return;
  }

  const periodStart =
    periodStartDate(statsPeriod, TODAY);

  const fromDate =
    periodStart && periodStart > server.start_date
      ? periodStart
      : server.start_date;

  const games =
    selectedServerGames.map(serverGame => ({
      game_key: serverGame.game_key,
      direction: serverGameDirection(serverGame)
    }));

  const singleGame =
    games.find(game => game.game_key === statsGameKey) || null;

  const stats =
    computeServerStats({
      rows: statsRowsCache.rows,
      memberIds: selectedServerMembers.map(member => member.user_id),
      games,
      gameKey: statsGameKey || null,
      fromDate,
      toDate: yesterday,
      me: session.user.id
    });

  document.getElementById("statsRange").textContent =
    stats.dayCount
      ? formatServerDate(fromDate) +
        (stats.dayCount > 1 ? " – " + formatServerDate(yesterday) : "") +
        " · " + stats.dayCount + (stats.dayCount === 1 ? " finished day" : " finished days")
      : "No finished days in this period yet.";

  const hasWinner =
    !singleGame || singleGame.direction !== "none";

  lastStandings = {
    serverName: server.name,
    period:
      document.querySelector("[data-stats-period].active")?.textContent.trim() || "",
    gameName: singleGame ? getCatalogGame(singleGame.game_key).name : "All games",
    range: document.getElementById("statsRange").textContent,
    hasWinner,
    leaderboard: stats.leaderboard.map(entry => ({ ...entry, name: memberName(entry.userId) }))
  };

  document
    .getElementById("shareStandingsButton")
    .classList
    .toggle("hidden", stats.dayCount === 0);

  // Leaderboard
  let previous = null;

  stats.leaderboard.forEach((entry, index) => {
    const sameAsPrevious =
      previous &&
      previous.wins === entry.wins &&
      previous.winRate === entry.winRate &&
      previous.played === entry.played;

    entry.rank =
      sameAsPrevious ? previous.rank : index + 1;

    previous = entry;

    const row =
      document.createElement("div");

    row.className =
      "stats-row";

    const top =
      document.createElement("div");

    top.className =
      "stats-row-top";

    const rank =
      document.createElement("span");

    rank.className =
      "board-rank";

    rank.textContent =
      hasWinner && entry.wins > 0 && entry.rank === 1 ? "👑" : String(entry.rank);

    const key =
      document.createElement("span");

    key.className =
      "series-key";

    key.style.background =
      memberColor(entry.userId);

    const name =
      document.createElement("span");

    name.className =
      "board-name";

    name.textContent =
      memberName(entry.userId);

    name.prepend(playerAvatar(entry.userId, "sm"));
    makePlayerLink(name, entry.userId);

    const headline =
      document.createElement("span");

    headline.className =
      "stats-headline";

    headline.textContent =
      hasWinner
        ? entry.wins + (entry.wins === 1 ? " win" : " wins")
        : entry.played + " played";

    top.append(rank, key, name, headline);

    const details =
      [];

    if (hasWinner) {
      details.push(formatPercent(entry.winRate) + " win rate");
    }

    details.push(
      "played " + entry.played + " (" + formatPercent(entry.playedRate) + ")"
    );

    if (singleGame && entry.average !== null) {
      details.push("avg " + formatStatNumber(entry.average));

      if (singleGame.direction !== "none") {
        details.push(
          "best " + formatStatNumber(entry.best),
          "worst " + formatStatNumber(entry.worst)
        );
      }
    }

    if (hasWinner && entry.bestWinStreak > 0) {
      details.push(
        "🔥 " + entry.currentWinStreak + " win streak (best " + entry.bestWinStreak + ")"
      );
    }

    const sub =
      document.createElement("div");

    sub.className =
      "stats-row-sub";

    sub.textContent =
      details.join(" · ");

    row.append(top, sub);
    leaderboardList.appendChild(row);
  });

  renderGameAverages(
    singleGame ? [] : games,
    stats.rows
  );

  // Head-to-head (you against each member)
  const headToHeadTitle =
    document.getElementById("statsHeadToHeadTitle");

  headToHeadTitle.classList.toggle(
    "hidden",
    !hasWinner || stats.headToHead.size === 0
  );

  if (hasWinner) {
    for (const [userId, record] of stats.headToHead) {
      const row =
        document.createElement("div");

      row.className =
        "stats-h2h";

      const name =
        document.createElement("span");

      name.className =
        "board-name";

      name.textContent =
        "vs " + memberName(userId);

      const tally =
        document.createElement("span");

      tally.className =
        "stats-headline";

      tally.textContent =
        record.wins + "–" + record.losses + "–" + record.ties;

      const verdict =
        document.createElement("span");

      verdict.className =
        "activity-sub";

      verdict.textContent =
        record.wins + record.losses + record.ties === 0
          ? "no games together"
          : record.wins > record.losses
            ? "you lead"
            : record.wins < record.losses
              ? "they lead"
              : "even";

      row.append(name, verdict, tally);
      headToHeadList.appendChild(row);
    }
  }

  // Chart
  if (!hasWinner || stats.dayCount === 0) {
    chartWrap.classList.add("hidden");
    return;
  }

  chartWrap.classList.remove("hidden");
  renderStatsChart(stats, singleGame, fromDate, yesterday);
}


/*
 * All-games view: each game's average per member, best first.
 * Averages can't be combined across games (guesses vs points),
 * so they are listed per game. Failed games count at their
 * fail score, as in the single-game view.
 */
function renderGameAverages(games, rows) {
  const list =
    document.getElementById("statsAverages");

  list.innerHTML = "";

  const lines =
    games
      .map(game => {
        const totals =
          new Map();

        rows
          .filter(row =>
            row.game_id === game.game_key &&
            row.numeric_score !== null &&
            row.numeric_score !== undefined
          )
          .forEach(row => {
            const total =
              totals.get(row.user_id) || { sum: 0, count: 0 };

            total.sum += Number(row.numeric_score);
            total.count += 1;
            totals.set(row.user_id, total);
          });

        const averages =
          [...totals.entries()]
            .map(([userId, total]) => ({
              userId,
              average: total.sum / total.count,
              count: total.count
            }))
            .sort((a, b) =>
              game.direction === "higher"
                ? b.average - a.average
                : a.average - b.average
            );

        return { game, averages };
      })
      .filter(line => line.averages.length);

  document
    .getElementById("statsAveragesTitle")
    .classList
    .toggle("hidden", lines.length === 0);

  for (const { game, averages } of lines) {
    const row =
      document.createElement("div");

    row.className =
      "stats-row";

    const top =
      document.createElement("div");

    top.className =
      "stats-average-top";

    const name =
      document.createElement("span");

    name.className =
      "board-name";

    name.textContent =
      getCatalogGame(game.game_key).name;

    const rule =
      document.createElement("span");

    rule.className =
      "activity-sub";

    rule.textContent =
      (selectedServerUnit(game.game_key) || "score") +
      (game.direction === "none" ? "" : " · " + describeDirection(game.direction));

    top.append(
      createGameBadge(game.game_key),
      name,
      rule
    );

    const values =
      document.createElement("div");

    values.className =
      "stats-average-values";

    const best =
      averages[0].average;

    averages.forEach((entry, index) => {
      const item =
        document.createElement("span");

      item.className =
        "stats-average-item";

      const key =
        document.createElement("span");

      key.className =
        "series-key";

      key.style.background =
        memberColor(entry.userId);

      const label =
        document.createElement("span");

      label.textContent =
        (game.direction !== "none" && entry.average === best ? "👑 " : "") +
        shortMemberName(entry.userId) + " ";

      const value =
        document.createElement("strong");

      value.textContent =
        formatStatNumber(entry.average);

      item.append(key, label, value);

      if (index < averages.length - 1) {
        item.append(" ");
      }

      values.appendChild(item);
    });

    row.append(top, values);
    list.appendChild(row);
  }
}


/*
 * Share standings: draw the current leaderboard as a picture and
 * open the share sheet (or download it where sharing files isn't
 * supported).
 */
let lastStandings =
  null;


function drawStandingsImage(standings) {
  // Same tie rule as the leaderboard: equal wins, win rate and
  // games played share a rank.
  let previous = null;

  const rows =
    standings.leaderboard
      .map((entry, index) => {
        const tied =
          previous &&
          previous.wins === entry.wins &&
          previous.winRate === entry.winRate &&
          previous.played === entry.played;

        const ranked =
          { ...entry, rank: tied ? previous.rank : index + 1 };

        previous = ranked;
        return ranked;
      })
      .slice(0, 10);

  const width = 1080;
  const rowHeight = 96;
  const top = 260;
  const height = top + rows.length * rowHeight + 120;

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext("2d");

  const gradient =
    context.createLinearGradient(0, 0, width, height);

  gradient.addColorStop(0, "#1b1340");
  gradient.addColorStop(1, "#080c18");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const font =
    (weight, size) =>
      weight + " " + size + "px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  context.fillStyle = "#a78bfa";
  context.font = font(800, 30);
  context.fillText("DAILY GAME HUB", 64, 86);

  context.fillStyle = "#f8fafc";
  context.font = font(900, 64);
  context.fillText(standings.serverName, 64, 160);

  context.fillStyle = "#94a3b8";
  context.font = font(600, 32);
  context.fillText(
    [standings.period, standings.gameName].filter(Boolean).join(" · ") +
    (standings.range ? "  ·  " + standings.range.split(" · ").pop() : ""),
    64,
    214
  );

  rows.forEach((entry, index) => {
    const y =
      top + index * rowHeight;

    context.fillStyle =
      index % 2 === 0 ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.02)";

    context.fillRect(48, y, width - 96, rowHeight - 12);

    const middle =
      y + (rowHeight - 12) / 2 + 12;

    context.fillStyle = "#fbbf24";
    context.font = font(900, 40);
    context.fillText(
      standings.hasWinner && entry.rank === 1 && entry.wins > 0 ? "👑" : String(entry.rank),
      76,
      middle
    );

    context.fillStyle = "#f8fafc";
    context.font = font(800, 40);
    context.fillText(entry.name.replace(" (you)", ""), 160, middle);

    context.textAlign = "right";
    context.font = font(900, 40);
    context.fillText(
      standings.hasWinner
        ? entry.wins + (entry.wins === 1 ? " win" : " wins")
        : entry.played + " played",
      width - 260,
      middle
    );

    context.fillStyle = "#94a3b8";
    context.font = font(600, 32);
    context.fillText(
      standings.hasWinner
        ? formatPercent(entry.winRate)
        : formatPercent(entry.playedRate),
      width - 76,
      middle
    );

    context.textAlign = "left";
  });

  context.fillStyle = "#64748b";
  context.font = font(600, 26);
  context.fillText(
    "ethandodz.github.io/daily-game-hub",
    64,
    height - 50
  );

  return canvas;
}


async function shareStandings() {
  if (!lastStandings) {
    return;
  }

  const canvas =
    drawStandingsImage(lastStandings);

  const blob =
    await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

  const fileName =
    lastStandings.serverName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() +
    "-standings.png";

  const file =
    new File([blob], fileName, { type: "image/png" });

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: lastStandings.serverName + " standings"
      });
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }
  }

  const link =
    document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  setStatus(statsStatus, "Standings image saved.", "success");
}


document
  .getElementById("shareStandingsButton")
  .addEventListener("click", shareStandings);


/*
 * Day buckets up to a month, weeks up to ~6 months, then months.
 */
function statsBuckets(fromDate, toDate) {
  const span =
    daysBetween(fromDate, toDate) + 1;

  const unit =
    span <= 31 ? "day" : span <= 183 ? "week" : "month";

  const bucketOf =
    date => {
      if (unit === "day") {
        return date;
      }

      if (unit === "week") {
        return periodStartDate("week", date);
      }

      return date.slice(0, 7) + "-01";
    };

  const keys =
    [];

  for (let offset = 0; offset < span; offset += 1) {
    const key =
      bucketOf(addDays(fromDate, offset));

    if (keys[keys.length - 1] !== key) {
      keys.push(key);
    }
  }

  const label =
    key => {
      const date = new Date(key + "T12:00:00");

      return unit === "month"
        ? date.toLocaleDateString(undefined, { month: "short", year: "numeric" })
        : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

  return { unit, keys, bucketOf, label };
}


function renderStatsChart(stats, singleGame, fromDate, toDate) {
  const buckets =
    statsBuckets(fromDate, toDate);

  const plotted =
    selectedServerMembers.slice(0, 8).map(member => member.user_id);

  const series =
    plotted.map(userId => {
      let values;

      if (!singleGame) {
        // Cumulative wins at the end of each bucket.
        let running = 0;

        const winsByBucket =
          new Map();

        for (const [key, count] of stats.winCountsByDay) {
          const [winner, date] = key.split("|");

          if (winner === userId) {
            const bucket = buckets.bucketOf(date);
            winsByBucket.set(bucket, (winsByBucket.get(bucket) || 0) + count);
          }
        }

        values =
          buckets.keys.map(bucket => {
            running += winsByBucket.get(bucket) || 0;
            return running;
          });
      } else {
        // Average score in each bucket; gaps where they didn't play.
        const sums =
          new Map();

        stats.rows
          .filter(row =>
            row.user_id === userId &&
            row.numeric_score !== null &&
            row.numeric_score !== undefined
          )
          .forEach(row => {
            const bucket = buckets.bucketOf(row.play_date);
            const sum = sums.get(bucket) || { total: 0, count: 0 };

            sum.total += Number(row.numeric_score);
            sum.count += 1;
            sums.set(bucket, sum);
          });

        values =
          buckets.keys.map(bucket =>
            sums.has(bucket)
              ? sums.get(bucket).total / sums.get(bucket).count
              : null
          );
      }

      return {
        userId,
        name: memberName(userId),
        color: memberColor(userId),
        values
      };
    });

  const title =
    document.getElementById("statsChartTitle");

  title.textContent =
    !singleGame
      ? "Wins over time"
      : "Average " +
        (selectedServerUnit(singleGame.game_key) || "score") +
        " per " + buckets.unit +
        (singleGame.direction === "lower" ? " · lower is better" : " · higher is better");

  document.getElementById("statsChartNote").textContent =
    selectedServerMembers.length > 8
      ? "Chart shows the first 8 members to join; everyone is in the list above."
      : "";

  drawLineChart(
    document.getElementById("statsChart"),
    document.getElementById("statsLegend"),
    series,
    buckets.keys.map(buckets.label),
    !singleGame,
    singleGame?.direction === "lower"
  );
}


function selectedServerUnit(gameKey) {
  const row =
    statsRowsCache.rows.find(entry => entry.game_id === gameKey && entry.score_unit);

  return row?.score_unit || {
    lower: null,
    higher: "points"
  }[gameDirections.get(gameKey)] || null;
}


function niceTicks(min, max, count) {
  if (min === max) {
    max = min + 1;
  }

  const rough =
    (max - min) / count;

  const magnitude =
    Math.pow(10, Math.floor(Math.log10(rough)));

  const step =
    [1, 2, 2.5, 5, 10]
      .map(factor => factor * magnitude)
      .find(candidate => candidate >= rough);

  const ticks =
    [];

  for (
    let value = Math.floor(min / step) * step;
    value <= Math.ceil(max / step) * step + step / 2;
    value += step
  ) {
    ticks.push(Number(value.toFixed(6)));
  }

  return ticks;
}


function drawLineChart(container, legend, series, labels, fromZero, lowerIsBetter) {
  const svgNS =
    "http://www.w3.org/2000/svg";

  const width =
    Math.max(container.clientWidth || 0, 260);

  const height =
    200;

  const margin =
    { top: 10, right: 12, bottom: 24, left: 36 };

  const allValues =
    series.flatMap(line => line.values).filter(value => value !== null);

  const ticks =
    niceTicks(
      fromZero ? 0 : Math.min(...allValues, Infinity),
      Math.max(...allValues, fromZero ? 1 : -Infinity),
      4
    );

  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

  const plotWidth =
    width - margin.left - margin.right;

  const plotHeight =
    height - margin.top - margin.bottom;

  const x =
    index =>
      margin.left +
      (labels.length === 1 ? plotWidth / 2 : (index / (labels.length - 1)) * plotWidth);

  const y =
    value =>
      margin.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;

  const svg =
    document.createElementNS(svgNS, "svg");

  svg.setAttribute("viewBox", "0 0 " + width + " " + height);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("class", "stats-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", document.getElementById("statsChartTitle").textContent);

  const make =
    (tag, attributes) => {
      const element = document.createElementNS(svgNS, tag);

      Object.entries(attributes).forEach(([name, value]) => {
        element.setAttribute(name, value);
      });

      return element;
    };

  // Grid and y-axis labels
  for (const tick of ticks) {
    svg.appendChild(make("line", {
      x1: margin.left,
      x2: width - margin.right,
      y1: y(tick),
      y2: y(tick),
      class: "chart-grid"
    }));

    const label =
      make("text", {
        x: margin.left - 6,
        y: y(tick) + 3,
        "text-anchor": "end",
        class: "chart-axis"
      });

    label.textContent = formatStatNumber(tick);
    svg.appendChild(label);
  }

  // X-axis labels: first, middle, last
  [...new Set([0, Math.floor((labels.length - 1) / 2), labels.length - 1])]
    .forEach(index => {
      const label =
        make("text", {
          x: x(index),
          y: height - 6,
          "text-anchor":
            labels.length === 1 ? "middle" : index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle",
          class: "chart-axis"
        });

      label.textContent = labels[index];
      svg.appendChild(label);
    });

  // Lines, broken where there is no value; dots for lone points and line ends
  for (const line of series) {
    let path = "";
    let segmentLength = 0;

    const flushLonePoint =
      index => {
        if (segmentLength === 1) {
          svg.appendChild(make("circle", {
            cx: x(index),
            cy: y(line.values[index]),
            r: 4,
            fill: line.color,
            class: "chart-dot"
          }));
        }
      };

    line.values.forEach((value, index) => {
      if (value === null) {
        flushLonePoint(index - 1);
        segmentLength = 0;
        return;
      }

      path += (segmentLength ? "L" : "M") + x(index).toFixed(1) + " " + y(value).toFixed(1);
      segmentLength += 1;
    });

    flushLonePoint(line.values.length - 1);

    if (path) {
      svg.appendChild(make("path", {
        d: path,
        stroke: line.color,
        class: "chart-line"
      }));
    }

    const lastIndex =
      line.values.map(value => value !== null).lastIndexOf(true);

    if (lastIndex >= 0) {
      svg.appendChild(make("circle", {
        cx: x(lastIndex),
        cy: y(line.values[lastIndex]),
        r: 4,
        fill: line.color,
        class: "chart-dot"
      }));
    }
  }

  // Crosshair + tooltip: tap or hover anywhere to read every player at that point
  const crosshair =
    make("line", {
      y1: margin.top,
      y2: margin.top + plotHeight,
      class: "chart-crosshair",
      visibility: "hidden"
    });

  svg.appendChild(crosshair);

  const hitArea =
    make("rect", {
      x: margin.left - 10,
      y: 0,
      width: plotWidth + 20,
      height: height,
      fill: "transparent"
    });

  svg.appendChild(hitArea);

  const tooltip =
    document.createElement("div");

  tooltip.className =
    "chart-tooltip hidden";

  const showAt =
    clientX => {
      const box = svg.getBoundingClientRect();
      const localX = ((clientX - box.left) / box.width) * width;

      const index =
        labels.length === 1
          ? 0
          : Math.max(0, Math.min(labels.length - 1, Math.round(((localX - margin.left) / plotWidth) * (labels.length - 1))));

      crosshair.setAttribute("x1", x(index));
      crosshair.setAttribute("x2", x(index));
      crosshair.setAttribute("visibility", "visible");

      tooltip.innerHTML = "";

      const heading =
        document.createElement("div");

      heading.className = "chart-tooltip-title";
      heading.textContent = labels[index];
      tooltip.appendChild(heading);

      series
        .filter(line => line.values[index] !== null)
        .sort((a, b) =>
          lowerIsBetter
            ? a.values[index] - b.values[index]
            : b.values[index] - a.values[index]
        )
        .forEach(line => {
          const row = document.createElement("div");
          row.className = "chart-tooltip-row";

          const key = document.createElement("span");
          key.className = "line-key";
          key.style.background = line.color;

          const value = document.createElement("strong");
          value.textContent = formatStatNumber(line.values[index]);

          const name = document.createElement("span");
          name.textContent = line.name;

          row.append(key, value, name);
          tooltip.appendChild(row);
        });

      tooltip.classList.remove("hidden");

      const left =
        (x(index) / width) * box.width;

      tooltip.style.left =
        Math.max(0, Math.min(box.width - tooltip.offsetWidth, left - tooltip.offsetWidth / 2)) + "px";
    };

  const hideTooltip =
    () => {
      crosshair.setAttribute("visibility", "hidden");
      tooltip.classList.add("hidden");
    };

  hitArea.addEventListener("pointermove", event => showAt(event.clientX));
  hitArea.addEventListener("pointerdown", event => showAt(event.clientX));

  // A touch "leaves" as soon as the finger lifts, so only a mouse
  // hides on leave; on a phone the readout stays until a tap elsewhere.
  hitArea.addEventListener("pointerleave", event => {
    if (event.pointerType === "mouse") {
      hideTooltip();
    }
  });

  document.addEventListener(
    "pointerdown",
    event => {
      if (!svg.contains(event.target)) {
        hideTooltip();
      }
    },
    { passive: true }
  );

  container.innerHTML = "";
  container.append(svg, tooltip);

  // Legend (always, for 2+ players)
  legend.innerHTML = "";

  if (series.length > 1) {
    for (const line of series) {
      const item = document.createElement("span");
      item.className = "legend-item";

      const key = document.createElement("span");
      key.className = "line-key";
      key.style.background = line.color;

      const name = document.createElement("span");
      name.textContent = line.name;

      item.append(key, name);
      legend.appendChild(item);
    }
  }
}


document
  .querySelectorAll("[data-stats-period]")
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        statsPeriod = button.dataset.statsPeriod;
        renderServerStats();
      }
    );
  });

document
  .getElementById("statsGame")
  .addEventListener(
    "change",
    event => {
      statsGameKey = event.target.value;
      renderServerStats();
    }
  );


const ACTIVE_TAB_KEY =
  "dailyGameHubActiveTab";

const TABS =
  ["games", "social", "activity", "account"];

let currentTab =
  TABS.includes(
    localStorage.getItem(ACTIVE_TAB_KEY)
  )
    ? localStorage.getItem(ACTIVE_TAB_KEY)
    : "games";

const tabScrollPositions =
  {};


/*
 * Show one tab view and hide the others.
 * Views stay in the page, so nothing reloads
 * and every listener and element keeps working.
 */
/*
 * Player cards: icon, card color, bio and favorite game.
 * Cards are visible to the player and people who share a server
 * with them (enforced by the database). Before the cards table
 * exists, everyone simply gets the default look.
 */
const CARD_COLORS =
  ["purple", "teal", "orange", "pink", "slate", "red"];

const DEFAULT_CARD = {
  icon: "",
  color: "purple",
  bio: "",
  favorite_game: null,
  showcase: [],
  frame: null,
  name_color: null,
  title: null
};

const playerCards =
  new Map();

let myCardStats =
  null;

let myProfile =
  null;

let editingCard =
  null;


async function loadPlayerCards(userIds) {
  const missing =
    [...new Set(userIds)].filter(Boolean);

  if (!session || !missing.length) {
    return;
  }

  const fetchCards =
    columns =>
      request(
        "/rest/v1/player_cards" +
        "?user_id=in.(" + missing.join(",") + ")" +
        "&select=" + columns,
        {
          headers: authHeaders()
        }
      );

  try {
    // showcase and the shop columns arrive with later database
    // files; until those have been run, load cards without them.
    const rows =
      await fetchCards("user_id,icon,color,bio,favorite_game,showcase,frame,name_color,title")
        .catch(() => fetchCards("user_id,icon,color,bio,favorite_game,showcase"))
        .catch(() => fetchCards("user_id,icon,color,bio,favorite_game"));

    for (const userId of missing) {
      playerCards.set(
        userId,
        (rows || []).find(row => row.user_id === userId) || null
      );
    }
  } catch (error) {
    console.error(
      "Player cards failed to load:",
      error
    );
  }
}


function cardFor(userId) {
  return {
    ...DEFAULT_CARD,
    ...(playerCards.get(userId) || {})
  };
}


function profileFor(userId) {
  if (userId === session?.user.id) {
    return myProfile;
  }

  return selectedServerProfiles.get(userId) || null;
}


function playerDisplayName(userId) {
  const profile =
    profileFor(userId);

  return profile
    ? profile.display_name || "@" + profile.username
    : "Player";
}


/*
 * A small rounded square with the player's icon on their card
 * color. Players without an icon show their first letter.
 */
function playerAvatar(userId, size) {
  const card =
    cardFor(userId);

  const avatar =
    document.createElement("span");

  avatar.className =
    "avatar" + (size ? " avatar-" + size : "");

  avatar.dataset.color =
    CARD_COLORS.includes(card.color) ? card.color : "purple";

  avatar.setAttribute("aria-hidden", "true");

  const profile =
    profileFor(userId);

  avatar.textContent =
    card.icon ||
    (profile?.username || "?").charAt(0).toUpperCase();

  const frame =
    shopValue(card.frame, "frame");

  if (frame) {
    avatar.dataset.frame =
      frame;
  }

  return avatar;
}


/*
 * Turn a name into a button that opens the player's card,
 * without opening or closing the row it sits in.
 */
function makePlayerLink(element, userId) {
  const nameColor =
    shopValue(cardFor(userId).name_color, "name_color");

  if (nameColor) {
    element.dataset.nameColor =
      nameColor;
  }

  element.classList.add("player-link");
  element.setAttribute("role", "button");
  element.tabIndex = 0;

  const open =
    event => {
      event.preventDefault();
      event.stopPropagation();
      openPlayerCard(userId);
    };

  element.addEventListener("click", open);

  element.addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter" || event.key === " ") {
        open(event);
      }
    }
  );
}


function memberSinceText(timestamp) {
  if (!timestamp) {
    return "";
  }

  const date =
    new Date(timestamp);

  return Number.isNaN(date.getTime())
    ? ""
    : "Since " + date.toLocaleDateString("en-US", { month: "short", year: "numeric" }).replace(" ", "\u00a0");
}


function cardMetaText(card, stats) {
  const favorite =
    card.favorite_game
      ? gameCatalog.get(card.favorite_game)?.name
      : "";

  return [
    favorite ? "Fav: " + favorite : "",
    memberSinceText(stats?.member_since)
  ]
    .filter(Boolean)
    .join(" · ");
}


function renderCardStats(container, stats) {
  container.innerHTML = "";

  const items = [
    ["played", stats ? stats.played : "–", ""],
    ["wins", stats ? stats.wins : "–", "👑 "],
    ["best streak", stats ? stats.best_streak : "–", "🔥 "]
  ];

  for (const [label, value, icon] of items) {
    const item =
      document.createElement("div");

    const number =
      document.createElement("b");

    number.textContent =
      icon + value;

    const name =
      document.createElement("span");

    name.textContent =
      label;

    item.append(number, name);
    container.appendChild(item);
  }
}


async function loadCardStats(userId) {
  try {
    const stats =
      await request(
        "/rest/v1/rpc/player_card_stats",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            p_user_id: userId,
            p_today: TODAY
          })
        }
      );

    return stats && typeof stats === "object" && !Array.isArray(stats)
      ? stats
      : null;
  } catch (error) {
    console.error(
      "Card stats failed to load:",
      error
    );

    return null;
  }
}


/*
 * Achievements come from the database as one row per tier with
 * the player's progress. Group them into one entry per achievement.
 */
const TIER_NAMES =
  ["Bronze", "Silver", "Gold", "Diamond"];

let myAchievements =
  null;

let myCoins =
  null;


function groupAchievements(rows) {
  const families =
    new Map();

  for (const row of rows || []) {
    if (!families.has(row.id)) {
      families.set(row.id, {
        id: row.id,
        name: row.name,
        icon: row.icon,
        description: row.description,
        progress: Number(row.progress) || 0,
        tiers: []
      });
    }

    families.get(row.id).tiers.push({
      tier: row.tier,
      threshold: row.threshold,
      coins: row.coins
    });
  }

  return [...families.values()].map(family => {
    family.tiers.sort((a, b) => a.tier - b.tier);

    family.unlocked =
      family.tiers.filter(tier => family.progress >= tier.threshold).length;

    family.next =
      family.tiers[family.unlocked] || null;

    return family;
  });
}


function tierLabel(family, unlocked = family.unlocked) {
  if (!unlocked) {
    return "Locked";
  }

  return family.tiers.length > 1
    ? TIER_NAMES[unlocked - 1]
    : "Unlocked";
}


async function loadAchievements(userId) {
  try {
    const rows =
      await request(
        "/rest/v1/rpc/player_achievements",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            p_user_id: userId,
            p_today: TODAY
          })
        }
      );

    return Array.isArray(rows) && rows.length
      ? groupAchievements(rows)
      : null;
  } catch (error) {
    console.error(
      "Achievements failed to load:",
      error
    );

    return null;
  }
}


async function loadCoins(userId) {
  try {
    const coins =
      await request(
        "/rest/v1/rpc/player_coins",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            p_user_id: userId,
            p_today: TODAY
          })
        }
      );

    return coins && typeof coins === "object" && "balance" in coins
      ? coins
      : null;
  } catch (error) {
    console.error(
      "Coins failed to load:",
      error
    );

    return null;
  }
}


// The app's own tiles coin (icons/coin.svg) followed by an amount.
function coinIcon() {
  const icon =
    document.createElement("span");

  icon.className =
    "coin-icon";

  icon.setAttribute("aria-hidden", "true");

  return icon;
}


function showCoins(element, amount) {
  element.replaceChildren(
    coinIcon(),
    Number(amount || 0).toLocaleString("en-US")
  );

  element.setAttribute(
    "aria-label",
    Number(amount || 0).toLocaleString("en-US") + " coins"
  );
}


/*
 * Up to 3 badge tiles: the player's picks, but only badges they
 * have actually unlocked.
 */
function renderShowcase(container, showcase, families) {
  container.innerHTML = "";

  const unlocked =
    new Map(
      (families || [])
        .filter(family => family.unlocked)
        .map(family => [family.id, family])
    );

  const picks =
    (showcase || [])
      .filter(id => unlocked.has(id))
      .slice(0, 3);

  for (const id of picks) {
    const family =
      unlocked.get(id);

    const tile =
      document.createElement("div");

    tile.className =
      "badge-tile";

    tile.dataset.tier =
      family.tiers.length > 1 ? family.unlocked : 3;

    const icon =
      document.createElement("i");

    icon.textContent =
      family.icon;

    const name =
      document.createElement("b");

    name.textContent =
      family.name;

    const tier =
      document.createElement("span");

    tier.textContent =
      tierLabel(family);

    tile.append(icon, name, tier);
    container.appendChild(tile);
  }

  container.classList.toggle("hidden", picks.length === 0);

  return picks.length;
}


function renderAchievements() {
  const section =
    document.getElementById("achievementsSection");

  if (!myAchievements) {
    section.classList.add("hidden");
    return;
  }

  const totalTiers =
    myAchievements.reduce((sum, family) => sum + family.tiers.length, 0);

  const unlockedTiers =
    myAchievements.reduce((sum, family) => sum + family.unlocked, 0);

  document.getElementById("achievementsCount").textContent =
    unlockedTiers + " of " + totalTiers;

  document.getElementById("achievementsBar").style.width =
    (totalTiers ? Math.round(unlockedTiers / totalTiers * 100) : 0) + "%";

  const list =
    document.getElementById("achievementList");

  list.innerHTML = "";

  for (const family of myAchievements) {
    const row =
      document.createElement("div");

    row.className =
      "achievement-row" + (family.unlocked ? "" : " locked");

    row.dataset.id =
      family.id;

    const icon =
      document.createElement("span");

    icon.className =
      "achievement-icon";

    icon.textContent =
      family.icon;

    const text =
      document.createElement("div");

    text.className =
      "achievement-text";

    const top =
      document.createElement("div");

    top.className =
      "achievement-top";

    const name =
      document.createElement("b");

    name.textContent =
      family.name;

    const tier =
      document.createElement("span");

    tier.className =
      "achievement-tier";

    tier.dataset.tier =
      family.unlocked && family.tiers.length === 1 ? 3 : family.unlocked;

    tier.textContent =
      tierLabel(family);

    top.append(name, tier);

    const description =
      document.createElement("span");

    description.className =
      "achievement-description";

    description.textContent =
      family.description;

    const progress =
      document.createElement("div");

    progress.className =
      "achievement-progress";

    const bar =
      document.createElement("span");

    bar.className =
      "progress-bar";

    const fill =
      document.createElement("i");

    const goal =
      family.next || family.tiers[family.tiers.length - 1];

    fill.style.width =
      Math.min(100, Math.round(family.progress / goal.threshold * 100)) + "%";

    bar.appendChild(fill);

    const count =
      document.createElement("span");

    count.className =
      "achievement-count";

    count.textContent =
      family.next
        ? Math.min(family.progress, family.next.threshold) + " / " + family.next.threshold +
          (family.tiers.length > 1 ? " for " + TIER_NAMES[family.next.tier - 1] : "")
        : "Complete";

    progress.append(bar, count);

    const dots =
      document.createElement("span");

    dots.className =
      "tier-dots";

    if (family.tiers.length > 1) {
      family.tiers.forEach(entry => {
        const dot =
          document.createElement("i");

        dot.dataset.tier =
          entry.tier;

        dot.classList.toggle("on", entry.tier <= family.unlocked);
        dots.appendChild(dot);
      });
    }

    text.append(top, description, progress);
    row.append(icon, text, dots);
    list.appendChild(row);
  }

  section.classList.remove("hidden");
}


function formatCoinDay(day) {
  if (!day) {
    return "Badge";
  }

  return new Date(day + "T12:00:00")
    .toLocaleDateString("en-US", { month: "short", day: "numeric" });
}


function openCoins() {
  if (!myCoins) {
    return;
  }

  showCoins(document.getElementById("coinsTitle"), myCoins.balance);

  const list =
    document.getElementById("coinHistory");

  list.innerHTML = "";

  for (const entry of myCoins.history || []) {
    const row =
      document.createElement("div");

    row.className =
      "coin-row";

    const day =
      document.createElement("span");

    day.className =
      "coin-day";

    day.textContent =
      formatCoinDay(entry.day);

    const label =
      document.createElement("span");

    label.className =
      "coin-label";

    label.textContent =
      entry.label;

    const amount =
      document.createElement("b");

    amount.textContent =
      "+" + entry.amount;

    row.append(day, label, amount);
    list.appendChild(row);
  }

  if (!list.children.length) {
    list.innerHTML =
      '<p class="status">Post a result to earn your first coins.</p>';
  }

  document.getElementById("coinsModal").classList.add("open");
}


function renderShowcaseChoices() {
  const field =
    document.getElementById("showcaseField");

  const unlocked =
    (myAchievements || []).filter(family => family.unlocked);

  field.classList.toggle("hidden", !myAchievements);

  const list =
    document.getElementById("showcaseChoices");

  list.innerHTML = "";

  for (const family of unlocked) {
    const button =
      document.createElement("button");

    button.type =
      "button";

    button.className =
      "showcase-choice";

    button.dataset.badge =
      family.id;

    button.classList.toggle(
      "selected",
      editingCard.showcase.includes(family.id)
    );

    button.textContent =
      family.icon + " " + family.name;

    list.appendChild(button);
  }

  if (!unlocked.length) {
    list.innerHTML =
      '<p class="status">Unlock achievements to earn badges you can show here.</p>';
  }

  document.getElementById("showcaseCount").textContent =
    editingCard.showcase.length + "/3";
}


document
  .getElementById("showcaseChoices")
  .addEventListener(
    "click",
    event => {
      const button =
        event.target.closest("[data-badge]");

      if (!button || !editingCard) {
        return;
      }

      const id =
        button.dataset.badge;

      if (editingCard.showcase.includes(id)) {
        editingCard.showcase =
          editingCard.showcase.filter(entry => entry !== id);
      } else if (editingCard.showcase.length < 3) {
        editingCard.showcase =
          [...editingCard.showcase, id];
      } else {
        setStatus(
          document.getElementById("cardStatus"),
          "You can show 3 badges. Tap one to remove it first."
        );
      }

      renderShowcaseChoices();
    }
  );

document
  .getElementById("myCoinsButton")
  .addEventListener("click", openCoins);


/*
 * Shop: icons, card frames, name colors and titles. Items cost
 * coins or are unlocked by a badge tier. Buying and the rules for
 * what a card may use are enforced by the database.
 */
let shopItems =
  null;

let myPurchases =
  new Set();

let shopKind =
  "icon";


async function loadShop() {
  try {
    const [items, purchases] =
      await Promise.all([
        request(
          "/rest/v1/shop_items?select=*&order=sort_order.asc",
          {
            headers: authHeaders()
          }
        ),
        request(
          "/rest/v1/purchases?select=item_id",
          {
            headers: authHeaders()
          }
        )
      ]);

    shopItems =
      Array.isArray(items) && items.length
        ? new Map(items.map(item => [item.id, item]))
        : null;

    myPurchases =
      new Set((purchases || []).map(row => row.item_id));
  } catch (error) {
    console.error(
      "Shop failed to load:",
      error
    );

    shopItems = null;
  }
}


// The style key of an equipped item, if it is of the right kind.
function shopValue(itemId, kind) {
  const item =
    itemId && shopItems?.get(itemId);

  return item && item.kind === kind ? item.value : null;
}


function ownsItem(item) {
  if (myPurchases.has(item.id)) {
    return true;
  }

  if (!item.unlock_id) {
    return false;
  }

  const family =
    (myAchievements || []).find(entry => entry.id === item.unlock_id);

  return Boolean(family && family.unlocked >= item.unlock_tier);
}


function unlockText(item) {
  const family =
    (myAchievements || []).find(entry => entry.id === item.unlock_id);

  if (!family) {
    return "Badge";
  }

  return family.name +
    (family.tiers.length > 1 ? " " + TIER_NAMES[item.unlock_tier - 1] : "");
}


const CARD_ITEM_FIELDS = {
  frame: "frame",
  name_color: "name_color",
  title: "title"
};


function itemInUse(item, card) {
  return item.kind === "icon"
    ? card.icon === item.value
    : card[CARD_ITEM_FIELDS[item.kind]] === item.id;
}


function shopPreview(item, card) {
  if (item.kind === "icon") {
    const avatar =
      document.createElement("span");

    avatar.className =
      "avatar";

    avatar.dataset.color =
      CARD_COLORS.includes(card.color) ? card.color : "purple";

    avatar.textContent =
      item.value;

    return avatar;
  }

  if (item.kind === "frame") {
    const preview =
      document.createElement("span");

    preview.className =
      "frame-preview player-tint";

    preview.dataset.color =
      CARD_COLORS.includes(card.color) ? card.color : "purple";

    preview.dataset.frame =
      item.value;

    const avatar =
      playerAvatar(session.user.id, "sm");

    delete avatar.dataset.frame;
    preview.appendChild(avatar);

    return preview;
  }

  const text =
    document.createElement("span");

  if (item.kind === "name_color") {
    text.className =
      "shop-name";

    text.dataset.nameColor =
      item.value;

    text.textContent =
      myProfile ? "@" + myProfile.username : "@you";
  } else {
    text.className =
      "card-title";

    text.textContent =
      item.value;
  }

  return text;
}


function renderShop() {
  const section =
    document.getElementById("shopSection");

  if (!shopItems || !myCoins || !session) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");

  showCoins(document.getElementById("shopBalance"), myCoins.balance);

  document
    .querySelectorAll("[data-shop-kind]")
    .forEach(button => {
      const active =
        button.dataset.shopKind === shopKind;

      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });

  const card =
    cardFor(session.user.id);

  const grid =
    document.getElementById("shopGrid");

  grid.innerHTML = "";

  for (const item of shopItems.values()) {
    if (item.kind !== shopKind) {
      continue;
    }

    const owned =
      ownsItem(item);

    const inUse =
      owned && itemInUse(item, card);

    const tile =
      document.createElement("div");

    tile.className =
      "shop-item" + (inUse ? " in-use" : "");

    tile.dataset.item =
      item.id;

    const name =
      document.createElement("b");

    name.textContent =
      item.name;

    const action =
      document.createElement("button");

    action.type =
      "button";

    action.className =
      "shop-action";

    if (inUse) {
      action.textContent =
        "In use";

      action.dataset.action =
        item.kind === "icon" ? "" : "remove";

      action.disabled =
        item.kind === "icon";
    } else if (owned) {
      action.textContent =
        "Use";

      action.dataset.action =
        "use";
    } else if (item.price) {
      showCoins(action, item.price);

      action.dataset.action =
        "buy";

      action.classList.toggle(
        "too-expensive",
        Number(myCoins.balance) < item.price
      );
    } else {
      action.textContent =
        "🔒 " + unlockText(item);

      action.disabled = true;
    }

    tile.append(shopPreview(item, card), name, action);
    grid.appendChild(tile);
  }
}


async function buyItem(item) {
  const status =
    document.getElementById("shopStatus");

  if (Number(myCoins?.balance) < item.price) {
    setStatus(
      status,
      "You need " + (item.price - Number(myCoins.balance)).toLocaleString("en-US") +
      " more coins for " + item.name + ".",
      "error"
    );
    return;
  }

  if (!confirm("Buy " + item.name + " for " + item.price + " coins?")) {
    return;
  }

  try {
    await request(
      "/rest/v1/rpc/buy_item",
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          p_item_id: item.id,
          p_today: TODAY
        })
      }
    );

    myPurchases.add(item.id);

    const coins =
      await loadCoins(session.user.id);

    if (coins) {
      myCoins = coins;
    }

    renderMyCard();

    setStatus(
      status,
      "You bought " + item.name + "! Tap Use to put it on your card.",
      "success"
    );
  } catch (error) {
    setStatus(
      status,
      error.message || "That didn't work. Try again in a moment.",
      "error"
    );
  }
}


async function useItem(item, remove) {
  const status =
    document.getElementById("shopStatus");

  const fields =
    item.kind === "icon"
      ? { icon: item.value }
      : { [CARD_ITEM_FIELDS[item.kind]]: remove ? null : item.id };

  try {
    await saveCardFields(fields);
    setStatus(status, "");
  } catch (error) {
    setStatus(
      status,
      "Your card could not be saved. Try again in a moment.",
      "error"
    );
  }
}


document
  .getElementById("shopKinds")
  .addEventListener(
    "click",
    event => {
      const button =
        event.target.closest("[data-shop-kind]");

      if (button) {
        shopKind = button.dataset.shopKind;
        setStatus(document.getElementById("shopStatus"), "");
        renderShop();
      }
    }
  );

document
  .getElementById("shopGrid")
  .addEventListener(
    "click",
    event => {
      const button =
        event.target.closest("[data-action]");

      const item =
        button && shopItems?.get(button.closest("[data-item]").dataset.item);

      if (!item || !button.dataset.action) {
        return;
      }

      if (button.dataset.action === "buy") {
        buyItem(item);
      } else {
        useItem(item, button.dataset.action === "remove");
      }
    }
  );


/*
 * Save the card with some fields changed. Badge and shop columns are
 * only sent once their database files have been run.
 */
async function saveCardFields(fields) {
  const card =
    cardFor(session.user.id);

  const row = {
    user_id: session.user.id,
    icon: card.icon || "🦊",
    color: CARD_COLORS.includes(card.color) ? card.color : "purple",
    bio: card.bio || "",
    favorite_game: card.favorite_game || null,
    ...fields,
    updated_at: new Date().toISOString()
  };

  if (myAchievements) {
    row.showcase =
      fields.showcase || card.showcase || [];
  } else {
    delete row.showcase;
  }

  if (shopItems) {
    for (const column of Object.values(CARD_ITEM_FIELDS)) {
      row[column] =
        column in fields ? fields[column] : card[column] || null;
    }
  }

  await request(
    "/rest/v1/player_cards?on_conflict=user_id",
    {
      method: "POST",
      headers: authHeaders("resolution=merge-duplicates,return=minimal"),
      body: JSON.stringify(row)
    }
  );

  playerCards.set(session.user.id, { showcase: [], ...row });
  renderMyCard();

  if (selectedServerId) {
    renderServerMembers(selectedServerMembers, selectedServerProfiles);
    loadServerBoard();
    renderServerStats();
  }
}


/*
 * Card look: a wash of the card color fading into the panel, with
 * the shop frame (if any) as the card's border.
 */
function tintCard(element, card) {
  element.classList.add("player-tint");

  element.dataset.color =
    CARD_COLORS.includes(card.color) ? card.color : "purple";

  const frame =
    shopValue(card.frame, "frame");

  if (frame) {
    element.dataset.frame = frame;
  } else {
    delete element.dataset.frame;
  }
}


function renderMyCard() {
  if (!session) {
    return;
  }

  const card =
    cardFor(session.user.id);

  tintCard(
    document.getElementById("accountSection"),
    card
  );

  const icon =
    playerAvatar(session.user.id, "lg");

  // The frame goes around the whole card instead.
  delete icon.dataset.frame;
  icon.id = "myCardIcon";

  document.getElementById("myCardIcon").replaceWith(icon);

  document.getElementById("myCardMeta").textContent =
    cardMetaText(card, myCardStats);

  const bio =
    document.getElementById("myCardBio");

  bio.textContent =
    card.bio;

  bio.classList.toggle("hidden", !card.bio);

  renderCardStats(
    document.getElementById("myCardStats"),
    myCardStats
  );

  const coinsButton =
    document.getElementById("myCoinsButton");

  coinsButton.classList.toggle("hidden", !myCoins);

  if (myCoins) {
    showCoins(coinsButton, myCoins.balance);
  }

  const shown =
    renderShowcase(
      document.getElementById("myShowcase"),
      card.showcase,
      myAchievements
    );

  document.getElementById("myShowcaseHint").classList.toggle(
    "hidden",
    shown > 0 || !(myAchievements || []).some(family => family.unlocked)
  );

  const nameColor =
    shopValue(card.name_color, "name_color");

  const accountName =
    document.getElementById("accountName");

  if (nameColor) {
    accountName.dataset.nameColor = nameColor;
  } else {
    delete accountName.dataset.nameColor;
  }

  const title =
    document.getElementById("myCardTitle");

  title.textContent =
    shopValue(card.title, "title") || "";

  title.classList.toggle("hidden", !title.textContent);

  renderAchievements();
  renderShop();
}


async function loadMyCard() {
  if (!session) {
    return;
  }

  const userId =
    session.user.id;

  playerCards.delete(userId);

  const [stats, achievements, coins] =
    await Promise.all([
      loadCardStats(userId),
      loadAchievements(userId),
      loadCoins(userId),
      loadPlayerCards([userId]),
      shopItems ? Promise.resolve() : loadShop()
    ]);

  if (session?.user.id !== userId) {
    return;
  }

  myCardStats =
    stats;

  myAchievements =
    achievements;

  myCoins =
    coins;

  renderMyCard();
}


async function openPlayerCard(userId) {
  const body =
    document.getElementById("playerCardBody");

  const card =
    cardFor(userId);

  body.innerHTML = "";

  tintCard(
    body.closest(".player-card-window"),
    card
  );

  const name =
    document.createElement("strong");

  name.className =
    "card-name";

  name.textContent =
    playerDisplayName(userId);

  const nameColor =
    shopValue(card.name_color, "name_color");

  if (nameColor) {
    name.dataset.nameColor =
      nameColor;
  }

  const title =
    document.createElement("span");

  title.className =
    "card-title";

  title.textContent =
    shopValue(card.title, "title") || "";

  const bio =
    document.createElement("p");

  bio.className =
    "card-bio";

  bio.textContent =
    card.bio;

  const meta =
    document.createElement("p");

  meta.className =
    "card-meta";

  meta.textContent =
    cardMetaText(card, null);

  const stats =
    document.createElement("div");

  stats.className =
    "card-stats";

  renderCardStats(stats, null);

  const versus =
    document.createElement("p");

  versus.className =
    "card-versus hidden";

  const coins =
    document.createElement("span");

  coins.className =
    "coins-pill hidden";

  const badges =
    document.createElement("div");

  badges.className =
    "card-badges hidden";

  const avatar =
    playerAvatar(userId, "xl");

  // The frame goes around the whole card instead.
  delete avatar.dataset.frame;

  body.append(
    avatar,
    name,
    title,
    coins,
    bio,
    meta,
    stats,
    badges,
    versus
  );

  bio.classList.toggle("hidden", !card.bio);
  title.classList.toggle("hidden", !title.textContent);

  document.getElementById("playerCardModal").classList.add("open");

  const [loaded, achievements, coinTotal] =
    await Promise.all([
      loadCardStats(userId),
      loadAchievements(userId),
      loadCoins(userId)
    ]);

  if (!body.contains(badges)) {
    return;
  }

  if (coinTotal) {
    showCoins(coins, coinTotal.balance);

    coins.classList.remove("hidden");
  }

  renderShowcase(badges, card.showcase, achievements);

  if (!loaded) {
    return;
  }

  meta.textContent =
    cardMetaText(card, loaded);

  renderCardStats(stats, loaded);

  if (userId !== session?.user.id) {
    versus.textContent =
      "Head to head in your servers: you " +
      loaded.my_wins + " · " +
      playerDisplayName(userId).replace(/^@/, "") + " " +
      loaded.their_wins;

    versus.classList.remove("hidden");
  }
}


function fillFavoriteGameChoices(selected) {
  const select =
    document.getElementById("cardFavoriteInput");

  select.innerHTML =
    '<option value="">None</option>';

  const games =
    [...gameCatalog.values()]
      .sort((a, b) => a.name.localeCompare(b.name));

  for (const game of games) {
    const option =
      document.createElement("option");

    option.value =
      game.game_key;

    option.textContent =
      game.name;

    select.appendChild(option);
  }

  select.value =
    selected && gameCatalog.has(selected) ? selected : "";
}


function showEditingChoices() {
  document
    .querySelectorAll("#iconChoices [data-icon]")
    .forEach(button => {
      button.classList.toggle(
        "selected",
        button.dataset.icon === editingCard.icon
      );
    });

  document
    .querySelectorAll("#colorChoices [data-color]")
    .forEach(button => {
      button.classList.toggle(
        "selected",
        button.dataset.color === editingCard.color
      );
    });

  document.getElementById("cardBioCount").textContent =
    document.getElementById("cardBioInput").value.length + "/60";
}


function openEditCard() {
  if (!session) {
    return;
  }

  const card =
    cardFor(session.user.id);

  editingCard = {
    icon: card.icon || "🦊",
    color: CARD_COLORS.includes(card.color) ? card.color : "purple",
    showcase: (card.showcase || []).filter(id =>
      (myAchievements || []).some(family => family.id === id && family.unlocked)
    )
  };

  document.getElementById("cardBioInput").value =
    card.bio || "";

  const iconChoices =
    document.getElementById("iconChoices");

  iconChoices
    .querySelectorAll(".shop-icon")
    .forEach(button => button.remove());

  for (const item of shopItems ? shopItems.values() : []) {
    if (item.kind === "icon" && ownsItem(item)) {
      const button =
        document.createElement("button");

      button.type =
        "button";

      button.className =
        "icon-choice shop-icon";

      button.dataset.icon =
        item.value;

      button.setAttribute("aria-label", "Icon " + item.name);

      button.textContent =
        item.value;

      iconChoices.appendChild(button);
    }
  }

  fillFavoriteGameChoices(card.favorite_game);
  setStatus(document.getElementById("cardStatus"), "");
  showEditingChoices();
  renderShowcaseChoices();

  document.getElementById("editCardModal").classList.add("open");
}


async function saveCard() {
  if (!session || !editingCard) {
    return;
  }

  const status =
    document.getElementById("cardStatus");

  if (needsUsername) {
    setStatus(status, "Choose a username first.", "error");
    return;
  }

  const button =
    document.getElementById("saveCardButton");

  button.disabled = true;
  setStatus(status, "Saving...");

  try {
    await saveCardFields({
      icon: editingCard.icon,
      color: editingCard.color,
      bio: document.getElementById("cardBioInput").value.trim().slice(0, 60),
      favorite_game: document.getElementById("cardFavoriteInput").value || null,
      showcase: editingCard.showcase
    });

    document.getElementById("editCardModal").classList.remove("open");
  } catch (error) {
    setStatus(
      status,
      "Your card could not be saved. Try again in a moment.",
      "error"
    );
  } finally {
    button.disabled = false;
  }
}


document
  .getElementById("iconChoices")
  .addEventListener(
    "click",
    event => {
      const button =
        event.target.closest("[data-icon]");

      if (button && editingCard) {
        editingCard.icon = button.dataset.icon;
        showEditingChoices();
      }
    }
  );

document
  .getElementById("colorChoices")
  .addEventListener(
    "click",
    event => {
      const button =
        event.target.closest("[data-color]");

      if (button && editingCard) {
        editingCard.color = button.dataset.color;
        showEditingChoices();
      }
    }
  );

document
  .getElementById("cardBioInput")
  .addEventListener("input", () => {
    if (editingCard) {
      showEditingChoices();
    }
  });

document
  .getElementById("saveCardButton")
  .addEventListener("click", saveCard);

document
  .getElementById("editCardButton")
  .addEventListener("click", openEditCard);

document
  .getElementById("openSettingsButton")
  .addEventListener(
    "click",
    () => {
      document.getElementById("settingsModal").classList.add("open");
    }
  );


function switchTab(tab) {
  if (!TABS.includes(tab)) {
    return;
  }

  if (tab === currentTab) {
    if (document.body.dataset.tab === tab) {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
      return;
    }
  } else {
    tabScrollPositions[currentTab] =
      window.scrollY;
  }

  currentTab = tab;
  document.body.dataset.tab = tab;

  document
    .querySelectorAll(".game-card.expanded")
    .forEach(card => {
      setCardExpanded(card, false);
    });

  try {
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
  } catch (error) {}

  document
    .querySelectorAll("[data-tab-view]")
    .forEach(view => {
      view.classList.toggle(
        "hidden",
        view.dataset.tabView !== tab
      );
    });

  document
    .querySelectorAll("[data-tab-button]")
    .forEach(button => {
      const active =
        button.dataset.tabButton === tab;

      button.classList.toggle("active", active);

      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

  window.scrollTo(
    0,
    tabScrollPositions[tab] || 0
  );

  if (
    tab === "activity" &&
    (!session || userGameLibrary.length)
  ) {
    loadActivity();
  }

  if (tab === "account" && session) {
    loadMyCard();
  }

  if (tab === "social" && session) {
    loadServers();
  }
}


const EXISTING_ACCOUNT_MESSAGE =
  "This email already has an account. Tap Log In, or use " +
  "“Forgot password?” to set a new password.";


function appAddress() {
  return location.origin + location.pathname;
}


async function sendPasswordReset() {
  const email =
    document.getElementById("authEmail").value.trim();

  if (!email) {
    setStatus(
      authStatus,
      "Enter your email above, then tap “Forgot password?”.",
      "error"
    );
    return;
  }

  const button =
    document.getElementById("forgotPasswordButton");

  button.disabled = true;
  setStatus(authStatus, "Sending reset link...");

  try {
    await request(
      "/auth/v1/recover?redirect_to=" + encodeURIComponent(appAddress()),
      {
        method: "POST",
        headers: publicHeaders(),
        body: JSON.stringify({ email })
      }
    );

    // Same message either way, so the form can't reveal who has an account.
    setStatus(
      authStatus,
      "If that email has an account, a reset link is on its way. " +
      "Open it on this device.",
      "success"
    );
  } catch (error) {
    setStatus(
      authStatus,
      /rate limit|too many|seconds/i.test(error.message)
        ? "Too many emails sent. Wait a little while, then try again."
        : error.message,
      "error"
    );
  } finally {
    button.disabled = false;
  }
}


/*
 * Links in Supabase emails (password reset, email confirmation)
 * come back as ...#access_token=...&type=recovery. Sign the player
 * in from it, and for a reset ask for the new password.
 */
async function handleEmailLink() {
  const params =
    new URLSearchParams(location.hash.replace(/^#/, ""));

  const accessToken =
    params.get("access_token");

  const linkError =
    params.get("error_description");

  if (!accessToken && !linkError) {
    return;
  }

  history.replaceState(null, "", location.pathname + location.search);

  if (linkError) {
    document.getElementById("accountModal").classList.add("open");

    setStatus(
      authStatus,
      /expired|invalid/i.test(linkError)
        ? "That email link has expired or was already used. Request a new one."
        : linkError,
      "error"
    );
    return;
  }

  try {
    const user =
      await request(
        "/auth/v1/user",
        {
          headers: {
            ...publicHeaders(),
            "Authorization": "Bearer " + accessToken
          }
        },
        false
      );

    session = {
      access_token: accessToken,
      refresh_token: params.get("refresh_token"),
      expires_in: Number(params.get("expires_in")) || null,
      token_type: params.get("token_type") || "bearer",
      user
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    showSessionUI();

    if (params.get("type") === "recovery") {
      document.getElementById("newPasswordInput").value = "";
      document.getElementById("confirmPasswordInput").value = "";
      setStatus(newPasswordStatus, "");
      document.getElementById("newPasswordModal").classList.add("open");
    }
  } catch (error) {
    document.getElementById("accountModal").classList.add("open");
    setStatus(authStatus, "That email link could not be used. Try again.", "error");
  }
}


async function saveNewPassword() {
  const password =
    document.getElementById("newPasswordInput").value;

  const confirmation =
    document.getElementById("confirmPasswordInput").value;

  if (password.length < 6) {
    setStatus(newPasswordStatus, "Use at least 6 characters.", "error");
    return;
  }

  if (password !== confirmation) {
    setStatus(newPasswordStatus, "The two passwords don’t match.", "error");
    return;
  }

  if (!session) {
    setStatus(newPasswordStatus, "Open the reset link from your email again.", "error");
    return;
  }

  setStatus(newPasswordStatus, "Saving...");

  try {
    await request(
      "/auth/v1/user",
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ password })
      }
    );

    setStatus(newPasswordStatus, "Password updated. You’re signed in.", "success");

    setTimeout(
      () => {
        document.getElementById("newPasswordModal").classList.remove("open");
      },
      1200
    );
  } catch (error) {
    setStatus(newPasswordStatus, error.message, "error");
  }
}


document
  .getElementById("forgotPasswordButton")
  .addEventListener("click", sendPasswordReset);

document
  .getElementById("welcomeUsernameSaveButton")
  .addEventListener(
    "click",
    () => {
      saveUsername(
        document.getElementById("welcomeUsernameInput").value,
        welcomeUsernameStatus
      );
    }
  );

document
  .getElementById("welcomeUsernameInput")
  .addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        document.getElementById("welcomeUsernameSaveButton").click();
      }
    }
  );

document
  .getElementById("welcomeSignOutButton")
  .addEventListener(
    "click",
    () => {
      document.getElementById("usernameModal").classList.remove("open");
      document.getElementById("signOutButton").click();
    }
  );

document
  .getElementById("saveNewPasswordButton")
  .addEventListener("click", saveNewPassword);

handleEmailLink();


/*
 * "New version available": compare the running version with the
 * one on the server (version.json, never cached) and offer a
 * refresh when they differ.
 */
const APP_VERSION =
  document.querySelector('meta[name="app-version"]')?.content || "";

const UPDATE_CHECK_MS =
  15 * 60 * 1000;


async function checkForUpdate() {
  if (!APP_VERSION || document.visibilityState !== "visible") {
    return;
  }

  try {
    const response =
      await fetch("version.json?t=" + Date.now(), { cache: "no-store" });

    if (!response.ok) {
      return;
    }

    const latest =
      (await response.json()).version;

    document
      .getElementById("updateBar")
      .classList
      .toggle("hidden", !latest || latest === APP_VERSION);
  } catch (error) {
    // Offline or blocked: try again next time.
  }
}


document
  .getElementById("updateRefreshButton")
  .addEventListener(
    "click",
    () => {
      location.reload();
    }
  );

setTimeout(checkForUpdate, 5000);
setInterval(checkForUpdate, UPDATE_CHECK_MS);

document.addEventListener(
  "visibilitychange",
  () => {
    if (document.visibilityState === "visible") {
      checkForUpdate();
    }
  }
);


function reloadIfNewDay(event) {
  if (new Date().toLocaleDateString("en-CA") !== TODAY) {
    // Skip the other "came back" handlers (library sync) so no
    // request is cut off by the reload.
    event?.stopImmediatePropagation();
    location.reload();
  }
}

// Home Screen apps can stay open for days; "today" is fixed at load.
// Capture phase so this runs before the existing sync listeners.
document.addEventListener(
  "visibilitychange",
  event => {
    if (document.visibilityState === "visible") {
      reloadIfNewDay(event);
    }
  },
  { capture: true }
);

window.addEventListener("focus", reloadIfNewDay, { capture: true });
window.addEventListener("pageshow", reloadIfNewDay, { capture: true });


/*
 * Saved results must belong to a profile (daily_scores.user_id
 * references it), and the profile is created with the username.
 */
let needsUsername =
  false;

const USERNAME_FIRST_MESSAGE =
  "Choose a username first (Account tab, ⚙️ Settings), then save your result.";


function setAccountAttention(needed) {
  needsUsername =
    needed;

  document
    .getElementById("usernameModal")
    .classList
    .toggle("open", Boolean(needed && session));

  document
    .querySelector('[data-tab-button="account"]')
    .classList
    .toggle("needs-attention", needed);
}


document
  .querySelectorAll("[data-tab-button]")
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        switchTab(button.dataset.tabButton);
      }
    );
  });


switchTab(currentTab);

updateLocalUI();
showSessionUI();
requestAnimationFrame(
  () => {
restoreGamePosition();
  }
);
