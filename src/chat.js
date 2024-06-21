import { Card, CardBody, CardFooter, Input, ButtonGroup } from 'reactstrap';
import { useState, useMemo, useCallback, useContext } from 'react';
import { StateContext, LocalizationContext } from './utils';

export const ChatBoard = ({sendChatMessage, chatMessages})=>{

    const { G } = useContext(StateContext);
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
    const messages = useMemo(()=>{
        return [...chatMessages].slice(-20).reverse().map((m, i) => <p key={i} style={{margin: 0}}><b>{t('races.' + G.races[m.sender].rid + '.name') + ': '}</b>{m.payload}</p>)
    // eslint-disable-next-line
      }, [G.races,chatMessages]);
/**
 * <ButtonGroup vertical style={{height: 'min-content', padding: '.5rem'}}>
        <Button size='sm' className='hoverable bi-chat-left' onClick={()=>{setChatVisible(!chatVisible)}} 
          style={{borderRadius: '5px', fontSize: '2rem', padding: '0 1rem', background:'none', borderColor: 'transparent'}}/>
      </ButtonGroup>
 */
    return <div style={{position: 'fixed', bottom: '3rem', left: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
      
      {chatVisible && <Card className='borderedPanel-vertical' style={{margin: '0 0 1rem 2rem', backgroundColor: 'rgba(33, 37, 41, 0.95)', width: '40rem', height: '20rem'}}>
        <CardBody style={{overflowY: 'auto'}}>
            <div style={{fontSize: '.8rem'}}>{messages}</div>
        </CardBody>
        <CardFooter style={{borderTop: 'solid 1px rgba(255,255,255,.7)'}}>
          <Input autoFocus={true} type='text' value={msg} onChange={onChange} style={{backgroundColor: 'rgba(255,255,255,.3)', borderColor: 'transparent'}} onKeyDown={onKeyDown}/>
        </CardFooter>
      </Card>}

      {!chatVisible && messages && messages.length > 0 && <div onClick={()=>{setChatVisible(!chatVisible)}} style={{marginLeft: '1rem', width: '40rem', height: '3.5rem', 
            overflow: 'hidden', padding: '.25rem 0 .25rem 1rem'}}>
        {messages[0]}
        </div>}

      <ButtonGroup className='comboPanel-left-vertical' style={{bottom: '-1.5rem', left: '1.5rem', padding: '.5rem'}}>
        <button className={'styledButton ' + (chatVisible ? 'white': 'blue')} onClick={()=>{setChatVisible(!chatVisible)}} 
          style={{fontFamily: 'Handel Gothic', width: '8rem'}}>{t("board.nav.chat")}</button>
      </ButtonGroup>
    </div>
  }