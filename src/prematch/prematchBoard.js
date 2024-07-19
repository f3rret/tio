import { Card, CardBody, CardFooter, Input } from 'reactstrap';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LocalizationContext } from '../utils';
import { colors, trueColors } from '../colors';

const PrematchChat = ({sendChatMessage, chatMessages}) => {

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

    const messages = useMemo(()=>{
        return [...chatMessages].slice(-20).reverse().map((m, i) => <p key={i} style={{margin: 0, color: trueColors[colors[m.sender]][0]}}><b>{'> '}</b>{m.payload}</p>)
    }, [chatMessages]);

    return (<Card style={{border: 'solid 1px rgba(255,255,255,.25)', width: '100%', height: '10rem', fontFamily: 'system-ui, arial, verdana'}}>
                <CardBody style={{overflowY: 'auto'}}>
                    <div style={{fontSize: '.75rem'}}>{messages}</div>
                </CardBody>
                <CardFooter style={{borderTop: 'solid 1px rgba(255,255,255,.0)', padding: 0}}>
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