import { Card, CardImg,  CardTitle, CardBody, CardFooter, ButtonGroup, Button, Row, Col, Input, Modal, ModalFooter, ModalBody, Label } from 'reactstrap';
import { useState, useMemo, useContext, useCallback, useEffect, useRef } from 'react';
import { produce } from 'immer';
//import techData from './techData.json';
import { StateContext, LocalizationContext, haveTechnology, UNITS_LIMIT, getPlanetByName, getMyNeighbors, wormholesAreAdjacent} from './utils';
import { neighbors } from './Grid.js'
import { UnmeetReqs, PlanetsRows, GetTechType } from './dialogs.js';

export const ActionCardDialog = ({selectedTile, selectedPlanet, selectedUnit}) => {
    const {G, ctx, playerID, moves, exhaustedCards, exhaustTechCard, PLANETS, UNITS} = useContext(StateContext);
    const {t} = useContext(LocalizationContext);
    const [selection, setSelection] = useState();
    const [selection2, setSelection2] = useState();
    const [exhausted, setExhausted] = useState({});
    const [exhausted2, setExhausted2] = useState({});
    const [tabs, setTabs] = useState(0);

    const notarget = useMemo(() => ['Economic Initiative', 'Fighter Conscription', 'Industrial Initiative', 
    'Rise of a Messiah', 'Counterstroke', 'Flank Speed', 'Harness Energy', 'Lost Star Chart', 'Master Plan', 
    'Rally', 'Solar Flare', 'Upgrade', 'War Machine', 'Distinguished Councilor', 'Hack Election', 'Insider Information', 'Veto',
    'Fire Team', 'Infiltrate', 'Intercept', 'Maneuvering Jets', 'Morale Boost', 'Parley', 'Reflective Shielding', 'Salvage', 
    'Scramble Frequency', 'Shields Holding', 'Courageous to the End', 'Political Stability', 'Summit'], []);

    const card = useMemo(() => {
        let c = G.races[ctx.currentPlayer].currentActionCard;

        if(!c && ctx.phase === 'acts' && ctx.activePlayers && G.currentCombatActionCard){
            c = G.currentCombatActionCard;
        }
        else if(!c && ctx.phase === 'agenda'){
            c = G.currentAgendaActionCard;
        }
        else if(!c){ //tactical
            c = G.currentTacticalActionCard;
        }

        return c;
    }, [G.races, ctx, G.currentTacticalActionCard, G.currentAgendaActionCard, G.currentCombatActionCard]);

    const cardOwner = useMemo(() => card.playerID !== undefined ? card.playerID : playerID, [card, playerID]);

    const requirements = useMemo(() => {
        if(['Focused Research', 'Technology Rider', 'Enigmatic Device'].indexOf(card.id) > -1 && selection){
            
            if(selection){ //technology
                let adjSpec = [];
                if(haveTechnology(G.races[cardOwner], 'PSYCHOARCHAEOLOGY')){
                    PLANETS.forEach(p => {
                        if(p.specialty){
                            adjSpec.push(p.name);
                        }
                    });
                }
                else{
                    adjSpec = Object.keys(exhausted);
                }
                
                const ex2 = {};
                ex2[selection.id] = selection; //ex2[selection] = technology;
                const reqs = UnmeetReqs({separate: true, PLANETS, ex2, adjSpec, G, playerID: cardOwner});
                reqs.adjSpec = adjSpec;
                return reqs;
            }

        }
    }, [G, card, cardOwner, PLANETS, selection, exhausted]);

    const myTarget = useMemo(() => {
        
        let result = notarget.indexOf(card.id) > -1;

        if(card.when === 'ACTION'){
            if(card.id === 'Cripple Defenses'){
                if(selectedTile > -1 && selectedPlanet > -1){
                    result = {tidx: selectedTile, pidx: selectedPlanet};
                }
            }
            else if(card.id === 'Frontline Deployment'){
                if(selectedTile > -1 && selectedPlanet > -1){
                    const planet = G.tiles[selectedTile].tdata.planets[selectedPlanet];
                    if(String(planet.occupied) === String(cardOwner)){
                        result = {tidx: selectedTile, pidx: selectedPlanet};
                    }
                }
            }
            else if(card.id === 'Ghost Ship'){
                if(selectedTile > -1 && (!UNITS['destroyer'] || UNITS['destroyer'] < UNITS_LIMIT['destroyer'])){
                    const tile = G.tiles[selectedTile];
                    if((String(tile.tdata.occupied) === String(cardOwner)) || !tile.tdata.occupied){
                        if(tile.tdata.type !== 'green' && tile.tdata.wormhole){
                            result = {tidx: selectedTile};
                        }
                    }
                }
            }
            else if(card.id === 'Focused Research'){
                if(selection){
                    let stopThere;
                    const AI_DEVELOPMENT = exhaustedCards.indexOf('AI_DEVELOPMENT_ALGORITHM') > -1;

                    if(AI_DEVELOPMENT){
                        stopThere = requirements.upgrades.length > 1 || requirements.other.length > 0;
                    }
                    else{
                        stopThere = requirements.upgrades.length > 0 || requirements.other.length > 0;
                    }
                    if(!stopThere) result = {tech: selection, AI_DEVELOPMENT, exhausted}
                }
            }
            else if(card.id === 'Impersonation'){
                if(exhausted){
                    let sum = 0;
                    Object.keys(exhausted).forEach(pname => {
                        const planet = getPlanetByName(G.tiles, pname);
                        sum += planet.influence;
                    });
                    const ex = Object.keys(exhausted).map(pname => getPlanetByName(G.tiles, pname));
                    if(sum >= 3) result = {exhausted: ex}
                }
            }
            else if(card.id === 'Insubordination' || card.id === 'Spy'){
                if(selection && String(selection) !== String(cardOwner)){
                    result = { playerID: selection }
                }
            }
            else if(card.id === 'Lucky Shot'){
                if(selectedUnit && ['dreadnought', 'cruiser', 'destroyer'].indexOf(selectedUnit.unit)>-1){
                    const tile = G.tiles[selectedUnit.tile];
                    if(tile.tdata.planets && tile.tdata.planets.find(p => String(p.occupied) === String(cardOwner))){
                        result = { selectedUnit }
                    }
                }
            }
            else if(card.id === 'Mining Initiative'){
                if(exhausted){
                    const ex = Object.keys(exhausted).map(pname => getPlanetByName(G.tiles, pname));
                    result = {exhausted: ex}
                }
            }
            else if(card.id === 'Plagiarize'){
                if(selection && !selection.racial && selection.rid !== undefined){
                    const neigh = G.races.find(r => r.rid === selection.rid);
                    if(neigh.knownTechs.indexOf(selection.id) > -1){
                        if(exhausted){
                            let sum = 0;
                            Object.keys(exhausted).forEach(pname => {
                                const planet = getPlanetByName(G.tiles, pname);
                                sum += planet.influence;
                            });
                            
                            if(sum >= 5) result = {tech: selection, exhausted}
                        }
                    }
                }
            }
            else if(card.id === 'Enigmatic Device'){
                if(selection){
                    if(exhausted){
                        let sum = 0;
                        Object.keys(exhausted).forEach(pname => {
                            const planet = getPlanetByName(G.tiles, pname);
                            sum += planet.resources; //todo: need count tg also
                        });
                        
                        if(sum >= 6) result = {tech: selection, exhausted}
                    }
                }
            }
            else if(card.id === 'Plague' || card.id === 'Uprising'){
                if(selectedTile > -1 && selectedPlanet > -1){
                    const planet = G.tiles[selectedTile].tdata.planets[selectedPlanet];
                    if(planet.occupied !== undefined && String(planet.occupied) !== String(cardOwner)){
                        if(card.id !== 'Uprising' || G.tiles[selectedTile].tdata.type !== 'green'){
                            result = {tidx: selectedTile, pidx: selectedPlanet}
                        }
                    }
                }
            }
            else if(card.id === 'Reactor Meltdown'){
                if(selectedTile > -1 && selectedPlanet > -1){
                    const tile = G.tiles[selectedTile];
                    if(tile.tdata.type !== 'green'){
                        result = {tidx: selectedTile, pidx: selectedPlanet}
                    }
                }
            }
            else if(card.id === 'Repeal Law'){
                if(selection){
                    const law = G.laws.find(l => l.id === selection)
                    result = {law}
                }
            }
            else if(card.id === 'Signal Jamming'){
                if(selectedTile > -1){
                    const tile = G.tiles[selectedTile];
                    let accept = false;

                    if(String(tile.tdata.occupied) === String(cardOwner) && tile.tdata.fleet && Object.keys(tile.tdata.fleet).length > 0){
                        accept = true;
                    }
                    else{
                        const neigh = neighbors(G.HexGrid, [tile.q, tile.r]);
                        neigh.find( n => {
                            const t = G.tiles.find(tl => tl.tid === n.tileId);
                            if(String(t.tdata.occupied) === String(cardOwner) && t.tdata.fleet && Object.keys(t.tdata.fleet).length > 0){
                                accept = true;
                                return true;
                            }
                            return false;
                        });
                    }

                    if(accept && tile.tdata.type !== 'green'){
                        if(selection !== undefined && String(selection) !== String(cardOwner)){
                            result = {tidx: selectedTile, playerID: selection};
                        }
                    }
                }
            }
            else if(card.id === 'Tactical Bombardment'){
                if(selectedTile > -1){
                    const tile = G.tiles[selectedTile];
                    if(String(tile.tdata.occupied) === String(cardOwner) && tile.tdata.fleet && Object.keys(tile.tdata.fleet).length > 0){
                        const bomb = Object.keys(tile.tdata.fleet).find(k => {
                            const technology = G.races[cardOwner].technologies.find(t => t.id === k.toUpperCase());
                            return (technology && technology.bombardment);
                        });
                        if(bomb){
                            result = {tidx: selectedTile};
                        }
                    }
                }
            }
            else if(card.id === 'Unexpected Action'){
                if(selectedTile > -1){
                    const tile = G.tiles[selectedTile];
                    const race = G.races[cardOwner];
                    if(tile.tdata.tokens && tile.tdata.tokens.indexOf(race.rid) > -1){
                        result = {tidx: selectedTile}
                    }
                }
            }
            else if(card.id === 'Unstable Planet'){
                if(selectedTile > -1 && selectedPlanet > -1){
                    const planet = G.tiles[selectedTile].tdata.planets[selectedPlanet];
                    if(planet.trait === 'hazardous'){
                        result = {tidx: selectedTile, pidx: selectedPlanet};
                    }
                }
            }
            else if(card.id === 'War Effort'){
                if(selectedTile > -1 && (!UNITS['cruiser'] || UNITS['cruiser'] < UNITS_LIMIT['cruiser'])){
                    const tile = G.tiles[selectedTile];
                    if(String(tile.tdata.occupied) === String(cardOwner) && tile.tdata.fleet && Object.keys(tile.tdata.fleet).length > 0){
                        result = {tidx: selectedTile};
                    }
                }
            }
        }
        else if(card.when === 'TACTICAL'){
            if(card.id === 'Experimental Battlestation'){
                if(selectedTile > -1 && selectedPlanet > -1){
                    const tile = G.tiles[selectedTile];
                    const planet = tile.tdata.planets[selectedPlanet];

                    if(planet && planet.units && planet.units.spacedock && planet.units.spacedock.length){
                        result = {tidx: selectedTile, pidx: selectedPlanet};
                    }
                }
            }
            else if(card.id === 'Forward Supply Base'){
                if(selection && String(selection) !== String(cardOwner)){
                    result = { playerID: selection }
                }
            }
            else if(card.id === 'In The Silence Of Space'){
                if(selectedTile > -1){
                    result = {tidx: selectedTile};
                }
            }
            else if(card.id === 'Reparations'){
                if(exhausted2 && Object.keys(exhausted2).length){
                    const ex2 = Object.keys(exhausted2).map(pname => getPlanetByName(G.tiles, pname));
                    result = {exhausted2: ex2}

                    if(exhausted && Object.keys(exhausted).length){
                        const ex = Object.keys(exhausted).map(pname => getPlanetByName(G.tiles, pname));
                        result.exhausted = ex;
                    }
                }
            }
        }
        else if(card.when === 'AGENDA'){
            if(['Ancient Burial Sites', 'Assassinate Representative', 'Confusing Legal Text'].indexOf(card.id) > -1){
                if(selection !== undefined && String(selection) !== String(cardOwner)){
                    result = { playerID: selection }
                }
            }
            else if(card.id === 'Bribery'){
                if(selection !== undefined && selection > 0){
                    result = { tg: selection }
                }
            }
            else if(card.id === 'Construction Rider'){
                if(selection !== undefined && selectedTile > -1 && selectedPlanet > -1){
                    const tile = G.tiles[selectedTile];
                    const planet = tile.tdata.planets[selectedPlanet];

                    if(String(planet.occupied) === String(playerID)){
                        if(!planet.units || !planet.units.spacedock || !planet.units.spacedock.length){
                            if(!UNITS['spacedock'] || UNITS['spacedock'] < UNITS_LIMIT['spacedock']){
                                result = { selection, tidx: selectedTile, pidx: selectedPlanet }
                            }
                        }
                    }
                }
            }
            else if(card.id === 'Diplomacy Rider'){
                if(selection !== undefined && selectedTile > -1){
                    const tile = G.tiles[selectedTile];

                    if(tile.tdata.planets && tile.tdata.planets.find(p => String(p.occupied) === String(playerID))){
                        result = { selection, tidx: selectedTile }
                    }
                }
            }
            else if(['Imperial Rider', 'Leadership Rider', 'Politics Rider', 'Sanction', 'Trade Rider'].indexOf(card.id)>-1){
                if(selection !== undefined){
                    result = { selection }
                }
            }
            else if(card.id === 'Technology Rider'){
                if(selection){
                    let stopThere;
                    const AI_DEVELOPMENT = exhaustedCards.indexOf('AI_DEVELOPMENT_ALGORITHM') > -1;

                    if(AI_DEVELOPMENT){
                        stopThere = requirements.upgrades.length > 1 || requirements.other.length > 0;
                    }
                    else{
                        stopThere = requirements.upgrades.length > 0 || requirements.other.length > 0;
                    }
                    if(!stopThere && selection2 !== undefined){
                        result = {tech: selection, selection: selection2, AI_DEVELOPMENT, exhausted}
                    }
                }
            }
            else if(card.id === 'Warfare Rider'){
                if(selection !== undefined && selectedTile > -1){
                    const tile = G.tiles[selectedTile];

                    if(String(tile.tdata.occupied) === String(playerID)){
                        if(tile.tdata.fleet && Object.keys(tile.tdata.fleet).length){
                            if(!UNITS['dreadnought'] || UNITS['dreadnought'] < UNITS_LIMIT['dreadnought']){
                                result = { selection, tidx: selectedTile }
                            }
                        }
                    }
                }
            }
        }
        else if(card.when === 'COMBAT'){
            if(card.id === 'Ghost Squad'){
                if(selection){
                    result = selection
                }
            }
            else if(card.id === 'Skilled Retreat'){
                if(!G.dice || !G.dice[playerID] || Object.keys(G.dice[playerID]).length === 0){
                    if(selectedTile > -1){
                        const tile = G.tiles[selectedTile];
                        if(tile && (tile.tdata.occupied === undefined || String(tile.tdata.occupied) === String(playerID))){
                            const activeTile = G.tiles.find(t => t.active === true);
                            const neigh = neighbors(G.HexGrid, [activeTile.q, activeTile.r]);
                            const isAdjacent = neigh.find( n => {
                                return n.tileId === G.tiles[selectedTile].tid;
                            });

                            if(isAdjacent || (activeTile.tdata.wormhole && tile.tdata.wormhole && wormholesAreAdjacent(G, activeTile.tdata.wormhole, tile.tdata.wormhole))){
                                result = { tidx: selectedTile };
                            }
                            
                        }
                    }
                }
            }
            else if(card.id === 'Direct Hit'){
                if(selection && selection.tag && selection.idx !== undefined){
                    result = {tag: selection.tag, idx: selection.idx}
                }
            }
        }
        else if(card.when === 'STRATEGY'){
            if(card.id === 'Public Disgrace'){
                if(selection !== undefined && String(selection) !== String(cardOwner)){
                    result = { playerID: selection }
                }
            }
        }

        return result;
    }, [card, selectedPlanet, selectedTile, notarget, selection, selection2,
        requirements, exhaustedCards, exhausted, exhausted2, G, 
        cardOwner, UNITS, selectedUnit, playerID]);

    const isMine = useMemo(() => {
        return String(playerID) === String(cardOwner);
    }, [playerID, cardOwner]);

    const planetsRowsClick = useCallback((pname)=> {
        const solo = card.id === 'Mining Initiative' || card.id === 'Reparations';

        if(!solo){
            if(!PLANETS.find(p => p.name === pname).exhausted){
                setExhausted(produce(exhausted, draft => {
                    if(draft[pname]){
                        delete draft[pname];
                    }
                    else{
                        draft[pname] = true;
                    }
                }));
            }
        }
        else{
            setExhausted(produce(exhausted, draft => {
                if(draft[pname]){
                    delete draft[pname];
                }
                else{
                    Object.keys(draft).forEach(k => delete draft[k]);
                    draft[pname] = true;
                }
            }));
        }
    }, [exhausted, PLANETS, card.id]);


    const planetsRowsClick2 = useCallback((pname)=> {
        
        setExhausted2(produce(exhausted2, draft => {
            if(draft[pname]){
                delete draft[pname];
            }
            else{
                Object.keys(draft).forEach(k => delete draft[k]);
                draft[pname] = true;
            }
        }));

    }, [exhausted2]);

    const myNeighbors = useMemo(() => {
        if(card.id === 'Plagiarize'){
            return getMyNeighbors(G, cardOwner);
        }
    }, [card.id, G, cardOwner]);

    const getPlayerPlanets = useCallback((pid, exhausted) => {
        const arr = [];
        G.tiles.forEach( t => {
            if(t.tdata.planets && t.tdata.planets.length){
                t.tdata.planets.forEach(p => {
                    if(String(p.occupied) === String(pid) && Boolean(p.exhausted) === Boolean(exhausted)){
                        arr.push({...p, tid: t.tid});
                    }
                })
            }
        });

        return arr;
    }, [G.tiles]);

    const doneClick = useCallback(() => {
        if(card.when === 'COMBAT'){
            moves.actionCardDone();
        }
        else{
            moves.done();
        }
        if(card.id === 'War Machine'){
            exhaustTechCard(card.id);
        }
    }, [card, exhaustTechCard, moves]);

    const haveSabotageCard = useMemo(() => G.races[playerID].actionCards && G.races[playerID].actionCards.find(c => c.id === 'Sabotage'), [G.races, playerID]);
    const isSabotaged = useMemo(() => {
        return card.reaction && Object.keys(card.reaction).find(pid => card.reaction[pid] === 'sabotage') !== undefined;
    }, [card]);

    let style = {border: 'solid 1px rgba(74, 111, 144, 0.42)', maxWidth: '60%', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, .85)', position: 'absolute', margin: '5rem'};
    if(card.when === 'COMBAT'){
        style = {...style, right: '25%', bottom: '5%'}
    }

    return <Card style={style}>
                <CardTitle style={{borderBottom: '1px solid coral', color: 'black'}}><h3>{t('board.action_card')}</h3></CardTitle>
                <CardBody style={{display: 'flex', color: 'black', width: 'min-content'}}>
                    {card.when !== 'COMBAT' && <div>
                        <CardImg src={'race/'+ G.races[cardOwner].rid +'.png'} style={{width: '205px'}}/>
                    </div>}
                    <div style={{display: 'flex', flexDirection: 'column', padding: '0 1rem 1rem 1rem', minWidth: '30rem'}}>
                        <h6 style={{margin: '0 0 1rem 1rem'}}>{card.when !== 'COMBAT' && t('board.when_' + card.when) + ':'}
                            {card.when === 'COMBAT' && <><CardImg src={'race/icons/'+ G.races[cardOwner].rid +'.png'} style={{width: '2rem'}}/>{' '+G.races[cardOwner].name}</>}
                        </h6>
                        <div style={{padding: '1rem', backgroundColor: 'rgba(0,0,0,.15)', position: 'relative'}}>
                            <h5>{t('cards.actions.' + card.id + '.label')}</h5>
                            <p>{t('cards.actions.' + card.id + '.description')}</p>
                        </div>

                        {(notarget.indexOf(card.id) === -1 && !(card.id === 'Skilled Retreat' && isMine && !card.target)) && 
                        <h6 style={{margin: '2rem 1rem 1rem 1rem'}}>{t('board.target')+':'}</h6>}

                        {isMine && !card.target && card.when !=='COMBAT' && <div style={{backgroundColor: 'rgba(0,0,0,.15)', minHeight: '3.5rem', maxHeight: '30rem'}}>
                            {['Cripple Defenses', 'Frontline Deployment', 'Plague', 'Reactor Meltdown', 
                            'Unstable Planet', 'Uprising', 'Experimental Battlestation'].indexOf(card.id) > -1 && <PlanetInfo tidx={selectedTile} pidx={selectedPlanet}/>}
                            {['Ghost Ship', 'Tactical Bombardment', 'Unexpected Action', 'War Effort', 'In The Silence Of Space'].indexOf(card.id) > -1 && <TileInfo tidx={selectedTile}/>}
                            {card.id === 'Focused Research' && <TechnologySelect  races={[G.races[playerID]]}  onSelect={setSelection} requirements={requirements} 
                                exhausted={exhausted} setExhausted={setExhausted}/>}
                            {['Impersonation', 'Mining Initiative'].indexOf(card.id) > -1 && <div style={{overflowY: 'auto', maxHeight: '11rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                <PlanetsRows PLANETS={PLANETS} exhausted={exhausted} onClick={planetsRowsClick} /></div>}
                            {['Insubordination', 'Spy', 'Forward Supply Base'].indexOf(card.id) > -1 && <PlayerSelect selected={selection} onSelect={setSelection}/>}
                            {['Lucky Shot'].indexOf(card.id) > -1 && <UnitInfo selectedUnit={selectedUnit} />}
                            {card.id === 'Enigmatic Device' && <>
                                <TechnologySelect onSelect={setSelection} races={[G.races[playerID]]}/>
                                <div style={{overflowY: 'auto', maxHeight: '11rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                    <PlanetsRows PLANETS={PLANETS} exhausted={exhausted} onClick={planetsRowsClick} />
                                </div>
                                </>}
                            {card.id === 'Plagiarize' && <>
                                <TechnologySelect onSelect={setSelection} races={myNeighbors.map(n => G.races[n])}/>
                                {myNeighbors.length > 0 && <div style={{overflowY: 'auto', maxHeight: '11rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                    <PlanetsRows PLANETS={PLANETS} exhausted={exhausted} onClick={planetsRowsClick} />
                                </div>}
                                </>}
                            {card.id === 'Repeal Law' && <LawSelect onSelect={(law)=>setSelection(law)}/>}
                            {card.id === 'Signal Jamming' && <><TileInfo tidx={selectedTile}/><PlayerSelect selected={selection}  onSelect={setSelection}/></>}
                            {card.id === 'Reparations' && <>
                                <ButtonGroup>
                                    <Button color={tabs === 0 ? 'dark':'light'} onClick={()=>setTabs(0)}>1. {t('board.exhaust_enemys_planet')}</Button>
                                    <Button color={tabs === 1 ? 'dark':'light'} onClick={()=>setTabs(1)}>2. {t('board.ready_your_planet')}</Button>
                                </ButtonGroup>
                                <div style={{overflowY: 'auto', maxHeight: '11rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                    {tabs === 0 && <PlanetsRows PLANETS={getPlayerPlanets(ctx.currentPlayer)} exhausted={exhausted2} onClick={planetsRowsClick2} />}
                                    {tabs === 1 && <PlanetsRows PLANETS={PLANETS.filter(p => p.exhausted === true)} exhausted={exhausted} onClick={planetsRowsClick} />}
                                </div>
                            </>}
                            {['Ancient Burial Sites', 'Assassinate Representative', 'Confusing Legal Text', 'Public Disgrace'].indexOf(card.id) > -1 && <PlayerSelect selected={selection} onSelect={setSelection} noTokensInfo={true}/>}
                            {card.id === 'Bribery' && <PayTg onChange={setSelection}/>}
                            {card.id === 'Construction Rider' && <>
                                <Predict onSelect={setSelection}/>
                                <p style={{margin: '1rem 0 0 1rem'}}><b>{t('board.choose_one') + ':'}</b></p>
                                <div style={{padding: '0 .5rem 1rem'}}><PlanetInfo tidx={selectedTile} pidx={selectedPlanet}/></div>
                            </>}
                            {['Diplomacy Rider', 'Warfare Rider'].indexOf(card.id) > -1 && <>
                                <Predict onSelect={setSelection}/>
                                <p style={{margin: '1rem 0 0 1rem'}}><b>{t('board.choose_one') + ':'}</b></p>
                                <TileInfo tidx={selectedTile}/>
                            </>}
                            {card.id === 'Technology Rider' && <>
                                <Predict onSelect={setSelection2}/>
                                <TechnologySelect onSelect={setSelection} races={[G.races[playerID]]} requirements={requirements} exhausted={exhausted} setExhausted={setExhausted}/>
                            </>}
                            {['Imperial Rider', 'Leadership Rider', 'Politics Rider', 'Sanction', 'Trade Rider'].indexOf(card.id) > -1 && <Predict onSelect={setSelection}/>}
                        </div>}

                        {isMine && card.id === 'Ghost Squad' && !card.target && <div style={{backgroundColor: 'rgba(0,0,0,.15)', minHeight: '3.5rem', maxHeight: '30rem', padding: '1rem'}}>
                            <ForcesRelocation onResult={setSelection}/>
                        </div>}
                        {isMine && card.id === 'Direct Hit' && !card.target && <div style={{backgroundColor: 'rgba(0,0,0,.15)', minHeight: '3.5rem', maxHeight: '30rem', padding: '1rem'}}>
                            <SelectSustained onSelect={setSelection} selected={selection} initiator={playerID}/>
                        </div>}

                        {card.target && <div style={{backgroundColor: 'rgba(0,0,0,.15)', minHeight: '3.5rem', maxHeight: '30rem'}}>
                            {['Cripple Defenses', 'Frontline Deployment', 'Plague', 'Reactor Meltdown', 'Unstable Planet', 'Uprising', 
                            'Experimental Battlestation'].indexOf(card.id) > -1 && <PlanetInfo tidx={card.target.tidx} pidx={card.target.pidx}/>}
                            {['Ghost Ship', 'Tactical Bombardment', 'Unexpected Action', 'War Effort', 'In The Silence Of Space', 'Skilled Retreat'].indexOf(card.id) > -1 && <TileInfo tidx={card.target.tidx}/>}
                            {['Focused Research', 'Plagiarize', 'Enigmatic Device'].indexOf(card.id) > -1 && <div style={{padding: '1rem'}}><OneTechLine technology={card.target.tech}/></div>}
                            {['Impersonation', 'Mining Initiative'].indexOf(card.id) > -1 && <div style={{overflowY: 'auto', maxHeight: '11rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                <PlanetsRows PLANETS={card.target.exhausted} /></div>}
                            {['Insubordination', 'Spy', 'Forward Supply Base'].indexOf(card.id) > -1 && <OneLinePlayerInfo race={G.races[card.target.playerID]}/>}
                            {['Lucky Shot'].indexOf(card.id) > -1 && <UnitInfo selectedUnit={card.target.selectedUnit} />}
                            {card.id === 'Plague' && Object.keys(card.reaction).length === (Object.keys(ctx.activePlayers).length - 1) && 
                                <div style={{padding: '1rem'}}>
                                <b>Rolls: </b>
                                {card.dice.map((d, j) =>{
                                    let color = (d >= 6) ? 'success':'light';
                                    return <Button key={j} size='sm' color={color} 
                                        style={{borderRadius: '5px', fontFamily: 'Handel Gothic', padding: 0, margin: '.25rem', fontSize: '12px', width: '1.25rem', maxWidth:'1.25rem', height: '1.25rem'}}>
                                        {('' + d).substr(-1)}</Button>
                                })}
                                </div>}
                            {card.id === 'Repeal Law' && <div style={{padding: '1rem'}}><b>{card.target.law.id}</b><p>{card.target.law.for}</p></div>}
                            {card.id === 'Signal Jamming' && <><TileInfo tidx={selectedTile}/><OneLinePlayerInfo race={G.races[card.target.playerID]}/></>}
                            {card.id === 'Reparations' && <>
                                    <div style={{backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                        <b style={{color: 'white', padding: '1rem', display: 'block'}}>{t('board.exhaust_enemys_planet')}:</b>
                                        <div style={{overflowY: 'auto', maxHeight: '5rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                            <PlanetsRows PLANETS={card.target.exhausted2} />
                                        </div>
                                    </div>
                                    <div style={{backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                        <b style={{color: 'white', padding: '1rem', display: 'block'}}>{t('board.ready_your_planet')}:</b>
                                        <div style={{overflowY: 'auto', maxHeight: '5rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                            <PlanetsRows PLANETS={card.target.exhausted} />
                                        </div>
                                    </div>
                            </>}
                            {['Ancient Burial Sites', 'Assassinate Representative', 'Confusing Legal Text', 'Public Disgrace'].indexOf(card.id) > -1 && <OneLinePlayerInfo race={G.races[card.target.playerID]}/>}
                            {card.id === 'Bribery' && <h5 style={{fontSize: '50px', width: '15rem', margin: '1rem'}}>
                                {card.target.tg}<Button tag='img' src='/icons/trade_good_1.png' color='warning' 
                                    style={{marginLeft: '1rem', width: '4rem', padding: '.5rem', borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px', 
                                    backgroundColor: 'rgba(33, 37, 41, 0.95)'}} />
                            </h5>}
                            {['Construction Rider', 'Diplomacy Rider', 'Imperial Rider', 'Leadership Rider', 
                            'Politics Rider', 'Sanction', 'Trade Rider', 'Warfare Rider'].indexOf(card.id) > -1 && <h6 style={{margin: '1rem'}}> {selection.toUpperCase()} </h6>}
                            {card.id === 'Technology Rider' && <h6 style={{margin: '1rem'}}> {selection2.toUpperCase()} </h6>}
                            {card.id === 'Insider Information' && card.playerID === playerID && Object.keys(card.reaction).length === (Object.keys(ctx.activePlayers).length - 1) && card.nextAgenda && 
                            <div style={{padding: '1rem'}}>
                                <h6>{card.nextAgenda.id + ' ' + card.nextAgenda.type}</h6>
                                {card.nextAgenda.elect && <b>{'Elect: ' + card.nextAgenda.elect}</b>}
                                <p style={{margin: 0}}>{card.nextAgenda.for && <>{card.nextAgenda.against ? <b>{'For: '}</b> :''} {card.nextAgenda.for}</>}</p>
                                <p>{card.nextAgenda.against && <><b>{'Against: '}</b>{card.nextAgenda.against}</>}</p>
                            </div>}
                            {card.id === 'Ghost Squad' && <ForcesRelocationRO selection={selection}/>}
                            {card.id === 'Courageous to the End' && card.target.id && Object.keys(card.reaction).length === (Object.keys(ctx.activePlayers).length - 1) && <>
                                <CardImg style={{width: '5rem', margin: '1rem', float: 'left'}} src={'units/' + card.target.id.toUpperCase() + '.png'}/>
                                <div style={{padding: '1rem'}}>
                                <b>Rolls: </b>
                                {card.dice.map((d, j) =>{
                                    let color = (d >= card.target.combat) ? 'success':'light';
                                    return <Button key={j} size='sm' color={color} 
                                        style={{borderRadius: '5px', fontFamily: 'Handel Gothic', padding: 0, margin: '.25rem', fontSize: '12px', width: '1.25rem', maxWidth:'1.25rem', height: '1.25rem'}}>
                                        {('' + d).substr(-1)}</Button>
                                })}
                                </div>
                            </>}
                            {card.id === 'Direct Hit' && card.target.tag && <div style={{margin: '1rem'}}><SelectSustained selected={selection} initiator={card.playerID}/></div>}
                        </div>}
                    </div>
                </CardBody>
                <CardFooter style={{background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid coral'}}>
                    {isMine && <>
                        <Button color='danger' disabled={isSabotaged} onClick={card.when === 'COMBAT' ? ()=>moves.actionCardCancel() : ()=>moves.cancel()}>{t('board.cancel')}</Button>
                        {!card.target && <Button color='success' onClick={card.when === 'COMBAT' ? ()=>moves.actionCardNext(myTarget) : ()=>moves.next(myTarget)} disabled={!myTarget}>{t('board.next')}</Button>}
                    </>}
                    {!isMine && !card.reaction[playerID] && <>
                        <Button style={{alignSelf: 'flex-start'}} disabled={!haveSabotageCard} color='danger' onClick={card.when === 'COMBAT' ? ()=>moves.actionCardSabotage() : ()=>moves.sabotage()}>{t('board.sabotage')}</Button>
                    </>}
                    {((isMine && card.target) || !isMine) && <div>
                        {Object.keys(card.reaction).map((pid, i) => {
                            return <p key={i} style={{color: 'black', margin: '.5rem'}}><b>{G.races[pid].name + ': '}</b>
                                <b style={{color: card.reaction[pid] === 'pass' ? 'gray':'coral'}}>{card.reaction[pid]}</b></p>
                        })}
                        {isMine && Object.keys(card.reaction).length === 0 && <p style={{color: 'black'}}><b>{t('board.awaiting_other_players')}...</b></p>}
                    </div>}
                    {!isMine && !card.reaction[playerID] && <>
                        <Button style={{alignSelf: 'flex-start'}} color='dark' onClick={card.when === 'COMBAT' ? ()=>moves.actionCardPass() : ()=>moves.pass()}>{t('board.nav.pass')}</Button>
                    </>}
                    {isMine && card.target && Object.keys(card.reaction).length === (Object.keys(ctx.activePlayers).length - 1) && 
                        <Button style={{alignSelf: 'flex-start'}} color='success' onClick={doneClick}>{t('board.done')}</Button>
                    }
                </CardFooter>
            </Card>
}

const SelectSustained = ({selected, onSelect, initiator, readOnly}) => {

    const { G } = useContext(StateContext);
    const activeTile = useMemo(() => G.tiles.find(t => t.active === true), [G.tiles]);

    const fleet = useMemo(() => {
        if(!activeTile) return;

        if(String(activeTile.tdata.occupied) === String(initiator)){
            return activeTile.tdata.attacker;
        }
        else{
            return activeTile.tdata.fleet;
        }
    }, [activeTile, initiator]);

    const sustained = useMemo(() => {
        if(!fleet || !Object.keys(fleet).length) return [];

        let result = [];
        Object.keys(fleet).forEach(tag => {
            fleet[tag].forEach((car, idx) => {
                if(car.hit && car.hit > 0) result.push({tag, idx, ...car});
            });
        });

        return result;
    }, [fleet]);

    const isSelected = useCallback((tag, idx) => {
        return selected && selected.tag === tag && selected.idx === idx;
    }, [selected]);

    return <div style={{marginLeft: '1rem', display: 'flex', flexWrap: 'wrap'}}>
        {sustained.map((t, j) =>{
            return <div key={j} style={{margin: '0.25rem 1rem 0 0', display: 'flex', alignItems: 'flex-start'}}>
                <div style={{display: 'flex', flexDirection: 'column'}}>
                    <Button style={{width: '5rem', padding: 0, background: isSelected(t.tag, t.idx) ? '#bb2d3b':'none', border: 'none'}} 
                        outline onClick={() =>{ if(!readOnly){onSelect({tag: t.tag, idx: t.idx}) }}}>
                        <img alt='unit' src={'units/' + t.tag.toUpperCase() + '.png'} style={{width: '100%'}}/>
                    </Button>
                </div>
                <div style={{display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', maxWidth: '10rem'}}>
                    {t.payload && t.payload.map((p, l) =>{
                        if(p){
                            return <div key={l} style={{display: 'flex', flexDirection: 'column'}}>
                            <Button outline 
                                style={{width: '2rem', background: 'transparent',
                                border: 'solid 1px rgba(255,255,255,.15)', margin: '.1rem', padding: 0}}>
                                <img alt='unit' src={'units/' + p.id.toUpperCase() + '.png'} style={{width: '100%'}}/>
                            </Button>
                            </div>
                        }
                        return <></>
                    })}
                </div>
            </div>})}
    </div>;
}

const ForcesRelocationRO = ({selection}) => {
    const { G } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);

    const activeTile = useMemo(() => {
        return G.tiles.find(t => t.active === true);
    }, [G.tiles]);

    return <>
        {selection && activeTile.tdata.planets && <div style={{fontSize: '.8rem'}}>
            {selection.from !== undefined && <Row>
                <Col xs={4}><b style={{display: 'block', margin: '.5rem'}}>{t('board.from_planet')}:</b></Col>
                <Col><b style={{display: 'block', margin: '.5rem'}}>{activeTile.tdata.planets[selection.from] && activeTile.tdata.planets[selection.from].name}</b></Col>
            </Row>}
            {selection.to !== undefined && <Row>
                <Col xs={4}><b style={{display: 'block', margin: '.5rem'}}>{t('board.to_planet')}:</b></Col>
                <Col><b style={{display: 'block', margin: '.5rem'}}>{activeTile.tdata.planets[selection.to] && activeTile.tdata.planets[selection.to].name}</b></Col>
            </Row>}

            {selection.forces && Object.keys(selection.forces).map((u, i) =>{
                return selection.forces[u].map((g, j) => 
                    <Button key={i+''+j} style={{width: '3rem', padding: 0, border: 'none'}} outline>
                        <img alt='unit' src={'units/' + u.toUpperCase() + '.png'} style={{width: '100%'}}/>
                    </Button>
                )          
            })}
        </div>}
    </>
}

const ForcesRelocation = ({onResult}) => {

    const { G, playerID, ctx, prevStages } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const [from, setFrom] = useState(undefined);
    const [to, setTo] = useState(undefined);
    const [escGround, setEscGround] = useState({});

    const activeTile = useMemo(() => {
        return G.tiles.find(t => t.active === true);
    }, [G.tiles]);
    
    const justLanding = useMemo(() => {
        if(ctx.activePlayers && ctx.activePlayers[playerID] === 'invasion'){
            if(prevStages && prevStages[playerID]){
                if(prevStages[playerID].indexOf('invasion') === prevStages[playerID].length - 1){
                    if(activeTile.tdata.planets){
                        const activePlanet = activeTile.tdata.planets.find(p => p.invasion);
                        if(activePlanet && String(activePlanet.occupied) === String(playerID)){
                            return true;
                        }
                    }
                }
            }
        }
    }, [ctx.activePlayers, playerID, prevStages, activeTile.tdata.planets]);

    const groundForces = useMemo(()=>{
        let result = null;

        if(activeTile.tdata.planets && from !== undefined){
            const p = activeTile.tdata.planets[from];
            if(p){
                if(String(p.occupied) === String(playerID)){
                    const forces = {fighter:[], mech: [], infantry: []};

                    Object.keys(p.units).forEach(u => {
                        if(forces[u]) forces[u] = forces[u].concat(p.units[u]);
                    });

                    Object.keys(forces).forEach( k => {
                        if(!forces[k].length) delete forces[k];
                    });

                    if(forces && Object.keys(forces).length){
                        result = forces;
                    }
                }
            }
        }        

        return result;
    }, [activeTile.tdata, playerID, from]);

    const groundClick = useCallback((tag, idx) => {
        setEscGround(produce(escGround, draft => {
            if(!draft[tag]) draft[tag]=[];
            const index = draft[tag].findIndex(u => u.idx === idx);
            if(index === -1){
                draft[tag].push({idx});
            }
            else{
                draft[tag].splice(index, 1);
            }
        }))
    }, [escGround]);

    useEffect(() => {
        if(from !== undefined && to !== undefined){
            onResult({from, to, forces: escGround});
        }
        else{
            onResult(null);
        }
    }, [from, to, escGround, onResult]);

    useEffect(() => {
        if(from === undefined){
            if(activeTile.tdata.planets && activeTile.tdata.planets.length){
                setFrom('0');
            }
        }
        else{
            setEscGround({});
        }
    }, [from, activeTile.tdata.planets]);

    useEffect(() => {
        if(to === undefined){
            if(activeTile.tdata.planets && activeTile.tdata.planets.length){
                setTo('0');
            }
        }
    }, [to, activeTile.tdata.planets]);

    return <>
        {activeTile.tdata.planets && justLanding && <div style={{fontSize: '.8rem'}}>
            <Row>
                <Col xs={4}><b style={{display: 'block', margin: '.5rem'}}>{t('board.from_planet')}:</b></Col>
                <Col><Input type='select' onChange={(e)=>setFrom(e.target.value)} style={{width: '90%', fontSize: '.8rem', color: 'black'}}>
                {activeTile.tdata.planets.map((p,i) =>
                    <option key={i} value={i} style={{fontWeight: 'bold'}}>{p.name}</option>
                )}
                </Input></Col>
            </Row>
            <Row>
                <Col xs={4}><b style={{display: 'block', margin: '.5rem'}}>{t('board.to_planet')}:</b></Col>
                <Col><Input type='select' onChange={(e)=>setTo(e.target.value)} style={{width: '90%', fontSize: '.8rem', color: 'black'}}>
                {activeTile.tdata.planets.map((p,i) =>
                    <option key={i} value={i} style={{fontWeight: 'bold'}}>{p.name}</option>
                )}
                </Input></Col>
            </Row>

            {groundForces && Object.keys(groundForces).map((u, i) =>{
                const planet = activeTile.tdata.planets[from];

                return planet.units[u].map((g, j) => 
                    <Button key={i+''+j} style={{width: '3rem', padding: 0, border: 'none', 
                        backgroundColor: escGround[u] && escGround[u].findIndex(n => n.pname === planet.pname && n.idx === j)>-1 ? 'rgba(255,255,255,.5)':''}} 
                        outline onClick={() => groundClick(u, j)}>
                            <img alt='unit' src={'units/' + u.toUpperCase() + '.png'} style={{width: '100%'}}/>
                    </Button>
                )          
            })}

        </div>}
    </>

}

const Predict = ({onSelect}) => {
    const { G } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const [voteRadio, setVoteRadio] = useState('for');
    const a = G.vote2 ? G.vote2 : G.vote1;
    const ref = useRef();

    useEffect(()=> {
        if(a && !a.elect && a.for){
            onSelect(voteRadio);
        }
        else if(a && a.elect && ref.current){
            onSelect(ref.current.value); 
        }
    }, [a, onSelect, voteRadio])

    return <>
        <p style={{margin: '1rem 0 0 1rem'}}><b>{t('board.predict_vote_outcome')}:</b></p>
        {!a.elect && a.for && <h6 style={{margin: '2rem'}}>
            <span onClick={()=>setVoteRadio('for')}><Input type='radio' name='vote' checked={voteRadio === 'for' ? 'checked':''} value='for' onChange={()=>setVoteRadio('for')} style={{margin: '0 .5rem'}}/><Label for='vote' style={{margin: '0 .5rem'}}>{t('board.for')}:</Label></span>
            <span onClick={()=>setVoteRadio('against')}><Input type='radio' name='vote' checked={voteRadio === 'against' ? 'checked':''} value='against' onChange={()=>setVoteRadio('against')} style={{margin: '0 .5rem'}}/><Label for='vote' style={{margin: '0 .5rem'}}>{t('board.against')}:</Label></span>
            <span onClick={()=>setVoteRadio('pass')}><Input type='radio' name='vote' checked={voteRadio === 'pass' ? 'checked':''} value='pass' onChange={()=>setVoteRadio('pass')} style={{margin: '0 .5rem'}}/><Label for='vote' style={{margin: '0 .5rem'}}>{t('board.nav.pass')}:</Label></span>
        </h6>}
        {a.elect && <>
            <Input type='select' innerRef={ref} onChange={(e)=>onSelect(e.target.value)} style={{margin: '1rem', width: '90%', color: 'black'}}>
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
    </>
}

const PayTg = ({onChange}) => {
    const {G, playerID} = useContext(StateContext);
    const [tg, setTg] = useState(0);

    const tgClick = useCallback(() => {
        const max = G.races[playerID].tg;
        if(tg < max){
            setTg(tg+1);
        }

    }, [tg, G.races, playerID]);

    useEffect(() => {
        if(onChange) onChange(tg);
    }, [tg, onChange]);

    return <div style={{width: '15rem', margin: '1rem'}}>
        <h5 style={{fontSize: '50px', display: 'flex', justifyContent: 'flex-end'}}>{'+'}{tg}{' '}<Button tag='img' onClick={tgClick} src='/icons/trade_good_1.png' color='warning' 
            style={{marginLeft: '1rem', width: '4rem', padding: '.5rem', borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} />
            <Button disabled={tg < 1} color='warning' style={{width: '1.5rem', borderLeft: 'none', color:'orange', backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: 0}} onClick={()=>setTg(tg-1)}>▼</Button></h5>
        <h6 style={{display: 'flex', justifyContent: 'flex-end'}}>{'You mean to spend ' + tg + ' tg'}</h6>
    </div>;
}

const OneTechLine = ({technology}) => {
    return <b style={{textAlign: 'left', color: 'black', position: 'relative', paddingLeft: '2rem'}}>
                <img alt='type' style={{width: '1rem', left: '.5rem', position: 'absolute', top: '.15rem'}} src={'icons/'+ technology.type +'.png'}/>
                {technology.id.replaceAll('_', ' ').replaceAll('2', ' II')}
                {technology.racial && ' (racial)'}
            </b>
}

const OneLinePlayerInfo = ({race}) => {
    return <b style={{width: '60%', textAlign: 'left', display: 'block', position: 'relative', margin: '.75rem auto', color: 'black'}}>
        <img alt='race' style={{width: '2rem', marginRight: '1rem'}} src={'race/icons/'+ race.rid + '.png'}/>
        {race.name}
    </b>
}

const TechnologySelect = ({onSelect, requirements, exhausted, setExhausted, races}) => {
    
    const {G, playerID, PLANETS} = useContext(StateContext);
    const {t} = useContext(LocalizationContext);
    const splanets = PLANETS.filter(p => !p.exhausted && p.specialty);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedTech, setSelectedTech] = useState([]);

    if(races && races.length === 0){
        return <div style={{padding: '1rem'}}>You haven't any neighbors.</div>
    }

    return  <div style={{padding: '1rem'}}>
                <Button size='sm' color='success' onClick={()=>setDialogOpen(!dialogOpen)}>{t('board.choose_technology')}</Button>
                {dialogOpen && 
                    <Modal style={{maxWidth: '72rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} isOpen={dialogOpen} toggle={()=>setDialogOpen(!dialogOpen)}>
                        <ModalBody style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: '1rem'}}>
                            <TechnologyDialog races={races} tooltipMode={true} selected={selectedTech.map(s=>s.id)} onSelect={(tech)=>{setSelectedTech([tech]); onSelect(tech)}}/>
                        </ModalBody>
                        <ModalFooter style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: '0 1rem 1rem 1rem', borderTop: 'none'}}>
                            <Button color='success' onClick={()=>setDialogOpen(!dialogOpen)}>
                            {t('board.confirm')}
                            </Button>
                        </ModalFooter>
                    </Modal>}
                {selectedTech.length > 0 && <OneTechLine technology={selectedTech[0]}/>}
                {(requirements && (requirements.upgrades.length > 0 || requirements.other.length > 0)) && <div style={{padding: '1rem 1rem 0 1rem'}}>
                    <b>{'Technology have unmeet requirements:  '}</b>
                    {[...requirements.upgrades, ...requirements.other].map((r,i)=><img alt={r} key={i} src={'icons/'+ r +'.png'} style={{width: '1rem'}}/>)}
                </div>}
                {!haveTechnology(G.races[playerID], 'PSYCHOARCHAEOLOGY') && splanets.length > 0 && 
                    <div style={{overflowY: 'auto', maxHeight: '10rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)', marginTop: '1rem'}}>
                    <PlanetsRows PLANETS={splanets} exhausted={exhausted} onClick={(pname)=>setExhausted(
                        produce(exhausted, draft => {
                            if(draft[pname]){
                                delete draft[pname];
                            }
                            else{
                                draft[pname] = true;
                            }
                        }))}/>
                </div>}
            </div>
}

export const TechnologyDialog = ({tooltipMode, onSelect, selected, races}) => {
    const { G, playerID } = useContext(StateContext);
    const CARD_STYLE = {background: 'none', border: 'solid 1px rgba(74, 111, 144, 0.42)', padding: '1rem', marginBottom: '1rem'}
    const [race, setRace] = useState(races && races.length ? races[0] : G.races[playerID]);
    const onSelectFn = onSelect ?  (t) => onSelect({...t, rid: race.rid}) : undefined;

    return <Card style={{ ...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: '1rem', position: 'relative', width: '70rem' }}>
    <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}>
        <h6>{race.name + ' technologies map '}
            <ButtonGroup style={{height: '2.75rem', margin: '0 2rem', position: 'absolute', top: 0, right: 0}}>
                {(races || G.races).map((r, i) => <Button onClick={()=>setRace(r)} color={r.rid === race.rid ? 'secondary':'dark'} style={{padding: '.25rem', height: '2.7rem'}} 
                    key={i} tag='img' src={'/race/icons/' + r.rid + '.png'}/>)}
            </ButtonGroup>
        </h6>
    </CardTitle>
    
    <div style={{display: 'flex', justifyContent: 'space-between'}}>
      {GetTechType('propulsion', race, tooltipMode, onSelectFn, selected)}
      {GetTechType('biotic', race, tooltipMode, onSelectFn, selected)}
      {GetTechType('warfare', race, tooltipMode, onSelectFn, selected)}
      {GetTechType('cybernetic', race, tooltipMode, onSelectFn, selected)}
      {GetTechType('unit', race, tooltipMode, onSelectFn, selected)}
    </div>
  </Card>
}

const PlayerSelect = ({selected, onSelect, noTokensInfo}) => {
    const { G } = useContext(StateContext);
    const myRef = useRef(null);

    useEffect(() => {
        if(!selected && myRef && myRef.current && myRef.current.value !== undefined){
            onSelect(myRef.current.value);
        }
    }, [onSelect, selected]);

    return <Input type='select' innerRef={myRef} onChange={(e)=>onSelect(e.target.value)} style={{margin: '.5rem', width: '96%', color: 'black'}}>
        {G.races.map((r,i) =>{
            return <option key={i} value={i} style={{fontWeight: 'bold'}}>{r.name + (noTokensInfo ? '':': ' + r.tokens.t + ' tactic tokens')}</option>
            }
        )}
    </Input>
}

const LawSelect = ({onSelect}) => {
    const { G } = useContext(StateContext);
    const [selected, setSelected] = useState();
    const selectedLaw = useMemo(()=>{
        if(selected){
            return G.laws.find(l => l.id === selected)
        }
    }, [selected, G.laws]);

    return <> 
            <Input type='select' onChange={(e)=>{setSelected(e.target.value); onSelect(e.target.value)}} style={{margin: '.5rem', width: '96%', color: 'black'}}>
                {[{id: '', for: ''}, ...G.laws].map((r,i) => <option key={i} value={r.id} style={{fontWeight: 'bold'}}>{r.id}</option>)}
            </Input>
            {selectedLaw && <p style={{padding: '1rem', fontSize: '80%'}}>
                {selectedLaw.for}
                {selectedLaw.decision && <><br/><b>{selectedLaw.decision}</b></>}
            </p>}
        </>
}

const PlanetInfo = ({tidx, pidx}) => {
    const { G } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);

    const planet = useMemo(() => {
        if(tidx > -1 && pidx > -1){
            const tile = G.tiles[tidx];
            if(tile && tile.tdata.planets){
                const planet = tile.tdata.planets[pidx];
                return planet;
            }
        }
    }, [G.tiles, tidx, pidx]);

    if(planet){
        let trait;
        if(planet.trait) trait = <img alt='trait' style={{width: '1.5rem'}} src={'icons/' + planet.trait + '.png'}/>;
        let specialty;
        if(planet.specialty) specialty = <img alt='specialty' style={{width: '1.5rem'}} src={'icons/' + planet.specialty + '.png'}/>;

        return  <Row style={{cursor: 'default', padding: '.5rem', fontSize: '1.25rem', lineHeight: '2.3rem', color: 'white'}}>
                    <Col xs='1'>{planet.occupied !== undefined && <img alt='race' style={{width: '1.5rem'}} src={'race/icons/' + G.races[planet.occupied].rid + '.png'} />}</Col>
                    <Col xs='6' style={{color: 'black'}}>{planet.legendary ? <img alt='legendary' style={{width: '1.5rem'}} src={'icons/legendary_complete.png'}/>:'' } {planet.name}</Col>
                    <Col xs='1' style={{padding: 0}}>{specialty}</Col>
                    <Col xs='1' style={{padding: 0}}>{trait}</Col>
                    <Col xs='1' style={{background: 'url(icons/resources_bg.png)', backgroundRepeat: 'no-repeat', backgroundSize: 'contain', paddingLeft: '.85rem'}}><b>{planet.resources}</b></Col>
                    <Col style={{background: 'url(icons/influence_bg.png)', backgroundRepeat: 'no-repeat', backgroundSize: 'contain', paddingLeft: '.7rem'}}><b>{planet.influence}</b></Col>
                    <Col/>
                </Row>
        
    }

    return <p style={{margin: '1rem', color: 'rgba(0,0,0,.5)'}}>{t('board.click_planet')}</p>
}

const TileInfo = ({tidx}) => {
    const { G } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);

    return <div style={{width: '80%', padding: '1rem', display: 'flex', alignItems: 'center'}}>
            {tidx === -1 && <p style={{margin: '1rem', color: 'rgba(0,0,0,.5)'}}>{t('board.click_tile')}</p>}
            {tidx > -1 && <CardImg style={{width: '65%'}} src={'tiles/ST_'+G.tiles[tidx].tid+'.png'} />}
        </div>
}

const UnitInfo = ({selectedUnit}) => {
    const {G} = useContext(StateContext);
    const {t} = useContext(LocalizationContext);
    const tile = selectedUnit ? G.tiles[selectedUnit.tile]:undefined;

    return <div style={{width: '80%', padding: '1rem', display: 'flex', position: 'relative', alignItems: 'center'}}>
            {!tile && <p style={{margin: '1rem', color: 'rgba(0,0,0,.5)'}}>{t('board.click_unit')}</p>}
            {tile && <>
                <CardImg style={{width: '75%'}} src={'tiles/ST_' + tile.tid + '.png'} />
                {tile.tdata.occupied !== undefined && <CardImg style={{width: '3rem', top: '1rem', left: '1rem', position: 'absolute'}} src={'race/icons/' + G.races[tile.tdata.occupied].rid + '.png'}/>}
                {selectedUnit.unit !== undefined && <CardImg style={{}} src={'units/' + selectedUnit.unit.toUpperCase() + '.png'}/>}
            </>}
        </div>
}