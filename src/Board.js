/* eslint eqeqeq: 0 */
import { Stage, Graphics, Text, Container, Sprite } from '@pixi/react';
//import { HexGrid } from './Grid';
import { useMemo, useCallback, useState } from 'react';
import { Navbar, Nav, NavItem, Button, Card, CardImg, CardText, CardTitle, 
  /*CardSubtitle,*/ CardColumns, CardBody, ListGroup, ListGroupItem,
  Container as Cont, Row, Col, Badge, ButtonGroup } from 'reactstrap';
import { PaymentDialog } from './payment';
import { PixiViewport } from './viewport';
import techData from './techData.json';

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

  /*const VPs = useMemo(()=>{
    const players = [];

    if(G.pubObjectives && G.pubObjectives.length){
      G.pubObjectives.forEach( v => {
        if(v.players && v.players.length){
          v.players.forEach(p => players[p] ? players[p]++ : players[p]=1 )
        }
      });

      return ctx.playOrder.map( o => ' player ' + o + ' vp: ' + (players[o] ? players[o]:0));
    }
  }, [G.pubObjectives, ctx.playOrder]);*/

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
  const [showUnit, setShowUnit] = useState('CARRIER');
  const [abilVisible, setAbilVisible] = useState(0);
  const isMyTurn = useMemo(() => ctx.currentPlayer == playerID, [ctx.currentPlayer, playerID]);
  const ALL_UNITS = techData.filter((t) => t.type === 'unit' && !t.upgrade);

  const CARD_STYLE = {background: 'none', border: 'solid 1px rgba(74, 111, 144, 0.42)', padding: '1rem', marginBottom: '1rem'}
  const TOKENS_STYLE = { display: 'flex', width: '30%', borderRadius: '5px', alignItems: 'center', flexFlow: 'column', padding: '.15rem', background: 'none', margin: '.5rem', border: '1px solid rgba(74, 111, 144, 0.42)', color: 'white'}

