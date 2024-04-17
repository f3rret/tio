import { Card, CardBody, CardFooter, Input } from 'reactstrap';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const PrematchChat = ({sendChatMessage, chatMessages}) => {

    const [msg, setMsg] = useState('');
    const onKeyDown = useCallback((e)=> {
        if(e.keyCode === 13){ 
            sendChatMessage(e.target.value);
            setMsg('');
        }
    }, [sendChatMessage]);
    const onChange = useCallback((e)=>{
        setMsg(e.target.value)
    }, []);

    const colors = useMemo(() => ['red', 'green', 'blue', 'yellow', 'gray', 'pink', 'orange', 'violet'], []);
    const messages = useMemo(()=>{
        return [...chatMessages].slice(-20).reverse().map((m, i) => <p key={i} style={{margin: 0, color: colors[m.sender]}}><b>{'> '}</b>{m.payload}</p>)
    }, [chatMessages, colors]);

    return (<Card style={{border: 'solid 1px rgba(255,255,255,.25)', width: '100%', height: '15rem'}}>
                <CardBody style={{overflowY: 'auto'}}>
                    <div style={{fontSize: '.8rem'}}>{messages}</div>
                </CardBody>
                <CardFooter style={{borderTop: 'solid 1px rgba(255,255,255,.0)'}}>
                <Input type='text' value={msg} onChange={onChange}
                    placeholder='type your message here' 
                    style={{opacity: 0.5, backgroundColor: 'transparent', borderColor: 'transparent'}} 
                    onKeyDown={onKeyDown}/>
                </CardFooter>
            </Card>);

}

export function PrematchBoard ({G, ctx, sendChatMessage, chatMessages}) {
    useEffect(() => {
        sendChatMessage('The fate of the Galaxy is in our hands');
         // eslint-disable-next-line
    }, []);
    return (<PrematchChat sendChatMessage={sendChatMessage} chatMessages={chatMessages}/>);
}