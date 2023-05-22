import React from 'react';
import ReactDOM from 'react-dom/client';
//import './index.css';
import {App, AppLocal} from './App';
//import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));

const url = new URL(window.location.href);
const params = url.searchParams;
//<React.StrictMode>
//</React.StrictMode>
const pid = params.get('playerID') == null ? '0' : params.get('playerID');

if(params.get('dev')){
  root.render( 
      <AppLocal playerID={pid}/>
  )
}
else{
  root.render( 
    <App playerID={pid}/>
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();

