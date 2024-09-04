import { useApp, Stage, Text, Container, Sprite } from '@pixi/react';
import { PixiViewport } from './viewport';
import { memo, useContext, useCallback, useMemo } from 'react';
import { LocalizationContext, StateContext, haveTechnology, wormholesAreAdjacent } from './utils';
import { SelectedHex, ActiveHex, LandingGreen, LandingRed, MoveDialog, MoveStep, SectorUnderAttack, PlanetUnderAttack, SelectedPlanet, SimplePixiButton, AnimatedLabel } from './animated';
import tileData from './tileData.json';
import { lineTo, pathFromCoordinates } from './Grid';

export const PixiStage = ({stagew, stageh, dispatch, hud, GP}) => {

    const { G, playerID, ctx, moves } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const race = G.races[playerID];
    const isMyTurn = (ctx.currentPlayer === playerID);
    const maxActs =  useMemo(() => {if(race){return haveTechnology(race, 'FLEET_LOGISTICS') ? 2:1}}, [race]);
    const activeTile = useMemo(()=> G.tiles.find(t => t.active === true), [G.tiles]);

    const getMovePath = useMemo(() => {

        if(activeTile && hud.advUnitView && hud.advUnitView.tile !== undefined){
          if(String(activeTile.tid) === String(G.tiles[hud.advUnitView.tile].tid)) return [];
          let line;
    
          if(hud.moveSteps && hud.moveSteps.length){
            let ar = [hud.advUnitView.tile, ...hud.moveSteps].map(t => ({q: G.tiles[t].q, r: G.tiles[t].r, wormhole: G.tiles[t].tdata.wormhole}));
            ar = [...ar, {q: activeTile.q, r: activeTile.r, wormhole: activeTile.tdata.wormhole}];
            line = pathFromCoordinates(G.HexGrid, ar);
    
            let first = line[0];
            let result = [];
            
            for(var i=1; i<line.length; i++){
              result.push(first);
    
              if(!ar[i-1].wormhole || !wormholesAreAdjacent(G, ar[i-1].wormhole, ar[i].wormhole)){
                const segment = lineTo(G.HexGrid, [first.q, first.r], [line[i].q, line[i].r]);
                if(segment.length > 1){
                  result = [...result, ...segment.splice(1, segment.length-2)];
                }
              }
              
              first = line[i];
            }
            result.push(line[line.length-1]);
            return result;
          }
          else if(activeTile.tdata.wormhole && G.tiles[hud.advUnitView.tile].tdata.wormhole && wormholesAreAdjacent(G, activeTile.tdata.wormhole, G.tiles[hud.advUnitView.tile].tdata.wormhole)){
            return [activeTile.tid, G.tiles[hud.advUnitView.tile].tid];
          }
          else{
            line = lineTo(G.HexGrid, [G.tiles[hud.advUnitView.tile].q, G.tiles[hud.advUnitView.tile].r], [activeTile.q, activeTile.r]);
            return line;
          }
        }
        else{
          return [];
        }
    
      }, [activeTile, hud.advUnitView, hud.moveSteps, G]);
    
    const getPureMovePath = useMemo(() => {
    return getMovePath.filter(t => tileData.hyperlanes.indexOf(t.tileId) === -1).map(t => t.tileId !== undefined ? String(t.tileId):t);
    }, [getMovePath])

    const advUnitViewTechnology = useMemo(() => {
      try{
        if(hud.advUnitView && hud.advUnitView.unit && hud.advUnitView.tile !== undefined){
          const tile = G.tiles[hud.advUnitView.tile];
          const owner = tile.tdata.occupied;

          return G.races[owner].technologies.find( t => t.id === hud.advUnitView?.unit.toUpperCase());
        }
      }
      catch(e){console.log(e)}
    //eslint-disable-next-line
    },[hud.advUnitView]);
    const canMoveThatPath = useMemo(() => {
      try{
        const getMySide = (prev, cur) => {
          let side;
          if(cur.q > prev.q){
            if(cur.r === prev.r) side = 5;
            else side = 4;
          }
          else if(cur.q === prev.q){
            if(cur.r < prev.r) side = 3;
            else side = 0;
          }
          else {
            if(cur.r === prev.r) side = 2;
            else side = 1;
          }
          return side;
        }
      
        const isBrokenLine = (line) => {
          return line.some((t,i) => {
            if(tileData.hyperlanes.indexOf(t.tileId) > -1 && i > 0){
              let sidein = getMySide(line[i-1], t);
              let linein = tileData.all[t.tileId].hyperlanes.some(h => h.indexOf(sidein) > -1);
    
              if(!linein) return true;
      
              if(i < line.length){
                let sideout = getMySide(line[i+1], t);
                let lineout = tileData.all[t.tileId].hyperlanes.some(h =>  h.indexOf(sidein) > -1 && h.indexOf(sideout) > -1);
    
                if(!lineout) return true;
              }
            }
            return false;
          });
        }
    
        if(!advUnitViewTechnology) return false;
        if(activeTile && activeTile.tdata && activeTile.tdata.ceasefire) return false;
        
        let adj = 0;
        if(hud.exhaustedCards.includes('GRAVITY_DRIVE')) adj++;
        if(race.moveBoost) adj += race.moveBoost;


        const rifts = getPureMovePath.filter((m, i) => i < (getPureMovePath.length - 1) && ['41', '67'].includes(String(m)));
        if(rifts && rifts.length > 0){
          adj += rifts.length;
        }

        if((['42','68'].includes(String(getPureMovePath[0])) ? (1 + adj) : (advUnitViewTechnology.move + adj)) >= getPureMovePath.length-1){

          if(isBrokenLine(getMovePath)) return false;

          if(getPureMovePath && getPureMovePath.length){
            
            return !getPureMovePath.some((p, pidx) => {
              const tile = G.tiles.find(t => String(t.tid) === String(p));
    
              if(tile.tdata.type === 'red'){
                if(tile.tdata.anomaly === 'asteroid-field' && !haveTechnology(G.races[playerID], 'ANTIMASS_DEFLECTORS')){
                  return true;
                }
                else if(tile.tdata.anomaly === 'nebula'){
                  return !(pidx === getPureMovePath.length - 1 || pidx === 0);//getPureMovePath.length > 2;
                }
                else if(tile.tdata.anomaly === 'supernova' || tile.tdata.anomaly === 'muaat-supernova'){
                  return race.rid !== 4;
                }
                else if(tile.tdata.anomaly === 'gravity-rift'){
                  return false;
                }
              }
              else if(tile.tdata.occupied && String(tile.tdata.occupied) !== String(playerID) && String(activeTile.tid) !== String(p)){
                return !(haveTechnology(race, 'LIGHTWAVE_DEFLECTOR') || String(race.moveThroughEnemysFleet) === String(tile.tid));
              }
              return false;
            });
    
          }

        }
        return false;
      }
      catch(e){console.log(e)}
    },[G.tiles, G.races, hud.exhaustedCards, race, getMovePath, getPureMovePath, advUnitViewTechnology, playerID, activeTile]);

    const getColorByRid = useCallback((rid) => {
        const r = G.races.find(rc => rc.rid === rid);
        if(r){
            return r.color;
        }
        else{
            return ['white', 'white']
        }
    }, [G.races]);

    const tileClick = useCallback((e, index, planetIndex) => {
        e.preventDefault(); 
        dispatch({type: 'selected_tile', payload: index, planetIndex});   
    }, [dispatch]);

    return <Stage width={stagew} height={stageh} options={{antialias: true, backgroundAlpha: 0, resizeTo: window, autoDensity: true }}>
                <TickerSettings fps={30}/>
                <PixiViewport home={G.tiles.find(t => t.tid === G.races[playerID].rid)}>
                    <TilesMap1 tiles={G.tiles} stagew={stagew} stageh={stageh} tileClick={tileClick}/>
                    <TilesMap2 G={G} GP={GP} playerID={playerID} moves={moves} ctx={ctx} t={t} stagew={stagew} stageh={stageh} hud={hud} tileClick={tileClick} canMoveThatPath={canMoveThatPath} getColorByRid={getColorByRid} dispatch={dispatch} activeTile={activeTile} advUnitViewTechnology={advUnitViewTechnology} maxActs={maxActs} getMovePath={getMovePath} getPureMovePath={getPureMovePath} isMyTurn={isMyTurn}/>
                    <TilesMap3 G={G} playerID={playerID} moves={moves} ctx={ctx} t={t} stagew={stagew} stageh={stageh} isMyTurn={isMyTurn} activeTile={activeTile} hud={hud} canMoveThatPath={canMoveThatPath} dispatch={dispatch} advUnitViewTechnology={advUnitViewTechnology} getPureMovePath={getPureMovePath}/>
                </PixiViewport> 
            </Stage>
}

