/* eslint eqeqeq: 0 */
import { Stage, Graphics, Text, Container, Sprite } from '@pixi/react';
import { useMemo, useCallback, useState, useEffect } from 'react';
import { Navbar, Nav, NavItem, Button, ButtonGroup, Card, CardImg, CardText, CardTitle,  UncontrolledTooltip,/*UncontrolledAccordion, 
  AccordionItem, AccordionBody, AccordionHeader,*/ CardBody,
  CardSubtitle, CardColumns, ListGroup, ListGroupItem, Container as Cont } from 'reactstrap';
import { PaymentDialog, StrategyDialog, getStratColor, PlanetsRows, UnitsList, getTechType, ObjectivesList } from './payment';
import { PixiViewport } from './viewport';
import cardData from './cardData.json';
import { checkObjective } from './utils';

export function TIOBoard({ ctx, G, moves, events, undo, playerID }) {
  const stagew = window.innerWidth;
  const stageh = window.innerHeight;

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
        if(t.tdata.fleet){
          Object.keys(t.tdata.fleet).forEach( k => {
            if(!units[k]) units[k] = 0;
            units[k] += t.tdata.fleet[k].length;
          });
        }
      }

      if(t.tdata.planets && t.tdata.planets.length){
        t.tdata.planets.forEach(p => {
          if(p.occupied == playerID){
            if(p.units){
              Object.keys(p.units).forEach( k => {
                if(!units[k]) units[k] = 0;
                units[k] += p.units[k];
              });
            }
          }
        })
      }
    });
    
    return units;
  }, [G.tiles, playerID]);

  
  const race = useMemo(() => G.races[playerID], [G.races, playerID]);
  const [objVisible, setObjVisible] = useState(false);
  const [techVisible, setTechVisible] = useState(false);
  const [planetsVisible, setPlanetsVisible] = useState(false);
  const [advUnitView, setAdvUnitView] = useState(undefined);
  const [payloadCursor, setPayloadCursor] = useState({i:0, j:0});
  const [tilesPng, setTilesPng] = useState(true);
  const [tilesTxt, setTilesTxt] = useState(false);
  const [unitsVisible, setUnitsVisible] = useState(false);
  const [abilVisible, setAbilVisible] = useState(0);
  const [agentVisible, setAgentVisible] = useState('agent');
  const [strategyHover, setStrategyHover] = useState('LEADERSHIP');
  const [stratUnfold, setStratUnfold] = useState(0);
  const [promisVisible, setPromisVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [selectedTile, setSelectedTile] = useState(-1);
  const isMyTurn = useMemo(() => ctx.currentPlayer == playerID, [ctx.currentPlayer, playerID]);
  const R_UNITS = useMemo(() => {
    if(race){
      const all_units = race.technologies.filter(t => t.type === 'unit' && !t.upgrade);
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

    race.secretObjectives.concat(G.pubObjectives).forEach(o => {
      if(o && o.players && o.players.length > 0){
        if(o.players.indexOf(playerID) > -1) result += (o.vp ? o.vp : 1);
      }
    });

    result += race.vp;
    return result;
  }, [race, G.pubObjectives, playerID]);

  const CARD_STYLE = {background: 'none', border: 'solid 1px rgba(74, 111, 144, 0.42)', padding: '1rem', marginBottom: '1rem'}
  const TOKENS_STYLE = { display: 'flex', width: '30%', borderRadius: '5px', alignItems: 'center', textAlign: 'center', flexFlow: 'column', padding: '.15rem', background: 'none', margin: '.5rem', border: '1px solid rgba(74, 111, 144, 0.42)', color: 'white'}

  const MyNavbar = () => (
    <Navbar style={{ position: 'fixed', height: '3rem', width: '80%', zIndex: '1'}}>
      <div style={{display: 'flex'}}>
        <Nav style={{marginRight: '2rem'}}>
          <NavItem onClick={()=>setObjVisible(!objVisible)} style={{cursor: 'pointer'}}>
            <Button style={{background: 'none', border: 'none', padding: 0}} tag='img' src='icons/secret_to_public.png'/>
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
        <Nav>
          <NavItem onClick={()=>setUnitsVisible(!unitsVisible)} style={{cursor: 'pointer'}}>
            <h5>Units</h5>
          </NavItem>
        </Nav>
    </div>
    <Nav>
      <h4 style={{backgroundColor: ( isMyTurn ? 'rgba(45,255,0,.75)':'rgba(255,255,0,.75)'), color: 'black', padding: '1rem'}}>
        {isMyTurn ? 'You turn' : G.races[ctx.currentPlayer].name + ' turns '}
      </h4>
    </Nav>
    <Nav style={{float: 'right', marginRight: '5rem'}}>
      <NavItem style={{marginRight: '1rem'}}>
        <Button color='light' outline={!tilesPng} onClick={()=>setTilesPng(!tilesPng)}>Tiles</Button>
      </NavItem>
      <NavItem style={{marginRight: '1rem'}}>
        <Button color='light' outline={!tilesTxt} onClick={()=>setTilesTxt(!tilesTxt)}>Text</Button>
      </NavItem>
    {ctx.phase === 'acts' && isMyTurn &&
      <NavItem style={{marginRight: '1rem'}}>
        <Button disabled={ctx.numMoves == 0} color='dark' style={{marginLeft: '1rem'}} onClick={() => undo()}><h5 style={{margin: '.5rem'}}>Undo</h5></Button>
        <Button color='warning' onClick={()=>events.endTurn()}><h5 style={{margin: '.5rem'}}>End turn</h5></Button>
      </NavItem>}
    </Nav>
  </Navbar>);

  const completeObjective = (oid) => {
    const objective = G.pubObjectives.find(o => o.id === oid);
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

  const Objectives = () => (
    <Card style={{ ...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
      <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Objectives <span style={{float: 'right'}}>{'You have ' + VP + ' VP'}</span></h6></CardTitle>
      <ObjectivesList G={G} playerID={playerID} onSelect={ctx.phase === 'stats' && isMyTurn ? completeObjective:()=>{}}/>
    </Card>
  );

  const PlanetsList = () => (
    <Card style={{ ...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
      <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Planets</h6></CardTitle>
        <div style={{maxHeight: '30rem', overflowY: 'auto', paddingRight: '1rem'}}>
          <Cont style={{border: 'none'}}>
            {<PlanetsRows PLANETS={PLANETS} />}
          </Cont>
        </div>
    </Card>
  );

  const UnitsCard = () => (
    <Card style={{...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
      <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Units</h6></CardTitle>
      <UnitsList UNITS={UNITS} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES}/>
    </Card>
  );

  const TechMap = () => {

    return (
    <Card style={{ ...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: '1rem', position: 'relative', width: '70rem'}}>
      <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Technologies map</h6></CardTitle>
      
      <div style={{display: 'flex', justifyContent: 'space-between'}}>
        {getTechType('propulsion', race)}
        {getTechType('biotic', race)}
        {getTechType('warfare', race)}
        {getTechType('cybernetic', race)}
        {getTechType('unit', race)}
      </div>
    </Card>)
  };

  const promissorySwitch = () => {
    setStratUnfold(0);
    setActionsVisible(false);
    setPromisVisible(!promisVisible);
  }

  const actionsSwitch = () => {
    setStratUnfold(0);
    setPromisVisible(false);
    setActionsVisible(!actionsVisible);
  }

  useEffect(()=> {
    if(stratUnfold > 0 && promisVisible){
      setPromisVisible(false);
    }
  },[stratUnfold, promisVisible]);

  const StrategyCard = ({card, idx, style}) => {
    const i = idx + 1;

    return <Card onClick={()=>setStratUnfold((stratUnfold & i) === i ? stratUnfold - i:stratUnfold + i)} style={{...style, opacity: card.exhausted ? '.5':'.95', border: 'none', background: 'none', position: 'relative', marginTop: idx > 0 ? '-1rem':'5rem', alignItems: 'end'}}>
      <CardImg src={'strategy/'+ card.id + '.png'} style={{position: 'relative', top: '2rem', cursor: 'pointer'}}></CardImg>
      <div style={{width:'95%', borderRadius: '3px', padding: '.7rem', background: 'rgba(33, 37, 41, 0.65)', marginRight: '.5rem', border: 'solid 1px ' + getStratColor(card.id, '.6'), fontSize: '.8rem'}}>
        {(stratUnfold & i) === i && <div>
          <h6 style={{marginTop: '.5rem'}}>Primary:</h6>
          <CardText>{cardData.strategy[card.id].primary}</CardText>
          <h6>Secondary:</h6>
          <CardText>{cardData.strategy[card.id].secondary}</CardText>
          {!card.exhausted && <Button size='sm' color='warning' onClick={(e)=>{e.stopPropagation(); moves.useStrategy(idx)}}>Activate</Button>}
        </div>}
      </div>
      
    </Card>
  }

  const strategyStage = useMemo(()=> {
    return ctx.activePlayers && Object.keys(ctx.activePlayers).length > 0 && G.strategy !== undefined
  }, [G, ctx]);

  const AddToken = ({tag}) => {
    return (<div size='sm' style={{position: 'absolute', top: 0, right: 0, borderTopRightRadius: '4px', backgroundColor: 'rgba(242, 183, 7, 1)'}}><h5 style={{margin: '.25rem .5rem'}}>+</h5></div>);
  }

  const tileClick = (e, index) => {

    e.preventDefault(); 
    setSelectedTile(index);

  }

  const moveToClick = useCallback((idx) => {

    if(advUnitView && idx === advUnitView.tile){
      let shipIdx = payloadCursor.i;
      if(shipIdx > G.tiles[idx].tdata.fleet[advUnitView.unit].length){
        shipIdx = 0;
      }
      
      moves.moveShip({...advUnitView, shipIdx})
      setPayloadCursor({i: 0, j: 0});

      // change advUnitView after move!
      if(G.tiles[idx].tdata.fleet[advUnitView.unit].length <= 1){
        setAdvUnitView({})
      }
    }

  }, [G.tiles, advUnitView, payloadCursor, moves])

  const advUnitViewTechnology = useMemo(() => {
    if(advUnitView && advUnitView.unit){
      return race.technologies.find( t => t.id === advUnitView.unit.toUpperCase());
    }
  },[advUnitView, race.technologies]);

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

    if(advUnitView && tile.tdata.occupied == playerID){
      const unit = G.tiles[advUnitView.tile].tdata.fleet[advUnitView.unit];
      if(unit[i] && unit[i].payload && unit[i].payload[j]){
        moves.unloadUnit({src: {...advUnitView, i, j}, dst: {tile: advUnitView.tile, planet: pid}});
      }

      movePayloadCursor();
    }

  }, [G.tiles, advUnitView, moves, payloadCursor, movePayloadCursor, playerID]);

  const loadUnit = useCallback((args)=>{

    const tile = G.tiles[args.tile];
    if(tile.tdata.occupied == playerID){

      if(advUnitView && advUnitViewTechnology && advUnitView.tile && advUnitView.tile === args.tile){
        if(['infantry', 'fighter', 'mech'].indexOf(args.unit) > -1){
          
          if(tile && tile.tdata.fleet){
            const carrier = tile.tdata.fleet[advUnitView.unit];
            if(!(payloadCursor && payloadCursor.i <= carrier.length - 1 && payloadCursor.j <= advUnitViewTechnology.capacity)){
              setPayloadCursor({i:0, j:0});
            }

            moves.loadUnit({src: args, dst: {...advUnitView, ...payloadCursor}});

            movePayloadCursor();
          }
        }
      }

    }

  },[G.tiles, advUnitView, advUnitViewTechnology, moves, payloadCursor, movePayloadCursor, playerID])

  const activeTile = useMemo(()=> G.tiles.find(t => t.active === true), [G.tiles]);

  const draw = useCallback((g) => {
    g.clear();

    G.tiles.forEach((element, index) => {
      if(element.active === true){
        //g.beginFill('yellow', .15);
        g.lineStyle(3,  'yellow');
      }
      else if(index === selectedTile){
        g.beginFill('lightblue', .25);
        g.lineStyle(0,  'lightblue');
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

      /*G.tiles.forEach((element, index) => {
        if(element.tdata.tokens){
          const [firstCorner, ...otherCorners] = element.corners;
          g.beginFill('yellow');
          g.lineStyle(5,  'black');
          element.tdata.tokens.forEach((t, i) => {
            g.drawCircle(firstCorner.x + stagew/2 - 20, firstCorner.y + stageh/2 + 20, 50);
          });
          g.endFill();
        }
      });*/


    });
  }, [G.tiles, stageh, stagew, selectedTile]);


  useEffect(()=>{
    if(ctx.phase === 'stats' && !objVisible){
      setObjVisible(true);
    }
  }, [ctx.phase, objVisible]);


  const TileContent = ({element, index}) => {

    const [firstCorner] = element.corners;
    return <Container x={firstCorner.x + stagew/2 + 7.5 - element.w/2 - element.w/4} y={firstCorner.y + stageh/2 + 7.5}>
        {element.tdata.frontier && <Sprite x={30} y={element.w/4 + 30} image={'icons/frontier_bg.png'}/>}
        {element.tdata.tokens && element.tdata.tokens.length > 0 && element.tdata.tokens.map( (t, i) => 
              <Sprite key={i} x={element.w/2 + element.w/4 + 20 - i*15} y={element.w/4 + 20 - i*20} scale={{ x: 1, y: 1}} anchor={0} alpha={.9} image={'icons/ct.png'}>
                <Sprite image={'race/icons/'+ t +'.png'} scale={.55} x={15} y={15} alpha={.85}></Sprite>
              </Sprite>
        )}

        {element.tdata.planets.map((p,i) => {  
          return p.hitCenter && <Sprite image={'icons/empty.png'} scale={1} key={i} width={p.hitRadius * 2} height={p.hitRadius * 2} x={p.hitCenter[0]-p.hitRadius} y={p.hitCenter[1]-p.hitRadius}
            interactive={true} pointerdown={(e)=>tileClick(e, index)}>
              
              <Container x={0} y={50}>
                {advUnitView && advUnitView.tile === index && <Sprite pointerdown={()=>unloadUnit(i)} interactive={true} image={'icons/move_to.png'} angle={-90} x={0} y={35} scale={.5} alpha={.85}/>}
                {p.units && Object.keys(p.units).filter(u => ['pds', 'spacedock'].indexOf(u) > -1).map((u, ui) =>
                  <Sprite key={ui} x={40 + ui*55} y={0} scale={.75} anchor={0} image={'icons/unit_bg.png'}>
                    <Sprite image={'units/' + u.toUpperCase() + '.png'} x={-10} y={-10} scale={.5} alpha={.85}/>
                    <Text style={{fontSize: 30, fontFamily:'Handel Gothic', fill: 'rgb(74,111,144)', dropShadow: true, dropShadowDistance: 1}} 
                    x={45} y={25} text={p.units[u]}/>
                  </Sprite>
                )}
              </Container>

              <Container x={50} y={100}>
              {p.units && Object.keys(p.units).filter(u => ['infantry', 'fighter', 'mech'].indexOf(u) > -1).map((u, ui) =>{
                return <Sprite x={ui*55} key={ui} alpha={.85} scale={.5} interactive={true} pointerdown={()=>loadUnit({tile: index, planet: i, unit: u})} image={'icons/'+ u +'_token.png'}>
                  <Text style={{fontSize: 50, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} x={70} y={5} text={p.units[u]}/>
                </Sprite>}
              )}
              </Container>
  
            </Sprite>
          }
        )}

        {element.tdata.fleet && <Container y={-50}>
          {activeTile && element.tdata.occupied == playerID && element.tdata.tokens.indexOf(race.rid) === -1 && Object.keys(element.tdata.fleet).length > 0 &&
          <Sprite interactive={true} pointerdown={()=>moveToClick(index)} alpha={advUnitView && advUnitView.tile === index ? 1: .5} 
            scale={.75} y={5} x={-10} image={'icons/move_to.png'} />}

          {Object.keys(element.tdata.fleet).map((f, i) => {
            const isCurrentAdvUnit = advUnitView && advUnitView.tile === index && advUnitView.unit === f;
            return <Sprite tint={isCurrentAdvUnit ? '#6c89a3':'0xFFFFFF'} 
              interactive={true} key={i} x={element.w/4 - 50 + i*65} y={0} scale={{ x: 1, y: 1}} anchor={0}
              pointerdown={()=>isCurrentAdvUnit ? setAdvUnitView({}):setAdvUnitView({tile: index, unit: f})}  image={'icons/unit_bg.png'}>
                <Text text={f.replace('nought', '...')} x={10} y={5} style={{fontSize: 12}}/>
                <Sprite image={'units/' + f.toUpperCase() + '.png'} x={5} y={10} scale={{ x: .3, y: .3}} alpha={.85}/>
                <Text style={{fontSize: 30, fontFamily:'Handel Gothic', fill: 'rgb(74,111,144)', dropShadow: true, dropShadowDistance: 1}} 
                  x={35} y={25} text={element.tdata.fleet[f].length === 1 ? ' 1':element.tdata.fleet[f].length}/>
            </Sprite>
          })}
        </Container>}

        {advUnitView && advUnitView.tile === index && <Container x={30} y={15}>
          {element.tdata.fleet[advUnitView.unit] && element.tdata.fleet[advUnitView.unit].map((ship, i) =>{
            const cap = advUnitViewTechnology.capacity || 0;
            const row = [];

            for(let j=0; j<cap; j++){
              row.push(<Sprite tint={payloadCursor && payloadCursor.i === i && payloadCursor.j === j ? '#6c89a3':'0xFFFFFF'} 
                  pointerdown={()=>setPayloadCursor({i, j})} interactive={true} key={j} x={20 + j*25} y={i*30} scale={{ x: .4, y: .4}} anchor={0} image={'icons/unit_bg.png'}>
                    {ship.payload && ship.payload.length >= j && ship.payload[j] && <Sprite image={'units/' + ship.payload[j].toUpperCase() + '.png'} 
                    x={0} y={0} scale={{ x: .4, y: .4}} alpha={.85}/>}
              </Sprite>);
            }
            return row;
          })}
        </Container>}

        
    </Container>
  }

/*
<Container sortableChildren={true}>
          {element.tdata.planets && element.tdata.planets.map((p, i) => {
            if(element.tdata.fleet || p.occupied){

              return <Sprite zIndex={10-i} interactive={true} pointerdown={()=>setAdvPlanetView({tile: index, planet: i})} 
                key={i} scale={.75} x={element.w/2 - 80} y={element.w/2 + element.w/4 - 20 - i*60} image={'icons/planet_bg.png'}
                tint={advPlanetView && advPlanetView.tile === index && advPlanetView.planet === i ? '#c6d036':'0x333'}>
                
                {advPlanetView && advPlanetView.tile === index && advPlanetView.planet === i && 
                <Sprite pointerdown={()=>unloadUnit()} interactive={true} image={'icons/move_to.png'} angle={-90} x={-55} y={35} scale={.65} alpha={.85}/>} 

                <Container>
                  {p.specialty && <Sprite image={'icons/'+p.specialty+'.png'} x={0} y={-5} scale={.5} alpha={.7}/>}
                  {p.legendary && <Sprite image={'icons/legendary_complete.png'} x={0} y={0} scale={.5} alpha={.7}/>}
                  <Text text={p.name} x={35} y={5} style={{fontSize: 20, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}}/>

                  <Container x={220} y={0}>
                    {p.trait && <Sprite image={'icons/'+p.trait+'.png'} x={-70} y={5} scale={.4} />}
                    <Sprite image={'icons/influence_bg.png'} x={-40} y={-3} scale={.5}>
                      <Text text={p.influence} x={20} y={12} style={{fontSize: 40, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowAlpha: .5}}></Text>
                    </Sprite>
                    <Sprite image={'icons/resources_bg.png'} scale={.5}  y={-3}>
                      <Text text={p.resources === 1 ? ' 1': p.resources} x={20} y={10} 
                      style={{fontSize: 40, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowAlpha: .5}}></Text>
                    </Sprite>
                  </Container>

                </Container>

                <Sprite image={'icons/planet_sub_bg.png'} alpha={.85} y={35} x={-78}>
                  {p.units && Object.keys(p.units).filter(u => ['infantry', 'fighter', 'mech'].indexOf(u) > -1).map((u, ui) =>
                    <Container key={ui} >
                      {p.units[u] > 0 && 
                      <Sprite interactive={true} pointerdown={()=>loadUnit({tile: index, planet: i, unit: u})} x={40 + ui*65} 
                        y={0} scale={.5} anchor={0} image={'icons/'+ u +'_token.png'}>
                        <Text style={{fontSize: 50, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} x={75} y={5} text={p.units[u] === 1 ? ' 1':p.units[u]}/>
                      </Sprite>
                      }
                    </Container>
                  )}
                  <Container x={200} y={0}>
                    {p.units && Object.keys(p.units).filter(u => ['pds', 'spacedock'].indexOf(u) > -1).map((u, ui) =>
                      <Sprite key={ui} x={40 + ui*45} y={-5} scale={.65} anchor={0} image={'icons/'+ u +'_token.png'}>
                     
                      </Sprite>
                    )}
                  </Container>
                </Sprite>
            </Sprite>
            }
            else{
              return <Container key={i}></Container>
            }
          })
        }
        </Container>

*/




  return (<>
            <MyNavbar />
            
            {ctx.phase !== 'strat' && !strategyStage && <CardColumns style={{margin: '5rem 1rem 1rem 1rem', padding:'1rem', position: 'fixed', width: '35rem'}}>
              {race && techVisible && <TechMap />}
              {objVisible && <Objectives />}
              {planetsVisible && <PlanetsList />}
              {race && unitsVisible && <UnitsCard />}
            </CardColumns>}

            {ctx.phase === 'strat' && <Card style={{...CARD_STYLE, backgroundColor: 'rgba(255, 255, 255, .75)', width: '50%', position: 'absolute', margin: '10rem'}}>
              <CardTitle style={{borderBottom: '1px solid rgba(0, 0, 0, 0.42)', color: 'black'}}><h3>Strategy pick</h3></CardTitle>
              <CardBody style={{display: 'flex'}}>
                <ListGroup style={{background: 'none', width: '60%'}}>
                    {Object.keys(cardData.strategy).map((key, idx) => {
                      const r = G.races.find( r => r.strategy.length && r.strategy.find(s => s.id === key));

                      return <ListGroupItem key={idx} style={{background: 'none', display:'flex', justifyContent: 'flex-end', border: 'none', padding: '1rem'}}>
                        <div style={{width: 'auto'}}>
                          {r && <div style={{position: 'absolute', left: '0', width: '100%'}}>
                                  <img alt='race icon' src={'race/icons/'+r.rid+'.png'} style={{marginTop: '-.5rem', float: 'left', width: '3rem'}}/>
                                  <h5 style={{marginLeft: '4rem'}}>{r.name}</h5>
                                </div>}
                        </div>
                        <Button className='btn_hoverable' onMouseEnter={()=>setStrategyHover(key)} disabled = {r !== undefined} onClick={() => moves.pickStrategy(key)} size='sm' color='dark' 
                            style={{opacity: r ? '.5':'1', width: '11rem', height: '2rem', backgroundColor: getStratColor(key, '.3'), borderRadius: '3px'}}>
                          <img alt='strategy' style={{width:'12rem', position: 'relative', top: '-1.1rem', left: '-.5rem'}} src={'strategy/'+ key + '.png'} />
                        </Button>
                      </ListGroupItem>
                    })}
                  </ListGroup>
                  <Card style={{width: '40%', background: 'none', border: 'none', color: 'black'}}>
                    <CardBody>
                      <CardTitle><h4>{strategyHover}</h4></CardTitle>
                      <CardSubtitle style={{margin: '2rem 0'}}>{cardData.strategy[strategyHover].hit}</CardSubtitle>
                      <h5>Primary:</h5>
                      <p>{cardData.strategy[strategyHover].primary}</p>
                      <h5>Secondary:</h5>
                      <p>{cardData.strategy[strategyHover].secondary}</p>
                    </CardBody>
                  </Card>
              </CardBody>
              </Card>}
            
            {strategyStage && <StrategyDialog G={G} ctx={ctx} playerID={playerID} PLANETS={PLANETS} UNITS={UNITS} R_UNITS={R_UNITS} R_UPGRADES={R_UPGRADES}
                  onComplete={moves.joinStrategy} onDecline={moves.passStrategy} selectedTile={selectedTile}/>}

            <Stage width={stagew} height={stageh} options={{ resizeTo: window, antialias: true, autoDensity: true }}>
              <PixiViewport>
                
                {G.tiles.map((element, index) => {
                    const [firstCorner] = element.corners;
                    const fill = element.tdata.type;
                    
                    return <Container key={index}>
                            {tilesPng && <Sprite interactive={true} pointerdown={(e)=>tileClick(e, index)} 
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
            
            <div style={{ display:'flex', flexDirection: 'row', justifyContent: 'flex-end', position:'fixed', right: 0, top: 0, height: '100%', width: '35%' }}>
              <CardColumns style={{width: '20rem', position: 'relative', display:'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '1rem'}}>
                <div>
                  {race && race.strategy.length > 0 && 
                    race.strategy.map((s, i) => <StrategyCard key={i} card={s} idx={i}/>)
                  }
                  {ctx.phase === 'acts' && isMyTurn && !activeTile && selectedTile > -1 && 
                  <Button color='warning' onClick={()=>moves.activateTile(selectedTile)} style={{width: '100%', margin: '1rem 0'}}>
                    <h6 style={{margin: '0.5rem 0'}}>Activate system</h6>
                  </Button>
                  }
                </div>
                <div style={{display: 'flex', flexDirection: 'column'}}>
                  {promisVisible && <ListGroup style={{background: 'none', margin: '2rem 0'}}>
                    {race.promissory.map((pr, i) => <ListGroupItem key={i} style={{background: 'none', padding: 0}}>
                      <Button style={{width: '100%'}} size='sm' color='dark' id={pr.id}>
                        <b>{pr.id.replaceAll('_', ' ')}</b>
                        {pr.racial ? <img alt='racial' style={{width: '1rem', position: 'absolute', marginLeft: '.5rem', top: '.4rem'}} src={'race/icons/' + race.rid + '.png'} />:''}
                      </Button>
                      <UncontrolledTooltip style={{padding: '1rem', textAlign: 'left'}} placement='left' target={'#'+pr.id}>{pr.effect}</UncontrolledTooltip> 
                    </ListGroupItem>)}
                  </ListGroup>}

                  {actionsVisible && <ListGroup style={{background: 'none', margin: '2rem 0'}}>
                    {race.actionCards.map((pr, i) => <ListGroupItem key={i} style={{background: 'none', padding: 0}}>
                      <Button style={{width: '100%'}} size='sm' color='dark' id={pr.id.replaceAll(' ', '_')}>
                        <b>{pr.id.toUpperCase()}</b>
                      </Button>
                      <UncontrolledTooltip style={{padding: '1rem', textAlign: 'left'}} placement='left' target={'#'+pr.id.replaceAll(' ', '_')}>{pr.description}</UncontrolledTooltip> 
                    </ListGroupItem>)}
                  </ListGroup>}
                  <ButtonGroup style={{alignSelf: 'flex-end', height: '4rem', marginBottom: '1rem'}}>
                    <Button disabled={race.actionCards.length === 0} size='sm' className='hoverable' tag='img' onClick={()=>actionsSwitch()} 
                      style={{borderRadius: '5px', background:'none', borderColor: 'transparent', padding: '0.5rem 1.2rem', width: '5rem'}} src='icons/action_card_white.png'/>
                    <Button size='sm' className='hoverable' tag='img' onClick={()=>promissorySwitch()} 
                      style={{borderRadius: '5px', background:'none', borderColor: 'transparent', padding: '0.5rem'}} src='icons/promissory_white.png'/>
                  </ButtonGroup>
                </div>
              </CardColumns>
              <div style={{ display: 'flex', flexDirection: 'column', width: '80%', backgroundColor: 'rgba(74, 111, 144, 0.42)'}}>
                <CardColumns style={{ margin: '1rem', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                    {race && <Card style={CARD_STYLE}>
                      <div style={{display: 'flex'}}>
                        <CardImg src={'race/'+race.rid+'.png'} style={{width: '205px'}}/>
                        {G.speaker === race.rid && <SpeakerToken />}
                        <div style={{paddingLeft: '1rem', display: 'flex', flexFlow: 'column'}}>
                          <Button style={{...TOKENS_STYLE, width: '10rem'}}><h6 style={{fontSize: 50}}>{race.commodity || 0 + '/' + race.commCap}</h6><b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>commodity</b></Button>
                          <Button style={{...TOKENS_STYLE, width: '10rem'}}><h6 style={{fontSize: 50}}>{race.tg}</h6><b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>trade goods</b></Button>
                        </div>
                      </div>
                      <div style={{display: 'flex', paddingTop: '1rem', fontSize: '.8rem'}}>
                        {race.abilities.map((a, i) => 
                            <Button key={i} size='sm' onClick={()=>setAbilVisible(i)} color={abilVisible === i ? 'light':'dark'} style={{marginRight: '.5rem'}}>{a.id.replaceAll('_', ' ')}</Button>
                          )}
                      </div>

                      {race.abilities.map((a, i) => 
                        <CardText key={i} style={{marginTop:'1rem', fontSize: '.8rem', display: abilVisible === i ? 'unset':'none'}}>{a.type === 'ACTION' ? <b>ACTION</b>:''}{' ' + a.effect}</CardText>
                      )}
                    </Card>}
                    {race && <Card style={CARD_STYLE}>
                      <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)', display:'flex', justifyContent: 'space-between'}}><h6>Command tokens</h6>{race.tokens.new > 0 && <h6>{race.tokens.new} unused</h6>}</CardTitle>

                        <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center'}}>
                          <ListGroupItem className={race.tokens.new ? 'hoverable':''} tag='button' style={TOKENS_STYLE} 
                            onClick={()=>{if(race.tokens.new){ moves.adjustToken('t') }}}>
                            <h6 style={{fontSize: 50}}>{race.tokens.t}</h6>
                            {race.tokens.new > 0 && <AddToken tag={'t'}/>}
                            <b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>tactic</b>
                          </ListGroupItem>
                          <ListGroupItem className={race.tokens.new ? 'hoverable':''} onClick={()=>{if(race.tokens.new){ moves.adjustToken('f') }}} tag='button' style={TOKENS_STYLE}>
                            <h6 style={{fontSize: 50}}>{race.tokens.f}</h6>
                            {race.tokens.new > 0 && <AddToken tag={'f'}/>}
                            <b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>fleet</b>
                          </ListGroupItem>
                          <ListGroupItem className={race.tokens.new ? 'hoverable':''} onClick={()=>{if(race.tokens.new){ moves.adjustToken('s') }}} tag='button' style={TOKENS_STYLE}>
                            <h6 style={{fontSize: 50}}>{race.tokens.s}</h6>
                            {race.tokens.new > 0 && <AddToken tag={'s'}/>}
                            <b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>strategic</b>
                            </ListGroupItem>
                        </ListGroup>

                      </Card>}
                      {race && <Card style={{...CARD_STYLE, display: 'flex', fontSize: '.8rem'}}>
                        <ButtonGroup>
                          <Button size='sm' onClick={()=>setAgentVisible('agent')} color={agentVisible === 'agent' ? 'light':'dark'} style={{marginRight: '.5rem'}}>AGENT</Button>
                          <Button size='sm' onClick={()=>setAgentVisible('commander')} color={agentVisible === 'commander' ? 'light':'dark'} style={{marginRight: '.5rem'}}>COMMANDER</Button>
                          <Button size='sm' onClick={()=>setAgentVisible('hero')} color={agentVisible === 'hero' ? 'light':'dark'} style={{marginRight: '.5rem'}}>HERO</Button>
                        </ButtonGroup>
                        {agentVisible === 'agent' && <Card style={{...CARD_STYLE, padding: '1rem 0', margin: 0, border: 'none', display: 'flex', flexFlow: 'row'}}>
                          <CardImg src={'race/agent/'+race.rid+'.png'} style={{width: '100px', height: '130px', opacity: '.75', marginRight: '1rem'}}/>
                          <CardText>{race.agentAbility}</CardText>
                        </Card>}
                        {agentVisible === 'commander' && <Card style={{...CARD_STYLE, padding: '1rem 0', margin: 0, border: 'none', display: 'flex', flexFlow: 'row'}}>
                          <CardImg src={'race/commander/'+race.rid+'.png'} style={{width: '100px', height: '130px', opacity: '.75', marginRight: '1rem'}}/>
                          <CardText>{race.commanderAbility}</CardText>
                        </Card>}
                        {agentVisible === 'hero' && <Card style={{...CARD_STYLE, padding: '1rem 0', margin: 0, border: 'none', display: 'flex', flexFlow: 'row'}}>
                          <CardImg src={'race/hero/'+race.rid+'.png'} style={{width: '100px', height: '130px', opacity: '.75', marginRight: '1rem'}}/>
                          <CardText><b>{race.heroAbilityType}</b>{' ' + race.heroAbility}</CardText>
                        </Card>}
                        {(agentVisible === 'agent') && <CardText><b>{'Ready'}</b></CardText>}
                        {(agentVisible === 'commander') && <CardText><b>{'Unlock: '}</b> {race.commanderUnlock}</CardText>}
                        {(agentVisible === 'hero') && <CardText><b>{'Unlock: '}</b> {'complete 3 objectives.'}</CardText>}
                      </Card>}
                    
                </CardColumns>
              </div>
            </div>

            {payObj !== null && <PaymentDialog oid={payObj} G={G} race={race} planets={PLANETS} 
                            isOpen={payObj !== null} toggle={(payment)=>togglePaymentDialog(payment)}/>}
          </>)
}


const SpeakerToken = () => {
  return <span style={{position: 'absolute', borderRadius:'10px', backgroundColor: 'rgba(33, 37, 41, 0.95)', left: '-1rem', 
          border: 'double rgba(255,255,0,.25)', color: 'white', padding: '1rem', top: '220px', boxShadow: 'rgba(255,255,255,.15)1px 1px 5px 3px'}}>
            <h5 style={{margin: 0}}>SPEAKER</h5>
          </span>
}

const getUnitsString = (units) => {
  var s = '';
  Object.keys(units).forEach(k => {
    switch(k){
      case 'flagship':
        s += 'F' + units[k];
        break;
      case 'warsun':
        s += 'w' + units[k];
        break;
      case 'dreadnought':
        s += 'd' + units[k];
        break;
      case 'carrier':
        s += 't' + units[k];
        break;
      case 'cruiser':
        s += 'c' + units[k];
        break;
      case 'fighter':
        s += 'f' + units[k];
        break;
      case 'infantry':
        s += 'i' + units[k];
        break;
      case 'mech':
        s += 'm' + units[k];
        break;
      case 'pds':
        s += 'p' + units[k];
        break;
      case 'spacedock':
        s += 'd' + units[k];
        break;
      default:
        s += '';
    }
  });
  return s;
}

