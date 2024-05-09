import { Card, CardBody, CardFooter, Input, ButtonGroup, Button } from 'reactstrap';
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
        return [...chatMessages].slice(-20).reverse().map((m, i) => <p key={i} style={{}}><b>{G.races[m.sender].name + ' '}</b>{m.payload}</p>)
    }, [G.races,chatMessages]);
/**
 * <ButtonGroup vertical style={{height: 'min-content', padding: '.5rem'}}>
        <Button size='sm' className='hoverable bi-chat-left' onClick={()=>{setChatVisible(!chatVisible)}} 
          style={{borderRadius: '5px', fontSize: '2rem', padding: '0 1rem', background:'none', borderColor: 'transparent'}}/>
      </ButtonGroup>
 */
    return <div style={{position: 'fixed', bottom: '1rem', left: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
      
      {chatVisible && <Card style={{margin: '0 0 1rem 0', backgroundColor: 'rgba(0,0,0,.3)', border: 'solid 1px rgba(255,255,255,.7)', width: '40rem', height: '20rem'}}>
        <CardBody style={{overflowY: 'auto'}}>
            <div style={{fontSize: '.8rem'}}>{messages}</div>
        </CardBody>
        <CardFooter style={{borderTop: 'solid 1px rgba(255,255,255,.7)'}}>
          <Input type='text' value={msg} onChange={onChange} style={{backgroundColor: 'rgba(255,255,255,.3)', borderColor: 'transparent'}} onKeyDown={onKeyDown}/>
        </CardFooter>
      </Card>}

      {!chatVisible && messages && <div style={{marginBottom: '1rem', width: '40rem', height: '3.5rem', backgroundColor: 'rgba(0,0,0,.5)', 
            overflow: 'hidden', padding: '.25rem 0 .25rem 1rem'}}>
        {messages[0]}
        </div>}

      <ButtonGroup style={{opacity: '80%'}}>
        <Button color={chatVisible ? 'light': 'dark'} onClick={()=>{setChatVisible(!chatVisible)}} 
          style={{fontFamily: 'Handel Gothic'}}>{t("board.nav.chat")}</Button>
      </ButtonGroup>
    </div>
  }