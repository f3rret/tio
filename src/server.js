import { Server, Origins } from 'boardgame.io/server';
import { TIO } from './Game';
import { prematch } from './prematch/prematch';

/*const lobbyConfig = {
    apiPort: 8080,
    apiCallback: () => console.log('Running Lobby API on port 8080...'),
};*/
let https;
const fs = require('fs');

if(fs.existsSync('cert')){
  console.log('include https');
  https = {
    cert: fs.readFileSync('cert'),
    key: fs.readFileSync('key'),
  }
}

const server = Server({
  games: [TIO, prematch],
  origins: ['http://80.87.111.146', 'http://twilight-imperium.online', 'http://www.twilight-imperium.online', 
            'https://www.twilight-imperium.online', 'https://twilight-imperium.online', 
            Origins.LOCALHOST, Origins.LOCALHOST_IN_DEVELOPMENT],
  https
});

server.run({ port: 8000/*, lobbyConfig */});