import { Client } from 'boardgame.io/react';
//import { Debug } from 'boardgame.io/debug';
import { /*Local,*/ SocketIO } from 'boardgame.io/multiplayer';
import { TIO } from './Game';
import { BoardWithEffects } from './Board';
import { BotBoardWithEffects } from './botPlugin_cs';
import './scss/custom.scss'
import settings from '../package.json';
import { LobbyClient } from 'boardgame.io/client';
import { useState } from 'react';

export const App = Client({ 
    game: TIO,
    board: BoardWithEffects,
    debug: (!process.env.NODE_ENV || process.env.NODE_ENV === 'development'),
    multiplayer: SocketIO({ server: window.location.protocol + '//' + settings.ip + ':8000' })
})

export const BotApp = (args) => {
  const [creds, setCreds] = useState(null);

  if(!creds){
    const lobbyClient = new LobbyClient({ server: window.location.protocol + '//' + settings.ip + ':8000' });

    lobbyClient.joinMatch('TIO', args.matchID, {
      playerName: 'bot ' + args.playerID,
      playerID: args.playerID
    }).then(data => {
      setCreds(data.playerCredentials)
    })
  }

  return <>
    {creds && <BotClient matchID={args.matchID} playerID={args.playerID} credentials={creds}/>}
  </>

} 

const BotClient = Client({ 
  game: TIO,
  board: BotBoardWithEffects,
  debug: false,
  multiplayer: SocketIO({ server: window.location.protocol + '//' + settings.ip + ':8000' })
})


/*export const AppLocal = Client({ 
  game: TIO,
  board: TIOBoard,
  numPlayers: 2,
  multiplayer: Local(),
  debug: { impl: Debug, collapseOnLoad: true }
});*/

