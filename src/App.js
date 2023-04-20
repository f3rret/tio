import { Client } from 'boardgame.io/react';
import { /*Local,*/ SocketIO } from 'boardgame.io/multiplayer';
import { TIO } from './Game';
import { TIOBoard } from './Board';
import { NUM_PLAYERS } from './utils';
//import 'bootstrap/dist/css/bootstrap.min.css';
import './scss/custom.scss'

const App = Client({ 
  game: TIO,
  board: TIOBoard,
  numPlayers: NUM_PLAYERS,
  multiplayer: /*Local()//*/SocketIO({ server: 'assist:8000' })
});

export default App;