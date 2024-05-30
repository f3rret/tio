/* eslint eqeqeq: 0 */
import { Stage, Graphics, Text, Container, Sprite } from '@pixi/react';
import { useMemo, useCallback, useState, useEffect, useRef, useContext } from 'react';
import { /*Navbar,*/ Nav, NavItem, Button, ButtonGroup, Card, CardImg, CardText, CardTitle, UncontrolledTooltip,/*UncontrolledAccordion, 
  AccordionItem, AccordionBody, AccordionHeader,*/ CardBody, Tooltip, 
  CardSubtitle, CardColumns, ListGroup, ListGroupItem, Container as Cont, Row, Col, 
  UncontrolledAccordion,
  AccordionItem,
  AccordionHeader,
  AccordionBody} from 'reactstrap';
import { PaymentDialog, StrategyDialog, AgendaDialog, getStratColor, PlanetsRows, UnitsList, /*getTechType,*/ 
ObjectivesList, TradePanel, ProducingPanel, ChoiceDialog } from './dialogs';
import { ActionCardDialog, TechnologyDialog } from './actionCardDialog'; 
import { PixiViewport } from './viewport';
import cardData from './cardData.json';
import { checkObjective, StateContext, haveTechnology, UNITS_LIMIT, wormholesAreAdjacent, LocalizationContext } from './utils';
import { lineTo, pathFromCoordinates } from './Grid';
import { ChatBoard } from './chat';
import { SpaceCannonAttack, AntiFighterBarrage, SpaceCombat, CombatRetreat, Bombardment, Invasion, ChooseAndDestroy } from './combat';
import { produce } from 'immer';
import techData from './techData.json';
import tileData from './tileData.json';