const TilesMap1 = ({tiles, stagew, stageh, tileClick}) => {

    return tiles.map((element, index) => {
        const [firstCorner] = element.corners;
        const fill = element.tdata.type !== 'hyperlane' ? element.tdata.type: 'gray';
    
        return <Container key={index}>
                
                <Sprite cacheAsBitmap={true} interactive={true} pointerdown={ (e)=>tileClick(e, index) } 
                            image={'tiles/ST_'+element.tid+'.png'} anchor={0} scale={{ x: 1, y: 1 }}
                            x={firstCorner.x + stagew/2 + 7.5 - element.w/2 - element.w/4} y={firstCorner.y + stageh/2 + 7.5} alpha={.9}>
                            </Sprite>
                {false && <>
                    <Text style={{fontSize: 20, fill:'white'}} text={'(' + element.q + ',' + element.r + ')'} x={firstCorner.x + stagew/2 - element.w/2} y={firstCorner.y + stageh/2}/>
                    <Text style={{fontSize: 25, fill: fill}} text={ element.tid } x={firstCorner.x + stagew/2 - element.w/4} y={firstCorner.y + stageh/2}/>
                    { element.tdata.occupied!==undefined && <Text style={{fontSize: 22, fill: 'green'}} 
                    text={element.tdata.occupied + ':' + (element.tdata.fleet ? getUnitsString(element.tdata.fleet) : '-')} 
                    x={firstCorner.x + stagew/2 - element.w/2} y={firstCorner.y + stageh/2 + element.w/1.5} /> }
                    { element.tdata.planets && element.tdata.planets.length > 0 && element.tdata.planets.map( (p, i) => 
                        <Text key={i} 
                        text={ (p.specialty ? '[' + p.specialty[0] + '] ':'') + p.name + (p.trait ? ' [' + p.trait[0] + '] ':'') + ' ' + p.resources + '/' + p.influence + 
                        (p.occupied !== undefined ? ' [' + p.occupied + ':' + (p.units ? getUnitsString(p.units) : '-') + ']':'') } 
                        style={{ fontSize: 20, fill: 'white' }} 
                        x={firstCorner.x + stagew/2 - element.w/1.5} y={firstCorner.y + stageh/2 + element.w/6 + element.w/8 * (i+1)} />
                        )}
            </>}
            
            </Container>
    })
};

