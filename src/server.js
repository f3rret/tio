import { Server, Origins } from 'boardgame.io/server';
import { TIO } from './Game';
import { prematch } from './prematch';

/*const lobbyConfig = {
    apiPort: 8080,
    apiCallback: () => console.log('Running Lobby API on port 8080...'),
};*/

const server = Server({
  games: [TIO, prematch],
  origins: ['*', Origins.LOCALHOST, Origins.LOCALHOST_IN_DEVELOPMENT]
});

server.run({ port: 8000/*, lobbyConfig */});