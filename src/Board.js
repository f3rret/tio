/* eslint eqeqeq: 0 */
import { useApp, Stage, Text, Container, Sprite } from '@pixi/react';
import { useMemo, useCallback, useState, useEffect, useRef, useContext } from 'react';
import { /*Navbar,*/ Nav, NavItem, Button, ButtonGroup, Card, CardImg, CardText, CardTitle, UncontrolledTooltip,/*UncontrolledAccordion, 
  AccordionItem, AccordionBody, AccordionHeader,*/ CardBody, Tooltip, ListGroup, ListGroupItem, Container as Cont, Row, Col, CardColumns,
  UncontrolledAccordion,
  AccordionItem,
  AccordionHeader,
  AccordionBody} from 'reactstrap';
import { PaymentDialog, StrategyDialog, AgendaDialog, getStratColor, PlanetsRows, UnitsList, /*getTechType,*/ 
ObjectivesList, TradePanel, ProducingPanel, ChoiceDialog, CardsPager, CardsPagerItem, Overlay, StrategyPick } from './dialogs';
import { ActionCardDialog, TechnologyDialog } from './actionCardDialog'; 
import { PixiViewport } from './viewport';
import { checkObjective, StateContext, haveTechnology, UNITS_LIMIT, wormholesAreAdjacent, LocalizationContext } from './utils';
import { lineTo, pathFromCoordinates } from './Grid';
import { ChatBoard } from './chat';
import { SpaceCannonAttack, AntiFighterBarrage, SpaceCombat, CombatRetreat, Bombardment, Invasion, ChooseAndDestroy } from './combat';
import { produce } from 'immer';
import techData from './techData.json';
import tileData from './tileData.json';
import { SelectedHex, ActiveHex, LandingGreen, LandingRed, MoveDialog, MoveStep, SectorUnderAttack, PlanetUnderAttack } from './animated';


