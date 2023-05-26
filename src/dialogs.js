
import { Card, CardImg,  CardTitle, CardBody, CardText, CardFooter, Button, ButtonGroup, Row, Col, UncontrolledCollapse, UncontrolledTooltip,
    Modal, ModalHeader, ModalBody, ModalFooter, ListGroup, ListGroupItem, Input, Label, Badge } from 'reactstrap';
import { useState, useMemo, useCallback, useEffect, useRef, useContext } from 'react';
import { produce } from 'immer';
import cardData from './cardData.json';
import techData from './techData.json';
import { checkObjective, StateContext, haveTechnology } from './utils';

export function PaymentDialog(args) {
    
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
            else return false;
        })
    }, [payment, args, objective])

    return (
        <Modal style={{maxWidth: '35rem'}} isOpen={args.isOpen} toggle={()=>args.toggle()}>
        <ModalHeader toggle={()=>args.toggle()} style={{background: 'rgba(255,255,255,.8)', color: 'black'}}>{args.oid}</ModalHeader>
        <ModalBody style={{background: 'rgba(255,255,255,.8)', color: 'black'}}>
            {objective.title}
            <PaymentCard {...args} onPayment={setPayment} objective={objective}/>
        </ModalBody>
        <ModalFooter style={{background: 'rgba(255,255,255,.8)', color: 'black'}}>
            <Button disabled={!acceptable} color='success' onClick={()=>args.toggle(payment)}>
                Confirm
            </Button>
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

export const AgendaDialog = ({ G, ctx, playerID, PLANETS, onConfirm }) => {
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
        return PLANETS.filter(p => ex[p.name]).reduce((a,b) => b.influence + a, 0)
    },[ex, PLANETS]);

    const confirmClick = useCallback(() => {
        onConfirm({vote: voteSelect.current ? voteSelect.current.value : voteRadio, ex});
        setEx({});
        setVoteRadio('for');
    }, [ex, onConfirm, voteRadio]);

    const CARD_STYLE = {background: 'none', border: 'solid 1px rgba(74, 111, 144, 0.42)', padding: '1rem', marginBottom: '1rem'}
    const a = useMemo(() => G['vote' + agendaNumber], [agendaNumber, G]);

    return <Card style={{...CARD_STYLE, backgroundColor: 'rgba(255, 255, 255, .75)', width: '50%', position: 'absolute', margin: '10rem'}}>
        <CardTitle style={{borderBottom: '1px solid rgba(0, 0, 0, 0.42)', color: 'black'}}><h3>Agenda vote</h3></CardTitle>
        <CardBody style={{display: 'flex'}}>
            <div style={{width: '50%', border: 'solid 1px', color: 'black', position: 'relative', padding: '1rem', marginBottom: '1rem', borderRadius: '5px'}}>
                <img alt='agenda card' style={{width: '3rem', float: 'right', margin: '.5rem'}} src='icons/agenda_black.png'/>
                <h6 style={{marginBottom: '2rem'}}>{a.id + ' ' + a.type}</h6>
                
                {a.elect && <b>{'Elect: ' + a.elect}</b>}
                <p style={{margin: 0}}>{a.for && <>{a.against ? <b>{'For: '}</b> :''} {a.for}</>}</p>
                <p>{a.against && <><b>{'Against: '}</b>{a.against}</>}</p>

                {!imVoted && <>
                    {!a.elect && a.for && <h6 style={{marginTop: '2rem'}}>
                        <span onClick={()=>setVoteRadio('for')}><Input type='radio' name='vote' checked={voteRadio === 'for' ? 'checked':''} value='for' onChange={()=>setVoteRadio('for')} style={{margin: '0 .5rem'}}/><Label for='vote' style={{margin: '0 .5rem'}}>For</Label></span>
                        <span onClick={()=>setVoteRadio('against')}><Input type='radio' name='vote' checked={voteRadio === 'against' ? 'checked':''} value='against' onChange={()=>setVoteRadio('against')} style={{margin: '0 .5rem'}}/><Label for='vote' style={{margin: '0 .5rem'}}>Against</Label></span>
                        <span onClick={()=>setVoteRadio('pass')}><Input type='radio' name='vote' checked={voteRadio === 'pass' ? 'checked':''} value='pass' onChange={()=>setVoteRadio('pass')} style={{margin: '0 .5rem'}}/><Label for='vote' style={{margin: '0 .5rem'}}>Pass</Label></span>
                    </h6>}
                    {a.elect && <>
                        <Input type='select' innerRef={voteSelect} onChange={()=>{}} style={{margin: '1rem 0', color: 'black'}}>
                            {a.elect === 'Player' && G.races.map((r,i) => <option key={i} value={r.name}>{r.name}</option>)}
                            {a.elect === 'Law' && G.laws.map((l,i) => <option key={i} value={l.id}>{l.id}</option>)}
                            {a.elect === 'Scored Secret Objective' && G.races.map((r,i) => r.secretObjectives.map(s => s.players && s.players.length > 0 && <option key={s} value={s.id}>{s.id}</option>))}
                            {a.elect === 'Planet' && G.tiles.map((t,i) => t.tdata.planets && t.tdata.planets.map(p => <option key={p.name} value={p.name}>{p.name}</option>))}
                            {a.elect === 'Industrial Planet' && G.tiles.map((t,i) => t.tdata.planets && t.tdata.planets.map(p => p.trait === 'industrial' && <option key={p.name} value={p.name}>{p.name}</option>))}
                            {a.elect === 'Hazardous Planet' && G.tiles.map((t,i) => t.tdata.planets && t.tdata.planets.map(p => p.trait === 'hazardous' && <option key={p.name} value={p.name}>{p.name}</option>))}
                            {a.elect === 'Cultural Planet' && G.tiles.map((t,i) => t.tdata.planets && t.tdata.planets.map(p => p.trait === 'cultural' && <option key={p.name} value={p.name}>{p.name}</option>))}
                            {a.elect === 'Non-home, non-Mecatol Rex system' && G.tiles.map((t) => t.tid > 0 && t.tdata.type !== 'green' && t.tdata.planets && t.tdata.planets.map(p => <option key={p.name} value={p.name}>{p.name}</option>))}
                        </Input>
                    </>}
                    <p><Button color='success' onClick={confirmClick}>{'Confirm ' + votes + ' vote(s)'}</Button></p>
                </>}
                <div style={{display: 'flex', flexDirection: 'column', marginTop: '2rem'}}>
                    {G.races.map((r, i) => {
                        return <div key={i} style={{display: 'flex', lineHeight: '2rem'}}>
                            <div style={{width: '2rem', color: 'white', textAlign: 'center', background: 'url("icons/influence_bg.png") center no-repeat', backgroundSize: 'contain'}}>
                                <b>{r.votesMax - (agendaNumber > 1 ? r.voteResults[agendaNumber-2].count:0)}</b>
                            </div>
                            <b>{r.name + ' : ' + ( r.voteResults.length >= agendaNumber ? r.voteResults[agendaNumber-1].count + 
                            ' ' + r.voteResults[agendaNumber-1].vote.toUpperCase() : '') }
                            </b>
                        </div>
                    })}
                </div>
                {a && a.decision && <h6 style={{color: 'white', margin: '1rem 0', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.5)'}}>{'DECISION: ' + a.decision.toUpperCase()}</h6>}
                {G.vote2 && !G.vote2.decision && agendaNumber < 2 && <Button color='success' onClick={()=>setAgendaNumber(agendaNumber + 1)} style={{marginTop: '2rem'}}>{'Next'}</Button>}
            </div>
            <div style={{width: '50%', overflowY: 'auto', maxHeight: '30rem', marginLeft: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                <PlanetsRows PLANETS={PLANETS} onClick={planetRowClick} exhausted={ex}/>
            </div>
        </CardBody>
    </Card>

}

export const StrategyDialog = ({ PLANETS, UNITS, R_UNITS, R_UPGRADES, selectedTile, onComplete, onDecline }) => {

    const {G, ctx, playerID, exhaustedCards} = useContext(StateContext);
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
            if(step === 1){
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
            }
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

    const UnmeetReqs = useCallback(({separate}) => {
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

                if(pre.length)result.push(<p key={i}><b>{ex2[k].id.replaceAll('_', ' ').replace('2', ' II')}</b><span>{' have unmeet requirements: '}</span>{pre}</p>);
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
    }, [ex2, G.races, playerID, PLANETS, adjSpec]);

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
            }
            else if(step === 2){
                const keys = Object.keys(ex2);
                stopThere = ! (keys.length > 0 && (ex2[keys[0]] === 'pds'))
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
                const reqs = UnmeetReqs({separate: true});
                if(exhaustedCards.indexOf('AI_DEVELOPMENT_ALGORITHM') > -1){
                    stopThere = reqs.upgrades.length > 1 || reqs.other.length > 0;
                }
                else{
                    stopThere = reqs.upgrades.length > 0 || reqs.other.length > 0;
                }       
            }
        }
        else if(sid === 'IMPERIAL'){
            if(isMine && step === 1 && selectedRace > -1){
                if(G.pubObjectives[selectedRace] && G.pubObjectives[selectedRace].type !== 'SPEND' ){
                    stopThere = !checkObjective(G, playerID, selectedRace)
                }
            }
            if(isMine && step === 2){
                if(G.pubObjectives[selectedRace].type === 'SPEND'){
                    stopThere = !Object.keys(G.pubObjectives[selectedRace].req).every((k) => {
                        if(k === 'influence' || k === 'resources'){
                            return deploy[k] && deploy[k].planets.reduce((a,b) => b[k] + a, 0) + deploy[k].tg >= G.pubObjectives[selectedRace].req[k]
                        }
                        else if(k === 'tg'){
                            return G.races[playerID].tg >= G.pubObjectives[selectedRace].req[k]
                        }
                        else if(k === 'token'){
                            return deploy[k] && deploy[k].t + deploy[k].s >= G.pubObjectives[selectedRace].req[k]
                        }
                        else return false;
                    });
                }
            }
        }
    
        return stopThere;

    }, [selectedTile, selectedRace, G, step, isMine, sid, playerID, ex, ex2, ct, deployPrice, deploy, result, UnmeetReqs, exhaustedCards]);

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
                if(selectedRace > -1){
                    if(G.pubObjectives[selectedRace] && G.pubObjectives[selectedRace].type === 'SPEND'){
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
                if(selectedRace > -1){
                    inc = 1;
                }
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

    return (
        <Card style={{border: 'solid 1px rgba(74, 111, 144, 0.42)', maxWidth: '60%', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, .85)', position: 'absolute', margin: '5rem'}}>
              <CardTitle style={{borderBottom: '1px solid ' + getStratColor(sid, '.6'), color: 'black'}}><h3>{sid}</h3></CardTitle>
              <CardBody style={{display: 'flex', color: 'black', width: sid === 'WARFARE' && step === 2 && !isMine ? '':'min-content'}}>
                    {step === 0 && <>
                        <div>
                            <CardImg src={'race/'+ G.races[ctx.currentPlayer].rid +'.png'} style={{width: '205px'}}/>
                        </div>
                        <div style={{padding: '1rem', minWidth: '30rem'}}>
                            <div style={isMine? MINE_STYLE : {opacity: .5, padding: '1rem'}}>
                                <h5>Primary:</h5>
                                <p>{cardData.strategy[sid].primary}</p>
                            </div>
                            <div style={!isMine? MINE_STYLE : {opacity: .5, padding: '1rem'}}>
                                <h5>Secondary:</h5>
                                <p>{cardData.strategy[sid].secondary}</p>
                            </div>
                        </div>
                    </>}
                    {step === 1 && <div style={{display: 'flex', flexDirection: 'column', width: 'min-content'}}>
                        <p style={{margin: 0, minWidth: '40rem'}}>{isMine ? cardData.strategy[sid].primary : cardData.strategy[sid].secondary}</p>
                        {sid === 'LEADERSHIP' && <div style={{display: 'flex', width: '50rem', flexDirection: 'row'}}>
                            <div style={{width: '60%', overflowY: 'auto', maxHeight: '30rem', margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                <PlanetsRows PLANETS={PLANETS} onClick={planetRowClick} exhausted={ex}/>
                            </div>
                            <div style={{width: '40%', padding: '2rem'}}>
                                <h5 style={{fontSize: '50px', display: 'flex', justifyContent: 'flex-end'}}>{'+'}{tg}{' '}<Button tag='img' onClick={tgClick} src='/icons/trade_good_1.png' color='warning' 
                                    style={{marginLeft: '1rem', width: '4rem', padding: '.5rem', borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} />
                                    <Button disabled={tg < 1} color='warning' style={{width: '1.5rem', borderLeft: 'none', color:'orange', backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: 0}} onClick={()=>setTg(tg-1)}>▼</Button></h5>
                                <h5 style={{display: 'flex', justifyContent: 'flex-end'}}>You gain:</h5>
                                <div style={{display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap'}}><Tokens count={result}/></div>
                            </div>
                        </div>}
                        {sid === 'DIPLOMACY' && <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
                            <div style={{width: '60%', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                {selectedTile === -1 && <h5 style={{margin: '2rem'}}>Select system on map</h5>}
                                {selectedTile > -1 && <CardImg style={{width: '75%'}} src={'tiles/ST_'+G.tiles[selectedTile].tid+'.png'} />}
                            </div>
                        </div>}
                        {sid === 'POLITICS' && <div style={{width: '60%', margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                            <RaceList races={G.races} onClick={raceRowClick} selected={selectedRace} speaker={G.speaker}/>
                        </div>}
                        {sid === 'CONSTRUCTION' && <div style={{display: 'flex', flexDirection: 'row', marginTop: '2rem'}}>
                            {selectedTile === -1 && <h5 style={{margin: '2rem'}}>Select system on map</h5>}
                            {selectedTile > -1 && <><div style={{width: '60%', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                {selectedTile > -1 && <CardImg style={{width: '75%'}} src={'tiles/ST_'+G.tiles[selectedTile].tid+'.png'} />}
                            </div>
                            <div style={{width: '40%'}}>
                                {selectedTile > -1 && G.tiles[selectedTile].tdata.tokens.indexOf(G.races[playerID].rid) === -1 && <div style={{ overflowY: 'auto', height: '50%', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                    <PlanetsRows PLANETS={PLANETS.filter(p => p.tid === G.tiles[selectedTile].tid)} onClick={planetRowClick} exhausted={ex} variant='small'/>
                                </div>}
                                {Object.keys(ex).length > 0 && <div style={{padding: '1rem 0 0 0', height: '50%', display: 'flex', justifyContent: 'space-between'}}>
                                    <Button onClick={()=>setEx(produce(ex, draft => {draft[Object.keys(ex)[0]] = 'pds'}))} color={ex[Object.keys(ex)[0]] === 'pds' ? 'dark':'' } 
                                        style={{padding: 0, width: '49%', border: 'none', borderRadius: '5px'}}><img alt='pds' style={{width: '100%'}} src='units/PDS.png'/></Button>
                                    <Button onClick={()=>setEx(produce(ex, draft => {draft[Object.keys(ex)[0]] = 'spacedock'}))} color={ex[Object.keys(ex)[0]] === 'spacedock' ? 'dark':'' } 
                                        style={{padding: 0, width: '49%', border: 'none', borderRadius: '5px'}}><img alt='spacedock' style={{width: '100%'}} src='units/SPACEDOCK.png'/></Button>
                                </div>}
                            </div>
                            </>}
                        </div>}
                        {sid === 'TRADE' && <div style={{display: 'flex', alignItems: 'center', flexDirection: 'column', padding: '2rem'}}>
                            <h5 style={{margin: '1rem'}}>You gain:</h5>
                            <Row style={{height: '5rem', width: '25rem', justifyContent: 'center'}}>
                                {isMine && <><Col xs='3' style={{display: 'flex', alignItems: 'center'}}><h5 style={{fontSize: '50px'}}>+3</h5></Col>
                                <Col xs='3' style={{padding: 0, display: 'flex', alignItems: 'center'}}><img style={{width: '5rem', height: '5rem', borderRadius: '5px', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} alt='tg' src='icons/trade_good_1.png'/></Col></>}
                                <Col xs='3' style={{display: 'flex', alignItems: 'center'}}><h5 style={{fontSize: '50px'}}>{'+'}{G.races[playerID].commCap - (G.races[playerID].commodity || 0)}</h5></Col>
                                <Col xs='3' style={{padding: 0, display: 'flex', alignItems: 'center'}}><img  style={{width: '5rem', height: '5rem', borderRadius: '5px', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} alt='tg' src='icons/commodity_1.png'/></Col>
                            </Row>
                            {!isMine && <p style={{marginTop: '1rem', fontSize: '.8rem'}}>
                                {Object.keys(ctx.activePlayers).indexOf(ctx.currentPlayer) > -1 && <>Awaiting TRADE owner decision...</>}
                                {Object.keys(ctx.activePlayers).indexOf(ctx.currentPlayer) === -1 && <>
                                    {G.races[ctx.currentPlayer].strategy.find(s => s.id === 'TRADE').NO_TOKEN_RACES.indexOf(G.races[playerID].rid) > -1 && <b style={{color: 'green'}}>TRADE owner allow you make this free.</b>}
                                    {G.races[ctx.currentPlayer].strategy.find(s => s.id === 'TRADE').NO_TOKEN_RACES.indexOf(G.races[playerID].rid) === -1 && <b>TRADE owner don't allow you make this free.</b>}
                                </>}
                            </p>}
                        </div>}
                        {sid === 'WARFARE' && <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
                            {isMine && <div style={{width: '60%', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                {selectedTile === -1 && <h5 style={{margin: '2rem'}}>Select system on map</h5>}
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
                                    <h5 style={{textAlign: 'end'}}>{'You can learn '}</h5>
                                    <h5 style={{textAlign: 'end'}}>{result + (result === 1 ? ' technology':' technologies')}</h5>
                                    {adjSpec.length > 0 && <h6>and ignore {adjSpec.map((pname, pi) =>{
                                        const p = PLANETS.find(p => p.name === pname);
                                        return <img alt='specialty' key={pi} style={{width: '1rem'}} src={'icons/' + p.specialty + '.png'}/>
                                    })} requirements</h6>}
                                </div>
                            </div>
                        </div>}
                        {sid === 'IMPERIAL' && <div style={{display: 'flex', borderRadius: '5px', width: '35rem', margin: '1rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                            <ObjectivesList G={G} playerID={playerID} onSelect={selectObjective} selected={selectedRace} />
                        </div>}
                    </div>}
                    {step === 2 && lastStep > 1 && <div style={{width: '100%', display: 'flex', flexFlow: 'column'}}>
                        <p style={{margin: 0, minWidth: '40rem'}}>{isMine ? cardData.strategy[sid].primary : cardData.strategy[sid].secondary}</p>
                        {sid === 'DIPLOMACY' && <div style={{width: '60%', overflowY: 'auto', maxHeight: '30rem', margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                            {<PlanetsRows PLANETS={PLANETS} onClick={planetRowClick} exhausted={ex}/>}
                        </div>}
                        {sid === 'POLITICS' && <div style={{display: 'flex', padding: '1rem', flexDirection: 'column', fontSize: '.8rem'}}>
                            <h5 style={{margin: '.5rem'}}>You gain 2 action cards:</h5>
                            {G.actionsDeck.slice(-2 * (parseInt(playerID)+1)).slice(0, 2).map((a,i) => 
                                <div key={i} style={{border: 'solid 1px', padding: '1rem', marginBottom: '1rem',  borderRadius: '5px'}}>
                                    <img alt='action card' style={{width: '3rem', float: 'right', margin: '.5rem'}} src='icons/action_card_black.png'/>
                                    <h6>{a.id}</h6><p>{a.description}</p>
                                </div>
                            )}
                        </div>}
                        {sid === 'CONSTRUCTION' && <div style={{display: 'flex', flexDirection: 'row', marginTop: '2rem'}}>
                            {selectedTile === -1 && <h5 style={{margin: '2rem'}}>Select system on map</h5>}
                            {selectedTile > -1 && <><div style={{width: '60%', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                {selectedTile > -1 && <CardImg style={{width: '75%'}} src={'tiles/ST_'+G.tiles[selectedTile].tid+'.png'} />}
                            </div>
                            <div style={{width: '40%'}}>
                                {selectedTile > -1 && <div style={{ overflowY: 'auto', height: '50%', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                    <PlanetsRows PLANETS={PLANETS.filter(p => p.tid === G.tiles[selectedTile].tid)} onClick={planetRowClick} exhausted={ex2} variant='small'/>
                                </div>}
                                <div style={{padding: '1rem 0 0 0', height: '50%', display: 'flex', justifyContent: 'space-between'}}>
                                    <Button color='dark'style={{padding: 0, width: '49%', border: 'none', borderRadius: '5px'}}><img alt='pds' style={{width: '100%'}} src='units/PDS.png'/></Button>
                                </div>
                            </div>
                            </>}
                        </div>}
                        {sid === 'TRADE' && <div style={{width: '60%', margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                            <RaceList races={G.races.filter(r => r.rid !== G.races[playerID].rid)} onClick={raceMultiRowClick} selected={selectedRace}/>
                        </div>}
                        {sid === 'WARFARE' && <>
                            {isMine && <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem'}}>
                                <div style={{display: 'flex', padding: '1rem', borderRadius: '5px', flexDirection: 'column', color:'white', justifyContent: 'center', width: '60%', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                    <Row>
                                        <Col xs='4' style={TOKENS_STYLE}><b>tactic</b></Col>
                                        <Col xs='4' style={TOKENS_STYLE}><b>fleet</b></Col>
                                        <Col xs='4' style={TOKENS_STYLE}><b>strategic</b></Col>
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
                                    <h6 style={{textAlign: 'center', marginTop: '1rem'}}>{ct.new || 0} {' unused'}</h6>
                                </div>
                            </div>}
                            {!isMine && <div style={{display: 'flex', flexDirection: 'row', flexWrap:'wrap', justifyContent:'space-between', width: '100%', margin: '1rem'}}>
                                <div style={{width:'30rem', overflowY: 'auto', height: '22rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                    <PlanetsRows PLANETS={PLANETS} onClick={planetRowClick} exhausted={ex2}/>
                                </div>
                                <div style={{width: '35rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)', color: 'white', padding: '0 1rem 0 0'}}>
                                    <UnitsList UNITS={UNITS} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} onSelect={(u)=>setCurrentUnit(u)}/>
                                    <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                                        <Button size='sm' onClick={()=>deployUnit(+1)} color='warning' disabled={['PDS', 'SPACEDOCK'].indexOf(currentUnit) > -1}><b>Deploy</b></Button>
                                    </div>
                                </div>
                                <div style={{width:'29rem', margin: '1rem'}}>
                                    <h5 style={{fontSize: '50px', display: 'flex', justifyContent: 'flex-end'}}>{'+'}{tg}{' '}<Button tag='img' onClick={tgClick} src='/icons/trade_good_1.png' color='warning' 
                                        style={{marginLeft: '1rem', width: '4rem', padding: '.5rem', borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} />
                                        <Button disabled={tg < 1} color='warning' style={{width: '1.5rem', borderLeft: 'none', color:'orange', backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: 0}} onClick={()=>setTg(tg-1)}>▼</Button></h5>
                                    <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{'You mean to spend ' + result + ' resources'}</h6>
                                    <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{deployPrice + ' needed'}</h6>
                                </div>
                                <div style={{width: '33rem', margin: '1rem'}}>
                                    <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{'Max units count: ' + maxDeployUnits}</h6>
                                    {deploy && Object.keys(deploy).map((k, i) => {
                                        return (<p style={{margin: 0}} key={i}>
                                        <Button size='sm' color='warning' style={{padding: '0 .25rem', fontSize: '.75rem'}} onClick={()=>deployUnit(-1, k)}>▼</Button>
                                        <b>{' '}{k}{' : '}{deploy[k]}</b></p>)
                                    })}
                                </div>
                            </div>}
                        </>}
                        {sid === 'TECHNOLOGY' && <><div style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', color: 'white', margin: '1rem 0', width: '60rem'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                {getTechType('propulsion', G.races[playerID], true, techOnSelect, Object.keys(ex2))}
                                {getTechType('biotic', G.races[playerID], true, techOnSelect, Object.keys(ex2))}
                                {getTechType('warfare', G.races[playerID], true, techOnSelect, Object.keys(ex2))}
                                {getTechType('cybernetic', G.races[playerID], true, techOnSelect, Object.keys(ex2))}
                                {getTechType('unit', G.races[playerID], true, techOnSelect, Object.keys(ex2))}
                            </div>
                        </div>
                        <div><UnmeetReqs /></div>
                        </>}
                        {sid === 'IMPERIAL' && <>
                            {isMine && selectedRace > -1 && <>
                                <p><b>{G.pubObjectives[selectedRace].id}</b>{' '+G.pubObjectives[selectedRace].title}</p>
                                <div style={{display: 'flex', flexDirection: 'row'}}>
                                    <PaymentCard race={G.races[playerID]} planets={PLANETS} objective={G.pubObjectives[selectedRace]} onPayment={setDeploy}/>
                                </div>
                            </>}
                        </>}
                    </div>}
                    {step === 3 && lastStep > 2 && <div>
                        <p style={{margin: 0, minWidth: '40rem'}}>{isMine ? cardData.strategy[sid].primary : cardData.strategy[sid].secondary}</p>
                        {sid === 'POLITICS' && <div style={{display: 'flex', padding: '1rem', flexDirection: 'column', fontSize: '.8rem'}}>
                            {agendaCards.map((a, i) => 
                                <div key={i} style={{border: 'solid 1px', position: 'relative', padding: '1rem', marginBottom: '1rem', borderRadius: '5px'}}>
                                    <img alt='agenda card' style={{width: '3rem', float: 'right', margin: '.5rem'}} src='icons/agenda_black.png'/>
                                    <h6>{a.id + ' ' + a.type}</h6>
                                    {a.elect && <b>{'Elect: ' + a.elect}</b>}
                                    <p style={{margin: 0}}>{a.for && <>{a.against ? <b>{'For: '}</b> :''} {a.for}</>}</p>
                                    <p>{a.against && <><b>{'Against: '}</b>{a.against}</>}</p>
                                    <Input style={{margin: '0.25rem'}} type='checkbox' checked={agendaCards[i].bottom === true} onChange={()=>placeAgendaTopOrBottom(i)}/><b>Place at deck bottom</b>
                                    {i === 0 && <Button color='dark' onClick={()=>setAgendaCards([...agendaCards].reverse())} size='sm' style={{position: 'absolute', right: 0, bottom: 0 }}>▼</Button>}
                                </div>
                            )}
                        </div>}
                        {sid === 'IMPERIAL' && <>
                            {isMine && G.tiles[0].tdata.planets[0].occupied === playerID && <div style={{display: 'flex', padding: '1rem', flexDirection: 'column'}}>
                                <h5 style={{textAlign: 'center'}}>You gain 1 VP</h5>
                            </div>}
                            {(!isMine || (G.tiles[0].tdata.planets[0].occupied !== playerID)) && <div style={{display: 'flex', padding: '1rem', flexDirection: 'column', fontSize: '.8rem'}}>
                                <h5 style={{margin: '.5rem'}}>You gain secret objective:</h5>
                                {G.secretObjDeck.slice(-1 * (parseInt(playerID)+1)).slice(0, 1).map((a,i) => 
                                    <div key={i} style={{border: 'solid 1px', padding: '1rem', marginBottom: '1rem',  borderRadius: '5px'}}>
                                        <img alt='action card' style={{width: '3rem', float: 'right', margin: '.5rem'}} src='icons/secret_regular.png'/>
                                        <h6>{a.id}{a.type ? ' ' + a.type:''}</h6><p>{a.title}</p>
                                    </div>
                                )}
                            </div>}
                        </>}
                    </div>}
                    {step > lastStep && <div style={{width: '100%', display: 'flex', minWidth: '30rem', flexFlow: 'column'}}>
                        <h5>Awaiting other players:</h5>
                        {Object.keys(ctx.activePlayers).map((a,i) => {
                            return <h6 key={i}>{G.races[a].name}</h6>
                        })}
                    </div>}
              </CardBody>
              {step <= lastStep && <CardFooter style={{background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid ' + getStratColor(sid, '.6'),}}>
                  {step === 0 && <Button color='danger' disabled={isMine} onClick={()=>{onDecline(); setStep(lastStep+1)}}>Decline</Button> }
                  {step > 0 && step <= lastStep && <Button onClick={backButtonClick}>Back</Button>}
                  {step < lastStep && <Button disabled={cantNext} color='success' onClick={nextButtonClick}>{step === 0 && !isMine ? 'Accept':'Next'}</Button>}
                  {step === lastStep && <Button disabled={cantNext} color='success' onClick={doneButtonClick}>Done</Button>}
              </CardFooter>}
        </Card>
    );  
  
}

export const UnitsList = ({UNITS, R_UNITS, R_UPGRADES, onSelect}) => {

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
            <Button key={i} size='sm' color={showUnit === u.id ? 'light':'dark'} onClick={()=>setShowUnit(u.id)}>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <div>{u.alreadyUpgraded && <span style={{color: 'coral', marginRight: '.5rem'}}>▲</span>}{u.id}</div>
                <div>{UNITS[u.id.toLowerCase()]}</div>
              </div>
            </Button>)}
        </div>
        <div style={{paddingLeft: '1rem', flex: 'auto', width: '70%'}}>
          <CardImg src={'units/' + showUnit + '.png'} style={{width: 'auto', float: 'left'}}/>
          <div style={{padding: '1rem', position: 'absolute', right: '1rem', textAlign: 'end'}}>
            {R_UNITS[showUnit].description && <h5>{R_UNITS[showUnit].description}</h5>}
            {R_UNITS[showUnit].sustain && <h6>♦ sustain damage</h6>}
            {R_UNITS[showUnit].bombardment && <h6>♦ bombardment {R_UNITS[showUnit].bombardment.value + ' x ' + R_UNITS[showUnit].bombardment.count}</h6>}
            {R_UNITS[showUnit].barrage && <h6>♦ barrage {R_UNITS[showUnit].barrage.value + ' x ' + R_UNITS[showUnit].barrage.count}</h6>}
            {R_UNITS[showUnit].planetaryShield && <h6>♦ planetary shield</h6>}
            {R_UNITS[showUnit].spaceCannon && <h6>♦ space cannon {R_UNITS[showUnit].spaceCannon.value + ' x ' + R_UNITS[showUnit].spaceCannon.count + ' range ' + R_UNITS[showUnit].spaceCannon.range}</h6>}
            {R_UNITS[showUnit].production && <h6>♦ production {R_UNITS[showUnit].production}</h6>}
            {!R_UNITS[showUnit].alreadyUpgraded && R_UPGRADES[showUnit+'2'] && <>
              <h6 style={{marginTop: '2rem'}}>{'upgradable '}
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
                        return <li key={i}>{k + ' ' + L2}</li>
                      }
                    }
                    else if(['bombardment', 'barrage'].indexOf(k) > -1 && L2){
                      if(!L1 || L2.value !== L1.value || L2.count !== L1.count){
                        return <li key={i}>{k + ' ' + R_UPGRADES[showUnit+'2'][k].value + ' x ' + L2.count}</li>
                      }
                    }
                    else if(k === 'spaceCannon' && L2){
                      if(!L1 || L2.value !== L1.value || L2.count !== L1.count || L2.range !== L1.range){
                        return <li key={i}>{'space cannon ' + L2.value + ' x ' + L2.count + ' range ' + L2.range}</li>
                      }
                    }
                    else if( k === 'sustain' && L2){
                      return <li key={i}>sustain damage</li>
                    }
                    return null
                  })}
                </ul>
              </>
            }
          </div>
          
          <div style={{clear: 'both'}}/>
                              
          <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center', marginBottom: '.5rem'}}>
            {R_UNITS[showUnit].cost && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{fontSize: 30}}>{R_UNITS[showUnit].cost}</h6><b style={B_STYLE}>cost</b></ListGroupItem>}
            {R_UNITS[showUnit].combat && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}>
              <h6 style={{fontSize: 30}}>{R_UNITS[showUnit].combat}{R_UNITS[showUnit].shot && R_UNITS[showUnit].shot > 1 && 
                <i style={{position: 'absolute', fontSize: '1.25rem', top: '0.5rem', right: 0, transform: 'rotate(90deg)'}}>{'♦'.repeat(R_UNITS[showUnit].shot)}</i>}
              </h6><b style={B_STYLE}>combat</b></ListGroupItem>}
            {R_UNITS[showUnit].move && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{fontSize: 30}}>{R_UNITS[showUnit].move}</h6><b style={B_STYLE}>move</b></ListGroupItem>}
            {R_UNITS[showUnit].capacity && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{fontSize: 30}}>{R_UNITS[showUnit].capacity}</h6><b style={B_STYLE}>capacity</b></ListGroupItem>}
          </ListGroup>
          {R_UNITS[showUnit].effect && <CardText style={{fontSize: '0.7rem'}}>{R_UNITS[showUnit].effect}</CardText>}
          {R_UNITS[showUnit].deploy && <CardText style={{fontSize: '0.7rem'}}><b>DEPLOY</b>{' '+R_UNITS[showUnit].deploy}</CardText>}
        </div>
      </div>

}

export const ObjectivesList = ({onSelect, selected}) => {
    const { G, playerID } = useContext(StateContext);
    if(!onSelect) onSelect = ()=>{}

    return <ListGroup style={{maxHeight: '30rem', overflowY: 'auto', border: 'none', width: '100%', paddingRight: '1rem'}}>
      {G.pubObjectives && G.pubObjectives.length > 0 &&
        G.races[playerID].secretObjectives.concat(G.pubObjectives).map((o, i) => {
          const completed = o.players && o.players.length > 0 && o.players.indexOf(playerID) > -1;
          return <ListGroupItem className='hoverable'
                    style={{cursor: completed ? 'default':'pointer', 
                      background: completed ? 'green': (selected === o.id ? 'rgba(255,193,7,.75)':'none'), 
                      color: completed || selected === o.id ? 'black':'white', border: 'solid 1px transparent' }} 
                      key={i} onClick={() => {if(!completed) onSelect(o.id)}}>
                    <CardImg style={{display: 'inline-block', width: '2rem', margin: '0 1rem .5rem 0', opacity: checkObjective(G, playerID, o.id) ? '1': '.5'}} 
                        src={o.vp === 2 ? 'icons/public_2.png': o.vp === 1 ? 'icons/public_1.png':'icons/secret_regular.png'} />
                    <b>{o.id}</b>
                    <span style={{float: 'right'}}>
                        {o.players && o.players.length > 0 && 
                        o.players.map((p, pi) => <CardImg key={pi} src={'race/icons/' + G.races[p].rid + '.png'} 
                        style={{display: 'inline-block', width: '1rem', marginRight: '.5rem'}}/>)}
                    </span>
                    <p style={{fontSize: '0.8rem'}}>{o.title}</p>
                  </ListGroupItem>})
        }
      
    </ListGroup>
}

const PaymentCard = (args) => {

    const [payment, setPayment] = useState({ influence: { planets: [], tg: 0 }, resources: { planets: [], tg: 0 }, tg: 0, token: { s:0, t:0 } });
    const [paid, setPaid] = useState({}); //exhausted
    const tg = useMemo(() => args.race.tg - payment.influence.tg - payment.resources.tg, [payment, args]);
    const tokens = useMemo(()=> ({ t: args.race.tokens.t - payment.token.t, s: args.race.tokens.s - payment.token.s}), [payment, args]);

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
    }, [payment, tokens])
    
    useEffect(()=>{
        if(args.onPayment){
            args.onPayment(payment);
        }
    },[payment, args]);

    const objKeys = Object.keys(args.objective.req);
    const TOKENS_STYLE = { cursor:'pointer', display: 'flex', textAlign: 'center', padding: 0, flexFlow: 'column', background: 'none', color: 'white'}

    return <>
        {objKeys.indexOf('influence') + objKeys.indexOf('resources') > -2 && <div style={{width: '30rem', overflowY: 'auto', maxHeight: '30rem', margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
            <PlanetsRows PLANETS={args.planets} exhausted={paid} onClick={(p)=>cancelPlanet(p)}
            resClick={objKeys.indexOf('resources') > -1 ? (e, p)=>payPlanet(e, p, 'resources'):undefined} infClick={objKeys.indexOf('influence') >-1? (e, p)=>payPlanet(e, p, 'influence'):undefined}/>
        </div>}
        {objKeys.indexOf('token') > -1 && <div style={{width: '20rem', margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
            <Row>
                <Col xs='6' style={TOKENS_STYLE}><b>tactic</b></Col>
                <Col xs='6' style={TOKENS_STYLE}><b>strategic</b></Col>
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
        <div style={{width: '20rem', margin: '1rem', display: 'flex', flexDirection: 'column'}}>
            {objKeys.map((k, i) =>{
                
                return <div key={i} style={{display: 'flex', justifyContent: 'flex-start'}}>
                            {(k === 'influence' || k === 'resources') && <h5 style={{width: '4rem', display: 'flex', justifyContent: 'flex-start'}}>
                                <Button disabled={args.objective.req['tg'] ? (tg <= args.objective.req['tg']) : (tg < 1)} tag='img' onClick={()=>payTg(k, 1)} src='/icons/trade_good_1.png' color='warning' 
                                    style={{width: '2rem', padding: '.5rem', borderTopLeftRadius: '5px', 
                                    borderBottomLeftRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}/>
                                
                                <Button disabled={payment[k].tg === 0} color='warning' 
                                    style={{width: '1.5rem', borderLeft: 'none', color:'orange', backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: 0}} 
                                    onClick={()=>payTg(k, -1)}>▼
                                </Button>
                            </h5>}
                            
                            <div style={{display: 'flex', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap'}}>
                                <h6 style={{textAlign: 'end'}}>{'Total ' + k + ': '}
                                    {payment[k].planets && payment[k].planets.reduce((a,b) => b[k] + a, 0)}
                                    {!payment[k].planets && k!=='token' && tg}
                                    {k!=='token' && payment[k].tg > 0 && '+' + payment[k].tg + ' tg'}
                                    {k==='token' && payment[k].t + payment[k].s}
                                    {' / '}{args.objective.req[k]}
                                </h6>
                            </div>
                    </div>
            })}
        </div>
    </>
}

export const PlanetsRows = ({PLANETS, onClick, exhausted, variant, resClick, infClick, specClick}) => {

    if(!onClick) onClick = ()=>{};
    if(!resClick) resClick = ()=>{};
    if(!infClick) infClick = ()=>{};
    if(!specClick) specClick = ()=>{};
    if(!exhausted) exhausted = {};

    const { G, playerID, moves } = useContext(StateContext);
    const psArch = haveTechnology(G.races[playerID], 'PSYCHOARCHAEOLOGY');

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
                    style={{cursor: 'default', paddingRight: '1rem', fontSize: '1.25rem', marginTop: '.25rem', lineHeight: '2.2rem', height: '2.5rem', background: exhausted[p.name] ? 'green':'',
                    opacity: opac, color: 'white'}}>
                <Col xs='7'>{p.legendary ? <img alt='legendary' style={{width: '1.5rem'}} src={'icons/legendary_complete.png'}/>:'' } {p.name}</Col>
                <Col xs='1' onClick={(e)=>specClick(e, p)} style={{cursor: 'pointer', padding: 0}}>{specialty}</Col>
                <Col xs='1' style={{padding: 0}}>{trait}</Col>
                {variant !== 'small' && <>
                <Col xs='1' onClick={(e)=>resClick(e, p)} style={{cursor: 'pointer', background: 'url(icons/resources_bg.png)', backgroundRepeat: 'no-repeat', backgroundSize: 'contain'}}><b style={{paddingLeft: '0.1rem'}}>{p.resources}</b></Col>
                <Col xs='1' onClick={(e)=>infClick(e, p)} style={{cursor: 'pointer', background: 'url(icons/influence_bg.png)', backgroundRepeat: 'no-repeat', backgroundSize: 'contain'}}><b>{p.influence}</b></Col>
                
                {(!psArch || p.exhausted) && <Col />}
                {psArch && !p.exhausted && <Col className='bi bi-box-arrow-in-right' style={{padding: 0, cursor: 'pointer', position: 'relative'}}> 
                    <img style={{width: '1.5rem', position: 'absolute', top: '.25rem', left: '1rem'}} onClick={(e)=>{e.stopPropagation(); moves.exhaustForTg(p.name)}} src='icons/trade_good_1.png' alt='tg'/> 
                </Col>}
                </>}
              </Row>)
    })
  }

export const getTechType = (typ, race, tooltipMode, onSelect, selected, onAction) => {

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
        {typ === 'unit' ? 'UPGRADES':typ.toUpperCase()}
      </h6>
      
      <ListGroup>
        {techs.map((t, i) => 
          <ListGroupItem onClick={()=>ItemOnClick(t)} key={i} style={{opacity: race.exhaustedCards.indexOf(t.id)>-1 ? .35:1, background: 'none', padding: '.25rem', color: 'white', borderBottom: 'solid 1px rgba(255,255,255,.15)'}} >
            <Button size='sm' color={race.knownTechs.indexOf(t.id) > -1 ? 'success': (selected.indexOf(t.id) > -1 ? 'warning':'dark')} id={t.id} style={{width: '100%', fontSize: '.7rem', textAlign: 'left'}}>
              {t.id.replaceAll('_', ' ').replaceAll('2', ' II')}
              {t.racial && <img alt='racial' style={{width: '1rem', position: 'absolute', marginLeft: '.5rem', top: '.6rem'}} src={'race/icons/'+ race.rid +'.png'}/>}
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
                <b>require: </b>
                {Object.keys(t.prereq).map((p, j) =>{
                  let result = [];
                  for(var i=1; i<=t.prereq[p]; i++){
                    result.push(<img key={j+''+i} alt='requirement' style={{width: '1rem'}} src={'icons/'+p+'.png'}/>);
                  }
                  return result;
                })}
              </div>}
              {t.type !== 'unit' && t.description}
              
              {t.type === 'unit' && <div style={{fontSize: tooltipMode ? '.9rem':'.7rem', width: '100%'}}>
                <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center', marginBottom: '.5rem'}}>
                {t.cost && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{margin: 0}}>{t.cost}</h6><b style={{...B_STYLE, fontSize: '.5rem'}}>cost</b></ListGroupItem>}
                {t.combat && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}>
                  <h6 style={{margin: 0}}>{t.combat}{t.shot && t.shot > 1 && 
                    <i style={{position: 'absolute', fontSize: 10, top: '0.5rem', right: 0, transform: 'rotate(90deg)'}}>{'♦'.repeat(t.shot)}</i>}
                  </h6><b style={{...B_STYLE, fontSize: '.5rem'}}>combat</b></ListGroupItem>}
                {t.move && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{margin: 0}}>{t.move}</h6><b style={{...B_STYLE, fontSize: '.5rem'}}>move</b></ListGroupItem>}
                {t.capacity && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{margin: 0}}>{t.capacity}</h6><b style={{...B_STYLE, fontSize: '.5rem'}}>capacity</b></ListGroupItem>}
              </ListGroup>
              {t.sustain && <p style={{margin: 0}}>♦ sustain damage </p>}
              {t.bombardment && <p style={{margin: 0}}>♦ bombardment {t.bombardment.value + ' x ' + t.bombardment.count}</p>}
              {t.barrage && <p style={{margin: 0}}>♦ barrage {t.barrage.value + ' x ' + t.barrage.count} </p>}
              {t.planetaryShield && <p style={{margin: 0}}>♦ planetary shield </p>}
              {t.spaceCannon && <p style={{margin: 0}}>♦ space cannon {t.spaceCannon.value + ' x ' + t.spaceCannon.count + ' range ' + t.spaceCannon.range}</p>}
              {t.production && <p style={{margin: 0}}>♦ production {t.production}</p>}
              {t.effect && <CardText style={{paddingTop: '.5rem'}}>{t.effect}</CardText>}
              {t.deploy && <CardText style={{paddingTop: '.5rem'}}><b>DEPLOY</b>{' '+t.deploy}</CardText>}
              </div>
              }
            </Wrapper>
          </ListGroupItem>)}
      </ListGroup>
    </div>
  )};
//{race.knownTechs.indexOf(t.id) > -1 && t.action === true && race.exhaustedCards.indexOf(t.id) === -1 && <Button size='sm' color='warning' onClick={()=>onAction(t.id)}>Action</Button>}
const RaceList = ({races, selected, speaker, onClick}) => {
    if(!onClick) onClick = ()=>{};

    return races.map((r,i) => {
        return (<Row className='hoverable' onClick={()=>onClick(r.rid)} key={i}
                    style={{cursor: 'default', fontSize: '1.25rem', lineHeight: '2.2rem', height: '2.5rem', marginTop: '.25rem',
                    background: selected === r.rid || (Array.isArray(selected) && selected.indexOf(r.rid) > -1) ? 'green':'', color: 'white'}}>
                    <Col xs='1'></Col>
                    <Col xs='2'><img alt='race icon' style={{width: '1.5rem'}} src={'race/icons/'+r.rid+'.png'}/></Col>
                    <Col xs='9'>{r.name}{speaker === r.rid && <> (speaker)</>}</Col>
                </Row>)
    });
  }

export const TradePanel = ({ onTrade }) => {

    const { G, playerID } = useContext(StateContext);
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

    return <div style={{display: 'flex', flexDirection: 'row', alignItems: 'flex-start'}}>
        <ButtonGroup vertical style={{width: '10%', paddingRight: '.5rem'}}>
            {races.map((r, i) => <Button onClick={()=>setSrid(r.rid)} style={{padding: '.25rem',marginBottom: '.5rem', minHeight: '2.5rem'}} color='dark' key={i} tag='img' src={'/race/icons/' + r.rid + '.png'}/>)}
        </ButtonGroup>
        <div style={{width: '90%'}}>
            <RacePanel rid={G.races[playerID].rid} onSelect={setTradeItem}/>
            {races.length > 0 && <>
                <Row style={{margin: '1rem'}}>
                    <Col style={{textAlign: 'right', alignSelf: 'center'}}>
                        {tradeItem && <b>{tradeItem === 'commodity' ? '1 commodity' : tradeItem === 'tg' ? '1 trade good' : 
                        tradeItem === 'fragment.c' ? '1 cultural fragment' :
                        tradeItem === 'fragment.h' ? '1 hazardous fragment' :
                        tradeItem === 'fragment.i' ? '1 industrial fragment' :
                        tradeItem === 'fragment.u' ? '1 unknown fragment' :
                        tradeItem.substr(tradeItem.indexOf('.') + 1).replaceAll('_', ' ') }</b>}
                    </Col>
                    <Col xs={3} style={{textAlign: 'center'}}>
                        <Button onClick={()=>tradeClick()} disabled={!tradeItem} className='bi-arrow-down-circle' style={{fontSize: '1rem'}} size='sm' color='success'>{' Send'}</Button>
                    </Col>
                </Row>
                <RacePanel rid={srid} />
            </>}
        </div>
    </div>
}

const RacePanel = ({rid, onSelect}) => {
    const { G, playerID } = useContext(StateContext);
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
                    <Badge onClick={()=>onSelect('promissory.'+k.id)} color='dark' id={k.id+'_trade'} className='hoverable' style={{fontSize: '.6rem'}}>{k.id.replaceAll('_', ' ')}</Badge>
                    <UncontrolledTooltip target={'#'+k.id+'_trade'}>{k.effect}</UncontrolledTooltip>
                    </span>)}
                </Col>
            </Row>}
            {buttonSwitch === 'actions' && <Row>
                <Col>{r.actionCards.map((k, i) => <span key={i}>
                    <Badge onClick={()=>onSelect('action.'+k.id)} color='dark' id={k.id.replaceAll(' ', '_')+'_trade'} className='hoverable' style={{fontSize: '.6rem'}}>{k.id.replaceAll('_', ' ')}</Badge>
                    <UncontrolledTooltip target={'#'+k.id.replaceAll(' ', '_')+'_trade'}>{k.description}</UncontrolledTooltip>
                    </span>)}
                </Col>
            </Row>}
        </Col>
    </Row>)
}

export const ProducingPanel = (args) => {

    const { pname, onCancel, PLANETS, R_UNITS, R_UPGRADES, UNITS } = args;
    const { G, playerID, moves, exhaustedCards, exhaustTechCard } = useContext(StateContext);
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

    const maxDeployUnits = useMemo(() => {
        if(exhaustedCards.indexOf('SLING_RELAY')>-1){
            return 1;
        }
        const planet = PLANETS.find(p => p.name === pname);
        
        if(planet){
            let sd = planet.units['spacedock'].length * R_UNITS['SPACEDOCK'].production;
            let max = planet.resources + sd;
            return max;
        }

        return 0;
    }, [PLANETS, R_UNITS, pname, exhaustedCards]);

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

        return sum;

    }, [deploy, R_UNITS, exhaustedCards, G.races, playerID]);

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
                resources += planet.resources;
            }
        });
        setResult(resources + tg);
    },[ex2, PLANETS, tg]);

    const onCancelClick = () => {
        if(exhaustedCards.indexOf('SLING_RELAY')>-1){
            exhaustTechCard('SLING_RELAY');
            onCancel();
        }
        else onCancel();
    }

    return <Card style={{border: 'solid 1px rgba(74, 111, 144, 0.42)', padding: '1rem', marginBottom: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)', width: '70rem'}}>
                <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Producing</h6></CardTitle>
                <div style={{display: 'flex', flexDirection: 'row', flexWrap:'wrap', justifyContent:'space-between', width: '100%', margin: '1rem'}}>
                    <div style={{width:'30rem', overflowY: 'auto', height: '22rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                        <PlanetsRows PLANETS={PLANETS} onClick={planetRowClick} exhausted={ex2}/>
                    </div>
                    <div style={{width: '35rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)', color: 'white', padding: '0 1rem 0 0'}}>
                        <UnitsList UNITS={UNITS} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} onSelect={(u)=>setCurrentUnit(u)}/>
                        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                            <Button size='sm' onClick={()=>deployUnit(+1)} color='warning' disabled={bannedUnits.indexOf(currentUnit) > -1}><b>Deploy</b></Button>
                        </div>
                    </div>
                    <div style={{width:'29rem', margin: '1rem'}}>
                        <h5 style={{fontSize: '50px', display: 'flex', justifyContent: 'flex-end'}}>{'+'}{tg}{' '}<Button tag='img' onClick={tgClick} src='/icons/trade_good_1.png' color='warning' 
                            style={{marginLeft: '1rem', width: '4rem', padding: '.5rem', borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} />
                            <Button disabled={tg < 1} color='warning' style={{width: '1.5rem', borderLeft: 'none', color:'orange', backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: 0}} onClick={()=>setTg(tg-1)}>▼</Button></h5>
                        <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{'You mean to spend ' + result + ' resources'}</h6>
                        <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{deployPrice + ' needed'}</h6>
                    </div>
                    <div style={{width: '33rem', margin: '1rem'}}>
                        <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{'Max units count: ' + maxDeployUnits}</h6>
                        {deploy && Object.keys(deploy).map((k, i) => {
                            return (<p style={{margin: 0}} key={i}>
                            <Button size='sm' color='warning' style={{padding: '0 .25rem', fontSize: '.75rem'}} onClick={()=>deployUnit(-1, k)}>▼</Button>
                            <b>{' '}{k}{' : '}{deploy[k]}</b></p>)
                        })}
                    </div>
                </div>
                <CardFooter style={{background: 'none', borderTop: '1px solid rgba(74, 111, 144, 0.42)', display: 'flex', justifyContent: 'space-between'}}>
                    <Button color='danger' onClick={onCancelClick}>Cancel</Button>
                    <Button color='success' disabled={deployPrice > result} onClick={() => {moves.producing(pname, deploy, Object.keys(ex2), tg, exhaustedCards); onCancelClick()}}>Finish</Button>
                </CardFooter>
            </Card>

}