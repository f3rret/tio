import { Card, CardBody, CardTitle, CardFooter, CardText, CardImg, Button, ButtonGroup, Container, Row, Col,
UncontrolledDropdown, DropdownMenu, DropdownItem, DropdownToggle } from 'reactstrap'; 
import { useContext, useMemo, useCallback, useState, useEffect } from 'react';
import { StateContext, getUnitsTechnologies, haveTechnology } from './utils';
import { neighbors } from './Grid';
import { produce } from 'immer';

export const SpaceCannonAttack = () => {

    const { G, ctx, playerID, moves } = useContext(StateContext);
    const activeTile = G.tiles.find(t => t.active === true);
    
    const spaceCannons = useMemo(() =>{
        let result = {};
        //enemy's pds at same tile
        if(activeTile.tdata.planets){
            activeTile.tdata.planets.forEach(p =>{ 
                if(p.occupied !== undefined && p.occupied !== ctx.currentPlayer && p.units && p.units.pds){
                    if(!result[p.occupied]) result[p.occupied] = [];
                    result[p.occupied] = result[p.occupied].concat(p.units.pds);
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
                        if(!result[p.occupied]) result[p.occupied] = [];
                        result[p.occupied] = result[p.occupied].concat(p.units.pds);
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

    const [ahits, setAhits] = useState({});

    const hits = useMemo(() => {
        let result = 0;

        if(spaceCannons !== undefined){
            const adj = haveTechnology(G.races[ctx.currentPlayer], 'ANTIMASS_DEFLECTORS') ? -1:0;
            Object.keys(spaceCannons).forEach(pid => {
                if(G.dice[pid]){
                    Object.keys(G.dice[pid]).forEach(unit => {
                        const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                        if(technology && technology.spaceCannon){
                            result += G.dice[pid][unit].filter(die => die+adj >= technology.spaceCannon.value).length;
                        }
                    });
                }
            });
        }
        return result;
    }, [G.dice, G.races, spaceCannons, ctx.currentPlayer]);

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

    const maxHits = useMemo(() => {
        let result = 0;
        let fleet = activeTile.tdata.attacker || activeTile.tdata.fleet;
        const technologies = getUnitsTechnologies([...Object.keys(fleet), 'fighter'], G.races[ctx.currentPlayer]);

        Object.keys(fleet).forEach(tag => {
            fleet[tag].forEach(car => {
                result += 1;
                if(technologies[tag] && technologies[tag].sustain){
                    result += 1;
                }
                if(car.hit) result -= car.hit;

                if(car.payload){
                    car.payload.forEach(p => {
                        if(p && p.id === 'fighter'){
                            result += 1;
                            if(technologies[p.id] && technologies[p.id].sustain){
                                result += 1;
                            }
                            if(p.hit) result -= p.hit;
                        }
                    })
                }
            });
        });


        return result;
    }, [G.races, activeTile.tdata, ctx.currentPlayer]);

    const allHitsAssigned = useMemo(() => {

        return !hits || (assigned === Math.min(hits, maxHits));

    }, [assigned, hits, maxHits]);

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
                <CombatantForces race={G.races[ctx.currentPlayer]} units={fleet} owner={ctx.currentPlayer} combatAbility='spaceCannon'/>
                {spaceCannons !== undefined && Object.keys(spaceCannons).map((k, i) => 
                    <CombatantForces key={i} race={G.races[k]} combatAbility='spaceCannon' units={{pds: spaceCannons[k]}} owner={k}/>)}
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
                <Button color='warning' disabled= {playerID === ctx.currentPlayer && !allHitsAssigned}  onClick={()=>moves.nextStep(ahits)}>Next</Button>
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
        return getUnitsTechnologies([...Object.keys(units), 'fighter', 'mech'], race);
    },[race, units]);

    const hitAssign = useCallback((tag, idx, pidx, payloadId) => {

        if(String(playerID) !== String(owner)) return;
        if(payloadId && payloadId !== 'fighter' && payloadId !== 'mech') return;

        setHits(produce(hits, draft => {
            if(!draft[tag]) draft[tag]=[];
            if(pidx === undefined){
                const dmg = draft[tag].findIndex(ship => ship.idx === idx);
                if(dmg === -1){
                    draft[tag].push({idx, payload:[], hit: 1});
                }
                else{
                    if(technologies[tag].sustain && !units[tag][dmg].hit){
                        draft[tag][dmg].hit++;
                        if(draft[tag][dmg].hit > 2) draft[tag][dmg].hit = 0;
                    }
                    else{
                        draft[tag][dmg].hit = !draft[tag][dmg].hit;
                    }
                }
            }
            else{
                const dmg = draft[tag].findIndex(ship => ship.idx === idx);
                let carrier = draft[tag][dmg];
                if(!carrier){
                    draft[tag].push({idx, payload: [{pidx, id: payloadId, hit: 1}]});
                }
                else{       
                    let index = carrier.payload.findIndex(p => p.pidx === pidx);
                    if(index === -1){
                        carrier.payload.push({pidx, id: payloadId, hit: 1});
                    }
                    else{
                        if(technologies[payloadId].sustain && !units[tag][dmg].payload[index].hit){
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
    }, [hits, playerID, technologies, owner, setHits, units]);

    const haveHit = useCallback((tag, idx, pidx) => {

        let result = 0;

        if(pidx === undefined){
            result = (units[tag][idx].hit || 0);
        }
        else{
            if(units[tag][idx] && units[tag][idx].payload[pidx]){
                result = (units[tag][idx].payload[pidx].hit || 0);
            }
        }

        if(playerID === owner){
            if(hits[tag]){
                const ship = hits[tag].find(ship => ship.idx === idx);
                if(ship){
                    if(pidx === undefined){
                        result += (ship.hit || 0);
                    }
                    else{
                        if(ship.payload){
                            const p = ship.payload.find(p => p.pidx === pidx);
                            if(p) return result += (p.hit || 0);
                        }
                    }
                }
            }
        }

        return result;

    }, [hits, playerID, owner, units]);

    return (
        <div style={{display: 'flex', position: 'relative', flexDirection: 'row', margin: '1rem 0', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
            border: String(playerID) === String(owner) ? 'solid 1px rgba(255,255,0,.5)':'solid 1px rgba(255,255,255,.25)'}}>
            <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto', marginTop: '-1.5rem', marginLeft: '-1.5rem'}}/>
            {race.retreat && <CardText style={{position: 'absolute', left: '0.25rem', top: '3rem', background: 'darkslateblue', padding: '.5rem', fontFamily: 'Handel Gothic'}}>RETREAT</CardText>}
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
                                        if(p){
                                            let clName = technologies[p.id] && technologies[p.id].sustain ? 'sustain_ability':'';
                                            clName += ' hit_assigned' + haveHit(u, j, l);

                                            return <Button outline onClick={() => hitAssign(u, j, l, p.id)} key={l} className={clName}
                                                style={{width: '2rem', border: 'solid 1px rgba(255,255,255,.15)', margin: '.1rem', padding: 0}}>
                                                <img alt='unit' src={'units/' + p.id.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                            </Button>
                                        }
                                        return <></>
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

    const { G, moves, playerID, ctx } = useContext(StateContext);
    const {race, units: fleet, owner, combatAbility, isInvasion} = args;
    const [plasmaScoringUsed, setPlasmaScoringUsed] = useState(false);

    const units = useMemo(()=> {
        let payload = {
            fighter: [], mech: [], infantry: []
        };

        Object.keys(fleet).forEach(unit => {
            fleet[unit].forEach( car =>{
                if(car.payload && car.payload.length){
                    car.payload.forEach(p => {
                        if(p && payload[p.id]) payload[p.id].push(p);
                    })
                }
            })
        });

        Object.keys(payload).forEach(k => {
            if(payload[k].length === 0) delete payload[k];
        })

        return {...fleet, ...payload}
    }, [fleet])

    const technologies = useMemo(()=>{
        return getUnitsTechnologies([...Object.keys(units), 'fighter', 'mech', 'infantry'], race);
    },[race, units]);

    const fireClick = useCallback((u, withTech) => {
        const count = Array.isArray(units[u]) ? units[u].length : units[u];
        let shots = (combatAbility ? technologies[u][combatAbility].count : u === 'pds' ? technologies[u]['spaceCannon'].count: technologies[u].shot) || 1;
        if(withTech === 'PLASMA_SCORING') shots++; 
        moves.rollDice(u, count*shots);
        setPlasmaScoringUsed(true);        
    }, [moves, technologies, units, combatAbility]);

    const unitsInjury = useCallback((tag) => {

        let result = 0;
        if(units[tag] && Array.isArray(units[tag])){
            units[tag].forEach(u => {if(u.hit)result += u.hit})
        }
        return result;

    }, [units]);

    const dropdown = useMemo(() =>{
        return (combatAbility === 'bombardment' || combatAbility === 'spaceCannon') && (haveTechnology(race, 'PLASMA_SCORING') && !plasmaScoringUsed)
    }, [race, plasmaScoringUsed, combatAbility]);

    return (
        <div style={{display: 'flex', position: 'relative', flexDirection: 'row', margin: '1rem 0', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
            border: String(playerID) === String(owner) ? 'solid 1px rgba(255,255,0,.5)':'solid 1px rgba(255,255,255,.25)'}}>
            <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto', marginTop: '-1.5rem', marginLeft: '-1.5rem'}}/>
            {race.retreat && <CardText style={{position: 'absolute', left: '0.25rem', top: '3rem', background: 'darkslateblue', padding: '.5rem', fontFamily: 'Handel Gothic'}}>RETREAT</CardText>}
            <Container>
                <Row className='row-cols-auto'>
                    {Object.keys(units).map((u, i) => {
                        const ucount = (Array.isArray(units[u]) ? units[u].length : units[u]);
                        let style = {marginLeft: '1rem', padding: 0, fontFamily: 'Handel Gothic', position: 'relative', flexGrow: 0, display: 'flex'};
                        const deflt = {value: technologies[u].combat, count: technologies[u].shot || 1};
                        const ability = isInvasion ? (u === 'pds' ? technologies[u]['spaceCannon']: deflt):
                                        ['infantry', 'mech'].indexOf(u) === -1 ? 
                                            combatAbility ? technologies[u][combatAbility] : deflt 
                                            : null;
                        
                        if(ability){
                            style = {...style, padding: '.5rem', background: 'rgba(255,255,255,.15)'}
                        }

                        const className = technologies[u].sustain ? 'sustain_ability':'';
                        const injury = unitsInjury(u);
                        let adj = 0;
                        if(combatAbility === 'spaceCannon' || u === 'pds'){
                            const enemyId = ctx.currentPlayer; //pds shots only for this player
                            if(haveTechnology(G.races[enemyId], 'ANTIMASS_DEFLECTORS')){
                                adj = -1;
                            }
                        }
                        
                        return <Col className='col-md-auto' key={i} style={style}>
                            <span className={className} style={{position: 'relative'}}>
                                {injury > 0 && <span className='hit_assigned1' style={{position: 'absolute', bottom: 0, color: 'red', width: '1.75rem', textAlign: 'right'}}>{injury}</span>}
                                <CardImg style={{width: '5rem'}} src={'units/' + u.toUpperCase() + '.png'} />
                                {ucount > 1 && <span style={{fontSize: 30, position: 'absolute', right: 0, bottom: 0, textShadow: '-2px 2px 3px black'}}>{ucount}</span>}
                            </span>
                            <span style={{fontSize: 16, marginLeft: '1rem', minWidth: 'max-content'}}>
                                {ability && <>
                                    <p style={{margin: 0}}>{'combat: ' + ability.value} 
                                        {adj !==0 ? <span style={{color: adj<0 ? 'red':'green'}}>
                                            {' (' + (ability.value - adj) + ')'}
                                        </span> : ''}
                                    </p>
                                    <p style={{margin: 0}}>{'shots: ' + ability.count}</p>
                                </>}
                                
                                {!G.dice[owner][u] && ability && String(playerID) === String(owner) &&
                                        <UncontrolledDropdown group> 
                                            <Button size='sm' onClick={()=>fireClick(u)} color='danger' style={{width: '5rem'}}>Fire</Button>
                                            {dropdown && <><DropdownToggle caret color='danger' style={{padding: '0.25rem 0.5rem 0 0.25rem'}}/>
                                            <DropdownMenu>
                                                <DropdownItem onClick={()=>fireClick(u, 'PLASMA_SCORING')}>
                                                    <img alt='warfare' src='icons/warfare.png' style={{width: '1rem', marginRight: '.5rem'}}/>Plasma scoring
                                                </DropdownItem>
                                            </DropdownMenu></>}
                                        </UncontrolledDropdown>}
                                {G.dice[owner][u] && <ButtonGroup style={{flexWrap: 'wrap', maxWidth: '6rem'}}>
                                    {G.dice[owner][u].map((d, j) =>{
                                        let color = 'light';
                                        if(d+adj >= ability.value) color='success';
                                        return <Button key={j} size='sm' color={color} 
                                            style={{borderRadius: '5px', padding: 0, margin: '.25rem', fontSize: '12px', width: '1.25rem', maxWidth:'1.25rem', height: '1.25rem'}}>
                                            {(''+d).substr(-1)}</Button>
                                    })}
                                    </ButtonGroup>
                                }
                            </span>
                        </Col>
                    })}
                </Row>
            </Container>
        </div>
    );

}

export const AntiFighterBarrage = () => {

    const { G, ctx, moves, playerID } = useContext(StateContext);
    const activeTile = G.tiles.find(t => t.active === true);

    const hits = useMemo(() => {
        let result = {};

        Object.keys(ctx.activePlayers).forEach(pid => {
            let h = 0;
            if(G.dice[pid]){
                Object.keys(G.dice[pid]).forEach(unit => {
                    const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                    if(technology && technology.barrage){
                        h += G.dice[pid][unit].filter(die => die >= technology.barrage.value).length;
                    }
                });
            }
            result[pid] = h;
        });
        
        return result;
    }, [G.dice, G.races, ctx.activePlayers]);

    const barrageAbilities = useCallback((race, units)=>{
        const result = {};
    
        Object.keys(units).forEach( k => {
            const technology = race.technologies.find(t => t.id === k.toUpperCase() && t.barrage);
            if(technology) result[k] = technology;
        });

        return result;
    },[]);

    const everyoneRolls = useMemo(() => {

        const attacker = barrageAbilities(G.races[ctx.currentPlayer], activeTile.tdata.attacker);
        const defender = barrageAbilities(G.races[activeTile.tdata.occupied], activeTile.tdata.fleet);

        return Object.keys(attacker).length === Object.keys(G.dice[ctx.currentPlayer]).length && 
                Object.keys(defender).length === Object.keys(G.dice[activeTile.tdata.occupied]).length;

    }, [G.dice, G.races, activeTile, barrageAbilities, ctx.currentPlayer]);

    /*const isLastOnStage = useMemo(()=>{
        const myStage = ctx.activePlayers[playerID];
        const players = Object.keys(ctx.activePlayers).filter(s => ctx.activePlayers[s] === myStage);
        return players && players.length === 1;
    }, [playerID, ctx.activePlayers]);*/

    const enemyRetreat = useMemo(() => {
        const enemyID = Object.keys(ctx.activePlayers).find(pid => String(pid) !== String(playerID));
        if(enemyID){
            return G.races[enemyID].retreat;
        }
    }, [playerID, ctx.activePlayers, G.races]);

    return (
    <Card style={{border: 'solid 1px rgba(119, 22, 31, 0.6)', minWidth: '30%', maxWidth: '60%', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
        position: 'absolute', margin: '5rem', color: 'white'}}>
        <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>Antifighter barrage</h3></CardTitle>
        <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
            <CombatantForces race={G.races[ctx.currentPlayer]} units={activeTile.tdata.attacker} owner={ctx.currentPlayer} combatAbility='barrage'/>
            <CombatantForces race={G.races[activeTile.tdata.occupied]} units={activeTile.tdata.fleet} owner={activeTile.tdata.occupied} combatAbility='barrage'/>
        </CardBody>
        <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
            <Button color='warning' disabled = {!everyoneRolls} onClick={moves.nextStep}>Next</Button>
            <span style={{display: 'flex', justifyContent: 'space-around', fontFamily: 'Handel Gothic', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>
                {Object.keys(hits).map((h, i) => {
                    return <span key={i}>
                        <img alt='race' src={'race/icons/' + G.races[h].rid + '.png'} style={{width: '2rem'}}/>
                        {' does ' + hits[h] + ' hits '}
                    </span>
                })}
            </span>
            <Button color='danger' disabled = {everyoneRolls || enemyRetreat} onClick={()=>moves.nextStep(true)}>Retreat</Button>
        </CardFooter>
    </Card>);

}

export const SpaceCombat = () => {

    const { G, ctx, moves, playerID } = useContext(StateContext);
    const activeTile = G.tiles.find(t => t.active === true);
    const [ahitsA, setAhitsA] = useState({});
    const [ahitsD, setAhitsD] = useState({});

    const hits = useMemo(() => {
        let result = {};

        Object.keys(ctx.activePlayers).forEach(pid => {
            let h = 0;
            if(G.dice[pid]){
                Object.keys(G.dice[pid]).forEach(unit => {
                    const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                    
                    if(technology && technology.combat){
                        h += G.dice[pid][unit].filter(die => die >= technology.combat).length;
                    }
                });
            }
            result[pid] = h;
        });

        return result;
    }, [G.dice, G.races, ctx.activePlayers]);

    const assignedA = useMemo(() => {
        let result = 0;

        if(ahitsA){
            Object.keys(ahitsA).forEach(u => {
                if(ahitsA[u] && ahitsA[u].length){
                    ahitsA[u].forEach(ship => {
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

    }, [ahitsA]);

    const assignedD = useMemo(() => {
        let result = 0;

        if(ahitsD){
            Object.keys(ahitsD).forEach(u => {
                if(ahitsD[u] && ahitsD[u].length){
                    ahitsD[u].forEach(ship => {
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

    }, [ahitsD]);

    const everyoneRolls = useMemo(() => {
        if(!activeTile.tdata.attacker || !G.dice[ctx.currentPlayer] || !activeTile.tdata.fleet || !G.dice[activeTile.tdata.occupied]){
            return true;
        }

        return Object.keys(activeTile.tdata.attacker).length <= Object.keys(G.dice[ctx.currentPlayer]).length && 
                Object.keys(activeTile.tdata.fleet).length <= Object.keys(G.dice[activeTile.tdata.occupied]).length;

    }, [G.dice, ctx.currentPlayer, activeTile]);

    const needAwait = useMemo(()=>{
        const myStage = ctx.activePlayers[playerID];
        if(myStage === 'spaceCombat_await') return true;
    }, [playerID, ctx.activePlayers]);

    const anyoneRetreat = useMemo(() => {
        let retreater = undefined;

        Object.keys(ctx.activePlayers).find(pid => {
            retreater = G.races[pid].retreat ? pid : undefined;
            return retreater !== undefined;
        });
        
        return retreater;
    }, [ctx.activePlayers, G.races]);

    const maxHits = useMemo(() => {
        let result = {};

        Object.keys(ctx.activePlayers).forEach(pid => {
            let fleet = (String(pid) === String(ctx.currentPlayer)) ? activeTile.tdata.attacker : activeTile.tdata.fleet;
            const technologies = getUnitsTechnologies([...Object.keys(fleet), 'fighter'], G.races[pid]);
            result[pid] = 0;

            Object.keys(fleet).forEach(tag => {
                fleet[tag].forEach(car => {
                    result[pid] += 1;
                    if(technologies[tag] && technologies[tag].sustain){
                        result[pid] += 1;
                    }
                    if(car.hit) result[pid] -= car.hit;

                    if(car.payload){
                        car.payload.forEach(p => {
                            if(p && p.id === 'fighter'){
                                result[pid] += 1;
                                if(technologies[p.id] && technologies[p.id].sustain){
                                    result[pid] += 1;
                                }
                                if(p.hit) result[pid] -= p.hit;
                            }
                        })
                    }
                });
            });
        });

        return result;
    }, [G.races, activeTile.tdata, ctx.activePlayers, ctx.currentPlayer]);

    const allHitsAssigned = useMemo(() => {

        if(playerID === ctx.currentPlayer){
            return !hits[activeTile.tdata.occupied] || (assignedA === Math.min(hits[activeTile.tdata.occupied], maxHits[ctx.currentPlayer]));
        }
        else{
            return !hits[ctx.currentPlayer] || (assignedD === Math.min(hits[ctx.currentPlayer], maxHits[activeTile.tdata.occupied]));
        }

    }, [assignedA, assignedD, playerID, ctx.currentPlayer, hits, activeTile, maxHits]);

    const HitsInfo = () => {
        return  <span style={{display: 'flex', justifyContent: 'space-around', fontFamily: 'Handel Gothic', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>
                    {Object.keys(hits).map((h, i) => {
                        return <span key={i}>
                            <img alt='race' src={'race/icons/' + G.races[h].rid + '.png'} style={{width: '2rem'}}/>
                            {' does ' + hits[h] + ' hits '}
                        </span>
                    })}
                </span>
    }

    const winner = useMemo(() => {
        const attacker = activeTile.tdata.attacker;
        const defenser = activeTile.tdata.fleet;

        if(!(attacker && Object.keys(attacker).length)){
            return activeTile.tdata.occupied;
        } 
        else if(!(defenser && Object.keys(defenser).length)){
            return ctx.currentPlayer;
        }

        return undefined;
    }, [activeTile.tdata, ctx.currentPlayer]);

    useEffect(()=>{
        if(ahitsA && Object.keys(ahitsA).length > 0){
            setAhitsA({});
        }
    // eslint-disable-next-line
    }, [activeTile.tdata.attacker]);

    useEffect(()=>{
        if(ahitsD && Object.keys(ahitsD).length > 0){
            setAhitsD({});
        }
    // eslint-disable-next-line
    }, [activeTile.tdata.fleet]);

    return (
    <Card style={{border: 'solid 1px rgba(119, 22, 31, 0.6)', minWidth: '30%', maxWidth: '60%', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
        position: 'absolute', margin: '5rem', color: 'white'}}>
        <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>Space combat</h3></CardTitle>
        <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
            {(ctx.activePlayers[playerID] === 'spaceCombat' || ctx.activePlayers[playerID] === 'spaceCombat_await') && <>
                {!needAwait && <>
                    <CombatantForces race={G.races[ctx.currentPlayer]} units={activeTile.tdata.attacker} owner={ctx.currentPlayer} />
                    <CombatantForces race={G.races[activeTile.tdata.occupied]} units={activeTile.tdata.fleet} owner={activeTile.tdata.occupied}/>
                </>}
                {needAwait && <>
                    {winner === undefined && <h5 style={{margin: '5rem', textAlign: 'center'}}>Awaiting opponent...</h5>}
                    {winner !== undefined && <>
                        {String(winner) === String(playerID) && <h5 style={{margin: '5rem', textAlign: 'center', color: 'yellowgreen'}}>Enemy's fleet was defeated!</h5>}
                        {String(winner) !== String(playerID) && <h5 style={{margin: '5rem', textAlign: 'center', color: 'red'}}>Your fleet was defeated.</h5>}
                    </>}
                </>}
            </>}
            {ctx.activePlayers[playerID] === 'spaceCombat_step2' && <>
                <HitAssign race={G.races[ctx.currentPlayer]} units={activeTile.tdata.attacker} owner={ctx.currentPlayer} hits={ahitsA} setHits={setAhitsA}/>
                <HitAssign race={G.races[activeTile.tdata.occupied]} units={activeTile.tdata.fleet} owner={String(activeTile.tdata.occupied)} hits={ahitsD} setHits={setAhitsD}/>
            </>}
        </CardBody>
        {(!needAwait || winner !== undefined) && <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
            {needAwait && winner !== undefined && <Button color='warning' onClick={() => moves.endBattle()}>Next</Button>}
            {ctx.activePlayers[playerID] === 'spaceCombat' && <>
                <Button color='warning' disabled = {!everyoneRolls} onClick={() => moves.nextStep(hits)}>Next</Button>
                <HitsInfo />
                <Button color='danger' disabled = {everyoneRolls || (anyoneRetreat !== undefined)} onClick={()=>moves.retreat()}>Retreat</Button>
            </>}
            {ctx.activePlayers[playerID] === 'spaceCombat_step2' && <>
                <Button color='warning' disabled = {!allHitsAssigned} onClick={() => moves.nextStep(playerID === ctx.currentPlayer ? ahitsA:ahitsD)}>Next</Button>
                <HitsInfo />
            </>}
        </CardFooter>}
    </Card>);

}

export const CombatRetreat = (args) => {
    const { G, moves, playerID, ctx } = useContext(StateContext);
    const { selectedTile } = args;
    const activeTile = useMemo(()=> G.tiles.find(t => t.active === true), [G.tiles]);
    const race = useMemo(()=> G.races[playerID], [G.races, playerID]);
    const fleet = useMemo(() => playerID === ctx.currentPlayer ? activeTile.tdata.attacker:activeTile.tdata.fleet,[activeTile, playerID, ctx.currentPlayer]);
    const [escFleet, setEscFleet] = useState({});
    const [escGround, setEscGround] = useState({});

    const possibleTiles = useMemo(() => {
        const neighs = neighbors([activeTile.q, activeTile.r]).toArray();

        return neighs.filter(n => {
            const tile = G.tiles.find(t => t.tid === n.tileId);

            if(tile && tile.tdata){
                if(tile.tdata.occupied !== undefined){
                    return String(tile.tdata.occupied) === String(playerID);
                }
                else if(haveTechnology(G.races[playerID], 'DARK_ENERGY_TAP')){
                    return true;
                }
                if(tile.tdata.planets){
                    for(var i=0; i<tile.tdata.planets.length; i++){
                        if(String(tile.tdata.planets[i].occupied) === String(playerID)){
                            return true
                        }
                    }
                }
            }

            return false;
        });
    }, [activeTile, playerID, G.tiles, G.races]);

    const acceptableTile = useMemo(() => {
        return possibleTiles && selectedTile > -1 && possibleTiles.find(t => t.tileId === G.tiles[selectedTile].tid);
    }, [possibleTiles, selectedTile, G.tiles]);

    const technologies = useMemo(()=>{
        return getUnitsTechnologies([...Object.keys(fleet), 'fighter', 'mech'], race);
    },[race, fleet]);

    const haveHit = useCallback((tag, idx, pidx) => {

        let result = 0;

        if(pidx === undefined){
            result = (fleet[tag][idx].hit || 0);
        }
        else{
            if(fleet[tag][idx] && fleet[tag][idx].payload[pidx]){
                result = (fleet[tag][idx].payload[pidx].hit || 0);
            }
        }

        return result;

    }, [fleet]);

    const groundForces = useMemo(()=>{
        const result = [];

        if(activeTile.tdata.planets){
            activeTile.tdata.planets.forEach(p => {
                if(String(p.occupied) === String(playerID)){
                    const forces = {fighter:[], mech: [], infantry: []};

                    Object.keys(p.units).forEach(u => {
                        if(forces[u]) forces[u] = forces[u].concat(p.units[u]);
                    });

                    Object.keys(forces).forEach( k => {
                        if(!forces[k].length) delete forces[k];
                    });

                    if(forces && Object.keys(forces).length){
                        result.push({pname: p.name, units: forces});
                    }
                }
            });
        }        

        return result;
    }, [activeTile.tdata, playerID]);

    const freePayload = useMemo(() => {
        let free = 0;
        Object.keys(escFleet).forEach(tag => {
            if(technologies[tag] && technologies[tag].capacity){
                escFleet[tag].forEach(idx => {
                    let payload = 0;
                    if(fleet[tag][idx]){
                        if(fleet[tag][idx].payload) payload = fleet[tag][idx].payload.length;
                    }
                    free += (technologies[tag].capacity - payload);
                });
            }
        });

        let loaded = 0;
        Object.keys(escGround).forEach(tag => {
            loaded += escGround[tag].length;
        });

        return free - loaded;
    }, [fleet, technologies, escFleet, escGround])

    const fleetClick = useCallback((tag, idx) => {
        setEscFleet(produce(escFleet, draft => {
            if(!draft[tag]) draft[tag]=[];
            const index = draft[tag].indexOf(idx);
            if(index === -1){
                draft[tag].push(idx);
            }
            else{
                draft[tag].splice(index, 1);
                if(!draft[tag].length) delete draft[tag];
            }
        }))
    }, [escFleet]);

    const groundClick = useCallback((planet, tag, idx) => {
        setEscGround(produce(escGround, draft => {
            if(!draft[tag]) draft[tag]=[];
            const index = draft[tag].findIndex(u => u.pname === planet.pname && u.idx === idx);
            if(index === -1){
                if(freePayload > 0) draft[tag].push({idx, pname: planet.pname});
            }
            else{
                draft[tag].splice(index, 1);
            }
        }))
    }, [escGround, freePayload]);

    useEffect(()=>{
        if(freePayload < 0){
            setEscGround({});
        }
    }, [freePayload]);

    return (
        <Card style={{border: 'solid 1px rgba(119, 22, 31, 0.6)', minWidth: '30%', maxWidth: '60%', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
            position: 'absolute', margin: '5rem', color: 'white'}}>
            <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>Retreat</h3></CardTitle>
            <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
                <div style={{display: 'flex', position: 'relative', flexDirection: 'row', margin: '1rem 0', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', border: 'solid 1px rgba(255,255,255,.15)'}}>
                <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto', marginTop: '-1.5rem', marginLeft: '-1.5rem'}}/>
                <Container>
                    <Row>
                        <Col xs={1} className='bi bi-hexagon-half' style={{color: acceptableTile ? 'yellowgreen':'red'}}></Col><Col style={{padding: 0}}>Select adjacent system your control where retreat to.</Col>
                    </Row>
                    <Row>
                        <Col xs={1} className='bi bi-shield-shaded' style={{color: Object.keys(escFleet).length > 0 ? 'yellowgreen':'red'}}></Col><Col style={{padding: 0}}>Select units to escape:</Col>
                    </Row>
                    <Row style={{padding: '1rem', display: 'flex', flexDirection: 'column'}}>
                        <div style={{marginLeft: '.5rem', display: 'flex', width: 'fit-content', flexWrap: 'wrap'}}>
                            {Object.keys(fleet).map((u, i) => 
                                fleet[u].map((t, j) =>{
                                    let className=technologies[u].sustain ? 'sustain_ability':'';
                                    className += ' hit_assigned' + haveHit(u, j);

                                    return <div key={i+' '+j} style={{margin: '0.25rem 1rem 0 0', display: 'flex', alignItems: 'flex-start', padding: '.25rem',
                                                backgroundColor: escFleet[u] && escFleet[u].indexOf(j)>-1 ? 'rgba(255,255,255,.5)':'' }}>
                                        <div>
                                            <Button style={{width: '3rem', padding: 0, border: 'none'}} 
                                                className={className} outline onClick={() => fleetClick(u, j)}>
                                                <img alt='unit' src={'units/' + u.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                            </Button>
                                        </div>
                                        <div style={{display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', maxWidth: '10rem'}}>
                                            {t.payload && t.payload.map((p, l) =>{
                                                let clName = technologies[p.id] && technologies[p.id].sustain ? 'sustain_ability':'';
                                                clName += ' hit_assigned' + haveHit(u, j, l);

                                                return <Button outline key={j+''+l} className={clName}
                                                    style={{width: '1.75rem', border: 'solid 1px rgba(255,255,255,.15)', margin: '.1rem', padding: 0}}>
                                                    <img alt='unit' src={'units/' + p.id.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                                </Button>
                                            })}
                                        </div>
                                    </div>
                                })    
                            )}
                        </div>
                        <div style={{margin: '.5rem', display: 'flex', width: 'fit-content', flexDirection: 'column'}}>
                            {groundForces && groundForces.map((planet, pi) =>
                                <div key={pi} style={{display: 'flex', flexWrap: 'wrap'}}>
                                    <span style={{padding: '.5rem'}}>{planet.pname}</span>
                                    {Object.keys(planet.units).map((u, i) =>
                                        planet.units[u].map((g, j) => {
                                            return <Button key={i+''+j} style={{width: '3rem', padding: 0, border: 'none', 
                                                backgroundColor: escGround[u] && escGround[u].findIndex(n => n.pname === planet.pname && n.idx === j)>-1 ? 'rgba(255,255,255,.5)':''}} outline onClick={() => groundClick(planet, u, j)}>
                                                        <img alt='unit' src={'units/' + u.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                                    </Button>
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </Row>
                </Container>
                </div>
            </CardBody>
            <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
                <Button color='warning' onClick={() => moves.nextStep(selectedTile, escFleet, escGround)}>
                    {acceptableTile && Object.keys(escFleet).length > 0 ? 'Next':'Cancel'}
                </Button>
            </CardFooter>
        </Card>);
}

export const Bombardment = () => {

    const { G, ctx, moves } = useContext(StateContext);
    const activeTile = G.tiles.find(t => t.active === true);

    const hits = useMemo(() => {
        let result = {};

        const pid = ctx.currentPlayer;
        result[pid] = 0;

        if(G.dice[pid]){
            Object.keys(G.dice[pid]).forEach(unit => {
                const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                if(technology && technology.bombardment){
                    result[pid] += G.dice[pid][unit].filter(die => die >= technology.bombardment.value).length;
                }
            });
        }
        
        return result;
    }, [G.dice, G.races, ctx.currentPlayer]);

    const bombAbilities = useCallback((race, units)=>{
        const result = {};
    
        Object.keys(units).forEach( k => {
            const technology = race.technologies.find(t => t.id === k.toUpperCase() && t.bombardment);
            if(technology) result[k] = technology;
        });

        return result;
    },[]);

    const everyoneRolls = useMemo(() => {
        const attacker = bombAbilities(G.races[ctx.currentPlayer], activeTile.tdata.fleet);
        return Object.keys(attacker).length === Object.keys(G.dice[ctx.currentPlayer]).length;

    }, [G.dice, G.races, activeTile, bombAbilities, ctx.currentPlayer]);

    const activePlanet = useMemo(() => {
        return activeTile.tdata.planets.find(p => p.invasion);
    }, [activeTile]);

    const defenderForces = useMemo(() => {
        const result = {};
        Object.keys(activePlanet.units).forEach(k => {
            if(['infantry', 'mech', 'pds'].indexOf(k) > -1){
                result[k] = activePlanet.units[k];
            }
        });
        return result;
    },[activePlanet]);

    return (
    <Card style={{border: 'solid 1px rgba(119, 22, 31, 0.6)', minWidth: '30%', maxWidth: '60%', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
        position: 'absolute', margin: '5rem', color: 'white'}}>
        <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>Bombardment</h3></CardTitle>
        <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
            <CombatantForces race={G.races[ctx.currentPlayer]} units={activeTile.tdata.fleet} owner={ctx.currentPlayer} combatAbility='bombardment'/>
            <CombatantForces race={G.races[activePlanet.occupied]} units={defenderForces} owner={activePlanet.occupied}/>
        </CardBody>
        <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
            <Button color='warning' disabled = {!everyoneRolls} onClick={()=>moves.nextStep(hits)}>Next</Button>
            <span style={{display: 'flex', justifyContent: 'space-around', fontFamily: 'Handel Gothic', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>
                {Object.keys(hits).map((h, i) => {
                    return <span key={i}>
                        <img alt='race' src={'race/icons/' + G.races[h].rid + '.png'} style={{width: '2rem'}}/>
                        {' does ' + hits[h] + ' hits '}
                    </span>
                })}
            </span>
        </CardFooter>
    </Card>);

}

const LandingForces = (args) => {

    const { playerID } = useContext(StateContext);
    const {race, owner, units, troops, setTroops} = args;
    
    const technologies = useMemo(()=>{
        return getUnitsTechnologies([...Object.keys(units), 'fighter', 'mech'], race);
    },[race, units]);

    const haveHit = useCallback((tag, idx, pidx) => {
        let result = 0;

        if(pidx === undefined){
            result = (units[tag][idx].hit || 0);
        }
        else{
            if(units[tag][idx] && units[tag][idx].payload[pidx]){
                result = (units[tag][idx].payload[pidx].hit || 0);
            }
        }

        return result;
    }, [units]);

    const landTroop = useCallback((carTag, carIdx, idx) => {
        setTroops(produce(troops, draft => {
            const id = carTag + '.' + carIdx + '.' + idx;
            const index = troops.indexOf(id);

            if(index > -1){
                draft.splice(index, 1);
            }
            else{
                draft.push(id);
            }
        }))
    }, [troops, setTroops]);

    return (
        <div style={{display: 'flex', position: 'relative', flexDirection: 'row', margin: '1rem 0', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
            border: String(playerID) === String(owner) ? 'solid 1px rgba(255,255,0,.5)':'solid 1px rgba(255,255,255,.25)'}}>
            <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto', marginTop: '-1.5rem', marginLeft: '-1.5rem'}}/>
            {race.retreat && <CardText style={{position: 'absolute', left: '0.25rem', top: '3rem', background: 'darkslateblue', padding: '.5rem', fontFamily: 'Handel Gothic'}}>RETREAT</CardText>}
            <div style={{display: 'flex', flexWrap: 'wrap'}}>
                {Object.keys(units).filter(u => technologies[u] && technologies[u].capacity).map((u, i) => {
                    return <div key={i} style={{marginLeft: '1rem', display: 'flex', flexWrap: 'wrap'}}>
                        {units[u].map((t, j) =>{
                            let className=technologies[u].sustain ? 'sustain_ability':'';
                            className += ' hit_assigned' + haveHit(u, j);

                            return <div key={j}>
                                {t.payload && <div style={{margin: '0.25rem 1rem 0 0', display: 'flex', alignItems: 'flex-start'}}>
                                    <div>
                                        <Button style={{width: '5rem', padding: 0, backgroundColor: '', border: 'none'}} 
                                            className={className} outline onClick={()=>{}}>
                                            <img alt='unit' src={'units/' + u.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                        </Button>
                                    </div>
                                    <div style={{display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', maxWidth: '10rem'}}>
                                        {t.payload.map((p, l) =>{
                                            if(p){
                                                let clName = technologies[p.id] && technologies[p.id].sustain ? 'sustain_ability':'';
                                                clName += ' hit_assigned' + haveHit(u, j, l);

                                                return <Button outline disabled={['infantry', 'mech'].indexOf(p.id) === -1} onClick={() => landTroop(u, j, l)} key={l} className={clName}
                                                    style={{width: '2rem', border: 'solid 1px rgba(255,255,255,.15)', 
                                                        background: troops.indexOf(u+'.'+j+'.'+l) > -1 ? 'rgba(255,255,255,.5)': '', margin: '.1rem', padding: 0}}>
                                                    <img alt='unit' src={'units/' + p.id.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                                </Button>
                                            }
                                            return <></>
                                        })}
                                    </div>
                                </div>}
                            </div>
                        })}
                    </div>
                })}
            </div>
        </div>
    );

}

export const Invasion = () => {

    const { G, ctx, moves, playerID, prevStages } = useContext(StateContext);
    const activeTile = useMemo(()=> G.tiles.find(t => t.active === true), [G.tiles]);
    const activePlanet = useMemo(()=> {
        let ap = activeTile.tdata.planets.find(p => p.invasion);
        if(!ap) ap = {units: {}}
        return ap;
    }, [activeTile]);
    const [ahitsA, setAhitsA] = useState({});
    const [ahitsD, setAhitsD] = useState({});
    const [troops, setTroops] = useState([]);

    const defenderForces = useMemo(() => {
        const result = {};
        if(activePlanet){
            const possible = (activePlanet.invasion && activePlanet.invasion.nopds) ? ['infantry', 'mech']:['infantry', 'mech', 'pds'];
            Object.keys(activePlanet.units).forEach(k => {
                if(possible.indexOf(k) > -1){
                    result[k] = activePlanet.units[k];
                }
            });
        }
        return result;
    },[activePlanet]);

    const magen = useMemo(() => {
        if(activePlanet && activePlanet.invasion && !activePlanet.invasion.magenUsed){
            if(String(playerID) !== String(ctx.currentPlayer)){
                if((activePlanet.units.pds && activePlanet.units.pds.length) || (activePlanet.units.spacedock && activePlanet.units.spacedock.length)){
                    if(ctx.activePlayers[playerID] === 'invasion_await' && activePlanet.invasion.troops){
                        return true;
                    }
                }
            }
        }
    }, [activePlanet, ctx.activePlayers, playerID, ctx.currentPlayer]);

    const hits = useMemo(() => {
        let result = {};

        if(magen){
            result[activePlanet.occupied] = 1;
            return result;
        }

        if(activePlanet && activePlanet.invasion){
            const players = Object.keys(activePlanet.invasion).length > 0 ? Object.keys(ctx.activePlayers):[ctx.currentPlayer];

            players.forEach(pid => {
                let h = 0;
                if(G.dice[pid]){
                    Object.keys(G.dice[pid]).forEach(unit => {
                        const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                        
                        if(unit === 'pds'){
                            if(technology && technology.spaceCannon){
                                const adj = haveTechnology(G.races[playerID], 'ANTIMASS_DEFLECTORS') ? -1:0;
                                h += G.dice[pid][unit].filter(die => die+adj >= technology.spaceCannon.value).length;
                            }
                        }
                        else if(technology && technology.combat){
                            h += G.dice[pid][unit].filter(die => die >= technology.combat).length;
                        }
                    });
                }
                result[pid] = h;
            });
        }

        return result;
    }, [G.dice, G.races, ctx.activePlayers, activePlanet, ctx.currentPlayer, playerID, magen]);

    const assignedA = useMemo(() => {
        let result = 0;

        if(ahitsA){
            Object.keys(ahitsA).forEach(u => {
                if(ahitsA[u] && ahitsA[u].length){
                    ahitsA[u].forEach(ship => {
                        if(ship.hit) result += ship.hit;
                    });
                }
            });
        }

        return result;

    }, [ahitsA]);

    const assignedD = useMemo(() => {
        let result = 0;

        if(ahitsD){
            Object.keys(ahitsD).forEach(u => {
                if(ahitsD[u] && ahitsD[u].length){
                    ahitsD[u].forEach(ship => {
                        if(ship.hit) result += ship.hit;
                    });
                }
            });
        }

        return result;

    }, [ahitsD]);

    const everyoneRolls = useMemo(() => {
        if(activePlanet && activePlanet.invasion){
            if(!activePlanet.invasion.troops || !G.dice[ctx.currentPlayer] || !defenderForces || !G.dice[activePlanet.occupied]){
                return true;
            }

            return Object.keys(activePlanet.invasion.troops).length <= Object.keys(G.dice[ctx.currentPlayer]).length && 
                    Object.keys(defenderForces).length <= Object.keys(G.dice[activePlanet.occupied]).length;
        }

    }, [G.dice, ctx.currentPlayer, activePlanet, defenderForces]);

    const needAwait = useMemo(()=>{
        const myStage = ctx.activePlayers[playerID];
        if(myStage === 'invasion_await') return true;
    }, [playerID, ctx.activePlayers]);

    const landing = useMemo(() => {
        if(activePlanet && activePlanet.invasion){
            if(String(playerID) === String(ctx.currentPlayer)){
                if(ctx.activePlayers[playerID] === 'invasion_await' && !activePlanet.invasion.troops){
                    return true;
                }
            }
        }
    }, [ctx.currentPlayer, playerID, activePlanet, ctx.activePlayers]);

    const maxHits = useMemo(() => {
        let result = {};

        if(activePlanet && activePlanet.invasion){
            Object.keys(ctx.activePlayers).forEach(pid => {
                let fleet = (String(pid) === String(ctx.currentPlayer)) ? activePlanet.invasion.troops : defenderForces;
                result[pid] = 0;
                if(fleet){
                    const technologies = getUnitsTechnologies(Object.keys(fleet), G.races[pid]);

                    Object.keys(fleet).forEach(tag => {
                        fleet[tag].forEach(car => {
                            if(car){
                                result[pid] += 1;
                                if(technologies[tag] && technologies[tag].sustain){
                                    result[pid] += 1;
                                }
                                if(car.hit) result[pid] -= car.hit;
                            }
                        });
                    });
                }
            });
        }

        return result;
    }, [G.races, activePlanet, ctx.activePlayers, ctx.currentPlayer, defenderForces]);

    const allHitsAssigned = useMemo(() => {

        if(activePlanet && activePlanet.occupied !== undefined){
            if(playerID === ctx.currentPlayer){
                return !hits[activePlanet.occupied] || (assignedA === Math.min(hits[activePlanet.occupied], maxHits[ctx.currentPlayer]));
            }
            else{
                return !hits[ctx.currentPlayer] || (assignedD === Math.min(hits[ctx.currentPlayer], maxHits[activePlanet.occupied]));
            }
        }
    }, [assignedA, assignedD, playerID, ctx.currentPlayer, hits, activePlanet, maxHits]);

    const HitsInfo = () => {
        return  <span style={{display: 'flex', justifyContent: 'space-around', fontFamily: 'Handel Gothic', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>
                    {Object.keys(hits).map((h, i) => {
                        return <span key={i}>
                            <img alt='race' src={'race/icons/' + G.races[h].rid + '.png'} style={{width: '2rem'}}/>
                            {' does ' + hits[h] + ' hits '}
                        </span>
                    })}
                </span>
    }

    const winner = useMemo(() => {
        if(!activePlanet.invasion) return -1; //not you
        if(!activePlanet.invasion.troops) return undefined;

        const attacker = activePlanet.invasion.troops;
        const defender = Object.keys(activePlanet.units).filter(k => ['infantry', 'mech'].indexOf(k) > -1);

        if(!(attacker && Object.keys(attacker).length)){
            if(!Object.keys(ctx.activePlayers).find(k => ctx.activePlayers[k] !== 'invasion_await')){
                return activePlanet.occupied;
            }
        } 
        else if(!defender.length){
            if(!Object.keys(ctx.activePlayers).find(k => ctx.activePlayers[k] !== 'invasion_await')){
                return ctx.currentPlayer;
            }
        }

        return undefined;
    }, [activePlanet, ctx.currentPlayer, ctx.activePlayers]);


    useEffect(()=>{
        if(ahitsA && Object.keys(ahitsA).length > 0){
            setAhitsA({});
        }
    // eslint-disable-next-line
    }, [activePlanet.invasion]);

    useEffect(()=>{
        if(ahitsD && Object.keys(ahitsD).length > 0){
            setAhitsD({});
        }
    // eslint-disable-next-line
    }, [activePlanet.units]);

    return (
    <Card style={{border: 'solid 1px rgba(119, 22, 31, 0.6)', minWidth: '30%', maxWidth: '60%', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
        position: 'absolute', margin: '5rem', color: 'white'}}>
        <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>{landing ? 'Landing': magen ? 'Magen defence grid' : 'Invasion'}</h3></CardTitle>
        <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
            {(ctx.activePlayers[playerID] === 'invasion' || ctx.activePlayers[playerID] === 'invasion_await') && <>
                {!needAwait && <>
                    <CombatantForces race={G.races[ctx.currentPlayer]} units={activePlanet.invasion.troops} owner={ctx.currentPlayer} isInvasion={true} />
                    <CombatantForces race={G.races[activePlanet.occupied]} units={defenderForces} owner={activePlanet.occupied} isInvasion={true}/>
                </>}
                {landing && <>
                    <LandingForces race={G.races[ctx.currentPlayer]} owner={ctx.currentPlayer} units={activeTile.tdata.fleet} troops={troops} setTroops={setTroops}/>
                </>}
                {magen && <>
                    <HitAssign race={G.races[ctx.currentPlayer]} units={activePlanet.invasion.troops} owner={String(activePlanet.occupied)} hits={ahitsA} setHits={setAhitsA}/>
                </>}
                {!landing && !magen && needAwait && <>
                    {winner === undefined && <h5 style={{margin: '5rem', textAlign: 'center'}}>Awaiting opponent...</h5>}
                    {winner !== undefined && <>
                        {String(winner) === String(playerID) && <h5 style={{margin: '5rem', textAlign: 'center', color: 'yellowgreen'}}>Enemy's forces was defeated!</h5>}
                        {String(winner) !== String(playerID) && <h5 style={{margin: '5rem', textAlign: 'center', color: 'red'}}>Your forces was defeated.</h5>}
                    </>}
                </>}
            </>}
            {ctx.activePlayers[playerID] === 'invasion_step2' && <>
                {Object.keys(activePlanet.invasion).length > 0 && <HitAssign race={G.races[ctx.currentPlayer]} units={activePlanet.invasion.troops} owner={ctx.currentPlayer} hits={ahitsA} setHits={setAhitsA}/>}
                <HitAssign race={G.races[activePlanet.occupied]} units={defenderForces} owner={String(activePlanet.occupied)} hits={ahitsD} setHits={setAhitsD}/>
            </>}
        </CardBody>
        {(!needAwait || magen || landing || (needAwait && winner !== undefined)) && <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
            {landing && <Button color='warning' onClick={() => moves.landTroops(troops)}>{troops.length > 0 ? 'Next':'Cancel'}</Button>}
            {!landing && !magen && needAwait && winner !== undefined && <Button color='warning' onClick={() => moves.endBattle()}>Next</Button>}
            {magen && <Button color='warning' onClick={() => moves.magenDefense(ahitsA)}>Next</Button>}
            {ctx.activePlayers[playerID] === 'invasion' && <>
                <Button color='warning' disabled = {!everyoneRolls} onClick={() => moves.nextStep(hits)}>Next</Button>
                <HitsInfo />
            </>}
            {ctx.activePlayers[playerID] === 'invasion_step2' && <>
                <Button color='warning' disabled = {!allHitsAssigned} 
                onClick={() => moves.nextStep(playerID === ctx.currentPlayer ? ahitsA:ahitsD, prevStages[playerID])}>
                    Next</Button>
                <HitsInfo />
            </>}
        </CardFooter>}
    </Card>);

}