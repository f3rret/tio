import { Card, CardBody, CardFooter, Input } from 'reactstrap';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LocalizationContext } from '../utils';

export const PrematchChat = ({sendChatMessage, chatMessages}) => {

    const { t } = useContext(LocalizationContext);
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
    const trueColors = useMemo(() => {return {
        red: ['rgba(220, 53, 69, 1)', 'rgba(220, 53, 69, .25)'],
        green: ['rgba(25, 135, 84, 1)', 'rgba(25, 135, 84, .25)'], 
        blue: ['rgba(13, 110, 253, 1)', 'rgba(13, 110, 253, .25)'], 
        cyan: ['rgba(13, 202, 240, 1)', 'rgba(13, 202, 240, .35)'], 
        gray: ['rgba(108, 117, 125, 1)', 'rgba(108, 117, 125, .25)'], 
        pink: ['rgba(214, 51, 132, 1)', 'rgba(214, 51, 132, .25)'], 
        orange: ['rgba(253, 126, 20, 1)', 'rgba(253, 126, 20, .25)'], 
        violet: ['rgba(111, 66, 193, 1)', 'rgba(111, 66, 193, .25)']
    }}, []);

    const messages = useMemo(()=>{
        return [...chatMessages].slice(-20).reverse().map((m, i) => <p key={i} style={{margin: 0, color: trueColors[colors[m.sender]][0]}}><b>{'> '}</b>{m.payload}</p>)
    }, [chatMessages, colors, trueColors]);

    return (<Card style={{border: 'solid 1px rgba(255,255,255,.25)', width: '100%', height: '15rem'}}>
                <CardBody style={{overflowY: 'auto'}}>
                    <div style={{fontSize: '.8rem'}}>{messages}</div>
                </CardBody>
                <CardFooter style={{borderTop: 'solid 1px rgba(255,255,255,.0)'}}>
                <Input type='text' value={msg} onChange={onChange}
                    placeholder={t('lobby.type_your_message')} 
                    style={{opacity: 0.5, backgroundColor: 'transparent', borderColor: 'transparent'}} 
                    onKeyDown={onKeyDown}/>
                </CardFooter>
            </Card>);

}

export function PrematchBoard ({G, ctx, sendChatMessage, chatMessages}) {
    const { t } = useContext(LocalizationContext);
    useEffect(() => {
        sendChatMessage(t('lobby.fate'));
         // eslint-disable-next-line
    }, []);
    return (<PrematchChat sendChatMessage={sendChatMessage} chatMessages={chatMessages}/>);
}