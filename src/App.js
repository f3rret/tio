import { Client } from 'boardgame.io/react';
import { Debug } from 'boardgame.io/debug';
import { Local, SocketIO } from 'boardgame.io/multiplayer';
import { TIO } from './Game';
import { TIOBoard } from './Board';
//import 'bootstrap/dist/css/bootstrap.min.css';
import './scss/custom.scss'
import settings from '../package.json'

export const App = Client({ 
    game: TIO,
    board: TIOBoard,
    debug: (!process.env.NODE_ENV || process.env.NODE_ENV === 'development'),
    //numPlayers: props.numPlayers,
    /*playerID: props.playerID,
    matchID: props.matchID,
    credentials: props.credentials,*/
    multiplayer: SocketIO({ server: settings.ip + ':8000' })
});

export const AppLocal = Client({ 
  game: TIO,
  board: TIOBoard,
  numPlayers: 2,
  multiplayer: Local(),
  debug: { impl: Debug, collapseOnLoad: true }
});

