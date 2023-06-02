import { Card, CardImg,  CardTitle, CardBody, CardFooter, ButtonGroup, Button, Row, Col, Input, Modal, ModalFooter, ModalBody } from 'reactstrap';
import { useState, useMemo, useContext, useCallback } from 'react';
import { produce } from 'immer';
//import techData from './techData.json';
import { StateContext, haveTechnology, UNITS_LIMIT, getPlanetByName, getMyNeighbors } from './utils';
import { UnmeetReqs, PlanetsRows, getTechType } from './dialogs.js';

export const ActionCardDialog = ({selectedTile, selectedPlanet, selectedUnit}) => {
    const {G, ctx, playerID, moves, exhaustedCards, PLANETS, UNITS} = useContext(StateContext);
    const [selection, setSelection] = useState();
    const [exhausted, setExhausted] = useState({});

    const notarget = useMemo(() => ['Economic Initiative', 'Fighter Conscription', 'Industrial Initiative'], []);
    const card = useMemo(() => G.races[ctx.currentPlayer].currentActionCard, [G.races, ctx]);

    /*const technology = useMemo(() => {
        if(selection && card.id === 'Focused Research'){
            return [...techData, ...G.races[playerID].technologies].find(t => t.id === selection);
        }
    }, [selection, G.races, playerID, card.id]);*/

    const requirements = useMemo(() => {
        if(card.id === 'Focused Research' && selection){
            
            if(selection){ //technology
                let adjSpec = [];
                if(haveTechnology(G.races[playerID], 'PSYCHOARCHAEOLOGY')){
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
                const reqs = UnmeetReqs({separate: true, PLANETS, ex2, adjSpec, G, playerID});
                reqs.adjSpec = adjSpec;
                return reqs;
            }

        }
    }, [G, card, playerID, PLANETS, selection, exhausted]);

    const myTarget = useMemo(() => {
        
        let result = notarget.indexOf(card.id) > -1;

        if(['Cripple Defenses'].indexOf(card.id) > -1){
            if(selectedTile > -1 && selectedPlanet > -1){
                result = {tidx: selectedTile, pidx: selectedPlanet};
            }
        }
        else if(['Frontline Deployment'].indexOf(card.id) > -1){
            if(selectedTile > -1 && selectedPlanet > -1){
                const planet = G.tiles[selectedTile].tdata.planets[selectedPlanet];
                if(String(planet.occupied) === String(playerID)){
                    result = {tidx: selectedTile, pidx: selectedPlanet};
                }
            }
        }
        else if(['Ghost Ship'].indexOf(card.id) > -1){
            if(selectedTile > -1 && (!UNITS['destroyer'] || UNITS['destroyer'] < UNITS_LIMIT['destroyer'])){
                const tile = G.tiles[selectedTile];
                if((String(tile.tdata.occupied) === String(playerID)) || !tile.tdata.occupied){
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
        else if(card.id === 'Insubordination'){
            if(selection && String(selection) !== String(playerID)){
                result = { playerID: selection }
            }
        }
        else if(card.id === 'Lucky Shot'){
            if(selectedUnit && ['dreadnought', 'cruiser', 'destroyer'].indexOf(selectedUnit.unit)>-1){
                const tile = G.tiles[selectedUnit.tile];
                if(tile.tdata.planets && tile.tdata.planets.find(p => String(p.occupied) === String(playerID))){
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

        return result;
    }, [card.id, selectedPlanet, selectedTile, notarget, selection, 
        requirements, exhaustedCards, exhausted, G, playerID, UNITS, selectedUnit]);

    const isMine = useMemo(() => {
        return String(ctx.currentPlayer) === String(playerID);
    }, [ctx.currentPlayer, playerID]);

    const planetsRowsClick = useCallback((pname)=> {
        const solo = card.id === 'Mining Initiative';

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

    const myNeighbors = useMemo(() => {
        if(card.id === 'Plagiarize'){
            return getMyNeighbors(G, playerID);
        }
    }, [card.id, G, playerID]);

    return <Card style={{border: 'solid 1px rgba(74, 111, 144, 0.42)', maxWidth: '60%', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, .85)', position: 'absolute', margin: '5rem'}}>
                <CardTitle style={{borderBottom: '1px solid coral', color: 'black'}}><h3>Action card</h3></CardTitle>
                <CardBody style={{display: 'flex', color: 'black', width: 'min-content'}}>
                    <div>
                        <CardImg src={'race/'+ G.races[ctx.currentPlayer].rid +'.png'} style={{width: '205px'}}/>
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', padding: '0 1rem 1rem 1rem', minWidth: '30rem'}}>
                        <h6 style={{margin: '0 0 1rem 1rem'}}>{card.when + ':'}</h6>
                        <div style={{padding: '1rem', backgroundColor: 'rgba(0,0,0,.15)', position: 'relative'}}>
                            <h5>{card.id}</h5>
                            <p>{card.description}</p>
                        </div>

                        {notarget.indexOf(card.id) === -1 && <h6 style={{margin: '2rem 1rem 1rem 1rem'}}>TARGET:</h6>}

                        {isMine && !card.target && <div style={{backgroundColor: 'rgba(0,0,0,.15)', minHeight: '3.5rem', maxHeight: '30rem'}}>
                            {['Cripple Defenses', 'Frontline Deployment'].indexOf(card.id) > -1 && <PlanetInfo tidx={selectedTile} pidx={selectedPlanet}/>}
                            {card.id === 'Ghost Ship' && <TileInfo tidx={selectedTile}/>}
                            {card.id === 'Focused Research' && <TechnologySelect onSelect={setSelection} requirements={requirements} 
                                exhausted={exhausted} setExhausted={setExhausted}/>}
                            {['Impersonation', 'Mining Initiative'].indexOf(card.id) > -1 && <div style={{overflowY: 'auto', maxHeight: '10rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                <PlanetsRows PLANETS={PLANETS} exhausted={exhausted} onClick={planetsRowsClick} /></div>}
                            {card.id === 'Insubordination' && <PlayerSelect onSelect={setSelection}/>}
                            {card.id === 'Lucky Shot' && <UnitInfo selectedUnit={selectedUnit} />}
                            {card.id === 'Plagiarize' && <>
                                <TechnologySelect onSelect={setSelection} races={myNeighbors.map(n => G.races[n])}/>
                                {myNeighbors.length > 0 && <div style={{overflowY: 'auto', maxHeight: '10rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                    <PlanetsRows PLANETS={PLANETS} exhausted={exhausted} onClick={planetsRowsClick} />
                                </div>}
                                </>}
                        </div>}

                        {card.target && <div style={{backgroundColor: 'rgba(0,0,0,.15)', minHeight: '3.5rem', maxHeight: '30rem'}}>
                            {['Cripple Defenses', 'Frontline Deployment'].indexOf(card.id) > -1 && <PlanetInfo tidx={card.target.tidx} pidx={card.target.pidx}/>}
                            {card.id === 'Ghost Ship' && <TileInfo tidx={card.target.tidx}/>}
                            {['Focused Research', 'Plagiarize'] && <div style={{padding: '1rem'}}><OneTechLine technology={card.target.tech}/></div>}
                            {['Impersonation', 'Mining Initiative'].indexOf(card.id) > -1 && <div style={{overflowY: 'auto', maxHeight: '10rem', padding: '1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                                <PlanetsRows PLANETS={card.target.exhausted} /></div>}
                            {card.id === 'Insubordination' && <b style={{width: '60%', textAlign: 'left', display: 'block', position: 'relative', margin: '.75rem auto', color: 'black'}}>
                                <img alt='race' style={{width: '2rem', marginRight: '1rem'}} src={'race/icons/'+ G.races[card.target.playerID].rid + '.png'}/>
                                {G.races[card.target.playerID].name}
                            </b>}
                            {card.id === 'Lucky Shot' && <UnitInfo selectedUnit={card.target.selectedUnit} />}
                        </div>}
                    </div>
                </CardBody>
                <CardFooter style={{background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid coral'}}>
                    {isMine && !card.target && <>
                        <Button color='danger' onClick={()=>moves.cancel()}>Cancel</Button>
                        <Button color='success' onClick={()=>moves.next(myTarget)} disabled={!myTarget}>Next</Button>
                    </>}
                    {((isMine && card.target) || !isMine) && <div>
                        {Object.keys(card.reaction).map((pid, i) => {
                            return <p key={i} style={{color: 'black', margin: '.5rem'}}><b>{G.races[pid].name + ': '}</b>
                                <b style={{color: card.reaction[pid] === 'pass' ? 'gray':'coral'}}>{card.reaction[pid]}</b></p>
                        })}
                        {isMine && Object.keys(card.reaction).length === 0 && <p style={{color: 'black'}}><b>Awaiting other players...</b></p>}
                    </div>}
                    {!isMine && !card.reaction[playerID] && <>
                        <Button style={{alignSelf: 'flex-start'}} color='dark' onClick={()=>moves.pass()}>Pass</Button>
                    </>}
                    {isMine && card.target && Object.keys(card.reaction).length === (Object.keys(ctx.activePlayers).length - 1) && 
                        <Button style={{alignSelf: 'flex-start'}} color='success' onClick={()=>moves.done()}>Done</Button>
                    }
                </CardFooter>
            </Card>
}

/*
<Input type='select' onChange={(e)=>onSelect(e.target.value)} style={{margin: '.5rem', width: '96%', color: 'black'}}>
                {list.map((t,i) =>{
                        let color = 'black';
                        if(t.type === 'propulsion') color = 'deepskyblue';
                        else if(t.type === 'biotic') color = 'green';
                        else if(t.type === 'cybernetic') color = 'orange';
                        else if(t.type === 'warfare') color = 'red';

                        return <option key={i} value={t.id} style={{fontSize: '75%', fontWeight: 'bold', color}}>{t.id.replaceAll('_', ' ').replaceAll('2', ' II')}</option>
                        }
                    )}
                </Input>
*/

const OneTechLine = ({technology}) => {
    return <b style={{textAlign: 'left', color: 'black', position: 'relative', paddingLeft: '2rem'}}>
                <img alt='type' style={{width: '1rem', left: '.5rem', position: 'absolute', top: '.15rem'}} src={'icons/'+ technology.type +'.png'}/>
                {technology.id.replaceAll('_', ' ').replaceAll('2', ' II')}
                {technology.racial && ' (racial)'}
            </b>
}

const TechnologySelect = ({onSelect, requirements, exhausted, setExhausted, races}) => {
    
    const {G, playerID, PLANETS} = useContext(StateContext);
    const splanets = PLANETS.filter(p => !p.exhausted && p.specialty);
    //const list = [{id:''}, ...techData, ...G.races[playerID].technologies].filter(t => (t.type !== 'unit' || t.upgrade) && G.races[playerID].knownTechs.indexOf(t.id) === -1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedTech, setSelectedTech] = useState([]);

    if(races && races.length === 0){
        return <div style={{padding: '1rem'}}>You haven't any neighbors.</div>
    }

    return  <div style={{padding: '1rem'}}>
                <Button size='sm' color='success' onClick={()=>setDialogOpen(!dialogOpen)}>Choose technology</Button>
                {dialogOpen && 
                    <Modal style={{maxWidth: '72rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}} isOpen={dialogOpen} toggle={()=>setDialogOpen(!dialogOpen)}>
                        <ModalBody style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: '1rem'}}>
                            <TechnologyDialog races={races} tooltipMode={true} selected={selectedTech.map(s=>s.id)} onSelect={(tech)=>{setSelectedTech([tech]); onSelect(tech)}}/>
                        </ModalBody>
                        <ModalFooter style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: '0 1rem 1rem 1rem', borderTop: 'none'}}>
                            <Button color='success' onClick={()=>setDialogOpen(!dialogOpen)}>
                                Confirm
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
      {getTechType('propulsion', race, tooltipMode, onSelectFn, selected)}
      {getTechType('biotic', race, tooltipMode, onSelectFn, selected)}
      {getTechType('warfare', race, tooltipMode, onSelectFn, selected)}
      {getTechType('cybernetic', race, tooltipMode, onSelectFn, selected)}
      {getTechType('unit', race, tooltipMode, onSelectFn, selected)}
    </div>
  </Card>
}

const PlayerSelect = ({onSelect}) => {
    const { G } = useContext(StateContext);

    return <Input type='select' onChange={(e)=>onSelect(e.target.value)} style={{margin: '.5rem', width: '96%', color: 'black'}}>
        {G.races.map((r,i) =>{
            return <option key={i} value={i} style={{fontWeight: 'bold'}}>{r.name + ': ' + r.tokens.t}</option>
            }
        )}
    </Input>
}

const PlanetInfo = ({tidx, pidx}) => {
    const { G } = useContext(StateContext);

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

    return <p style={{margin: '1rem', color: 'rgba(0,0,0,.5)'}}>Click planet on map</p>
}

const TileInfo = ({tidx}) => {
    const { G } = useContext(StateContext);

    return <div style={{width: '80%', padding: '1rem', display: 'flex', alignItems: 'center'}}>
            {tidx === -1 && <p style={{margin: '1rem', color: 'rgba(0,0,0,.5)'}}>Click tile on map</p>}
            {tidx > -1 && <CardImg style={{width: '75%'}} src={'tiles/ST_'+G.tiles[tidx].tid+'.png'} />}
        </div>
}

const UnitInfo = ({selectedUnit}) => {
    const {G} = useContext(StateContext);
    const tile = selectedUnit ? G.tiles[selectedUnit.tile]:undefined;

    return <div style={{width: '80%', padding: '1rem', display: 'flex', position: 'relative', alignItems: 'center'}}>
            {!tile && <p style={{margin: '1rem', color: 'rgba(0,0,0,.5)'}}>Click unit on map</p>}
            {tile && <>
                <CardImg style={{width: '75%'}} src={'tiles/ST_' + tile.tid + '.png'} />
                {tile.tdata.occupied !== undefined && <CardImg style={{width: '3rem', top: '1rem', left: '1rem', position: 'absolute'}} src={'race/icons/' + G.races[tile.tdata.occupied].rid + '.png'}/>}
                {selectedUnit.unit !== undefined && <CardImg style={{}} src={'units/' + selectedUnit.unit.toUpperCase() + '.png'}/>}
            </>}
        </div>
}