/* eslint eqeqeq: 0 */
import { Stage, Graphics, Text, Container } from '@pixi/react';
import { HexGrid } from './Grid';
import { useMemo, useCallback } from 'react';

export function TIOBoard({ ctx, G, moves, events, undo, playerID }) {
  const stagew = 800
  const stageh = 800

  const stageOnclick = (e) => {
    const x = e.clientX - stagew/2;
    const y = e.clientY - stageh/2;
    const hex = HexGrid.pointToHex({x, y}, {allowOutside: false});

    if(hex){
      G.tiles.forEach((v, i) => {
        if(v.q === hex.q && v.r === hex.r){
          //moves.captureTile(i)
          //events.setStage({ stage: 'tileView' });
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

  const WIN_POINTS = useMemo(()=>{
    const players = [];
    G.activeGoals.forEach( v => {
      if(v.players.length){
        v.players.forEach(p => players[p] ? players[p]++ : players[p]=1 )
      }
    });

    return ctx.playOrder.map( o => ' player ' + o + ' wp: ' + (players[o] ? players[o]:0));
  }, [G.activeGoals, ctx.playOrder]);

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
  }, [G.tiles]);

  const race = useMemo(() => G.races[playerID], [G.races, playerID]);

  return (<div style={{ display: 'flex' }}>
            <Stage width={stagew} height={stageh} onClick={stageOnclick} onContextMenu={stageOncontext}
              options={{ antialias: true, autoDensity: true, backgroundColor: 0xeef1f5 }}>
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
                
                <Graphics draw={draw}/>
            </Stage>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ margin: '1rem' }}>
                {ctx.gameover && <div>{'Player ' + ctx.gameover.winner + ' wins'}</div>}
                {'Active goals: ' + G.activeGoals.length }<br />
                {WIN_POINTS.map((wp, i) => <div key={i}>{wp}<br/></div>)}
              </div>
            
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
                  {race && race.technologies.map((t, i) => <li key={i}>{t.toLowerCase().replaceAll('_', ' ')}</li>)} <br/>
              </div>
            </div>
          </div>)
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
      case 'dock':
        s += 'd' + units[k];
        break;
      default:
        s += '';
    }
  });
  return s;
}


