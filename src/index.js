import React from 'react';
import ReactDOM from 'react-dom/client';
//import './index.css';
import App from './App';
//import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));

const url = new URL(window.location.href);
const params = url.searchParams;
//<React.StrictMode>
//</React.StrictMode>
const pid = params.get('playerID') == null ? '0' : params.get('playerID');
root.render(
  
    <App playerID={pid}/>
  
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();




/*
import { Application } from 'pixi.js';
const app = new Application({
    width: 800,
    height: 600,
    backgroundColor: 0x10bb99,
    view: document.getElementById('container'),
  });

  const root = createRoot(app.stage);
  //root.render(<Graphics draw={draw}/>);
  root.render(<Text text="Hello World" x={200} y={200} />);
*/