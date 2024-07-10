
import { Card, CardImg,  CardTitle, CardSubtitle, CardBody, CardText, CardFooter, Button, ButtonGroup, Row, Col, UncontrolledCollapse, UncontrolledTooltip,
    Modal, ModalHeader, ModalBody, ModalFooter, ListGroup, ListGroupItem, Input, Label, Badge } from 'reactstrap';
import { useState, useMemo, useCallback, useEffect, useRef, useContext } from 'react';
import { useCookies } from 'react-cookie';
import { produce } from 'immer';
import cardData from './cardData.json';
import techData from './techData.json';
import { checkObjective, StateContext, LocalizationContext, haveTechnology, UNITS_LIMIT, getPlanetByName } from './utils';
//import { LobbyClient } from 'boardgame.io/client';
import settings from '../package.json';

export function PaymentDialog(args) {
    
    const { t } = useContext(LocalizationContext);
    let objective = args.G.pubObjectives.find(o => o.id === args.oid);
    if(!objective) objective = args.race.secretObjectives.find(o => o.id === args.oid);
    const [payment, setPayment] = useState({});

    const acceptable = useMemo(()=>{
        return Object.keys(objective.req).every((k) => {
            if(k === 'influence' || k === 'resources'){
                return payment[k] && payment[k].planets.reduce((a,b) => b[k] + a, 0) + payment[k].tg >= objective.req[k]
            }
            else if(k === 'tg'){
                return args.race.tg >= objective.req[k]
            }
            else if(k === 'token'){
                return payment[k] && payment[k].t + payment[k].s >= objective.req[k]
            }
            else if(k === 'fragment'){
                return payment[k] && payment[k].h + payment[k].i + payment[k].c + payment[k].u >= objective.req[k];
            }
            else return false;
        })
    }, [payment, args, objective])

    return (
        <Modal className='borderedPanel' style={{maxWidth: '35rem', margin: '10rem', background: "no-repeat 0% 0% / 100% 100% url('/bg1.png')"}} isOpen={args.isOpen} toggle={()=>args.toggle()}>
            <ModalHeader toggle={()=>args.toggle()} style={{backgroundColor: 'rgba(255,215,0,.75)', color: 'black'}}>
                {t('cards.objectives.' + args.oid + '.label')}
            </ModalHeader>
            <ModalBody style={{color: 'white'}}>
                <p style={{fontSize: '75%', fontWeight: 'normal'}}>{t('cards.objectives.' + args.oid + '.title')}</p>
                <PaymentCard {...args} onPayment={setPayment} objective={objective}/>
            </ModalBody>
            <ModalFooter style={{color: 'white'}}>
                <button disabled={!acceptable} className='styledButton green' onClick={()=>args.toggle(payment)}>
                    {t('board.confirm')}
                </button>
            </ModalFooter>
        </Modal>
    );
}

export const getStratColor = (strat, op) => {
    let color = 'rgba(255, 255, 0, '+op+')';
    if(strat === 'WARFARE') color = 'rgba(0, 83, 189, '+op+')';
    else if(strat === 'TRADE') color = 'rgba(20, 94, 95, '+op+')';
    else if(strat === 'LEADERSHIP') color = 'rgba(119, 22, 31, '+op+')';
    else if(strat === 'CONSTRUCTION') color = 'rgba(30, 78, 54, '+op+')';
    else if(strat === 'DIPLOMACY') color = 'rgba(157, 84, 15, '+op+')';
    else if(strat === 'TECHNOLOGY') color = 'rgba(26, 40, 105, '+op+')';
    else if(strat === 'IMPERIAL') color = 'rgba(153, 33, 133, '+op+')';
    return color;
}

