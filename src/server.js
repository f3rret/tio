const { Server, Origins } = require('boardgame.io/server');
const { TIO } = require('./Game');

/*const lobbyConfig = {
    apiPort: 8080,
    apiCallback: () => console.log('Running Lobby API on port 8080...'),
};*/

const server = Server({
  games: [TIO],
  origins: ['*', Origins.LOCALHOST, Origins.LOCALHOST_IN_DEVELOPMENT]
});

server.run({ port: 8000/*, lobbyConfig */});