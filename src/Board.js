/* eslint eqeqeq: 0 */

import { useMemo, useCallback, useEffect, useRef, useContext } from 'react';
import { ButtonGroup, Card, CardImg, CardText, CardTitle, UncontrolledTooltip, CardBody, Tooltip, ListGroup, Container as Cont, CardColumns, Input, Label
   } from 'reactstrap';
import { PaymentDialog, StrategyDialog, AgendaDialog, getStratColor, PlanetsRows, UnitsList,
ObjectivesList, TradePanel, ProducingPanel, ChoiceDialog, CardsPager, CardsPagerItem, Overlay, StrategyPick, Gameover,
SelectDiscardedActions} from './dialogs';
import { ActionCardDialog, TechnologyDialog } from './actionCardDialog'; 
import { checkObjective, StateContext, haveTechnology, haveAbility, LocalizationContext, UNITS_LIMIT, getMyNeighbors, checkIfMyNearbyUnit, getRaceVP } from './utils';

import { ChatBoard } from './chat';
import { SpaceCannonAttack, AntiFighterBarrage, SpaceCombat, CombatRetreat, Bombardment, Invasion, ChooseAndDestroy } from './combat';
import { useImmerReducer } from 'use-immer';
import techData from './techData.json';

import useImagePreloader, {getTilesAndRacesImgs} from './imgUtils.js';
import imgSrc from './imgsrc.json';
import { Blocks } from 'react-loader-spinner';
import { Persons, Stuff, CARD_STYLE, MyNavbar, GlobalPayment } from './components';
import { hudReducer } from './reducers.js';
import { PixiStage } from './pixiStage.js';

import { EffectsBoardWrapper, useEffectListener } from 'bgio-effects/react';