//onClick={stageOnclick} onContextMenu={stageOncontext}
//{ctx.gameover && <div>{'Player ' + ctx.gameover.winner + ' wins'}</div>}
  return (<>
            <Navbar style={{ position: 'fixed', height: '3rem', width: '70%'}}>
              <div style={{display: 'flex'}}>
                <Nav style={{marginRight: '2rem'}}>
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
              <Nav style={{float: 'right'}}>
                <NavItem style={{marginRight: '1rem'}}>
                  <Button disabled={!isMyTurn || ctx.numMoves == 0} color='dark' style={{marginLeft: '1rem'}} onClick={() => undo()}>Undo</Button></NavItem>
                <NavItem style={{marginRight: '1rem'}}>
                  <Button color='light' outline={!tilesPng} onClick={()=>setTilesPng(!tilesPng)}>Tiles</Button>
                </NavItem>
                <NavItem style={{marginRight: '1rem'}}>
                  <Button color='light' outline={!tilesTxt} onClick={()=>setTilesTxt(!tilesTxt)}>Text</Button>
                </NavItem>
              </Nav>
            </Navbar>
            
            <CardColumns style={{margin: '5rem 1rem 1rem 1rem', padding:'1rem', position: 'fixed', width: '30rem'}}>

              {objVisible && <Card style={{ ...CARD_STYLE, backgroundColor: 'rgba(74, 111, 144, 0.42)'}}>
              <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Public objectives</h6></CardTitle>
              
                <ListGroup style={{maxHeight: '30rem', overflowY: 'auto', border: 'none', paddingRight: '1rem'}}>
                {G.pubObjectives && G.pubObjectives.length &&
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
              </Card>}
            
              {techVisible && <Card style={{ ...CARD_STYLE, backgroundColor: 'rgba(74, 111, 144, 0.42)'}}>
                <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Technologies map</h6></CardTitle>
                  <ListGroup style={{border: 'none'}}>
                    {race && race.knownTechs.map((t, i) => <ListGroupItem key={i} style={{background: 'none', border: 'none', color: 'white'}}>{t.toLowerCase().replaceAll('_', ' ')}</ListGroupItem>)}
                  </ListGroup>
              </Card>}

              {planetsVisible && <Card style={{ ...CARD_STYLE, backgroundColor: 'rgba(74, 111, 144, 0.42)'}}>
                <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Planets</h6></CardTitle>
                  <div style={{maxHeight: '30rem', overflowY: 'auto', paddingRight: '1rem'}}>
                  <Cont style={{border: 'none'}}>
                    {PLANETS.map((p,i) => {
                      let trait;
                      if(p.trait) trait = <img alt='trait' style={{width: '1.5rem'}} src={'icons/' + p.trait + '.png'}/>;
                      let specialty;
                      if(p.specialty) specialty = <img alt='specialty' style={{width: '1.5rem'}} src={'icons/' + p.specialty + '.png'}/>;
                      
                      return (<Row className='hoverable' key={i} style={{cursor: 'default', fontSize: '1.25rem', lineHeight: '2.2rem', height: '2.5rem', opacity: p.exhausted ? '.25':'1', color: 'white'}}>
                                <Col xs='6'>{p.legendary ? <img alt='legendary' style={{width: '1.5rem'}} src={'icons/legendary_complete.png'}/>:'' } {p.name}</Col>
                                <Col xs='1' style={{padding: 0}}>{specialty}</Col>
                                <Col xs='1' style={{padding: 0}}>{trait}</Col>
                                <Col xs='1' style={{background: 'url(icons/resources_bg.png)', backgroundRepeat: 'no-repeat', backgroundSize: 'contain'}}><b style={{paddingLeft: '0.1rem'}}>{p.resources}</b></Col>
                                <Col xs='1'/>
                                <Col xs='1' style={{background: 'url(icons/influence_bg.png)', backgroundRepeat: 'no-repeat', backgroundSize: 'contain'}}><b>{p.influence}</b></Col>
                                <Col xs='1'/>
                              </Row>)
                    })}
                  </Cont>
                  </div>
              </Card>}

              {unitsVisible && <Card style={{...CARD_STYLE, backgroundColor: 'rgba(74, 111, 144, 0.42)'}}>
                <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Units</h6></CardTitle>
                <div style={{display: 'flex'}}>
                  <div style={{display:'flex', flexFlow:'column', width: '10rem', border: 'none'}}>
                    {ALL_UNITS.map((u, i) => <Button key={i} size='sm' color='dark' onClick={()=>setShowUnit(u.id)}>{u.id}</Button>)}
                  </div>
                  <div style={{padding: '1rem'}}>
                    <CardImg src={'units/' + showUnit + '.png'} />
                  </div>
                </div>
              </Card>}



            </CardColumns>

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

            <div style={{ display: 'flex', flexDirection: 'column', position:'fixed', right: 0, top: 0, backgroundColor: 'rgba(74, 111, 144, 0.42)', height: '100%', width: '25%' }}>
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
                  {race && race.strategy && 'Strategy: ' + race.strategy.id}
                  {race && race.strategy && race.strategy.exhausted && ' (exhausted)'}
                  {race && <Card style={CARD_STYLE}>
                    <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Command tokens</h6></CardTitle>

                      <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center'}}>
                        <ListGroupItem className='hoverable' tag='button' style={TOKENS_STYLE} onClick={()=>ctx.phase === 'acts' && moves.activateTile()}><h6 style={{fontSize: 50}}>{race.tokens.t}</h6><b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>tactic</b></ListGroupItem>
                        <ListGroupItem tag='button' style={TOKENS_STYLE}><h6 style={{fontSize: 50}}>{race.tokens.f}</h6><b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>fleet</b></ListGroupItem>
                        <ListGroupItem tag='button' style={TOKENS_STYLE}><h6 style={{fontSize: 50}}>{race.tokens.s}</h6><b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%'}}>strategic</b></ListGroupItem>
                      </ListGroup>

                    </Card>}
                  
              </CardColumns>
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