const TilesMap2 = ({G, GP, playerID, moves, ctx, t, isMyTurn, stagew, stageh, hud, activeTile, dispatch, canMoveThatPath, getColorByRid, tileClick, advUnitViewTechnology, maxActs, getMovePath, getPureMovePath}) => {

    const race = G.races[playerID];

    const movePayloadCursor = useCallback(()=>{
        let nexti = hud.payloadCursor.i;
        let nextj = hud.payloadCursor.j;
        const tile = G.tiles[hud.advUnitView?.tile];
        const carrier = tile?.tdata.fleet[hud.advUnitView.unit];
    
        if(advUnitViewTechnology && nextj < advUnitViewTechnology.capacity - 1){
            nextj++;
        }
        else{
            nextj = 0;
            if(nexti < carrier.length - 1){
            nexti++;
            }
            else{
            nexti = 0;
            }
        }
    
        dispatch({type: 'payload_cursor', payload: {i: nexti, j: nextj}});
        }, [advUnitViewTechnology, G.tiles, hud.advUnitView, dispatch, hud.payloadCursor]);

    const unloadUnit = useCallback(() => {
        const i = hud.payloadCursor.i;
        const j = hud.payloadCursor.j;
        const tile = G.tiles[hud.advUnitView?.tile];

        if(tile && hud.advUnitView && String(tile.tdata.occupied) === String(playerID)){
            const unit = tile.tdata.fleet[hud.advUnitView.unit];
            if(unit[i] && unit[i].payload && unit[i].payload[j]){
              if(tile.tid === 18 && hud.selectedPlanet === 0 && tile.tdata.planets[hud.selectedPlanet].occupied === undefined){
                if(G.races[playerID].rid !== 7){
                  if(GP.influence + (GP.tg* GP.tgMultiplier) < 6) return;
                }
              }
              moves.unloadUnit({src: {...hud.advUnitView, i, j}, dst: {tile: hud.advUnitView.tile, planet: hud.selectedPlanet}, payment: hud.globalPayment});
            }
    
            //movePayloadCursor();
        }
    }, [G, GP, hud.globalPayment, hud.advUnitView, moves, hud.payloadCursor, hud.selectedPlanet, playerID]);

    const loadUnit = useCallback(() => {
      if(!hud.groundUnitSelected) return;

      const tile = G.tiles[hud.groundUnitSelected.tile];
      const planet = tile.tdata?.planets[hud.groundUnitSelected.planet];
      if(!planet || String(planet.occupied) !== String(playerID)) return;

      if(hud.advUnitView && advUnitViewTechnology && hud.advUnitView.tile !== undefined && hud.advUnitView.tile === hud.groundUnitSelected.tile){

        if(String(tile.tdata.occupied) === String(playerID) || tile.tdata.occupied === undefined){

          if(['infantry', 'fighter', 'mech'].includes(hud.groundUnitSelected.unit)){
            if(tile && tile.tdata.fleet){
              const carrier = tile.tdata.fleet[hud.advUnitView.unit];

              if(!(hud.payloadCursor && hud.payloadCursor.i <= carrier.length - 1 && hud.payloadCursor.j <= advUnitViewTechnology.capacity)){
                  dispatch({type: 'payload_cursor', payload: {i:0, j:0}});
              }

              moves.loadUnit({src: {...hud.groundUnitSelected}, dst: {...hud.advUnitView, ...hud.payloadCursor}});
              movePayloadCursor();
            }
          }
        }
      }
    },[G.tiles, hud.advUnitView, advUnitViewTechnology, hud.payloadCursor, hud.groundUnitSelected, moves, playerID, dispatch, movePayloadCursor])

    const groundUnitClick = useCallback((args) => {
      
      const event = args.e;
      if(event){
          event.stopPropagation();
          event.preventDefault();
      }

      const tile = G.tiles[args.tile];
      const planet = tile.tdata?.planets[args.planet];

      if(!planet || String(planet.occupied) !== String(playerID)) return;
      

      if(hud.groundUnitSelected.tile === args.tile && 
          hud.groundUnitSelected.unit === args.unit && 
          hud.groundUnitSelected.planet === args.planet){
          dispatch({type: 'ground_unit_selected', payload: {}});
      }
      else{
          dispatch({type: 'ground_unit_selected', payload: {tile: args.tile, unit: args.unit, planet: args.planet}});
      }


    },[G.tiles, hud.groundUnitSelected, playerID, dispatch]);
    
    const modifyMoveStep = useCallback((index) => {
        if(G.tiles[index].tid === activeTile.tid) return;
        dispatch({type: 'move_steps', payload: index})
    }, [G.tiles, activeTile, dispatch]);

    const selectedPlanet = useMemo(() => {
      if(hud.selectedTile > -1 && hud.selectedPlanet > -1) {
        const tile = G.tiles[hud.selectedTile];
        if(tile && tile.tdata && tile.tdata.planets){
          const planet = tile.tdata.planets[hud.selectedPlanet];
          return planet;
        }
      }
      
    }, [G.tiles, hud.selectedTile, hud.selectedPlanet]);

    return G.tiles.map((element, index) => {
        //eslint-disable-next-line
        const pathIdxs = getPureMovePath.reduce((acc, p, i) => ( (i > 0 && String(p) === String(element.tid)) && acc.push(i), acc), []);
        const [firstCorner] = element.corners;
        const moveTint = (() => {
            let tint = element.tdata.type === 'blue' ? 'yellowgreen' :  element.tdata.type !== 'hyperlane' ? element.tdata.type: 'white';
            if(element.tdata.occupied && String(element.tdata.occupied)!==String(playerID)) tint = 'purple';
            if(tint === 'red' && canMoveThatPath) tint = 'yellowgreen';
        
            return tint;
        })();
        
        return <Container key={index}>
                {hud.selectedTile === index && element.active !== true && <SelectedHex x={firstCorner.x + stagew/2 - element.w/4} y={firstCorner.y + stageh/2 + element.w/2 - 20}/>}
                {element.active === true && <ActiveHex x={firstCorner.x + stagew/2 - element.w/4} y={firstCorner.y + stageh/2 + element.w/2 - 20}/>}
                    <Container x={firstCorner.x + stagew/2 + 7.5 - element.w/2 - element.w/4} y={firstCorner.y + stageh/2 + 7.5}>
                        {element.tdata.mirage && <Sprite x={element.w/4} y={element.w/6} scale={.35} alpha={.9} image={'icons/mirage_token.webp'}/>}
                        {element.tdata.wormhole === 'gamma' && <Sprite x={-15} y={element.w/4 + 30} scale={.5} alpha={.9} image={'icons/gamma.png'}/>}
                        {element.tdata.ionstorm && element.tdata.wormhole === 'alpha' && <Sprite x={-15} y={element.w/4 + 30} scale={1} alpha={.85} image={'icons/alpha.png'}/>}
                        {element.tdata.ionstorm && element.tdata.wormhole === 'beta' && <Sprite x={-15} y={element.w/4 + 30} scale={1} alpha={.85} image={'icons/beta.png'}/>}
                        {element.tdata.frontier && <Sprite x={30} y={element.w/4 + 30} image={'icons/frontier.png'}/>}
                        {element.tdata.tokens && element.tdata.tokens.length > 0 && element.tdata.tokens.map( (t, i) =>{
                            
                            return <Sprite tint={getColorByRid(t)[0]} alpha={.9} key={i} x={element.w/2 + element.w/4 - i*15} y={element.w/4 - i*20} scale={.4} image={'icons/ct.png'}>
                                    <Sprite image={'race/icons/'+ t +'.png'} scale={1.25} x={47} y={65} alpha={.85}></Sprite>
                                    </Sprite>}
                        )}
                        
                        
                        {element.tdata.planets && element.tdata.planets.length > 0 && element.tdata.planets.map((p,i) => { 
                            return p.hitCenter && <Container key={i} x={p.hitCenter[0]-p.hitRadius} y={p.hitCenter[1]-p.hitRadius}>
                            {hud.selectedTile === index && hud.selectedPlanet === i && !p.isDestroyed && <SelectedPlanet radius={p.hitRadius}/>}
                            <Sprite image={'icons/empty.png'} scale={1} width={p.hitRadius * 2} height={p.hitRadius * 2} 
                            interactive={true} pointerdown={ (e)=>tileClick(e, index, i) }>
                                
                                <Container sortableChildren={true} x={0} y={50}>
                                  {isDMZ(p) && <Sprite image={'icons/dmz.png'} x={0} y={35} scale={1} alpha={.75}/>}
                                  {p.isDestroyed && <Sprite image={'icons/destroyed_planet.png'} x={-p.hitRadius*.3} y={-p.hitRadius} scale={p.hitRadius/185} alpha={.9}/>}
                                  
                                  {p.units && Object.keys(p.units).filter(u => ['pds', 'spacedock'].indexOf(u) > -1).map((u, ui) => {
                                    const isSelected = hud.groundUnitSelected && hud.groundUnitSelected.tile === index && hud.groundUnitSelected.planet === i && hud.groundUnitSelected.unit === u;

                                      return <Container x={-10 + ui*100} y={-10} zIndex={u === 'spacedock' ? 3:1} key={ui}  > 
                                          <Sprite  tint={isSelected ? 'gold':G.races[p.occupied].color[0]} scale={.5} anchor={0} image={'icons/unit_ground_bg.png'}/>
                                          <Sprite image={'units/' + u.toUpperCase() + '.png'} x={0} y={-10} scale={.4} alpha={1} pointerdown={(e)=>groundUnitClick({tile: index, planet: i, unit: u, e})} interactive={true}/>
                                          <Text style={{fontSize: 20, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} 
                                          x={65} y={5} text={p.units[u].length}/>
                                          {u === 'spacedock' && element.active && (!element.tdata.occupied || String(element.tdata.occupied) === String(playerID)) && String(p.occupied) === String(playerID) && 
                                          <Sprite image={'icons/producing.png'} cursor='pointer' scale={.2} x={45} y={-20} interactive={true} pointerdown={()=>dispatch({type: 'producing', planet: p.name})} 
                                              style={{}}/>}
                                      </Container>
                                      }
                                  )}
                      
                                  
                      
                                  {p.invasion && <PlanetUnderAttack w={element.w} x={p.hitRadius * 1.5} y={-p.hitRadius * 1.5} text={t('board.planet_under_attack')} rid={G.races[ctx.currentPlayer].rid} 
                                              rname={t('races.' + G.races[ctx.currentPlayer].rid + '.name')} fleet={p.invasion.troops} color={G.races[ctx.currentPlayer].color[0]}/>}
                                </Container>
                    
                                <Container x={50} y={110}>
                                  {hud.groundUnitSelected && hud.groundUnitSelected.tile === index && 
                                  hud.groundUnitSelected.planet === i && ['infantry', 'fighter', 'mech'].includes(hud.groundUnitSelected.unit) &&
                                  hud.advUnitView && hud.advUnitView.tile === index &&
                                  <SimplePixiButton pointerdown={loadUnit} label={'⯅'} x={-90} y={-45} />}

                                  {p.units && Object.keys(p.units).filter(u => ['infantry', 'fighter', 'mech'].indexOf(u) > -1).map((u, ui) =>{
                                  const isSelected = hud.groundUnitSelected && hud.groundUnitSelected.tile === index && hud.groundUnitSelected.planet === i && hud.groundUnitSelected.unit === u;
                      
                                  return <Container x={-30 + ui*55} y={-20} key={ui} interactive={true} pointerdown={(e)=>groundUnitClick({tile: index, planet: i, unit: u, e})} >
                                              <Sprite tint={isSelected ? 'gold':G.races[p.occupied].color[0]} scale={.25}  image={'icons/unit_inf_bg.png'}/>
                                              <Sprite image={'units/' + u.toUpperCase() + '.png'} x={0} y={0} scale={.25} alpha={1}/>
                                              <Text style={{fontSize: 13, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} x={18} y={40} text={p.units[u].length}/>
                                          </Container>}
                                  )}
                                  {element.tdata.producing_done === true && hud.exhaustedCards.includes('SELF_ASSEMBLY_ROUTINES') &&
                                  <Text interactive={true} pointerdown={()=>moves.fromReinforcement(p.name, {mech: 1}, hud.exhaustedCards)} y={40} x={-30} style={{fontSize: 15, fontFamily:'Handel Gothic', fill: 'yellow', dropShadow: true, dropShadowDistance: 1}} 
                                  text={'► Place 1 mech'}/>
                                  }
                                  {hud.exhaustedCards.includes('TRANSIT_DIODES') && String(p.occupied) === String(playerID) && race.reinforcement.transit && race.reinforcement.transit.length > 0 &&
                                  <Text interactive={true} pointerdown={()=>moves.moveFromTransit(index, i, hud.exhaustedCards)} y={40} x={-30} 
                                      style={{fontSize: 15, fontFamily:'Handel Gothic', fill: 'yellow', dropShadow: true, dropShadowDistance: 1}} 
                                      text={'► Place ' + race.reinforcement.transit.length + ' units'}/>
                                  }
                                </Container>
                    
                                {p.occupied !== undefined && (!p.units || Object.keys(p.units).length === 0) && 
                                <Container x={100} y={50} alpha={.9}>
                                    <Sprite anchor={0.5} rotation={45} tint={G.races[p.occupied].color[0]} scale={.2} image={'icons/ct.png'}/>
                                    <Sprite alpha={.85} scale={.25} x={-10} y={-7} image={'race/icons/'+G.races[p.occupied].rid+'.png'}/>
                                </Container>}
                    
                            </Sprite>
                            </Container>
                            }
                        )}
                        
                    
                        {element.tdata.fleet && <Container x={10} y={-30}>
                          {hud.advUnitView && hud.advUnitView.tile === index && hud.selectedTile === index && selectedPlanet && (selectedPlanet.occupied === undefined || String(element.tdata.occupied) === String(selectedPlanet.occupied)) &&
                              !isDMZ(selectedPlanet) && !selectedPlanet.isDestroyed && <LandingGreen pointerdown={()=>unloadUnit()} x={-20} y={-20} >
                                {selectedPlanet.occupied === undefined && selectedPlanet.name === 'Mecatol Rex' && <Sprite image={'icons/influence_bg.png'} x={8} y={-25} scale={.75}>
                                  <Text x={18} y={15} text={race.rid === 7 ? 0:6} style={{fontSize: 35, fontFamily:'Handel Gothic', fill: 'white'}}/>
                                </Sprite>}
                              </LandingGreen>
                              }
                          {activeTile && String(element.tdata.occupied) === String(playerID) && !G.spaceCannons && element.tdata.fleet && selectedPlanet && 
                              selectedPlanet.occupied !== undefined && String(element.tdata.occupied) !== String(selectedPlanet.occupied) && !isDMZ(selectedPlanet) && !selectedPlanet.isDestroyed &&
                              <LandingRed pointerdown={()=>moves.invasion(selectedPlanet)} x={-20} y={-20} />
                          }
                  
                          {Object.keys(element.tdata.fleet).map((f, i) => {
                          const isCurrentAdvUnit = hud.advUnitView && hud.advUnitView.tile === index && hud.advUnitView.unit === f;
                          return <Container interactive={true} key={i} x={element.w/4 - 50 + i*100} y={0} pointerdown={()=>isCurrentAdvUnit ? dispatch({type: 'adv_unit_view'}):dispatch({type: 'adv_unit_view', payload: {tile: index, unit: f}})} >
                                  <Sprite tint={isCurrentAdvUnit ? 'gold':G.races[element.tdata.occupied].color[0]} scale={.25} anchor={0} image={'icons/unit_bg.png'}/>
                                  <Sprite image={'units/' + f.toUpperCase() + '.png'} x={30} y={5} scale={.3} alpha={1}/>
                                  <Text style={{fontSize: 25, fontFamily:'Handel Gothic', fill: '#FFFFFF', dropShadow: true, dropShadowDistance: 1}} 
                                      x={60} y={53} text={element.tdata.fleet[f].length === 1 ? ' 1':element.tdata.fleet[f].length}/>
                              </Container>
                          })}
                        </Container>}
                    
                        {hud.advUnitView && hud.advUnitView.tile === index && <Container x={30} y={-55}>
                            {element.tdata.fleet && element.tdata.fleet[hud.advUnitView.unit] && element.tdata.fleet[hud.advUnitView.unit].map((ship, i) =>{
                            const cap = advUnitViewTechnology.capacity || 0;
                            const row = [];
                    
                            for(let j=0; j<cap; j++){
                                row.push(<Sprite tint={hud.payloadCursor && hud.payloadCursor.i === i && hud.payloadCursor.j === j ? 'gold':G.races[element.tdata.occupied].color[0]} 
                                    pointerdown={()=>dispatch({type: 'payload_cursor', payload: {i, j}})} interactive={true} key={j} x={20 + j*50} y={-30-i*50} scale={.3} anchor={0} image={'icons/unit_pl_bg.png'}>
                                    {ship && ship.payload && ship.payload.length >= j && ship.payload[j] && <Sprite image={'units/' + ship.payload[j].id.toUpperCase() + '.png'} 
                                    x={10} y={10} scale={1} alpha={.85}/>}
                                </Sprite>);
                            }
                            return row;
                            })}
                        </Container>}
                    
                    
                    
                        {ctx.phase === 'acts' && isMyTurn && hud.selectedTile === index && race.actions.length < maxActs && !activeTile && 
                        element.tdata.type !== 'hyperlane' && !(element.tdata.tokens && element.tdata.tokens.indexOf(race.rid) > -1) && 
                            <Container x={30} y={element.w/2 + 60} alpha={.8} anchor={0.5} cursor='pointer' interactive={true} pointerdown={()=>moves.activateTile(index)} 
                                mouseover={(e) => e.target.alpha = 1} mouseout={(e) => e.target.alpha = .8} >
                            <Sprite x={20} y={-20} scale={.7} image={'label.png'} alpha={.95}/>
                            <Text x={100} y={17} text={t('board.activate_system')} style={{fontSize: 22, fontFamily:'system-ui', fill: '#faebd7', dropShadow: true, dropShadowDistance: 1}}>
                            </Text>
                            </Container>}
                        
                        {activeTile && hud.advUnitView && pathIdxs.length > 0 && <MoveStep tint={moveTint} text={pathIdxs.join(',')} pointerdown={()=>modifyMoveStep(index)} y={element.w * .66} x={element.w * .58} />}
                    
                        {activeTile && hud.advUnitView && element.tdata.type === 'hyperlane' && getMovePath.find(p => String(p.tileId) === String(element.tid)) && 
                            <MoveStep tint={moveTint} pointerdown={()=>modifyMoveStep(index)} y={element.w * .66} x={element.w * .58} />
                        }
                    
                        {activeTile && hud.advUnitView && hud.advUnitView.tile !== undefined && hud.advUnitView.tile !== index && pathIdxs.length === 0 && hud.selectedTile === index &&
                            <MoveStep tint={moveTint} text={'+'} pointerdown={()=>modifyMoveStep(index)} y={element.w * .66} x={element.w * .58} />
                        }
                    
                    </Container>
                </Container>
    })
};

const TilesMap3 = ({G, playerID, moves, ctx, t, stagew, stageh, isMyTurn, activeTile, hud, canMoveThatPath, dispatch, advUnitViewTechnology, getPureMovePath}) => {
   
    const race = G.races[playerID];
    const moveToClick = useCallback((idx) => {

        if(hud.advUnitView && idx === hud.advUnitView.tile){
            if(canMoveThatPath){
              let shipIdx = hud.payloadCursor.i;
              if(shipIdx > G.tiles[idx].tdata.fleet[hud.advUnitView.unit].length){
                  shipIdx = 0;
              }
              
              moves.moveShip({...hud.advUnitView, shipIdx, exhaustedCards: hud.exhaustedCards, path: getPureMovePath})
              dispatch({type: 'payload_cursor', payload: {i: 0, j: 0}});
      
              // change advUnitView after move!
              if(G.tiles[idx].tdata.fleet[hud.advUnitView.unit].length <= 1){
                  dispatch({type: 'adv_unit_view'})
              }
            }
        }
    
    }, [G.tiles, hud.exhaustedCards, hud.advUnitView, hud.payloadCursor, moves, canMoveThatPath, getPureMovePath, dispatch]);


    const distanceInfo = useCallback(()=>{
      try{
        if(race && advUnitViewTechnology && advUnitViewTechnology.move && getPureMovePath.length){
          let adj = 0;
          const tile = G.tiles[hud.advUnitView.tile];
          let mov = advUnitViewTechnology.move;

          if(tile && tile.tdata && tile.tdata.anomaly === 'nebula'){
            mov = 1;
          }

          const rifts = getPureMovePath.filter((m, i) => i < (getPureMovePath.length - 1) && ['41', '67'].includes(String(m)));
          if(rifts && rifts.length > 0){
            adj += rifts.length;
          }

          if(hud.exhaustedCards.includes('GRAVITY_DRIVE')) adj++;
          if(race.moveBoost) adj += race.moveBoost;
          return [t('board.move_path_distance') + ': ' + (getPureMovePath.length-1), 
                  t('board.move_power_reserve') + ': ' + mov, 
                  t('board.move_boost') + ': ' + adj];
        }
        else{
            return ['-', '-', '-'];
        }
      }
      catch(e){console.log(e)}
    //eslint-disable-next-line
    }, [advUnitViewTechnology, getPureMovePath, race]);
    
    const canMoveFromTile = useCallback((element, index) => {

      return (hud.advUnitView && hud.advUnitView.tile === index) && 
              ((hud.exhaustedCards.includes('Dominus Orb') && element.tdata.tokens.includes(race.rid)) ||
              element.tdata.tokens.indexOf(race.rid) === -1)
    }, [hud, race])

    return G.tiles.map((element, index) => {
        const [firstCorner] = element.corners;
        let fleetSize = 0;
        let fleetExceed = false;
        
        if(element.tdata && element.tdata.fleet && element.tdata.occupied !== undefined){
          Object.keys(element.tdata.fleet).forEach(tag => {
            if(tag.toUpperCase() !== 'FIGHTER'){
              fleetSize += element.tdata.fleet[tag].length;
            }
          });

          fleetExceed = fleetSize > G.races[element.tdata.occupied].tokens.f;
        }

        return <Container key={index} x={firstCorner.x + stagew/2 + 7.5 - element.w/2 - element.w/4} y={firstCorner.y + stageh/2 + 7.5}>
                    {element.tdata.attacker && <SectorUnderAttack w={element.w} rid={G.races[ctx.currentPlayer].rid} rname={t('races.' + G.races[ctx.currentPlayer].rid + '.name')} 
                                        text={t('board.sector_under_attack')} fleet={element.tdata.attacker} color={G.races[ctx.currentPlayer].color[0]}/>}

                    {ctx.phase === 'acts' && isMyTurn && !fleetExceed && activeTile && activeTile.tid !== element.tid && canMoveFromTile(element, index) && String(element.tdata.occupied) === String(playerID) && 
                                <MoveDialog  x={-240} y={-50} canMoveThatPath={canMoveThatPath} pointerdown={() => moveToClick(index)} 
                                            distanceInfo={distanceInfo(element, activeTile)} buttonLabel={t('board.go')}/>}
                    {fleetExceed && <AnimatedLabel text={t('board.fleet_pool_exceed')}/>}
                </Container>
    })
};


const TickerSettings = memo(function TickerSettings(args) {

    const app = useApp();
    app.ticker.maxFPS = args.fps;

    return <></>
})

const getUnitsString = (units) => {
    var s = '';
    Object.keys(units).forEach(k => {
      switch(k){
        case 'flagship':
          s += 'F' + units[k].length;
          break;
        case 'warsun':
          s += 'W' + units[k].length;
          break;
        case 'dreadnought':
          s += 'D' + units[k].length;
          break;
        case 'carrier':
          s += 't' + units[k].length;
          break;
        case 'destroyer':
          s += 'd' + units[k].length;
          break;
        case 'cruiser':
          s += 'c' + units[k].length;
          break;
        case 'fighter':
          s += 'f' + units[k].length;
          break;
        case 'infantry':
          s += 'i' + units[k].length;
          break;
        case 'mech':
          s += 'm' + units[k].length;
          break;
        case 'pds':
          s += 'p' + units[k].length;
          break;
        case 'spacedock':
          s += 'd' + units[k].length;
          break;
        default:
          s += '';
      }
    });
    return s;
  }

const isDMZ = (p) => p.attach && p.attach.length && p.attach.indexOf('Demilitarized Zone') > -1;