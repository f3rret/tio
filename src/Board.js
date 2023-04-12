/* eslint eqeqeq: 0 */
import { Stage, Graphics, Text, Container } from '@pixi/react';
import { HexGrid } from './Grid';
import { useMemo, useCallback, useState } from 'react';
import { Navbar, Nav, NavItem } from 'reactstrap';
import { PaymentDialog } from './payment';

export function TIOBoard({ ctx, G, moves, events, undo, playerID }) {
  const stagew = window.innerWidth;
  const stageh = window.innerHeight;

  const stageOnclick = (e) => {
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
  }

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
            arr.push(p);
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
        g.lineStyle(2,  'yellow');
      }
      else if(element.selected === true){
        g.beginFill('lightblue', .15);
        g.lineStyle(2,  'lightblue');
      }
      else{
        g.lineStyle(1,  0x999999);
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

  return (<>
            <Navbar style={{ position: 'fixed', height: '3rem'}}>
              <Nav navbar>
                <NavItem onClick={()=>setObjVisible(!objVisible)} style={{cursor: 'pointer'}}>
                  <h4>Objectives</h4>
                </NavItem>
              </Nav>
            </Navbar>
            
            {objVisible && <div style={{ margin: '5rem 1rem 1rem 1rem', padding:'1rem', position: 'fixed', backgroundColor: 'rgba(74, 111, 144, 0.42)'}}>
              {ctx.gameover && <div>{'Player ' + ctx.gameover.winner + ' wins'}</div>}
              {G.pubObjectives && G.pubObjectives.length &&
              <div id='public_objectives'>
                <h4>Public objectives:</h4><br />
                {G.pubObjectives.map((o, i) => {
                  const complete = o.players.indexOf(playerID) > -1;
                  return <li style={{padding: '1rem', cursor: complete ? 'default':'pointer', backgroundColor: complete ? 'rgba(154, 205, 50, 0.25)':'rgba(255, 100, 0, 0.25)' }} key={i} onClick={(e) => {if(!complete)completePubObj(e, i)}}>
                    <b style={{fontSize: '0.7rem'}}>{o.id}</b>{' [ '}{o.players.map((p, pi) => <b key={pi}>{p}</b>)}{' ]  '}
                    <br/>
                    <i style={{fontSize: '0.7rem'}}>{o.title}</i>
                  </li>})
                }
              </div>
              }
            </div>}
            

            <Stage width={stagew} height={stageh} onClick={stageOnclick} onContextMenu={stageOncontext} options={{ resizeTo: window, antialias: true, autoDensity: true, backgroundColor: 0xeef1f5 }}>
                <Graphics draw={draw}/>
                
                {G.tiles.map((element, index) => {
                    const [firstCorner] = element.corners;
                    const fill = element.tdata.type;
                    
                    return <Container key={index}>
                            <Text style={{fontSize: 10}} text={"(" + element.q + "," + element.r + ")"} x={firstCorner.x + stagew/2 - element.w/2} y={firstCorner.y + stageh/2}/>
                            <Text style={{fontSize: 10, fill: fill}} text={ element.tid } x={firstCorner.x + stagew/2 - element.w/4} y={firstCorner.y + stageh/2}/>
                            { element.tdata.occupied!==undefined && <Text style={{fontSize: 12, fill: 'green'}} 
                              text={element.tdata.occupied + ':' + (element.tdata.fleet ? getUnitsString(element.tdata.fleet) : '-')} 
                              x={firstCorner.x + stagew/2 - element.w/2} y={firstCorner.y + stageh/2 + element.w/1.5} /> }
                            { element.tdata.planets.map( (p, i) => 
                                <Text key={i} 
                                text={ p.name + ' ' + p.resources + '/' + p.influence + 
                                (p.occupied !== undefined ? ' [' + p.occupied + ':' + (p.units ? getUnitsString(p.units) : '-') + ']':'') } 
                                style={{ fontSize: 10, fill: 'grey' }} 
                                x={firstCorner.x + stagew/2 - element.w/1.5} y={firstCorner.y + stageh/2 + element.w/6 + element.w/8 * (i+1)} />
                              )}
                            
                          </Container>
                  })}
                
            </Stage>

            <div style={{ display: 'flex', flexDirection: 'column', position:'fixed', right: 0, top: 0, backgroundColor: 'rgba(74, 111, 144, 0.42)', height: '100%', width: '30%' }}>
              <div style={{ margin: '1rem' }}>
                  {'Player ' + ctx.currentPlayer + ' turns '} 
                  {ctx.currentPlayer == playerID && ctx.numMoves > 0 && <button style={{width: '5rem', height: '1rem', fontSize: '0.7rem'}} onClick={() => undo()}>Undo move</button>} <br/>
                  {race && 'Race id: ' + race.rid + ' name: ' + race.name} <br/>
                  {race && race.strategy && 'Strategy: ' + race.strategy.id}
                  {race && race.strategy && race.strategy.exhausted && ' (exhausted)'} <br/>
                  {race && 'Command tokens: ' + race.tokens.t + '/' + race.tokens.f + '/' + race.tokens.s + (race.tokens.new ? ' +'+race.tokens.new : '')} <br/><br/>
                  {'Planets: '} <br/>
                  {PLANETS.map((p,i) => <li key={i}>{p.name + ' ' + p.resources + '/' + p.influence}</li>)} <br/>
                  {'Units: '} <br/>
                  {Object.keys(UNITS).map((k, i) => <li key={i}>{k + ': ' + UNITS[k]}</li>)} <br/>
                  {'Technologies: '} <br/>
                  {race && race.knownTechs.map((t, i) => <li key={i}>{t.toLowerCase().replaceAll('_', ' ')}</li>)} <br/>
              </div>
            </div>

            {payObj !== -1 && <PaymentDialog objective={G.pubObjectives[payObj]} race={race} planets={PLANETS} isOpen={payObj !== -1} toggle={(e, payment)=>togglePaymentDialog(payment)}/>}
          </>)
}
/*

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

