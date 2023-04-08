const { Server } = require('boardgame.io/server');
const { TIO } = require('./Game');

/*const lobbyConfig = {
    apiPort: 8000,
    apiCallback: () => console.log('Running Lobby API on port 8080...'),
  };*/

const server = Server({
  games: [TIO],
  origins: ['*'],
});

server.run({ port: 8000/*, lobbyConfig*/ });