export function TIOBoard({ ctx, G, moves, events, undo, playerID, sendChatMessage, chatMessages }) {

  const stagew = window.innerWidth;
  const stageh = window.innerHeight;
  const CARD_STYLE = {background: 'none', border: 'solid 1px rgba(255, 255, 255, 0.2)', padding: '1rem', marginBottom: '1rem'}
  const TOKENS_STYLE = { display: 'flex', width: '30%', alignItems: 'center', textAlign: 'center', flexFlow: 'column', padding: '.15rem', background: 'none', margin: '.5rem', border: '1px solid rgba(255, 255, 255, 0.42)', color: 'white'}

  const race = useMemo(() => {
    if(playerID !== null){
      return G.races[playerID];
    }
    else return {isSpectator: true, color: ['white', 'white'], knownTechs: [], technologies:[], abilities:[], strategy:[], actionCards:[], secretObjectives:[], exhaustedCards: [], reinforcement: {},
      exploration:[], vp: 0, tg: 0, tokens: { t: 0, f: 0, s: 0, new: 0}, fragments: {u: 0, c: 0, h: 0, i: 0}, relics: []};
  }, [G.races, playerID]);

  const [exhaustedCards, setExhaustedCards] = useState([]);
  const [producing, setProducing] = useState(null);
  const [leftPanel, setLeftPanel] = useState(null);
  /*const [objVisible, setObjVisible] = useState(false);
  const [techVisible, setTechVisible] = useState(false);
  const [tradeVisible, setTradeVisible] = useState(false)
  const [planetsVisible, setPlanetsVisible] = useState(false);*/
  const [advUnitView, setAdvUnitView] = useState(undefined);
  const [groundUnitSelected, setGroundUnitSelected] = useState({});
  const [payloadCursor, setPayloadCursor] = useState({i:0, j:0});
  const [tilesPng, setTilesPng] = useState(true);
  const [tilesTxt, setTilesTxt] = useState(false);
  //const [unitsVisible, setUnitsVisible] = useState(false);
  const [agentVisible, setAgentVisible] = useState('agent');
  const [subcardVisible, setSubcardVisible] = useState('stuff');
  
  //const [stratUnfold, setStratUnfold] = useState(0);
  const [rightBottomVisible, setRightBottomVisible] = useState(null);
  const [rightBottomSubVisible, setRightBottomSubVisible] = useState(null);
  const [selectedTile, setSelectedTile] = useState(-1);
  const [selectedPlanet, setSelectedPlanet] = useState(-1);
  const [midPanelInfo, setMidPanelInfo] = useState('tokens');
  const [purgingFragments, setPurgingFragments] = useState({c: 0, h: 0, i: 0, u: 0});
  const [moveSteps, setMoveSteps] = useState([]);
  const isMyTurn = useMemo(() => ctx.currentPlayer == playerID, [ctx.currentPlayer, playerID]);
  const prevStages = useRef(null);
  const [tempCt, setTempCt] = useState({t: 0, s: 0, f: 0, new: 0});
  const [justOccupied, setJustOccupied] = useState(null);
  const { t } = useContext(LocalizationContext);

  const [payObj, setPayObj] = useState(null);
  const togglePaymentDialog = (payment) => {
    if(payment && Object.keys(payment).length > 0){
      moves.completeObjective(payObj, payment);
    }
    setPayObj(null);
  };

  const PLANETS = useMemo(()=> {
    const arr = [];
    G.tiles.forEach( t => {
      if(t.tdata.planets && t.tdata.planets.length){
        t.tdata.planets.forEach(p => {
          if(p.occupied == playerID){
            arr.push({...p, tid: t.tid});
          }
        })
      }
    });
    return arr;
  }, [G.tiles, playerID]);

  const UNITS = useMemo(()=> {
    const units = [];

    G.tiles.forEach( t => {
      if(t.tdata.occupied == playerID){
        if(t.tdata.fleet){ //todo: or invasion fleet
          Object.keys(t.tdata.fleet).forEach( k => { 
            if(!units[k]) units[k] = 0;
            units[k] += t.tdata.fleet[k].length;
            
            t.tdata.fleet[k].forEach(ship => {
              if(ship.payload && ship.payload.length){
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
  }, [G.tiles, playerID]);

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
    let result = 0;

    if(race){
      race.secretObjectives.concat(G.pubObjectives).forEach(o => {
        if(o && o.players && o.players.length > 0){
          if(o.players.indexOf(playerID) > -1) result += (o.vp ? o.vp : 1);
        }
      });

      result += race.vp;
    }

    return result;
  }, [race, G.pubObjectives, playerID]);

  const leftPanelClick = useCallback((label) => {
    if(leftPanel === label){
      setLeftPanel(null);
    }
    else{
      if(label !== 'trade' || (G.races.length > 1)){
        setLeftPanel(label);
      }
    }
  //eslint-disable-next-line
  }, [leftPanel]);

  const MyNavbar = () =>
    <div style={{ position: 'fixed', height: 0, width: '100%', zIndex: '2', display: 'flex', justifyContent: 'space-between', padding: '0'}}>
      <ButtonGroup className='borderedPanel' style={{minHeight: '3rem', margin: '2.5rem 0 0 2.5rem', fontFamily:'Handel Gothic'}}>
        <button className={'styledButton ' + (leftPanel === 'objectives' ? 'white':'black')} style={{width: '8rem'}} onClick={()=>leftPanelClick('objectives')}>{t("board.nav.objectives")}</button>
        <button className={'styledButton ' + (leftPanel === 'planets' ? 'white':'black')} style={{width: '8rem'}} onClick={()=>leftPanelClick('planets')}>{t("board.nav.planets")}</button>
        <button className={'styledButton ' + (leftPanel === 'units' ? 'white':'black')} style={{width: '8rem'}} onClick={()=>leftPanelClick('units')}>{t("board.nav.units")}</button>
        <button className={'styledButton ' + (leftPanel === 'techno' ? 'white':'black')} style={{width: '8rem'}} onClick={()=>leftPanelClick('techno')}>{t("board.nav.technologies")}</button>
        <button className={'styledButton ' + (leftPanel === 'trade' ? 'white':'black')} style={{width: '8rem'}} onClick={()=>leftPanelClick('trade')}>{t("board.nav.trade")}</button>
      </ButtonGroup>
    
      <div style={{marginTop: '2rem', marginRight: 0, display: 'flex'}}>
        <Nav className='comboPanel-left' style={{height: '5.5rem', marginTop: '-1rem', padding: '1.5rem 3rem 1rem 2rem'}}>
          <UncontrolledAccordion open='0' defaultOpen='0' id='turnLine' style={{width: '30rem', opacity: '.9', marginTop: '.5rem', background: 'transparent'}}>
            <AccordionItem style={{border: 'none', background: 'transparent'}}>
              <AccordionHeader targetId='1' style={{border: 'none', background: 'transparent'}}>
                <span style={{display: 'flex', width: '100%', background: 'transparent'}}>
                  <CardImg style={{width: '2rem', maxHeight: '2rem', marginRight: '1rem'}} src={'race/icons/'+G.races[ctx.currentPlayer].rid+'.png'} />
                  <h5 style={{margin: 0, alignSelf: 'center', flex: 'auto'}}>{t('races.' + G.races[ctx.currentPlayer].rid + '.name')}
                  {G.speaker === G.races[ctx.currentPlayer].rid ? ' (' + t('board.speaker') + ')': ''}
                  </h5>
                </span>
              </AccordionHeader>
              <AccordionBody style={{padding: '1rem', overflow: 'hidden', background: '0% 0% / 100% auto url(/bg1.png)', backgroundColor: 'rgba(33, 37, 41, 1)', marginTop: '1rem', marginRight: '-1rem', border: 'solid 5px #424242'}} accordionId='1'>
                {[...ctx.playOrder.slice(ctx.playOrderPos+1), ...ctx.playOrder.slice(0, ctx.playOrderPos)].map((pid, idx) => 
                  <Row key={idx} style={{background: 'transparent'}}>
                    <Col xs='1' style={{}}>
                      <CardImg style={{width: '2rem', maxHeight: '2rem', margin: '.5rem'}} src={'race/icons/'+G.races[pid].rid+'.png'} />
                    </Col>
                    <Col xs='8' style={{padding: '1rem 1rem 0 2rem', fontFamily: 'Handel Gothic', textDecoration: G.passedPlayers.includes(''+pid) ? 'line-through':''}}>
                      {t('races.' + G.races[pid].rid + '.name')} {G.speaker === G.races[pid].rid ? ' (' + t('board.speaker') + ')': ''}</Col>
                    <Col xs='3' style={{padding: '.5rem 0'}}>
                      {G.races[pid].strategy.map((s, i) => 
                        <p key={i} style={{fontSize: '75%', margin: 0, textDecoration: s.exhausted ? 'line-through':''}}>
                          {t('cards.strategy.' + s.id + '.label') + ' [' + (s.init+1) + ']'}</p>)}
                    </Col>
                  </Row>
                )}
              </AccordionBody>
            </AccordionItem>
          </UncontrolledAccordion>
        </Nav>

        <Nav className='comboPanel-right' style={{height: '3.5rem', zIndex: 1, padding: '.5rem 2.75em 0 .5rem', minWidth: '30rem', display: 'flex', justifyContent: 'flex-end'}}>
          {false && <><NavItem style={{marginRight: '1rem'}}>
            <Button color='light' outline={!tilesPng} onClick={()=>setTilesPng(!tilesPng)}>Tiles</Button>
          </NavItem>
          <NavItem style={{marginRight: '1rem'}}>
            <Button color='light' outline={!tilesTxt} onClick={()=>setTilesTxt(!tilesTxt)}>Text</Button>
          </NavItem></>}

          <NavItem style={{}}>
            {ctx.phase === 'acts' && <>
              <button className='styledButton black' style={{}} disabled={ctx.numMoves == 0 || !isMyTurn} onClick={() => undo()}><h5 style={{margin: '.5rem'}}>{t("board.nav.undo")}</h5></button>
              {!G.spaceCannons && <>
                {!(activeTile && activeTile.tdata.attacker) && <button className='styledButton yellow' style={{}} disabled={!isMyTurn} onClick={()=>moves.endTurn()}><h5 style={{margin: '.5rem'}}>{t("board.nav.end_turn")}</h5></button>}
                {activeTile && activeTile.tdata.attacker && <button className='styledButton yellow' style={{}} disabled={!isMyTurn} onClick={()=>moves.antiFighterBarrage()}><h5 style={{margin: '.5rem'}}>{t("board.nav.space_combat")}</h5></button>}
                </>
              }
              {isMyTurn && G.spaceCannons && <button className='styledButton yellow' style={{}} onClick={()=>moves.spaceCannonAttack()}><h5 style={{margin: '.5rem'}}>{t("board.nav.space_cannon")}</h5></button>}
            </>}
            {ctx.phase !== 'strat' && ctx.phase !== 'agenda' && <button className='styledButton red' style={{}} disabled={!isMyTurn} onClick={()=>moves.pass()}><h5 style={{margin: '.5rem'}}>{t("board.nav.pass")}</h5></button>}
          </NavItem>
        </Nav>
      </div>
    </div>;

  const completeObjective = (oid) => {
    let objective = G.pubObjectives.find(o => o.id === oid);
    if(!objective) objective = G.races[playerID].secretObjectives.find(o => o.id === oid);
    if(!objective) return;

    if(objective.type === 'SPEND'){
      setPayObj(oid);
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

  const mustAction = useMemo(() => {
    if(race && race.actionCards && isMyTurn) return race.actionCards.length > 7
  }, [race, isMyTurn]);

  const mustSecObj = useMemo(() => {
    if(race && race.secretObjectives && isMyTurn) return race.mustDropSecObj || race.secretObjectives.length > 3
  }, [race, isMyTurn]);

  const rightBottomSwitch = useCallback((val) => {
    if(rightBottomVisible === val){
      setRightBottomVisible(null);
    }
    else{
      setRightBottomVisible(val);
    }
  }, [rightBottomVisible]);

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

  const IncrToken = ({tag}) => {
    let clickFn = ()=>{if(race.tokens.new){ moves.adjustToken(tag) }};
    if(exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1){
      clickFn = ()=>{
        if(tempCt.new){ setTempCt(produce(tempCt, draft => {
        draft[tag]++; 
        draft.new--;
      }))}
      };
    }
    return (<button className='styledButton green' onClick={()=>clickFn()} style={{position: 'absolute', top: 0, right: 0, width:'2rem', padding: 0, boxShadow: '-2px 0px 10px gold'}}>
      <h5 style={{margin: '0'}}>+</h5></button>);
  }

  const DecrToken = ({tag}) => {
    let clickFn = ()=>{
      if((tempCt[tag] === 0 && race.tokens[tag]>0) || tempCt[tag] > -race.tokens[tag]){ setTempCt(produce(tempCt, draft => {
      draft[tag]--; 
      draft.new++;
    }))}
    };
    return (<button className='styledButton red' onClick={()=>clickFn()} style={{position: 'absolute', top: '3rem', right: 0, width:'2rem', padding: 0, boxShadow: '-2px 0px 10px gold'}}>
      <h5 style={{margin: '.25rem .5rem'}}>-</h5></button>);
  }

  const tileClick = (e, index, planetIndex) => {
    e.preventDefault(); 
    if(groundUnitSelected && groundUnitSelected.unit){
      setGroundUnitSelected({});
    }
    setSelectedTile(index);
    setSelectedPlanet(planetIndex);
  }


  const advUnitViewTechnology = useMemo(() => {
    if(race && advUnitView && advUnitView.unit){
      return race.technologies.find( t => t.id === advUnitView.unit.toUpperCase());
    }
  },[advUnitView, race]);

  const movePayloadCursor = useCallback(()=>{
    let nexti = payloadCursor.i;
    let nextj = payloadCursor.j;
    const tile = G.tiles[advUnitView.tile];
    const carrier = tile.tdata.fleet[advUnitView.unit];

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

    setPayloadCursor({i: nexti, j: nextj})
  }, [advUnitViewTechnology, G.tiles, advUnitView, payloadCursor]);

  const unloadUnit = useCallback((pid) => {
    const i = payloadCursor.i;
    const j = payloadCursor.j;
    const tile = G.tiles[advUnitView.tile];

    if(advUnitView && String(tile.tdata.occupied) === String(playerID)){
      const unit = G.tiles[advUnitView.tile].tdata.fleet[advUnitView.unit];
      if(unit[i] && unit[i].payload && unit[i].payload[j]){
        moves.unloadUnit({src: {...advUnitView, i, j}, dst: {tile: advUnitView.tile, planet: pid}});
      }

      //movePayloadCursor();
    }

  }, [G.tiles, advUnitView, moves, payloadCursor, playerID]);

  const loadUnit = useCallback((args)=>{
    const event = args.e;
    if(event){
      event.stopPropagation();
      event.preventDefault();
    }

    const tile = G.tiles[args.tile];
    if(String(tile.tdata.occupied) === String(playerID)){

      if(exhaustedCards.indexOf('TRANSIT_DIODES') > -1){
        if(!race.reinforcement.transit ||  race.reinforcement.transit.length < 4){
          moves.moveToTransit(args);
        }
      }
      else if(advUnitView && advUnitViewTechnology && advUnitView.tile !== undefined && advUnitView.tile === args.tile){
        if(['infantry', 'fighter', 'mech'].indexOf(args.unit) > -1){
          if(tile && tile.tdata.fleet){
            const carrier = tile.tdata.fleet[advUnitView.unit];
            if(!(payloadCursor && payloadCursor.i <= carrier.length - 1 && payloadCursor.j <= advUnitViewTechnology.capacity)){
              setPayloadCursor({i:0, j:0});
            }

            moves.loadUnit({src: {...args, e: undefined}, dst: {...advUnitView, ...payloadCursor}});
            movePayloadCursor();
          }
        }
      }
      else if(['infantry', 'fighter', 'mech'].indexOf(args.unit) > -1){
        if(groundUnitSelected.tile === args.tile && groundUnitSelected.unit === args.unit){
          setGroundUnitSelected({});
        }
        else{
          setGroundUnitSelected({tile: args.tile, unit: args.unit, planet: args.planet});
        }
      }

    }

  },[G.tiles, advUnitView, advUnitViewTechnology, moves, payloadCursor, groundUnitSelected, movePayloadCursor, playerID, exhaustedCards, race])

  const activeTile = useMemo(()=> G.tiles.find(t => t.active === true), [G.tiles]);

  /*const draw = useCallback((g) => {
    g.clear();

    G.tiles.forEach((element, index) => {
      if(element.active === true){
        //g.beginFill('yellow', .15);
        g.lineStyle(3,  'yellow');
      }
      else if(index === selectedTile){
        //g.beginFill('lightblue', .25);
        g.lineStyle(3,  'lightblue');
      }

      else{
        //g.lineStyle(3,  0x999999);
        g.lineStyle(0,  'black');
      }

      if(element.active === true || index === selectedTile){
        const [firstCorner, ...otherCorners] = element.corners
        g.moveTo(firstCorner.x + stagew/2, firstCorner.y + stageh/2)
        otherCorners.forEach(({ x, y }) => g.lineTo(x + stagew/2, y + stageh/2))
        g.lineTo(firstCorner.x + stagew/2, firstCorner.y + stageh/2);

        g.endFill();
      }

    });
  }, [G.tiles, stageh, stagew, selectedTile]);*/


  const getMovePath = useMemo(() => {

    if(activeTile && advUnitView && advUnitView.tile !== undefined){
      if(String(activeTile.tid) === String(G.tiles[advUnitView.tile].tid)) return [];
      let line;

      if(moveSteps && moveSteps.length){
        let ar = [advUnitView.tile, ...moveSteps].map(t => ({q: G.tiles[t].q, r: G.tiles[t].r, wormhole: G.tiles[t].tdata.wormhole}));
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
      else if(activeTile.tdata.wormhole && wormholesAreAdjacent(G, activeTile.tdata.wormhole, G.tiles[advUnitView.tile].tdata.wormhole)){
        return [activeTile.tid, G.tiles[advUnitView.tile].tid];
      }
      else{
        line = lineTo(G.HexGrid, [G.tiles[advUnitView.tile].q, G.tiles[advUnitView.tile].r], [activeTile.q, activeTile.r]);
        return line;
      }
    }
    else{
      return [];
    }

  }, [activeTile, advUnitView, moveSteps, G]);

  const getPureMovePath = useMemo(() => {
    return getMovePath.filter(t => tileData.hyperlanes.indexOf(t.tileId) === -1).map(t => t.tileId !== undefined ? String(t.tileId):t);
  }, [getMovePath])
  
  const canMoveThatPath = useMemo(() => {
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
    
    let adj = 0;
    if(exhaustedCards.indexOf('GRAVITY_DRIVE')>-1) adj++;
    if(race.moveBoost) adj += race.moveBoost;

    if(advUnitViewTechnology && (advUnitViewTechnology.move+adj) >= getPureMovePath.length-1){
      if(isBrokenLine(getMovePath)) return false;
      if(getPureMovePath && getPureMovePath.length){
        return !getPureMovePath.some(p => {
          const tile = G.tiles.find(t => String(t.tid) === String(p));

          if(tile.tdata.type === 'red'){
            if(tile.tdata.anomaly === 'asteroid-field' && !haveTechnology(G.races[playerID], 'ANTIMASS_DEFLECTORS')){
              return true;
            }
            else if(tile.tdata.anomaly === 'nebula'){
              return getPureMovePath.length > 2;
            }
            else if(tile.tdata.anomaly === 'supernova'){
              return true;
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
  },[G.tiles, G.races, race, getMovePath, getPureMovePath, advUnitViewTechnology, playerID, activeTile, exhaustedCards]);

  const distanceInfo = useCallback(()=>{
    if(race && advUnitViewTechnology && advUnitViewTechnology.move && getPureMovePath.length){
      let adj = 0;

      if(exhaustedCards.indexOf('GRAVITY_DRIVE')>-1) adj++;
      if(race.moveBoost) adj += race.moveBoost;
      return [t('board.move_path_distance') + ': ' + (getPureMovePath.length-1), 
              t('board.move_power_reserve') + ': ' + advUnitViewTechnology.move, 
              t('board.move_boost') + ': ' + adj];
    }
    else{
      return ['-', '-', '-'];
    }
  //eslint-disable-next-line
  }, [advUnitViewTechnology, getPureMovePath, exhaustedCards, race]);

  const moveToClick = useCallback((idx) => {

    if(advUnitView && idx === advUnitView.tile){
      if(canMoveThatPath){
        let shipIdx = payloadCursor.i;
        if(shipIdx > G.tiles[idx].tdata.fleet[advUnitView.unit].length){
          shipIdx = 0;
        }
        
        moves.moveShip({...advUnitView, shipIdx, exhaustedCards, path: [advUnitView.tile, ...moveSteps]})
        setPayloadCursor({i: 0, j: 0});

        // change advUnitView after move!
        if(G.tiles[idx].tdata.fleet[advUnitView.unit].length <= 1){
          setAdvUnitView({})
        }
      }
    }

  }, [G.tiles, advUnitView, payloadCursor, moves, canMoveThatPath, exhaustedCards, moveSteps])

  const purgeFragment = useCallback((tag) => {
    setPurgingFragments(produce(purgingFragments, draft => {
      if(draft.c + draft.i + draft.h + draft.u >= 3 ){
        draft.c = 0; draft.i = 0; draft.h = 0; draft.u = 0;
      }
      else{
        draft[tag]++;
        if(race.fragments[tag] < draft[tag]){
          draft[tag] = 0;
        }
      }
      
    }));
  }, [purgingFragments, race])
 
  const modifyMoveStep = useCallback((index) => {
    if(G.tiles[index].tid === activeTile.tid) return;

    setMoveSteps(produce(moveSteps, draft =>{
      const idx = moveSteps.indexOf(index);

      if(idx === -1){
        draft.push(index);
      }
      else{
        draft.splice(idx, 1);
      }
      
    }));

  }, [moveSteps, G.tiles, activeTile]);

  const flushTempCt = useCallback(() =>{
    setTempCt({s: 0, t: 0, f: 0, new: 0})
  }, []);

  const exhaustTechCard = useCallback((techId) => {
    if(G.races[playerID].exhaustedCards.indexOf(techId)>-1){
      return false;
    }

    if(techId === 'INTEGRATED_ECONOMY'){
      if(exhaustedCards.indexOf(techId) === -1){
        if(justOccupied && !producing){
          setProducing(justOccupied);
        }
      }
      else{
        setProducing(null);
      }
    }

    setExhaustedCards(produce(exhaustedCards, draft => {
      const idx = draft.indexOf(techId)
      if( idx > -1){
        draft.splice(idx, 1);
      }
      else{
        draft.push(techId);
      }
    }));

    if(techId === 'SLING_RELAY'){
      if(!producing){
        setProducing(G.tiles[selectedTile].tdata.planets.find(p => p.units.spacedock && String(p.occupied) === String(playerID)).name);
      }
      else{
        setProducing(null);
      }
    }
    else if(techId === 'PREDICTIVE_INTELLIGENCE'){
      flushTempCt();
    }
    
  }, [exhaustedCards, setExhaustedCards, G.races, producing, G.tiles, selectedTile, playerID, flushTempCt, justOccupied]);


  const maxActs =  useMemo(() => {if(race){return haveTechnology(race, 'FLEET_LOGISTICS') ? 2:1}}, [race]);
  const isDMZ = useCallback((p) => p.attach && p.attach.length && p.attach.indexOf('Demilitarized Zone') > -1, []);

  const getColorByRid = useCallback((rid) => {
    const r = G.races.find(rc => rc.rid === rid);
    if(r){
      return r.color;
    }
    else{
      return ['white', 'white']
    }
  }, [G.races]);
  
  const TileContent2 = ({element, index}) => {
    const [firstCorner] = element.corners;

    return  <Container x={firstCorner.x + stagew/2 + 7.5 - element.w/2 - element.w/4} y={firstCorner.y + stageh/2 + 7.5}>
             
              {element.tdata.attacker && <SectorUnderAttack w={element.w} rid={G.races[ctx.currentPlayer].rid} rname={t('races.' + G.races[ctx.currentPlayer].rid + '.name')} 
                                  text={t('board.sector_under_attack')} fleet={element.tdata.attacker} color={G.races[ctx.currentPlayer].color[0]}/>}

              {isMyTurn && activeTile && advUnitView && advUnitView.tile === index && element.tdata.occupied == playerID && element.tdata.tokens.indexOf(race.rid) === -1 && Object.keys(element.tdata.fleet).length > 0 && 
                            <MoveDialog  x={-240} y={-50} canMoveThatPath={canMoveThatPath} pointerdown={() => moveToClick(index)} 
                                        distanceInfo={distanceInfo(element, activeTile)} buttonLabel={t('board.go')}/>}
            </Container>
  }

  const TileContent = ({element, index}) => {

    //eslint-disable-next-line
    const pathIdxs = getPureMovePath.reduce((acc, p, i) => ( (i > 0 && String(p) === String(element.tid)) && acc.push(i), acc), []);
    const [firstCorner] = element.corners;
    const moveTint = useMemo(() => {
      let tint = element.tdata.type === 'blue' ? 'lightblue' :  element.tdata.type !== 'hyperlane' ? element.tdata.type: 'white';
      if(element.tdata.occupied && String(element.tdata.occupied)!==String(playerID)) tint = 'purple';
      if(tint === 'red' && canMoveThatPath) tint = 'lightblue';

      return tint;
    }, [element.tdata]);


    return <Container x={firstCorner.x + stagew/2 + 7.5 - element.w/2 - element.w/4} y={firstCorner.y + stageh/2 + 7.5}>
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
          return p.hitCenter && <Sprite image={'icons/empty.png'} scale={1} key={i} width={p.hitRadius * 2} height={p.hitRadius * 2} x={p.hitCenter[0]-p.hitRadius} y={p.hitCenter[1]-p.hitRadius}
            interactive={true} pointerdown={ (e)=>tileClick(e, index, i) }>
              
              <Container sortableChildren={true} x={0} y={50}>
                {isDMZ(p) &&
                    <Sprite image={'icons/dmz.png'} x={0} y={35} scale={1} alpha={.75}/>
                  }
                
                {p.units && Object.keys(p.units).filter(u => ['pds', 'spacedock'].indexOf(u) > -1).map((u, ui) => {
                  return <Container x={-10 + ui*100} y={-10} zIndex={u === 'spacedock' ? 3:1} key={ui}  > 
                      <Sprite  tint={G.races[p.occupied].color[0]} scale={.5} anchor={0} image={'icons/unit_ground_bg.png'}/>
                      <Sprite image={'units/' + u.toUpperCase() + '.png'} x={0} y={-10} scale={.4} alpha={1}/>
                      <Text style={{fontSize: 20, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} 
                      x={65} y={5} text={p.units[u].length}/>
                      {u === 'spacedock' && element.active && (!element.tdata.occupied || String(element.tdata.occupied) === String(playerID)) && String(p.occupied) === String(playerID) && 
                      <Sprite image={'icons/producing.png'} cursor='pointer' scale={.2} x={45} y={-20} interactive={true} pointerdown={()=>setProducing(p.name)} 
                            style={{}}/>}
                    </Container>
                  }
                )}

                {advUnitView && advUnitView.tile === index && (p.occupied === undefined || String(element.tdata.occupied) === String(p.occupied)) &&
                  !isDMZ(p) && <LandingGreen pointerdown={()=>unloadUnit(i)} x={0} y={0}/>
                  }
                {activeTile && element.tdata.occupied == playerID && !G.spaceCannons && element.tdata.fleet && 
                  p.occupied !== undefined && String(element.tdata.occupied) !== String(p.occupied) && !isDMZ(p) &&
                    <LandingRed pointerdown={()=>moves.invasion(p)} x={0} y={0}/>
                }

                {p.invasion && <PlanetUnderAttack w={element.w} x={p.hitRadius * 1.5} y={-p.hitRadius * 1.5} text={t('board.planet_under_attack')} rid={G.races[ctx.currentPlayer].rid} 
                            rname={t('races.' + G.races[ctx.currentPlayer].rid + '.name')} fleet={p.invasion.troops} color={G.races[ctx.currentPlayer].color[0]}/>}
              </Container>

              <Container x={50} y={110}>
              {p.units && Object.keys(p.units).filter(u => ['infantry', 'fighter', 'mech'].indexOf(u) > -1).map((u, ui) =>{
                const isSelected = groundUnitSelected && groundUnitSelected.tile === index && groundUnitSelected.unit === u;

                return <Container x={-30 + ui*55} y={-20} key={ui} interactive={true} pointerdown={(e)=>loadUnit({tile: index, planet: i, unit: u, e})} >
                          <Sprite tint={isSelected ? '#f44336':G.races[p.occupied].color[0]} scale={.25}  image={'icons/unit_inf_bg.png'}/>
                          <Sprite image={'units/' + u.toUpperCase() + '.png'} x={0} y={0} scale={.25} alpha={1}/>
                          <Text style={{fontSize: 13, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} x={18} y={40} text={p.units[u].length}/>
                      </Container>}
              )}
              {element.tdata.producing_done === true && exhaustedCards.indexOf('SELF_ASSEMBLY_ROUTINES') > -1 &&
                <Text interactive={true} pointerdown={()=>moves.fromReinforcement(p.name, {mech: 1}, exhaustedCards)} y={40} x={-30} style={{fontSize: 15, fontFamily:'Handel Gothic', fill: 'yellow', dropShadow: true, dropShadowDistance: 1}} 
                text={'► Place 1 mech'}/>
              }
              {exhaustedCards.indexOf('TRANSIT_DIODES') > -1 && String(p.occupied) === String(playerID) && race.reinforcement.transit && race.reinforcement.transit.length > 0 &&
                <Text interactive={true} pointerdown={()=>moves.moveFromTransit(index, i, exhaustedCards)} y={40} x={-30} 
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
          }
        )}
        

        {element.tdata.fleet && <Container x={10} y={-30}>
          

          {Object.keys(element.tdata.fleet).map((f, i) => {
            const isCurrentAdvUnit = advUnitView && advUnitView.tile === index && advUnitView.unit === f;
            return <Container interactive={true} key={i} x={element.w/4 - 50 + i*100} y={0} pointerdown={()=>isCurrentAdvUnit ? setAdvUnitView({}):setAdvUnitView({tile: index, unit: f})} >
                    <Sprite tint={isCurrentAdvUnit ? 'gold':G.races[element.tdata.occupied].color[0]} scale={.25} anchor={0} image={'icons/unit_bg.png'}/>
                    <Sprite image={'units/' + f.toUpperCase() + '.png'} x={30} y={5} scale={.3} alpha={1}/>
                    <Text style={{fontSize: 25, fontFamily:'Handel Gothic', fill: '#FFFFFF', dropShadow: true, dropShadowDistance: 1}} 
                      x={60} y={53} text={element.tdata.fleet[f].length === 1 ? ' 1':element.tdata.fleet[f].length}/>
                </Container>
          })}
        </Container>}

        {advUnitView && advUnitView.tile === index && <Container x={30} y={-55}>
          {element.tdata.fleet && element.tdata.fleet[advUnitView.unit] && element.tdata.fleet[advUnitView.unit].map((ship, i) =>{
            const cap = advUnitViewTechnology.capacity || 0;
            const row = [];

            for(let j=0; j<cap; j++){
              row.push(<Sprite tint={payloadCursor && payloadCursor.i === i && payloadCursor.j === j ? 'gold':G.races[element.tdata.occupied].color[0]} 
                  pointerdown={()=>setPayloadCursor({i, j})} interactive={true} key={j} x={20 + j*50} y={-30-i*50} scale={.3} anchor={0} image={'icons/unit_pl_bg.png'}>
                    {ship.payload && ship.payload.length >= j && ship.payload[j] && <Sprite image={'units/' + ship.payload[j].id.toUpperCase() + '.png'} 
                    x={10} y={10} scale={1} alpha={.85}/>}
              </Sprite>);
            }
            return row;
          })}
        </Container>}



        {ctx.phase === 'acts' && isMyTurn && selectedTile === index && race.actions.length < maxActs && !activeTile && 
        element.tdata.type !== 'hyperlane' && !(element.tdata.tokens && element.tdata.tokens.indexOf(race.rid) > -1) && 
          <Container x={30} y={element.w/2 + 60} alpha={.8} anchor={0.5} cursor='pointer' interactive={true} pointerdown={()=>moves.activateTile(index)} 
              mouseover={(e) => e.target.alpha = 1} mouseout={(e) => e.target.alpha = .8} >
            <Sprite x={20} y={-20} scale={.7} image={'label.png'} alpha={.95}/>
            <Text x={100} y={17} text={t('board.activate_system')} style={{fontSize: 22, fontFamily:'system-ui', fill: '#faebd7', dropShadow: true, dropShadowDistance: 1}}>
            </Text>
          </Container>}
        
        {activeTile && advUnitView && pathIdxs.length > 0 && <MoveStep tint={moveTint} text={pathIdxs.join(',')} pointerdown={()=>modifyMoveStep(index)} y={element.w * .66} x={element.w * .58} />}

        {activeTile && advUnitView && element.tdata.type === 'hyperlane' && getMovePath.find(p => String(p.tileId) === String(element.tid)) && 
          <MoveStep tint={moveTint} pointerdown={()=>modifyMoveStep(index)} y={element.w * .66} x={element.w * .58} />
        }

        {activeTile && advUnitView && advUnitView.tile !== undefined && advUnitView.tile !== index && pathIdxs.length === 0 && selectedTile === index &&
           <MoveStep tint={moveTint} text={'+'} pointerdown={()=>modifyMoveStep(index)} y={element.w * .66} x={element.w * .58} />
        }

    </Container>
  }

  const advUnitSwitch = useMemo(()=> {
    if(advUnitView){
      return advUnitView.tile;
    }
  }, [advUnitView]);

  const activeTileSwitch = useMemo(() => {
    if(activeTile){
      return activeTile.tid;
    }
  }, [activeTile]);

  useEffect(() => {
    if(groundUnitSelected.unit !== undefined){
      const t = G.tiles[groundUnitSelected.tile];
      if(t && t.tdata){
        const p = t.tdata.planets[groundUnitSelected.planet];
        if(!p || !p.units || !p.units[groundUnitSelected.unit]){
          setGroundUnitSelected({});
        }
      }
    }
  }, [groundUnitSelected, G.tiles, race.reinforcement]);

  useEffect(()=>{
    //if(!activeTile || !advUnitView || !advUnitView.tile){
      setMoveSteps([]);
    //}
  }, [advUnitSwitch, activeTileSwitch]);

  useEffect(()=>{
    if(race.exhaustedCards.length){
      setExhaustedCards([]);
    }
    flushTempCt();
  },[race.exhaustedCards, flushTempCt]);

  /*useEffect(()=> {
    if(stratUnfold > 0 && rightBottomVisible){
      setRightBottomVisible(null)
    }
  },[stratUnfold, rightBottomVisible]);*/

  useEffect(()=>{
    if(mustSecObj || (ctx.phase === 'stats' && leftPanel !== 'objectives' && !mustAction)){
      setLeftPanel('objectives');
    }
    
  }, [ctx.phase, leftPanel, mustAction, mustSecObj]);

  const PREV_TECHNODATA = useRef([]);
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

  const PREV_EXPLORATION = useRef([]);

  useEffect(()=>{
    if(race.exploration && race.exploration.length && race.exploration.length > PREV_EXPLORATION.current.length){
      PREV_EXPLORATION.current = race.exploration;
      sendChatMessage(t('board.got_new_exploration') + ' ' 
      + t('cards.exploration.' + race.exploration[race.exploration.length-1].id + '.label').toUpperCase() + ' ('
      + t('cards.exploration.' + race.exploration[race.exploration.length-1].id + '.effect') + ')');
    }
    // eslint-disable-next-line
  }, [race.exploration]);

  const PREV_RELICS = useRef([]);

  useEffect(()=>{
    if(race.relics && race.relics.length && race.relics.length > PREV_RELICS.current.length){
      PREV_RELICS.current = race.relics;
      sendChatMessage(t('board.got_new_relic') + ': ' 
      + t('cards.relics.' + race.relics[race.relics.length-1].id + '.label').toUpperCase() + ' ('
      + t('cards.relics.' + race.relics[race.relics.length-1].id + '.effect'));
    }
    // eslint-disable-next-line
  }, [race.relics]);
  
  const PREV_PLANETS = useRef([]);

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
            setJustOccupied(newOne.name);
            sendChatMessage(t('board.has_occupied_planet') + ' ' + t('planets.' + newOne.name));
            if(newOne.exploration === 'Freelancers'){
              setProducing(newOne.name);
            }
          }
        }
      }
      PREV_PLANETS.current = PLANETS;
    }
  }, [PLANETS, sendChatMessage, t]);

  useEffect(() => { //switch TechAction
    if(!producing && justOccupied){
      if(exhaustedCards.indexOf('INTEGRATED_ECONOMY') > -1){
        exhaustTechCard('INTEGRATED_ECONOMY');
      }
    }
  }, [producing, exhaustTechCard, exhaustedCards, justOccupied])
  
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

  const TechAction = (args) => { 

    let disabled = race.exhaustedCards.indexOf(args.techId) > -1;
    let technology = techData.find(t => t.id === args.techId);
    let icon = technology ? technology.type:'propulsion';
    let addText = '';
    let units = {};

    if(!disabled && args.techId === 'INTEGRATED_ECONOMY'){
      if(ctx.phase !== 'acts' || !justOccupied) disabled = true;
    }
    if(!disabled && args.techId === 'SCANLINK_DRONE_NETWORK'){
      if(ctx.phase !== 'acts') disabled = true;
      if(!activeTile){
        disabled = true;
      }
      else if(!activeTile.tdata.planets){
        disabled = true;
      }
      else if(!activeTile.tdata.planets.find(p => !p.exhausted && p.trait && p.units && String(p.occupied) === String(playerID))){
        disabled = true;
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
      if(selectedTile < 0){
        disabled = true;
      }
      else{
        const tdata = G.tiles[selectedTile].tdata;
        if(tdata.occupied && String(tdata.occupied) !== String(playerID)){
          disabled = true;
        }
        else if(!tdata.planets || !tdata.planets.find(p => String(p.occupied) === String(playerID) && p.units && p.units.spacedock)){
          disabled = true;
        }

      }
    }

    if(args.techId === 'INFANTRY2'){
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
      if(args.techId === 'BIO_STIMS'){
        exhaustTechCard(args.techId);
        setRightBottomSubVisible(exhaustedCards.indexOf(args.techId) === -1 ? true:false);
      }
      else if(args.techId === 'SCANLINK_DRONE_NETWORK'){
        exhaustTechCard(args.techId);
        setRightBottomSubVisible(exhaustedCards.indexOf(args.techId) === -1 ? true:false);
      }
      else if(args.techId === 'INFANTRY2'){
        exhaustTechCard(args.techId);
        setRightBottomSubVisible(exhaustedCards.indexOf(args.techId) === -1 ? true:false);
      }
      else{
        exhaustTechCard(args.techId);
      }
    }

    return  <CardsPagerItem tag='context'>
              <button style={{width: '100%', marginBottom: '1rem'}} disabled={disabled} 
                  className = {'styledButton ' + (exhaustedCards.indexOf(args.techId) > -1 ? 'white':'yellow')} onClick={onClick}>
                <img alt='tech type' src={'icons/'+icon+'.png'} style={{width: '2rem', position: 'absolute', left: '1rem', bottom: '1rem'}}/>
                {t('cards.techno.' + args.techId + '.label') + addText}
              </button>

              {args.techId === 'SCANLINK_DRONE_NETWORK' && rightBottomSubVisible === true && <ListGroup className='subPanel' style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', top: '0', position: 'absolute', right: '0', width: '15rem', padding: '1rem', fontSize: '1rem'}}>
                <b>{t('board.explore_one')+ ':'}</b>
                {activeTile.tdata.planets.map((p, i) => {
                  if(p.trait){
                    return <button key={i} onClick={() => {moves.explorePlanet(p.name, exhaustedCards); setRightBottomSubVisible(null)}} style={{width: '100%', margin: '.25rem'}} className='styledButton yellow'>
                      {t('planets.' + p.name)}
                    </button>
                  }
                  return <div key={i}></div>
                })}
                <button onClick={() => {setRightBottomSubVisible(null)}} style={{width: '100%', margin: '.25rem'}} className='styledButton black'>
                          {t('board.cancel')}
                        </button>
              </ListGroup>}

              {args.techId === 'BIO_STIMS' && rightBottomSubVisible === true && <ListGroup className='subPanel' style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', top: '0', position: 'absolute', right: '0', width: '15rem', padding: '1rem', fontSize: '1rem'}}>
                      <b>{t('board.ready_one') + ':'}</b>
                      {PLANETS.map((p, i) => {
                        if(p.specialty && p.exhausted){
                          return <button key={i} onClick={() => {moves.readyPlanet(p.name, exhaustedCards); setRightBottomSubVisible(null)}} style={{width: '100%', margin: '.25rem'}} className='styledButton yellow'>
                            {t('planets.' + p.name)}
                          </button>
                        }
                        else{
                          return <div key={i}></div>
                        }
                      })}
                      {race.exhaustedCards.map((c, i)=>{
                        return <button key={i} onClick={() => {moves.readyTechnology(c, exhaustedCards); setRightBottomSubVisible(null)}} style={{width: '100%', margin: '.25rem'}} className='styledButton blue'>
                          {t('cards.techno.' + c + '.label')}
                        </button>
                      })}
                      <button onClick={() => {setRightBottomSubVisible(null)}} style={{width: '100%', margin: '.25rem'}} className='styledButton black'>
                          {t('board.cancel')}
                        </button>
                    </ListGroup>}

              {args.techId === 'INFANTRY2' && rightBottomSubVisible === true && <ListGroup className='subPanel' style={{backgroundColor: 'rgba(33, 37, 41, 0.95)', top: '0', position: 'absolute', right: '0', width: '15rem', padding: '1rem', fontSize: '1rem'}}>
                <b>{t('board.choose_one') + ':'}</b>
                {G.tiles.filter(t => t.tid === race.rid).map((tile, j) => {
                  if(tile && tile.tdata && tile.tdata.planets){
                    return tile.tdata.planets.map((p, i) =>
                      <button key={j+i} onClick={() => {moves.fromReinforcement(p.name, units, exhaustedCards); setRightBottomSubVisible(null)}} style={{width: '100%', margin: '.25rem'}} className='styledButton yellow'>
                        {t('planets.' + p.name)}
                      </button>)
                  }
                  else{
                    return <div key={j}></div>
                  }
                })}

                <button onClick={() => {setRightBottomSubVisible(null)}} style={{width: '100%', margin: '.25rem'}} className='styledButton black'>
                    {t('board.cancel')}
                  </button>
              </ListGroup>}
                    

              {t('cards.techno.' + args.techId + '.description')}
            </CardsPagerItem>
  }


  /**
   * {mustSecObj && ctx.phase === 'acts' && 
      <Card style={{...CARD_STYLE, backgroundColor: 'rgba(255, 255, 255, .75)', width: '30%', position: 'absolute', margin: '20rem 30rem', zIndex: 1}}>
        <CardTitle style={{borderBottom: '1px solid rgba(0, 0, 0, 0.42)', color: 'black'}}><h3>You must drop secret objective</h3></CardTitle>
        <CardBody style={{display: 'flex', color: 'black'}}>
          Game starts with 1 secret objective. You can't have more than 3 secret objectives.
        </CardBody>
      </Card>}
   */

// <Graphics draw={draw}/>
//{G.tiles.map((element, index) =>  )}
  /**
   * <Container key={index}>
                              {selectedTile === index && <Sprite cacheAsBitmap={true} 
                                          image={'/selected.png'} anchor={0} scale={.65} alpha={.5}
                                          x={firstCorner.x + stagew/2 - element.w/2 - element.w/4 - 10} y={firstCorner.y + stageh/2 - 50}>
                                          </Sprite>}
                              <TileContent key={index} element={element} index={index} />
                            </Container>
   */
  return (
          <StateContext.Provider value={{G, ctx, playerID, moves, exhaustedCards, exhaustTechCard, prevStages: prevStages.current, PLANETS, UNITS}}>
            <Overlay/>      
            <MyNavbar />
            <CardColumns style={{margin: '4rem 1rem 1rem 1rem', padding:'1rem', position: 'fixed', width: '42rem', zIndex: '1'}}>
              {ctx.phase !== 'strat' && ctx.phase !== 'agenda' && !strategyStage && !race.isSpectator && <>
                {leftPanel === 'techno' && <TechnologyDialog />}
                {leftPanel === 'objectives' && <Card id='objListMain' className='subPanel' style={{ padding: '4rem 1rem 1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                    <CardTitle><h6 style={{textAlign: 'right', margin: 0}}>{t('board.victory_points').toUpperCase() + ': ' + VP}</h6></CardTitle>
                    <ObjectivesList mustSecObj={mustSecObj} onSelect={ctx.phase === 'stats' && isMyTurn ? completeObjective: mustSecObj ? dropSecretObjective: ()=>{}}/>
                  </Card>}
                
                {leftPanel === 'planets' && <Card className='subPanel' style={{ padding: '3rem 1rem 2rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                  <CardTitle></CardTitle>
                    <div style={{maxHeight: '30rem', overflowY: 'auto', paddingRight: '1rem'}}>
                      <Cont style={{border: 'none'}}>
                        {<PlanetsRows PLANETS={PLANETS} />}
                      </Cont>
                    </div>
                </Card>}
                {leftPanel === 'units' && <Card className='subPanel' style={{ padding: '3rem 1rem 2rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                  <CardTitle></CardTitle>
                  <UnitsList UNITS={UNITS} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} rid={G.races[playerID].rid}/>
                </Card>}
              </>}
              {!race.isSpectator && leftPanel === 'trade' && <Card className='subPanel' style={{ padding: '3rem 2rem 2rem 1rem', backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                <TradePanel onTrade={moves.trade}/>
              </Card>}

              
            </CardColumns>

            <ChatBoard sendChatMessage={sendChatMessage} chatMessages={chatMessages}/>

            {!race.isSpectator && producing && <ProducingPanel 
                onCancel={(finish)=>{setProducing(null); if(finish && justOccupied && exhaustedCards.indexOf('INTEGRATED_ECONOMY')>-1){setJustOccupied(null)}}} 
                pname={producing} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} />}
            {!race.isSpectator && ctx.phase === 'strat' && <StrategyPick actionCardStage={actionCardStage}/>}
            

            {race.explorationDialog && <ChoiceDialog args={race.explorationDialog} onSelect={(i)=>moves.choiceDialog(i)}/>}
            {!race.isSpectator && ctx.phase === 'agenda' && <AgendaDialog onConfirm={moves.vote} mini={actionCardStage}/>}
            {race.secretObjectiveConfirm && (ctx.phase !== 'agenda' || isMyTurn) && <ChoiceDialog args={race.secretObjectiveConfirm} onSelect={(i)=>moves.secretObjectiveConfirm(race.secretObjectiveConfirm.oid, i)}/>}
            
            {strategyStage && <StrategyDialog R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES}
                  onComplete={moves.joinStrategy} onDecline={moves.passStrategy} selectedTile={selectedTile}/>}
            {actionCardStage && <ActionCardDialog selectedTile={selectedTile} selectedPlanet={selectedPlanet} selectedUnit={advUnitView}/> }
            
            {!race.secretObjectiveConfirm && <>
              {spaceCannonAttack && <SpaceCannonAttack />}
              {antiFighterBarrage && <AntiFighterBarrage selectedTile={selectedTile}/>}
              {spaceCombat && <SpaceCombat prevStages={prevStages} selectedTile={selectedTile}/>}
              {combatRetreat && <CombatRetreat selectedTile={selectedTile}/>}
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

            

            <Stage width={stagew} height={stageh} options={{antialias: true, backgroundAlpha: 0, resizeTo: window, autoDensity: true }}>
              <TickerSettings fps={30}/>
              <PixiViewport home={G.tiles.find(t => t.tid === G.races[playerID].rid)}>
                
                {G.tiles.map((element, index) => {
                      const [firstCorner] = element.corners;
                      const fill = element.tdata.type !== 'hyperlane' ? element.tdata.type: 'gray';
                      
                      return <Container key={index}>
                              
                              {tilesPng && <Sprite cacheAsBitmap={true} interactive={true} pointerdown={ (e)=>tileClick(e, index) } 
                                          image={'tiles/ST_'+element.tid+'.png'} anchor={0} scale={{ x: 1, y: 1 }}
                                          x={firstCorner.x + stagew/2 + 7.5 - element.w/2 - element.w/4} y={firstCorner.y + stageh/2 + 7.5} alpha={.9}>
                                          </Sprite>}
                              {tilesTxt && <>
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

                    })}

                {G.tiles.map((element, index) => {
                      const [firstCorner] = element.corners;
                      
                      return <Container key={index}>
                              {selectedTile === index && element.active !== true && <SelectedHex x={firstCorner.x + stagew/2 - element.w/4} y={firstCorner.y + stageh/2 + element.w/2 - 20}/>}
                              {element.active === true && <ActiveHex x={firstCorner.x + stagew/2 - element.w/4} y={firstCorner.y + stageh/2 + element.w/2 - 20}/>}
                              <TileContent key={index} element={element} index={index} />
                            </Container>

                })}
               
               {G.tiles.map((element, index) => {

                      return <TileContent2 key={index} element={element} index={index} />

                })}
                

              </PixiViewport> 
            </Stage>
            
            {!race.isSpectator && <div style={{ display:'flex', flexDirection: 'row', justifyContent: 'flex-end', position:'fixed', 
                                                alignItems: 'flex-end', right: 0, bottom: 0, width: '30%' }}>
              <CardColumns style={{minWidth: '13rem', width:'13rem', height: 'fit-content', position: 'absolute', left: '-14rem', display:'flex', 
              flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'flex-start'}}>

                <div style={{display: 'flex', flexDirection: 'column', position: 'fixed', bottom: '4rem', width: '13rem'}}>
                  {rightBottomVisible === 'context' && <>
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
                    </CardsPager>
                    
                  </>}
                  {rightBottomVisible === 'promissory' && race.promissory.length > 0 && <CardsPager>
                    {race.promissory.map((pr, i) => <CardsPagerItem key={i} tag='promissory'>
                      <button style={{width: '100%', marginBottom: '1rem'}} className='styledButton yellow'>
                        {pr.sold ? <img alt='to other player' style={{width: '2rem', position: 'absolute', left: '1rem', bottom: '1rem'}} src={'race/icons/' + pr.sold + '.png'} />:''}
                        <b style={{textDecoration: pr.sold ? 'line-through':''}}>{t('cards.promissory.' + pr.id + '.label').toUpperCase()}</b>
                        {pr.racial && !pr.owner ? <img alt='racial' style={{width: '2rem', position: 'absolute', bottom: '1rem'}} src={'race/icons/' + race.rid + '.png'} />:''}
                        {pr.owner ? <img alt='from other player' style={{width: '2rem', position: 'absolute', left: '1rem', bottom: '1rem'}} src={'race/icons/' + pr.owner + '.png'} />:''}
                      </button>
            
                        <p>{t('cards.promissory.' + pr.id + '.effect').replaceAll('[color of card]', t('board.colors.' + pr.color))}</p>

                    </CardsPagerItem>)}
                  </CardsPager>}

                  {((rightBottomVisible === 'actions' && race.actionCards.length > 0) || race.actionCards.length > 7) && <CardsPager>
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
                          <b>{t('cards.actions.' + pr.id + '.label').toUpperCase()}</b>
                        </button>

                        {t('cards.actions.' + pr.id + '.description')}
                      </CardsPagerItem>}
                    )}
                  </CardsPager>}

                  {rightBottomVisible === 'relics' && race.relics.length > 0 && <CardsPager>
                    {race.relics.map((pr, i) => <CardsPagerItem key={i} tag='relic'>
                      <button style={{width: '100%', marginBottom: '1rem'}} className='styledButton yellow'>
                        <b>{t('cards.relics.' + pr.id + '.label').toUpperCase()}</b>
                      </button>

                        {t('cards.relics.' + pr.id + '.effect')}
                    </CardsPagerItem>)}
                  </CardsPager>}

                  {rightBottomVisible === 'agenda' && G.laws.length > 0 && <CardsPager>
                    {G.laws.map((pr, i) => <CardsPagerItem key={i} tag='agenda'>
                      <button style={{width: '100%', marginBottom: '1rem'}} className='styledButton yellow'>
                        <b>{t('cards.agenda.' + pr.id + '.label').toUpperCase()}</b>
                      </button>

                      {t('cards.agenda.' + pr.id + '.for')}
                    </CardsPagerItem>)}
                  </CardsPager>}
                </div>
                <ButtonGroup className='comboPanel-left-vertical' style={{alignSelf: 'flex-end', fontFamily:'Handel Gothic', position: 'fixed', bottom: '2rem', padding: '.5rem', right: '35%'}}>
                    <button className={'styledButton ' + (rightBottomVisible === 'promissory' ? 'white':'black')} onClick={()=>rightBottomSwitch('promissory')} 
                      style={{width: '7rem', padding: 0}}>{t("board.nav.promissory")}</button>
                    <button className={'styledButton ' + (rightBottomVisible === 'relics' ? 'white':'black')} onClick={()=>rightBottomSwitch('relics')} 
                      style={{width: '7rem', padding: 0}}>{t("board.nav.relics")}</button> 
                    <button className={'styledButton ' + (rightBottomVisible === 'agenda' ? 'white':'black')} onClick={()=>rightBottomSwitch('agenda')} 
                      style={{width: '7rem', padding: 0}}>{t("board.nav.agenda")}</button>
                    <button className={'styledButton ' + (rightBottomVisible === 'actions' ? 'white':'black')} onClick={()=>rightBottomSwitch('actions')} 
                      style={{width: '7rem', padding: 0}}>{t("board.nav.actions")}</button>
                    <button className={'styledButton ' + (rightBottomVisible === 'context' ? 'white':'black')} onClick={()=>rightBottomSwitch('context')} 
                      style={{width: '7rem', padding: 0}}>{t("board.nav.context")}</button>
                </ButtonGroup>
              </CardColumns>

              <CardColumns style={{paddingRight: '2rem', display: 'flex', height: 'max-content', 
                          width: '100%', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end', position: 'relative' }}>
                  
                  {race && race.strategy.length > 0 && ctx.phase !== 'strat' && <div className='comboPanel-left-vertical' style={{display: 'flex', position: 'absolute', padding: '.5rem', top: '-5rem', right: '3rem'}}>
                    {race.strategy.map((s, i) => <StrategyCard key={i} card={s} idx={i}/>)}
                  </div>}
                  <div className='borderedPanel-vertical' style={{display: 'flex', height: 'max-content', backgroundColor: 'rgba(33, 37, 41, 0.95)',
                          width: '100%', flexDirection: 'column', justifyContent: 'flex-end', margin: '0 0 2rem 0', zIndex: 1}}>
                    {race && subcardVisible === 'stuff' && <><Card style={{...CARD_STYLE, minHeight: '14rem', marginBottom: 0}}>

                        {midPanelInfo === 'tokens' && <>
                          {<h6 style={{textAlign: 'right', marginRight: '1rem'}}>{race.tokens.new + tempCt.new || 0} {t('board.unused')}</h6>}
                          
                          <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center'}}>
                            <ListGroupItem className={race.tokens.new ? 'hoverable':''} style={TOKENS_STYLE} >
                              <h6 style={{fontSize: 50}}>{race.tokens.t + tempCt.t}</h6>
                              {ctx.phase === 'acts' && <>
                                {(race.tokens.new > 0 || exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1) && <IncrToken tag={'t'}/>}
                                {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && <DecrToken tag={'t'}/>}
                              </>}
                              <b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.tactic')}</b>
                            </ListGroupItem>
                            <ListGroupItem className={race.tokens.new ? 'hoverable':''} style={TOKENS_STYLE}>
                              <h6 style={{fontSize: 50}}>{race.tokens.f + tempCt.f}</h6>
                              {ctx.phase === 'acts' && <>
                                {(race.tokens.new > 0 || exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1) && <IncrToken tag={'f'}/>}
                                {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && <DecrToken tag={'f'}/>}
                              </>}
                              <b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.fleet')}</b>
                            </ListGroupItem>
                            <ListGroupItem className={race.tokens.new ? 'hoverable':''} style={TOKENS_STYLE}>
                              <h6 style={{fontSize: 50}}>{race.tokens.s + tempCt.s}</h6>
                              {ctx.phase === 'acts' && <>
                                {(race.tokens.new > 0 || exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1) && <IncrToken tag={'s'}/>}
                                {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && <DecrToken tag={'s'}/>}
                              </>}
                              <b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.strategic')}</b>
                              </ListGroupItem>
                          </ListGroup>

                          {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && 
                            <button className='styledButton green' style={{alignSelf: 'center', width: 'fit-content'}} 
                              onClick={() => moves.redistTokens(tempCt, exhaustedCards)}>{t('board.confirm_changes')}</button>}
                        </>}
                        {midPanelInfo === 'fragments' && <>
                        
                        <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center'}}>
                          <ListGroupItem tag='button' className='hoverable' onClick={()=>purgeFragment('c')} style={{...TOKENS_STYLE, width: '22%'}}>
                            <img alt='fragment' src='icons/cultural_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                            <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{race.fragments.c - purgingFragments.c}</h6>
                            <b style={{backgroundColor: race.color[1], width: '100%', wordWrap: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '.9rem'}}>
                              {t('board.cultural')}</b>
                          </ListGroupItem>
                          <ListGroupItem tag='button' className='hoverable' onClick={()=>purgeFragment('h')} style={{...TOKENS_STYLE, width: '22%'}}>
                            <img alt='fragment' src='icons/hazardous_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                            <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{race.fragments.h - purgingFragments.h}</h6>
                            <b style={{backgroundColor: race.color[1], width: '100%', wordWrap: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '.9rem'}}>
                              {t('board.hazardous')}</b>
                          </ListGroupItem>
                          <ListGroupItem tag='button' className='hoverable' onClick={()=>purgeFragment('i')} style={{...TOKENS_STYLE, width: '22%'}}>
                            <img alt='fragment' src='icons/industrial_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                            <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{race.fragments.i - purgingFragments.i}</h6>
                            <b style={{backgroundColor: race.color[1], width: '100%', wordWrap: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '.9rem'}}>
                              {t('board.industrial')}</b>
                          </ListGroupItem>
                          <ListGroupItem tag='button' className='hoverable' onClick={()=>purgeFragment('u')} style={{...TOKENS_STYLE, width: '22%'}}>
                            <img alt='fragment' src='icons/unknown_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                            <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{race.fragments.u - purgingFragments.u}</h6>
                            <b style={{backgroundColor: race.color[1], width: '100%', wordWrap: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '.9rem'}}>
                              {t('board.unknown')}</b>
                          </ListGroupItem>
                        </ListGroup>
                        <div style={{alignSelf: 'flex-end', margin: '0 1rem'}}>
                          <span style={{padding: '0 1rem'}}>
                            {Object.keys(purgingFragments).map(k => {
                              const result = [];
                              for(var i=0; i<purgingFragments[k]; i++){
                                const type = k === 'c' ? 'cultural': k === 'i' ? 'industrial': k === 'h' ? 'hazardous': 'unknown';
                                result.push(<img key={k+i} alt='fragment' src={'icons/' + type + '_fragment.png'} style={{width: '1.5rem'}}/>);
                              }
                              return result;
                            })}
                          </span>
                          <button className='styledButton yellow' disabled={purgingFragments.c + purgingFragments.i + purgingFragments.h + purgingFragments.u < 3} style={{maxWidth: 'fit-content'}}
                            onClick={()=>{moves.purgeFragments(purgingFragments); setPurgingFragments({c:0,i:0,h:0,u:0})}}>{t('board.purge')}</button>
                        </div>
                        </>}
                        {midPanelInfo === 'reinforce' && <div style={{padding: '0.5rem 0'}}>
                            <div style={{border: 'none', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start'}}>
                              {R_UNITS.map((u,ui) => {
                                return <div key={ui} style={{width: '4.25rem', marginRight: '.5rem', position: 'relative'}}>
                                  <img alt={u} src={'units/'+ u.id.toUpperCase() +'.png'} style={{width: '4rem'}}/>
                                  <div style={{fontSize: '30px', fontFamily: 'Handel Gothic', position: 'absolute', bottom: 0, right: 0, textShadow: '-2px 2px 3px black'}}>
                                    {UNITS_LIMIT[u.id.toLowerCase()] - (UNITS[u.id.toLowerCase()] || 0)}</div>
                                </div>}
                              )}
                            </div>
                            <div style={{display: 'flex', flexDirection: 'row-reverse', height: '2rem', marginTop: '.5rem'}}>
                              <button className='styledButton yellow' style={{marginLeft: '1rem'}} disabled={!groundUnitSelected.unit} onClick={() => moves.moveToReinforcements(groundUnitSelected)}>{' ' + t('board.remove_selected_from_board')}</button>
                              {groundUnitSelected.unit && 
                                <div style={{marginLeft: '1rem', display: 'flex'}}>
                                  <div style={{fontSize: '20px', fontFamily: 'Handel Gothic'}}>1 x </div>
                                  <img alt={groundUnitSelected.unit} src={'units/'+ groundUnitSelected.unit.toUpperCase() +'.png'} style={{width: '2rem'}}/>
                                </div>
                              }
                            </div>
                        </div>}
                      </Card>
                      
                      <ButtonGroup >
                        <button size='sm' onClick={()=>setMidPanelInfo('tokens')} className={ 'styledButton ' + (midPanelInfo === 'tokens' ? 'white':'black')} style={{flexBasis: '33%'}}>{t('board.tokens').toUpperCase()}</button>
                        <button size='sm' onClick={()=>setMidPanelInfo('fragments')} className={ 'styledButton ' + (midPanelInfo === 'fragments' ? 'white':'black')} style={{flexBasis: '33%'}}>{t('board.fragments').toUpperCase()}</button>
                        <button size='sm' onClick={()=>setMidPanelInfo('reinforce')} className={ 'styledButton ' + (midPanelInfo === 'reinforce' ? 'white':'black')} style={{flexBasis: '33%'}}>{t('board.reinforce').toUpperCase()}</button>
                      </ButtonGroup>
                      </>}
                    {race && subcardVisible === 'persons' && <><Card style={{...CARD_STYLE, minHeight: '14rem', marginBottom: 0, backgroundColor: race.color[1], display: 'flex', fontSize: '.8rem'}}>
                        {agentVisible === 'agent' && <Card style={{...CARD_STYLE, padding: '1rem 0', margin: 0, border: 'none', display: 'flex', flexFlow: 'row'}}>
                          <CardImg src={'race/agent/'+race.rid+'.png'} style={{width: '100px', height: '130px', opacity: '.75', marginRight: '1rem'}}/>
                          <CardText>{t('races.' + race.rid + '.agentAbility')}</CardText>
                        </Card>}
                        {agentVisible === 'commander' && <Card style={{...CARD_STYLE, padding: '1rem 0', margin: 0, border: 'none', display: 'flex', flexFlow: 'row'}}>
                          <CardImg src={'race/commander/'+race.rid+'.png'} style={{width: '100px', height: '130px', opacity: '.75', marginRight: '1rem'}}/>
                          <div><CardText>{t('races.' + race.rid + '.commanderAbility')}</CardText>
                          <CardText><b>{t('board.unlock') + ': '}</b> {t('races.' + race.rid + '.commanderUnlock')}</CardText></div>
                        </Card>}
                        {agentVisible === 'hero' && <Card style={{...CARD_STYLE, padding: '1rem 0', margin: 0, border: 'none', display: 'flex', flexFlow: 'row'}}>
                          <CardImg src={'race/hero/'+race.rid+'.png'} style={{width: '100px', height: '130px', opacity: '.75', marginRight: '1rem'}}/>
                          <div><CardText><b>{race.heroAbilityType ? t('board.' + race.heroAbilityType).toUpperCase() : ''}</b>{' ' + t('races.' + race.rid + '.heroAbility')}</CardText>
                          <CardText><b>{t('board.unlock') + ': '}</b> {t('board.complete_3_objectives')}</CardText></div>
                        </Card>}
                      </Card>
                      <ButtonGroup>
                          <button onClick={()=>setAgentVisible('agent')} className={'styledButton ' + (agentVisible === 'agent' ? 'white':'black')} style={{flexBasis: '33%'}}>{t('board.agent').toUpperCase()}</button>
                          <button onClick={()=>setAgentVisible('commander')} className={'styledButton ' + (agentVisible === 'commander' ? 'white':'black')} style={{flexBasis: '33%'}}>{t('board.commander').toUpperCase()}</button>
                          <button onClick={()=>setAgentVisible('hero')} className={'styledButton ' + (agentVisible === 'hero' ? 'white':'black')} style={{flexBasis: '33%'}}>{t('board.hero').toUpperCase()}</button>
                      </ButtonGroup>
                    </>}
                    {race && subcardVisible === 'abilities' && <><Card style={{...CARD_STYLE, minHeight: '16.5rem', marginBottom: 0, backgroundColor: race.color[1], display: 'flex'}}>
                        {race.abilities.map((a, i) => 
                          <CardText key={i} style={{fontSize: '90%'}}>
                            <b>{t('races.' + race.rid + '.' + a.id + '.label')}</b><br/>
                            {a.type === 'action' ? <b>{t('board.action').toUpperCase()}</b>:''}{' ' + t('races.' + race.rid + '.' + a.id + '.effect')}
                          </CardText>
                        )}
                      </Card>
                    </>}

                    {race && <ButtonGroup style={{marginTop: '1rem'}}>
                      <button className={'bi bi-stack styledButton ' + (subcardVisible === 'stuff' ? 'white':'black')} onClick={()=>setSubcardVisible('stuff')} style={{flexBasis: '33%'}}></button>
                      <button className={'bi bi-people-fill styledButton ' + (subcardVisible === 'persons' ? 'white':'black')} onClick={()=>setSubcardVisible('persons')} style={{flexBasis: '33%'}}></button>
                      <button className={'bi bi-lightning-fill styledButton ' + (subcardVisible === 'abilities' ? 'white':'black')} onClick={()=>setSubcardVisible('abilities')} style={{flexBasis: '33%'}}></button>
                    </ButtonGroup>}

                    {race && <Card style={{...CARD_STYLE, backgroundColor: race.color[1], margin: 0}}>
                      <div style={{display: 'flex'}}>
                        <div style={{display: 'flex', flexFlow: 'column'}}>
                          <Button style={{...TOKENS_STYLE, width: '10rem'}}><h6 style={{fontSize: 50}}>{(race.commodity || 0) + '/' + race.commCap}</h6><b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.commodity')}</b></Button>
                          <Button style={{...TOKENS_STYLE, width: '10rem'}}><h6 style={{fontSize: 50}}>{race.tg}</h6><b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.trade_goods')}</b></Button>
                        </div>
                        <CardImg src={'race/'+race.rid+'.png'} style={{width: '14rem', height: 'auto', marginLeft: '4rem'}}/>
                        
                      </div>
                      
                    </Card>}
                  </div>
                  
              </CardColumns>
            </div>}

            {payObj !== null && <PaymentDialog oid={payObj} G={G} race={race} planets={PLANETS} 
                            isOpen={payObj !== null} toggle={(payment)=>togglePaymentDialog(payment)}/>}
         
          {ctx.phase === 'acts' && leftPanel === 'objectives' && mustSecObj && 
            <Tooltip isOpen={document.getElementById('objListMain')} target='objListMain' placement='right' className='todoTooltip'>
              <b>{t('board.tooltips.drop_secret_obj_header')}</b>
              <p>{t('board.tooltips.drop_secret_obj_body')}</p>
            </Tooltip>}

          </StateContext.Provider>)
}


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

const TickerSettings = (args) => {
  
  const app = useApp();
  app.ticker.maxFPS = args.fps;

  return <></>
}

