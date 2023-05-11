import { Card, CardBody, CardTitle, CardFooter, CardImg, Button, Row, Col } from 'reactstrap'; 
import { useContext, useMemo, useCallback, useState } from 'react';
import { StateContext } from './utils';
import { neighbors } from './Grid';
import { produce } from 'immer';

export const SpaceCombat = () => {

    const { G, ctx, playerID, moves } = useContext(StateContext);
    const activeTile = G.tiles.find(t => t.active === true);
    const [ahits, setAhits] = useState({});

    const spaceCannons = useMemo(() =>{
        let result = {};
        //enemy's pds at same tile
        if(activeTile.tdata.planets){
            activeTile.tdata.planets.forEach(p =>{ 
                if(p.occupied !== undefined && p.occupied !== ctx.currentPlayer && p.units && p.units.pds){
                    if(!result[p.occupied]) result[p.occupied] = 0;
                    result[p.occupied]++;
                }
            });
        }

        //cannon in adjacent systems
        const races = G.races.filter((r, i) => i !== ctx.currentPlayer && r.technologies.find(t => t.id === 'PDS').spaceCannon.range > 1).map(r => r.rid);

        if(races.length > 0){
            const neighs = neighbors([activeTile.q, activeTile.r]).toArray();
            neighs.forEach(n => {
                if(n.tdata.planets){
                n.tdata.planets.forEach(p =>{ 
                    if(races.indexOf(p.occupied) > -1 && p.units && p.units.pds){
                        if(!result[p.occupied]) result[p.occupied] = 0;
                        result[p.occupied]++;
                    }
                });
                }
            });
        }

        return result;
    }, [G.races, activeTile, ctx.currentPlayer]);

    let fleet;
    if((activeTile.tdata.occupied !== ctx.currentPlayer) && activeTile.tdata.attacker){
        fleet = activeTile.tdata.attacker;
    }
    else{
        fleet = activeTile.tdata.fleet;
    }

    const hits = useMemo(() => {
        let result = 0;

        if(spaceCannons !== undefined){
            Object.keys(spaceCannons).forEach(pid => {
                if(G.dice[pid]){
                    Object.keys(G.dice[pid]).forEach(unit => {
                        const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                        if(technology && technology.spaceCannon){
                            result += G.dice[pid][unit].filter(die => die >= technology.spaceCannon.value).length;
                        }
                    });
                }
            });
        }
        return result;
    }, [G.dice, G.races, spaceCannons]);

    const assigned = useMemo(() => {
        let result = 0;

        if(ahits){
            Object.keys(ahits).forEach(u => {
                if(ahits[u] && ahits[u].length){
                    ahits[u].forEach(ship => {
                        if(ship.hit === true) result++;
                        if(ship.payload && ship.payload.length){
                            result += ship.payload.filter(p => p.hit === true).length;
                        }
                    });
                }
            });
        }

        return result;

    }, [ahits]);

    return (
    <Card style={{border: 'solid 1px rgba(74, 111, 144, 0.42)', minWidth: '30%', maxWidth: '60%', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, .85)', position: 'absolute', margin: '5rem'}}>
        <CardTitle style={{ borderBottom: '1px solid red', color: 'black'}}><h3>Space cannon: attack</h3></CardTitle>
        <CardBody style={{display: 'flex', flexDirection: 'column', color: 'black' }}>
            {ctx.activePlayers[playerID] === 'spaceCannonAttack' && <>
                <CombatantForces race={G.races[ctx.currentPlayer]} units={fleet} owner={ctx.currentPlayer}/>
                {spaceCannons !== undefined && Object.keys(spaceCannons).map((k, i) => <CombatantForces key={i} race={G.races[k]} units={{PDS: spaceCannons[k]}} owner={k}/>)}
            </>}
            {ctx.activePlayers[playerID] === 'spaceCannonAttack_step2' && <>
                <HitAssign race={G.races[ctx.currentPlayer]} units={fleet} owner={ctx.currentPlayer} hits={ahits} setHits={setAhits}/>
            </>}
        </CardBody>
        <CardFooter style={{background: 'none', borderTop: '1px solid red', display: 'flex', flexDirection: 'row-reverse'}}>
            {ctx.activePlayers[playerID] === 'spaceCannonAttack' && <>
                <Button color='success' onClick={moves.nextStep}>Next</Button>
                <span style={{fontFamily: 'Handel Gothic', color: 'black', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>{hits + ' hits '}</span>
            </>}
            {ctx.activePlayers[playerID] === 'spaceCannonAttack_step2' && <>
                <Button color='success' disabled= {playerID === ctx.currentPlayer && assigned!==hits}  onClick={()=>moves.nextStep(ahits)}>Next</Button>
                <span style={{fontFamily: 'Handel Gothic', color: 'black', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>{assigned + ' / ' + hits + ' hits assigned '}</span>
            </>}
        </CardFooter>
    </Card>);

}

const HitAssign = (args) => {

    const { playerID } = useContext(StateContext);
    const {race, units, hits, setHits, owner} = args;
    const technologies = {};
    
    Object.keys(units).forEach( k => {
        const technology = race.technologies.find(t => t.id === k.toUpperCase());
        technologies[k] = technology;
    });

    const hitAssign = useCallback((tag, idx, pidx, payloadId) => {

        if(playerID !== owner) return;
        if(payloadId && payloadId !== 'fighter' && payloadId !== 'mech') return;

        setHits(produce(hits, draft => {
            if(!draft[tag]) draft[tag]=[];
            if(pidx === undefined){
                const dmg = draft[tag].findIndex(ship => ship.idx === idx);
                if(dmg === -1){
                    draft[tag].push({idx, payload:[], hit: true});
                }
                else{
                    draft[tag][dmg].hit = !draft[tag][dmg].hit;
                }
            }
            else{
                let carrier = draft[tag].find(ship => ship.idx === idx);
                if(!carrier){
                    draft[tag].push({idx, payload: [{pidx, hit: true}]});
                }
                else{       
                    let index = carrier.payload.findIndex(p => p.pidx === pidx);
                    if(index === -1){
                        carrier.payload.push({pidx, hit: true});
                    }
                    else{
                        carrier.payload[index].hit = !carrier.payload[index].hit;
                    }
                }
            }
        }));
    }, [hits, playerID, owner, setHits]);

    const haveHit = useCallback((tag, idx, pidx) => {
        if(playerID === owner){
            if(!hits[tag]) return false;

            const ship = hits[tag].find(ship => ship.idx === idx);
            if(!ship) return false;

            if(pidx === undefined){
                return ship.hit === true;
            }
            else{
                return ship.payload && ship.payload.findIndex(p => p.pidx === pidx && p.hit === true) > -1;
            }
        }
        else{
            if(pidx === undefined){
                return units[tag][idx].hit === true;
            }
            else{
                return units[tag][idx] && units[tag][idx].payload[pidx] && units[tag][idx].payload[pidx].hit === true;
            }
        }
    }, [hits, playerID, owner, units]);

    return (
        <div style={{display: 'flex', flexDirection: 'row'}}>
            <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto'}}/>
            <div>
                {Object.keys(units).map((u, i) => {
                    return <div key={i} style={{marginLeft: '1rem', display: 'flex', flexWrap: 'wrap'}}>
                        {units[u].map((t, j) =>
                            <div key={j} style={{margin: '0.25rem 1rem 0 0', display: 'flex', alignItems: 'flex-start'}}>
                                <Button tag='img' outline onClick={() => hitAssign(u, j)}
                                    style={{width: '5rem', padding: 0, backgroundColor: haveHit(u, j) ? 'coral': '', border: 'solid 1px rgba(0,0,0,.1)'}} src={'units/' + u.toUpperCase() + '.png'} />
                                <div style={{display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', maxWidth: '10rem'}}>
                                    {t.payload && t.payload.map((p, l) => 
                                        <Button tag='img' outline onClick={() => hitAssign(u, j, l, p.id)} key={l} 
                                            style={{width: '2rem', backgroundColor: haveHit(u, j, l) ? 'coral': '', border: 'solid 1px rgba(0,0,0,.1)', margin: '.1rem', padding: 0}} src={'units/' + p.id.toUpperCase() + '.png'} />
                                    )}
                                </div>
                            </div>)}
                    </div>
                })}
            </div>
        </div>
    );

}

const CombatantForces = (args) => {

    const { G, moves, playerID } = useContext(StateContext);
    const {race, units, owner} = args;
    const technologies = {};

    Object.keys(units).forEach( k => {
        const technology = race.technologies.find(t => t.id === k.toUpperCase());
        technologies[k] = technology;
    });

    const fireClick = (u) => {
        const count = Array.isArray(units[u]) ? units[u].length : units[u];
        moves.rollDice(u, count);        
    }


    return (
        <div style={{display: 'flex', flexDirection: 'row', margin: '1rem 0'}}>
            <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto'}}/>
            <div>
                <Row>
                    {Object.keys(units).map((u, i) => {
                        return <Col key={i} style={{fontSize: 30, margin: '0 1rem', fontFamily: 'Handel Gothic'}}>
                            <CardImg style={{width: '5rem', border: 'solid 1px gray', borderBottom:'none', borderRadius: '5px 5px 0 0'}} src={'units/' + u.toUpperCase() + '.png'} />
                            {' x ' + (Array.isArray(units[u]) ? units[u].length : units[u])}
                        </Col>
                    })}
                </Row>
                <Row>
                    {Object.keys(units).map((u, i) => {
                        return <Col key={i} style={{fontSize: 15, margin: '0 1rem', fontFamily: 'Handel Gothic'}}>
                            <Button size='sm' onClick={()=>fireClick(u)} 
                                disabled={!technologies[u].spaceCannon || playerID !== owner} color='danger' style={{width: '5rem'}}>Fire</Button>
                            </Col>
                    })}
                </Row>
                <Row>
                    {Object.keys(units).map((u, i) => {
                        return <Col key={i} style={{fontSize: 12, margin: '0 1rem', fontFamily: 'Handel Gothic'}}>
                            {technologies[u].spaceCannon && <>
                                <p style={{margin: 0}}>{'combat: ' + technologies[u].spaceCannon.value}</p>
                                <p style={{margin: 0}}>{'shots: ' + technologies[u].spaceCannon.count}</p>
                            </>}
                            {technologies[u].sustain && <>
                                <p style={{margin: 0}}>{'sustain damage'}</p>
                            </>}
                            </Col>
                    })}
                </Row>
                <Row>
                    {Object.keys(units).map((u, i) => {
                        return <Col key={i} style={{margin: '0 1rem', flexWrap:'wrap', fontFamily: 'Handel Gothic'}}>
                            {G.dice[playerID][u] && G.dice[playerID][u].map((d, j) =>{
                                let color = 'dark';
                                if(d >= technologies[u].spaceCannon.value) color='success';
                                return <Button key={j} size='sm' color={color} style={{borderRadius: '5px', padding: 0, fontSize: '12px', width: '1.25rem', height: '1.25rem'}}>{(''+d).substr(-1)}</Button>
                                })
                            }
                            </Col>
                    })}
                </Row>
            </div>
        </div>
    );

}