export function TIOBoard({ ctx, G, moves, events, undo, playerID, sendChatMessage, chatMessages }) {

  const stagew = window.innerWidth;
  const stageh = window.innerHeight;
  const CARD_STYLE = {background: 'none', border: 'solid 1px rgba(255, 255, 255, 0.2)', padding: '1rem', marginBottom: '1rem'}
  const TOKENS_STYLE = { display: 'flex', width: '30%', borderRadius: '5px', alignItems: 'center', textAlign: 'center', flexFlow: 'column', padding: '.15rem', background: 'none', margin: '.5rem', border: '1px solid rgba(255, 255, 255, 0.42)', color: 'white'}

  const race = useMemo(() => {
    if(playerID !== null){
      return G.races[playerID];
    }
    else return {isSpectator: true, color: ['white', 'white'], knownTechs: [], technologies:[], abilities:[], strategy:[], actionCards:[], secretObjectives:[], exhaustedCards: [], reinforcement: {},
      exploration:[], vp: 0, tg: 0, tokens: { t: 0, f: 0, s: 0, new: 0}, fragments: {u: 0, c: 0, h: 0, i: 0}, relics: []};
  }, [G.races, playerID]);

  const [exhaustedCards, setExhaustedCards] = useState([]);
  const [producing, setProducing] = useState(null);
  const [objVisible, setObjVisible] = useState(false);
  const [techVisible, setTechVisible] = useState(false);
  const [tradeVisible, setTradeVisible] = useState(false)
  const [planetsVisible, setPlanetsVisible] = useState(false);
  const [advUnitView, setAdvUnitView] = useState(undefined);
  const [groundUnitSelected, setGroundUnitSelected] = useState({});
  const [payloadCursor, setPayloadCursor] = useState({i:0, j:0});
  const [tilesPng, setTilesPng] = useState(true);
  const [tilesTxt, setTilesTxt] = useState(false);
  const [unitsVisible, setUnitsVisible] = useState(false);
  const [abilVisible, setAbilVisible] = useState(0);
  const [agentVisible, setAgentVisible] = useState('agent');
  const [subcardVisible, setSubcardVisible] = useState('stuff');
  const [strategyHover, setStrategyHover] = useState('LEADERSHIP');
  //const [stratUnfold, setStratUnfold] = useState(0);
  const [rightBottomVisible, setRightBottomVisible] = useState([]);
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

  /**
   * 
        <div style={{display: 'flex'}}>
   * <Nav style={{marginRight: '2rem'}}>
          
            <NavItem onClick={()=>setObjVisible(!objVisible)} style={{cursor: 'pointer'}}>
              <h5>Objectives</h5>
            </NavItem>
          </Nav>
          <Nav style={{marginRight: '2rem'}}>
            <NavItem onClick={()=>setTechVisible(!techVisible)} style={{cursor: 'pointer'}}>
              <h5>Technologies</h5>
            </NavItem>
          </Nav>
          <Nav style={{marginRight: '2rem'}}>
            <NavItem onClick={()=>setPlanetsVisible(!planetsVisible)} style={{cursor: 'pointer'}}>
              <h5>Planets</h5>
            </NavItem>
          </Nav>
          <Nav style={{marginRight: '2rem'}}>
            <NavItem onClick={()=>setUnitsVisible(!unitsVisible)} style={{cursor: 'pointer'}}>
              <h5>Units</h5>
            </NavItem>
          </Nav>
          <Nav>
            <NavItem onClick={()=>{ if(G.races.length > 1) setTradeVisible(!tradeVisible) }} style={{cursor: 'pointer'}}>
              <h5>Trade</h5>
            </NavItem>
          </Nav>
          <div className='mb-corner mb-right'></div>
   */
  const MyNavbar = () =>
    <div style={{ position: 'fixed', height: 0, width: '100%', zIndex: '1', display: 'flex', justifyContent: 'space-between', padding: '1rem 1rem 0 1rem'}}>
      <ButtonGroup style={{height: '2.5rem', opacity: '80%', fontFamily:'Handel Gothic'}}>
        <Button color={objVisible ? 'light':'dark'} style={{width: '8rem'}} onClick={()=>setObjVisible(!objVisible)}>{t("board.nav.objectives")}</Button>
        <Button color={planetsVisible ? 'light':'dark'} style={{width: '8rem'}} onClick={()=>setPlanetsVisible(!planetsVisible)}>{t("board.nav.planets")}</Button>
        <Button color={unitsVisible ? 'light':'dark'} style={{width: '8rem'}} onClick={()=>setUnitsVisible(!unitsVisible)}>{t("board.nav.units")}</Button>
        <Button color={techVisible ? 'light':'dark'} style={{width: '8rem'}} onClick={()=>setTechVisible(!techVisible)}>{t("board.nav.technologies")}</Button>
        <Button color={tradeVisible ? 'light':'dark'} style={{width: '8rem'}} onClick={()=>{ if(G.races.length > 1) setTradeVisible(!tradeVisible) }}>{t("board.nav.trade")}</Button>
      </ButtonGroup>
    
      <Nav style={{marginTop: '0'}}>
        <UncontrolledAccordion open='0' defaultOpen='0' id='turnLine' style={{minWidth: '30rem', opacity: '.95'}}>
          <AccordionItem style={{border: 'none', backgroundColor: 'rgba(0,0,0,.75)'}}>
            <AccordionHeader style={{}} targetId='1'>
              <span style={{display: 'flex', width: '100%', padding: '1rem', backgroundColor: G.races[ctx.currentPlayer].color[1]}}>
                <CardImg style={{width: '2rem', maxHeight: '2rem', marginRight: '1rem'}} src={'race/icons/'+G.races[ctx.currentPlayer].rid+'.png'} />
                <h5 style={{margin: 0, alignSelf: 'center', flex: 'auto'}}>{t('board.players_move') + ': ' + t('races.' + G.races[ctx.currentPlayer].rid + '.name')}</h5>
              </span>
            </AccordionHeader>
            <AccordionBody style={{padding: '0', overflow: 'hidden'}} accordionId='1'>
              {[...ctx.playOrder.slice(ctx.playOrderPos+1), ...ctx.playOrder.slice(0, ctx.playOrderPos)].map((pid, idx) => 
                <Row key={idx} style={{backgroundColor: G.races[pid].color[1]}}>
                  <Col xs='1' style={{}}>
                    <CardImg style={{width: '2rem', maxHeight: '2rem', margin: '.5rem'}} src={'race/icons/'+G.races[pid].rid+'.png'} />
                  </Col>
                  <Col xs='8' style={{padding: '1rem 1rem 0 2rem', fontFamily: 'Handel Gothic', textDecoration: G.passedPlayers.includes(''+pid) ? 'line-through':''}}>
                    {t('races.' + G.races[pid].rid + '.name')}</Col>
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
      <Nav style={{paddingRight: '5em'}}>
        {false && <><NavItem style={{marginRight: '1rem'}}>
          <Button color='light' outline={!tilesPng} onClick={()=>setTilesPng(!tilesPng)}>Tiles</Button>
        </NavItem>
        <NavItem style={{marginRight: '1rem'}}>
          <Button color='light' outline={!tilesTxt} onClick={()=>setTilesTxt(!tilesTxt)}>Text</Button>
        </NavItem></>}

        <NavItem style={{marginRight: '1rem'}}>
          {ctx.phase === 'acts' && <>
            <Button disabled={ctx.numMoves == 0 || !isMyTurn} color='dark' style={{marginLeft: '1rem'}} onClick={() => undo()}><h5 style={{margin: '.5rem'}}>{t("board.nav.undo")}</h5></Button>
            {!G.spaceCannons && <>
              {!(activeTile && activeTile.tdata.attacker) && <Button disabled={!isMyTurn} color='warning' onClick={()=>moves.endTurn()}><h5 style={{margin: '.5rem'}}>{t("board.nav.end_turn")}</h5></Button>}
              {activeTile && activeTile.tdata.attacker && <Button disabled={!isMyTurn} color='warning' onClick={()=>moves.antiFighterBarrage()}><h5 style={{margin: '.5rem'}}>{t("board.nav.space_combat")}</h5></Button>}
              </>
            }
            {isMyTurn && G.spaceCannons && <Button color='warning' onClick={()=>moves.spaceCannonAttack()}><h5 style={{margin: '.5rem'}}>{t("board.nav.space_cannon")}</h5></Button>}
          </>}
          {ctx.phase !== 'strat' && ctx.phase !== 'agenda' && <Button disabled={!isMyTurn} color='dark' onClick={()=>moves.pass()}><h5 style={{margin: '.5rem'}}>{t("board.nav.pass")}</h5></Button>}
        </NavItem>
      </Nav>
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
    if(rightBottomVisible.includes(val)){
      setRightBottomVisible(rightBottomVisible.filter(v => v !== val))
    }
    else{
      setRightBottomVisible([...rightBottomVisible, val]);
    }
  }, [rightBottomVisible]);

  const StrategyCard = ({card, idx, style}) => {

    return <Card style={{...style, opacity: '.95', border: 'none', background: 'none', position: 'relative', 
              marginTop: idx > 0 ? '0.5rem':'0rem', alignItems: 'end'}}>
              <CardImg id={'strategyCard_'+card.id} src={'strategy/'+ card.id + '.png'} style={{position: 'relative', cursor: 'default', width: '40%'}}></CardImg>
              <div style={{width:'40%', borderRadius: '3px', paddingTop: '2rem', background: 'rgba(33, 37, 41, 0.65)', 
                          marginRight: '.5rem', marginTop: '-2.3rem', border: 'solid 1px ' + getStratColor(card.id, '.6')}}>
                <Button disabled={card.exhausted} size='sm' style={{opacity: card.exhausted ? 0:1, backgroundColor: getStratColor(card.id, '.6'), width: '100%', fontFamily: 'Handel gothic'}} 
                  onClick={(e)=>{e.stopPropagation(); moves.useStrategy(idx)}}>{t('board.activate')}</Button>
              </div>
            <UncontrolledTooltip style={{padding: '1rem', textAlign: 'left'}} placement='left' target={'#strategyCard_' + card.id}>
              <h6 style={{marginTop: '.5rem'}}>{t('board.primary')}:</h6>
              <CardText>{t('cards.strategy.' + card.id + '.primary')}</CardText>
              <h6>{t('board.secondary')}:</h6>
              <CardText>{t('cards.strategy.' + card.id + '.secondary')}</CardText>
            </UncontrolledTooltip>
          </Card>
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
    return (<div size='sm' onClick={()=>clickFn()} style={{position: 'absolute', top: 0, right: 0, borderTopRightRadius: '4px', width:'2rem', backgroundColor: 'rgba(242, 183, 7, 1)'}}>
      <h5 style={{margin: '.25rem .5rem'}}>+</h5></div>);
  }

  const DecrToken = ({tag}) => {
    let clickFn = ()=>{
      if((tempCt[tag] === 0 && race.tokens[tag]>0) || tempCt[tag] > -race.tokens[tag]){ setTempCt(produce(tempCt, draft => {
      draft[tag]--; 
      draft.new++;
    }))}
    };
    return (<div size='sm' onClick={()=>clickFn()} style={{position: 'absolute', top: '2rem', right: 0, width:'2rem', backgroundColor: 'rgba(242, 183, 7, 1)'}}>
      <h5 style={{margin: '.25rem .5rem'}}>-</h5></div>);
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

  const draw = useCallback((g) => {
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
      /*else if(element.selected === true){
        g.beginFill('lightblue', .15);
        g.lineStyle(10,  'lightblue');
      }*/
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
  }, [G.tiles, stageh, stagew, selectedTile]);


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
      return (advUnitViewTechnology.move + adj) + '/' + (getPureMovePath.length-1);
    }
    else{
      return '';
    }
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
  
  const TileContent = ({element, index}) => {

    const pathIdx = getPureMovePath.indexOf(String(element.tid));
    const [firstCorner] = element.corners;
    let moveTint = element.tdata.type === 'blue' ? 'lightblue' :  element.tdata.type !== 'hyperlane' ? element.tdata.type: 'white';
    if(element.tdata.occupied && String(element.tdata.occupied)!==String(playerID)) moveTint = 'purple';
    if(moveTint === 'red' && canMoveThatPath) moveTint = 'lightblue';

    return <Container x={firstCorner.x + stagew/2 + 7.5 - element.w/2 - element.w/4} y={firstCorner.y + stageh/2 + 7.5}>
        {element.tdata.mirage && <Sprite x={element.w/4} y={element.w/6} scale={.35} alpha={.9} image={'icons/mirage_token.webp'}/>}
        {element.tdata.wormhole === 'gamma' && <Sprite x={-15} y={element.w/4 + 30} scale={.5} alpha={.9} image={'icons/gamma.png'}/>}
        {element.tdata.ionstorm && element.tdata.wormhole === 'alpha' && <Sprite x={-15} y={element.w/4 + 30} scale={1} alpha={.85} image={'icons/alpha.png'}/>}
        {element.tdata.ionstorm && element.tdata.wormhole === 'beta' && <Sprite x={-15} y={element.w/4 + 30} scale={1} alpha={.85} image={'icons/beta.png'}/>}
        {element.tdata.frontier && <Sprite x={30} y={element.w/4 + 30} image={'icons/frontier_bg.png'}/>}
        {element.tdata.tokens && element.tdata.tokens.length > 0 && element.tdata.tokens.map( (t, i) =>{
            
            return <Sprite tint={getColorByRid(t)[0]} alpha={1} key={i} x={element.w/2 + element.w/4 + 20 - i*15} y={element.w/4 + 20 - i*20} scale={.3} image={'icons/ct.png'}>
                    <Sprite image={'race/icons/'+ t +'.png'} scale={1.25} x={55} y={55} alpha={.85}></Sprite>
                  </Sprite>}
        )}
        
        
        {element.tdata.planets.map((p,i) => {  
          return p.hitCenter && <Sprite image={'icons/empty.png'} scale={1} key={i} width={p.hitRadius * 2} height={p.hitRadius * 2} x={p.hitCenter[0]-p.hitRadius} y={p.hitCenter[1]-p.hitRadius}
            interactive={true} pointerdown={ (e)=>tileClick(e, index, i) }>
              
              <Container sortableChildren={true} x={0} y={50}>
                {isDMZ(p) &&
                    <Sprite image={'icons/dmz.png'} x={0} y={35} scale={1} alpha={.75}/>
                  }
                {advUnitView && advUnitView.tile === index && (p.occupied === undefined || String(element.tdata.occupied) === String(p.occupied)) &&
                  !isDMZ(p) &&
                    <Sprite pointerdown={()=>unloadUnit(i)} interactive={true} image={'icons/move_to.png'} angle={-90} x={0} y={35} scale={.5} alpha={.85}/>
                  }
                {activeTile && element.tdata.occupied == playerID && !G.spaceCannons && element.tdata.fleet && <>
                  {p.occupied !== undefined && String(element.tdata.occupied) !== String(p.occupied) && !isDMZ(p) &&
                    <Sprite tint={'red'} pointerdown={()=>moves.invasion(p)} interactive={true} image={'icons/move_to.png'} angle={-90} x={0} y={35} scale={1} alpha={.85}/>}
                </>}
                {p.units && Object.keys(p.units).filter(u => ['pds', 'spacedock'].indexOf(u) > -1).map((u, ui) => {
                  return <Sprite zIndex={u === 'spacedock' ? 3:1} key={ui} x={40 + ui*55} y={-10} scale={1} anchor={0} image={'icons/unit_ground_bg.png'}>
                      <Sprite tint={G.races[p.occupied].color[0]} image={'units/' + u.toUpperCase() + '.png'} x={-5} y={-5} scale={.4} alpha={1}/>
                      {p.units[u].length > 1 && <Text style={{fontSize: 30, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} 
                      x={40} y={25} text={p.units[u].length}/>}
                      {u === 'spacedock' && element.active && (!element.tdata.occupied || String(element.tdata.occupied) === String(playerID)) && String(p.occupied) === String(playerID) && 
                        <Text text='► Production' x={0} y={-10} interactive={true} pointerdown={()=>setProducing(p.name)} 
                            style={{fontSize: 20, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}}/>}
                    </Sprite>
                  }
                )}
                
                {p.invasion && <Sprite scale={.75} x={p.hitRadius * 2} y={-30} image='icons/invader.png' alpha={0.85}>
                  <Container x={45} y={15}>
                    <Sprite image={'race/icons/'+ G.races[ctx.currentPlayer].rid +'.png'} scale={1}></Sprite>
                    <Text x={70} y={10} style={{fontSize: 30, fontFamily:'Handel Gothic', fill: 'white'}} text='Under attack' />
                  </Container>
                  <Container y={75} x={100}>
                    <InvasionForce fleet={p.invasion.troops} w={element.w/2}/>
                  </Container>
                </Sprite>}
              </Container>

              <Container x={50} y={100}>
              {p.units && Object.keys(p.units).filter(u => ['infantry', 'fighter', 'mech'].indexOf(u) > -1).map((u, ui) =>{
                const isSelected = groundUnitSelected && groundUnitSelected.tile === index && groundUnitSelected.unit === u;

                return <Sprite tint={isSelected ? '#f44336':'0xFFFFFF'} x={-30 + ui*55} key={ui} alpha={.85} scale={.65} interactive={true} pointerdown={(e)=>loadUnit({tile: index, planet: i, unit: u, e})} image={'icons/unit_inf_bg.png'}>
                   <Sprite tint={G.races[p.occupied].color[0]} image={'units/' + u.toUpperCase() + '.png'} x={0} y={-5} scale={.35} alpha={1}/>
                  <Text style={{fontSize: 30, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} x={50} y={25} text={p.units[u].length}/>
                </Sprite>}
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
              <Sprite tint={G.races[p.occupied].color[0]} x={50} y={50} scale={.3} image={'icons/control_token.png'}>
                <Sprite alpha={.85} x={50} y={20} image={'race/icons/'+G.races[p.occupied].rid+'.png'}/>
              </Sprite>}
  
            </Sprite>
          }
        )}

        {element.tdata.attacker && <Sprite scale={.75} x={-element.w/2} y={0} image='icons/attacker.png' alpha={0.85}>
          <Container x={35} y={35}>
            <Sprite image={'race/icons/'+ G.races[ctx.currentPlayer].rid +'.png'} scale={1}></Sprite>
            <Text x={70} y={10} style={{fontSize: 30, fontFamily:'Handel Gothic', fill: 'white'}} text='Under attack' />
          </Container>
          <Container y={125} x={-10}>
            <AttackerForce fleet={element.tdata.attacker} w={element.w}/>
          </Container>
        </Sprite>}

        {element.tdata.fleet && <Container x={10} y={-30}>
          {activeTile && advUnitView && advUnitView.tile === index && element.tdata.occupied == playerID && element.tdata.tokens.indexOf(race.rid) === -1 && Object.keys(element.tdata.fleet).length > 0 &&
          <Container y={5} x={-10}>
            <Sprite interactive={true} pointerdown={()=>moveToClick(index)} scale={.75} image={'icons/move_to.png'}
              alpha={canMoveThatPath ? 1:.5} >
                <Text text={distanceInfo(element, activeTile)} x={-100} y={10} style={{fontSize: 50, fontFamily:'Handel Gothic', fill: 'yellow', dropShadow: true, dropShadowDistance: 1}}/>
            </Sprite>
            
          </Container>}

          {Object.keys(element.tdata.fleet).map((f, i) => {
            const isCurrentAdvUnit = advUnitView && advUnitView.tile === index && advUnitView.unit === f;
            return <Sprite tint={isCurrentAdvUnit ? 'gold':'0xFFFFFF'} 
              interactive={true} key={i} x={element.w/4 - 50 + i*65} y={0} scale={{ x: 1, y: 1}} anchor={0}
              pointerdown={()=>isCurrentAdvUnit ? setAdvUnitView({}):setAdvUnitView({tile: index, unit: f})}  image={'icons/unit_bg.png'}>
                
                <Sprite tint={G.races[element.tdata.occupied].color[0]} image={'units/' + f.toUpperCase() + '.png'} x={5} y={10} scale={{ x: .3, y: .3}} alpha={1}/>
                <Text style={{fontSize: 30, fontFamily:'Handel Gothic', fill: '#4e7172', dropShadow: true, dropShadowDistance: 1}} 
                  x={35} y={25} text={element.tdata.fleet[f].length === 1 ? ' 1':element.tdata.fleet[f].length}/>
            </Sprite>
          })}
        </Container>}

        {advUnitView && advUnitView.tile === index && <Container x={30} y={-55}>
          {element.tdata.fleet && element.tdata.fleet[advUnitView.unit] && element.tdata.fleet[advUnitView.unit].map((ship, i) =>{
            const cap = advUnitViewTechnology.capacity || 0;
            const row = [];

            for(let j=0; j<cap; j++){
              row.push(<Sprite tint={payloadCursor && payloadCursor.i === i && payloadCursor.j === j ? 'gold':'0xFFFFFF'} 
                  pointerdown={()=>setPayloadCursor({i, j})} interactive={true} key={j} x={20 + j*25} y={-i*30} scale={{ x: .4, y: .4}} anchor={0} image={'icons/unit_bg.png'}>
                    {ship.payload && ship.payload.length >= j && ship.payload[j] && <Sprite tint={G.races[element.tdata.occupied].color[0]} image={'units/' + ship.payload[j].id.toUpperCase() + '.png'} 
                    x={0} y={0} scale={{ x: .4, y: .4}} alpha={.85}/>}
              </Sprite>);
            }
            return row;
          })}
        </Container>}

        {ctx.phase === 'acts' && isMyTurn && selectedTile === index && race.actions.length < maxActs &&  
        element.tdata.type !== 'hyperlane' && !(element.tdata.tokens && element.tdata.tokens.indexOf(race.rid) > -1) && 
          <Text text={'► ' + t('board.activate_system')} x={element.w/4 - 10} y={element.w/2 + 90} interactive={true} pointerdown={()=>moves.activateTile(index)} 
            style={{fontSize: 20, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}}>
          </Text>}
        
        {activeTile && advUnitView && pathIdx > 0 && 
          <Sprite tint={moveTint} interactive={true} pointerdown={()=>modifyMoveStep(index)} scale={1} y={element.w * .66} x={element.w * .58} image={'icons/move_step.png'}>
            <Text text={pathIdx} x={pathIdx === 1 ? 30:22} y={3} style={{fontSize: 50, fontFamily:'Handel Gothic', fill: 'yellow', dropShadow: true, dropShadowDistance: 1}}/>
          </Sprite>
        }

        {activeTile && advUnitView && element.tdata.type === 'hyperlane' && getMovePath.find(p => String(p.tileId) === String(element.tid)) && 
          <Sprite tint={moveTint} interactive={true} pointerdown={()=>modifyMoveStep(index)} scale={1} y={element.w * .66} x={element.w * .58} image={'icons/move_step.png'}>
          </Sprite>
        }

        {activeTile && advUnitView && advUnitView.tile !== undefined && pathIdx === -1 && selectedTile === index &&
          <Sprite interactive={true} pointerdown={()=>modifyMoveStep(index)} scale={1} y={element.w * .66} x={element.w * .58} alpha={.5} image={'icons/move_step.png'}>
            <Text text={'+'} x={17} y={0} style={{fontSize: 50, fontFamily:'Handel Gothic', fill: 'yellow', dropShadow: true, dropShadowDistance: 1}}/>
          </Sprite>
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
    if(mustSecObj || (ctx.phase === 'stats' && !objVisible && !mustAction)){
      setObjVisible(true);
    }
    
  }, [ctx.phase, objVisible, mustAction, mustSecObj]);

  const PREV_EXPLORATION = useRef([]);

  useEffect(()=>{
    if(race.exploration && race.exploration.length && race.exploration.length > PREV_EXPLORATION.current.length){
      PREV_EXPLORATION.current = race.exploration;
      sendChatMessage(t('board.got_new_exploration') + ': ' 
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
            sendChatMessage('has occupied planet: ' + newOne.name);
            if(newOne.exploration === 'Freelancers'){
              setProducing(newOne.name);
            }
          }
        }
      }
      PREV_PLANETS.current = PLANETS;
    }
  }, [PLANETS, sendChatMessage]);

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

    const onClick = ()=>{
      if(args.techId === 'BIO_STIMS'){
        exhaustTechCard(args.techId);
        setRightBottomSubVisible(exhaustedCards.indexOf(args.techId) === -1 ? 'context':null);
      }
      else if(args.techId === 'SCANLINK_DRONE_NETWORK'){
        exhaustTechCard(args.techId);
        setRightBottomSubVisible(exhaustedCards.indexOf(args.techId) === -1 ? 'context2':null);
      }
      else{
        exhaustTechCard(args.techId);
      }
    }
//                {techData.find(t => t.id === args.techId).description}
    return  <ListGroupItem style={{background: 'none', padding: 0}}>
              <Button size='sm' style={{width: '100%'}} disabled={disabled} id={'context_'+args.techId}
                  color={exhaustedCards.indexOf(args.techId) > -1 || disabled ? 'secondary':'warning'} onClick={onClick}>
                <img alt='propulsion' src={'icons/'+icon+'.png'} style={{width: '1rem', marginRight: '.5rem'}}/>
                {t('cards.techno.' + args.techId + '.label')}
              </Button>
              <UncontrolledTooltip style={{padding: '1rem', textAlign: 'left'}} placement='left' target={'#context_'+args.techId}>
                {t('cards.techno.' + args.techId + '.description')}
              </UncontrolledTooltip>
            </ListGroupItem>
  }

  const AttackerForce = useCallback((args) => {
    const {w, fleet} = args;
    const payload = {infantry: [], fighter: [], mech: []}
  
    Object.keys(fleet).forEach(tag => {
      fleet[tag].forEach(ship => {
        ship.payload && ship.payload.forEach(p => {
          if(p && p.id) payload[p.id].push({});
        });
      })
    });
  
    Object.keys(payload).forEach(k => {if(!payload[k].length) delete payload[k]});
  
    return [...Object.keys(fleet), ...Object.keys(payload)].map((f, i) => {
      const rowLength = 5;
      const y = ( i<rowLength ? 0:70 );
      const x = ( i<rowLength ? w/4 - 50 + i*65 : w/4 - 50 + (i-rowLength)*65);
      let text = fleet[f] ? fleet[f].length : payload[f].length;
      if(text === 1) text = ' 1';
  
      return <Sprite key={i} x={x} y={y} anchor={0} image={fleet[f] ? 'icons/unit_bg.png':'icons/unit_inf_bg.png'}>
          <Sprite tint={G.races[ctx.currentPlayer].color[0]} image={'units/' + f.toUpperCase() + '.png'} x={5} y={fleet[f] ? 10:0} scale={{x: .3, y: .3}} alpha={1}/>
          <Text style={{fontSize: 30, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} 
            x={35} y={25} text={text}/>
      </Sprite>
    })
  }, [G.races, ctx.currentPlayer]);
  
  const InvasionForce = useCallback((args) => {
    const {w, fleet} = args;
  
    if(fleet){
      return Object.keys(fleet).map((f, i) => {
        const rowLength = 5;
        const y = ( i<rowLength ? 0:70 );
        const x = ( i<rowLength ? w/4 - 50 + i*65 : w/4 - 50 + (i-rowLength)*65);
        let text = fleet[f].length;
        if(text === 1) text = ' 1';
  
        return <Sprite key={i} x={x} y={y} anchor={0} image='icons/unit_inf_bg.png'>
                  <Sprite tint={G.races[ctx.currentPlayer].color[0]} image={'units/' + f.toUpperCase() + '.png'} x={5} y={0} scale={{x: .3, y: .3}} alpha={1}/>
                  <Text style={{fontSize: 30, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} 
                    x={45} y={25} text={text}/>
              </Sprite>
      })
    }
  }, [G.races, ctx.currentPlayer]);

  /**
   * {mustSecObj && ctx.phase === 'acts' && 
      <Card style={{...CARD_STYLE, backgroundColor: 'rgba(255, 255, 255, .75)', width: '30%', position: 'absolute', margin: '20rem 30rem', zIndex: 1}}>
        <CardTitle style={{borderBottom: '1px solid rgba(0, 0, 0, 0.42)', color: 'black'}}><h3>You must drop secret objective</h3></CardTitle>
        <CardBody style={{display: 'flex', color: 'black'}}>
          Game starts with 1 secret objective. You can't have more than 3 secret objectives.
        </CardBody>
      </Card>}
   */

  return (
          <StateContext.Provider value={{G, ctx, playerID, moves, exhaustedCards, exhaustTechCard, prevStages: prevStages.current, PLANETS, UNITS}}>      
            <MyNavbar />
            <CardColumns style={{margin: '5rem 1rem 1rem 1rem', padding:'1rem', position: 'fixed', width: '35rem', zIndex: '1'}}>
              {ctx.phase !== 'strat' && ctx.phase !== 'agenda' && !strategyStage && !race.isSpectator && <>
                {techVisible && <TechnologyDialog />}
                {objVisible && <Card id='objListMain' style={{ ...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                    <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>{t('board.nav.objectives')} <span style={{float: 'right'}}>{t('board.you_have') + ' ' + VP + ' ' + t('board.vp')}</span></h6></CardTitle>
                    <ObjectivesList mustSecObj={mustSecObj} onSelect={ctx.phase === 'stats' && isMyTurn ? completeObjective: mustSecObj ? dropSecretObjective: ()=>{}}/>
                  </Card>}
                
                {planetsVisible && <Card style={{ ...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                  <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>{t('board.nav.planets')}</h6></CardTitle>
                    <div style={{maxHeight: '30rem', overflowY: 'auto', paddingRight: '1rem'}}>
                      <Cont style={{border: 'none'}}>
                        {<PlanetsRows PLANETS={PLANETS} />}
                      </Cont>
                    </div>
                </Card>}
                {unitsVisible && <Card style={{...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                  <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>{t('board.nav.units')}</h6></CardTitle>
                  <UnitsList UNITS={UNITS} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} rid={G.races[playerID].rid}/>
                </Card>}
              </>}
              {!race.isSpectator && tradeVisible && <Card style={{...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
                <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>{t('board.nav.trade')}</h6></CardTitle>
                <TradePanel onTrade={moves.trade}/>
              </Card>}
              {!race.isSpectator && producing && <ProducingPanel 
                onCancel={(finish)=>{setProducing(null); if(finish && justOccupied && exhaustedCards.indexOf('INTEGRATED_ECONOMY')>-1){setJustOccupied(null)}}} 
                pname={producing} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES} />}

              
            </CardColumns>

            <ChatBoard sendChatMessage={sendChatMessage} chatMessages={chatMessages}/>

            {!race.isSpectator && ctx.phase === 'strat' && 
            <Card style={{...CARD_STYLE, backgroundColor: 'rgba(255, 255, 255, .75)', width: actionCardStage ? '35%':'60%', position: 'absolute', margin: actionCardStage ? '5rem 0 0 40%':'5% 10%'}}>
              <CardTitle style={{borderBottom: '1px solid rgba(0, 0, 0, 0.42)', color: 'black'}}><h3>{t("board.strategy_pick")}</h3></CardTitle>
              <CardBody style={{display: 'flex'}}>
                <ListGroup style={{background: 'none', width: actionCardStage ? '100%':'60%'}}>
                    {Object.keys(cardData.strategy).map((key, idx) => {
                      let r = G.races.find( r => r.strategy.length && r.strategy.find(s => s.id === key));
                      if(!r && race.forbiddenStrategy && race.forbiddenStrategy.find(s => s.id === key)){
                        let sum = 0;
                        G.races.forEach(r => sum += r.strategy.length);
                        if(sum < 7) r = true;
                      }

                      return <ListGroupItem key={idx} style={{background: 'none', display:'flex', justifyContent: 'flex-end', border: 'none', padding: '1rem'}}>
                        <div style={{width: 'auto'}}>
                          {r && r!== true && <div style={{position: 'absolute', left: '0', width: '100%'}}>
                                  <img alt='race icon' src={'race/icons/'+r.rid+'.png'} style={{marginTop: '-.5rem', float: 'left', width: '3rem', maxHeight: '3rem'}}/>
                                  <h5 style={{marginLeft: '4rem', color: 'black'}}>{r.name}</h5>
                                </div>}
                        </div>
                        <Button className='btn_hoverable' onMouseEnter={()=>setStrategyHover(key)} disabled = {r !== undefined} onClick={() => moves.pickStrategy(key)} size='sm' color='dark' 
                            style={{opacity: r ? '.5':'1', width: '11rem', height: '2rem', backgroundColor: getStratColor(key, '.3'), borderRadius: '3px'}}>
                          <img alt='strategy' style={{width:'12rem', position: 'relative', top: '-1.1rem', left: '-.5rem'}} src={'strategy/'+ key + '.png'} />
                        </Button>
                      </ListGroupItem>
                    })}
                  </ListGroup>
                  {!actionCardStage && <Card style={{width: '40%', background: 'none', border: 'none', color: 'black'}}>
                    <CardBody>
                      <CardTitle><h4>{t("cards.strategy." + strategyHover + ".label")}</h4></CardTitle>
                      <CardSubtitle style={{margin: '2rem 0'}}>{t("cards.strategy." + strategyHover + ".hit")}</CardSubtitle>
                      <h5>{t("board.primary")}:</h5>
                      <p>{t("cards.strategy." + strategyHover + ".primary")}</p>
                      <h5>{t("board.secondary")}:</h5>
                      <p>{t("cards.strategy." + strategyHover + ".secondary")}</p>
                    </CardBody>
                  </Card>}
              </CardBody>
            </Card>}

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
              <CardTitle style={{borderBottom: '1px solid rgba(0, 0, 0, 0.42)', color: 'black'}}><h3>You must drop action card</h3></CardTitle>
              <CardBody style={{display: 'flex', color: 'black'}}>
                You can't have more than 7 action cards.
              </CardBody>
            </Card>}

            

            <Stage style={{border: 'double 1rem', borderColor: race ? race.color[1]:'black'}} width={stagew} height={stageh} options={{ resizeTo: window, antialias: true, autoDensity: true }}>
              <PixiViewport home={G.tiles.find(t => t.tid === G.races[playerID].rid)}>
                
                {G.tiles.map((element, index) => {
                    const [firstCorner] = element.corners;
                    const fill = element.tdata.type !== 'hyperlane' ? element.tdata.type: 'gray';
                    
                    return <Container key={index}>
                            {tilesPng && <Sprite interactive={true} pointerdown={ (e)=>tileClick(e, index) } 
                                        image={'tiles/ST_'+element.tid+'.png'} anchor={0} scale={{ x: 1, y: 1 }}
                                        x={firstCorner.x + stagew/2 + 7.5 - element.w/2 - element.w/4} y={firstCorner.y + stageh/2 + 7.5}>
                                        </Sprite>}
                            {tilesTxt && <>
                              <Text style={{fontSize: 20, fill:'white'}} text={'(' + element.q + ',' + element.r + ')'} x={firstCorner.x + stagew/2 - element.w/2} y={firstCorner.y + stageh/2}/>
                              <Text style={{fontSize: 25, fill: fill}} text={ element.tid } x={firstCorner.x + stagew/2 - element.w/4} y={firstCorner.y + stageh/2}/>
                                { element.tdata.occupied!==undefined && <Text style={{fontSize: 22, fill: 'green'}} 
                                text={element.tdata.occupied + ':' + (element.tdata.fleet ? getUnitsString(element.tdata.fleet) : '-')} 
                                x={firstCorner.x + stagew/2 - element.w/2} y={firstCorner.y + stageh/2 + element.w/1.5} /> }
                                { element.tdata.planets.map( (p, i) => 
                                  <Text key={i} 
                                    text={ (p.specialty ? '[' + p.specialty[0] + '] ':'') + p.name + (p.trait ? ' [' + p.trait[0] + '] ':'') + ' ' + p.resources + '/' + p.influence + 
                                    (p.occupied !== undefined ? ' [' + p.occupied + ':' + (p.units ? getUnitsString(p.units) : '-') + ']':'') } 
                                    style={{ fontSize: 20, fill: 'white' }} 
                                    x={firstCorner.x + stagew/2 - element.w/1.5} y={firstCorner.y + stageh/2 + element.w/6 + element.w/8 * (i+1)} />
                                  )}
                            </>}
                          </Container>
                  })}

                <Graphics draw={draw}/>
                {G.tiles.map((element, index) => <TileContent key={index} element={element} index={index} /> )}
                

              </PixiViewport> 
            </Stage>
            
            {!race.isSpectator && <div style={{ display:'flex', flexDirection: 'row', justifyContent: 'flex-end', position:'fixed', 
                                                alignItems: 'flex-end', right: 0, bottom: 0, width: '27.5%' }}>
              <CardColumns style={{minWidth: '13rem', width:'13rem', height: 'fit-content', position: 'absolute', left: '-14rem', display:'flex', 
              flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'flex-start'}}>

                <div style={{display: 'flex', flexDirection: 'column', position: 'fixed', bottom: '4rem', width: '13rem'}}>
                  {rightBottomVisible && rightBottomVisible.includes('context') && <>
                    <ListGroup style={{background: 'none', margin: '.5rem 0'}}>
                      {haveTechnology(race, 'GRAVITY_DRIVE') && <TechAction techId='GRAVITY_DRIVE'/>}
                      {haveTechnology(race, 'SLING_RELAY') && <TechAction techId='SLING_RELAY'/>}
                      {haveTechnology(race, 'BIO_STIMS') && <TechAction techId='BIO_STIMS'/>}
                      {haveTechnology(race, 'AI_DEVELOPMENT_ALGORITHM') && <TechAction techId='AI_DEVELOPMENT_ALGORITHM'/>}
                      {haveTechnology(race, 'SELF_ASSEMBLY_ROUTINES') && <TechAction techId='SELF_ASSEMBLY_ROUTINES'/>}
                      {haveTechnology(race, 'SCANLINK_DRONE_NETWORK') && <TechAction techId='SCANLINK_DRONE_NETWORK'/>}
                      {haveTechnology(race, 'PREDICTIVE_INTELLIGENCE') && <TechAction techId='PREDICTIVE_INTELLIGENCE'/>}
                      {haveTechnology(race, 'TRANSIT_DIODES') && <TechAction techId='TRANSIT_DIODES'/>}
                      {haveTechnology(race, 'INTEGRATED_ECONOMY') && <TechAction techId='INTEGRATED_ECONOMY'/>}
                    </ListGroup>
                    {rightBottomSubVisible === 'context' && <ListGroup style={{background: 'none', bottom: '2.5rem', position: 'absolute', right: '14rem', width: '13rem'}}>
                      <b>Ready one of:</b>
                      {PLANETS.map((p, i) => {
                        if(p.specialty && p.exhausted){
                          return <Button key={i} onClick={() => {moves.readyPlanet(p.name, exhaustedCards); setRightBottomSubVisible(null)}} style={{width: '100%', margin: '.25rem'}} size='sm' color='warning'>
                            {p.name}
                          </Button>
                        }
                        return <div key={i}></div>
                      })}
                      {race.exhaustedCards.map((c, i)=>{
                        return <Button key={i} onClick={() => {moves.readyTechnology(c, exhaustedCards); setRightBottomSubVisible(null)}} style={{width: '100%', margin: '.25rem'}} size='sm' color='warning'>
                          {c.replaceAll('_', ' ')}
                        </Button>
                      })}
                    </ListGroup>}
                    {rightBottomSubVisible === 'context2' && <ListGroup style={{background: 'none', bottom: '2.5rem', position: 'absolute', right: '14rem', width: '13rem'}}>
                      <b>Explore one of:</b>
                      {activeTile.tdata.planets.map((p, i) => {
                        if(p.trait){
                          return <Button key={i} onClick={() => {moves.explorePlanet(p.name, exhaustedCards); setRightBottomSubVisible(null)}} style={{width: '100%', margin: '.25rem'}} size='sm' color='warning'>
                            {p.name}
                          </Button>
                        }
                        return <div key={i}></div>
                      })}
                    </ListGroup>}
                  </>}
                  {rightBottomVisible.includes('promissory') && race.promissory.length > 0 && <ListGroup style={{background: 'none', margin: '.5rem 0'}}>
                    {race.promissory.map((pr, i) => <ListGroupItem key={i} style={{background: 'none', padding: 0}}>
                      <Button style={{width: '100%'}} size='sm' color='dark' id={pr.id+pr.color}>
                        {pr.sold ? <img alt='to other player' style={{width: '1rem', position: 'absolute', left: '.5rem', top: '.4rem'}} src={'race/icons/' + pr.sold + '.png'} />:''}
                        <b style={{textDecoration: pr.sold ? 'line-through':''}}>{t('cards.promissory.' + pr.id + '.label').toUpperCase()}</b>
                        {pr.racial && !pr.owner ? <img alt='racial' style={{width: '1rem', position: 'absolute', marginLeft: '.5rem', top: '.4rem'}} src={'race/icons/' + race.rid + '.png'} />:''}
                        {pr.owner ? <img alt='from other player' style={{width: '1rem', position: 'absolute', marginLeft: '.5rem', top: '.4rem'}} src={'race/icons/' + pr.owner + '.png'} />:''}
                      </Button>
                      <UncontrolledTooltip style={{padding: '1rem', textAlign: 'left'}} placement='left' target={'#'+pr.id+pr.color}>
                        {t('cards.promissory.' + pr.id + '.effect').replaceAll('[color of card]', t('board.colors.' + pr.color))}
                      </UncontrolledTooltip> 
                    </ListGroupItem>)}
                  </ListGroup>}

                  {((rightBottomVisible.includes('actions') && race.actionCards.length > 0) || race.actionCards.length > 7) && <ListGroup style={{background: 'none', margin: '.5rem 0'}}>
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

                      return <ListGroupItem key={i} style={{background: 'none', padding: 0}}>
                        <Button style={{width: '100%'}} onClick={()=> { 
                                  if(mustAction){moves.dropActionCard(pr.id)}
                        else if(!disabled){ moves.playActionCard(pr); /*setRightBottomVisible(null)*/}}} 
                                  size='sm' color={disabled || mustAction ? 'dark':'warning'} id={pr.id.replaceAll(' ', '_')} >
                          {mustAction && race.actionCards.length > 7 && 
                            <b style={{backgroundColor: 'red', color: 'white', padding: '.25rem', left: '0', top: '0', position: 'absolute'}}>{t('board.drop')}</b>}
                          <b>{t('cards.actions.' + pr.id + '.label').toUpperCase()}</b>
                        </Button>
                        <UncontrolledTooltip style={{padding: '1rem', textAlign: 'left'}} placement='left' target={'#'+pr.id.replaceAll(' ', '_')}>
                          {t('cards.actions.' + pr.id + '.description')}</UncontrolledTooltip> 
                      </ListGroupItem>}
                    )}
                  </ListGroup>}

                  {rightBottomVisible.includes('relics') && race.relics.length > 0 && <ListGroup style={{background: 'none', margin: '.5rem 0'}}>
                    {race.relics.map((pr, i) => <ListGroupItem key={i} style={{background: 'none', padding: 0}}>
                      <Button style={{width: '100%'}} size='sm' color='dark' id={pr.id.replaceAll(' ', '_')}>
                        <b>{t('cards.relics.' + pr.id + '.label').toUpperCase()}</b>
                      </Button>
                      <UncontrolledTooltip style={{padding: '1rem', textAlign: 'left'}} placement='left' target={'#'+pr.id.replaceAll(' ', '_')}>
                        {t('cards.relics.' + pr.id + '.effect')}
                      </UncontrolledTooltip> 
                    </ListGroupItem>)}
                  </ListGroup>}

                  {rightBottomVisible.includes('agenda') && G.laws.length > 0 && <ListGroup style={{background: 'none', margin: '.5rem 0'}}>
                    {G.laws.map((pr, i) => <ListGroupItem key={i} style={{background: 'none', padding: 0}}>
                      <Button style={{width: '100%'}} size='sm' color='dark' id={pr.id.replaceAll(' ', '_').replaceAll(':', '_')}>
                        <b>{t('cards.agenda.' + pr.id + '.label').toUpperCase()}</b>
                      </Button>
                      <UncontrolledTooltip style={{padding: '1rem', textAlign: 'left'}} placement='left' target={'#'+pr.id.replaceAll(' ', '_').replaceAll(':', '_')}>{t('cards.agenda.' + pr.id + '.for')}</UncontrolledTooltip> 
                    </ListGroupItem>)}
                  </ListGroup>}
                </div>
                <ButtonGroup style={{alignSelf: 'flex-end', opacity: '80%', fontFamily:'Handel Gothic', marginBottom: '1rem', position: 'fixed', bottom: 0}}>
                    <Button color={rightBottomVisible.includes('promissory') ? 'light':'dark'} onClick={()=>rightBottomSwitch('promissory')} 
                      style={{width: '7rem'}}>{t("board.nav.promissory")}</Button>
                    <Button color={rightBottomVisible.includes('relics') ? 'light':'dark'} onClick={()=>rightBottomSwitch('relics')} 
                      style={{width: '7rem'}}>{t("board.nav.relics")}</Button> 
                    <Button color={rightBottomVisible.includes('agenda') ? 'light':'dark'} onClick={()=>rightBottomSwitch('agenda')} 
                      style={{width: '7rem'}}>{t("board.nav.agenda")}</Button>
                    <Button color={rightBottomVisible.includes('actions') ? 'light':'dark'} onClick={()=>rightBottomSwitch('actions')} 
                      style={{width: '7rem'}}>{t("board.nav.actions")}</Button>
                    <Button color={rightBottomVisible.includes('context') ? 'light':'dark'} onClick={()=>rightBottomSwitch('context')} 
                      style={{width: '7rem'}}>{t("board.nav.context")}</Button>
                </ButtonGroup>
              </CardColumns>

              <CardColumns style={{marginRight: '1rem', display: 'flex', height: 'max-content', 
                          width: '100%', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  
                  {race && race.strategy.length > 0 && ctx.phase !== 'strat' && <div style={{marginBottom: '1rem'}}>
                    {race.strategy.map((s, i) => <StrategyCard key={i} card={s} idx={i}/>)}
                  </div>}
                  <div style={{backgroundColor: 'rgba(0, 0, 0, .75)', display: 'flex', height: 'max-content', 
                          width: '100%', flexDirection: 'column', justifyContent: 'flex-end', marginBottom: '1rem'}}>
                    {race && subcardVisible === 'stuff' && <><Card style={{...CARD_STYLE, height: '13rem', marginBottom: 0, backgroundColor: race.color[1]}}>

                        {midPanelInfo === 'tokens' && <>
                        {<h6 style={{textAlign: 'right'}}>{race.tokens.new + tempCt.new || 0} {t('board.unused')}</h6>}
                        {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && 
                          <Button size='sm' color='success' style={{position: 'absolute', top: '0', right: '0'}} 
                            onClick={() => moves.redistTokens(tempCt, exhaustedCards)}>{t('board.confirm_changes')}</Button>}
                        <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center'}}>
                          <ListGroupItem className={race.tokens.new ? 'hoverable':''} tag='button' style={TOKENS_STYLE} >
                            <h6 style={{fontSize: 50}}>{race.tokens.t + tempCt.t}</h6>
                            {ctx.phase === 'acts' && <>
                              {(race.tokens.new > 0 || exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1) && <IncrToken tag={'t'}/>}
                              {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && <DecrToken tag={'t'}/>}
                            </>}
                            <b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.tactic')}</b>
                          </ListGroupItem>
                          <ListGroupItem className={race.tokens.new ? 'hoverable':''} tag='button' style={TOKENS_STYLE}>
                            <h6 style={{fontSize: 50}}>{race.tokens.f + tempCt.f}</h6>
                            {ctx.phase === 'acts' && <>
                              {(race.tokens.new > 0 || exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1) && <IncrToken tag={'f'}/>}
                              {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && <DecrToken tag={'f'}/>}
                            </>}
                            <b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.fleet')}</b>
                          </ListGroupItem>
                          <ListGroupItem className={race.tokens.new ? 'hoverable':''} tag='button' style={TOKENS_STYLE}>
                            <h6 style={{fontSize: 50}}>{race.tokens.s + tempCt.s}</h6>
                            {ctx.phase === 'acts' && <>
                              {(race.tokens.new > 0 || exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1) && <IncrToken tag={'s'}/>}
                              {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && <DecrToken tag={'s'}/>}
                            </>}
                            <b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.strategic')}</b>
                            </ListGroupItem>
                        </ListGroup>
                        
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
                          <Button size='sm' disabled={purgingFragments.c + purgingFragments.i + purgingFragments.h + purgingFragments.u < 3} style={{maxWidth: 'fit-content'}}
                            color='warning' onClick={()=>{moves.purgeFragments(purgingFragments); setPurgingFragments({c:0,i:0,h:0,u:0})}}>{t('board.purge')}</Button>
                        </div>
                        </>}
                        {midPanelInfo === 'reinforce' && <div style={{padding: '0.5rem 0'}}>
                            <div style={{border: 'none', justifyContent: 'space-around', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start'}}>
                              {R_UNITS.map((u,ui) => {
                                return <div key={ui} style={{width: '4.25rem', marginRight: '.5rem', position: 'relative'}}>
                                  <img alt={u} src={'units/'+ u.id.toUpperCase() +'.png'} style={{width: '4rem'}}/>
                                  <div style={{fontSize: '30px', fontFamily: 'Handel Gothic', position: 'absolute', bottom: 0, right: 0, textShadow: '-2px 2px 3px black'}}>
                                    {UNITS_LIMIT[u.id.toLowerCase()] - (UNITS[u.id.toLowerCase()] || 0)}</div>
                                </div>}
                              )}
                            </div>
                            <div style={{display: 'flex', height: '2rem', marginTop: '.5rem'}}>
                              <Button disabled={!groundUnitSelected.unit} size='sm' color='danger' onClick={() => moves.moveToReinforcements(groundUnitSelected)}
                                className='bi bi-backspace-reverse-fill'>{' ' + t('board.remove_selected_from_board')}</Button>
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
                        <Button size='sm' onClick={()=>setMidPanelInfo('tokens')} color={midPanelInfo === 'tokens' ? 'light':'dark'} style={{flexBasis: 1}}>{t('board.tokens').toUpperCase()}</Button>
                        <Button size='sm' onClick={()=>setMidPanelInfo('fragments')} color={midPanelInfo === 'fragments' ? 'light':'dark'} style={{flexBasis: 1}}>{t('board.fragments').toUpperCase()}</Button>
                        <Button size='sm' onClick={()=>setMidPanelInfo('reinforce')} color={midPanelInfo === 'reinforce' ? 'light':'dark'} style={{flexBasis: 1}}>{t('board.reinforce').toUpperCase()}</Button>
                      </ButtonGroup>
                      </>}
                    {race && subcardVisible === 'persons' && <><Card style={{...CARD_STYLE, height: '13rem', marginBottom: 0, backgroundColor: race.color[1], display: 'flex', fontSize: '.8rem'}}>
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
                          <Button size='sm' onClick={()=>setAgentVisible('agent')} color={agentVisible === 'agent' ? 'light':'dark'} style={{flexBasis: 1}}>{t('board.agent').toUpperCase()}</Button>
                          <Button size='sm' onClick={()=>setAgentVisible('commander')} color={agentVisible === 'commander' ? 'light':'dark'} style={{flexBasis: 1}}>{t('board.commander').toUpperCase()}</Button>
                          <Button size='sm' onClick={()=>setAgentVisible('hero')} color={agentVisible === 'hero' ? 'light':'dark'} style={{flexBasis: 1}}>{t('board.hero').toUpperCase()}</Button>
                      </ButtonGroup>
                    </>}
                    {race && subcardVisible === 'abilities' && <><Card style={{...CARD_STYLE, height: '13rem', marginBottom: 0, backgroundColor: race.color[1], display: 'flex', fontSize: '.8rem'}}>
                        {race.abilities.map((a, i) => 
                          <CardText key={i} style={{margin:'1rem 0 0 0', minHeight: '3rem', fontSize: '.8rem', display: abilVisible === i ? 'unset':'none'}}>
                            {a.type === 'action' ? <b>{t('board.action').toUpperCase()}</b>:''}{' ' + t('races.' + race.rid + '.' + a.id + '.effect')}
                          </CardText>
                        )}
                      </Card>
                      <ButtonGroup style={{backgroundColor: '#212529'}}>
                          {race.abilities.map((a, i) => 
                              <Button key={i} size='sm' onClick={()=>setAbilVisible(i)} color={abilVisible === i ? 'light':'dark'}>
                                {t('races.' + race.rid + '.' + a.id + '.label')}</Button>
                            )}
                      </ButtonGroup>
                    </>}

                    {race && <ButtonGroup style={{marginTop: '1rem'}}>
                      <Button size='sm' className='bi bi-stack' onClick={()=>setSubcardVisible('stuff')} color={subcardVisible === 'stuff' ? 'light':'dark'} style={{}}></Button>
                      <Button size='sm' className='bi bi-people-fill' onClick={()=>setSubcardVisible('persons')} color={subcardVisible === 'persons' ? 'light':'dark'} style={{}}></Button>
                      <Button size='sm' className='bi bi-lightning-fill' onClick={()=>setSubcardVisible('abilities')} color={subcardVisible === 'abilities' ? 'light':'dark'} style={{}}></Button>
                    </ButtonGroup>}

                    {race && <Card style={{...CARD_STYLE, backgroundColor: race.color[1], margin: 0}}>
                      <div style={{display: 'flex'}}>
                        <div style={{display: 'flex', flexFlow: 'column'}}>
                          <Button style={{...TOKENS_STYLE, width: '10rem'}}><h6 style={{fontSize: 50}}>{(race.commodity || 0) + '/' + race.commCap}</h6><b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.commodity')}</b></Button>
                          <Button style={{...TOKENS_STYLE, width: '10rem'}}><h6 style={{fontSize: 50}}>{race.tg}</h6><b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.trade_goods')}</b></Button>
                          {G.speaker === race.rid && 
                            <span style={{width: '10rem', borderRadius:'10px', backgroundColor: 'rgba(33, 37, 41, 0.95)', margin: '2rem .5rem', 
                            border: 'double rgba(255,255,0,.25)', color: 'white', padding: '.5rem', top: '220px', position: 'absolute', 
                            boxShadow: 'rgba(255,255,255,.15)1px 1px 5px 3px'}}><h5 style={{margin: 0, textAlign: 'center'}}>{t('board.speaker')}</h5></span>}
                        </div>
                        <CardImg src={'race/'+race.rid+'.png'} style={{width: '205px'}}/>
                        
                      </div>
                      
                    </Card>}
                  </div>
                  
              </CardColumns>
            </div>}

            {payObj !== null && <PaymentDialog oid={payObj} G={G} race={race} planets={PLANETS} 
                            isOpen={payObj !== null} toggle={(payment)=>togglePaymentDialog(payment)}/>}
         
          {ctx.phase === 'acts' && objVisible && mustSecObj && 
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

