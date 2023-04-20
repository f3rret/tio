
import { Card, CardImg,  CardTitle, CardBody, CardFooter, Button, Row, Col,
    Modal, ModalHeader, ModalBody, ModalFooter, ListGroup, ListGroupItem, Badge } from 'reactstrap';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { produce } from 'immer';
import cardData from './cardData.json';

export function PaymentDialog(args) {
    
    const [payment, setPayment] = useState({ influence: { planets: [], tg: 0 }, resources: { planets: [], tg: 0 }, tg: 0 });
    const [paid, setPaid] = useState({}); //exhausted

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

    const payTg = useCallback((type) => {
        setPayment(produce(payment, draft => {
            draft[type].tg += 1;
        }));
    }, [payment]);

    const flushTg = useCallback(() => {
        setPayment(produce(payment, draft => {
            draft['influence'].tg = 0;
            draft['resources'].tg = 0;
        }));
    }, [payment]);
    
    const tg = useMemo(() => args.race.tg - payment.influence.tg - payment.resources.tg, [payment, args]);

    const acceptable = useMemo(()=>{
        return Object.keys(args.objective.req).every( tag => {
            if(tag === 'influence' || tag === 'resources'){
                const pp = payment[tag].planets.reduce((a,b) => b[tag] + a, 0);
                return pp + payment[tag].tg >= args.objective.req[tag];
            }
            else if(tag === 'tg'){
                return tg >= args.objective.req[tag];
            }
            return false;
        });
    }, [payment, args, tg]);

    return (
        <Modal isOpen={args.isOpen} toggle={args.toggle}>
        <ModalHeader toggle={args.toggle}>{args.objective.id}</ModalHeader>
        <ModalBody style={{background: 'rgba(255,255,255,.8)', color: 'black'}}>
            {args.objective.title}
            <div style={{display: 'flex'}}>
                {args.planets && 
                <ListGroup style={{width: '50%', margin: '1rem'}}>
                    {args.planets.map((p, i) => {
                            let bg = '';
                            let disabled = false;

                            if (paid[p.name] === 'resources'){ bg = 'beige'; disabled = true}
                            else if (paid[p.name] === 'influence'){ bg ='aliceblue';  disabled = true}
                            else if (p.exhausted){ bg = 'silver'; disabled = true}

                            const style={backgroundColor: bg, display: 'flex', justifyContent: 'space-between', cursor: 'default'}

                            return ( 
                            <ListGroupItem key={i} onClick={(e) => cancelPlanet(p.name)} style={style}>
                                <div>{p.name}</div>
                                <div>
                                    <Button size='sm' style={{color: 'white'}} disabled={disabled} color='warning' onClick={(e)=>payPlanet(e, p, 'resources')}><b>{p.resources}</b></Button>
                                    <Button size='sm' style={{color: 'white'}} disabled={disabled} color='info' onClick={(e)=>payPlanet(e, p, 'influence')}><b>{p.influence}</b></Button>
                                </div>
                            </ListGroupItem>)}
                    )}
                </ListGroup>}
                <div style={{width: '30%', margin: '1rem', display: 'flex', flexDirection: 'column'}}>
                    {Object.keys(args.objective.req).map((k, i) =>{
                        
                        return <div key={i} style={{display: 'flex', justifyContent: 'flex-end'}}>
                                <Badge color={k ==='influence' ? 'info': ( k === 'resources' ? 'warning' : 'dark' )} 
                                        style={{cursor: (k ==='tg'?'pointer':'default'), fontSize: '1.25rem', marginBottom: '.5rem'}}
                                        onClick={(e)=> k ==='tg' && flushTg()}>
                                    {payment[k].planets && payment[k].planets.reduce((a,b) => b[k] + a, 0)}
                                    {!payment[k].planets && tg}
                                    {payment[k].tg > 0 && '+' + payment[k].tg}
                                    {' / '}{args.objective.req[k]}
                                </Badge>
                                {(k === 'influence' || k === 'resources') && 
                                <Button disabled={tg < 1} onClick={()=>payTg(k)} size='sm' color='dark' style={{margin: '0 0 .5rem .5rem'}}>+</Button>}
                            </div>
                    }
                    )}
                </div>
            </div>
        </ModalBody>
        <ModalFooter>
            <Button color="light" disabled = {!acceptable} onClick={(e) => args.toggle(e, payment)}>
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

export const StrategyDialog = ({ G, ctx, playerID, PLANETS, onComplete }) => {

    const sid = G.strategy;
    const isMine = ctx.currentPlayer === playerID;

    switch(sid){
        case 'LEADERSHIP':
          //G.races[playerID].tokens.new = 3;
          break;
        case 'DIPLOMACY':
          break;
        case 'POLITICS':
            break;
        case 'CONSTRUCTION':
          break;
        case 'TRADE':
          break;
        case 'WARFARE':
          break;
        case 'TECHNOLOGY':
          break;
        case 'IMPERIAL':
          break;
        default:
          break;
    }

    const [step, setStep] = useState(0);
    const mineStyle = {border: 'solid 1px ' + getStratColor(sid, '.6'), padding: '1rem', backgroundColor: 'rgba(0,0,0,.15)'};

    const [ex, setEx] = useState({}); //exhausted
    const [result, setResult] = useState(0);
    const [tg, setTg] = useState(0);

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
    }, [ex, tg, isMine, sid, PLANETS]);

    const planetRowClick = useCallback((pname) => {
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
    }, [ex, PLANETS]);

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

    return (
        <Card style={{border: 'solid 1px rgba(74, 111, 144, 0.42)', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, .85)', width: '40%', position: 'absolute', margin: '10rem'}}>
              <CardTitle style={{borderBottom: '1px solid ' + getStratColor(sid, '.6'), color: 'black'}}><h3>{sid}</h3></CardTitle>
              <CardBody style={{display: 'flex', color: 'black'}}>
                    {step === 0 && <>
                        <div>
                            <CardImg src={'race/'+ G.races[ctx.currentPlayer].rid +'.png'} style={{width: '205px'}}/>
                        </div>
                        <div style={{padding: '1rem'}}>
                            <div style={isMine? mineStyle : {opacity: .5, padding: '1rem'}}>
                                <h5>Primary:</h5>
                                <p>{cardData.strategy[sid].primary}</p>
                            </div>
                            <div style={!isMine? mineStyle : {opacity: .5, padding: '1rem'}}>
                                <h5>Secondary:</h5>
                                <p>{cardData.strategy[sid].secondary}</p>
                            </div>
                        </div>
                    </>}
                    {step === 1 && <div style={{display: 'flex', flexDirection: 'column', width: '100%'}}>
                        <p style={{fontSize: '.9rem', margin: 0}}>{isMine ? cardData.strategy[sid].primary : cardData.strategy[sid].secondary}</p>
                        {sid === 'LEADERSHIP' && <div style={{display: 'flex', flexDirection: 'row'}}>
                            <div style={{width: '60%', overflowY: 'auto', maxHeight: '30rem', margin: '1rem', padding: '1rem', borderRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                {<PlanetsRows PLANETS={PLANETS} onClick={planetRowClick} exhausted={ex}/>}
                            </div>
                            <div style={{width: '40%', padding: '2rem'}}>
                                <h5 style={{fontSize: '50px', display: 'flex', justifyContent: 'flex-end'}}>{'+'}{tg}{' '}<Button tag='img' onClick={tgClick} src='/icons/trade_good_1.png' color='warning' 
                                    style={{marginLeft: '1rem', width: '4rem', padding: '.5rem', borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} />
                                    <Button disabled={tg < 1} color='warning' style={{width: '1.5rem', borderLeft: 'none', color:'orange', backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: 0}} onClick={()=>setTg(tg-1)}>▼</Button></h5>
                                <h5 style={{display: 'flex', justifyContent: 'flex-end'}}>You gain:</h5>
                                <div style={{display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap'}}><Tokens count={result}/></div>
                            </div>
                        </div>}
                        
                    </div>}
                    {step === 2 && <div style={{width: '100%', display: 'flex', flexFlow: 'column'}}>
                        <h5>Awaiting other players:</h5>
                        {Object.keys(ctx.activePlayers).map((a,i) => {
                            return <h6 key={i}>{G.races[a].name}</h6>
                        })}
                    </div>
                    }
              </CardBody>
              {step < 2 && <CardFooter style={{background: 'none', border: 'none', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid ' + getStratColor(sid, '.6'),}}>
                  {step === 1 && <Button style={{marginRight: '1rem'}} onClick={()=>setStep(step-1)}>Back</Button>}
                  {step === 0 && <Button color='success' onClick={()=>setStep(step+1)}>Next</Button>}
                  {step === 1 && <Button color='success' onClick={()=>{ onComplete({exhausted: Object.keys(ex), tg, result}); setStep(step+1) }}>Done</Button>}
              </CardFooter>}
        </Card>
    );

    
  
}


export const PlanetsRows = ({PLANETS, onClick, exhausted}) => {
    if(!onClick) onClick = ()=>{};
    if(!exhausted) exhausted = {};

    return PLANETS.map((p,i) => {
      let trait;
      if(p.trait) trait = <img alt='trait' style={{width: '1.5rem'}} src={'icons/' + p.trait + '.png'}/>;
      let specialty;
      if(p.specialty) specialty = <img alt='specialty' style={{width: '1.5rem'}} src={'icons/' + p.specialty + '.png'}/>;
      
      return (<Row className='hoverable' onClick={()=>onClick(p.name)} key={i} style={{cursor: 'default', fontSize: '1.25rem', lineHeight: '2.2rem', height: '2.5rem', opacity: p.exhausted || exhausted[p.name] ? '.25':'1', color: 'white'}}>
                <Col xs='6'>{p.legendary ? <img alt='legendary' style={{width: '1.5rem'}} src={'icons/legendary_complete.png'}/>:'' } {p.name}</Col>
                <Col xs='1' style={{padding: 0}}>{specialty}</Col>
                <Col xs='1' style={{padding: 0}}>{trait}</Col>
                <Col xs='1' style={{background: 'url(icons/resources_bg.png)', backgroundRepeat: 'no-repeat', backgroundSize: 'contain'}}><b style={{paddingLeft: '0.1rem'}}>{p.resources}</b></Col>
                <Col xs='1'/>
                <Col xs='1' style={{background: 'url(icons/influence_bg.png)', backgroundRepeat: 'no-repeat', backgroundSize: 'contain'}}><b>{p.influence}</b></Col>
                <Col xs='1'/>
              </Row>)
    })
  }