export const AgendaDialog = ({ onConfirm, mini }) => {
    const { G, playerID, exhaustedCards, PLANETS, moves, ctx } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const [ex, setEx] = useState({});
    const [voteRadio, setVoteRadio] = useState('for');
    const [agendaNumber, setAgendaNumber] = useState(1);
    const voteSelect = useRef(null);

    const imVoted = useMemo(()=>{
        return G.races[playerID].voteResults.length >= agendaNumber;
    }, [G.races, playerID, agendaNumber])

    const planetRowClick = useCallback((pname) => {
        if(imVoted) return;
        if(!PLANETS.find(p => p.name === pname).exhausted){
            setEx(produce(ex, draft => {
                if(draft[pname]){
                    delete draft[pname];
                }
                else{
                    draft[pname] = true;
                }
            }));
        }
    }, [PLANETS, ex, imVoted]);

    const votes = useMemo(()=>{
        let result = PLANETS.filter(p => ex[p.name]).reduce((a,b) => b.influence + a, 0);
        if(exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1){
            result += 3;
        }
        return result;
    },[ex, PLANETS, exhaustedCards]);

    const confirmClick = useCallback(() => {
        onConfirm({vote: voteSelect.current ? voteSelect.current.value : voteRadio, ex, exhaustedCards});
        setEx({});
        setVoteRadio('for');
    }, [ex, onConfirm, voteRadio, exhaustedCards]);

    const afterVoteActions = useMemo(() => {
        if(ctx.activePlayers && ctx.activePlayers[playerID] === 'afterVoteActionCard'){
            if(G.races[playerID].actionCards){
                let result = G.races[playerID].actionCards.filter(ac => ac.after === true).map(ac => ac.id);
                return result;
            }
        }
    }, [G.races, playerID, ctx.activePlayers]);

    const afterVoteStage = useMemo(() => {
       return ctx.activePlayers && Object.keys(ctx.activePlayers).length && Object.values(ctx.activePlayers)[0] === 'afterVoteActionCard'
    }, [ctx.activePlayers]);

    const actionCardStage = useMemo(() => {
        return ctx.activePlayers && Object.keys(ctx.activePlayers).length && Object.values(ctx.activePlayers)[0] === 'actionCard'
     }, [ctx.activePlayers]);

    const myTurn = useMemo(() => String(ctx.currentPlayer) === String(playerID), [ctx.currentPlayer, playerID]);
    const iAmFinished = useMemo(() => 
        G.passedPlayers.lastIndexOf(playerID) > G.passedPlayers.indexOf(playerID), [G.passedPlayers, playerID]
    );

    //const CARD_STYLE = {background: 'none', border: 'solid 1px rgba(74, 111, 144, 0.42)', padding: '1rem', marginBottom: '1rem'}
    const a = useMemo(() => G['vote' + agendaNumber], [agendaNumber, G]);
/*
G.races[playerID].actions.length === agendaNumber &&
{afterVoteActions && <p><i>{'You can now select one of your action card to use it after this round: '}<b>{afterVoteActions.join(', ')}</b></i></p>}
*/
    return <Card className='borderedPanel bigDialog' style={{width: mini ? '25%':'50%'}}>
        <CardTitle style={{borderBottom: '1px solid rgba(0, 0, 0, 0.42)', color: 'black'}}><h3>{t('board.agenda_vote')}</h3></CardTitle>
        <CardBody style={{display: 'flex'}}>
            <div style={{width: mini ? '100%':'50%', border: 'solid 1px', color: 'black', position: 'relative', padding: '1rem', marginBottom: '1rem', borderRadius: '5px'}}>
                <img alt='agenda card' style={{width: '3rem', float: 'right', margin: '.5rem'}} src='icons/agenda_black.png'/>
                <h6 style={{marginBottom: '2rem'}}>{t('cards.agenda.' + a.id + '.label') + ' ' + t('board.agenda_' + a.type).toUpperCase()}</h6>
                
                {a.elect && <b>{t('board.elect') + ': ' + t('board.elect_type.' + a.elect)}</b>}
                <p style={{margin: 0}}>{a.for && <>{a.against ? <b>{t('board.for') + ': '}</b> :''} {t('cards.agenda.' + a.id + '.for')}</>}</p>
                <p>{a.against && <><b>{t('board.against') + ': '}</b>{t('cards.agenda.' + a.id + '.against')}</>}</p>

                {!imVoted && !mini && G.races[playerID].actions.length === agendaNumber && <>
                    {!a.elect && a.for && <h6 style={{marginTop: '2rem'}}>
                        <span onClick={()=>setVoteRadio('for')}><Input type='radio' name='vote' checked={voteRadio === 'for' ? 'checked':''} value='for' onChange={()=>setVoteRadio('for')} style={{margin: '0 .5rem'}}/><Label for='vote' style={{margin: '0 .5rem'}}>{t('board.for')}</Label></span>
                        <span onClick={()=>setVoteRadio('against')}><Input type='radio' name='vote' checked={voteRadio === 'against' ? 'checked':''} value='against' onChange={()=>setVoteRadio('against')} style={{margin: '0 .5rem'}}/><Label for='vote' style={{margin: '0 .5rem'}}>{t('board.against')}</Label></span>
                        <span onClick={()=>setVoteRadio('pass')}><Input type='radio' name='vote' checked={voteRadio === 'pass' ? 'checked':''} value='pass' onChange={()=>setVoteRadio('pass')} style={{margin: '0 .5rem'}}/><Label for='vote' style={{margin: '0 .5rem'}}>{t('board.nav.pass')}</Label></span>
                    </h6>}
                    {a.elect && <>
                        <Input type='select' innerRef={voteSelect} onChange={()=>{}} style={{margin: '1rem 0', color: 'black', fontWeight: 'bold'}}>
                            {a.elect === 'Player' && G.races.map((r,i) => <option key={i} value={r.name}>{r.name}</option>)}
                            {a.elect === 'Law' && G.laws.map((l,i) => <option key={i} value={l.id}>{l.id}</option>)}
                            {a.elect === 'Scored Secret Objective' && G.races.map((r,i) => r.secretObjectives.map(s => s.players && s.players.length > 0 && <option key={s} value={s.id}>{s.id}</option>))}
                            {a.elect === 'Planet' && G.tiles.map((t,i) => t.tdata.planets && t.tdata.planets.map(p => <option key={p.name} value={p.name}>{p.name}</option>))}
                            {a.elect === 'Industrial Planet' && G.tiles.map((t,i) => t.tdata.planets && t.tdata.planets.map(p => p.trait === 'industrial' && <option key={p.name} value={p.name}>{p.name}</option>))}
                            {a.elect === 'Hazardous Planet' && G.tiles.map((t,i) => t.tdata.planets && t.tdata.planets.map(p => p.trait === 'hazardous' && <option key={p.name} value={p.name}>{p.name}</option>))}
                            {a.elect === 'Cultural Planet' && G.tiles.map((t,i) => t.tdata.planets && t.tdata.planets.map(p => p.trait === 'cultural' && <option key={p.name} value={p.name}>{p.name}</option>))}
                            {a.elect === 'NonHome nonMecatol system' && G.tiles.map((t) => t.tid > 0 && t.tdata.type !== 'green' && t.tdata.planets && t.tdata.planets.map(p => <option key={p.name} value={p.name}>{p.name}</option>))}
                        </Input>
                    </>}
                    <p><button className='styledButton green' disabled={!myTurn} onClick={confirmClick}>{t('board.confirm') + ' ' + votes + ' ' + t('board.votes')}</button></p>
                </>}
            
                <div style={{display: 'flex', flexDirection: 'column', marginTop: '2rem'}}>
                    {G.races.map((r, i) => {
                        let adj = 0;
                        
                        if(haveTechnology(r, 'PREDICTIVE_INTELLIGENCE')){
                            if(r.exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') === -1){
                                adj = 3;
                            }
                            if(agendaNumber > 1 && r.voteResults[agendaNumber-2] && r.voteResults[agendaNumber-2].withTech === 'PREDICTIVE_INTELLIGENCE'){
                                adj += 3;
                            }
                        }

                        return <div key={i} style={{display: 'flex', lineHeight: '2rem'}}>
                            <div style={{width: '2rem', height: '2rem', color: 'white', textAlign: 'center', background: 'url("icons/influence_bg.png") center no-repeat', backgroundSize: 'contain'}}>
                                <b>{r.votesMax + adj - (agendaNumber > 1 ? r.voteResults[agendaNumber-2].count: 0)}</b>
                            </div>
                            <b>{r.name + ( r.voteResults.length >= agendaNumber ? 
                                        ' : ' + ( r.voteResults[agendaNumber-1].vote !== null ? r.voteResults[agendaNumber-1].count + ' ' + r.voteResults[agendaNumber-1].vote.toUpperCase() : ' - ')
                                        : '') }
                            </b>
                        </div>
                    })}
                </div>
                
                {!mini && G.races[playerID].actions.length < agendaNumber && <>
                    <br/><p><i>{t('board.use_card_or_pass')}</i></p>
                    <button disabled={!myTurn} className='styledButton black' onClick={()=>moves.pass()}>{t('board.nav.pass')}</button>
                </>}

                {a && a.decision && <h6 style={{color: 'white', margin: '1rem 0', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.5)'}}>
                    {t('board.decision') + ': ' + (['for', 'against'].includes(a.decision) ? t('board.' + a.decision) : a.decision)}</h6>}

                {afterVoteStage && <>
                    {afterVoteActions && <>
                        <br/><p><i>{t('board.use_card_or_pass')}</i></p>
                        <button className='styledButton black' onClick={()=>moves.pass()}>{t('board.nav.pass')}</button>
                    </>}
                    {!afterVoteActions && <>
                        <b>{t('board.awaiting_other_players')}...</b>
                    </>}
                </>}

                {!afterVoteStage && !actionCardStage && G.vote2 && !G.vote2.decision && agendaNumber < 2 && 
                    <button className='styledButton green' onClick={()=>setAgendaNumber(agendaNumber + 1)} style={{marginTop: '2rem'}}>{t('board.next')}</button>}
                {myTurn && !afterVoteStage && !actionCardStage && G.vote2 && G.vote2.decision && agendaNumber === 2 && !iAmFinished &&
                    <button className='styledButton black' onClick={()=>moves.endVote()} style={{marginTop: '2rem'}}>{t('board.end')}</button>}
            </div>
            {!mini && <div style={{width: '50%', overflowY: 'auto', maxHeight: '30rem', marginLeft: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                <PlanetsRows PLANETS={PLANETS} onClick={planetRowClick} exhausted={ex}/>
            </div>}
        </CardBody>
    </Card>

}

export const StrategyDialog = ({ R_UNITS, R_UPGRADES, selectedTile, selectedPlanet, onComplete, onDecline }) => {

    const {G, ctx, playerID, exhaustedCards, PLANETS, UNITS} = useContext(StateContext);
    const {t} = useContext(LocalizationContext);
    const sid = G.strategy;
    const isMine = ctx.currentPlayer === playerID;
    let lastStep = 1;
    
    const MINE_STYLE = {border: 'solid 1px ' + getStratColor(sid, '.6'), padding: '1rem', backgroundColor: 'rgba(0,0,0,.15)'};
    const TOKENS_STYLE = { display: 'flex', textAlign: 'center', padding: 0, flexFlow: 'column', background: 'none', color: 'white'}

    const [step, setStep] = useState(0);
    const [currentUnit, setCurrentUnit] = useState('FLAGSHIP');
    const [deploy, setDeploy] = useState({});
    const [ex, setEx] = useState({}); //exhausted
    const [adjSpec, setAdjSpec] = useState([]);
    const [ex2, setEx2] = useState({});
    const [result, setResult] = useState(0);
    const [tg, setTg] = useState(0);
    const [selectedRace, setSelectedRace] = useState(-1);
    const [agendaCards, setAgendaCards] = useState(G.agendaDeck.slice(-2));
    const [ct, setCt] = useState(() => {
        const tokens = {...G.races[playerID].tokens};
        tokens.new = G.races[playerID].tokens.new ? G.races[playerID].tokens.new + 1 : 1
        return tokens;
    });

    switch(sid){
        case 'LEADERSHIP':
            break;
        case 'DIPLOMACY':
            lastStep = 2;
            break;
        case 'POLITICS':
            if(isMine)
                lastStep = 3;
            else
                lastStep = 2;
            break;
        case 'CONSTRUCTION':
            if(isMine)
                lastStep = 2;
            else
                lastStep = 1;
            break;
        case 'TRADE':
            if(isMine)
                lastStep = 2;
            else
                lastStep = 1;
            break;
        case 'WARFARE':
            lastStep = 2;
            break;
        case 'TECHNOLOGY':
            lastStep = 2;
            break;
        case 'IMPERIAL':
            lastStep = 3;
          break;
        default:
          break;
    }

    useEffect(()=>{
        if(sid === 'LEADERSHIP'){
            let influence = 0;
            Object.keys(ex).forEach(e =>{
                const planet = PLANETS.find(p => p.name === e)
                if(ex[e]){
                    influence += planet.influence;
                }
            });
            setResult(Math.floor((influence + tg) / 3) + (isMine ? 3 : 0));
        }
        else if(sid === 'WARFARE' && step === 2 && !isMine){
            let resources = 0;
            Object.keys(ex2).forEach(e =>{
                const planet = PLANETS.find(p => p.name === e)
                if(ex2[e]){
                    resources += planet.resources;
                }
            });
            setResult(resources + tg);
        }
        else if(sid === 'TECHNOLOGY'){
            let resources = 0;
            let keys = Object.keys(ex);
            if(!haveTechnology(G.races[playerID], 'PSYCHOARCHAEOLOGY')) keys = keys.filter(e => adjSpec.indexOf(e) === -1);

            keys.forEach(e =>{
                const planet = PLANETS.find(p => p.name === e)
                if(!planet){
                    setEx(produce(ex, draft => {
                        delete draft[e];
                    }));
                }
                else if(ex[e]){
                    resources += planet.resources;
                }
            });
            let r = Math.floor((resources + tg) / (isMine ? 6:4));
            if(r > 1) r = 1;
            if(isMine) r++;
            setResult(r);
        }
    }, [ex, ex2, tg, isMine, sid, PLANETS, step, adjSpec, G.races, playerID]);

    const maxDeployUnits = useMemo(() => {
        if(sid === 'WARFARE' && !isMine){
            const pnames = Object.keys(ex);
            const planet = PLANETS.find(p => p.name === pnames[0]);
            
            if(planet){
                let sd = planet.units['spacedock'].length * R_UNITS['SPACEDOCK'].production;
                let max = planet.resources + sd;

                /*if(exhaustedCards.indexOf('War Machine')>-1){
                    max += 4;
                }*/

                return max;
            }
        }
        return 0;
    }, [ex, PLANETS, R_UNITS, sid, isMine]);

    const deployPrice = useMemo(() => {
        if(sid === 'WARFARE' && !isMine){
            let sum = 0;
            const keys = Object.keys(deploy);
            if(keys.length){
                keys.forEach(k =>{
                    sum += deploy[k] * R_UNITS[k].cost;
                });
            }

            if(exhaustedCards.indexOf('AI_DEVELOPMENT_ALGORITHM')>-1){
                const upgrades = G.races[playerID].technologies.filter(t => t.alreadyUpgraded === true);
    
                if(upgrades && upgrades.length){
                    sum -= upgrades.length;
                }
            }

            /*if(exhaustedCards.indexOf('War Machine')>-1){
                sum -= 1;
            }*/

            if(haveTechnology(G.races[playerID], 'SARWEEN_TOOLS')){
                sum -= 1;
            }

            return sum;
        }
        return 0;
    }, [deploy, sid, isMine, R_UNITS, G.races, playerID, exhaustedCards]);

    const planetRowClickSpecialty = useCallback((pname) =>{

        if(!haveTechnology(G.races[playerID], 'PSYCHOARCHAEOLOGY') && !PLANETS.find(p => p.name === pname).exhausted){
            setEx(produce(ex, draft => {
                if(draft[pname]){
                    delete draft[pname];
                    setAdjSpec(adjSpec.filter(a => a !== pname));
                }
                else{
                    draft[pname] = true;
                    setAdjSpec([...adjSpec, pname]);
                }
            }));
        }

    }, [PLANETS, adjSpec, ex, G.races, playerID]);

    const planetRowClick = useCallback((pname) => {
        if(sid === 'LEADERSHIP' || sid === 'TECHNOLOGY'){
            if(!PLANETS.find(p => p.name === pname).exhausted){
                setEx(produce(ex, draft => {
                    if(draft[pname]){
                        delete draft[pname];
                    }
                    else{
                        draft[pname] = true;
                    }
                }));
            }
        }
        else if(sid === 'DIPLOMACY'){
            if(PLANETS.find(p => p.name === pname).exhausted){
                setEx(produce(ex, draft => {
                    if(draft[pname]){
                        delete draft[pname];
                    }
                    else{
                        if(Object.keys(draft).length < 2){
                            draft[pname] = 'ready';
                        }
                    }
                }));
            }
        }
        else if(sid === 'CONSTRUCTION'){
            /*if(step === 1){
                setEx(produce(ex, draft => {
                    if(draft[pname]){
                        delete draft[pname];
                    }
                    else{
                        Object.keys(ex).forEach(k=>delete draft[k]);
                        draft[pname] = 'pds';
                    }
                }));
            }
            else if(step === 2){
                setEx2(produce(ex2, draft => {
                    if(draft[pname]){
                        delete draft[pname];
                    }
                    else{
                        Object.keys(ex2).forEach(k=>delete draft[k]);
                        draft[pname] = 'pds';
                    }
                }));
            }*/
        }
        if(sid === 'WARFARE'){
            if(step === 1){
                setEx(produce(ex, draft => {
                    if(draft[pname]){
                        delete draft[pname];
                    }
                    else{
                        Object.keys(ex).forEach(k=>delete draft[k]);
                        draft[pname] = 'spacedock';
                    }
                }));
            }
            else if(step === 2){
                if(!PLANETS.find(p => p.name === pname).exhausted){
                    setEx2(produce(ex2, draft => {
                        if(draft[pname]){
                            delete draft[pname];
                        }
                        else{
                            draft[pname] = true;
                        }
                    }));
                }
            }
        }
    }, [ex, ex2, sid, PLANETS, step]);

    const raceRowClick = useCallback((rid)=>{
        if(G.speaker !== rid){
            setSelectedRace(rid);
        }
    }, [G.speaker]);

    const raceMultiRowClick = useCallback((rid)=>{

        setSelectedRace(produce(selectedRace, draft => {
            if(!Array.isArray(selectedRace)){
                return [rid];
            }
            else{
                const idx = selectedRace.indexOf(rid);
                if(idx > -1){
                    const ar = [...selectedRace];
                    ar.splice(idx, 1);
                    return ar;
                }
                else{
                    draft.push(rid);
                }
            }
        }));
    }, [selectedRace]);

    const tgClick = useCallback(() => {
    
        const max = G.races[playerID].tg;
        if(tg < max){
            setTg(tg+1);
        }

    }, [tg, G.races, playerID]);

    const Tokens = ({count}) => {
        const result = [];
        for(var i=0; i < count; i++){
            result.push(<img key={i} style={{width: '2rem'}} alt='token' src={'race/icons/' + G.races[playerID].rid + '.png'}/>);
        }
        return result;
    }
//unmeet reqs
    const cantNext = useMemo(() => {
        let stopThere = false;

        if(sid === 'DIPLOMACY' && step === 1 && isMine){
            stopThere = true;

            if(selectedTile > 0){
                if(G.tiles[selectedTile].tdata.planets){
                    // eslint-disable-next-line
                    if(G.tiles[selectedTile].tdata.planets.some(p => p.occupied == playerID)){
                        stopThere = false;
                    }
                }
            }
        }
        else if(sid === 'POLITICS' && step === 1 && isMine){
            stopThere = (selectedRace === -1)
        }
        else if(sid === 'CONSTRUCTION'){
            if(step === 1 && isMine){
                const keys = Object.keys(ex);
                stopThere = ! (keys.length > 0 && (ex[keys[0]] === 'pds' || ex[keys[0]] === 'spacedock'))
                if(!stopThere){
                    const planet = getPlanetByName(G.tiles, keys[0]);
                    
                    if(planet){
                        if(String(planet.occupied) !== String(playerID)){
                            stopThere = true;
                        }
                        else if(ex[keys[0]] === 'spacedock'){
                            if(planet.units && planet.units['spacedock'] && planet.units['spacedock'].length){
                                stopThere = true;
                            }
                        }
                    }
                    else{
                        stopThere = true;
                    }
                }
            }
            else if(step === 2){
                const keys = Object.keys(ex2);
                stopThere = ! (keys.length > 0 && (ex2[keys[0]] === 'pds'))

                if(!stopThere){
                    const planet = getPlanetByName(G.tiles, keys[0]);
                    if(!planet){
                        stopThere = true;
                    }
                }
            }
        }
        else if(sid === 'WARFARE'){
            if(step === 2 && isMine){
                stopThere = ct.new > 0;
            }
            else if(step === 2 && !isMine){
                stopThere = deployPrice > result;
            }
        }
        else if(sid === 'TECHNOLOGY'){
            if(step === 2){
                const reqs = UnmeetReqs({separate: true, PLANETS, ex2, adjSpec, G, playerID});
                if(exhaustedCards.indexOf('AI_DEVELOPMENT_ALGORITHM') > -1){
                    stopThere = reqs.upgrades.length > 1 || reqs.other.length > 0;
                }
                else{
                    stopThere = reqs.upgrades.length > 0 || reqs.other.length > 0;
                }       
            }
        }
        else if(sid === 'IMPERIAL'){
            if(isMine && selectedRace){
                let obj = G.pubObjectives.find(o => o.id === selectedRace);
                if(step === 1){
                    if(obj && obj.type !== 'SPEND' ){
                        stopThere = !checkObjective(G, playerID, selectedRace)
                    }
                }
                if(step === 2){
                    if(obj && obj.type === 'SPEND'){
                        stopThere = !Object.keys(obj.req).every((k) => {
                            if(k === 'influence' || k === 'resources'){
                                return deploy[k] && deploy[k].planets.reduce((a,b) => b[k] + a, 0) + deploy[k].tg >= obj.req[k]
                            }
                            else if(k === 'tg'){
                                return G.races[playerID].tg >= obj.req[k]
                            }
                            else if(k === 'token'){
                                return deploy[k] && deploy[k].t + deploy[k].s >= obj.req[k]
                            }
                            else return false;
                        });
                    }
                }
            }
        }
    
        return stopThere;

    }, [selectedTile, selectedRace, G, step, isMine, sid, playerID, ex, ex2, ct, deployPrice, deploy, result, PLANETS, adjSpec, exhaustedCards]);

    const placeAgendaTopOrBottom = useCallback((idx) => {
       setAgendaCards(produce(agendaCards, draft => {
           draft[idx].bottom = !draft[idx].bottom;
       }));
    }, [agendaCards]);

    const redistCt = useCallback((tag, inc) => {
        setCt(produce(ct, draft => {
            if(inc > 0 && ct.new > 0){
                draft.new--;
                draft[tag]++;
            }
            else if(inc < 0 && ct[tag] > 0){
                draft.new++;
                draft[tag]--;
            }
        }));
    }, [ct])

    const deployUnit = (inc, uname) => {
        let unitsCount = 0;
        const keys = Object.keys(deploy);
        keys.forEach(k => unitsCount += deploy[k]);
        if(unitsCount < maxDeployUnits || inc < 0){
            setDeploy(produce(deploy, draft => {
                if(inc > 0){
                    if(!deploy[currentUnit]) draft[currentUnit] = 0;
                    draft[currentUnit]++;
                }
                else{
                    draft[uname]--;
                    if(draft[uname] === 0) delete draft[uname];
                }
            }));
        }
    }

    const exceedLimit = useCallback((currentUnit) => {
        const unit = currentUnit.toLowerCase();
        const d = deploy[currentUnit] || 0;
        const u = UNITS[unit] || 0;
        
        return d + u >= UNITS_LIMIT[unit];
    }, [UNITS, deploy]);

    const doneButtonClick = ()=>{ 
        let r = result;
        
        if(sid === 'DIPLOMACY') r = selectedTile;
        else if(sid === 'POLITICS') r = {selectedRace, agendaCards};
        else if(sid === 'CONSTRUCTION') r = [ex, ex2];
        else if(sid === 'TRADE') r = selectedRace;
        else if(sid === 'WARFARE'){
            if(isMine) r = {selectedTile, tokens: {...ct}}
            else r = {base: ex && Object.keys(ex) ? Object.keys(ex)[0]:undefined, deploy}
        }
        else if(sid === 'TECHNOLOGY') r = ex2;
        else if(sid === 'IMPERIAL'){
            if(isMine) r = {objId: selectedRace, payment: deploy}
        }        

        onComplete({exhausted: Object.keys(sid === 'WARFARE' ? ex2 : ex), tg, result: r, exhaustedCards});
        setStep(step+1) 
    }

    const nextButtonClick = ()=>{
        let inc = 1; 
        if(['DIPLOMACY', 'POLITICS'].indexOf(sid) > -1 && !isMine){
            inc = 2
        }
        else if(sid === 'IMPERIAL'){
            if(!isMine && step === 0){
                inc = 3;
            }
            else if(isMine && step === 1){
                inc = 2;

                if(selectedRace){
                    let obj = G.pubObjectives.find(o => o.id === selectedRace);

                    if(obj && obj.type === 'SPEND'){
                        inc = 1;
                    }
                }
            }
        }
        setStep(step+inc)
    }

    const backButtonClick = ()=>{
        let inc = 1;
        if(['DIPLOMACY', 'POLITICS'].indexOf(sid) > -1 && !isMine){
            inc = 2
        }
        else if(sid === 'IMPERIAL'){
            if(!isMine && step === 3){
                inc = 3;
            }
            else if(isMine && step === 3){
                inc = 2;
                /*if(selectedRace){
                    inc = 1;
                }*/
            }
        }
        setStep(step-inc)
    }

    const techOnSelect = (tech) => {
        if(G.races[playerID].knownTechs.indexOf(tech.id) === -1){
            setEx2(produce(ex2, draft => {
                if(draft[tech.id]){
                    delete draft[tech.id];
                }
                else{
                    draft[tech.id] = tech;
                }

                const keys = Object.keys(draft);
                if(keys.length > result){
                    delete draft[keys[0]];
                }
            }));
        }
    }

    const selectObjective = (oid)=> {
        if(selectedRace === oid){
            setSelectedRace(null);
        }
        else{
            setSelectedRace(oid)
        }
    }
    
    useEffect(()=>{
        if(step === 1 && sid === 'TECHNOLOGY'){
            if(haveTechnology(G.races[playerID], 'PSYCHOARCHAEOLOGY')){
                const specs = [];
                PLANETS.forEach(p => {
                    if(p.specialty){
                        specs.push(p.name);
                    }
                });
                setAdjSpec(specs);
            }
        }
    // eslint-disable-next-line
    }, [step]);

    useEffect(() => {
        if(sid === 'CONSTRUCTION' && selectedTile > -1){
            const tile = G.tiles[selectedTile];
            if(tile && tile.tdata){
                const planet = tile.tdata.planets[selectedPlanet];

                if(planet && planet.name){
                    if(step === 1){
                        setEx({[planet.name]: 'pds'});
                        setEx2({[planet.name]: 'pds'});
                    }
                    else if(step === 2){
                        setEx2({[planet.name]: 'pds'});
                    }
                }
            }
        }

    }, [selectedPlanet, selectedTile, sid, step, G.tiles])

    return (
        <Card className='borderedPanel bigDialog' style={{maxWidth: '60%'}}>
              <CardTitle style={{borderBottom: '1px solid ' + getStratColor(sid, '.6'), color: 'black'}}><h3>{t('cards.strategy.' + sid + '.label')}</h3></CardTitle>
              <CardBody style={{display: 'flex', color: 'black', width: sid === 'WARFARE' && step === 2 && !isMine ? '':'min-content'}}>
                    {step === 0 && <>
                        <div>
                            <CardImg src={'race/'+ G.races[ctx.currentPlayer].rid +'.png'} style={{width: '205px'}}/>
                        </div>
                        <div style={{padding: '1rem', minWidth: '30rem'}}>
                            <div style={isMine? MINE_STYLE : {opacity: .5, padding: '1rem'}}>
                                <h5>{t('board.primary')}:</h5>
                                <p>{t('cards.strategy.' + sid + '.primary')}</p>
                            </div>
                            <div style={!isMine? MINE_STYLE : {opacity: .5, padding: '1rem'}}>
                                <h5>{t('board.secondary')}:</h5>
                                <p>{t('cards.strategy.' + sid + '.secondary')}</p>
                            </div>
                        </div>
                    </>}
                    {step === 1 && <div style={{display: 'flex', flexDirection: 'column', width: 'min-content'}}>
                        <p style={{margin: 0, minWidth: '40rem'}}>{isMine ? t('cards.strategy.' + sid + '.primary') : t('cards.strategy.' + sid + '.secondary')}</p>
                        {sid === 'LEADERSHIP' && <div style={{display: 'flex', width: '50rem', flexDirection: 'row'}}>
                            <div style={{width: '60%', overflowY: 'auto', maxHeight: '30rem', margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                <PlanetsRows PLANETS={PLANETS} onClick={planetRowClick} exhausted={ex}/>
                            </div>
                            <div style={{width: '40%', padding: '2rem'}}>
                                <h5 style={{fontSize: '50px', display: 'flex', justifyContent: 'flex-end'}}>{'+'}{tg}{' '}<Button tag='img' onClick={tgClick} src='/icons/trade_good_1.png' color='warning' 
                                    style={{marginLeft: '1rem', width: '4rem', padding: '.5rem', borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} />
                                    <Button disabled={tg < 1} color='warning' style={{width: '1.5rem', borderLeft: 'none', color:'orange', backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: 0}} onClick={()=>setTg(tg-1)}>▼</Button></h5>
                                <h5 style={{display: 'flex', justifyContent: 'flex-end'}}>{t('board.you_gain') + ': '}</h5>
                                <div style={{display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap'}}><Tokens count={result}/></div>
                            </div>
                        </div>}
                        {sid === 'DIPLOMACY' && <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
                            <div style={{width: '60%', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                {selectedTile === -1 && <h5 style={{margin: '2rem'}}>{t('board.select_system')}</h5>}
                                {selectedTile > -1 && <CardImg style={{width: '75%'}} src={'tiles/ST_'+G.tiles[selectedTile].tid+'.png'} />}
                            </div>
                        </div>}
                        {sid === 'POLITICS' && <div style={{margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                            <RaceList races={G.races} onClick={raceRowClick} selected={selectedRace} speaker={G.speaker}/>
                        </div>}
                        {sid === 'CONSTRUCTION' && <div style={{display: 'flex', flexDirection: 'row', marginTop: '2rem'}}>
                            {(selectedTile === -1 || selectedPlanet === -1) && <h5 style={{margin: '2rem'}}>{t('board.click_planet')}</h5>}

                            {selectedTile > -1 && selectedPlanet > -1 && <div style={{display: 'flex', flexFlow: 'column', width: '100%'}}>
                                <div style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', height: '3.25rem', padding: '0 1rem'}}>
                                    <PlanetsRows PLANETS={PLANETS.filter(p => p.tid === G.tiles[selectedTile].tid && p.pidx === selectedPlanet)} onClick={()=>{}} exhausted={ex} emptyListMsg={t('board.select_planet_you_own')}/>
                                </div>
                            
                                {Object.keys(ex).length > 0 && <div style={{padding: '2rem 0', display: 'flex', justifyContent: 'center'}}>
                                    
                                    <button className={'styledButton ' + (ex[Object.keys(ex)[0]] === 'pds' ? 'green':'black')} onClick={()=>setEx(produce(ex, draft => {draft[Object.keys(ex)[0]] = 'pds'}))} style={{}}>{t('cards.techno.PDS.label')}</button>

                                    <button className={'styledButton ' + (ex[Object.keys(ex)[0]] === 'spacedock' ? 'green':'black')} onClick={()=>setEx(produce(ex, draft => {draft[Object.keys(ex)[0]] = 'spacedock'}))} style={{}}>{t('cards.techno.SPACEDOCK.label')}</button>

                                </div>}
                            </div>}
                        </div>}
                        {sid === 'TRADE' && <div style={{display: 'flex', alignItems: 'center', flexDirection: 'column', padding: '2rem'}}>
                            <h5 style={{margin: '1rem'}}>{t('board.you_gain') + ': '}</h5>
                            <Row style={{height: '5rem', width: '25rem', justifyContent: 'center'}}>
                                {isMine && <><Col xs='3' style={{display: 'flex', alignItems: 'center'}}><h5 style={{fontSize: '50px'}}>+3</h5></Col>
                                <Col xs='3' style={{padding: 0, display: 'flex', alignItems: 'center'}}><img style={{width: '5rem', height: '5rem', borderRadius: '5px', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} alt='tg' src='icons/trade_good_1.png'/></Col></>}
                                <Col xs='3' style={{display: 'flex', alignItems: 'center'}}><h5 style={{fontSize: '50px'}}>{'+'}{G.races[playerID].commCap - (G.races[playerID].commodity || 0)}</h5></Col>
                                <Col xs='3' style={{padding: 0, display: 'flex', alignItems: 'center'}}><img  style={{width: '5rem', height: '5rem', borderRadius: '5px', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} alt='tg' src='icons/commodity_1.png'/></Col>
                            </Row>
                            {!isMine && <p style={{marginTop: '1rem', fontSize: '.8rem'}}>
                                {Object.keys(ctx.activePlayers).indexOf(ctx.currentPlayer) > -1 && <>{t('board.awaiting_trade_owner') + '...'}</>}
                                {Object.keys(ctx.activePlayers).indexOf(ctx.currentPlayer) === -1 && <>
                                    {G.races[ctx.currentPlayer].strategy.find(s => s.id === 'TRADE').NO_TOKEN_RACES.indexOf(G.races[playerID].rid) > -1 && <b style={{color: 'green'}}>{t('board.trade_owner_allow')}</b>}
                                    {G.races[ctx.currentPlayer].strategy.find(s => s.id === 'TRADE').NO_TOKEN_RACES.indexOf(G.races[playerID].rid) === -1 && <b>{t('board.trade_owner_disallow')}</b>}
                                </>}
                            </p>}
                        </div>}
                        {sid === 'WARFARE' && <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
                            {isMine && <div style={{width: '60%', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                {selectedTile === -1 && <h5 style={{margin: '2rem'}}>{t('board.select_system')}</h5>}
                                {selectedTile > -1 && <CardImg style={{width: '75%'}} src={'tiles/ST_'+G.tiles[selectedTile].tid+'.png'} />}
                            </div>}
                            {!isMine && <div style={{ width: '60%', overflowY: 'auto', padding: '1rem', margin:'2rem',borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                <PlanetsRows PLANETS={PLANETS.filter(p => p.tid === G.races[playerID].rid && p.units && Object.keys(p.units).indexOf('spacedock')>-1)} 
                                    onClick={planetRowClick} exhausted={ex} variant='small'/>
                            </div>}
                        </div>}
                        {sid === 'TECHNOLOGY' && <div style={{width: '50rem', display: 'flex', flexDirection: 'row'}}>
                            <div style={{width: '60%', overflowY: 'auto', minHeight: '14rem', maxHeight: '30rem', margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                <PlanetsRows PLANETS={PLANETS} resClick={(e,p)=>planetRowClick(p.name)} specClick={(e,p) => planetRowClickSpecialty(p.name)} exhausted={ex}/>
                            </div>
                            <div style={{width: '40%', padding: '2rem'}}>
                                <h5 style={{fontSize: '50px', display: 'flex', justifyContent: 'flex-end'}}>{'+'}{tg}{' '}<Button tag='img' onClick={tgClick} src='/icons/trade_good_1.png' color='warning' 
                                    style={{marginLeft: '1rem', width: '4rem', padding: '.5rem', borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} />
                                    <Button disabled={tg < 1} color='warning' style={{width: '1.5rem', borderLeft: 'none', color:'orange', backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: 0}} onClick={()=>setTg(tg-1)}>▼</Button></h5>
                                
                                <div style={{display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap'}}>
                                    <h5 style={{textAlign: 'end'}}>{t('board.you_can_learn') + ' '}</h5>
                                    <h5 style={{textAlign: 'end'}}>{result + (result === 1 ? (' ' + t('board.technology')):(' ' + t('board.technologies')))}</h5>
                                    {adjSpec.length > 0 && <h6>{t('board.and_ignore') + ' '} {adjSpec.map((pname, pi) =>{
                                        const p = PLANETS.find(p => p.name === pname);
                                        return <img alt='specialty' key={pi} style={{width: '1rem'}} src={'icons/' + p.specialty + '.png'}/>
                                    })} {' ' + t('board.requirements')}</h6>}
                                </div>
                            </div>
                        </div>}
                        {sid === 'IMPERIAL' && <div style={{display: 'flex', borderRadius: '5px', width: '35rem', margin: '1rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                            <ObjectivesList playerID={playerID} onSelect={selectObjective} selected={selectedRace} maxHeight='20rem'/>
                        </div>}
                    </div>}
                    {step === 2 && lastStep > 1 && <div style={{width: '100%', display: 'flex', flexFlow: 'column'}}>
                        <p style={{margin: 0, minWidth: '40rem'}}>{isMine ? t('cards.strategy.' + sid + '.primary') : t('cards.strategy.' + sid + '.secondary')}</p>
                        {sid === 'DIPLOMACY' && <div style={{width: '70%', overflowY: 'auto', maxHeight: '30rem', margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                            {<PlanetsRows PLANETS={PLANETS} onClick={planetRowClick} exhausted={ex}/>}
                        </div>}
                        {sid === 'POLITICS' && <div style={{display: 'flex', padding: '1rem', flexDirection: 'column', fontSize: '.8rem'}}>
                            <h5 style={{margin: '.5rem'}}>{t('board.you_gain_2_ac') + ': '}</h5>
                            {G.actionsDeck.slice(-2 * (parseInt(playerID)+1)).slice(0, 2).map((a,i) => 
                                <div key={i} style={{border: 'solid 1px', padding: '1rem', marginBottom: '1rem',  borderRadius: '5px'}}>
                                    <img alt='action card' style={{width: '3rem', float: 'left', margin: '0 1rem 1rem 0'}} src='icons/action_card_black.png'/>
                                    <h6>{t('cards.actions.' + a.id + '.label')}</h6><p>{t('cards.actions.' + a.id + '.description')}</p>
                                </div>
                            )}
                        </div>}
                        {sid === 'CONSTRUCTION' && <div style={{display: 'flex', flexDirection: 'row', marginTop: '2rem'}}>
                            {(selectedTile === -1 || selectedPlanet === -1) && <h5 style={{margin: '2rem'}}>{t('board.click_planet')}</h5>}

                            {selectedTile > -1 && selectedPlanet > -1 && <div style={{display: 'flex', flexFlow: 'column', width: '100%'}}>
                                <div style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', height: '3.25rem', padding: '0 1rem'}}>
                                    <PlanetsRows PLANETS={PLANETS.filter(p => p.tid === G.tiles[selectedTile].tid && p.pidx === selectedPlanet)} onClick={()=>{}} exhausted={ex2} emptyListMsg={t('board.select_planet_you_own')}/>
                                </div>

                                {Object.keys(ex).length > 0 && <div style={{padding: '2rem 0', display: 'flex', justifyContent: 'center'}}>
                                    <button className={'styledButton green'} style={{}}>{t('cards.techno.PDS.label')}</button>
                                </div>}
                            </div>}
                        </div>}
                        {sid === 'TRADE' && <div style={{margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                            <RaceList races={G.races.filter(r => r.rid !== G.races[playerID].rid)} onClick={raceMultiRowClick} selected={selectedRace}/>
                        </div>}
                        {sid === 'WARFARE' && <>
                            {isMine && <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem'}}>
                                <div style={{display: 'flex', padding: '1rem', borderRadius: '5px', flexDirection: 'column', color:'white', justifyContent: 'center', width: '60%', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                    <Row>
                                        <Col xs='4' style={TOKENS_STYLE}><b>{t('board.tactic')}</b></Col>
                                        <Col xs='4' style={TOKENS_STYLE}><b>{t('board.fleet')}</b></Col>
                                        <Col xs='4' style={TOKENS_STYLE}><b>{t('board.strategic')}</b></Col>
                                    </Row>
                                    <Row>
                                        <Col xs='4' style={TOKENS_STYLE}><h6 style={{fontSize: '50px'}}>{ct.t}</h6></Col>
                                        <Col xs='4' style={TOKENS_STYLE}><h6 style={{fontSize: '50px'}}>{ct.f}</h6></Col>
                                        <Col xs='4' style={TOKENS_STYLE}><h6 style={{fontSize: '50px'}}>{ct.s}</h6></Col>
                                    </Row>
                                    <Row>
                                        <Col xs='2' style={{...TOKENS_STYLE, alignItems: 'flex-end'}}><Button onClick={()=>redistCt('t', +1)} color='dark' size='sm' style={{ opacity: '.5', width:'3rem', padding: 0,fontSize: '30px'}}>+</Button></Col>
                                        <Col xs='2' style={{...TOKENS_STYLE}}><Button onClick={()=>redistCt('t', -1)} color='dark' style={{ opacity: '.5', width:'3rem', padding: 0,fontSize: '30px'}}>-</Button></Col>
                                        <Col xs='2' style={{...TOKENS_STYLE, alignItems: 'flex-end'}}><Button onClick={()=>redistCt('f', +1)} color='dark' style={{ opacity: '.5', width:'3rem', padding: 0,fontSize: '30px'}}>+</Button></Col>
                                        <Col xs='2' style={{...TOKENS_STYLE}}><Button onClick={()=>redistCt('f', -1)} color='dark' style={{ opacity: '.5', width:'3rem', padding: 0,fontSize: '30px'}}>-</Button></Col>
                                        <Col xs='2' style={{...TOKENS_STYLE, alignItems: 'flex-end'}}><Button onClick={()=>redistCt('s', +1)} color='dark' style={{ opacity: '.5', width:'3rem', padding: 0,fontSize: '30px'}}>+</Button></Col>
                                        <Col xs='2' style={{...TOKENS_STYLE}}><Button onClick={()=>redistCt('s', -1)} color='dark' style={{ opacity: '.5', width:'3rem', padding: 0,fontSize: '30px'}}>-</Button></Col>
                                    </Row>
                                    <h6 style={{textAlign: 'center', marginTop: '1rem'}}>{ct.new || 0} {' ' + t('board.unused')}</h6>
                                </div>
                            </div>}
                            {!isMine && <div style={{display: 'flex', flexDirection: 'row', flexWrap:'wrap', justifyContent:'space-between',  width: '100%'}}>
                                <div style={{width:'30rem', overflowY: 'auto', height: '22rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                    <PlanetsRows PLANETS={PLANETS} onClick={planetRowClick} exhausted={ex2}/>
                                </div>
                                <div style={{width: '35rem', position: 'relative', maxHeight: '25rem', overflowY: 'auto', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)', color: 'white', padding: '0 1rem 0 0'}}>
                                    <UnitsList UNITS={UNITS} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} rid={G.races[playerID].rid} onSelect={(u)=>setCurrentUnit(u)}/>
                                    <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', position: 'absolute', bottom: 0, right: 0}}>
                                        <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{t('board.max_units_count') + ': ' + maxDeployUnits}</h6>
                                        <button className='styledButton yellow' style={{margin: '.5rem'}} onClick={()=>deployUnit(+1)} disabled={['PDS', 'SPACEDOCK'].indexOf(currentUnit) > -1 || exceedLimit(currentUnit)}><b>{t('board.deploy')}</b></button>
                                    </div>
                                </div>
                                <div style={{display: 'flex', width: '29rem'}}>
                                    <h6 style={{display: 'flex', justifyContent: 'flex-end', flexDirection: 'column', alignItems: 'flex-end', flex: '85%'}}>
                                        {'+'}{tg}{' '}
                                        <p style={{display: 'flex', justifyContent: 'flex-end'}}>{t('board.you_mean_spend') + ' ' + result + ' ' + t('board.resources2')} / {deployPrice + ' ' + t('board.needed')}</p>
                                    </h6>
                                    <span style={{display: 'flex', alignItems: 'flex-start', flex: '15%'}}>
                                        <Button tag='img' onClick={tgClick} src='/icons/trade_good_1.png' color='warning' 
                                        style={{marginLeft: '1rem', width: '3rem', padding: '.5rem', borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} />
                                        <Button disabled={tg < 1} color='warning' style={{width: '1.5rem', borderLeft: 'none', color:'orange', backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: 0}} onClick={()=>setTg(tg-1)}>▼</Button>
                                    </span>
                                </div>
                                <div style={{width: '33rem', marginTop: '1rem'}}>
                                    
                                    {deploy && Object.keys(deploy).map((k, i) => {
                                        return (<span style={{marginRight: '1rem'}} key={i}>
                                        <Button size='sm' color='warning' style={{padding: '0 .25rem', fontSize: '.75rem'}} onClick={()=>deployUnit(-1, k)}>▼</Button>
                                        <b>{' ' + t('cards.techno.' + k + '.label') + ': ' + deploy[k]}</b></span>)
                                    })}
                                </div>
                            </div>}
                        </>}
                        {sid === 'TECHNOLOGY' && <><div style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', color: 'white', margin: '1rem 0', width: '60rem'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                {GetTechType('propulsion', G.races[playerID], true, techOnSelect, Object.keys(ex2))}
                                {GetTechType('biotic', G.races[playerID], true, techOnSelect, Object.keys(ex2))}
                                {GetTechType('warfare', G.races[playerID], true, techOnSelect, Object.keys(ex2))}
                                {GetTechType('cybernetic', G.races[playerID], true, techOnSelect, Object.keys(ex2))}
                                {GetTechType('unit', G.races[playerID], true, techOnSelect, Object.keys(ex2))}
                            </div>
                        </div>
                        <div style={{position: 'absolute', bottom: '1rem', left: '10rem'}}><UnmeetReqs G={G} playerID={playerID} PLANETS={PLANETS} adjSpec={adjSpec} ex2={ex2}/></div>
                        </>}
                        {sid === 'IMPERIAL' && <>
                            {isMine && selectedRace && <>
                                <p><b>{t('cards.objectives.' + selectedRace + '.label') + ' '}</b>
                                {t('cards.objectives.' + selectedRace + '.title')}</p>
                                <div style={{display: 'flex', flexDirection: 'row'}}>
                                    <PaymentCard race={G.races[playerID]} planets={PLANETS} objective={G.pubObjectives.find((o) => o.id === selectedRace)} onPayment={setDeploy}/>
                                </div>
                            </>}
                        </>}
                    </div>}
                    {step === 3 && lastStep > 2 && <div>
                        <p style={{margin: 0, minWidth: '40rem'}}>{isMine ? t('cards.strategy.' + sid + '.primary') : t('cards.strategy.' + sid + '.secondary')}</p>
                        {sid === 'POLITICS' && <div style={{display: 'flex', padding: '1rem', flexDirection: 'column', fontSize: '.8rem'}}>
                            {agendaCards.map((a, i) => 
                                <div key={i} style={{border: 'solid 1px', position: 'relative', padding: '1rem', marginBottom: '1rem', borderRadius: '5px'}}>
                                    <img alt='agenda card' style={{width: '3rem', float: 'right', margin: '.5rem'}} src='icons/agenda_black.png'/>
                                    <h6>{t('cards.agenda.' + a.id + '.label') + ' ' + t('board.agenda_' + a.type)}</h6>
                                    {a.elect && <b>{t('board.elect') + ': ' + t('board.elect_type.' + a.elect)}</b>}
                                    <p style={{margin: 0}}>{a.for && <>{a.against ? <b>{t('board.for') + ': '}</b> :''} {t('cards.agenda.' + a.id + '.for')}</>}</p>
                                    <p>{a.against && <><b>{t('board.against') + ': '}</b>{t('cards.agenda.' + a.id + '.against')}</>}</p>
                                    <Input id={'place_deck_bottom_'+i} style={{margin: '0.25rem', backgroundColor: 'darkgray'}} type='checkbox' checked={agendaCards[i].bottom === true} onChange={()=>placeAgendaTopOrBottom(i)}/>
                                    <Label for={'place_deck_bottom_'+i} check>{t('board.place_deck_bottom')}</Label>
                                    {i === 0 && <Button color='dark' onClick={()=>setAgendaCards([...agendaCards].reverse())} size='sm' style={{position: 'absolute', right: 0, bottom: 0 }}>▼</Button>}
                                </div>
                            )}
                        </div>}
                        {sid === 'IMPERIAL' && <>
                            {isMine && G.tiles[0].tdata.planets[0].occupied === playerID && <div style={{display: 'flex', padding: '1rem', flexDirection: 'column'}}>
                                <h5 style={{textAlign: 'center'}}>{t('board.you_gain_1_vp')}</h5>
                            </div>}
                            {(!isMine || (G.tiles[0].tdata.planets[0].occupied !== playerID)) && <div style={{display: 'flex', padding: '1rem', flexDirection: 'column', fontSize: '.8rem'}}>
                                <h5 style={{margin: '.5rem'}}>{t('board.you_gain_so') + ': '}</h5>
                                {G.secretObjDeck.slice(-1 * (parseInt(playerID)+1)).slice(0, 1).map((a,i) => 
                                    <div key={i} style={{border: 'solid 1px', padding: '1rem', marginBottom: '1rem'}}>
                                        <img alt='action card' style={{width: '3rem', float: 'left', margin: '0 1rem 1rem 0'}} src='icons/secret_regular.png'/>
                                        <h6>{t('cards.objectives.' + a.id + '.label')}</h6><p>{t('cards.objectives.' + a.id + '.title')}</p>
                                    </div>
                                )}
                            </div>}
                        </>}
                    </div>}
                    {step > lastStep && <div style={{width: '100%', display: 'flex', minWidth: '30rem', flexFlow: 'column'}}>
                        <h5>{t('board.awaiting_other_players') + ': '}</h5>
                        {Object.keys(ctx.activePlayers).map((a,i) => {
                            return <h6 key={i}>{t('races.' + G.races[a].rid + '.name')}</h6>
                        })}
                    </div>}
              </CardBody>
              {step <= lastStep && <CardFooter style={{background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid ' + getStratColor(sid, '.6'),}}>
                  {step === 0 && <button className='styledButton red' style={{opacity: isMine ? 0:1}} onClick={()=>{onDecline(); setStep(lastStep+1)}}>{t('board.decline')}</button>}
                  {step > 0 && step <= lastStep && <button className='styledButton black' onClick={backButtonClick}>{t('board.back')}</button>}
                  {step < lastStep && <button className='styledButton green' disabled={cantNext} onClick={nextButtonClick}>{step === 0 && !isMine ? t('board.accept'):t('board.next')}</button>}
                  {step === lastStep && <button className='styledButton green' disabled={cantNext} onClick={doneButtonClick}>{t('board.done')}</button>}
              </CardFooter>}
        </Card>
    );  
  
}

export const UnitsList = ({UNITS, R_UNITS, R_UPGRADES, onSelect, rid}) => {

    const { t } = useContext(LocalizationContext);
    const TOKENS_STYLE = { display: 'flex', width: '30%', borderRadius: '5px', alignItems: 'center', textAlign: 'center', flexFlow: 'column', padding: '.15rem', background: 'none', margin: '.5rem', border: '1px solid rgba(74, 111, 144, 0.42)', color: 'white'}
    const B_STYLE = {backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}
    const [showUnit, setShowUnit] = useState('FLAGSHIP');
    useEffect(()=>{
        if(showUnit && onSelect){
            onSelect(showUnit);
        }
    }, [showUnit, onSelect]);

    return <div style={{display: 'flex'}}>
        <div style={{display:'flex', flexFlow:'column', width: '30%', border: 'none'}}>
          {R_UNITS.map((u, i) =>
            <button key={i} className={'styledButton ' + (showUnit === u.id ? 'white':'black')} onClick={()=>setShowUnit(u.id)}>
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '80%'}}>
                <div>{u.alreadyUpgraded && <span style={{color: 'coral', marginRight: '.5rem'}}>▲</span>}{t('cards.techno.' + u.id + '.label')}</div>
                <div>{UNITS[u.id.toLowerCase()]}</div>
              </div>
            </button>)}
        </div>

        {R_UNITS[showUnit] && <div style={{paddingLeft: '1rem', flex: 'auto', width: '70%', position: 'relative'}}>
            <CardImg src={'units/' + showUnit + '.png'} style={{width: 'auto', float: 'left'}}/>
            <div style={{padding: '1rem', position: 'absolute', right: '1rem', textAlign: 'end'}}>
            {R_UNITS[showUnit].racial && <h5>{t('races.' + rid + '.' + R_UNITS[showUnit].id + '.label')}</h5>}
            {!R_UNITS[showUnit].racial && R_UNITS[showUnit].description && <h5>{t('cards.techno.' + R_UNITS[showUnit].id + '.description')}</h5>}
            
            {R_UNITS[showUnit].sustain && <h6>♦ {t('board.sustain_damage')}</h6>}
            {R_UNITS[showUnit].bombardment && <h6>♦ {t('board.bombardment')} {R_UNITS[showUnit].bombardment.value + ' x ' + R_UNITS[showUnit].bombardment.count}</h6>}
            {R_UNITS[showUnit].barrage && <h6>♦ {t('board.barrage')} {R_UNITS[showUnit].barrage.value + ' x ' + R_UNITS[showUnit].barrage.count}</h6>}
            {R_UNITS[showUnit].planetaryShield && <h6>♦ {t('board.planetary_shield')}</h6>}
            {R_UNITS[showUnit].spaceCannon && <h6>♦ {t('board.space_cannon')} {R_UNITS[showUnit].spaceCannon.value + ' x ' + R_UNITS[showUnit].spaceCannon.count + ' ' + t('board.range') + ' ' + R_UNITS[showUnit].spaceCannon.range}</h6>}
            {R_UNITS[showUnit].production && <h6>♦ {t('board.production')} {R_UNITS[showUnit].production}</h6>}
            {!R_UNITS[showUnit].alreadyUpgraded && R_UPGRADES[showUnit+'2'] && <>
                <h6 style={{marginTop: '2rem'}}>{t('board.upgradable') + ' '}
                {Object.keys(R_UPGRADES[showUnit+'2'].prereq).map((p, j) => {
                let result = [];
                for(var i=1; i<=R_UPGRADES[showUnit+'2'].prereq[p]; i++){
                    result.push(<img key={j+' '+i} alt='requirement' style={{width: '1.25rem'}} src={'icons/'+p+'.png'}/>);
                }
                return result;
                })}</h6>
                <ul style={{fontSize: '.8rem', marginTop: '-.5rem', opacity: '.8', listStyle: 'none'}}>
                    {Object.keys(R_UPGRADES[showUnit+'2']).map((k, i) => {
                    const L1 = R_UNITS[showUnit][k];
                    const L2 = R_UPGRADES[showUnit+'2'][k];
                    if(['cost', 'combat', 'move', 'capacity', 'shot', 'production'].indexOf(k) > -1){
                        if(L2 !== L1){
                        return <li key={i}>{t('board.' + k) + ' ' + L2}</li>
                        }
                    }
                    else if(['bombardment', 'barrage'].indexOf(k) > -1 && L2){
                        if(!L1 || L2.value !== L1.value || L2.count !== L1.count){
                        return <li key={i}>{t('board.' + k) + ' ' + R_UPGRADES[showUnit+'2'][k].value + ' x ' + L2.count}</li>
                        }
                    }
                    else if(k === 'spaceCannon' && L2){
                        if(!L1 || L2.value !== L1.value || L2.count !== L1.count || L2.range !== L1.range){
                        return <li key={i}>{t('board.space_cannon') + ' ' + L2.value + ' x ' + L2.count + ' ' + t('board.range') + ' ' + L2.range}</li>
                        }
                    }
                    else if( k === 'sustain' && L2){
                        return <li key={i}>{t('board.sustain_damage')}</li>
                    }
                    return null
                    })}
                </ul>
                </>
            }
            </div>
          
            <div style={{clear: 'both'}}/>
                                
            <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center', marginBottom: '.5rem'}}>
            {R_UNITS[showUnit].cost && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{fontSize: 30}}>{R_UNITS[showUnit].cost}</h6><b style={B_STYLE}>{t('board.cost')}</b></ListGroupItem>}
            {R_UNITS[showUnit].combat && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}>
                <h6 style={{fontSize: 30}}>{R_UNITS[showUnit].combat}{R_UNITS[showUnit].shot && R_UNITS[showUnit].shot > 1 && 
                <i style={{position: 'absolute', fontSize: '1.25rem', top: '0.5rem', right: 0, transform: 'rotate(90deg)'}}>{'♦'.repeat(R_UNITS[showUnit].shot)}</i>}
                </h6><b style={B_STYLE}>{t('board.combat')}</b></ListGroupItem>}
            {R_UNITS[showUnit].move && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{fontSize: 30}}>{R_UNITS[showUnit].move}</h6><b style={B_STYLE}>{t('board.move')}</b></ListGroupItem>}
            {R_UNITS[showUnit].capacity && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{fontSize: 30}}>{R_UNITS[showUnit].capacity}</h6><b style={B_STYLE}>{t('board.capacity')}</b></ListGroupItem>}
            </ListGroup>
            {R_UNITS[showUnit].racial && <>
                {R_UNITS[showUnit].effect && <CardText style={{fontSize: '0.7rem'}}>{t('races.' + rid + '.' + R_UNITS[showUnit].id + '.effect')}</CardText>}
                {R_UNITS[showUnit].deploy && <CardText style={{fontSize: '0.7rem'}}>{t('races.' + rid + '.' + R_UNITS[showUnit].id + '.deploy')}</CardText>}
                {R_UNITS[showUnit].action && <CardText style={{fontSize: '0.7rem'}}>{t('races.' + rid + '.' + R_UNITS[showUnit].id + '.action')}</CardText>}
            </>}
            {!R_UNITS[showUnit].racial && <>
                {R_UNITS[showUnit].effect && <CardText style={{fontSize: '0.7rem'}}>{t('cards.techno.' + R_UNITS[showUnit].id + '.effect')}</CardText>}
                {R_UNITS[showUnit].deploy && <CardText style={{fontSize: '0.7rem'}}>{t('cards.techno.' + R_UNITS[showUnit].id + '.deploy')}</CardText>}
                {R_UNITS[showUnit].action && <CardText style={{fontSize: '0.7rem'}}>{t('cards.techno.' + R_UNITS[showUnit].id + '.action')}</CardText>}
            </>}
        </div>}
      </div>

}

export const ObjectivesList = ({playerID, onSelect, selected, mustSecObj, maxHeight}) => {
    const { G } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    /*const mustSecObj = useMemo(() => {
        if(G.races[playerID] && G.races[playerID].secretObjectives) return G.races[playerID].mustDropSecObj || G.races[playerID].secretObjectives.length > 3
      }, [G.races, playerID]);*/

    if(!onSelect) onSelect = ()=>{}

    return <ListGroup style={{maxHeight: maxHeight ? maxHeight:'30rem', overflowY: 'auto', border: 'none', width: '100%', paddingRight: '1rem'}}>
      {G.pubObjectives && G.pubObjectives.length > 0 &&
        G.races[playerID].secretObjectives.concat(G.pubObjectives).map((o, i) => {
          const completed = o.players && o.players.length > 0 && o.players.indexOf(playerID) > -1;
          return <ListGroupItem className='hoverable'
                    style={{cursor: completed ? 'default':'pointer', 
                      background: completed ? 'green': (selected === o.id ? 'rgba(255,193,7,.75)':'none'), 
                      color: completed || selected === o.id ? 'black':'white', border: 'solid 1px transparent' }} 
                      key={i} onClick={() => {
                        if(!completed) onSelect(o.id)
                        }}>
                    <CardImg style={{display: 'inline-block', width: '2rem', margin: '0 1rem .5rem 0', opacity: checkObjective(G, playerID, o.id) ? '1': '.5'}} 
                        src={o.vp === 2 ? 'icons/public_2.png': o.vp === 1 ? 'icons/public_1.png':'icons/secret_regular.png'} />
                    <b>{t("cards.objectives." + o.id + ".label")}</b>
                    <span style={{float: 'right'}}>
                        {o.players && o.players.length > 0 && 
                        o.players.map((p, pi) => <CardImg key={pi} src={'race/icons/' + G.races[p].rid + '.png'} 
                        style={{display: 'inline-block', width: '1rem', marginRight: '.5rem'}}/>)}
                    </span>
                    <p style={{fontSize: '0.8rem'}}>{t("cards.objectives." + o.id + ".title")}</p>
                    {mustSecObj && !o.vp && (!o.players || !o.players.length) &&
                            <b style={{backgroundColor: 'red', color: 'white', padding: '.25rem', right: '0', top: '0', position: 'absolute'}}>{t('board.drop')}</b>}
                  </ListGroupItem>})
        }
    </ListGroup>
}

const PaymentCard = (args) => {

    const { t } = useContext(LocalizationContext);
    const [payment, setPayment] = useState({ influence: { planets: [], tg: 0 }, resources: { planets: [], tg: 0 }, 
        tg: 0, token: { s:0, t:0 }, fragment: {h:0, i:0, c:0, u:0} });
    const [paid, setPaid] = useState({}); //exhausted
    const tg = useMemo(() => args.race.tg - payment.influence.tg - payment.resources.tg - payment.tg, [payment, args]);
    const tokens = useMemo(()=> ({ t: args.race.tokens.t - payment.token.t, s: args.race.tokens.s - payment.token.s}), [payment, args]);
    const fragments = useMemo(() => ({h: args.race.fragments.h - payment.fragment.h, i: args.race.fragments.i - payment.fragment.i,
        c: args.race.fragments.c - payment.fragment.c, u: args.race.fragments.u - payment.fragment.u}), [payment, args]);

    const payPlanet = useCallback((e, planet, type) => {
        e.preventDefault();
        e.stopPropagation();

        if(paid[planet.name] === undefined){
            setPayment(produce(payment, draft => {
                draft[type].planets.push(planet);
            }));

            setPaid(produce(paid, draft => {
                draft[planet.name] = type;
            }));
        }
    }, [paid, payment]);

    const cancelPlanet = useCallback((pname) => {
        if(paid[pname] !== undefined){
            setPayment(produce(payment, draft => {
                draft[paid[pname]].planets = draft[paid[pname]].planets.filter(p => p.name !== pname);
            }));

            setPaid(produce(paid, draft => {
                delete draft[pname];
            }));
        }
    }, [paid, payment]);

    const payTg = useCallback((type, inc) => {
        setPayment(produce(payment, draft => {
            draft[type].tg += inc;
        }));
    }, [payment]);

    const redistCt = useCallback((tag, inc) => {
        setPayment(produce(payment, draft => {
            if(inc > 0 && tokens[tag] > 0){
                draft.token[tag]++;
            }
            else if(inc < 0 && payment.token[tag]>0){
                draft.token[tag]--;
            }
        }));
    }, [payment, tokens]);

    const redistFrag = useCallback((tag, inc) => {
        setPayment(produce(payment, draft => {
            if(inc > 0 && fragments[tag] > 0){
                draft.fragment[tag]++;
            }
            else /*if(inc < 0 && payment.fragment[tag]>0)*/{
                draft.fragment[tag]=0;
            }
        }));
    }, [payment, fragments])
    
    useEffect(()=>{
        if(args.onPayment){
            args.onPayment(payment);
        }
    },[payment, args]);

    const objKeys = Object.keys(args.objective.req);
    const TOKENS_STYLE = { cursor:'pointer', display: 'flex', textAlign: 'center', padding: 0, flexFlow: 'column', background: 'none', color: 'white', border: 'solid 1px transparent'}

    return <>
        {objKeys.indexOf('influence') + objKeys.indexOf('resources') > -2 && <div style={{overflowY: 'auto', maxHeight: '30rem', margin: '1rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
            <PlanetsRows PLANETS={args.planets} exhausted={paid} onClick={(p)=>cancelPlanet(p)}
            resClick={objKeys.indexOf('resources') > -1 ? (e, p)=>payPlanet(e, p, 'resources'):undefined} infClick={objKeys.indexOf('influence') >-1? (e, p)=>payPlanet(e, p, 'influence'):undefined}/>
        </div>}
        {objKeys.indexOf('token') > -1 && <div style={{width: '20rem', margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
            <Row>
                <Col xs='6' style={TOKENS_STYLE}><b>{t('board.tactic')}</b></Col>
                <Col xs='6' style={TOKENS_STYLE}><b>{t('board.strategic')}</b></Col>
            </Row>
            <Row>
                <Col xs='6' className='hoverable' style={TOKENS_STYLE}><h6 style={{fontSize: '50px'}}>{tokens.t}</h6></Col>
                <Col xs='6' className='hoverable' style={TOKENS_STYLE}><h6 style={{fontSize: '50px'}}>{tokens.s}</h6></Col>
            </Row>
            <Row>
                <Col xs='3' style={{...TOKENS_STYLE, alignItems: 'flex-end'}}><Button onClick={()=>redistCt('t', -1)} color='dark' size='sm' style={{ opacity: '.5', width:'3rem', padding: 0,fontSize: '30px'}}>+</Button></Col>
                <Col xs='3' style={{...TOKENS_STYLE}}><Button onClick={()=>redistCt('t', +1)} color='dark' style={{ opacity: '.5', width:'3rem', padding: 0,fontSize: '30px'}}>-</Button></Col>
                <Col xs='3' style={{...TOKENS_STYLE, alignItems: 'flex-end'}}><Button onClick={()=>redistCt('s', -1)} color='dark' style={{ opacity: '.5', width:'3rem', padding: 0,fontSize: '30px'}}>+</Button></Col>
                <Col xs='3' style={{...TOKENS_STYLE}}><Button onClick={()=>redistCt('s', +1)} color='dark' style={{ opacity: '.5', width:'3rem', padding: 0,fontSize: '30px'}}>-</Button></Col>
            </Row>
        </div>}
        {objKeys.includes('fragment') && <div style={{margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
            <ListGroup horizontal style={{border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <ListGroupItem tag='button' className='hoverable' onClick={()=>redistFrag('c', 1)} style={{...TOKENS_STYLE, width: '22%'}}>
                    <img alt='fragment' src='icons/cultural_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                    <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{fragments.c}</h6>
                    <b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%', fontSize: '.9rem'}}>{t('board.cultural')}</b>
                </ListGroupItem>
                <ListGroupItem tag='button' className='hoverable' onClick={()=>redistFrag('h', 1)} style={{...TOKENS_STYLE, width: '22%'}}>
                    <img alt='fragment' src='icons/hazardous_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                    <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{fragments.h}</h6>
                    <b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%', fontSize: '.9rem'}}>{t('board.hazardous')}</b>
                </ListGroupItem>
                <ListGroupItem tag='button' className='hoverable' onClick={()=>redistFrag('i', 1)} style={{...TOKENS_STYLE, width: '22%'}}>
                    <img alt='fragment' src='icons/industrial_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                    <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{fragments.i}</h6>
                    <b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%', fontSize: '.9rem'}}>{t('board.industrial')}</b>
                </ListGroupItem>
                <ListGroupItem tag='button' className='hoverable' onClick={()=>redistFrag('u', 1)} style={{...TOKENS_STYLE, width: '22%'}}>
                    <img alt='fragment' src='icons/unknown_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                    <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{fragments.u}</h6>
                    <b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%', fontSize: '.9rem'}}>{t('board.unknown')}</b>
                </ListGroupItem>
            </ListGroup>
        </div>}
        <div style={{margin: '1rem', display: 'flex', flexDirection: 'column'}}>
            {objKeys.map((k, i) =>{
                
                return <div key={i} style={{display: 'flex', justifyContent: 'space-between'}}> 
                            <div style={{display: 'flex', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap'}}>
                                <h6 style={{textAlign: 'end'}}>{t('board.total') + ' ' + t('board.' + k) + ': '}
                                    {payment[k].planets && payment[k].planets.reduce((a,b) => b[k] + a, 0)}
                                    {!payment[k].planets && k!=='token' && k!=='fragment' && tg}
                                    {k!=='token' && k!=='fragment' && payment[k].tg > 0 && '+' + payment[k].tg + ' ' + t('board.tg')}
                                    {k==='token' && payment[k].t + payment[k].s}
                                    {k==='fragment' && payment[k].h + payment[k].i + payment[k].u + payment[k].c}
                                    {' / '}{args.objective.req[k]}
                                </h6>
                            </div>
                            {(k === 'influence' || k === 'resources') && <h5 style={{width: '4rem', display: 'flex', justifyContent: 'flex-start'}}>
                                <Button disabled={args.objective.req['tg'] ? (tg <= args.objective.req['tg']) : (tg < 1)} tag='img' onClick={()=>payTg(k, 1)} src='/icons/trade_good_1.png' color='warning' 
                                    style={{width: '2rem', padding: '.5rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}/>
                                
                                <Button disabled={payment[k].tg === 0} color='warning' 
                                    style={{width: '1.5rem', borderLeft: 'none', color:'orange', backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: 0}} 
                                    onClick={()=>payTg(k, -1)}>▼
                                </Button>
                            </h5>}
                    </div>
            })}
        </div>
    </>
}

export const PlanetsRows = ({PLANETS, onClick, exhausted, variant, resClick, infClick, specClick, emptyListMsg}) => {

    if(!onClick) onClick = ()=>{};
    if(!resClick) resClick = ()=>{};
    if(!infClick) infClick = ()=>{};
    if(!specClick) specClick = ()=>{};
    if(!exhausted) exhausted = {};

    const { t } = useContext(LocalizationContext);
    const { G, playerID, moves } = useContext(StateContext);
    const psArch = haveTechnology(G.races[playerID], 'PSYCHOARCHAEOLOGY');

    if(PLANETS && PLANETS.length){
        return PLANETS.map((p,i) => {
            let trait;
            if(p.trait) trait = <img alt='trait' style={{width: '1.5rem'}} src={'icons/' + p.trait + '.png'}/>;
            let specialty;
            if(p.specialty) specialty = <img alt='specialty' style={{width: '1.5rem'}} src={'icons/' + p.specialty + '.png'}/>;

            let opac = '1';
            if(exhausted[p.name] === 'pds' || exhausted[p.name] === 'spacedock'){
                opac = p.exhausted ? '.25':'1';
            }
            else{
                opac = p.exhausted || exhausted[p.name] ? (exhausted[p.name] === 'ready'  ? '1': '.25'):'1';
            }
            
            return (<Row className='hoverable' onClick={()=>onClick(p.name)} key={i} 
                            style={{cursor: 'default', paddingRight: '1rem', fontSize: '1.25rem', marginTop: '.25rem', lineHeight: '2.2rem', height: '2.75rem', background: exhausted[p.name] ? 'green':'',
                            opacity: opac, color: 'white'}}>
                        <Col xs='7'>{p.legendary ? <img alt='legendary' style={{width: '1.5rem', margin: '0 0.1rem'}} src={'icons/legendary_complete.png'}/>:'' } 
                                    {p.attach && p.attach.length && p.attach.indexOf('Demilitarized Zone') > -1 ? 
                                        <img alt='dmz' style={{width: '1.5rem', margin: '0 0.1rem'}} src={'icons/dmz.png'}/>:'' } 
                                    {t('planets.' + p.name)}
                                    {p.attach && p.attach.length && <><Badge style={{margin: '0 .2rem', padding: '.3rem .5rem'}} color='success' pill id={p.name.replaceAll(' ', '_') + '_attach_badge'}>+</Badge>
                                    <UncontrolledTooltip target={'#' + p.name.replaceAll(' ', '_') + '_attach_badge'}>{p.attach.join(',')}</UncontrolledTooltip></>}
                        </Col>
                        <Col xs='1' onClick={(e)=>{if(specialty) specClick(e, p)}} style={{cursor: 'pointer', padding: 0}}>{specialty}</Col>
                        <Col xs='1' style={{padding: 0}}>{trait}</Col>
                        {variant !== 'small' && <>
                        <Col xs='1' onClick={(e)=>resClick(e, p)} style={{cursor: 'pointer', background: 'url(icons/resources_bg.png)', backgroundRepeat: 'no-repeat', backgroundSize: 'contain', display: 'flex', alignItems: 'center'}}><b style={{paddingLeft: '0.1rem'}}>{p.resources}</b></Col>
                        <Col xs='1' onClick={(e)=>infClick(e, p)} style={{cursor: 'pointer', background: 'url(icons/influence_bg.png)', backgroundRepeat: 'no-repeat', backgroundSize: 'contain', display: 'flex', alignItems: 'center'}}><b>{p.influence}</b></Col>
                        
                        {(!psArch || p.exhausted) && <Col />}
                        {psArch && !p.exhausted && <Col style={{padding: 0, cursor: 'pointer', position: 'relative'}}>
                            <button className='styledButton green' style={{width: '3rem', padding: 0, position: 'absolute', left: '.5rem', boxShadow: '-2px 0px 10px gold'}} onClick={(e)=>{e.stopPropagation(); moves.exhaustForTg(p.name)}}>
                                <img style={{width: '1.5rem'}} src='icons/trade_good_1.png' alt='tg'/> 
                            </button>
                        </Col>}
                        </>}
                    </Row>)
        })
    }
    else {
        return <div style={{color: 'white', marginTop: '1rem'}}>{emptyListMsg}</div>;
    }
  }

export const GetTechType = (typ, race, tooltipMode, onSelect, selected) => {

    const { t: translate } = useContext(LocalizationContext);
    const TOKENS_STYLE = { display: 'flex', width: '30%', borderRadius: '5px', alignItems: 'center', textAlign: 'center', flexFlow: 'column', padding: '.15rem', background: 'none', margin: '.5rem', border: '1px solid rgba(74, 111, 144, 0.42)', color: 'white'}
    const B_STYLE = {backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}
    const techs = (typ === 'unit' ? race.technologies.filter(t => t.type === typ && t.upgrade):[...techData, ...race.technologies.map(r=>({...r, racial: true}))].filter(t => t.type === typ));
    const Wrapper = tooltipMode ? UncontrolledTooltip : UncontrolledCollapse;

    const ItemOnClick = (tech) => {
        if(onSelect){
            onSelect(tech);
        }
    }

    if(!selected) selected=[];

    return (<div style={{width: typ === 'unit' ? '23%':'19%', border: 'solid 1px rgba(255,255,255,.42)', alignSelf:'flex-start'}}>
      <img alt='tech type' style={{width: '1.5rem', position: 'absolute', marginTop: '.2rem', marginLeft: '.5rem'}} src={'icons/'+typ+'.png'}/>
      <h6 style={{backgroundColor: 'rgba(74, 111, 144, 0.42)', width: '100%', textAlign: 'center', padding: '.5rem'}}>
        {translate('board.' + (typ === 'unit' ? 'upgrades':typ)).toUpperCase()}
      </h6>
      
      <ListGroup>
        {techs.map((t, i) => {
            let color = 'dark';
            if(race.knownTechs.indexOf(t.id) > -1) color = 'success';
            if(selected.indexOf(t.id) > -1) color = 'warning';
            
            return <ListGroupItem onClick={()=>ItemOnClick(t)} key={i} style={{opacity: race.exhaustedCards.indexOf(t.id)>-1 ? .35:1, background: 'none', padding: '.25rem', color: 'white', border: 'none', borderBottom: 'solid 1px rgba(255,255,255,.15)'}} >
                <Button size='sm' color={color} id={t.id} style={{width: '100%', fontSize: '.7rem', textAlign: 'left'}}>
                {(t.racial ? translate('races.' + race.rid + '.' + t.id + '.label') : translate('cards.techno.' + t.id + '.label')).replaceAll('2', ' II')}
                {t.racial && <img alt='racial' style={{width: '1rem', position: 'absolute', marginLeft: '.5rem'}} src={'race/icons/'+ race.rid +'.png'}/>}
                {t.type === 'unit' && t.prereq && Object.keys(t.prereq).length > 0 && <div style={{textAlign: 'right', position: 'absolute', right: '.5rem', top: '.5rem'}}>
                    {Object.keys(t.prereq).map((p, j) =>{
                    let result = [];
                    for(var i=1; i<=t.prereq[p]; i++){
                        result.push(<img key={j+''+i} alt='requirement' style={{width: '1rem'}} src={'icons/'+p+'.png'}/>);
                    }
                    return result;
                    })}
                    </div>
                }
                </Button>
                <Wrapper placement='right' toggler={'#'+t.id} target={'#'+t.id} style={{textAlign: 'left', minWidth: tooltipMode ? '14rem':'', width:'100%', fontSize: '.7rem', padding: tooltipMode ? '.5rem':'.2rem'}}>
                {t.type !== 'unit' && t.prereq && Object.keys(t.prereq).length > 0 && <div style={{textAlign: 'right'}}>
                    <b>{translate('board.require')}: </b>
                    {Object.keys(t.prereq).map((p, j) =>{
                    let result = [];
                    for(var i=1; i<=t.prereq[p]; i++){
                        result.push(<img key={j+''+i} alt='requirement' style={{width: '1rem'}} src={'icons/'+p+'.png'}/>);
                    }
                    return result;
                    })}
                </div>}
                {t.type !== 'unit' && (t.racial ? translate('races.' + race.rid + '.' + t.id + '.description') : translate('cards.techno.' + t.id + '.description'))}
                
                {t.type === 'unit' && <div style={{fontSize: tooltipMode ? '.9rem':'.7rem', width: '100%'}}>
                    <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center', marginBottom: '.5rem'}}>
                        {t.cost && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{margin: 0}}>{t.cost}</h6><b style={{...B_STYLE, fontSize: '.5rem'}}>{translate('board.cost')}</b></ListGroupItem>}
                        {t.combat && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}>
                        <h6 style={{margin: 0}}>{t.combat}{t.shot && t.shot > 1 && 
                            <i style={{position: 'absolute', fontSize: 10, top: '0.5rem', right: 0, transform: 'rotate(90deg)'}}>{'♦'.repeat(t.shot)}</i>}
                        </h6><b style={{...B_STYLE, fontSize: '.5rem'}}>{translate('board.combat')}</b></ListGroupItem>}
                        {t.move && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{margin: 0}}>{t.move}</h6><b style={{...B_STYLE, fontSize: '.5rem'}}>{translate('board.move')}</b></ListGroupItem>}
                        {t.capacity && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{margin: 0}}>{t.capacity}</h6><b style={{...B_STYLE, fontSize: '.5rem'}}>{translate('board.capacity')}</b></ListGroupItem>}
                    </ListGroup>
                    {t.sustain && <p style={{margin: 0}}>♦ {translate('board.sustain_damage')}</p>}
                    {t.bombardment && <p style={{margin: 0}}>♦ {translate('board.bombardment')} {t.bombardment.value + ' x ' + t.bombardment.count}</p>}
                    {t.barrage && <p style={{margin: 0}}>♦ {translate('board.barrage')} {t.barrage.value + ' x ' + t.barrage.count} </p>}
                    {t.planetaryShield && <p style={{margin: 0}}>♦ {translate('board.planetary_shield')} </p>}
                    {t.spaceCannon && <p style={{margin: 0}}>♦ {translate('board.space_cannon')} {t.spaceCannon.value + ' x ' + t.spaceCannon.count + ' range ' + t.spaceCannon.range}</p>}
                    {t.production && <p style={{margin: 0}}>♦ {translate('board.production')} {t.production}</p>}
                    {t.racial && <>
                        {t.effect && <CardText style={{paddingTop: '.5rem'}}>{translate('races.' + race.rid + '.' + t.id + '.effect')}</CardText>}
                        {t.deploy && <CardText style={{paddingTop: '.5rem'}}>{translate('races.' + race.rid + '.' + t.id + '.deploy')}</CardText>}
                        {t.action && <CardText style={{paddingTop: '.5rem'}}>{translate('races.' + race.rid + '.' + t.id + '.action')}</CardText>}
                    </>}
                    {!t.racial && t.effect && <CardText style={{paddingTop: '.5rem'}}>{translate('cards.techno.' + t.id + '.effect')}</CardText>}
                </div>
                }
                </Wrapper>
            </ListGroupItem>}
          )}
      </ListGroup>
    </div>
  )};
//{race.knownTechs.indexOf(t.id) > -1 && t.action === true && race.exhaustedCards.indexOf(t.id) === -1 && <Button size='sm' color='warning' onClick={()=>onAction(t.id)}>Action</Button>}
const RaceList = ({races, selected, speaker, onClick}) => {
    const { t } = useContext(LocalizationContext);
    if(!onClick) onClick = ()=>{};

    return races.map((r,i) => {
        return (<Row className='hoverable' onClick={()=>onClick(r.rid)} key={i}
                    style={{cursor: 'default', fontSize: '1.25rem', lineHeight: '2.2rem', height: '2.5rem', marginTop: '.25rem',
                    background: selected === r.rid || (Array.isArray(selected) && selected.indexOf(r.rid) > -1) ? 'green':'', color: 'white'}}>
                    <Col xs='1'></Col>
                    <Col xs='2'><img alt='race icon' style={{width: '1.5rem'}} src={'race/icons/'+r.rid+'.png'}/></Col>
                    <Col xs='9'>{t('races.' + r.rid + '.name')}{speaker === r.rid && <>{' (' + t('board.speaker') + ')'}</>}</Col>
                </Row>)
    });
  }

export const TradePanel = ({ onTrade }) => {

    const { G, playerID } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const races =  useMemo(() => G.races.filter(r => r.rid !== G.races[playerID].rid), [G.races, playerID]);
    const [srid, setSrid] = useState(races[0].rid);
    const [tradeItem, setTradeItem] = useState(undefined);
    const tradeClick = useCallback(()=>{
        const item = tradeItem;
        onTrade({tradeItem: item, rid: srid});
        if(tradeItem && (tradeItem.startsWith('relic') || tradeItem.startsWith('promissory') || tradeItem.startsWith('action'))){
            setTradeItem(undefined);
        }
    }, [onTrade, srid, tradeItem]);

    return <>
            <CardTitle>
            <ButtonGroup>
                {races.map((r, i) => <button onClick={()=>setSrid(r.rid)} className={'styledButton ' + (r.rid === srid ? 'white':'black')} 
                    style={{padding: '.5rem', width: '4rem'}} 
                    key={i}><img alt={r.rid} style={{height: '1.5rem'}} src={'/race/icons/' + r.rid + '.png'}/></button>)}
            </ButtonGroup>
            </CardTitle>

            <RacePanel rid={G.races[playerID].rid} onSelect={setTradeItem}/>
            {races.length > 0 && <>
                <Row style={{marginBottom: '2rem '}}>
                    <Col style={{textAlign: 'right', alignSelf: 'center'}}>
                        {tradeItem && <b>{tradeItem === 'commodity' ? ('1 ' + t('board.commodity')) : tradeItem === 'tg' ? ('1 ' + t('board.trade_good')) : 
                        tradeItem === 'fragment.c' ? ('1 ' + t('board.cultural') + t('board.fragment')) :
                        tradeItem === 'fragment.h' ? ('1 ' + t('board.hazardous') + t('board.fragment')) :
                        tradeItem === 'fragment.i' ? ('1 ' + t('board.industrial') + t('board.fragment')) :
                        tradeItem === 'fragment.u' ? ('1 ' + t('board.unknown') + t('board.fragment')) :
                        tradeItem.indexOf('relic') === 0 ? t('cards.relics.' + tradeItem.substr(tradeItem.indexOf('.') + 1) + '.label'):
                        tradeItem.indexOf('action') === 0 ? t('cards.actions.' + tradeItem.substr(tradeItem.indexOf('.') + 1) + '.label'):
                        tradeItem.indexOf('promissory') === 0 ? t('cards.promissory.' + tradeItem.substr(tradeItem.indexOf('.') + 1) + '.label'):
                        tradeItem.substr(tradeItem.indexOf('.') + 1) }</b>}
                    </Col>
                    <Col xs={4} style={{textAlign: 'right', padding: 0}}>
                        <button onClick={()=>tradeClick()} className='bi-arrow-down-circle styledButton green' disabled={!tradeItem} style={{fontSize: '1rem'}}>
                            {' ' + t('board.send')}
                        </button>
                    </Col>
                </Row>
            <RacePanel rid={srid} />
            </>}
        </>
}

const RacePanel = ({rid, onSelect}) => {
    const { G, playerID } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const [buttonSwitch, setButtonSwitch] = useState('promissory');
    const r = G.races.find(f => f.rid === rid);
    if(!onSelect) onSelect=()=>{}

    return (
    <Row style={{margin: 0}}>
        <Col xs={3} style={{padding: 0}}>
            <CardImg src={'race/'+rid+'.png'} />
        </Col>
        <Col xs={9} style={{}}>
            <Row style={{fontFamily: 'Handel Gothic', textAlign: 'center'}}>
                <Col xs={2}><Button onClick={()=>onSelect('commodity')} tag='img' outline color='dark' src='icons/commodity_1.png' style={{padding: 0, height: '2rem'}}/></Col>
                <Col xs={2}><Button onClick={()=>onSelect('tg')} tag='img' outline color='dark' src='icons/trade_good_1.png' style={{padding: 0, height: '2rem'}}/></Col>
                <Col xs={2}><Button onClick={()=>onSelect('fragment.c')} tag='img' outline color='dark' src='icons/cultural_fragment.png' style={{padding: 0, height: '2rem'}}/></Col>
                <Col xs={2}><Button onClick={()=>onSelect('fragment.h')} tag='img' outline color='dark' src='icons/hazardous_fragment.png' style={{padding: 0, height: '2rem'}}/></Col>
                <Col xs={2}><Button onClick={()=>onSelect('fragment.i')} tag='img' outline color='dark' src='icons/industrial_fragment.png' style={{padding: 0, height: '2rem'}}/></Col>
                <Col xs={2}><Button onClick={()=>onSelect('fragment.u')} tag='img' outline color='dark' src='icons/unknown_fragment.png' style={{padding: 0, height: '2rem'}}/></Col>
            </Row>
            <Row style={{fontFamily: 'Handel Gothic', textAlign: 'center', marginBottom: '1rem'}}>
                <Col xs={2}>{(r.commodity || 0) + '/' + r.commCap}</Col>
                <Col xs={2}>{(r.tg || 0)}</Col>
                <Col xs={2}>{(r.fragments.c || 0)}</Col>
                <Col xs={2}>{(r.fragments.h || 0)}</Col>
                <Col xs={2}>{(r.fragments.i || 0)}</Col>
                <Col xs={2}>{(r.fragments.u || 0)}</Col>
            </Row>
            <Row>
                <Col xs={2}><Button onClick={()=>setButtonSwitch('promissory')} size='sm' color='dark' tag='img' src='icons/promissory_white.png' 
                    style={{width: '2.5rem', height: '2rem', paddingTop: '.4rem', paddingBottom: '.4rem'}}/></Col>
                <Col xs={2} style={{paddingLeft: '.5rem'}}><Button onClick={()=>setButtonSwitch('relics')} size='sm' color='dark' tag='img' src='icons/relic_white.png' 
                    style={{height: '2rem'}}/></Col>
                {rid === G.races[playerID].rid && <Col xs={2} style={{paddingLeft: 0}}><Button onClick={()=>setButtonSwitch('actions')} size='sm' color='dark' tag='img' src='icons/action_card_white.png' 
                    style={{height: '2rem'}}/></Col>}
            </Row>
            {buttonSwitch === 'relics' && <Row>
                <Col>{r.relics.map((k, i) => <span key={i}>
                    <Badge onClick={()=>onSelect('relic.'+k.id)} color='dark' id={k.id.replaceAll(' ', '_')+'_trade'} className='hoverable' style={{fontSize: '.6rem'}}>{k.id.replaceAll('_', ' ')}</Badge>
                    <UncontrolledTooltip target={'#'+k.id.replaceAll(' ', '_')+'_trade'}>{k.effect}</UncontrolledTooltip>
                    </span>)}
                </Col>
            </Row>}
            {buttonSwitch === 'promissory' && <Row>
                <Col>{r.promissory.filter(p => !p.sold).map((k,i) => <span key={i}>
                    <Badge onClick={()=>onSelect('promissory.'+k.id)} color='dark' id={k.id+'_trade_'+k.color} className='hoverable' style={{fontSize: '.6rem'}}>{t('cards.promissory.' + k.id + '.label')}</Badge>
                    <UncontrolledTooltip target={'#'+k.id+'_trade_'+k.color}>{t('cards.promissory.' + k.id + '.effect').replaceAll('[color of card]', t('board.colors.' + k.color))}</UncontrolledTooltip>
                    </span>)}
                </Col>
            </Row>}
            {buttonSwitch === 'actions' && <Row>
                <Col>{r.actionCards.map((k, i) => <span key={i}>
                    <Badge onClick={()=>onSelect('action.'+k.id)} color='dark' id={k.id.replaceAll(' ', '_')+'_trade'} className='hoverable' style={{fontSize: '.6rem'}}>{t('cards.actions.' + k.id + '.label')}</Badge>
                    <UncontrolledTooltip target={'#'+k.id.replaceAll(' ', '_')+'_trade'}>{t('cards.actions.' + k.id + '.description')}</UncontrolledTooltip>
                    </span>)}
                </Col>
            </Row>}
        </Col>
    </Row>)
}

export const ProducingPanel = (args) => {

    const { pname, onCancel, R_UNITS, R_UPGRADES } = args;
    const { G, playerID, moves, exhaustedCards, exhaustTechCard, PLANETS, UNITS } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const [currentUnit, setCurrentUnit] = useState('FLAGSHIP');
    const [ex2, setEx2] = useState({});
    const [tg, setTg] = useState(0);
    const [result, setResult] = useState(0);
    const [deploy, setDeploy] = useState({});

    const planetRowClick = useCallback((planetName) => {
        if(!PLANETS.find(p => p.name === planetName).exhausted){
            setEx2(produce(ex2, draft => {
                if(draft[planetName]){
                    delete draft[planetName];
                }
                else{
                    draft[planetName] = true;
                }
            }));
        }
    }, [ex2, PLANETS]);

    const deployPrice = useMemo(() => {

        let sum = 0;
        const keys = Object.keys(deploy);
        if(keys.length){
            keys.forEach(k =>{
                sum += deploy[k] * R_UNITS[k].cost;
            });
        }

        if(exhaustedCards.indexOf('AI_DEVELOPMENT_ALGORITHM')>-1){
            const upgrades = G.races[playerID].technologies.filter(t => t.alreadyUpgraded === true);

            if(upgrades && upgrades.length){
                sum -= upgrades.length;
            }
        }

        if(exhaustedCards.indexOf('War Machine')>-1){
            sum -= 1;
        }

        if(haveTechnology(G.races[playerID], 'SARWEEN_TOOLS')){
            sum -= 1;
        }

        return sum;

    }, [deploy, R_UNITS, exhaustedCards, G.races, playerID]);

    const deployUnit = (inc, uname) => {
        const du = () => {
            setDeploy(produce(deploy, draft => {
                if(inc > 0){
                    if(!deploy[currentUnit]) draft[currentUnit] = 0;
                    draft[currentUnit]++;
                }
                else{
                    draft[uname]--;
                    if(draft[uname] === 0) delete draft[uname];
                }
            }));
        }

        if(maxDeployUnits > 0){
            let unitsCount = 0;
            const keys = Object.keys(deploy);
            keys.forEach(k => unitsCount += deploy[k]);
            if(unitsCount < maxDeployUnits || inc < 0){
                du();
            }
        }
        else if(maxDeployUnits < 0){ //by summary cost
            if(R_UNITS[uname || currentUnit].cost * inc + deployPrice <= Math.abs(maxDeployUnits)){
                du();
            }
        }
    }

    const freelancers = useMemo(() => {
        const planet = PLANETS.find(p => p.name === pname);
        
        if(planet){
            if(planet.exploration === 'Freelancers') return true;
        }
    }, [PLANETS, pname]);

    const maxDeployUnits = useMemo(() => {
        if(exhaustedCards.indexOf('SLING_RELAY')>-1){
            return 1;
        }
        const planet = PLANETS.find(p => p.name === pname);
        
        if(planet){
            if(freelancers) return 1;
            if(exhaustedCards.indexOf('INTEGRATED_ECONOMY')>-1){
                if(!planet.units || !planet.units['spacedock'] || !planet.units['spacedock'].length){
                    return -planet.resources;
                }
            }
            let sd = planet.units['spacedock'].length * R_UNITS['SPACEDOCK'].production;
            let max = planet.resources + sd;

            if(exhaustedCards.indexOf('War Machine')>-1){
                max += 4;
            }

            return max;
        }

        return 0;
    }, [PLANETS, R_UNITS, pname, freelancers, exhaustedCards]);

    const tgClick = useCallback(() => {
    
        const max = G.races[playerID].tg;
        if(tg < max){
            setTg(tg+1);
        }

    }, [tg, G.races, playerID]);

    const bannedUnits = useMemo(() => {
        const banned = ['PDS', 'SPACEDOCK'];
        if(exhaustedCards.indexOf('SLING_RELAY')>-1) banned.push('INFANTRY', 'MECH', 'FIGHTER')
        return banned;
    }, [exhaustedCards]);

    useEffect(()=>{
        let resources = 0;
        Object.keys(ex2).forEach(e =>{
            const planet = PLANETS.find(p => p.name === e)
            if(ex2[e]){
                if(freelancers){
                    resources += Math.max(planet.resources, planet.influence);
                }
                else{
                    resources += planet.resources;
                }
            }
        });
        setResult(resources + tg);
    },[ex2, PLANETS, tg, freelancers]);

    const onCancelClick = (finish) => {
        if(exhaustedCards.indexOf('SLING_RELAY')>-1){
            exhaustTechCard('SLING_RELAY');
            onCancel(finish === true);
        }
        else onCancel(finish === true);
    }

    const exceedLimit = useCallback((currentUnit) => {
        const unit = currentUnit.toLowerCase();
        const d = deploy[currentUnit] || 0;
        const u = UNITS[unit] || 0;
        
        return d + u >= UNITS_LIMIT[unit];
    }, [UNITS, deploy]);

    return <Card className='borderedPanel' style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: '1rem', position: 'absolute', bottom: '9rem', left: '5rem', width: '70rem'}}>
                <div style={{display: 'flex', flexDirection: 'row', flexWrap:'wrap', justifyContent:'space-between', width: '100%'}}>
                    <div style={{width:'30rem', overflowY: 'auto', height: '22rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                        <PlanetsRows PLANETS={PLANETS} onClick={planetRowClick} exhausted={ex2}/>
                    </div>
                    <div style={{width: '35rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)', color: 'white', padding: '0 1rem 0 0'}}>
                        <UnitsList UNITS={UNITS} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} rid={G.races[playerID].rid} onSelect={(u)=>setCurrentUnit(u)}/>
                        <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end'}}>
                        {maxDeployUnits >= 0 && <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{t('board.max_units_count') + ': ' + maxDeployUnits}</h6>}
                        {maxDeployUnits < 0 && <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{t('board.max_units_cost') + ': ' + (-maxDeployUnits)}</h6>}
                            <button style={{marginLeft: '1rem'}} onClick={()=>deployUnit(+1)} className='styledButton yellow' 
                                disabled={bannedUnits.indexOf(currentUnit) > -1 || exceedLimit(currentUnit)}>
                                <b>{t('board.deploy')}</b></button>
                        </div>
                    </div>
                    <div style={{width:'29rem'}}>
                        <h5 style={{fontSize: '50px', display: 'flex', justifyContent: 'flex-end'}}>{'+'}{tg}{' '}<Button tag='img' onClick={tgClick} src='/icons/trade_good_1.png' color='warning' 
                            style={{marginLeft: '1rem', width: '4rem', padding: '.5rem', borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} />
                            <Button disabled={tg < 1} color='warning' style={{width: '1.5rem', borderLeft: 'none', color:'orange', backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: 0}} onClick={()=>setTg(tg-1)}>▼</Button></h5>
                        <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{t('board.you_mean_spend') + ' ' + result + ' ' + t('board.resources')}</h6>
                        <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{deployPrice + ' ' + t('board.needed')}</h6>
                    </div>
                    <div style={{width: '33rem', marginTop: '1rem'}}>
                        {deploy && Object.keys(deploy).map((k, i) => {
                            return (<span style={{marginRight: '1rem'}} key={i}>
                            <Button size='sm' color='warning' style={{padding: '0 .25rem', fontSize: '.75rem'}} onClick={()=>deployUnit(-1, k)}>▼</Button>
                            <b>{' ' + t('cards.techno.' + k + '.label') + ' : ' + deploy[k]}</b></span>)
                        })}
                    </div>
                </div>
                <CardFooter style={{background: 'none', display: 'flex', justifyContent: 'space-between'}}>
                    <button className='styledButton red' onClick={onCancelClick}>{t('board.cancel')}</button>
                    <button className='styledButton green' disabled={deployPrice > result} 
                        onClick={() => {moves.producing(pname, deploy, Object.keys(ex2), tg, exhaustedCards); onCancelClick(true)}}>
                        {t('board.finish')}</button>
                </CardFooter>
            </Card>

}


export const UnmeetReqs = (args) => {

    const {separate, PLANETS, ex2, adjSpec, G, playerID} = args;
    const { t } = useContext(LocalizationContext);
    const keys = Object.keys(ex2);
    let result=[];

    const known = G.races[playerID].knownTechs.map(t => {
        let maped = G.races[playerID].technologies.find(r => r.id === t);
        if(!maped){
            maped = techData.find(d => d.id === t);
        }
        return maped;
    });

    const learning = {biotic: 0, warfare: 0, propulsion: 0, cybernetic: 0, unit: 0};

    adjSpec.forEach(pname => {
        const planet = PLANETS.find(p => p.name === pname);
        if(planet && planet.specialty) learning[planet.specialty]++;
    });

    let upgradesUnmeet = []; //if need separate info
    let techsUnmeet = [];

    keys.forEach((k, i)=>{
        const prekeys = Object.keys(ex2[k].prereq);
        if(prekeys && prekeys.length){
            let pre = [];

            prekeys.forEach((p, ii)=> {
                let learned = known.filter(t => t.type === p).length;
                learned += learning[p];
                
                if(learned < ex2[k].prereq[p]){
                    if(separate){
                        if(ex2[k].type === 'unit'){
                            for(var j=0; j<ex2[k].prereq[p] - learned; j++){
                                upgradesUnmeet.push(p)
                            }
                        }
                        else{
                            for(var h=0; h<ex2[k].prereq[p] - learned; h++){
                                techsUnmeet.push(p)
                            }
                        }
                    }
                    for(var n=0; n<ex2[k].prereq[p]; n++){
                        pre.push(<img alt={p} key={ii+' '+n} src={'icons/'+ p +'.png'} style={{width: '1rem'}}/>);
                    }
                }
                else{
                    if(learning[ex2[k].type] !== undefined) learning[ex2[k].type]++;
                }
            });

            if(pre.length){
                result.push(<p key={i} style={{margin: 0}}>
                                <b>{ex2[k].racial ? t('races.' + G.races[playerID].rid + '.' + ex2[k].id + '.label') : t('cards.techno.' + ex2[k].id + '.label')}</b>
                                <span>{' ' + t('board.have_unmeet_requirements') + ': '}</span>
                                {pre}
                            </p>);
            }
        }
        else{
            if(learning[ex2[k].type] !== undefined) learning[ex2[k].type]++;
        }
    });

    if(separate){
        return {upgrades: upgradesUnmeet, other: techsUnmeet};
    }
    else{
        return <>{result}</>
    }
}//, [ex2, G.races, playerID, PLANETS, adjSpec]);

export const ChoiceDialog = ({args, onSelect}) => {

    const { t } = useContext(LocalizationContext);
    const title = args.type === 'exploration' ? t('cards.exploration.' + args.id + '.label') : 
                    args.type === 'secret objective' ? t('cards.objectives.' + args.oid + '.label') :args.title;
    const text = args.type === 'exploration' ? t('cards.exploration.' + args.id + '.effect') : 
                    args.type === 'secret objective' ? t('cards.objectives.' + args.oid + '.title') :args.text;


    return  <Card className='subPanel' style={{position: 'absolute', padding: '2rem', margin: '10rem', 
                            backgroundColor: 'rgba(33, 37, 41, 0.95)', width: '30rem'}}>
                <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>{title}</h6></CardTitle>
                <div style={{display: 'flex', flexDirection: 'column', margin: '1rem'}}>
                    <CardText>{text}</CardText>

                    {args.options && args.options.map((o, i) => 
                        <button style={{width: '75%', marginTop: '.5rem'}} key={i} className='styledButton yellow' onClick={() => onSelect(i)}>{t('board.' + o.label)}</button>
                    )}
                </div>
            </Card>

}

export const CardsPager = ({children}) => {

    return <ListGroup horizontal style={{position: 'absolute', pointerEvents: 'none', bottom: '3rem', right: '3rem', fontSize: '65%', background: 'none', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', width: '60rem'}}>
        {children}
    </ListGroup>

}

export const CardsPagerItem = ({children, tag}) => {

    let url = '/card0.png';
    let shadow = '#999999';

    if(tag === 'context'){
        url = '/card1.png';
        shadow = '#05f2f0';
    }
    if(tag === 'action'){
        url = '/card2.png';
        shadow = '#d91c63';
    }
    else if(tag === 'relic'){
        url='/card3.png';
        shadow = '#ffeb12';
    }
    else if(tag === 'agenda'){
        url='/card4.png';
        shadow = '#4dad60';
    }

    return <ListGroupItem style={{background: 'url(' + url + ') no-repeat 0% 0%/100% 100%', padding: '1.5rem', width: '14rem', margin: '.25rem', boxShadow: '0px 0px 10px ' + shadow, pointerEvents: 'all', height: '20rem'}}>
        {children}
    </ListGroupItem>

}

export const Overlay = () => {

    const { ctx } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const [ mem, setMem ] = useState(null);

    return <div id='overlay'  onClick={() => setMem(ctx.phase)} className={ctx.phase === mem ? 'none':'block'} >
        {ctx.phase && <div id='overlay-text'>{t('board.phase_begin_' + ctx.phase)}</div>}
    </div>

}


export const StrategyPick = ({actionCardStage}) => {

    const { G, playerID, moves } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const [strategyHover, setStrategyHover] = useState('LEADERSHIP');
    const race = G.races[playerID];

    return <Card className='borderedPanel bigDialog' style={{width: actionCardStage ? '35%':'60%', margin: actionCardStage ? '5rem 0 0 40%':''}}>
                <CardTitle style={{borderBottom: '1px solid rgba(0, 0, 0, 0.42)', color: 'black'}}><h3>{t("board.strategy_pick")}</h3></CardTitle>
                <CardBody style={{display: 'flex'}}>
                <ListGroup style={{background: 'none', width: actionCardStage ? '100%':'60%'}}>
                    {Object.keys(cardData.strategy).map((key, idx) => {
                        let r = G.races.find( r => r.strategy.length && r.strategy.find(s => s.id === key));
                        if(!r && race.forbiddenStrategy && race.forbiddenStrategy.find(s => s.id === key)){
                        let sum = 0;
                        G.races.forEach(r => sum += r.strategy.length);
                        if(sum < 7) r = true;
                        }

                        return <ListGroupItem key={idx} style={{background: 'none', display:'flex', justifyContent: 'flex-end', border: 'none', padding: '.25rem'}}>
                        <div style={{width: 'auto'}}>
                            {r && r!== true && <div style={{position: 'absolute', left: '0', width: '100%', display: 'flex', alignItems: 'flex-end'}}>
                                    <img alt='race icon' src={'race/icons/'+r.rid+'.png'} style={{width: '3rem', maxHeight: '3rem'}}/>
                                    <h5 style={{marginLeft: '1rem', color: 'black'}}>{t('races.' + r.rid + '.name')}</h5>
                                </div>}
                        </div>
                        <button className='styledButton black' onMouseEnter={()=>setStrategyHover(key)} onClick={() => moves.pickStrategy(key)} 
                            style={{opacity: r ? '.5':'1', width: '12rem', height: '3.5rem', fontFamily: 'Handel Gothic', display: 'flex', alignItems: 'center'}}>
                                <b style={{backgroundColor: getStratColor(key, .6), border: 'solid 1px', width: '1.5rem', height: '1.5rem', fontSize: '1.25rem', lineHeight: '1.25rem'}}>{idx+1}</b>
                                <span style={{flex: 'auto'}}>{' ' + t('cards.strategy.' + key + '.label')}</span>
                        </button>
                        </ListGroupItem>
                    })}
                    </ListGroup>
                    {!actionCardStage && <Card style={{width: '40%', background: 'none', border: 'none', color: 'black'}}>
                    <CardBody>
                        <CardTitle><h4>{t("cards.strategy." + strategyHover + ".label")}</h4></CardTitle>
                        <CardSubtitle style={{margin: '2rem 0'}}>{t("cards.strategy." + strategyHover + ".hit")}</CardSubtitle>
                        <h5>{t("board.primary")}:</h5>
                        <p>{t("cards.strategy." + strategyHover + ".primary")}</p>
                        <h5>{t("board.secondary")}:</h5>
                        <p>{t("cards.strategy." + strategyHover + ".secondary")}</p>
                    </CardBody>
                    </Card>}
                </CardBody>
            </Card>

}

export const Gameover = (args) => {

    const { t } = useContext(LocalizationContext);
    const { ctx, G } = useContext(StateContext);
    const { winner } = ctx.gameover;
    //const lobbyClient = useMemo(() => new LobbyClient({ server: 'http://' + settings.ip + ':8000' }), []);
    // eslint-disable-next-line
    const [cookie, setCookie, removeCookie] = useCookies(['matchID', 'playerID', 'playerCreds']);
    const leaveMatch = () => {
        /*lobbyClient.leaveMatch('TIO', matchID, {
            playerID, 
            credentials
        })
        .then(() => {*/
            removeCookie('matchID', {path: '/', domain: settings.ip});
            removeCookie('playerID', {path: '/', domain: settings.ip});
            removeCookie('playerCreds', {path: '/', domain: settings.ip});
            window.location.reload();
        /*})
        .catch(console.err)*/
    };

    const winnerRace = useMemo(() => G.races[winner], [G.races, winner])

    const VP = useMemo(() => {
        let result = 0;
    
        if(winnerRace){
            winnerRace.secretObjectives.concat(G.pubObjectives).forEach(o => {
            if(o && o.players && o.players.length > 0){
              if(o.players.indexOf(winner) > -1) result += (o.vp ? o.vp : 1);
            }
          });
    
          result += winnerRace.vp;
        }
    
        return result;
      }, [winner, winnerRace, G.pubObjectives]);

    return  <Modal className='borderedPanel' style={{margin: '10rem auto', width: 'fit-content', maxWidth: 'unset', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} isOpen={args.isOpen}>
                <ModalHeader style={{justifyContent: 'center'}}><span style={{fontSize: '150%'}}>{t('board.game_is_over')}</span></ModalHeader>
                <ModalBody style={{display: 'flex', padding: '2rem'}}>
                        <div>
                            <h4 style={{marginBottom: '2rem'}}>{t('board.winner') + ': '}</h4>
                            <CardImg src={'race/'+ winnerRace.rid +'.png'} style={{width: '205px'}}/>
                            <h6 style={{marginTop: '1rem'}}>{t('board.victory_points') + ': ' + VP}</h6>
                        </div>
                        <div style={{ marginLeft: '3rem', padding: '1rem'}}>
                            <ObjectivesList playerID={winner} onSelect={() => {}}/>
                        </div>
                </ModalBody>
                <ModalFooter style={{padding: '1rem', display: 'flex', justifyContent: 'right'}}>
                    <button className='styledButton yellow' style={{fontFamily: 'Handel Gothic'}} onClick={leaveMatch}>{t('board.return_to_lobby')}</button>
                </ModalFooter>
            </Modal>
  
  }