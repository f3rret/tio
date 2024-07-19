import React, {useState, useMemo, useReducer} from 'react';
import { Lobby } from './lobby';
import { App } from './App';
import ReactDOM from 'react-dom/client';

import { I18n } from 'i18n-js';
import ru from './i18n/ru.json';
import en from './i18n/en.json';
import { LocalizationContext } from './utils';
import { credsReducer } from './reducers';

const i18n = new I18n({...en, ...ru});
i18n.defaultLocale = 'en';
i18n.locale = 'ru';
i18n.enableFallback = true;

const root = ReactDOM.createRoot(document.getElementById('root'));
const LangWrapper = () => {
  const [locale, setLocale] = useState('ru');
  const localizationContext = useMemo(
    () => ({
      t: (scope, options) => i18n.t(scope, { locale, ...options }),
      locale,
      setLocale,
    }),
    [locale]
  );

  const [creds, dispatch] = useReducer(credsReducer, {ready: false, playerID: null, matchID: null, playerCreds: null});

  return (
    <LocalizationContext.Provider value={localizationContext}>
      {creds.ready && <div id='tempOverlay' style={{width: '100%', height: '100%', backgroundColor: 'black', position: 'absolute', top: 0, left: 0, zIndex: 101}}></div>}
      {creds.ready && <App {...creds}/>}
      {!creds.ready && <Lobby dispatch={dispatch}/>}
    </LocalizationContext.Provider>
  );
}

root.render(<LangWrapper/>);

