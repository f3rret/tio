import React from 'react';
import { Lobby } from './lobby';
import { App } from './App';
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
  const [playerID, setPlayerID] = React.useState(null);
  const [matchID, setMatchID] = React.useState(null);
  const [playerCreds, setPlayerCreds] = React.useState(null);

  const ready = React.useMemo(() => {
    return playerID !== null && matchID !== null && playerCreds !== null
  }, [playerID, matchID, playerCreds]);

  return (
    <LocalizationContext.Provider value={localizationContext}>
      {ready && <div id='tempOverlay' style={{width: '100%', height: '100%', backgroundColor: 'black', position: 'absolute', top: 0, left: 0, zIndex: 101}}></div>}
      {ready && <App playerID={playerID} matchID={matchID} credentials={playerCreds}/>}
      {!ready && <Lobby setPlayerID={(p) => setPlayerID(p)} setMatchID={(p) => setMatchID(p)} setPlayerCreds={(p) => setPlayerCreds(p)}/>}
    </LocalizationContext.Provider>
  );
}

root.render(<LangWrapper/>);

