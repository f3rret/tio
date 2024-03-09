import React from 'react';
//import { Lobby } from 'boardgame.io/react';
import { Lobby } from './lobby';
import ReactDOM from 'react-dom/client';
//import {App, AppLocal} from './App';

/*import { TIO } from './Game';
import { TIOBoard } from './Board';*/


//import reportWebVitals from './reportWebVitals';
//import './index.css';
//<React.StrictMode>
//</React.StrictMode>

//const root = ReactDOM.createRoot(document.getElementById('root'));
/*const url = new URL(window.location.href);
const params = url.searchParams;

const pid = params.get('playerID') == null ? '0' : params.get('playerID');

if(!params.get('multiplayer')){
  root.render( 
      <AppLocal playerID={pid}/>
  )
}
else{
  root.render( 
    <App playerID={pid}/>
  )
}*/

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Lobby/>);
/*root.render(<Lobby
  gameServer={`http://${window.location.hostname}:8000`}
  lobbyServer={`http://${window.location.hostname}:8000`}
  gameComponents={[
    { game: TIO, board: TIOBoard }
  ]}
/>);*/
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();

