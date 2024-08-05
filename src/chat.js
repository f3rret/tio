import { Card, CardBody, CardFooter, Input, ButtonGroup } from 'reactstrap';
import { useState, useMemo, useCallback, useContext } from 'react';
import { StateContext, LocalizationContext } from './utils';
import reactStringReplace from 'react-string-replace';

export const ChatBoard = ({sendChatMessage, chatMessages})=>{

    const { G, playerID } = useContext(StateContext);
    const { t } = useContext(LocalizationContext); 
    const [msg, setMsg] = useState('');
    const [chatVisible, setChatVisible] = useState(false);
    const onKeyDown = useCallback((e)=> {
        if(e.keyCode === 13){ 
            sendChatMessage(e.target.value);
            setMsg('');
        }
    }, [sendChatMessage]);
    const onChange = useCallback((e)=>{
        setMsg(e.target.value)
    }, [])
    
    const wrapTags = useCallback((text) => {
      const tags={
        'chat-dice': /(\/dice\s\d{1,2})/,
        'chat-dice-green': /(\/dice-green\s\d{1,2})/,
        'chat-gain-tg': /(\/gain-tg\s\d{1,2})/,
        'chat-offer': /(\/offer\s\d{1}\s\S+)/
        /*'chat-gain-comm': /(\/gain-comm\s\d{1,2})/,
        'chat-ability': /(\/ability\s\S+\s\d\s\S+)/*/
      }
  
      let result = text;
      Object.keys(tags).forEach(className => {
        result = reactStringReplace(result, tags[className], (match, i) => {
            if(className === 'chat-gain-tg'){
              return <span key={className + i} className={className}>
                <b>{match.replace(/\/\S*\s/, '+')}</b>
                <img alt='tg' src='/icons/trade_good_1.png'/>
              </span>
            }
            else if(className === 'chat-offer'){
              const pid = match.replace(/\/\S*\s(\d{1})\s\S+/, '$1');
              const item = match.replace(/\/\S*\s\d{1}\s(\S+)/, '$1');
  
              if(!isNaN(pid) && item){
                const r = G.races[pid];
  
                return <span className={className}>
                    <b className='bi bi-arrow-right-square-fill'>{'  ' + t('races.' + r.rid + '.name') + ' '}</b>
                    <b>{item}</b>
                    {String(pid) === String(playerID) && <button className='styledButton green'>{t('board.accept')}</button>}
                  </span>
              }
            }
            /*else if(className === 'chat-gain-comm'){
              return <span key={className + i} className={className}>
                <b>{match.replace(/\/\S*\s/, '+')}</b>
                <img alt='tg' src='/icons/commodity_1.png'/>
              </span>
            }
            else if(className === 'chat-ability'){
              const params = match.split(' ');
              if(params && params.length > 2){
                return <span key={className + i} className={className}>
                  {params[1]}
                </span>
              }
              else{
                return match;
              }
            }*/
            else{
              return <span key={className + i} className={className}>{match.replace(/\/\S*\s/, '')}</span>
            }
          }
        )
      })
  
      return result;
  //eslint-disable-next-line
    }, []);


    const messages = useMemo(()=>{
      return [...chatMessages].slice(-20).reverse().map((m, i) => {
        let payload;

        if(m.payload && m.payload.indexOf('/') > -1) {
          payload = wrapTags(m.payload, t) 
        }
        else {
          payload = m.payload;
        }

        return <p key={i} style={{margin: '0 0 .5rem 0'}}>
          <b style={{color: G.races[m.sender].color[0]}}>{t('races.' + G.races[m.sender].rid + '.name') + ': '}</b>
          {payload}
        </p>})
    // eslint-disable-next-line
    }, [G.races,chatMessages]);


    return <>
      {!chatVisible && messages && messages.length > 0 && <div onClick={()=>{setChatVisible(!chatVisible)}} style={{fontFamily: 'system-ui, arial', marginLeft: '1rem', width: '40rem', height: '3.25rem', lineHeight: '1.25rem', overflow: 'hidden', padding: '.25rem 0 .25rem 1rem', position: 'fixed', bottom: '5rem', left: '3rem' }}>
        {messages[0]}
      </div>}
      <div style={{position: 'fixed', bottom: '3rem', left: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', zIndex: 1}}>
        {chatVisible && <Card className='borderedPanel-vertical' style={{margin: '0 0 1rem 2rem', backgroundColor: 'rgba(33, 37, 41, 0.95)', width: '40rem', height: '20rem'}}>
          <CardBody style={{overflowY: 'auto'}}>
              <div style={{fontSize: '.8rem'}}>{messages}</div>
          </CardBody>
          <CardFooter style={{borderTop: 'solid 1px rgba(255,255,255,.7)'}}>
            <Input autoFocus={true} type='text' value={msg} onChange={onChange} style={{fontFamily: 'system-ui, arial', backgroundColor: 'rgba(255,255,255,.3)', borderColor: 'transparent'}} onKeyDown={onKeyDown}/>
          </CardFooter>
        </Card>}

        <ButtonGroup className='comboPanel-left-vertical' style={{bottom: '-1rem', left: '1.5rem', padding: '.5rem'}}>
          <button className={'styledButton ' + (chatVisible ? 'white': 'blue')} onClick={()=>{setChatVisible(!chatVisible)}} 
            style={{fontFamily: 'Handel Gothic', width: '8rem'}}>{t("board.nav.chat")}</button>
        </ButtonGroup>
      </div>
      </>
}


  