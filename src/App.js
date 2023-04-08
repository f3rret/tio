import { Client } from 'boardgame.io/react';
import { Local/*, SocketIO*/ } from 'boardgame.io/multiplayer';
import { TIO } from './Game';
import { TIOBoard } from './Board';

const App = Client({ 
  game: TIO,
  board: TIOBoard,
  multiplayer: Local()//SocketIO({ server: 'assist:8000' })
});

export default App;