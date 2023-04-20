/* eslint eqeqeq: 0 */
import { Stage, Graphics, Text, Container, Sprite } from '@pixi/react';
//import { HexGrid } from './Grid';
import { useMemo, useCallback, useState } from 'react';
import { Navbar, Nav, NavItem, Button, Card, CardImg, CardText, CardTitle, UncontrolledCollapse, CardBody,
  CardSubtitle, CardColumns, ListGroup, ListGroupItem, Container as Cont } from 'reactstrap';
import { PaymentDialog, StrategyDialog, getStratColor, PlanetsRows } from './payment';
import { PixiViewport } from './viewport';
import techData from './techData.json';
import cardData from './cardData.json';

export function TIOBoard({ ctx, G, moves, events, undo, playerID }) {
  const stagew = window.innerWidth;
  const stageh = window.innerHeight;

  /*const stageOnclick = (e) => {
    const x = e.clientX - stagew/2;
    const y = e.clientY - stageh/2;
    const hex = HexGrid.pointToHex({x, y}, {allowOutside: false});

    if(hex){
      G.tiles.forEach((v, i) => {
        if(v.q === hex.q && v.r === hex.r){
          moves.selectTile(i);
        }
      });
    }
  }

  const stageOncontext = (e) => {
    e.preventDefault();
    const x = e.clientX - stagew/2;
    const y = e.clientY - stageh/2;
    const hex = HexGrid.pointToHex({x, y}, {allowOutside: false});

    if(hex){
      G.tiles.forEach((v, i) => {
        if(v.q === hex.q && v.r === hex.r){
          moves.activateTile(i);
        }
      });
    }
  }*/

  const [payObj, setPayObj] = useState(-1);
  const togglePaymentDialog = (payment) => {
    if(payment && Object.keys(payment).length > 0){
      moves.completePublicObjective(payObj, payment);
    }
    setPayObj(-1);
  };

  const completePubObj = (e, i) => {
    e.preventDefault();

    if(G.pubObjectives[i].type === 'SPEND'){
      setPayObj(i);
      //moves.completePublicObjective(i, payment);
    }
    else{
      moves.completePublicObjective(i);
    }

  }

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
            units[k] += t.tdata.fleet[k];
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

  const draw = useCallback((g) => {
    g.clear();

    G.tiles.forEach(element => {
      if(element.active === true){
        g.beginFill('yellow', .15);
        g.lineStyle(10,  'yellow');
      }
      else if(element.selected === true){
        g.beginFill('lightblue', .15);
        g.lineStyle(10,  'lightblue');
      }
      else{
        g.lineStyle(3,  0x999999);
      }
      const [firstCorner, ...otherCorners] = element.corners
      g.moveTo(firstCorner.x + stagew/2, firstCorner.y + stageh/2)
      otherCorners.forEach(({ x, y }) => g.lineTo(x + stagew/2, y + stageh/2))
      g.lineTo(firstCorner.x + stagew/2, firstCorner.y + stageh/2);

      if(element.selected === true || element.active === true){
        g.endFill();
      }
    });
  }, [G.tiles, stageh, stagew]);

  const race = useMemo(() => G.races[playerID], [G.races, playerID]);
  const [objVisible, setObjVisible] = useState(false);
  const [techVisible, setTechVisible] = useState(false);
  const [planetsVisible, setPlanetsVisible] = useState(false);
  const [tilesPng, setTilesPng] = useState(true);
  const [tilesTxt, setTilesTxt] = useState(true);
  const [unitsVisible, setUnitsVisible] = useState(true);
  const [showUnit, setShowUnit] = useState('FLAGSHIP');
  const [abilVisible, setAbilVisible] = useState(0);
  const [strategyHover, setStrategyHover] = useState('LEADERSHIP');
  const [stratUnfold, setStratUnfold] = useState(0);
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

  const CARD_STYLE = {background: 'none', border: 'solid 1px rgba(74, 111, 144, 0.42)', padding: '1rem', marginBottom: '1rem'}
  const TOKENS_STYLE = { display: 'flex', width: '30%', borderRadius: '5px', alignItems: 'center', textAlign: 'center', flexFlow: 'column', padding: '.15rem', background: 'none', margin: '.5rem', border: '1px solid rgba(74, 111, 144, 0.42)', color: 'white'}
  const B_STYLE = {backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}

  const MyNavbar = () => (
    <Navbar style={{ position: 'fixed', height: '3rem', width: '70%'}}>
      <div style={{display: 'flex'}}>
        
        <Nav style={{marginRight: '2rem'}}>
          <NavItem onClick={()=>setTechVisible(!techVisible)} style={{cursor: 'pointer'}}>
            <h5>Technologies</h5>
          </NavItem>
        </Nav>
        <Nav style={{marginRight: '2rem'}}>
          <NavItem onClick={()=>setObjVisible(!objVisible)} style={{cursor: 'pointer'}}>
            <h5>Objectives</h5>
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
        <Button disabled={!isMyTurn || ctx.numMoves == 0} color='dark' style={{marginLeft: '1rem'}} onClick={() => undo()}>Undo</Button></NavItem>
      <NavItem style={{marginRight: '1rem'}}>
        <Button color='light' outline={!tilesPng} onClick={()=>setTilesPng(!tilesPng)}>Tiles</Button>
      </NavItem>
      <NavItem style={{marginRight: '1rem'}}>
        <Button color='light' outline={!tilesTxt} onClick={()=>setTilesTxt(!tilesTxt)}>Text</Button>
      </NavItem>
    </Nav>
  </Navbar>);

  const Objectives = () => (
    <Card style={{ ...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
      <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Public objectives</h6></CardTitle>
      
      <ListGroup style={{maxHeight: '30rem', overflowY: 'auto', border: 'none', paddingRight: '1rem'}}>
      {G.pubObjectives && G.pubObjectives.length > 0 &&
        G.pubObjectives.map((o, i) => {
          const complete = o.players.indexOf(playerID) > -1;
          return <ListGroupItem className='hoverable'
                    style={{padding: '1rem', cursor: complete ? 'default':'pointer', 
                      background: complete ? 'rgba(154, 205, 50, 0.25)':'none', color: 'white', border: 'solid 1px transparent' }} 
                      key={i} onClick={(e) => {if(!complete)completePubObj(e, i)}}>
                    <b style={{}}>{o.id}</b>{' [ '}{o.players.map((p, pi) => <b key={pi}>{p}</b>)}{' ]  '}
                    <br/>
                    <i style={{fontSize: '0.8rem'}}>{o.title}</i>
                  </ListGroupItem>})
        }
      
      </ListGroup>
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

  const UnitsList = () => (
    <Card style={{...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)'}}>
      <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Units</h6></CardTitle>
      <div style={{display: 'flex'}}>
        <div style={{display:'flex', flexFlow:'column', width: '30%', border: 'none'}}>
          {R_UNITS.map((u, i) =>
            <Button key={i} size='sm' color={showUnit === u.id ? 'light':'dark'} onClick={()=>setShowUnit(u.id)}>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <div>{u.alreadyUpgraded && <span style={{color: 'coral', marginRight: '.5rem'}}>▲</span>}{u.id}</div>
                <div>{UNITS[u.id.toLowerCase()]}</div>
              </div>
            </Button>)}
        </div>
        <div style={{paddingLeft: '1rem', flex: 'auto', width: '70%'}}>
          <CardImg src={'units/' + showUnit + '.png'} style={{width: 'auto', float: 'left'}}/>
          <div style={{padding: '1rem', position: 'absolute', right: 0, textAlign: 'end'}}>
            {R_UNITS[showUnit].description && <h5>{R_UNITS[showUnit].description}</h5>}
            {R_UNITS[showUnit].sustain && <h6>♦ sustain damage</h6>}
            {R_UNITS[showUnit].bombardment && <h6>♦ bombardment {R_UNITS[showUnit].bombardment.value + ' x ' + R_UNITS[showUnit].bombardment.count}</h6>}
            {R_UNITS[showUnit].barrage && <h6>♦ barrage {R_UNITS[showUnit].barrage.value + ' x ' + R_UNITS[showUnit].barrage.count}</h6>}
            {R_UNITS[showUnit].planetaryShield && <h6>♦ planetary shield</h6>}
            {R_UNITS[showUnit].spaceCannon && <h6>♦ space cannon {R_UNITS[showUnit].spaceCannon.value + ' x ' + R_UNITS[showUnit].spaceCannon.count + ' range ' + R_UNITS[showUnit].spaceCannon.range}</h6>}
            {R_UNITS[showUnit].production && <h6>♦ production {R_UNITS[showUnit].production}</h6>}
            {!R_UNITS[showUnit].alreadyUpgraded && R_UPGRADES[showUnit+'2'] && <>
              <h6 style={{marginTop: '2rem'}}>{'upgradable '}
              {Object.keys(R_UPGRADES[showUnit+'2'].prereq).map((p, j) => {
                let result = [];
                for(var i=1; i<=R_UPGRADES[showUnit+'2'].prereq[p]; i++){
                  result.push(<img key={j+' '+i} alt='requirement' style={{width: '1.25rem'}} src={'icons/'+p+'.png'}/>);
                }
                return result;
              })}</h6>
                <ul style={{fontSize: '.8rem', marginTop: '-.5rem', opacity: '.8', listStyle: 'none'}}>
                  {Object.keys(R_UPGRADES[showUnit+'2']).map((k, i) => {
                    const L1 = R_UNITS[showUnit][k];
                    const L2 = R_UPGRADES[showUnit+'2'][k];
                    if(['cost', 'combat', 'move', 'capacity', 'shot', 'production'].indexOf(k) > -1){
                      if(L2 !== L1){
                        return <li key={i}>{k + ' ' + L2}</li>
                      }
                    }
                    else if(['bombardment', 'barrage'].indexOf(k) > -1 && L2){
                      if(!L1 || L2.value != L1.value || L2.count != L1.count){
                        return <li key={i}>{k + ' ' + R_UPGRADES[showUnit+'2'][k].value + ' x ' + L2.count}</li>
                      }
                    }
                    else if(k === 'spaceCannon' && L2){
                      if(!L1 || L2.value != L1.value || L2.count != L1.count || L2.range != L1.range){
                        return <li key={i}>{'space cannon ' + L2.value + ' x ' + L2.count + ' range ' + L2.range}</li>
                      }
                    }
                    else if( k === 'sustain' && L2){
                      return <li key={i}>sustain damage</li>
                    }
                    return null
                  })}
                </ul>
              </>
            }
          </div>
          
          <div style={{clear: 'both'}}/>
                              
          <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center', marginBottom: '.5rem'}}>
            {R_UNITS[showUnit].cost && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{fontSize: 30}}>{R_UNITS[showUnit].cost}</h6><b style={B_STYLE}>cost</b></ListGroupItem>}
            {R_UNITS[showUnit].combat && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}>
              <h6 style={{fontSize: 30}}>{R_UNITS[showUnit].combat}{R_UNITS[showUnit].shot && R_UNITS[showUnit].shot > 1 && 
                <i style={{position: 'absolute', fontSize: '1.25rem', top: '0.5rem', right: 0, transform: 'rotate(90deg)'}}>{'♦'.repeat(R_UNITS[showUnit].shot)}</i>}
              </h6><b style={B_STYLE}>combat</b></ListGroupItem>}
            {R_UNITS[showUnit].move && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{fontSize: 30}}>{R_UNITS[showUnit].move}</h6><b style={B_STYLE}>move</b></ListGroupItem>}
            {R_UNITS[showUnit].capacity && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{fontSize: 30}}>{R_UNITS[showUnit].capacity}</h6><b style={B_STYLE}>capacity</b></ListGroupItem>}
          </ListGroup>
          {R_UNITS[showUnit].effect && <CardText style={{fontSize: '0.8rem'}}>{R_UNITS[showUnit].effect}</CardText>}
          {R_UNITS[showUnit].deploy && <CardText style={{fontSize: '0.8rem'}}><b>DEPLOY</b>{' '+R_UNITS[showUnit].deploy}</CardText>}
        </div>
      </div>
    </Card>
  );

  const TechMap = () => {

    const getTechType = (typ) => {
      const techs = (typ === 'unit' ? race.technologies.filter(t => t.type === typ && t.upgrade):[...techData, ...race.technologies.map(r=>({...r, racial: true}))].filter(t => t.type === typ));

      return (<div style={{width: typ === 'unit' ? '23%':'19%', border: 'solid 1px rgba(255,255,255,.42)', alignSelf:'flex-start'}}>
        <img alt='tech type' style={{width: '1.5rem', position: 'absolute', marginTop: '.2rem', marginLeft: '.5rem'}} src={'icons/'+typ+'.png'}/>
        <h6 style={{backgroundColor: 'rgba(74, 111, 144, 0.42)', width: '100%', textAlign: 'center', padding: '.5rem'}}>
          {typ === 'unit' ? 'UPGRADES':typ.toUpperCase()}
        </h6>
        
        <ListGroup>
          {techs.map((t, i) => 
            <ListGroupItem key={i} style={{background: 'none', padding: '.25rem', color: 'white', borderBottom: 'solid 1px rgba(255,255,255,.15)'}}>
              <Button size='sm' color={race.knownTechs.indexOf(t.id) > -1 ? 'success':'dark'} id={t.id} style={{width: '100%', fontSize: '.7rem', textAlign: 'left'}}>
                {t.id.replaceAll('_', ' ').replaceAll('2', ' II')}
                {t.racial && <img alt='racial' style={{width: '1rem', position: 'absolute', marginLeft: '.5rem', top: '.6rem'}} src={'race/icons/'+ race.rid +'.png'}/>}
                {t.type === 'unit' && t.prereq && Object.keys(t.prereq).length > 0 && <div style={{textAlign: 'right', position: 'absolute', right: '.5rem', top: '.5rem'}}>
                  {Object.keys(t.prereq).map((p, j) =>{
                    let result = [];
                    for(var i=1; i<=t.prereq[p]; i++){
                      result.push(<img key={j+''+i} alt='requirement' style={{width: '1rem'}} src={'icons/'+p+'.png'}/>);
                    }
                    return result;
                  })}
                  </div>
                }
              </Button>
              <UncontrolledCollapse toggler={'#'+t.id} style={{fontSize: '.7rem', padding: '.2rem'}}>
                {t.type !== 'unit' && t.prereq && Object.keys(t.prereq).length > 0 && <div style={{textAlign: 'right'}}>
                  <b>require: </b>
                  {Object.keys(t.prereq).map((p, j) =>{
                    let result = [];
                    for(var i=1; i<=t.prereq[p]; i++){
                      result.push(<img key={j+''+i} alt='requirement' style={{width: '1rem'}} src={'icons/'+p+'.png'}/>);
                    }
                    return result;
                  })}
                  </div>
                }
                {t.type !== 'unit' && t.description}
                {t.type === 'unit' && <div style={{fontSize: '.7rem'}}>
                  <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center', marginBottom: '.5rem'}}>
                  {t.cost && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{margin: 0}}>{t.cost}</h6><b style={{...B_STYLE, fontSize: '.5rem'}}>cost</b></ListGroupItem>}
                  {t.combat && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}>
                    <h6 style={{margin: 0}}>{t.combat}{t.shot && t.shot > 1 && 
                      <i style={{position: 'absolute', fontSize: 10, top: '0.5rem', right: 0, transform: 'rotate(90deg)'}}>{'♦'.repeat(t.shot)}</i>}
                    </h6><b style={{...B_STYLE, fontSize: '.5rem'}}>combat</b></ListGroupItem>}
                  {t.move && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{margin: 0}}>{t.move}</h6><b style={{...B_STYLE, fontSize: '.5rem'}}>move</b></ListGroupItem>}
                  {t.capacity && <ListGroupItem style={{...TOKENS_STYLE, width: '25%', margin: '.1rem'}}><h6 style={{margin: 0}}>{t.capacity}</h6><b style={{...B_STYLE, fontSize: '.5rem'}}>capacity</b></ListGroupItem>}
                </ListGroup>
                {t.sustain && <p style={{margin: 0}}>♦ sustain damage </p>}
                {t.bombardment && <p style={{margin: 0}}>♦ bombardment {t.bombardment.value + ' x ' + t.bombardment.count}</p>}
                {t.barrage && <p style={{margin: 0}}>♦ barrage {t.barrage.value + ' x ' + t.barrage.count} </p>}
                {t.planetaryShield && <p style={{margin: 0}}>♦ planetary shield </p>}
                {t.spaceCannon && <p style={{margin: 0}}>♦ space cannon {t.spaceCannon.value + ' x ' + t.spaceCannon.count + ' range ' + t.spaceCannon.range}</p>}
                {t.production && <p style={{margin: 0}}>♦ production {t.production}</p>}
                {t.effect && <CardText style={{paddingTop: '.5rem'}}>{t.effect}</CardText>}
                {t.deploy && <CardText style={{paddingTop: '.5rem'}}><b>DEPLOY</b>{' '+t.deploy}</CardText>}
                </div>
                }
              </UncontrolledCollapse>
            </ListGroupItem>)}
        </ListGroup>
      </div>
    )};

    return (
    <Card style={{ ...CARD_STYLE, backgroundColor: 'rgba(33, 37, 41, 0.95)', padding: '1rem', position: 'relative', width: '70rem'}}>
      <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Technologies map</h6></CardTitle>
      
      <div style={{display: 'flex', justifyContent: 'space-between'}}>
        {getTechType('propulsion')}
        {getTechType('biotic')}
        {getTechType('warfare')}
        {getTechType('cybernetic')}
        {getTechType('unit')}
      </div>
    </Card>)
  };

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

  return (<>
            <MyNavbar />
            
            {ctx.phase !== 'strat' && !strategyStage && <CardColumns style={{margin: '5rem 1rem 1rem 1rem', padding:'1rem', position: 'fixed', width: '35rem'}}>
              {race && techVisible && <TechMap />}
              {objVisible && <Objectives />}
              {planetsVisible && <PlanetsList />}
              {race && unitsVisible && <UnitsList />}
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
            
            {strategyStage && <StrategyDialog G={G} ctx={ctx} playerID={playerID} PLANETS={PLANETS} onComplete={moves.joinStrategy}/>}

            <Stage width={stagew} height={stageh} options={{ resizeTo: window, antialias: true, autoDensity: true }}>
              <PixiViewport>
                
                {G.tiles.map((element, index) => {
                    const [firstCorner] = element.corners;
                    const fill = element.tdata.type;
                    
                    return <Container key={index}>
                            {tilesPng && <Sprite interactive={true} pointerdown={(e)=>{e.preventDefault(); moves.selectTile(index);}} 
                                        image={'tiles/ST_'+element.tid+'.png'} anchor={0} scale={{ x: 1, y: 1 }} 
                                        x={firstCorner.x + stagew/2 - element.w/2 - element.w/4} y={firstCorner.y + stageh/2}/>}
                            {tilesTxt && <>
                              <Text style={{fontSize: 20, fill:'white'}} text={"(" + element.q + "," + element.r + ")"} x={firstCorner.x + stagew/2 - element.w/2} y={firstCorner.y + stageh/2}/>
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
              </PixiViewport> 
            </Stage>
            
            <div style={{ display:'flex', flexDirection: 'row', justifyContent: 'flex-end', position:'fixed', right: 0, top: 0, height: '100%', width: '35%' }}>
              <CardColumns style={{width: '20rem', position: 'relative'}}>
                {race && race.strategy.length > 0 && 
                  race.strategy.map((s, i) => <StrategyCard key={i} card={s} idx={i}/>)
                }
              </CardColumns>
              <div style={{ display: 'flex', flexDirection: 'column', width: '80%', backgroundColor: 'rgba(74, 111, 144, 0.42)'}}>
                <CardColumns style={{ margin: '1rem' }}>
                    {race && <Card style={CARD_STYLE}>
                      <div style={{display: 'flex'}}>
                        <CardImg src={'race/'+race.rid+'.png'} style={{width: '205px'}}/>
                        <div style={{paddingLeft: '1rem', display: 'flex', flexFlow: 'column'}}>
                          <Button style={{...TOKENS_STYLE, width: '10rem'}}><h6 style={{fontSize: 50}}>{race.commodity || 0 + '/' + race.commCap}</h6><b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>commodity</b></Button>
                          <Button style={{...TOKENS_STYLE, width: '10rem'}}><h6 style={{fontSize: 50}}>{race.tg}</h6><b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>trade goods</b></Button>
                        </div>
                      </div>
                      <div style={{display: 'flex', paddingTop: '1rem'}}>
                        {race.abilities.map((a, i) => 
                            <Button key={i} size='sm' onClick={()=>setAbilVisible(i)} color={abilVisible === i ? 'light':'dark'} style={{marginRight: '.5rem'}}>{a.id.replaceAll('_', ' ')}</Button>
                          )}
                      </div>

                      {race.abilities.map((a, i) => 
                        <CardText key={i} style={{marginTop:'1rem', display: abilVisible === i ? 'unset':'none'}}>{a.type === 'ACTION' ? <b>ACTION</b>:''}{' ' + a.effect}</CardText>
                      )}
                    </Card>}
                    {race && <Card style={CARD_STYLE}>
                      <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)', display:'flex', justifyContent: 'space-between'}}><h6>Command tokens</h6>{race.tokens.new > 0 && <h6>{race.tokens.new} unused</h6>}</CardTitle>

                        <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center'}}>
                          <ListGroupItem className={race.tokens.new ? 'hoverable':''} tag='button' style={TOKENS_STYLE} onClick={()=>{
                              if(race.tokens.new){ moves.adjustToken('t') } else if(ctx.phase === 'acts'){moves.activateTile();} }}>
                            <h6 style={{fontSize: 50}}>{race.tokens.t}</h6>
                            {race.tokens.new > 0 && <AddToken tag={'t'}/>}
                            <b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>tactic</b>
                          </ListGroupItem>
                          <ListGroupItem className={race.tokens.new ? 'hoverable':''} onClick={()=>{if(race.tokens.new){ moves.adjustToken('f') }}} tag='button' style={TOKENS_STYLE}><h6 style={{fontSize: 50}}>{race.tokens.f}</h6>
                            {race.tokens.new > 0 && <AddToken tag={'f'}/>}
                            <b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>fleet</b>
                          </ListGroupItem>
                          <ListGroupItem className={race.tokens.new ? 'hoverable':''} onClick={()=>{if(race.tokens.new){ moves.adjustToken('s') }}} tag='button' style={TOKENS_STYLE}><h6 style={{fontSize: 50}}>{race.tokens.s}</h6>
                            {race.tokens.new > 0 && <AddToken tag={'s'}/>}
                            <b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>strategic</b>
                            </ListGroupItem>
                        </ListGroup>

                      </Card>}
                    
                </CardColumns>
              </div>
            </div>

            {payObj !== -1 && <PaymentDialog objective={G.pubObjectives[payObj]} race={race} planets={PLANETS} isOpen={payObj !== -1} toggle={(e, payment)=>togglePaymentDialog(payment)}/>}
          </>)
}
/*
{ctx.currentPlayer == playerID && ctx.numMoves > 0 && <button style={{width: '5rem', height: '1.2rem', fontSize: '0.7rem'}} onClick={() => undo()}>Undo move</button>} <br/>
*/

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
      case 'dock':
        s += 'd' + units[k];
        break;
      default:
        s += '';
    }
  });
  return s;
}

