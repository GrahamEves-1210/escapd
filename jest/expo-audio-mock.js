// expo-audio under Jest: no native audio, so each player is a plain object of
// spies that records what was asked of it. `__players` lists every player made
// (with its source); `__reset()` clears them; `__failNextLoad()` makes the
// next createAudioPlayer throw, as a missing or corrupt file would.
const players = [];
let failLoads = 0;

function createAudioPlayer(source) {
  if (failLoads > 0) {
    failLoads -= 1;
    throw new Error("expo-audio mock: load failed");
  }
  const player = {
    source,
    volume: 1,
    loop: false,
    playing: false,
    // Loaded at once; a test sets false for a sound still loading or failed.
    isLoaded: true,
    currentTime: 0,
    play: jest.fn(() => {
      player.playing = true;
    }),
    pause: jest.fn(() => {
      player.playing = false;
    }),
    seekTo: jest.fn(() => Promise.resolve()),
    replace: jest.fn(),
    remove: jest.fn(),
  };
  players.push(player);
  return player;
}

module.exports = {
  createAudioPlayer: jest.fn(createAudioPlayer),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  setIsAudioActiveAsync: jest.fn(() => Promise.resolve()),
  useAudioPlayer: jest.fn((source) => createAudioPlayer(source)),
  __players: players,
  __failNextLoad: (count = 1) => {
    failLoads = count;
  },
  __reset: () => {
    players.length = 0;
    failLoads = 0;
  },
};
