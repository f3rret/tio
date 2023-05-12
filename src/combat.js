import { Card, CardBody, CardTitle, CardFooter, CardImg, Button, Container, Row, Col } from 'reactstrap'; 
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
                        if(ship.hit) result += ship.hit;
                        if(ship.payload && ship.payload.length){
                            ship.payload.forEach(p => {
                                if(p.hit){result+=p.hit}
                            });
                        }
                    });
                }
            });
        }

        return result;

    }, [ahits]);

    const isLastOnStage = useMemo(()=>{
        const myStage = ctx.activePlayers[playerID];
        const players = Object.keys(ctx.activePlayers).filter(s => ctx.activePlayers[s] === myStage);
        return players && players.length === 1;
    }, [playerID, ctx.activePlayers]);

    return (
    <Card style={{border: 'solid 1px rgba(119, 22, 31, 0.6)', minWidth: '30%', maxWidth: '60%', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
        position: 'absolute', margin: '5rem', color: 'white'}}>
        <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>Space cannon: attack</h3></CardTitle>
        <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
            {ctx.activePlayers[playerID] === 'spaceCannonAttack' && <>
                <CombatantForces race={G.races[ctx.currentPlayer]} units={fleet} owner={ctx.currentPlayer}/>
                {spaceCannons !== undefined && Object.keys(spaceCannons).map((k, i) => <CombatantForces key={i} race={G.races[k]} units={{PDS: spaceCannons[k]}} owner={k}/>)}
            </>}
            {ctx.activePlayers[playerID] === 'spaceCannonAttack_step2' && <>
                <HitAssign race={G.races[ctx.currentPlayer]} units={fleet} owner={ctx.currentPlayer} hits={ahits} setHits={setAhits}/>
            </>}
        </CardBody>
        <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
            {ctx.activePlayers[playerID] === 'spaceCannonAttack' && <>
                <Button color='warning' disabled= {playerID === ctx.currentPlayer && !isLastOnStage} onClick={moves.nextStep}>Next</Button>
                <span style={{fontFamily: 'Handel Gothic', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>{hits + ' hits '}</span>
            </>}
            {ctx.activePlayers[playerID] === 'spaceCannonAttack_step2' && <>
                <Button color='warning' disabled= {playerID === ctx.currentPlayer && assigned!==hits}  onClick={()=>moves.nextStep(ahits)}>Next</Button>
                <span style={{fontFamily: 'Handel Gothic', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>
                    {playerID === ctx.currentPlayer ? assigned + ' / ' + hits + ' hits assigned ': hits + ' hits '}
                </span>
            </>}
        </CardFooter>
    </Card>);

}

const HitAssign = (args) => {

    const { playerID } = useContext(StateContext);
    const {race, units, hits, setHits, owner} = args;
    
    const technologies = useMemo(()=>{
        const result = {};
    
        [...Object.keys(units), 'fighter', 'mech'].forEach( k => {
            const technology = race.technologies.find(t => t.id === k.toUpperCase());
            result[k] = technology;
        });

        return result;
    },[race.technologies, units]);

    const hitAssign = useCallback((tag, idx, pidx, payloadId) => {

        if(playerID !== owner) return;
        if(payloadId && payloadId !== 'fighter' && payloadId !== 'mech') return;

        setHits(produce(hits, draft => {
            if(!draft[tag]) draft[tag]=[];
            if(pidx === undefined){
                const dmg = draft[tag].findIndex(ship => ship.idx === idx);
                if(dmg === -1){
                    draft[tag].push({idx, payload:[], hit: 1});
                }
                else{
                    if(technologies[tag].sustain){
                        draft[tag][dmg].hit++;
                        if(draft[tag][dmg].hit > 2) draft[tag][dmg].hit = 0;
                    }
                    else{
                        draft[tag][dmg].hit = !draft[tag][dmg].hit;
                    }
                }
            }
            else{
                let carrier = draft[tag].find(ship => ship.idx === idx);
                if(!carrier){
                    draft[tag].push({idx, payload: [{pidx, hit: 1}]});
                }
                else{       
                    let index = carrier.payload.findIndex(p => p.pidx === pidx);
                    if(index === -1){
                        carrier.payload.push({pidx, hit: 1});
                    }
                    else{
                        if(technologies[payloadId].sustain){
                            carrier.payload[index].hit++;
                            if(carrier.payload[index].hit > 2) carrier.payload[index].hit = 0;
                        }
                        else{
                            carrier.payload[index].hit = !carrier.payload[index].hit;
                        }
                    }
                }
            }
        }));
    }, [hits, playerID, technologies, owner, setHits]);

    const haveHit = useCallback((tag, idx, pidx) => {
        if(playerID === owner){
            if(!hits[tag]) return false;

            const ship = hits[tag].find(ship => ship.idx === idx);
            if(!ship) return false;

            if(pidx === undefined){
                return ship.hit;
            }
            else{
                if(ship.payload){
                    const p = ship.payload.find(p => p.pidx === pidx);
                    if(p) return p.hit;
                }
            }
        }
        else{
            if(pidx === undefined){
                return units[tag][idx].hit;
            }
            else{
                if(units[tag][idx] && units[tag][idx].payload[pidx]){
                    return units[tag][idx].payload[pidx].hit;
                }
            }
        }
    }, [hits, playerID, owner, units]);

    return (
        <div style={{display: 'flex', flexDirection: 'row', margin: '1rem 0', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', border: 'solid 1px rgba(255,255,255,.25)'}}>
            <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto'}}/>
            <div style={{display: 'flex', flexWrap: 'wrap'}}>
                {Object.keys(units).map((u, i) => {
                    return <div key={i} style={{marginLeft: '1rem', display: 'flex', flexWrap: 'wrap'}}>
                        {units[u].map((t, j) =>{
                            let className=technologies[u].sustain ? 'sustain_ability':'';
                            className += ' hit_assigned' + haveHit(u, j);

                            return <div key={j} style={{margin: '0.25rem 1rem 0 0', display: 'flex', alignItems: 'flex-start'}}>
                                <div>
                                    <Button style={{width: '5rem', padding: 0, backgroundColor: '', border: 'none'}} 
                                        className={className} outline onClick={() => hitAssign(u, j)}>
                                        <img alt='unit' src={'units/' + u.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                    </Button>
                                </div>
                                <div style={{display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', maxWidth: '10rem'}}>
                                    {t.payload && t.payload.map((p, l) =>{
                                        let clName = technologies[p.id] && technologies[p.id].sustain ? 'sustain_ability':'';
                                        clName += ' hit_assigned' + haveHit(u, j, l);

                                        return <Button outline onClick={() => hitAssign(u, j, l, p.id)} key={l} className={clName}
                                            style={{width: '2rem', border: 'solid 1px rgba(255,255,255,.15)', margin: '.1rem', padding: 0}}>
                                            <img alt='unit' src={'units/' + p.id.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                        </Button>
                                    })}
                                </div>
                            </div>})}
                    </div>
                })}
            </div>
        </div>
    );

}

const CombatantForces = (args) => {

    const { G, moves, playerID } = useContext(StateContext);
    const {race, units, owner} = args;

    const technologies = useMemo(()=>{
        const result = {};
    
        [...Object.keys(units), 'fighter', 'mech', 'infantry'].forEach( k => {
            const technology = race.technologies.find(t => t.id === k.toUpperCase());
            result[k] = technology;
        });

        return result;
    },[race.technologies, units]);

    const fireClick = useCallback((u) => {
        const count = Array.isArray(units[u]) ? units[u].length : units[u];
        const shots = technologies[u].spaceCannon.count || 1;
        moves.rollDice(u, count*shots);        
    }, [moves, technologies, units]);


    return (
        <div style={{display: 'flex', flexDirection: 'row', margin: '1rem 0', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', border: 'solid 1px rgba(255,255,255,.25)'}}>
            <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto', marginTop: '-1.5rem', marginLeft: '-1.5rem'}}/>
            <Container>
                <Row className='row-cols-auto'>
                    {Object.keys(units).map((u, i) => {
                        const ucount = (Array.isArray(units[u]) ? units[u].length : units[u]);
                        return <Col className='col-md-auto' key={i} style={{marginLeft: '1rem', padding: 0, fontFamily: 'Handel Gothic', position: 'relative', flexGrow: 0, display: 'flex'}}>
                            <span className={technologies[u].sustain ? 'sustain_ability':''}>
                                <CardImg style={{width: '5rem'}} src={'units/' + u.toUpperCase() + '.png'} />
                                {ucount > 1 && <span style={{fontSize: 30, position: 'absolute'}}>{ucount}</span>}
                                {Array.isArray(units[u]) && <PayloadSummary ships={units[u]} technologies={technologies}/>}
                            </span>
                            <span style={{fontSize: 16, marginLeft: '1rem', minWidth: 'max-content'}}>
                                {technologies[u].spaceCannon && <>
                                    <p style={{margin: 0}}>{'combat: ' + technologies[u].spaceCannon.value}</p>
                                    <p style={{margin: 0}}>{'shots: ' + technologies[u].spaceCannon.count}</p>
                                </>}
                            </span>
                        </Col>
                    })}
                </Row>
                <Row>
                    {Object.keys(units).map((u, i) => {
                        return  <Col key={i} style={{fontSize: 15, margin: '0 1rem', fontFamily: 'Handel Gothic'}}>
                                    {!G.dice[owner][u] && technologies[u].spaceCannon && playerID === owner && 
                                        <Button size='sm' onClick={()=>fireClick(u)} color='danger' style={{width: '5rem'}}>Fire</Button>}
                                    {G.dice[owner][u] && G.dice[owner][u].map((d, j) =>{
                                        let color = 'light';
                                        if(d >= technologies[u].spaceCannon.value) color='success';
                                        return <Button key={j} size='sm' color={color} 
                                            style={{borderRadius: '5px', padding: 0, margin: '.25rem', fontSize: '12px', width: '1.25rem', height: '1.25rem'}}>
                                            {(''+d).substr(-1)}</Button>
                                        })
                                    }
                                </Col>
                    })}
                </Row>
            </Container>
        </div>
    );

}

const PayloadSummary = (args) => {

    let result = {};
    const { ships, technologies } = args;

    ships.forEach(ship => {
        if(ship.payload){
            ship.payload.forEach(p => {
                if(!result[p.id]) result[p.id] = 0;
                result[p.id]++;
            });
        }
    });

    return (<div style={{display: 'flex'}}>
        {Object.keys(result).map((r, i) => {
            return <span className={technologies[r].sustain ? 'sustain_ability':''} key={i} 
                    style={{width: '3rem', position: 'relative', border: 'solid 1px rgba(255,255,255,.15)', lineHeight: '1rem'}}>
                        <CardImg style={{}} src={'units/' + r.toUpperCase() + '.png'}/>
                        {result[r] > 1 && <span style={{fontSize: 15, position: 'absolute', right: '.25rem'}}>{result[r]}</span>}
                    </span>
        })}
    </div>)

}