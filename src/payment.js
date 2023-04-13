
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, ListGroup, ListGroupItem, Badge } from 'reactstrap';
import { useState, useMemo, useCallback } from 'react';
import { produce } from 'immer';

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
        <ModalBody>
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
                                <Badge color={k ==='influence' ? 'info': ( k === 'resources' ? 'warning' : 'secondary' )} 
                                        style={{cursor: (k ==='tg'?'pointer':'default'), fontSize: '1.25rem', marginBottom: '.5rem'}}
                                        onClick={(e)=> k ==='tg' && flushTg()}>
                                    {payment[k].planets && payment[k].planets.reduce((a,b) => b[k] + a, 0)}
                                    {!payment[k].planets && tg}
                                    {payment[k].tg > 0 && '+' + payment[k].tg}
                                    {' / '}{args.objective.req[k]}
                                </Badge>
                                {(k === 'influence' || k === 'resources') && 
                                <Button disabled={tg < 1} onClick={()=>payTg(k)} size='sm' style={{margin: '0 0 .5rem .5rem'}}>+</Button>}
                            </div>
                    }
                    )}
                </div>
            </div>
        </ModalBody>
        <ModalFooter>
            <Button color="primary" disabled = {!acceptable} onClick={(e) => args.toggle(e, payment)}>
                Confirm
            </Button>
        </ModalFooter>
        </Modal>
    );
}
