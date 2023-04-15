/* eslint eqeqeq: 0 */
import { Stage, Graphics, Text, Container, Sprite } from '@pixi/react';
//import { HexGrid } from './Grid';
import { useMemo, useCallback, useState } from 'react';
import { Navbar, Nav, NavItem, Button, Card, CardImg, CardText, CardTitle, 
  /*CardSubtitle,*/ CardColumns, CardBody, ListGroup, ListGroupItem } from 'reactstrap';
import { PaymentDialog } from './payment';
import { PixiViewport } from './viewport';

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
  const [objVisible, setObjVisible] = useState(true);
  const [techVisible, setTechVisible] = useState(false);
  const [tilesPng, setTilesPng] = useState(true);
  const [tilesTxt, setTilesTxt] = useState(true);
  const isMyTurn = useMemo(() => ctx.currentPlayer == playerID, [ctx.currentPlayer, playerID]);

  const CARD_STYLE = {background: 'none', border: 'solid 1px rgba(74, 111, 144, 0.42)', padding: '1rem', marginBottom: '1rem'}
  const TOKENS_STYLE = { display: 'flex', flex: 'auto', alignItems: 'center', flexFlow: 'column', padding: '.15rem', background: 'none', margin: '.5rem', border: '1px solid rgba(74, 111, 144, 0.42)', color: 'white'}

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
              <Nav>
                <NavItem onClick={()=>setTechVisible(!techVisible)} style={{cursor: 'pointer'}}>
                  <h5>Technologies</h5>
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
              
                <ListGroup style={{maxHeight: '30rem', overflowY: 'scroll', border: 'none'}}>
                {G.pubObjectives && G.pubObjectives.length &&
                  G.pubObjectives.map((o, i) => {
                    const complete = o.players.indexOf(playerID) > -1;
                    return <ListGroupItem 
                              style={{padding: '1rem', cursor: complete ? 'default':'pointer', 
                                background: complete ? 'rgba(154, 205, 50, 0.25)':'none', color: 'white', border: 'none' }} 
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
                    <CardImg src={'race/'+race.rid+'.png'} style={{opacity: .95, width: '205px'}}/>
                    <CardBody>
                      <CardText></CardText>
                    </CardBody></Card>}
                  {race && race.strategy && 'Strategy: ' + race.strategy.id}
                  {race && race.strategy && race.strategy.exhausted && ' (exhausted)'}
                  {race && <Card style={CARD_STYLE}>
                    <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Command tokens</h6></CardTitle>

                      <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center'}}>
                        <ListGroupItem tag='button' style={{...TOKENS_STYLE, border: 'none', margin: 0}} onClick={()=>ctx.phase === 'acts' && moves.activateTile()}>
                          <img alt='race icon' className='tokenButton' src={'race/icons/' + race.rid + '.png'} />
                        </ListGroupItem>
                        <ListGroupItem style={TOKENS_STYLE}><h6 style={{fontSize: 50}}>{race.tokens.t}</h6><b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%', padding: '0 1.25rem', fontSize: '.9rem'}}>tactic</b></ListGroupItem>
                        <ListGroupItem style={TOKENS_STYLE}><h6 style={{fontSize: 50}}>{race.tokens.f}</h6><b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%', padding: '0 1.5rem', fontSize: '.9rem'}}>fleet</b></ListGroupItem>
                        <ListGroupItem style={TOKENS_STYLE}><h6 style={{fontSize: 50}}>{race.tokens.s}</h6><b style={{backgroundColor: 'rgba(74, 111, 144, 0.25)', width: '100%', padding: '0 .5rem', fontSize: '.9rem'}}>strategic</b></ListGroupItem>
                      </ListGroup>

                    </Card>}
                  
                  <Card style={CARD_STYLE}>
                    <CardTitle style={{borderBottom: '1px solid rgba(74, 111, 144, 0.42)'}}><h6>Units</h6></CardTitle>
                    <ListGroup style={{border: 'none'}}>
                    {Object.keys(UNITS).map((k, i) => <ListGroupItem key={i} style={{background: 'none', border: 'none', color: 'white'}}>{k + ': ' + UNITS[k]}</ListGroupItem>)}
                    </ListGroup>
                  </Card>
                  {'Planets: '} <br/>
                  {PLANETS.map((p,i) => {
                    return <li key={i} style={{padding: '.5rem', width: '20rem', backgroundColor: (p.exhausted === true ? 'rgba(74, 111, 144, 0.42)':'')}}>
                            {p.name + ' ' + p.resources + '/' + p.influence + (p.trait ? ' ['+p.trait+']' : '') + (p.specialty ? ' ['+p.specialty+']' : '')}</li>
                  })}
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

