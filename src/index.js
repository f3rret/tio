import React from 'react';
import { Lobby } from './lobby';
import ReactDOM from 'react-dom/client';

import { I18n } from 'i18n-js';
import ru from "./i18n/ru.json";
import en from "./i18n/en.json";
import { LocalizationContext } from './utils';

const i18n = new I18n({...en, ...ru});
i18n.defaultLocale = 'en';
i18n.locale = 'ru';
i18n.enableFallback = true;

const root = ReactDOM.createRoot(document.getElementById('root'));
const LangWrapper = () => {
  const [locale, setLocale] = React.useState('ru');
  const localizationContext = React.useMemo(
    () => ({
      t: (scope, options) => i18n.t(scope, { locale, ...options }),
      locale,
      setLocale,
    }),
    [locale]
  );

  return (
    <LocalizationContext.Provider value={localizationContext}>
      <Lobby />
    </LocalizationContext.Provider>
  );
}

root.render(<LangWrapper/>);

//import { Lobby } from 'boardgame.io/react';
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

