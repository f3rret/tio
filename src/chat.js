import { Card, CardBody, CardFooter, Input, ButtonGroup, Button } from 'reactstrap';
import { useState, useMemo, useCallback } from 'react';


export const ChatBoard = ({races, sendChatMessage, chatMessages})=>{

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
        return [...chatMessages].slice(-20).reverse().map((m, i) => <p key={i} style={{margin: 0}}><b>{races[m.sender].name + ' '}</b>{m.payload}</p>)
    }, [races,chatMessages]);

    return <div style={{position: 'fixed', bottom: 0, left: 0, display: 'flex', flexDirection: 'row', alignItems: 'flex-end', marginBottom: '1rem'}}>
      <ButtonGroup vertical style={{height: 'min-content', padding: '.5rem'}}>
        <Button size='sm' className='hoverable' tag='img' onClick={()=>{setChatVisible(!chatVisible)}} 
          style={{borderRadius: '5px', background:'none', borderColor: 'transparent', width: '3rem'}} src='icons/agenda_white.png'/>
      </ButtonGroup>
      {chatVisible && <Card style={{backgroundColor: 'rgba(0,0,0,.3)', border: 'solid 1px rgba(255,255,255,.7)', width: '40rem', height: '20rem', borderRadius: '5px'}}>
        <CardBody style={{overflowY: 'auto'}}>
            <div style={{fontSize: '.8rem'}}>{messages}</div>
        </CardBody>
        <CardFooter style={{borderTop: 'solid 1px rgba(255,255,255,.7)'}}>
          <Input type='text' value={msg} onChange={onChange} style={{backgroundColor: 'rgba(255,255,255,.3)', borderRadius: '5px', borderColor: 'transparent'}} onKeyDown={onKeyDown}/>
        </CardFooter>
      </Card>}
      {!chatVisible && messages && <div style={{width: '40rem', height: '2.5rem', background: 'none'}}>
        {messages[0]}
        </div>}
    </div>
  }