function TIOBoard({ ctx, G, moves, undo, playerID, sendChatMessage, chatMessages }) {

  const [hud, dispatch] = useImmerReducer(hudReducer, {producing: null, exhaustedCards: [], leftPanel: null, advUnitView: undefined, 
    groundUnitSelected: {}, payloadCursor: {i:0, j:0}, subcardVisible: 'stuff', rightBottomVisible: null, rightBottomSubVisible: null,
    selectedTile: -1, selectedPlanet: -1, selectedTech: {}, moveSteps: [], tempCt: {t: 0, s: 0, f: 0, new: 0}, justOccupied: null, payObj: null,
    globalPayment: { influence: [], resources: [], tg: 0, token: { s:0, t:0 }, fragment: {h:0, i:0, c:0, u:0}, propulsion: [], biotic: [], cybernetic: [], warfare: [] }, abilityData: {}, withAgent: true});

  const G_stringify = useMemo(() => JSON.stringify(G), [G]);
  const G_tiles_stringify = useMemo(() => JSON.stringify(G.tiles), [G]);
  const G_races_stringify = useMemo(() => JSON.stringify(G.races), [G]);
  const ctx_stringify = useMemo(() => JSON.stringify(ctx), [ctx]);

  //eslint-disable-next-line
  const race = useMemo(() => G.races[playerID], [G_races_stringify, playerID]);
  const isMyTurn = useMemo(() => ctx.currentPlayer === playerID, [ctx.currentPlayer, playerID]);
  const prevStages = useRef(null);
  const { t } = useContext(LocalizationContext);

  const PLANETS = useMemo(()=> {
    const arr = [];

    G.tiles.forEach( t => {
      if(t.tdata.planets && t.tdata.planets.length){
        t.tdata.planets.forEach((p, pidx) => {
          if(String(p.occupied) === String(playerID)){
            arr.push({...p, tid: t.tid, pidx});
          }
        })
      }
    });

    return arr;
  //eslint-disable-next-line
  }, [G_tiles_stringify, playerID]);

  const PLANETS_stringify = useMemo(() => JSON.stringify(PLANETS), [PLANETS]);

  const UNITS = useMemo(()=> {
    const units = [];

    G.tiles.forEach( t => {
      if(t.tdata.occupied == playerID){
        if(t.tdata.fleet){ //todo: or invasion fleet
          Object.keys(t.tdata.fleet).forEach( k => { 
            if(!units[k]) units[k] = 0;
            units[k] += t.tdata.fleet[k].length;
            
            t.tdata.fleet[k].forEach(ship => {
              if(ship && ship.payload && ship.payload.length){
                ship.payload.forEach(pl => {
                  if(pl && pl.id){
                    if(!units[pl.id]) units[pl.id] = 0;
                    units[pl.id]++;
                  }
                });
              }
            });
          });
        }
      }

      if(t.tdata.planets && t.tdata.planets.length){
        t.tdata.planets.forEach(p => {
          if(p.occupied == playerID){ //todo: or attacker forces
            if(p.units){
              Object.keys(p.units).forEach( k => {
                if(!units[k]) units[k] = 0;
                units[k] += Array.isArray(p.units[k]) ? p.units[k].length:p.units[k];
              });
            }
          }
        })
      }
    });
    
    return units;
  //eslint-disable-next-line
  }, [G_tiles_stringify, playerID]);

  const UNITS_stringify = useMemo(() => JSON.stringify(UNITS), [UNITS])

  const R_UNITS = useMemo(() => {
    if(race){
      const all_units = race.technologies.filter(t => t.type === 'unit' && (!t.upgrade || (t.id === 'WARSUN' && race.knownTechs.indexOf('WARSUN')>-1)));
      all_units.forEach(u => all_units[u.id] = u);
      return all_units;
    }
  }, [race]);

  const R_UPGRADES = useMemo(() => {
    if(race){
      const upgrades = race.technologies.filter(t => t.type === 'unit' && t.upgrade);
      upgrades.forEach(u => upgrades[u.id] = u);
      return upgrades;
    }
  }, [race]);

  const VP = useMemo(() => {
    return getRaceVP(G, playerID);
  //eslint-disable-next-line
  }, [G_races_stringify, playerID]);

  const GP = useMemo(() => {

    let result = {resources: 0, influence: 0, tg: 0, propulsion: 0, biotic: 0, cybernetic: 0, warfare: 0, tgMultiplier: 1}

    if(hud.globalPayment.resources && hud.globalPayment.resources.length){
      hud.globalPayment.resources.forEach(pname => {
          const planet = PLANETS.find(p => p.name === pname);
          if(planet && planet.resources && !planet.exhausted) result.resources += planet.resources
      });
    }
    
    if(hud.globalPayment.influence && hud.globalPayment.influence.length){
      hud.globalPayment.influence.forEach(pname => {
          const planet = PLANETS.find(p => p.name === pname);
          if(planet && planet.influence && !planet.exhausted) result.influence += planet.influence
      });
    }
    if(hud.globalPayment.propulsion && hud.globalPayment.propulsion.length){
      hud.globalPayment.propulsion.forEach(pname => {
          const planet = PLANETS.find(p => p.name === pname);
          if(planet && planet.specialty && !planet.exhausted) result.propulsion += 1
      });
    }
    if(hud.globalPayment.biotic && hud.globalPayment.biotic.length){
      hud.globalPayment.biotic.forEach(pname => {
          const planet = PLANETS.find(p => p.name === pname);
          if(planet && planet.specialty && !planet.exhausted) result.biotic += 1
      });
    }
    if(hud.globalPayment.cybernetic && hud.globalPayment.cybernetic.length){
      hud.globalPayment.cybernetic.forEach(pname => {
          const planet = PLANETS.find(p => p.name === pname);
          if(planet && planet.specialty && !planet.exhausted) result.cybernetic += 1
      });
    }
    if(hud.globalPayment.warfare && hud.globalPayment.warfare.length){
      hud.globalPayment.warfare.forEach(pname => {
          const planet = PLANETS.find(p => p.name === pname);
          if(planet && planet.specialty && !planet.exhausted) result.warfare += 1
      });
    }
    if(hud.globalPayment.tg && hud.globalPayment.tg > 0){
      result.tg = hud.globalPayment.tg;
    }

    if(haveTechnology(race, "MIRROR_COMPUTING")){
      result.tgMultiplier = 2;
    }

    return result;
//eslint-disable-next-line
  }, [hud.globalPayment, PLANETS_stringify]);

  const MY_FLEET_EXCEED = useMemo(() => {
    return G.tiles.find(tile => {
      if(tile && tile.tdata && tile.tdata.fleet && String(tile.tdata.occupied) === String(playerID)){
        let fleetSize = 0;
        Object.keys(tile.tdata.fleet).forEach(tag => {
          fleetSize += tile.tdata.fleet[tag].length;
        });

        return fleetSize > race.tokens.f;
      }
      return false;
    })
  //eslint-disable-next-line
  }, [G_tiles_stringify, race]);

  const togglePaymentDialog = (payment) => {
    if(payment && Object.keys(payment).length > 0){
      moves.completeObjective(hud.payObj, {...payment, tgMultiplier: GP.tgMultiplier});
    }
    dispatch({type: 'pay_obj', payload: null})
  };

  const globalPayPlanet = useCallback((e, planet, type) => {
    e.preventDefault();
    e.stopPropagation();

    dispatch({type: 'global_payment', payload: {planet, type}})
  }, [dispatch]);

  const globalPayTg = useCallback((inc) => {
    if(race.tg - GP.tg > 0){
      dispatch({type: 'global_payment', payload: {tg: inc, tgMultiplier: GP.tgMultiplier}});
    }
  }, [dispatch, race, GP]);

  const globalPayCancelPlanet = useCallback((pname) => {
      dispatch({type: 'global_payment', payload: {planet: pname, type: 'cancel'}})
  }, [dispatch]);

  const globalPaymentExhaustedPlanets = useMemo(() => [...hud.globalPayment.influence, ...hud.globalPayment.resources, 
    ...hud.globalPayment.propulsion, ...hud.globalPayment.biotic, ...hud.globalPayment.cybernetic, ...hud.globalPayment.warfare], [hud.globalPayment])
  
  const completeObjective = (oid) => {
    let objective;
    if(race.lastScoredObjType !== 'public') objective = G.pubObjectives.find(o => o.id === oid);
    if(!objective && race.lastScoredObjType !== 'private') objective = G.races[playerID].secretObjectives.find(o => o.id === oid);
    if(!objective) return;

    if(objective.type === 'SPEND'){
      dispatch({type: 'pay_obj', payload: oid})
    }
    else{
      if(checkObjective(G, playerID, oid)){
        moves.completeObjective(oid);
      }
    }
  }

  const dropSecretObjective = (oid) => {
    const objective = race.secretObjectives.find(o => o.id === oid);
    if(!objective) return;

    if(!objective.players || !objective.players.length){
      moves.dropSecretObjective(oid);
    }
  }

  const relicClick = (relicId) => {
    if(relicId === 'Maw of Worlds'){
      if(hud.selectedTech && hud.selectedTech.techno){
        moves.useRelic({id: relicId, techId: hud.selectedTech.techno.id});
        sendChatMessage(t('cards.relics.' + relicId + '.label'));
      }
    }
    else if(relicId === 'Stellar Converter'){
      if(hud.selectedPlanet > -1){
        moves.useRelic({id: relicId, tile: hud.selectedTile, planet: hud.selectedPlanet});
        sendChatMessage(t('cards.relics.' + relicId + '.label'));
      }
    }
    else if(relicId === 'The Crown of Emphidia'){
      if(hud.selectedPlanet > -1){
        moves.useRelic({id: relicId, tile: hud.selectedTile, planet: hud.selectedPlanet});
        sendChatMessage(t('cards.relics.' + relicId + '.label'));
        dispatch({type: 'exhaust_card', cardId: relicId})
      }
    }
    else{
      dispatch({type: 'exhaust_card', cardId: relicId})
    }
  }

  const mustAction = useMemo(() => {
    if(race && race.actionCards && isMyTurn) return race.actionCards.length > 7
  }, [race, isMyTurn]);

  const mustSecObj = useMemo(() => {
    let max = 3;

    if(race && race.secretObjectives && isMyTurn){
      if(race.mustDropSecObj) return true;
      if(race.relics && race.relics.length && race.relics.includes('race.mustDropSecObj')){
        max++;
      }
      
      return race.secretObjectives.length > max;
    }
  }, [race, isMyTurn]);

  const rightBottomSwitch = useCallback((val) => {
    if(hud.rightBottomVisible === val){
      dispatch({type: 'right_bottom_visible', payload: null});
    }
    else{
      dispatch({type: 'right_bottom_visible', payload: val});
    }
  }, [hud.rightBottomVisible, dispatch]);

  const StrategyCard = ({card, idx}) => {

    return <>
            <button id={'strategyCard_'+card.id} className={'styledButton ' + (card.exhausted ? 'white':'black')} disabled={card.exhausted} 
              style={{width: '12rem', height: '3.5rem', fontFamily: 'Handel Gothic', display: 'flex', alignItems: 'center'}} onClick={(e)=>{e.stopPropagation(); moves.useStrategy(idx)}}>
              <b style={{backgroundColor: getStratColor(card.id, .6), border: 'solid 1px', width: '1.5rem', height: '1.5rem', fontSize: '1.25rem', lineHeight: '1.25rem'}}>{card.init+1}</b>
              <span style={{flex: 'auto'}}>{' ' + t('cards.strategy.' + card.id + '.label')}</span>
            </button>
            <UncontrolledTooltip style={{padding: '1rem', textAlign: 'left'}} placement='left' target={'#strategyCard_' + card.id}>
              <h6 style={{marginTop: '.5rem'}}>{t('board.primary')}:</h6>
              <CardText>{t('cards.strategy.' + card.id + '.primary')}</CardText>
              <h6>{t('board.secondary')}:</h6>
              <CardText>{t('cards.strategy.' + card.id + '.secondary')}</CardText>
          </UncontrolledTooltip>
        </>
  }

  const strategyStage = useMemo(()=> {
    return G.strategy !== undefined && ctx.activePlayers && Object.keys(ctx.activePlayers).length > 0 && Object.values(ctx.activePlayers)[0] === 'strategyCard'
  }, [G, ctx]);

  const actionCardStage = useMemo(() => {
    return ctx.activePlayers && Object.keys(ctx.activePlayers).length > 0 && Object.values(ctx.activePlayers)[0]==='actionCard';
  }, [ctx]);

  const spaceCannonAttack = useMemo(()=> {
    return ctx.activePlayers && Object.keys(ctx.activePlayers).length > 0 && (ctx.activePlayers[playerID] === 'spaceCannonAttack' || ctx.activePlayers[playerID] === 'spaceCannonAttack_step2');
  }, [ctx, playerID]);

  const antiFighterBarrage = useMemo(()=> {
    return ctx.activePlayers && Object.keys(ctx.activePlayers).length === 2 && ctx.activePlayers[playerID] === 'antiFighterBarrage';
  }, [ctx, playerID]);

  const spaceCombat = useMemo(() => {
    return ctx.activePlayers && ctx.activePlayers[playerID] && ctx.activePlayers[playerID].startsWith('spaceCombat');
  }, [ctx.activePlayers, playerID]);

  const combatRetreat = useMemo(() => {
    return ctx.activePlayers && (ctx.activePlayers[playerID] === 'combatRetreat')
  }, [ctx.activePlayers, playerID]);

  const bombardment = useMemo(() => {
    return ctx.activePlayers && (ctx.activePlayers[playerID] === 'bombardment')
  }, [ctx.activePlayers, playerID]);

  const invasion = useMemo(() => {
    return ctx.activePlayers && ctx.activePlayers[playerID] && ctx.activePlayers[playerID].startsWith('invasion');
  }, [ctx.activePlayers, playerID]);

  /*const tradeOffer = useMemo(() => {
    if(!isMyTurn && G.trade[ctx.currentPlayer] && G.trade[ctx.currentPlayer].length){
      const my = G.trade[ctx.currentPlayer][playerID];

      if(my && my.length){
        return my;
      }
    }
  //eslint-disable-next-line
  }, [ctx.currentPlayer, G_stringify])*/

 //eslint-disable-next-line
  const activeTile = useMemo(()=> G.tiles.find(t => t.active === true), [G_tiles_stringify]);

  const reparations = useMemo(() => {
    if(ctx.activePlayers && ctx.activePlayers[playerID] === 'reparations' && race.reparation && race.reparation.type){
      return race.reparation.type
    }
  }, [ctx, race, playerID]);

  const promissoryClick = useCallback((pr) => {
    try{
      if(reparations === 'promissory'){
        moves.transferPromissoryCard(pr.id)
      }
      else{
        if(pr.id === 'POLITICAL_SECRET' && pr.owner && ctx.phase === 'agenda'){
          moves.usePromissory(pr);
        }
      }
    }
    catch(e){console.log(e)}
  }, [moves, ctx, reparations]);

  const flushTempCt = useCallback(() =>{
    dispatch({type: 'temp_ct', payload: {s: 0, t: 0, f: 0, new: 0}})
  //eslint-disable-next-line
  }, []);

  const exhaustTechCard = useCallback((techId) => {
    if(race.exhaustedCards.includes(techId)){
      return false;
    }

    dispatch({
      type: 'exhaust_card',
      cardId: techId,
      planet: techId === 'INTEGRATED_ECONOMY' ? hud.justOccupied : 
              techId === 'SLING_RELAY' ? G.tiles[hud.selectedTile].tdata.planets.find(p => p.units.spacedock && String(p.occupied) === String(playerID))?.name : null
    })

    if(techId === 'PREDICTIVE_INTELLIGENCE'){
      flushTempCt();
    }
  //eslint-disable-next-line
  }, [race.exhaustedCards, G.tiles, hud.selectedTile, playerID, hud.justOccupied]);


  const isRelicDisabled = (relic) => {
    try{
      if(relic && relic.id === 'Maw of Worlds'){
        return !(hud.selectedTech && hud.selectedTech.techno && ctx.phase === 'agenda' && (!race.voteResults || !race.voteResults.length));
      }
      else if(relic && relic.id === 'Stellar Converter'){
        
        if(ctx.phase === 'acts' && race.actions.length < maxActs && hud.selectedTile > 0){
          const tile = G.tiles[hud.selectedTile];

          if(tile && tile.tdata){
            if(tile.tdata.type !== 'green' && tile.tid !== 18){

              const planet = tile.tdata.planets[hud.selectedPlanet];
              if(planet && !planet.legendary){
                const techs = race.technologies.filter(t => t && t.bombardment);
                const bombs = techs.map(t => t.id.toLowerCase());
                const found = checkIfMyNearbyUnit(G, playerID, tile, bombs);
                return !found;
              }
            }
          }
        }

        return true;
      }
      else if(ctx.phase === 'acts' && relic && relic.id === 'The Codex'){
        if(race.actions.length >= maxActs){
          return true;
        }
      }
      else if(relic && relic.id === 'The Crown of Emphidia'){

        if(ctx.phase === 'acts' && race.actions.length && hud.selectedTile > -1 && hud.selectedPlanet > -1){
          if(race.exhaustedCards && race.exhaustedCards.includes(relic.id)) return true;
          const tile = G.tiles[hud.selectedTile];
          if(tile && tile.tdata){
            const planet = tile.tdata.planets[hud.selectedPlanet];
            
            if(planet && planet.trait && String(planet.occupied) === String(playerID)){
              return false;
            }
          }
        }
        else if(ctx.phase === 'stats'){
          const tomb = PLANETS.find(p => p.attach && p.attach.length && p.attach.includes('Tomb of Emphidia'));
          if(tomb) return false;
        }

        return true;
      }
      else if(relic && relic.id === "The Prophet's Tears"){
        return !(strategyStage && G.strategy === 'TECHNOLOGY' && ctx.activePlayers[playerID])
      }
      

      return relic.exhausted || relic.purged;
    }
    catch(e){console.log(e)}
  }

  const maxActs =  useMemo(() => {if(race){return haveTechnology(race, 'FLEET_LOGISTICS') ? 2:1}}, [race]);
  
  //eslint-disable-next-line
  const neighbors = useMemo(() => getMyNeighbors(G, playerID), [G_tiles_stringify]);

 
  const advUnitSwitch = useMemo(()=> {
    if(hud.advUnitView){
      return hud.advUnitView.tile;
    }
  }, [hud.advUnitView]);

  const activeTileSwitch = useMemo(() => {
    if(activeTile){
      return activeTile.tid;
    }
  }, [activeTile]);

  const TechAction = (args) => { 

    let disabled = race.exhaustedCards.includes(args.techId);
    let technology = techData.find(t => t.id === args.techId);
    if(!technology){//probably racial
      technology = race.technologies.find(td => td.id === t);
    } 
    let icon = technology ? technology.type:'propulsion';
    let addText = '';
    let units = {};

    if(!disabled && args.techId === 'INTEGRATED_ECONOMY'){
      if(ctx.phase !== 'acts' || !hud.justOccupied) disabled = true;
    }
    if(!disabled && args.techId === 'SCANLINK_DRONE_NETWORK'){
      if(ctx.phase !== 'acts'){
        disabled = true;
      }
      else if(!activeTile || hud.selectedPlanet === -1 || G.tiles[hud.selectedTile].tid !== activeTile.tid){
        disabled = true;
      }
      else{
        const p = activeTile.tdata.planets[hud.selectedPlanet];
        if(p.exhausted || !p.trait || !p.units || String(p.occupied) !== String(playerID)){
          disabled = true;
        }
      }
    }
    if(!disabled && args.techId === 'SELF_ASSEMBLY_ROUTINES'){
      if(ctx.phase !== 'acts') disabled = true;
      if(!G.tiles.find(t => t.tdata.producing_done === true)) disabled = true;
    }
    if(!disabled && args.techId === 'AI_DEVELOPMENT_ALGORITHM'){
      if(!(ctx.activePlayers && ctx.activePlayers[playerID]) === 'strategyCard' && G.strategy === 'TECHNOLOGY') disabled = true;
    }
    if(!disabled && args.techId === 'GRAVITY_DRIVE'){
      if(ctx.phase !== 'acts') disabled = true;
      if(!activeTile) disabled = true;
    }
    if(!disabled && args.techId === 'BIO_STIMS'){ 
      if(ctx.phase !== 'acts') disabled = true;
      if(race.actions.length === 0) disabled = true;
    }
    if(!disabled && args.techId === 'TRANSIT_DIODES'){ 
      if(ctx.phase !== 'acts' || race.actions.length > 0) disabled = true;
    }
    if(!disabled && args.techId === 'PREDICTIVE_INTELLIGENCE'){
      if(ctx.phase !== 'agenda' && race.actions.length === 0) disabled = true;
    }
    if(!disabled && args.techId === 'SLING_RELAY'){
      if(ctx.phase !== 'acts') disabled = true;
      if(hud.selectedTile < 0){
        disabled = true;
      }
      else{
        const tdata = G.tiles[hud.selectedTile].tdata;
        if(tdata.occupied && String(tdata.occupied) !== String(playerID)){
          disabled = true;
        }
        else if(!tdata.planets || !tdata.planets.find(p => String(p.occupied) === String(playerID) && p.units && p.units.spacedock)){
          disabled = true;
        }

      }
    }

    if(!disabled && args.techId === 'INFANTRY2'){
      const readyToRes = race.tempTechnoData.filter(i => i.id === 'INFANTRY2' && i.dice && i.dice.length && i.dice[0] > technology.resurectAbove);
      if(Array.isArray(readyToRes)){
        if(readyToRes.length){
          units = {'infantry': readyToRes.length};
        }
        else{
          disabled = true;
        }
        addText = ' (' + readyToRes.length + ')';
      }
      else{
        disabled = true;
      }
      if(!disabled && ctx.phase !== 'acts') disabled = true;
    }

    const onClick = ()=>{
      if(args.techId === 'SCANLINK_DRONE_NETWORK' && activeTile.tdata && activeTile.tdata.planets){
        const planet = activeTile.tdata.planets[hud.selectedPlanet];
        moves.explorePlanet(planet.name, ['SCANLINK_DRONE_NETWORK']);
      }
    
      exhaustTechCard(args.techId);
    }

    return  <CardsPagerItem tag='context'>
              <button style={{width: '100%', marginBottom: '1rem'}} disabled={disabled} 
                  className = {'styledButton ' + (hud.exhaustedCards.includes(args.techId) ? 'white':'yellow')} onClick={onClick}>
                <img alt='tech type' src={'icons/'+icon+'.png'} style={{width: '2rem', position: 'absolute', left: '1rem', bottom: '1rem'}}/>
                <b style={{lineHeight: '1rem', display: 'inline-block', padding: '.5rem 0'}}>{t('cards.techno.' + args.techId + '.label') + addText}</b>
              </button>

              {args.techId === 'BIO_STIMS' && hud.rightBottomSubVisible === args.techId && <ListGroup className='subPanel' style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', top: '0', position: 'absolute', right: '0', width: '15rem', padding: '1rem', fontSize: '1rem'}}>
                      <b>{t('board.ready_one') + ':'}</b>
                      {PLANETS.map((p, i) => {
                        if(p.specialty && p.exhausted){
                          return <button key={i} onClick={() => {moves.readyPlanet(p.name, hud.exhaustedCards); dispatch({type: 'right_bottom_sub_visible', payload: null})}} style={{width: '100%', margin: '.25rem'}} className='styledButton yellow'>
                            {t('planets.' + p.name)}
                          </button>
                        }
                        else{
                          return <div key={i}></div>
                        }
                      })}
                      {race.exhaustedCards.map((c, i)=>{
                        return <button key={i} onClick={() => {moves.readyTechnology(c, hud.exhaustedCards); dispatch({type: 'right_bottom_sub_visible', payload: null})}} style={{width: '100%', margin: '.25rem'}} className='styledButton blue'>
                          {t('cards.techno.' + c + '.label')}
                        </button>
                      })}
                      <button onClick={() => dispatch({type: 'right_bottom_sub_visible', payload: null})} style={{width: '100%', margin: '.25rem'}} className='styledButton black'>
                          {t('board.cancel')}
                        </button>
                    </ListGroup>}

              {args.techId === 'INFANTRY2' && hud.rightBottomSubVisible === args.techId && <ListGroup className='subPanel' style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', top: '0', position: 'absolute', right: '0', width: '15rem', padding: '1rem', fontSize: '1rem'}}>
                <b>{t('board.choose_one') + ':'}</b>
                {G.tiles.filter(t => t.tid === race.rid).map((tile, j) => {
                  if(tile && tile.tdata && tile.tdata.planets){
                    return tile.tdata.planets.map((p, i) =>
                      <button key={j+i} onClick={() => {moves.fromReinforcement(p.name, units, hud.exhaustedCards); dispatch({type: 'right_bottom_sub_visible', payload: null})}} style={{width: '100%', margin: '.25rem'}} className='styledButton yellow'>
                        {t('planets.' + p.name)}
                      </button>)
                  }
                  else{
                    return <div key={j}></div>
                  }
                })}

                <button onClick={() => dispatch({type: 'right_bottom_sub_visible', payload: null})} style={{width: '100%', margin: '.25rem'}} className='styledButton black'>
                    {t('board.cancel')}
                  </button>
              </ListGroup>}
                    

              {t('cards.techno.' + args.techId + '.description')}
            </CardsPagerItem>
  }

  const AbilAction = ({abilId}) => { 
    let disabled;
    //let ability = race.abilities.find(a => a.id === abilId);

    if(abilId === 'ORBITAL_DROP'){
      disabled = true;

      if(!race.actions || race.actions.length < maxActs){
        if(hud.selectedTile > -1 && hud.selectedPlanet > -1){
          const tile = G.tiles[hud.selectedTile];

          if(tile && tile.tdata && tile.tdata.planets){
            const planet = tile.tdata.planets[hud.selectedPlanet];

            if(planet && String(planet.occupied) === String(playerID)){
              disabled = false;
            }
          }
        }
      }
    }

    if(abilId === 'PILLAGE'){
      disabled = true;

      if(hud.abilityData && hud.abilityData.pillage && hud.abilityData.pillage.length > 0){
        disabled = false;
      }
    }

    const onClick = ()=>{
      if(abilId === 'ORBITAL_DROP'){
        moves.useRacialAbility({abilId, selectedTile: hud.selectedTile, selectedPlanet: hud.selectedPlanet, exhaustedCards: hud.exhaustedCards})
        sendChatMessage(t('races.' + race.rid + '.' + abilId + '.label'));
      }
      else if(abilId === 'PILLAGE'){
        dispatch({type: 'right_bottom_sub_visible', payload: 'pillage'})
      }
        
    }

    const onSubClick = (args)=> {
      if(abilId === 'PILLAGE'){
        if(!isMyTurn) return;
        moves.useRacialAbility({abilId, ...args, withAgent: hud.withAgent});
        sendChatMessage(t('races.' + race.rid + '.' + abilId + '.label'));
        dispatch({ type: 'ability', tag: 'pillage', del: true, playerID: args.playerID })
      }
    }

    return  <CardsPagerItem tag='context'>
              <button style={{width: '100%', marginBottom: '1rem'}} disabled={disabled} className = {'styledButton yellow'} onClick={onClick}>
                <b style={{lineHeight: '1rem', display: 'inline-block', padding: '.5rem 0'}}>{t('races.' + race.rid + '.' + abilId + '.label')}</b>
              </button>

              {abilId === 'PILLAGE' && hud.abilityData.pillage && hud.rightBottomSubVisible === 'pillage' && <div className='subPanel' style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', top: '0', position: 'absolute', right: '0', minWidth: '15rem', padding: '1rem', fontSize: '1rem'}}>
                      {hud.abilityData.pillage.map((p, i) => {
                          const pilRace = G.races[p];

                          return <span key={p} className='rightBottomSub_complex'>
                            <b>{t('races.' + pilRace.rid + '.name')}</b>
                            <button disabled={pilRace.tg < 3} onClick={() => onSubClick({playerID: p, param: 'tg'})} className='styledButton black'>{'1 / ' + pilRace.tg}<img alt='tg' src='/icons/trade_good_1.png'/></button>
                            <button disabled={pilRace.tg < 3} onClick={() => onSubClick({playerID: p, param: 'commodity'})} className='styledButton black'>{pilRace.commodity}<img alt='tg' src='/icons/commodity_1.png'/></button>
                          </span>
                      })}
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
                        <button onClick={() => dispatch({type: 'right_bottom_sub_visible', payload: null})} style={{width: '10rem', margin: '.5rem'}} className='styledButton black'>
                            {t('board.cancel')}
                        </button>
                        <div style={{fontSize: '125%'}}>
                          <Input disabled={race.exhaustedCards.includes('AGENT')} type="checkbox" id="withAgent" name="withAgent" checked={!race.exhaustedCards.includes('AGENT') && hud.withAgent} onChange={() => dispatch({type: 'with_agent'})} />
                          <Label style={{marginLeft: '.5rem'}} for="withAgent">{t('board.with_agent')}</Label>
                        </div>
                      </div>
                    </div>}

              {t('races.' + race.rid + '.' + abilId + '.effect')}
            </CardsPagerItem>
  }

  const MechDeploy = () => {
    let disabled = true;

    if(race.rid === 1 && race.actions && race.actions.length && race.actions[race.actions.length - 1] === 'ORBITAL_DROP'){
      if(!UNITS['mech'] || (UNITS['mech'] < UNITS_LIMIT['mech'])){
        if(GP.resources + (GP.tg * GP.tgMultiplier) > 2){
          disabled = false;
        }
      }
    }

    const onClick = () => {
      moves.deployMech({planet: race.lastUsedPlanet, payment: hud.globalPayment})
      sendChatMessage(t('races.' + race.rid + '.MECH.label'));
    }

    return  <>
              <CardsPagerItem tag='context'>
                <button style={{width: '100%', marginBottom: '1rem'}} disabled={disabled} className = {'styledButton yellow'} onClick={onClick}>
                  <b style={{lineHeight: '1rem', display: 'inline-block', padding: '.5rem 0'}}>{t('races.' + race.rid + '.MECH.label')}</b>
                </button>

                {t('races.' + race.rid + '.MECH.deploy')}
              </CardsPagerItem>
            </>
  }



  const stateContext = useMemo(() => ({G, ctx, playerID, /*matchID, credentials,*/ moves, selectedTech: hud.selectedTech, exhaustedCards: hud.exhaustedCards, exhaustTechCard, prevStages: prevStages.current, PLANETS, UNITS}), 
  //eslint-disable-next-line
  [G_stringify, ctx_stringify, playerID, moves, hud.selectedTech, hud.exhaustedCards, exhaustTechCard, prevStages, PLANETS_stringify, UNITS_stringify]);


  useEffect(() => {
    let overlay = document.getElementById('tempOverlay');
    if(overlay){
      overlay.remove();
    }
  }, [])

  useEffect(() => {
    dispatch({type: 'planets_change', payload: PLANETS})
  //eslint-disable-next-line
  }, [PLANETS_stringify]);

  useEffect(() => {
    if(hud.groundUnitSelected.unit !== undefined){
      const t = G.tiles[hud.groundUnitSelected.tile];
      if(t && t.tdata){
        const p = t.tdata.planets[hud.groundUnitSelected.planet];
        if(!p || !p.units || !p.units[hud.groundUnitSelected.unit]){
          dispatch({type: 'ground_unit_selected', payload: {}});
        }
      }
    }
  //eslint-disable-next-line
  }, [hud.groundUnitSelected, G_tiles_stringify, race.reinforcement]);

  useEffect(()=>{
    dispatch({type: 'move_steps'})
  }, [advUnitSwitch, activeTileSwitch, dispatch]);

  useEffect(()=>{
    //if(race.exhaustedCards.length){
      dispatch({
        type: 'flush_exhausted_cards'
      });
      MY_LAST_EFFECT.current = '';
    //}
    if(race.exhaustedCards.length){
      flushTempCt();
    }
  //eslint-disable-next-line
  },[ctx.phase, race.exhaustedCards]);

  useEffect(()=>{
    if(mustSecObj){
      dispatch({type: 'left_panel', payload: 'objectives'});
    }
    
  }, [dispatch, mustSecObj]);

  const PREV_TECHNODATA = useRef([]); //todo: replace with bgio-effects
  useEffect(() => {

    if(race.tempTechnoData && race.tempTechnoData.length && race.tempTechnoData.length > PREV_TECHNODATA.current.length){
      const last = race.tempTechnoData.slice(PREV_TECHNODATA.current.length - race.tempTechnoData.length);
      const summary = {INFANTRY2: []};
      last.forEach(l => {
        if(Object.keys(summary).includes(l.id)){
          if(l.id === 'INFANTRY2'){
            if(l.success){
              summary[l.id].push('/dice-green ' + (l.dice === 10 ? 0:l.dice));
            }
            else{
              summary[l.id].push('/dice ' + (l.dice === 10 ? 0:l.dice));
            }
          }
        }
      });
      
      Object.keys(summary).forEach(k => {
        if(k === 'INFANTRY2' && summary['INFANTRY2'].length > 0){
          sendChatMessage(t('cards.techno.INFANTRY2.label') + '   ' + summary['INFANTRY2'].join('  '));
        }
      });

    }
    PREV_TECHNODATA.current = race.tempTechnoData;
  // eslint-disable-next-line
  }, [race.tempTechnoData])

  const PREV_EXPLORATION = useRef([]);//todo: replace with bgio-effects

  useEffect(()=>{
    if(race.exploration && race.exploration.length && race.exploration.length > PREV_EXPLORATION.current.length){
      PREV_EXPLORATION.current = race.exploration;
      sendChatMessage(t('board.got_new_exploration') + ' ' 
      + t('cards.exploration.' + race.exploration[race.exploration.length-1].id + '.label').toUpperCase() + ' ('
      + t('cards.exploration.' + race.exploration[race.exploration.length-1].id + '.effect') + ')');
    }
    // eslint-disable-next-line
  }, [race.exploration]);

  const PREV_RELICS = useRef([]);//todo: replace with bgio-effects

  useEffect(()=>{
    if(race.relics && race.relics.length && race.relics.length > PREV_RELICS.current.length){
      PREV_RELICS.current = race.relics;
      sendChatMessage(t('board.got_new_relic') + ': ' 
      + t('cards.relics.' + race.relics[race.relics.length-1].id + '.label').toUpperCase() + ' ('
      + t('cards.relics.' + race.relics[race.relics.length-1].id + '.effect'));
    }
    // eslint-disable-next-line
  }, [race.relics]);
  
  const PREV_PLANETS = useRef([]);//todo: replace with bgio-effects

  useEffect(()=>{  //occupied new planet
    if(PLANETS && PLANETS.length){
      if(!PREV_PLANETS.current || !PREV_PLANETS.current.length){
        //PREV_PLANETS.current = PLANETS;
      }
      else{
        if(PLANETS.length - PREV_PLANETS.current.length === 1){
          const newOne = PLANETS.find(p => {
            const oldOne = PREV_PLANETS.current.find(pp => pp.name === p.name);
            return !oldOne;
          });
          if(newOne){
            dispatch({type: 'just_occupied', payload: newOne.name});
            sendChatMessage(t('board.has_occupied_planet') + ' ' + t('planets.' + newOne.name));
            if(newOne.exploration === 'Freelancers'){
              dispatch({type: 'producing', planet: newOne.name});
            }
          }
        }
      }
      PREV_PLANETS.current = PLANETS;
    }
  //eslint-disable-next-line
  }, [PLANETS_stringify]);

  useEffect(() => { //switch TechAction
    if(!hud.producing && hud.justOccupied){
      if(hud.exhaustedCards.includes('INTEGRATED_ECONOMY')){
        exhaustTechCard('INTEGRATED_ECONOMY');
      }
    }
  }, [hud.producing, hud.exhaustedCards, exhaustTechCard, hud.justOccupied])
  
  useEffect(() => {
    if(ctx.activePlayers && Object.keys(ctx.activePlayers).filter(ap => !ap.endsWith('ctionCard')).length){
      if(!prevStages.current){
        prevStages.current = {...ctx.activePlayers};
        Object.keys(prevStages.current).forEach(k => {
          if(!k.endsWith('ctionCard')){
            prevStages.current[k] = [prevStages.current[k]];
          }
          else{
            prevStages.current[k] = undefined;
          }
        });
      }
      else{
        Object.keys(ctx.activePlayers).filter(ap => !ap.endsWith('ctionCard')).forEach(ap => {
          if(!prevStages.current[ap] || !prevStages.current[ap].length){
            prevStages.current[ap]=[ctx.activePlayers[ap]];
          }
          else if(prevStages.current[ap][prevStages.current[ap].length-1] !== ctx.activePlayers[ap]){
            prevStages.current[ap].push(ctx.activePlayers[ap]);
          }
        });
      }
    }

    else{
      prevStages.current = null;
    }

  }, [ctx.activePlayers, prevStages]);

  useEffect(() => {
    if(ctx.activePlayers && ctx.activePlayers[playerID] === 'trade' && !isMyTurn){
      dispatch({type: 'left_panel', payload: 'trade'});
    }
  //eslint-disable-next-line
  }, [ctx.activePlayers, isMyTurn])

  useEffect(() => {
    if(ctx.phase === 'stats'){
      dispatch({type: 'left_panel', payload: 'objectives'});
    }
    else if(ctx.phase === 'strat' || ctx.phase === 'agenda'){
      dispatch({type: 'left_panel', payload: ''});
    }
  }, [dispatch, ctx.phase])

  useEffect(() => {
    if(race.commanderIsUnlocked){
      sendChatMessage(t('board.commander_is_unlocked'));
    }
  //eslint-disable-next-line
  }, [race.commanderIsUnlocked])

  useEffect(() => {
    if(race.heroIsUnlocked){
      sendChatMessage(t('board.hero_is_unlocked'));
    }
  //eslint-disable-next-line
  }, [race.heroIsUnlocked])

  useEffect(() => {
    if(race.heroIsExhausted){
      sendChatMessage(t('board.hero_is_exhausted'));
    }
  //eslint-disable-next-line
  }, [race.heroIsExhausted])

  useEffect(() => {
    dispatch({type: 'global_payment', payload: {tg: -hud.globalPayment.tg}});
  //eslint-disable-next-line
  }, [race.tg])

  useEffect(() => {
    if(!isMyTurn){
      dispatch({type: 'global_payment', payload: {wipe: true}})
    }
  }, [isMyTurn, dispatch])

  const MY_LAST_EFFECT = useRef('');

  useEffectListener('*', (effectName, effectProps, boardProps) => { //! may doubled!!

    try{
      if(effectName === 'rift'){
        if(String(playerID) === String(ctx.currentPlayer)){
          const {unit, dices} = effectProps;
          let rolls = '';
          dices.forEach(d => {
            if(d > 3){
              rolls += ' /dice-green ' + d;
            }
            else{
              rolls += ' /dice ' + d;
            }
          });
          sendChatMessage(t('board.gravity_rift').toUpperCase() + ' ' + t('cards.techno.' + unit.toUpperCase() + '.label').toLowerCase() + ' ' + rolls);
        }
      }
      else if(effectName === 'tg'){
        if(boardProps.G && boardProps.G.races){
          boardProps.G.races.forEach((nr, pid) => {

            if(String(pid) === String(playerID)){//mine
              if(G.races[pid].tg < nr.tg){
                sendChatMessage('/gain-tg ' + (nr.tg - G.races[pid].tg))
              }
            }
            else{
              if(race.rid === 2 && neighbors && neighbors.length > 0 && neighbors.includes(String(pid))){ //mentak pillage
                if(G.races[pid].tg < nr.tg){
                  dispatch({ type: 'ability', tag: 'pillage', add: true, playerID: pid })
                }
              }
            }

          })
        }

      }
      else if(effectName === 'trade'){
        const {src, dst, obj} = effectProps;
        let pid = G.races.findIndex((r) => r.rid === src);

        if(String(pid) === String(playerID)){
          let subj = '';
          Object.keys(obj).forEach(tradeItem => {
            const count = obj[tradeItem];
            subj += tradeItem === 'commodity' ? (count + ' ' + t('board.commodity')) : tradeItem === 'tg' ? (count + ' ' + t('board.trade_good')) : 
            tradeItem === 'fragment.c' ? (count + ' ' + t('board.cultural') + ' ' + t('board.fragment')) :
            tradeItem === 'fragment.h' ? (count + ' ' + t('board.hazardous') + ' ' + t('board.fragment')) :
            tradeItem === 'fragment.i' ? (count + ' ' + t('board.industrial') + ' ' + t('board.fragment')) :
            tradeItem === 'fragment.u' ? (count + ' ' + t('board.unknown') + ' ' + t('board.fragment')) :
            
            tradeItem.indexOf('action') === 0 ? t('cards.actions.' + tradeItem.substr(tradeItem.indexOf('.') + 1) + '.label'):
            tradeItem.indexOf('promissory') === 0 ? t('cards.promissory.' + tradeItem.substr(tradeItem.indexOf('.') + 1) + '.label'):
            tradeItem.substr(tradeItem.indexOf('.') + 1) 
          })
          sendChatMessage('/trade ' + t('races.' + dst + '.name') + ': ' + subj)
        }

        if(race.rid === 2){ //mentak
          if(pid > -1 && src !== 2 && (!hud.abilityData.pillage || !hud.abilityData.pillage.includes(src))){
            if(neighbors && neighbors.length > 0 && neighbors.includes(String(pid))){
              dispatch({type: 'ability', tag: 'pillage', add: true, playerID: pid})
            }
          }
    
          pid = G.races.findIndex((r) => r.rid === dst);
          if(pid > -1 && dst !== 2 && (!hud.abilityData.pillage || !hud.abilityData.pillage.includes(dst))){
            if(neighbors && neighbors.length > 0 && neighbors.includes(String(pid))){
              dispatch({type: 'ability', tag: 'pillage', add: true, playerID: pid})
            }
          }
        }
      }
      else if(effectName === 'relic_ex'){
        const {id, pid} = effectProps;
    
        if((pid !== undefined && String(playerID) === String(pid)) || (pid === undefined && String(playerID) === String(ctx.currentPlayer))){
          if(MY_LAST_EFFECT.current !== id){
            sendChatMessage(t('cards.relics.' + id + '.label'));
            MY_LAST_EFFECT.current = id;
          }
        }
      }
      else if(effectName === 'promissory'){
        const {src, dst, id} = effectProps;

        if(String(src) === String(playerID)){
          if(MY_LAST_EFFECT.current !== id){
            sendChatMessage(t('cards.promissory.' + id + '.label') + ' ' + t('races.' + G.races[dst].rid + '.name') + ' ' + t('board.complete'));
            MY_LAST_EFFECT.current = id;
          }
        }
      }

    }
    catch(e){console.log(e)}
    
  }, [G_stringify, playerID, neighbors]);
  

  //eslint-disable-next-line
  const initialImgs = useMemo(() => [...imgSrc.boardImages, ...getTilesAndRacesImgs(G.tiles)], []);
  const { imagesPreloaded, lastLoaded, loadingError } = useImagePreloader(initialImgs);

  return (<>
            {!imagesPreloaded && <div style={{width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, backgroundColor: 'black', zIndex: 101, display: 'flex', justifyContent: 'center', alignItems: 'center', flexFlow: 'column'}}>
              
              <Blocks
                  height="80"
                  width="80"
                  color="#4fa94d"
                  ariaLabel="..."
                  wrapperStyle={{}}
                  wrapperClass="blocks-wrapper"
                  visible={true}
                  />
              {!loadingError && <span style={{fontFamily: 'system-ui', color: 'antiquewhite'}}>{lastLoaded}</span>}
              {loadingError && <span style={{fontFamily: 'system-ui', color: 'red'}}>{'ошибка загрузки ' + loadingError}</span>}
            </div>}
            {imagesPreloaded && <StateContext.Provider value={stateContext}>
              <Overlay/>      
              <MyNavbar leftPanel={hud.leftPanel} setLeftPanel={(payload) => dispatch({type: 'left_panel', payload})} undo={undo} isMyTurn={isMyTurn} activeTile={activeTile} noaction={MY_FLEET_EXCEED}/>
              <CardColumns style={{margin: '4rem 1rem 1rem 1rem', padding:'1rem', position: 'fixed', width: '42rem', zIndex: '1'}}>
                {!race.isSpectator && <>
                  {hud.leftPanel === 'techno' && <TechnologyDialog selected={hud.selectedTech && hud.selectedTech.techno ? [hud.selectedTech.techno.id]:[]} onSelect={({techno, rid}) => dispatch({type: 'selected_tech', payload: {techno, rid}})}/>}
                  {hud.leftPanel === 'objectives' && <Card id='objListMain' className='subPanel' style={{ padding: '4rem 1rem 1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                      <CardTitle><h6 style={{textAlign: 'right', margin: 0}}>{t('board.victory_points').toUpperCase() + ': ' + VP + '/' + G.vp}</h6></CardTitle>
                      <ObjectivesList playerID={playerID} mustSecObj={mustSecObj} onSelect={ctx.phase === 'stats' && isMyTurn ? completeObjective: mustSecObj ? dropSecretObjective: ()=>{}}/>
                    </Card>}
                  
                  {hud.leftPanel === 'planets' && <Card className='subPanel' style={{ padding: '3rem 1rem 2rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                    <CardTitle></CardTitle>
                      <div style={{maxHeight: '30rem', overflowY: 'auto', paddingRight: '1rem'}}>
                        <Cont style={{border: 'none'}}>
                          {<PlanetsRows PLANETS={PLANETS} exhausted={globalPaymentExhaustedPlanets}
                                                          specClick={(e, p) => p && p.specialty && globalPayPlanet(e, p, p.specialty)}
                                                          resClick={(e, p) => globalPayPlanet(e, p, 'resources')} 
                                                          infClick={(e, p) => globalPayPlanet(e, p, 'influence')}
                                                          onClick={(pname) => globalPayCancelPlanet(pname)}/>}
                        </Cont>
                      </div>
                  </Card>}
                  {hud.leftPanel === 'units' && <Card className='subPanel' style={{ padding: '3rem 1rem 2rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                    <CardTitle></CardTitle>
                    <UnitsList UNITS={UNITS} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} rid={G.races[playerID].rid}/>
                  </Card>}
                </>}
                {!race.isSpectator && hud.leftPanel === 'trade' && <TradePanel onTrade={({item, pid, count}) => moves.tradeOffer(pid, item, count)}/>}

                
              </CardColumns>

              <ChatBoard sendChatMessage={sendChatMessage} chatMessages={chatMessages}/>

              {!race.isSpectator && hud.producing && <ProducingPanel 
                  onCancel={(finish)=>{dispatch({type: 'producing', planet: null}); if(finish && hud.justOccupied && hud.exhaustedCards.includes('INTEGRATED_ECONOMY')){dispatch({type: 'just_occupied', payload: null});}}} 
                  pname={hud.producing} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} payment={hud.globalPayment} GP={GP}/>}
              {!race.isSpectator && race.makeCustomProducing && <ProducingPanel onCancel={(finish) => {if(!finish){moves.producing()}}} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} payment={hud.globalPayment} GP={GP}/>}
              {!race.isSpectator && ctx.phase === 'strat' && <StrategyPick actionCardStage={actionCardStage}/>}
              

              {race.explorationDialog && <ChoiceDialog args={race.explorationDialog} onSelect={(i)=>moves.choiceDialog(i)}/>}
              
              {!race.isSpectator && ctx.phase === 'agenda' && <AgendaDialog onConfirm={moves.vote} mini={actionCardStage} payment={hud.globalPayment} GP={GP}/>}
              {race.secretObjectiveConfirm && (ctx.phase !== 'agenda' || isMyTurn) && <ChoiceDialog args={race.secretObjectiveConfirm} onSelect={(i)=>moves.secretObjectiveConfirm(race.secretObjectiveConfirm.oid, i)}/>}
              
              {strategyStage && <StrategyDialog R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} payment={hud.globalPayment} GP={GP}
                    onComplete={moves.joinStrategy} onDecline={moves.passStrategy} selectedTile={hud.selectedTile}  selectedPlanet={hud.selectedPlanet}/>}
              {actionCardStage && <ActionCardDialog selectedTile={hud.selectedTile} selectedPlanet={hud.selectedPlanet} selectedUnit={hud.advUnitView} GP={GP} payment={hud.globalPayment}/>}
              
              {!race.secretObjectiveConfirm && <>
                {spaceCannonAttack && <SpaceCannonAttack />}
                {antiFighterBarrage && <AntiFighterBarrage selectedTile={hud.selectedTile}/>}
                {spaceCombat && !race.makeCustomProducing && <SpaceCombat prevStages={prevStages} selectedTile={hud.selectedTile}/>}
                {combatRetreat && <CombatRetreat selectedTile={hud.selectedTile}/>}
                {bombardment && <Bombardment />}
                {invasion && <Invasion />}
                {race.mustChooseAndDestroy && <ChooseAndDestroy />}
              </>}

              {mustAction && 
              <Card style={{...CARD_STYLE, backgroundColor: 'rgba(255, 255, 255, .75)', width: '30%', position: 'absolute', margin: '20rem 30rem'}}>
                <CardTitle style={{borderBottom: '1px solid rgba(0, 0, 0, 0.42)', color: 'black'}}><h3>{t('board.tooltips.drop_ac_header')}</h3></CardTitle>
                <CardBody style={{display: 'flex', color: 'black'}}>
                  {t('board.tooltips.drop_ac_body')}
                </CardBody>
              </Card>}

              <PixiStage stagew={window.innerWidth} stageh={window.innerHeight} dispatch={dispatch} hud={hud} GP={GP}/>
              
              {!race.isSpectator && <div style={{ display:'flex', flexDirection: 'row', justifyContent: 'flex-end', position:'fixed', 
                                                  alignItems: 'flex-end', right: 0, bottom: 0, width: '30%' }}>
                <CardColumns style={{minWidth: '13rem', width:'13rem', height: 'fit-content', position: 'absolute', left: '-14rem', display:'flex', 
                flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'flex-start'}}>

                  <div style={{display: 'flex', flexDirection: 'column', position: 'fixed', bottom: '4rem', width: '13rem'}}>
                    {hud.rightBottomVisible === 'context' && <>
                      <CardsPager>
                        {haveTechnology(race, 'GRAVITY_DRIVE') && <TechAction techId='GRAVITY_DRIVE'/>}
                        {haveTechnology(race, 'SLING_RELAY') && <TechAction techId='SLING_RELAY'/>}
                        {haveTechnology(race, 'BIO_STIMS') && <TechAction techId='BIO_STIMS'/>}
                        {haveTechnology(race, 'AI_DEVELOPMENT_ALGORITHM') && <TechAction techId='AI_DEVELOPMENT_ALGORITHM'/>}
                        {haveTechnology(race, 'SELF_ASSEMBLY_ROUTINES') && <TechAction techId='SELF_ASSEMBLY_ROUTINES'/>}
                        {haveTechnology(race, 'SCANLINK_DRONE_NETWORK') && <TechAction techId='SCANLINK_DRONE_NETWORK'/>}
                        {haveTechnology(race, 'PREDICTIVE_INTELLIGENCE') && <TechAction techId='PREDICTIVE_INTELLIGENCE'/>}
                        {haveTechnology(race, 'TRANSIT_DIODES') && <TechAction techId='TRANSIT_DIODES'/>}
                        {haveTechnology(race, 'INTEGRATED_ECONOMY') && <TechAction techId='INTEGRATED_ECONOMY'/>}
                        {haveTechnology(race, 'INFANTRY2') && <TechAction techId='INFANTRY2'/>}
                        {haveAbility(race, 'ORBITAL_DROP') && <AbilAction abilId='ORBITAL_DROP'/>}
                        {haveAbility(race, 'PILLAGE') && <AbilAction abilId='PILLAGE'/>}
                        {race.rid === 1 && <MechDeploy />}
                      </CardsPager>
                      
                    </>}
                    {((hud.rightBottomVisible === 'promissory' && race.promissory.length > 0) || reparations === 'promissory') && <CardsPager>
                      {race.promissory.map((pr, i) => <CardsPagerItem key={i} tag='promissory'>
                        <button style={{width: '100%', marginBottom: '1rem'}} className='styledButton yellow' onClick={() => promissoryClick(pr)}>
                          {reparations === 'promissory' && <b style={{backgroundColor: 'red', color: 'white', padding: '.25rem', left: '0', top: '0', position: 'absolute'}}>{t('board.drop')}</b>}
                          {pr.sold ? <img alt='to other player' style={{width: '2rem', position: 'absolute', left: '1rem', bottom: '1rem'}} src={'race/icons/' + pr.sold + '.png'} />:''}
                          <b style={{textDecoration: pr.sold ? 'line-through':''}}>{t('cards.promissory.' + pr.id + '.label').toUpperCase()}</b>
                          {pr.racial && !pr.owner ? <img alt='racial' style={{width: '2rem', position: 'absolute', bottom: '1rem'}} src={'race/icons/' + race.rid + '.png'} />:''}
                          {pr.owner ? <img alt='from other player' style={{width: '2rem', position: 'absolute', left: '1rem', bottom: '1rem'}} src={'race/icons/' + pr.owner + '.png'} />:''}
                        </button>
              
                          <p>{t('cards.promissory.' + pr.id + '.effect').replaceAll('[color of card]', t('board.colors.' + pr.color))}</p>

                      </CardsPagerItem>)}
                    </CardsPager>}

                    {((hud.rightBottomVisible === 'actions' && race.actionCards.length > 0) || race.actionCards.length > 7) && <CardsPager>
                      {race.actionCards.map((pr, i) => {
                        let disabled = !mustAction && !(pr.when === 'ACTION' && ctx.phase === 'acts' && ctx.currentPlayer === playerID) && 
                                                        !(pr.when === 'AGENDA' && ctx.phase === 'agenda') &&
                                                        !(pr.when === 'TACTICAL' && ctx.phase === 'acts' && (pr.who === 'self' || 
                                                            (ctx.activePlayers && ctx.activePlayers[playerID] === 'tacticalActionCard' && !G.currentTacticalActionCard)));
                        if(!disabled && pr.when === 'AGENDA'){
                          if(pr.after === true){
                            if(!(ctx.activePlayers && ctx.activePlayers[playerID] === 'afterVoteActionCard')) disabled = true;
                          }
                          else{
                            if(ctx.activePlayers) disabled = true;
                          }
                        }
                        if(disabled && pr.when === 'COMBAT'){
                          if(ctx.phase === 'acts' && ctx.activePlayers && ['bombardment', 'invasion', 'invasion_step2', 
                          'invasion_await', 'spaceCombat', 'spaceCombat_step2', 'antiFighterBarrage', 'spaceCannonAttack'].indexOf(ctx.activePlayers[playerID]) > -1){
                            disabled = false;
                          }
                        }
                        if(disabled && pr.when === 'STATUS'){
                          if(ctx.phase === 'stats') disabled = false;
                        }
                        if(disabled && pr.when === 'STRATEGY'){
                          if(ctx.phase === 'strat') disabled = false;
                        }

                        return <CardsPagerItem key={i} tag='action'>
                          <button disabled={disabled} style={{width: '100%', marginBottom: '1rem'}} onClick={()=> { if(mustAction){moves.dropActionCard(pr.id)} else if(!disabled){ moves.playActionCard(pr);}}} className={'styledButton ' + (mustAction ? 'red':'yellow')} >
                            {mustAction && race.actionCards.length > 7 && 
                              <b style={{backgroundColor: 'red', color: 'white', padding: '.25rem', left: '0', top: '0', position: 'absolute'}}>{t('board.drop')}</b>}
                            <b style={{lineHeight: '1rem', display: 'inline-block', padding: '.5rem 0'}}>{t('cards.actions.' + pr.id + '.label').toUpperCase()}</b>
                          </button>

                          <b>{t('board.when_' + pr.when)}</b>
                          {' ' + t('cards.actions.' + pr.id + '.description')}
                        </CardsPagerItem>}
                      )}
                    </CardsPager>}

                    {hud.rightBottomVisible === 'relics' && race.relics.length > 0 && <CardsPager>
                      {race.relics.map((pr, i) => <CardsPagerItem key={i} tag='relic'>
                        <button style={{width: '100%', marginBottom: '1rem'}} disabled={isRelicDisabled(pr)} className = {'styledButton ' + (hud.exhaustedCards.includes(pr.id) || hud.exhaustedCards.includes(pr.id+'_1') ? 'white':'yellow')} onClick={() => relicClick(pr.id)}>
                          <b style={{lineHeight: '1rem', display: 'inline-block', padding: '.5rem 0'}}>{t('cards.relics.' + pr.id + '.label').toUpperCase()}</b>
                        </button>

                        {t('cards.relics.' + pr.id + '.effect')}
                        {pr.id === 'Maw of Worlds' && <p style={{marginTop: '1rem', color: 'blueviolet'}}>
                          {hud.selectedTech && hud.selectedTech.techno && <b>{hud.selectedTech.techno.racial ? t('races.' + race.rid + '.' + hud.selectedTech.techno.id + '.label') : t('cards.techno.' + hud.selectedTech.techno.id + '.label')}</b>}
                          {!(hud.selectedTech && hud.selectedTech.techno) && <b>{t('board.choose_technology')}</b>}
                        </p>}
                        {pr.id === "The Prophet's Tears" && <p style={{marginTop: '1rem', color: 'blueviolet'}}>
                          <Input type='radio' disabled={isRelicDisabled(pr)} onChange={() => relicClick(pr.id)} name='prophet_tears' id='prophet_tears_0' checked={hud.exhaustedCards.includes(pr.id)}/><Label for='prophet_tears_0' check style={{marginLeft: '.5rem'}}>{t('board.ignore_requirement')}</Label>
                          <br/>
                          <Input type='radio' disabled={isRelicDisabled(pr)} onChange={() => relicClick(pr.id+'_1')} name='prophet_tears' id='prophet_tears_1' checked={hud.exhaustedCards.includes(pr.id+ '_1')}/><Label for='prophet_tears_1' check style={{marginLeft: '.5rem'}}>{t('board.take_card')}</Label>
                        </p>}
                      </CardsPagerItem>)}
                    </CardsPager>}

                    {hud.rightBottomVisible === 'agenda' && G.laws.length > 0 && <CardsPager>
                      {G.laws.map((pr, i) => <CardsPagerItem key={i} tag='agenda'>
                        <button style={{width: '100%', marginBottom: '1rem'}} className='styledButton yellow'>
                          <b style={{lineHeight: '1rem', display: 'inline-block', padding: '.5rem 0'}}>{t('cards.agenda.' + pr.id + '.label').toUpperCase()}</b>
                        </button>

                        {t('cards.agenda.' + pr.id + '.for')}
                      </CardsPagerItem>)}
                    </CardsPager>}

                    {hud.rightBottomVisible === 'discardedActions' && <SelectDiscardedActions maxCount={3} onEnd={() => dispatch({type: 'exhaust_card', cardId: 'The Codex'})}/>}
                  </div>
                  <ButtonGroup className='comboPanel-left-vertical' style={{alignSelf: 'flex-end', fontFamily:'Handel Gothic', position: 'fixed', bottom: '2rem', padding: '.5rem', right: '35%'}}>
                      <button className={'styledButton ' + (hud.rightBottomVisible === 'promissory' ? 'white':'black')} onClick={()=>rightBottomSwitch('promissory')} 
                        style={{width: '7rem', padding: 0}}>{t("board.nav.promissory")}</button>
                      <button className={'styledButton ' + (hud.rightBottomVisible === 'relics' ? 'white':'black')} onClick={()=>rightBottomSwitch('relics')} 
                        style={{width: '7rem', padding: 0}}>{t("board.nav.relics")}</button> 
                      <button className={'styledButton ' + (hud.rightBottomVisible === 'agenda' ? 'white':'black')} onClick={()=>rightBottomSwitch('agenda')} 
                        style={{width: '7rem', padding: 0}}>{t("board.nav.agenda")}</button>
                      <button className={'styledButton ' + (hud.rightBottomVisible === 'actions' ? 'white':'black')} onClick={()=>rightBottomSwitch('actions')} 
                        style={{width: '7rem', padding: 0}}>{t("board.nav.actions")}</button>
                      <button className={'styledButton ' + (hud.rightBottomVisible === 'context' ? 'white':'black')} onClick={()=>rightBottomSwitch('context')} 
                        style={{width: '7rem', padding: 0}}>{t("board.nav.context")}</button>
                  </ButtonGroup>
                </CardColumns>

                <CardColumns style={{paddingRight: '2rem', display: 'flex', height: 'max-content', 
                            width: '100%', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end', position: 'relative' }}>
                    
                    <div style={{display: 'flex', position: 'absolute', top: '-5rem', right: '3rem'}}>
                      <GlobalPayment globalPayment={hud.globalPayment} GP={GP} dispatch={dispatch}/>
                      {race && race.strategy.length > 0 && ctx.phase !== 'strat' && <div className='comboPanel-left-vertical' style={{display: 'flex', padding: '.5rem'}}>
                        {race.strategy.map((s, i) => <StrategyCard key={i} card={s} idx={i}/>)}
                      </div>}
                    </div>
                    <div className='borderedPanel-vertical' style={{display: 'flex', height: 'max-content', backgroundColor: 'rgba(33, 37, 41, 0.95)',
                            width: '100%', flexDirection: 'column', justifyContent: 'flex-end', margin: '0 0 2rem 0', zIndex: 1}}>
                      {race && hud.subcardVisible === 'stuff' && <Stuff groundUnitSelected={hud.groundUnitSelected} advUnitView={hud.advUnitView} payloadCursor={hud.payloadCursor} R_UNITS={R_UNITS} tempCt={hud.tempCt} dispatch={dispatch}/>}
                      {race && hud.subcardVisible === 'persons' && <Persons />}
                      {race && hud.subcardVisible === 'abilities' && <><Card style={{...CARD_STYLE, minHeight: '16.5rem', marginBottom: 0, backgroundColor: race.color[1], display: 'flex'}}>
                          {race.abilities.map((a, i) => 
                            <CardText key={i} style={{fontSize: '90%'}}>
                              <b>{t('races.' + race.rid + '.' + a.id + '.label')}</b><br/>
                              {a.type === 'action' ? <b>{t('board.action').toUpperCase()}</b>:''}{' ' + t('races.' + race.rid + '.' + a.id + '.effect')}
                            </CardText>
                          )}
                        </Card>
                      </>}

                      {race && <ButtonGroup style={{marginTop: '1rem'}}>
                        <button className={'bi bi-stack styledButton ' + (hud.subcardVisible === 'stuff' ? 'white':'black')} onClick={()=>dispatch({type: 'subcard_visible', payload: 'stuff'})} style={{flexBasis: '33%'}}></button>
                        <button className={'bi bi-people-fill styledButton ' + (hud.subcardVisible === 'persons' ? 'white':'black')} onClick={()=>dispatch({type: 'subcard_visible', payload: 'persons'})} style={{flexBasis: '33%'}}></button>
                        <button className={'bi bi-lightning-fill styledButton ' + (hud.subcardVisible === 'abilities' ? 'white':'black')} onClick={()=>dispatch({type: 'subcard_visible', payload: 'abilities'})} style={{flexBasis: '33%'}}></button>
                      </ButtonGroup>}

                      {race && <Card style={{...CARD_STYLE, backgroundColor: race.color[1], margin: 0}}>
                        <div style={{display: 'flex'}}>
                          <div style={{display: 'flex', flexFlow: 'column'}}>
                            <button className='styledButton black tgButton'><h6 style={{fontSize: 50}}>{(race.commodity || 0) + '/' + race.commCap}</h6><b>{t('board.commodity')}</b></button>
                            <button className='styledButton black tgButton' onClick={() => globalPayTg(1)}><h6>{race.tg - GP.tg}</h6><b>{t('board.trade_goods')}</b></button>
                          </div>
                          <CardImg src={'race/'+race.rid+'.png'} style={{width: '14rem', height: 'auto', marginLeft: '4rem'}}/>
                          
                        </div>
                        
                      </Card>}
                    </div>
                    
                </CardColumns>
              </div>}

              {hud.payObj !== null && <PaymentDialog oid={hud.payObj} G={G} race={race} planets={PLANETS} GP={GP}
                              isOpen={hud.payObj !== null} toggle={(payment)=>togglePaymentDialog(payment)}/>}
          
              {ctx.phase === 'acts' && hud.leftPanel === 'objectives' && mustSecObj && 
                <Tooltip isOpen={document.getElementById('objListMain')} target='objListMain' placement='right' className='todoTooltip'>
                  <b>{t('board.tooltips.drop_secret_obj_header')}</b>
                  <p>{t('board.tooltips.drop_secret_obj_body')}</p>
                </Tooltip>}

                {ctx.gameover && <Gameover isOpen={true}/>}
          </StateContext.Provider>}
          
          </>)
}


export const BoardWithEffects = EffectsBoardWrapper(TIOBoard, {
  // Delay passing the updated boardgame.io state to your board
  // until after the last effect has been triggered.
  // Default: false
  updateStateAfterEffects: true,

  // Global control of the speed of effect playback.
  // Default: 1
  //speed: 10000,
});



