import { Card, CardBody, CardTitle, CardFooter, CardText, CardImg, Button, ButtonGroup, Container, Row, Col,
UncontrolledDropdown, DropdownMenu, DropdownItem, DropdownToggle, Badge } from 'reactstrap'; 
import { useContext, useMemo, useCallback, useState, useEffect } from 'react';
import { LocalizationContext, StateContext, getUnitsTechnologies, haveTechnology, wormholesAreAdjacent, enemyHaveCombatAC, adjustTechnologies } from './utils';
import { neighbors } from './Grid';
import { produce } from 'immer';
import { ActionCardDialog } from './actionCardDialog';
 
export const SpaceCannonAttack = () => {

    const { G, ctx, playerID, moves } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const activeTile = G.tiles.find(t => t.active === true);
    
    const spaceCannons = useMemo(() =>{
        let result = {};
        //enemy's pds at same tile
        if(activeTile.tdata.planets){
            activeTile.tdata.planets.forEach(p =>{ 
                if(p.occupied !== undefined && p.occupied !== ctx.currentPlayer && p.units){
                    if(p.units.pds){
                        if(!result[p.occupied]) result[p.occupied] = [];
                        result[p.occupied] = result[p.occupied].concat(p.units.pds);
                    }
                    if(p.experimentalBattlestation && p.units.spacedock && p.units.spacedock.length){
                        if(!result[p.occupied]) result[p.occupied] = [];
                        result[p.occupied] = result[p.occupied].concat({id: 'spacedock', experimentalBattlestation: true});
                    }
                }
            });
        }

        //cannon in adjacent systems
        const races = G.races.filter((r, i) => i !== ctx.currentPlayer && r.technologies.find(t => t.id === 'PDS').spaceCannon.range > 1).map(r => r.rid);

        //if(races.length > 0){
            const neighs = neighbors(G.HexGrid, [activeTile.q, activeTile.r]);
            neighs.forEach(nei => {
                const n = G.tiles.find(t => t.tid === nei.tileId);
                if(n.tdata.planets){
                    n.tdata.planets.forEach(p =>{ 
                        if((races.indexOf(p.occupied) > -1 && p.units) || p.experimentalBattlestation){
                            if(p.units.pds && races.indexOf(p.occupied) > -1){ //only for upgraded
                                if(!result[p.occupied]) result[p.occupied] = [];
                                result[p.occupied] = result[p.occupied].concat(p.units.pds);
                            }
                            if(p.experimentalBattlestation && p.units.spacedock && p.units.spacedock.length){
                                if(!result[p.occupied]) result[p.occupied] = [];
                                result[p.occupied] = result[p.occupied].concat({id: 'spacedock', experimentalBattlestation: true});
                            }
                        }
                    });
                }
            });
        //}

        return result;
    }, [G.races, G.tiles, G.HexGrid, activeTile, ctx.currentPlayer]);

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
            let adj = haveTechnology(G.races[ctx.currentPlayer], 'ANTIMASS_DEFLECTORS') ? -1:0;
            
            Object.keys(spaceCannons).forEach(pid => {
                if(G.dice[pid]){
                    Object.keys(G.dice[pid]).forEach(unit => {
                        const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                        if(technology && technology.spaceCannon){
                            result += G.dice[pid][unit].dice.filter(d => d + adj >= technology.spaceCannon.value).length;
                        }
                        else if(unit === 'spacedock' && G.dice[pid][unit].withTech && G.dice[pid][unit].withTech.indexOf('Experimental Battlestation') > -1){
                            result += G.dice[pid][unit].dice.filter(d => d + adj >= 5).length;
                        }
                    });
                }
            });

            if(G.races[ctx.currentPlayer].combatActionCards && G.races[ctx.currentPlayer].combatActionCards.indexOf('Maneuvering Jets') > -1){
                if(result > 0) result--;
            }
        }
        return result;
    }, [G.dice, G.races, spaceCannons, ctx.currentPlayer]);

    const nonFighterHits = useMemo(() => {
        let result = 0;

        if(spaceCannons !== undefined){
            const adj = haveTechnology(G.races[ctx.currentPlayer], 'ANTIMASS_DEFLECTORS') ? -1:0;

            Object.keys(spaceCannons).forEach(pid => {
                if(G.dice[pid]){
                    Object.keys(G.dice[pid]).forEach(unit => {
                        if(G.dice[pid][unit].withTech && G.dice[pid][unit].withTech.indexOf('GRAVITON_LASER_SYSTEM')>-1){
                            const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                            if(technology && technology.spaceCannon){
                                result += G.dice[pid][unit].dice.filter(d => d + adj >= technology.spaceCannon.value).length;
                            }
                        }
                    });
                }
            });

            if(G.races[ctx.currentPlayer].combatActionCards && G.races[ctx.currentPlayer].combatActionCards.indexOf('Maneuvering Jets') > -1){
                if(result > 0) result--;
            }
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

    const maxNonFighterHits = useMemo(() => {
        let result = 0;
        let fleet = activeTile.tdata.attacker || activeTile.tdata.fleet;
        const technologies = getUnitsTechnologies([...Object.keys(fleet)], G.races[ctx.currentPlayer]);

        Object.keys(fleet).forEach(tag => {
            if(tag !== 'fighter'){
                fleet[tag].forEach(car => {
                    result += 1;
                    if(technologies[tag] && technologies[tag].sustain){
                        result += 1;
                    }
                    if(car.hit) result -= car.hit;
                });
            }
        });


        return result;
    }, [G.races, activeTile.tdata, ctx.currentPlayer]);

    const allHitsAssigned = useMemo(() => {

        if(nonFighterHits && ahits && maxNonFighterHits){
            let nfh = 0; 
            Object.keys(ahits).filter(k => k !== 'fighter').forEach(u => {
                if(ahits[u] && ahits[u].length){
                    ahits[u].forEach(ship => {
                        if(ship.hit) nfh += ship.hit;
                    })
                }
            });

            if(nfh < nonFighterHits && nfh < maxNonFighterHits) return false;
        }

        return !hits || (assigned === Math.min(hits, maxHits));

    }, [assigned, hits, maxHits, ahits, nonFighterHits, maxNonFighterHits]);

    const isLastOnStage = useMemo(()=>{
        const myStage = ctx.activePlayers[playerID];
        const players = Object.keys(ctx.activePlayers).filter(s => ctx.activePlayers[s] === myStage);
        return players && players.length === 1;
    }, [playerID, ctx.activePlayers]);

    return (<>
    <Card className='borderedPanel combatPanel' style={{minWidth: '40%', maxWidth: '60%'}}>
        <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>{t('board.space_cannon_attack')}</h3></CardTitle>
        <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
            {ctx.activePlayers[playerID] === 'spaceCannonAttack' && <>
                <CombatantForces race={G.races[ctx.currentPlayer]} units={fleet} owner={ctx.currentPlayer} combatAbility='spaceCannon'/>
                {spaceCannons !== undefined && Object.keys(spaceCannons).map((k, i) => {
                    const sd = spaceCannons[k].filter(s => s.id === 'spacedock');
                    const pd = spaceCannons[k].filter(s => !s.id || s.id === 'pds');

                    return <CombatantForces key={i} race={G.races[k]} combatAbility='spaceCannon' units={{pds: pd, spacedock: sd}} owner={k}/>
                    })
                }
            </>}
            {ctx.activePlayers[playerID] === 'spaceCannonAttack_step2' && <>
                <HitAssign race={G.races[ctx.currentPlayer]} units={fleet} owner={ctx.currentPlayer} hits={ahits} setHits={setAhits}/>
            </>}
        </CardBody>
        <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
            {ctx.activePlayers[playerID] === 'spaceCannonAttack' && <>
                <button className='styledButton yellow' disabled= {playerID === ctx.currentPlayer && !isLastOnStage} onClick={() => moves.nextStep()}>{t('board.next')}</button>
                <span style={{fontFamily: 'Handel Gothic', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>{hits + ' ' + t('board.hits') + ' '}</span>
            </>}
            {ctx.activePlayers[playerID] === 'spaceCannonAttack_step2' && <>
                <button className='styledButton yellow' disabled= {(playerID === ctx.currentPlayer && !allHitsAssigned) || 
                    (playerID !== ctx.currentPlayer && ctx.activePlayers[ctx.currentPlayer] !== undefined)}  onClick={()=>moves.nextStep(ahits)}>{t('board.next')}</button>
                <span style={{fontFamily: 'Handel Gothic', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>
                    {playerID === ctx.currentPlayer ? assigned + ' / ' + hits + ' ' + t('board.hits_assigned') +  ' ' + (nonFighterHits ? ' (' + nonFighterHits + ' ' + t('board.non_fighters') + ')':''): hits + ' ' + t('board.hits') + ' '}
                </span>
            </>}
        </CardFooter>
    </Card>
    {G.currentCombatActionCard && <ActionCardDialog />}
    </>);

}

const HitAssign = (args) => {

    const { G, playerID, ctx } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const {race, units, hits, setHits, owner, allowRepair, ambush, assaultCannon} = args;
    
    const technologies = useMemo(()=>{
        let result = {};

        if(units){
            result = getUnitsTechnologies([...Object.keys(units), 'fighter', 'mech'], race);
            result = adjustTechnologies(G, ctx, owner, result);
        }

        return result;
    },[G, ctx, owner, race, units]);

    const hitAssign = useCallback((tag, idx, pidx, payloadId) => {

        if(String(playerID) !== String(owner)) return;
        if(payloadId && payloadId !== 'fighter' && payloadId !== 'mech') return;
        if(assaultCannon && (tag === 'fighter' || payloadId)) return;
        if(ambush && race.rid === 2) return; //mentak

        setHits(produce(hits, draft => {
            if(!draft[tag]) draft[tag]=[];
            if(pidx === undefined){
                const dmg = draft[tag].findIndex(ship => ship.idx === idx);
                if(dmg === -1){
                    draft[tag].push({idx, payload:[], hit: (assaultCannon && technologies[tag].sustain) ? 2:1});
                }
                else{
                    if(assaultCannon && technologies[tag].sustain){
                        draft[tag][dmg].hit += 2;
                        if(draft[tag][dmg].hit > 2) draft[tag][dmg].hit = 0;
                    }
                    else if(technologies[tag].sustain && !units[tag][dmg].hit){
                        draft[tag][dmg].hit = (draft[tag][dmg].hit || 0 ) + 1;
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
    }, [hits, playerID, technologies, owner, setHits, units, ambush, race.rid, assaultCannon]);

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

        if(String(playerID) === String(owner)){

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

    const canRepair = useCallback((tag, idx, pidx) => {
        if(String(playerID) !== String(owner) || !allowRepair) return 0;
        const repairedTag = Object.keys(hits).find(k=>k && k.startsWith('-'));
        if(hits && repairedTag){
            if(repairedTag === ('-' + tag)){
                if(hits[repairedTag].length && hits[repairedTag][0].idx === idx && hits[repairedTag][0].pidx === pidx){
                    return 2;
                }
            }
            return 0;
        }
        let result = 0;

        if(pidx === undefined){
            result = units[tag][idx].hit ? 1:0;
        }
        else{
            if(units[tag][idx] && units[tag][idx].payload[pidx]){
                result = units[tag][idx].payload[pidx].hit ? 1:0;
            }
        }

        if(result && hits[tag]){
            const ship = hits[tag].find(ship => ship.idx === idx);
            if(ship){
                if(pidx === undefined){
                    result = ship.hit ? 0:result;
                }
                else{
                    if(ship.payload){
                        const p = ship.payload.find(p => p.pidx === pidx);
                        if(p) result = p.hit ? 0:result;
                    }
                }
            }
        }

        return result;
    }, [units, hits, playerID, owner, allowRepair]);

    const duranium = useMemo(() => {
        return haveTechnology(race, 'DURANIUM_ARMOR')
    }, [race]);

    useEffect(()=>{
        if(!allowRepair && hits){
            const repairedTag = Object.keys(hits).find(k=>k && k.startsWith('-'));
            if(repairedTag){
                setHits(produce(hits, draft => {
                    delete draft[repairedTag];
                }))
            }
        }
    }, [allowRepair, hits, setHits]);

    return (<div style={{margin: '1rem 0'}}>
        <div style={{display: 'flex', position: 'relative', flexDirection: 'row', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
            border: String(playerID) === String(owner) ? 'solid 1px rgba(255,255,0,.5)':'solid 1px rgba(255,255,255,.25)'}}>
            <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto', marginTop: '-1.5rem', marginLeft: '-1.5rem'}}/>
            {race.retreat && <CardText style={{position: 'absolute', left: '0.25rem', top: '3rem', background: race.retreat === 'cancel' ? 'gray':'darkslateblue', padding: '.5rem', fontFamily: 'Handel Gothic'}}>{t('board.retreat')}</CardText>}
            <div style={{display: 'flex', flexWrap: 'wrap'}}>
                {Object.keys(units).map((u, i) => {
                    return <div key={i} style={{marginLeft: '1rem', display: 'flex', flexWrap: 'wrap'}}>
                        {units[u].map((t, j) =>{
                            const hh = haveHit(u, j);
                            const canRep = canRepair(u, j);
                            let dice;
                            let diceColor = 'light';

                            if(ambush && race.rid === 2 && G.dice[owner] && G.dice[owner][u] && G.dice[owner][u].dice[j] !== undefined){
                                dice = G.dice[owner][u].dice[j];
                                if(dice >= technologies[u].combat){
                                    diceColor = 'success';
                                }
                            }

                            let className=technologies[u].sustain ? 'sustain_ability':'';
                            className += ' hit_assigned' + hh;

                            return <div key={j} style={{margin: '0.25rem 1rem 0 0', display: 'flex', alignItems: 'flex-start'}}>
                                <div style={{display: 'flex', flexDirection: 'column', position: 'relative'}}>
                                    <Button disabled={canRep > 1} style={{width: '5rem', padding: 0, backgroundColor: '', border: 'none'}} 
                                        className={className} outline onClick={() => hitAssign(u, j)}>
                                        <img alt='unit' src={'units/' + u.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                    </Button>
                                    {dice && <Button size='sm' color={diceColor} style={{borderRadius: '5px', padding: 0, margin: '.25rem', fontSize: '12px', width: '1.25rem', maxWidth:'1.25rem', height: '1.25rem', position: 'absolute', right: 0}}>
                                            {('' + dice).substr(-1)}
                                    </Button>}
                                    {duranium && technologies[u].sustain && hh > 0 &&
                                    <Button disabled={canRep !== 1} size='sm' color={canRep > 1 ? 'success':'light'} onClick={()=> hitAssign('-'+u, j)} style={{padding: 0}}>{t('board.repair')}</Button> }
                                </div>
                                <div style={{display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', maxWidth: '10rem'}}>
                                    {t.payload && t.payload.map((p, l) =>{
                                        if(p){
                                            const hh2 = haveHit(u, j, l);
                                            const canRep2 = canRepair(u, j, l)

                                            let clName = technologies[p.id] && technologies[p.id].sustain ? 'sustain_ability':'';
                                            clName += ' hit_assigned' + hh2;

                                            return <div key={l} style={{display: 'flex', flexDirection: 'column'}}>
                                            <Button outline disabled={canRep2 > 1} onClick={() => hitAssign(u, j, l, p.id)} className={clName}
                                                style={{width: '2rem', border: 'solid 1px rgba(255,255,255,.15)', margin: '.1rem', padding: 0}}>
                                                <img alt='unit' src={'units/' + p.id.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                            </Button>
                                            {duranium && technologies[p.id].sustain && hh2 > 0 && 
                                            <Button disabled={canRep2 !== 1} size='sm' color={canRep2 > 1 ? 'success':'light'} onClick={() => hitAssign('-'+u, j, l, p.id)} 
                                                style={{padding: 0, fontSize: '70%'}}>{t('board.repair')}</Button> }
                                            </div>
                                        }
                                        return <div key={l}></div>
                                    })}
                                </div>
                            </div>})}
                    </div>
                })}
            </div>
        </div>
        {race.combatActionCards && <div style={{display: 'flex', flexDirection: 'row-reverse'}}>
                {race.combatActionCards.map((ca, i) => {
                    let label;
                    if(['FLAGSHIP', 'MECH'].includes(ca)){
                        label = t('races.' + race.rid + '.' + ca + '.label');
                    }
                    else if(ca === 'HERO'){
                        label = t('board.hero').toUpperCase();
                    }
                    else{
                        label = t('cards.actions.' + ca + '.label');
                    }

                return <Badge key={i} color='warning' style={{color: 'black'}}>{label}</Badge>})}
            </div>
        }
        </div>
    );

}

const CombatantForces = (args) => {

    const { G, moves, playerID, ctx, prevStages } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const {race, units: fleet, owner, combatAbility, isInvasion} = args;
    const [plasmaScoringUsed, setPlasmaScoringUsed] = useState(false);

    const units = useMemo(()=> {
        let payload = {
            fighter: [], mech: [], infantry: []
        };

        if(fleet){
            Object.keys(fleet).forEach(unit => {
                fleet[unit].forEach( car =>{
                    if(car.payload && car.payload.length){
                        car.payload.forEach(p => {
                            if(p && payload[p.id]) payload[p.id].push(p);
                        })
                    }
                })
            });
        }

        Object.keys(payload).forEach(k => {
            if(payload[k].length === 0) delete payload[k];
        })

        return {...fleet, ...payload}
    }, [fleet])

    const technologies = useMemo(()=>{
        let result = getUnitsTechnologies([...Object.keys(units), 'fighter', 'mech', 'infantry'], race);
        result = adjustTechnologies(G, ctx, owner, result);

        return result;
    },[G, ctx, owner, race, units]);

    const fireClick = useCallback((u, withTech) => {
        const count = Array.isArray(units[u]) ? units[u].length : units[u];
        let adv_shots = 0;
        const wt = [withTech];

        let shots = (combatAbility && technologies[u][combatAbility] ? technologies[u][combatAbility].count : 
                                    u === 'pds' ? technologies[u]['spaceCannon'].count: technologies[u].shot) || 1;
        if(u === 'spacedock' && combatAbility === 'spaceCannon') { //experimental battlestation
            shots = 3;
            wt.push('Experimental Battlestation');
        }
        if(withTech === 'PLASMA_SCORING') shots++;
        if(withTech === 'AGENT') adv_shots = 1;
        moves.rollDice(u, count*shots + adv_shots, wt);
        if(withTech === 'PLASMA_SCORING') setPlasmaScoringUsed(true);        
    }, [moves, technologies, units, combatAbility]);

    const unitsInjury = useCallback((tag) => {

        let result = 0;
        if(units[tag] && Array.isArray(units[tag])){
            units[tag].forEach(u => {if(u.hit)result += u.hit})
        }
        return result;

    }, [units]);

    const dropdown_ps = useMemo(() =>{
        return (combatAbility === 'bombardment' || combatAbility === 'spaceCannon') && (haveTechnology(race, 'PLASMA_SCORING') && !plasmaScoringUsed)
    }, [race, plasmaScoringUsed, combatAbility]);

    const dropdown_gls = useMemo(() =>{
        return (combatAbility === 'spaceCannon') && (haveTechnology(race, 'GRAVITON_LASER_SYSTEM') && race.exhaustedCards.indexOf('GRAVITON_LASER_SYSTEM') === -1)
    }, [race, combatAbility]);

    const dropdown_agent = useMemo(() => {
        return !combatAbility && isInvasion && race.rid === 1 && race.exhaustedCards.indexOf('AGENT') === -1
    }, [race, combatAbility, isInvasion])

    const mayReroll = useCallback((owner, unit, didx) => {
        if(String(playerID) === String(owner)){
            if(G.races[playerID].combatActionCards.indexOf('Fire Team') > -1){
                if(!(G.dice[owner][unit].reroll && G.dice[owner][unit].reroll[didx] !== undefined)){
                    return true;
                }
            }
        }
    }, [playerID, G.races, G.dice]);

    return (<div style={{margin: '1rem 0'}}>
        <div style={{display: 'flex', padding: '1rem', position: 'relative', flexDirection: 'row', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
            border: String(playerID) === String(owner) ? 'solid 1px rgba(255,255,0,.5)':'solid 1px rgba(255,255,255,.25)'}}>
            <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto', marginTop: '-1.5rem', marginLeft: '-1.5rem'}}/>
            {race.retreat && <CardText style={{position: 'absolute', left: '0.25rem', top: '3rem', background: race.retreat === 'cancel' ? 'gray':'darkslateblue', padding: '.5rem', fontFamily: 'Handel Gothic'}}>{t('board.retreat').toUpperCase()}</CardText>}
            <Container>
                <Row className='row-cols-auto' style={{alignItems: 'flex-start'}}>
                    {Object.keys(units).map((u, i) => {
                        const ucount = (Array.isArray(units[u]) ? units[u].length : units[u]);
                        if(!ucount) return null;

                        let style = {marginLeft: '1rem', minHeight: '7rem', padding: 0, fontFamily: 'Handel Gothic', position: 'relative', flexGrow: 0, display: 'flex'};
                        const deflt = {value: technologies[u].combat, count: technologies[u].shot || 1};
                        let ability = isInvasion ? (u === 'pds' ? technologies[u]['spaceCannon']: deflt):
                                        ['infantry', 'mech'].indexOf(u) === -1 ? 
                                            combatAbility ? technologies[u][combatAbility] : deflt 
                                            : null;
                        if(combatAbility === 'bombardment' && u === 'pds') ability = null;
                        if(u === 'spacedock' && combatAbility === 'spaceCannon' && units[u][0].experimentalBattlestation) ability = {value: 5, count: 3};
                        if(!ability && combatAbility === 'bombardment' && ['fighter', 'infantry', 'mech'].indexOf(u) === -1 && race.combatActionCards.indexOf('Blitz')>-1){
                            ability = {value: 6, count: 1}
                        }
                        
                        if(ability){
                            style = {...style, padding: '.5rem', background: 'rgba(255,255,255,.15)'}
                        }

                        const className = technologies[u].sustain ? 'sustain_ability':'';
                        const injury = unitsInjury(u);
                        let adj = 0;

                        if(!combatAbility && u === 'pds'){ //spaceCannon: defense
                            if(G.races[ctx.currentPlayer].combatActionCards.indexOf('Disable') > -1){
                                ability = null;
                            }
                        }
                        if(combatAbility === 'spaceCannon' || u === 'pds'){
                            const enemyId = ctx.currentPlayer; //pds shots only for this player
                            if(haveTechnology(G.races[enemyId], 'ANTIMASS_DEFLECTORS')){
                                adj = -1;
                            }
                        }
                        else if(combatAbility === 'bombardment'){
                            if(enemyHaveCombatAC(G.races, ctx.activePlayers, ctx.currentPlayer, 'PLANETARY SHIELD')){
                                if(G.races[ctx.currentPlayer].combatActionCards.indexOf('Disable') === -1){ //todo: exclude arborecs mech!
                                    ability = null;
                                }
                            }
                            if(enemyHaveCombatAC(G.races, ctx.activePlayers, ctx.currentPlayer, 'Bunker')){
                                adj = -4;
                            }
                        }

                        if(ability && ability.value && u === 'fighter' && 
                        race.combatActionCards.indexOf('Fighter Prototype')>-1 && prevStages[race.pid].filter(s => s === 'spaceCombat').length === 1){
                            adj = 2;
                        }

                        if(!combatAbility && ability && ability.value && u !== 'pds' && u !== 'spacedock'){
                            if(race.combatActionCards.indexOf('Morale Boost')>-1){
                                adj++;
                            }
                        }
                        
                        return <Col className='col-md-auto' key={i} style={style}>
                            <span className={className} style={{position: 'relative'}}>
                                {injury > 0 && <span className='hit_assigned1' style={{position: 'absolute', bottom: 0, color: 'red', width: '1.75rem', textAlign: 'right'}}>{injury}</span>}
                                <CardImg style={{width: '5rem', marginTop: '1rem'}} src={'units/' + u.toUpperCase() + '.png'} />
                                {ucount > 1 && <span style={{fontSize: 30, position: 'absolute', right: 0, top: 0, textShadow: '-2px 2px 3px black'}}>{ucount}</span>}
                            </span>
                            <span style={{fontSize: 16, marginLeft: '1rem', minWidth: '7rem'}}>
                                {ability && <>
                                    <p style={{margin: 0}}>{t('board.combat') + ': ' + ability.value} 
                                        {adj !==0 ? <span style={{color: adj<0 ? 'red':'yellowgreen'}}>
                                            {' (' + (ability.value - adj) + ')'}
                                        </span> : ''}
                                    </p>
                                    <p style={{margin: 0}}>{t('board.shot') + ': ' + ability.count}</p>
                                </>}
                                {!ability && <div style={{fontSize: '70%', width: '5rem'}}>{t('board.no_ability')}</div>}
                                
                                {!G.dice[owner][u] && ability && String(playerID) === String(owner) &&
                                        <UncontrolledDropdown group> 
                                            <Button size='sm' onClick={()=>fireClick(u)} color='danger' style={{width: '5rem'}}>{t('board.fire')}</Button>
                                            {(dropdown_ps || dropdown_gls || dropdown_agent) && <><DropdownToggle caret color='danger' style={{padding: '0.25rem 0.5rem 0 0.25rem'}}/>
                                            <DropdownMenu dark>
                                                {dropdown_ps && <DropdownItem onClick={()=>fireClick(u, 'PLASMA_SCORING')}>
                                                    <img alt='warfare' src='icons/warfare.png' style={{width: '1rem', marginRight: '.5rem'}}/>{t('cards.techno.PLASMA_SCORING.label')}
                                                </DropdownItem>}
                                                {dropdown_gls && <DropdownItem onClick={()=>fireClick(u, 'GRAVITON_LASER_SYSTEM')}>
                                                    <img alt='warfare' src='icons/cybernetic.png' style={{width: '1rem', marginRight: '.5rem'}}/>{t('cards.techno.GRAVITON_LASER_SYSTEM.label')}
                                                </DropdownItem>}
                                                {dropdown_agent && <DropdownItem onClick={()=>fireClick(u, 'AGENT')}>
                                                    {t('board.agent')}
                                                </DropdownItem>}
                                            </DropdownMenu></>}
                                        </UncontrolledDropdown>}
                                {G.dice[owner][u] && <ButtonGroup style={{flexWrap: 'wrap', maxWidth: '6rem'}}>
                                    {G.dice[owner][u].dice.map((d, j) =>{
                                        const val = G.dice[owner][u].reroll ? G.dice[owner][u].reroll[j] || d : d;
                                        let color = 'light';
                                        if(val + adj >= ability.value) color = G.dice[owner][u].withTech && G.dice[owner][u].withTech.indexOf('GRAVITON_LASER_SYSTEM')>-1 ? 'danger':'success';

                                        const mr = mayReroll(owner, u, j);
                                        if(color === 'light' && mr) color = 'warning';

                                        return <Button key={j} size='sm' color={color} onClick = { mr ? ()=>moves.rerollDice(u, j):()=>{} }
                                            style={{borderRadius: '5px', padding: 0, margin: '.25rem', fontSize: '12px', width: '1.25rem', maxWidth:'1.25rem', height: '1.25rem'}}>
                                            {('' + val).substr(-1)}</Button>
                                    })}
                                    </ButtonGroup>
                                }
                            </span>
                        </Col>
                    })}
                    {race.rid === 1 && race.commanderIsUnlocked && race.exhaustedCards.indexOf('COMMANDER') === -1 && G.races[ctx.currentPlayer].rid !== 1 && isInvasion && prevStages && prevStages[race.pid] && prevStages[race.pid].indexOf('invasion') === prevStages[race.pid].length - 1 && 
                    <Col className='col-md-auto' style={{marginLeft: '1rem', minHeight: '7rem', padding: '.5rem', background: 'rgba(255,255,255,.15)', fontFamily: 'Handel Gothic', position: 'relative', flexGrow: 0, display: 'flex'}}>
                        <span style={{position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                            <CardImg style={{width: '3rem', marginLeft: '2rem'}} src={'units/INFANTRY.png'} />
                            <span style={{fontSize: 30, position: 'absolute', left: 0, top: '.5rem'}}>+1</span>
                            <Button size='sm' disabled={String(playerID)!==String(owner)} color='success' onClick={()=>moves.useCommander()}>{t('board.commander')}</Button>
                        </span>
                    </Col>}
                </Row>
            </Container>
        </div>
        {race.combatActionCards && <div style={{display: 'flex', flexDirection: 'row-reverse'}}>
            {race.combatActionCards.map((ca, i) => {
                let label;
                if(['FLAGSHIP', 'MECH'].includes(ca)){
                    label = t('races.' + race.rid + '.' + ca + '.label');
                }
                else if(ca === 'HERO'){
                    label = t('board.hero').toUpperCase();
                }
                else{
                    label = t('cards.actions.' + ca + '.label');
                }

                return <Badge key={i} color='warning' style={{color: 'black'}}>{label}</Badge>})}
            </div>
        }
        </div>
    );

}

export const AntiFighterBarrage = (args) => {

    const { G, ctx, moves, playerID } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const { selectedTile } = args;
    const activeTile = G.tiles.find(t => t.active === true);

    const hits = useMemo(() => {
        let result = {};

        Object.keys(ctx.activePlayers).forEach(pid => {
            let h = 0;
            if(G.dice[pid]){
                Object.keys(G.dice[pid]).forEach(unit => {
                    const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                    if(technology && technology.barrage){
                        h += G.dice[pid][unit].dice.filter(d => d >= technology.barrage.value).length;
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
            return G.races[enemyID].retreat === true;
        }
    }, [playerID, ctx.activePlayers, G.races]);

    return (<>
    <Card className='borderedPanel combatPanel' style={{minWidth: '40%', maxWidth: '60%'}}>
        <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>{t('board.antifighter_barrage')}</h3></CardTitle>
        <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
            <CombatantForces race={G.races[ctx.currentPlayer]} units={activeTile.tdata.attacker} owner={ctx.currentPlayer} combatAbility='barrage'/>
            <CombatantForces race={G.races[activeTile.tdata.occupied]} units={activeTile.tdata.fleet} owner={activeTile.tdata.occupied} combatAbility='barrage'/>
        </CardBody>
        <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
            <button className='styledButton yellow' disabled = {!everyoneRolls} onClick={() => moves.nextStep()}>{t('board.next')}</button>
            <span style={{display: 'flex', justifyContent: 'space-around', fontFamily: 'Handel Gothic', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>
                {Object.keys(hits).map((h, i) => {
                    return <span key={i}>
                        <img alt='race' src={'race/icons/' + G.races[h].rid + '.png'} style={{width: '2rem'}}/>
                        {' ' + t('board.does') + ' ' + hits[h]}
                    </span>
                })}
            </span>
            <button className='styledButton red' disabled = {everyoneRolls || enemyRetreat} onClick={() => moves.retreat()}>{t('board.Retreat')}</button>
        </CardFooter>
    </Card>
    {G.currentCombatActionCard && <ActionCardDialog selectedTile={selectedTile}/>}
    </>);

}

export const SpaceCombat = ({selectedTile}) => {

    const { G, ctx, moves, playerID, prevStages } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const activeTile = G.tiles.find(t => t.active === true);
    const [ahitsA, setAhitsA] = useState({});
    const [ahitsD, setAhitsD] = useState({});

    const ambush = useMemo(() => {
        return G.spaceCombat && G.spaceCombat.ambush;
    }, [G.spaceCombat])

    const assaultCannon = useMemo(() => {
        return !ambush && G.spaceCombat && G.spaceCombat.assaultCannon;
    }, [G.spaceCombat, ambush]);

    const hits = useMemo(() => {
        let result = {};

        if(assaultCannon){
            const enemy = Object.keys(ctx.activePlayers).find(k => String(k)!==String(playerID));
            result[enemy] = 1;
            return result;
        }

        Object.keys(ctx.activePlayers).forEach(pid => {
            let h = 0;
            if(G.dice[pid]){
                Object.keys(G.dice[pid]).forEach(unit => {
                    let adj = (unit === 'fighter' && G.races[pid].combatActionCards.indexOf('Fighter Prototype') > -1 &&
                        prevStages[pid].filter(s => s === 'spaceCombat').length === 1) ? 2:0;
                    if(G.races[pid].combatActionCards.indexOf('Morale Boost') > -1 && unit !== 'pds' && unit !== 'spacedock'){
                        adj++;
                    }

                    const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                    
                    if(technology && technology.combat){
                        h += G.dice[pid][unit].dice.filter(d => d+adj >= technology.combat).length;
                    }

                    if(G.races[pid].combatActionCards.indexOf('Reflective Shielding') > -1){
                        let fleet = (String(pid) === String(ctx.currentPlayer)) ? activeTile.tdata.attacker : activeTile.tdata.fleet;
                        let hitted = Object.keys(fleet).find(tag =>{
                            if(fleet[tag] && fleet[tag].length){
                                return fleet[tag].find(c => c.hit && c.hit > 0)
                            }
                            return false;
                        }); 
                            
                        if(hitted) h += 2;
                    }
                    if(enemyHaveCombatAC(G.races, ctx.activePlayers, pid, 'Shields Holding')){
                        h -= 2;
                        if(h < 0) h=0;
                    }
                });
            }
            result[pid] = h;
        });

        return result;
    }, [G.dice, G.races, ctx, assaultCannon, playerID, prevStages, activeTile.tdata]);

    const assignedA = useMemo(() => {
        let result = 0;

        if(ahitsA){
            Object.keys(ahitsA).forEach(u => {
                if(ahitsA[u] && ahitsA[u].length && !u.startsWith('-')){
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
                if(ahitsD[u] && ahitsD[u].length && !u.startsWith('-')){
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
            retreater = G.races[pid].retreat === true ? pid : undefined;
            return retreater !== undefined;
        });
        
        return retreater;
    }, [ctx.activePlayers, G.races]);

    const maxHits = useMemo(() => {
        let result = {};

        Object.keys(ctx.activePlayers).forEach(pid => {
            let fleet = (String(pid) === String(ctx.currentPlayer)) ? activeTile.tdata.attacker : activeTile.tdata.fleet;
            if(!fleet) fleet = {};
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

        if(assaultCannon){
            return assignedA === 1 || assignedA === 2;
        }

        else if(playerID === ctx.currentPlayer){
            return !hits[activeTile.tdata.occupied] || (assignedA === Math.min(hits[activeTile.tdata.occupied], maxHits[ctx.currentPlayer]));
        }
        else{
            return !hits[ctx.currentPlayer] || (assignedD === Math.min(hits[ctx.currentPlayer], maxHits[activeTile.tdata.occupied]));
        }

    }, [assignedA, assignedD, playerID, ctx.currentPlayer, hits, activeTile, maxHits, assaultCannon]);

    const HitsInfo = () => {
        return  <span style={{display: 'flex', justifyContent: 'space-around', fontFamily: 'Handel Gothic', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>
                    {Object.keys(hits).map((h, i) => {
                        return <span key={i}>
                            <img alt='race' src={'race/icons/' + G.races[h].rid + '.png'} style={{width: '2rem'}}/>
                            {' ' + t('board.does') + ' ' + hits[h]}
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

    const looser = useMemo(() => {
        const attacker = activeTile.tdata.attacker;
        const defenser = activeTile.tdata.fleet;

        if(!(attacker && Object.keys(attacker).length)){
            return ctx.currentPlayer;
        } 
        else if(!(defenser && Object.keys(defenser).length)){
            return activeTile.tdata.occupied;
        }

        return undefined;
    }, [activeTile.tdata, ctx.currentPlayer]);

    const haveACDialog = useMemo(() => {
        return G.currentCombatActionCard !== undefined;
    }, [G.currentCombatActionCard]);

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

    return (<>
    <Card className='borderedPanel combatPanel' style={{minWidth: '40%', maxWidth: '60%'}}>
        <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>{assaultCannon ? t('board.Assault_cannon'): ambush ? t('races.2.AMBUSH.label') : t('board.Space_combat')}</h3></CardTitle>
        <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
            {(ctx.activePlayers[playerID] === 'spaceCombat' || ctx.activePlayers[playerID] === 'spaceCombat_await') && <>
                {!needAwait && <>
                    <CombatantForces race={G.races[ctx.currentPlayer]} units={activeTile.tdata.attacker} owner={ctx.currentPlayer} />
                    <CombatantForces race={G.races[activeTile.tdata.occupied]} units={activeTile.tdata.fleet} owner={activeTile.tdata.occupied}/>
                </>}
                {needAwait && <>
                    {winner === undefined && <h5 style={{margin: '5rem', textAlign: 'center'}}>{t('board.awaiting_opponent')}...</h5>}
                    {winner !== undefined && <>
                        {String(winner) === String(playerID) && <div style={{margin: '5rem', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                            <h5 style={{textAlign: 'center', color: 'yellowgreen'}}>{t('board.enemys_fleet_defeated')}</h5>
                            {G.races[playerID].rid === 2 && G.races[playerID].commanderIsUnlocked && ctx.activePlayers[looser] !== 'reparations' &&
                            <button className='styledButton black' style={{width: 'max-content', marginTop: '2rem', padding: '1rem 2rem'}} onClick={() => moves.claimPromissoryCard(looser)}>{t('board.claim_promissory_card')}</button>}
                            
                        </div>}
                        {String(winner) !== String(playerID) && <h5 style={{margin: '5rem', textAlign: 'center', color: 'red'}}>{t('board.your_fleet_defeated')}</h5>}
                    </>}
                </>}
            </>}
            {ctx.activePlayers[playerID] === 'spaceCombat_step2' && <>
                {!assaultCannon && <>
                    <HitAssign race={G.races[ctx.currentPlayer]} units={activeTile.tdata.attacker} owner={ctx.currentPlayer} hits={ahitsA} setHits={setAhitsA} allowRepair={allHitsAssigned} ambush={ambush}/>
                    <HitAssign race={G.races[activeTile.tdata.occupied]} units={activeTile.tdata.fleet} owner={String(activeTile.tdata.occupied)} hits={ahitsD} setHits={setAhitsD} allowRepair={allHitsAssigned} ambush={ambush}/>
                </>}
                {assaultCannon && 
                    <HitAssign race={G.races[playerID]} units={String(playerID) === String(activeTile.tdata.occupied) ? activeTile.tdata.fleet : activeTile.tdata.attacker} 
                    owner={playerID} hits={ahitsA} setHits={setAhitsA} assaultCannon={true}/>
                }
            </>}
        </CardBody>
        {(!needAwait || winner !== undefined) && <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
            {needAwait && winner !== undefined && <button className='styledButton yellow' onClick={() => moves.endBattle()}>{t('board.next')}</button>}
            {ctx.activePlayers[playerID] === 'spaceCombat' && <>
                <button className='styledButton yellow' disabled = {!everyoneRolls || haveACDialog} onClick={() => moves.nextStep(hits)}>{t('board.next')}</button>
                <HitsInfo />
                <button className='styledButton red' disabled = {everyoneRolls || (anyoneRetreat !== undefined) || haveACDialog} onClick={()=>moves.retreat()}>{t('board.Retreat')}</button>
            </>}
            {ctx.activePlayers[playerID] === 'spaceCombat_step2' && <>
                {!assaultCannon && <button className='styledButton yellow' disabled = {!allHitsAssigned || haveACDialog} onClick={() => moves.nextStep(playerID === ctx.currentPlayer ? ahitsA:ahitsD, ambush ? 'ambush':null)}>{t('board.next')}</button>}
                {assaultCannon && <button className='styledButton yellow' disabled = {!allHitsAssigned || haveACDialog} onClick={() => moves.nextStep(ahitsA, 'assaultCannon')}>{t('board.next')}</button>}
                <HitsInfo />
            </>}
        </CardFooter>}
    </Card>
    {G.currentCombatActionCard && <ActionCardDialog selectedTile={selectedTile}/>}
    </>);

}

export const CombatRetreat = (args) => {
    const { G, moves, playerID, ctx } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const { selectedTile } = args;
    const activeTile = useMemo(()=> G.tiles.find(t => t.active === true), [G.tiles]);
    const race = useMemo(()=> G.races[playerID], [G.races, playerID]);
    const fleet = useMemo(() => playerID === ctx.currentPlayer ? activeTile.tdata.attacker:activeTile.tdata.fleet,[activeTile, playerID, ctx.currentPlayer]);
    const [escFleet, setEscFleet] = useState({});
    const [escGround, setEscGround] = useState({});

    const possibleTiles = useMemo(() => {
        const neighs = neighbors(G.HexGrid, [activeTile.q, activeTile.r]);
        if(activeTile.tdata.wormhole){
            const wormholes = G.tiles.filter(t => t.tid !== activeTile.tid && t.tdata.wormhole && wormholesAreAdjacent(G, activeTile.tdata.wormhole, t.tdata.wormhole));
            if(wormholes.length) neighs.push(...wormholes.map(w => ({tileId: w.tid})));
        }

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
    }, [activeTile, playerID, G]);

    const acceptableTile = useMemo(() => {
        return possibleTiles && selectedTile > -1 && possibleTiles.find(t => t.tileId === G.tiles[selectedTile].tid);
    }, [possibleTiles, selectedTile, G.tiles]);

    const technologies = useMemo(()=>{
        let result = getUnitsTechnologies([...Object.keys(fleet), 'fighter', 'mech'], race);
        result = adjustTechnologies(G, ctx, playerID, result);

        return result;
    },[G, ctx, playerID, race, fleet]);

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
        <Card className='borderedPanel combatPanel' style={{minWidth: '40%', maxWidth: '60%'}}>
            <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>{t('board.Retreat')}</h3></CardTitle>
            <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
                <div style={{display: 'flex', position: 'relative', flexDirection: 'row', margin: '1rem 0', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', border: 'solid 1px rgba(255,255,255,.15)'}}>
                <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto', marginTop: '-1.5rem', marginLeft: '-1.5rem'}}/>
                <Container>
                    <Row>
                        <Col xs={1} className='bi bi-hexagon-half' style={{color: acceptableTile ? 'yellowgreen':'red'}}></Col><Col style={{padding: 0}}>{t('board.select_retreat_system')}</Col>
                    </Row>
                    <Row>
                        <Col xs={1} className='bi bi-shield-shaded' style={{color: Object.keys(escFleet).length > 0 ? 'yellowgreen':'red'}}></Col><Col style={{padding: 0}}>{t('board.select_escape_units')}:</Col>
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
                <button className='styledButton yellow' onClick={() => moves.nextStep(selectedTile, escFleet, escGround)}>
                    {acceptableTile && Object.keys(escFleet).length > 0 ? 'Next':'Cancel'}
                </button>
            </CardFooter>
        </Card>);
}

export const Bombardment = () => {

    const { G, ctx, moves } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const activeTile = G.tiles.find(t => t.active === true);

    const getTechnology = useCallback((k) => {
        const race = G.races[ctx.currentPlayer];
        let technology = race.technologies.find(t => t.id === k.toUpperCase() && t.bombardment);

        if(!technology && race.combatActionCards.indexOf('Blitz')>-1 && ['FIGHTER', 'INFANTRY', 'MECH'].indexOf(k.toUpperCase()) === -1){
            technology = {...race.technologies.find(t => t.id === k.toUpperCase())};
            technology.bombardment = {value: 6, count: 1};
        }

        return technology;
    }, [ctx.currentPlayer, G.races]);

    const hits = useMemo(() => {
        let result = {};

        const pid = ctx.currentPlayer;
        result[pid] = 0;

        if(G.dice[pid]){
            let adj = enemyHaveCombatAC(G.races, ctx.activePlayers, ctx.currentPlayer, 'Bunker') ? -4:0;
            Object.keys(G.dice[pid]).forEach(unit => {
                let technology = getTechnology(unit);
                if(technology){
                    result[pid] += G.dice[pid][unit].dice.filter(d => d+adj >= technology.bombardment.value).length;
                }
            });
        }
        
        return result;
    }, [G.dice, ctx.currentPlayer, getTechnology, G.races, ctx.activePlayers]);

    const bombAbilities = useCallback((race, units)=>{
        const result = {};
    
        if(!enemyHaveCombatAC(G.races, ctx.activePlayers, ctx.currentPlayer, 'PLANETARY SHIELD') || race.combatActionCards.indexOf('Disable')>-1){
            Object.keys(units).forEach( k => {
                let technology = getTechnology(k);
                if(technology) result[k] = technology;
            });
        }

        return result;
    },[getTechnology, G.races, ctx]);

    const everyoneRolls = useMemo(() => {
        const attacker = bombAbilities(G.races[ctx.currentPlayer], activeTile.tdata.fleet);
        return Object.keys(attacker).length === Object.keys(G.dice[ctx.currentPlayer]).length;

    }, [G.dice, G.races, activeTile, bombAbilities, ctx.currentPlayer]);

    const activePlanet = useMemo(() => {
        return activeTile.tdata.planets.find(p => p.invasion);
    }, [activeTile]);

    const defenderForces = useMemo(() => {
        const result = {};

        if(activePlanet.units){
            Object.keys(activePlanet.units).forEach(k => {
                if(['infantry', 'mech', 'pds'].indexOf(k) > -1){
                    result[k] = activePlanet.units[k];
                }
            });
        }
        return result;
    },[activePlanet]);

    const haveACDialog = useMemo(() => {
        return G.currentCombatActionCard !== undefined;
    }, [G.currentCombatActionCard]);

    return (<>
    <Card className='borderedPanel combatPanel' style={{minWidth: '40%', maxWidth: '60%'}}>
        <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>{t('board.Bombardment')}</h3></CardTitle>
        <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
            <CombatantForces race={G.races[ctx.currentPlayer]} units={activeTile.tdata.fleet} owner={ctx.currentPlayer} combatAbility='bombardment'/>
            <CombatantForces race={G.races[activePlanet.occupied]} units={defenderForces} owner={activePlanet.occupied} combatAbility='bombardment'/>
        </CardBody>
        <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
            <button className='styledButton yellow' disabled = {!everyoneRolls || haveACDialog} onClick={()=>moves.nextStep(hits)}>{t('board.next')}</button>
            <span style={{display: 'flex', justifyContent: 'space-around', fontFamily: 'Handel Gothic', fontSize: 20, flex: 'auto', alignSelf: 'center'}}>
                {Object.keys(hits).map((h, i) => {
                    return <span key={i}>
                        <img alt='race' src={'race/icons/' + G.races[h].rid + '.png'} style={{width: '2rem'}}/>
                        {' ' + t('board.does') + ' ' + hits[h]}
                    </span>
                })}
            </span>
        </CardFooter>
    </Card>
    {G.currentCombatActionCard && <ActionCardDialog />}
    </>);

}

const LandingForces = (args) => {

    const { G, playerID } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
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
        <>
        <div style={{display: 'flex', position: 'relative', flexDirection: 'row', margin: '1rem 0', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', 
            border: String(playerID) === String(owner) ? 'solid 1px rgba(255,255,0,.5)':'solid 1px rgba(255,255,255,.25)'}}>
            <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto', marginTop: '-1.5rem', marginLeft: '-1.5rem'}}/>
            {race.retreat && <CardText style={{position: 'absolute', left: '0.25rem', top: '3rem', background: 'darkslateblue', padding: '.5rem', fontFamily: 'Handel Gothic'}}>{t('board.retreat').toUpperCase()}</CardText>}
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
        {G.currentCombatActionCard && <ActionCardDialog />}
        </>
    );

}

export const Invasion = () => {

    const { G, ctx, moves, playerID, prevStages } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
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
            let possible = (activePlanet.invasion && activePlanet.invasion.nopds) ? ['infantry', 'mech']:['infantry', 'mech', 'pds'];
            if(G.races[ctx.currentPlayer].combatActionCards.indexOf('Disable')>-1){
                possible = ['infantry', 'mech'];
            }
            if(activePlanet.units){
                Object.keys(activePlanet.units).forEach(k => {
                    if(possible.indexOf(k) > -1){
                        result[k] = activePlanet.units[k];
                    }
                });
            }
        }

        return result;
    },[activePlanet, ctx.currentPlayer, G.races]);

    const magen = useMemo(() => {
        if(activePlanet && activePlanet.invasion && !activePlanet.invasion.magenUsed){
            if(String(playerID) !== String(ctx.currentPlayer)){
                if(haveTechnology(G.races[playerID], 'MAGEN_DEFENSE_GRID')){
                    if((activePlanet.units.pds && activePlanet.units.pds.length) || (activePlanet.units.spacedock && activePlanet.units.spacedock.length)){
                        if(ctx.activePlayers[playerID] === 'invasion_await' && activePlanet.invasion.troops){
                            return true;
                        }
                    }
                }
            }
        }
    }, [activePlanet, ctx.activePlayers, playerID, ctx.currentPlayer, G.races]);

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
                        let technology = {...G.races[pid].technologies.find(t => t.id === unit.toUpperCase())};
                        
                        if(prevStages[pid] && prevStages[pid][0] === 'bombardment' && prevStages[pid].indexOf('invasion') === -1){ //just after bombardment
                            if(!technology.bombardment && G.races[pid].combatActionCards.indexOf('Blitz')>-1 && ['FIGHTER', 'INFANTRY', 'MECH'].indexOf(unit.toUpperCase()) === -1){
                                technology.bombardment = {value: 6, count: 1};
                            }

                            if(technology && technology.bombardment){
                                const adj = enemyHaveCombatAC(G.races, ctx.activePlayers, playerID, 'Bunker') ? -4:0;
                                h += G.dice[pid][unit].dice.filter((die, idx) => {
                                    const val = G.dice[pid][unit].reroll ? G.dice[pid][unit].reroll[idx] || die : die;
                                    return val+adj >= technology.bombardment.value}).length;
                            }
                        }
                        else if(unit === 'pds'){
                            if(technology && technology.spaceCannon){
                                const adj = haveTechnology(G.races[playerID], 'ANTIMASS_DEFLECTORS') ? -1:0;
                                h += G.dice[pid][unit].dice.filter((die, idx) => {
                                    const val = G.dice[pid][unit].reroll ? G.dice[pid][unit].reroll[idx] || die : die;
                                    return val+adj >= technology.spaceCannon.value}).length;
                                
                                if(G.races[playerID].combatActionCards && G.races[playerID].combatActionCards.indexOf('Maneuvering Jets') > -1){
                                    if(h > 0) h--;
                                }
                            }
                        }
                        else if(technology && technology.combat){
                            const adj = G.races[pid].combatActionCards.indexOf('Morale Boost') > -1 ? 1:0;

                            h += G.dice[pid][unit].dice.filter((die, idx) => {
                                const val = G.dice[pid][unit].reroll ? G.dice[pid][unit].reroll[idx] || die : die;
                                return val+adj >= technology.combat}).length;
                        }
                    });
                }
                result[pid] = h;
            });
        }

        return result;
    }, [G.dice, G.races, ctx.activePlayers, activePlanet, ctx.currentPlayer, playerID, magen, prevStages]);

    const assignedA = useMemo(() => {
        let result = 0;

        if(ahitsA){
            Object.keys(ahitsA).forEach(u => {
                if(ahitsA[u] && ahitsA[u].length && !u.startsWith('-')){
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
                if(ahitsD[u] && ahitsD[u].length && !u.startsWith('-')){
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
                    if(!enemyHaveCombatAC(G.races, ctx.activePlayers, playerID, 'Parley')) return true;
                }
            }
        }
    }, [ctx.currentPlayer, playerID, activePlanet, ctx.activePlayers, G.races]);

    const withNoPds = (units) => {
        const u = {...units};
        if(u.pds) delete u['pds'];
        return u;
    }

    const maxHits = useMemo(() => {
        let result = {};

        if(activePlanet && activePlanet.invasion){
            Object.keys(ctx.activePlayers).forEach(pid => {
                let fleet = (String(pid) === String(ctx.currentPlayer)) ? activePlanet.invasion.troops : withNoPds(defenderForces);
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
                            {' ' + t('board.does') + ' ' + hits[h]}
                        </span>
                    })}
                </span>
    }

    const winner = useMemo(() => {
        if(!activePlanet.invasion) return -1; //not you
        if(!activePlanet.invasion.troops){
            if(G.races[playerID].combatActionCards.indexOf('Parley')>-1){
                return playerID;
            }
            return undefined;
        }

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
    }, [activePlanet, ctx.currentPlayer, ctx.activePlayers, G.races, playerID]);

    const haveACDialog = useMemo(() => {
        return G.currentCombatActionCard !== undefined;
    }, [G.currentCombatActionCard]);

    const enemyMakeReroll = useMemo(() => {
        return enemyHaveCombatAC(G.races, ctx.activePlayers, playerID, 'Fire Team');
    }, [G.races, ctx.activePlayers, playerID]);

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

    return (<>
    <Card className='borderedPanel combatPanel' style={{minWidth: '40%', maxWidth: '60%'}}>
        <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>{landing ? t('board.Landing'): magen ? t('board.Magen_defense_grid') : t('board.Invasion')}</h3></CardTitle>
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
                    {winner === undefined && <h5 style={{margin: '5rem', textAlign: 'center'}}>{t('board.awaiting_opponent')}...</h5>}
                    {winner !== undefined && <>
                        {String(winner) === String(playerID) && <h5 style={{margin: '5rem', textAlign: 'center', color: 'yellowgreen'}}>{t('board.enemys_forces_defeated')}!</h5>}
                        {String(winner) !== String(playerID) && <h5 style={{margin: '5rem', textAlign: 'center', color: 'red'}}>{t('board.your_forces_defeated')}</h5>}
                    </>}
                </>}
            </>}
            {ctx.activePlayers[playerID] === 'invasion_step2' && <>
                {Object.keys(activePlanet.invasion).length > 0 && <HitAssign race={G.races[ctx.currentPlayer]} units={activePlanet.invasion.troops} owner={ctx.currentPlayer} hits={ahitsA} setHits={setAhitsA} allowRepair={allHitsAssigned}/>}
                <HitAssign race={G.races[activePlanet.occupied]} units={withNoPds(defenderForces)} owner={String(activePlanet.occupied)} hits={ahitsD} setHits={setAhitsD} allowRepair={allHitsAssigned}/>
            </>}
        </CardBody>
        {(!needAwait || magen || landing || (needAwait && winner !== undefined)) && <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
            {landing && <button className='styledButton yellow' onClick={() => moves.landTroops(troops)}>{troops.length > 0 ? t('board.next'):t('board.cancel')}</button>}
            {!landing && !magen && needAwait && winner !== undefined && <button className='styledButton yellow' disabled={haveACDialog || enemyMakeReroll} onClick={() => moves.endBattle()}>{t('board.next')}</button>}
            {magen && <button className='styledButton yellow' onClick={() => moves.magenDefense(ahitsA)}>{t('board.next')}</button>}
            {ctx.activePlayers[playerID] === 'invasion' && <>
                <button className='styledButton yellow' disabled = {!everyoneRolls || haveACDialog || enemyMakeReroll} onClick={() => moves.nextStep(hits, true)}>{t('board.next')}</button>
                <HitsInfo />
            </>}
            {ctx.activePlayers[playerID] === 'invasion_step2' && <>
                <button className='styledButton yellow' disabled = {!allHitsAssigned || haveACDialog || enemyMakeReroll} 
                onClick={() => moves.nextStep(playerID === ctx.currentPlayer ? ahitsA:ahitsD, prevStages[playerID])}>
                    {t('board.next')}</button>
                <HitsInfo />
            </>}
        </CardFooter>}
    </Card>
    {G.currentCombatActionCard && <ActionCardDialog />}
    </>);

}


export const ChooseAndDestroy = () => {

    const { G, playerID, moves } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const [destroyed, setDestroyed] = useState({});

    const units = useMemo(() => {
        let result = {};

        const info = G.races[playerID].mustChooseAndDestroy;
        if(info.tile === 'active'){
            const activeTile = G.tiles.find(t => t.active === true);
            if(!activeTile) return;

            if(String(activeTile.tdata.occupied) === String(playerID)){
                result = activeTile.tdata.fleet;
            }
            else if(activeTile.tdata.attacker){
                result = activeTile.tdata.attacker;
            }
        }

        return result;
    }, [G, playerID]);

    const race = useMemo(() => G.races[playerID], [G, playerID]);

    const destroy = useCallback((tag, idx, pidx, payloadId) => {

        if(payloadId && payloadId !== 'fighter') return;

        setDestroyed(produce(destroyed, draft => {
            if(!draft[tag]) draft[tag]=[];
            if(pidx === undefined){
                const dmg = draft[tag].findIndex(ship => ship.idx === idx);
                if(dmg === -1){
                    draft[tag].push({idx, hit: 1, payload:[]});
                }
                else{
                    if(draft[tag][dmg].hit === 1){
                        draft[tag][dmg].hit = 0;
                    }
                    else{
                        draft[tag][dmg].hit = 1;
                    }
                }
            }
            else{
                const dmg = draft[tag].findIndex(ship => ship.idx === idx);
                let carrier = draft[tag][dmg];

                if(!carrier){
                    draft[tag].push({idx, payload: [{pidx, id: payloadId}]});
                }
                else{       
                    let index = carrier.payload.findIndex(p => p.pidx === pidx);
                    if(index === -1){
                        carrier.payload.push({pidx, id: payloadId});
                    }
                    else{
                        carrier.payload.splice(index, 1);
                    }
                }
            }
        }));
    }, [destroyed, setDestroyed]);

    const isDestroyed = useCallback((tag, idx, pidx) => {
        let result;

        if(pidx === undefined){
            if(destroyed[tag]){
                const car = destroyed[tag].find(c => c.idx === idx);
                result = car && car.hit === 1;
            }
        }
        else{
            if(destroyed[tag]){
                const car = destroyed[tag].find(c => c.idx === idx);
                if(car && car.payload){
                    result = car.payload.find(pl => pl.pidx === pidx);
                }
            }
        }

        return result;

    }, [destroyed]);

    const technologies = useMemo(()=>{
        if(units){
            return getUnitsTechnologies([...Object.keys(units), 'fighter', 'mech'], race);
        }
        else{
            return {};
        }
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

    const canNext = useMemo(() => {
        const info = G.races[playerID].mustChooseAndDestroy;
        let selected = 0;

        Object.keys(destroyed).forEach(tag => {
            selected += destroyed[tag].filter(u => u.hit === 1).length;
            destroyed[tag].forEach(car => {
                if(car.payload && car.payload.length){
                    selected += car.payload.length;
                }
            });
        });

        let max = 0;
        Object.keys(units).forEach(tag => {
            max += units[tag].length;
            units[tag].forEach(car => {
                if(car.payload && car.payload.length){
                    max += car.payload.filter(p => p.id === 'fighter').length;
                }
            });
        });

        return selected >= Math.min(max, info.count);
    }, [G, playerID, destroyed, units]);

    return (
        <Card className='borderedPanel combatPanel' style={{minWidth: '40%', maxWidth: '60%', backgroundColor: 'rgba(160, 160, 160, 0.85)', color: 'black'}}>
            <CardTitle style={{margin: 0, borderBottom: 'solid 1px rgba(119, 22, 31, 0.6)'}}><h3>{t('board.Choose') + ' ' + G.races[playerID].mustChooseAndDestroy.count + ' ' + t('board.ships_to_destroy')}</h3></CardTitle>
            <CardBody style={{display: 'flex', flexDirection: 'column', padding: 0 }}>
                <div style={{display: 'flex', position: 'relative', flexDirection: 'row', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.75)', border: 'solid 1px rgba(255,255,0,.5)'}}>
                    <CardImg src={'race/' + race.rid + '.png'} style={{height: '10rem', width: 'auto', marginTop: '-1.5rem', marginLeft: '-1.5rem'}}/>
                    {race.retreat && <CardText style={{position: 'absolute', left: '0.25rem', top: '3rem', background: race.retreat === 'cancel' ? 'gray':'darkslateblue', padding: '.5rem', fontFamily: 'Handel Gothic'}}>{t('board.retreat').toUpperCase()}</CardText>}
                    <div style={{display: 'flex', flexWrap: 'wrap'}}>
                        {Object.keys(units).map((u, i) => {
                            return <div key={i} style={{marginLeft: '1rem', display: 'flex', flexWrap: 'wrap'}}>
                                {units[u].map((t, j) =>{
                                    const hh = haveHit(u, j);
                                    
                                    let className=technologies[u].sustain ? 'sustain_ability':'';
                                    className += ' hit_assigned' + hh;

                                    return <div key={j} style={{margin: '0.25rem 1rem 0 0', display: 'flex', alignItems: 'flex-start'}}>
                                        <div style={{display: 'flex', flexDirection: 'column'}}>
                                            <Button style={{width: '5rem', padding: 0, background: isDestroyed(u, j) ? '#bb2d3b':'none', border: 'none'}} 
                                                className={className} outline onClick={() => destroy(u, j)}>
                                                <img alt='unit' src={'units/' + u.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                            </Button>
                                        </div>
                                        <div style={{display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', maxWidth: '10rem'}}>
                                            {t.payload && t.payload.map((p, l) =>{
                                                if(p){
                                                    const hh2 = haveHit(u, j, l);

                                                    let clName = technologies[p.id] && technologies[p.id].sustain ? 'sustain_ability':'';
                                                    clName += ' hit_assigned' + hh2;

                                                    return <div key={l} style={{display: 'flex', flexDirection: 'column'}}>
                                                    <Button outline onClick={() => destroy(u, j, l, p.id)} className={clName}
                                                        style={{width: '2rem', background: isDestroyed(u, j, l, p.id) ? '#bb2d3b':'transparent',
                                                        border: 'solid 1px rgba(255,255,255,.15)', margin: '.1rem', padding: 0}}>
                                                        <img alt='unit' src={'units/' + p.id.toUpperCase() + '.png'} style={{width: '100%'}}/>
                                                    </Button>
                                                    </div>
                                                }
                                                return <></>
                                            })}
                                        </div>
                                    </div>})}
                            </div>
                        })}
                    </div>
                </div>
            </CardBody>
            <CardFooter style={{background: 'none', display: 'flex', flexDirection: 'row-reverse', borderTop: 'solid 1px rgba(119, 22, 31, 0.6)'}}>
                <button disabled={!canNext} className='styledButton yellow' onClick={() => moves.chooseAndDestroy(destroyed)}>{t('board.done')}</button>
            </CardFooter>
        </Card>

    );

}