/* eslint eqeqeq: 0 */
import { INVALID_MOVE, TurnOrder } from 'boardgame.io/core';
import { HexGrid, neighbors } from './Grid';
import tileData from './tileData.json';
import raceData from './raceData.json';
import techData from './techData.json';
import cardData from './cardData.json';
import { produce } from 'immer';
import { getPlayerUnits, getPlayerPlanets } from './utils';
 
export const TIO = {
    
    setup: () => {
      const tiles = HexGrid.toArray().map( h => ({ tid: h.tileId, /*blocked: [],*/ tdata: tileData.all[h.tileId], q: h.q, r: h.r, w: h.width, corners: h.corners}) );
      const races = HexGrid.toArray().map( h => ({ rid: h.tileId }))
                  .filter( i => tileData.green.indexOf(i.rid) > -1 )
                  .map( r => ({...r, ...raceData[r.rid], tg: 10, tokens: { t: 3, f: 3, s: 2}}) );

      tiles.forEach( (t, i) => {
        if( t.tdata.type === 'green' ){
          tiles[i].tdata = produce(tiles[i].tdata, draft => {
            const idx = races.findIndex(r => r.rid === t.tid);
            draft.occupied = idx;

            for( let j=0; j < draft.planets.length; j++ ){
              draft.planets[j].occupied = idx;
            }
            if(races[idx].startingUnits){
              draft.fleet = races[idx].startingUnits.fleet;
              draft.planets[0].units = races[idx].startingUnits.ground;
            }
          });
        }
      });

      return { 
        tiles,
        pubObjectives: [],
        passedPlayers: [],
        races
      }
    },

    phases: {
      strat: {
        //start: true,
        next: 'acts',
        turn: {
          order: TurnOrder.ONCE,
          minMoves: 1,
          maxMoves: 1
        },
        moves: {
          pickStrategy: ({G, playerID, events}, sid) => {
            if(!cardData.strategy[sid]){
              console.log('invalid card');
              return INVALID_MOVE;
            }

            if(G.races.find( r => r.strategy && r.strategy.id === sid)){
              console.log('already picked');
              return INVALID_MOVE;
            }

            G.races[playerID].strategy = { id: sid };
            events.endTurn();
          }
        },
        onBegin: ({ G, ctx, random }) => {
          G.races.forEach( r => r.strategy = undefined );

         //obj
        },
        onEnd: ({ G, random }) => {}
      },
      stats: {

        next: 'strat',
        turn: {
          order: TurnOrder.ONCE,
          /*minMoves: 1,
          maxMoves: 1*/
        },
        moves: {
          completePublicObjective: ({G, playerID, events}, oid, payment) => {
            
            if(G.pubObjectives[oid] && G.pubObjectives[oid].players.indexOf(playerID) === -1){
              const req = G.pubObjectives[oid].req;
              const race = G.races[playerID];
              const planets = getPlayerPlanets(G.tiles, playerID);
              
              if(G.pubObjectives[oid].type === 'SPEND'){
                const rkeys = Object.keys(req);

                if(rkeys.indexOf('token') > -1){
                  if(race.tokens && payment.tokens){
                    race.tokens.t -= payment.tokens.t;
                    race.tokens.s -= payment.tokens.s;
                  }
                }
                else{
                  if(req.influence && payment.influence){
                    if(payment.influence.planets){
                      payment.influence.planets.forEach( p => {
                        const tile = G.tiles.find( t => t.tid === p.tid);
                        tile.tdata.planets.find( pl => pl.name === p.name).exhausted = true; 
                      });
                    }
                    if(payment.influence.tg) race.tg -= payment.influence.tg;
                  }
                  if(req.resources && payment.resources){
                    if(payment.resources.planets) payment.resources.planets.forEach( p => {
                        const tile = G.tiles.find( t => t.tid === p.tid);
                        tile.tdata.planets.find( pl => pl.name === p.name).exhausted = true; 
                    });
                    if(payment.resources.tg) race.tg -= payment.resources.tg;
                  }
                  if(req.tg && payment.tg){
                    race.tg -= payment.tg;
                  }
                }           

                G.pubObjectives[oid].players.push(playerID);
              }
              else if(G.pubObjectives[oid].type === 'HAVE'){

                const units = getPlayerUnits(G.tiles, playerID);
                
                if(req.unit && Array.isArray(req.unit)){
                  if(req.squadron){
                    let systems = G.tiles.filter( s => s.tdata.occupied == playerID && s.tdata.fleet && Object.keys(s.tdata.fleet).length > 0 );

                    const goal = systems.some( s => {
                      let sum = 0;
                      Object.keys(s.tdata.fleet).forEach( k => {
                        if(req.unit.indexOf(k) > -1) sum += s.tdata.fleet[k];
                      });
                      return sum >= req.squadron;
                    });

                    if(goal == 0){
                      return;
                    }
                  }
                  else{
                    let sum = 0;
                    req.unit.forEach(u => { if(units[u]) { sum += units[u] } });
                    if(sum < req.count) return;
                  }
                }
                else if(req.trait){
                  const traits = {'industrial': 0, 'cultural': 0, 'hazardous': 0};

                  planets.forEach(p => {
                    if(p.trait && traits[p.trait] !== undefined){
                      traits[p.trait]++;
                    }
                  });

                  if(traits['industrial'] < req.trait && traits['cultural'] < req.trait && traits['hazardous'] < req.trait){
                    return;
                  }
                }
                else if(req.upgrade){
                  const upgrades = race.knownTechs.filter(t => {
                    const tech = techData.find(td => td.id === t);
                    return tech.type === 'unit' && tech.upgrade === true
                  });
                  if(upgrades.length < req.upgrade){
                    return;
                  }
                }
                else if(req.attachment){
                  let sum = 0;
                  planets.forEach(p => {
                    if(p.attachment) sum++;
                  });

                  if(sum < req.attachment){
                    return;
                  }
                }
                else if(req.technology){
                  const colors = {'biotic': 0, 'warfare': 0, 'cybernetic': 0, 'propulsion': 0};
                  race.knownTechs.forEach(t => {
                    const tech = techData.find(td => td.id === t);
                    if(colors[tech.type] !== undefined){ colors[tech.type]++; }
                  });

                  let goals = 0;
                  Object.keys(colors).forEach(c => {
                    if(colors[c] >= parseInt(req.technology.count)) goals++;
                  });

                  if(goals < parseInt(req.technology.color)){
                    return;
                  }
                }
                else if(req.planet){
                  let result = planets;
                  if(req.nhs){
                    result = result.filter( p => p.tid != race.rid );
                  }
                  if(req.ground){
                    result = result.filter( p => p.units && Object.keys(p.units).some( key => req.ground.indexOf(key) > -1));
                  }

                  if(result.length < req.planet){
                    return;
                  }
                }
                else if(req.system){
                  let systems = G.tiles.filter( t => t.tdata.occupied === playerID || (t.tdata.planets && t.tdata.planets.some( p => p.occupied === playerID)) );
                  if(req.fleet && req.ground){
                    systems = systems.filter( s => 
                      (s.tdata.fleet && Object.keys(s.tdata.fleet).length > 0) || 
                      (s.tdata.planets && s.tdata.planets.length && s.tdata.planets.some( p => p.occupied === playerID && p.units && p.units.length ))
                    );
                  }
                  else if(req.fleet){
                    systems = systems.filter( s => s.tdata.fleet && Object.keys(s.tdata.fleet).length > 0 );
                  }

                  if(req.noPlanet){
                    systems = systems.filter( s => s.tdata.planets.length == 0);
                  }
                  if(req.adjacentMR){
                    systems = systems.filter( s => (s.q >= -1 && s.q <= 1) && (s.r >=-1 && s.q <= -1) && !(s.r == 0 && s.q == 0));
                  }
                  if(req.MR && req.legendary && req.anomaly){
                    systems = systems.filter( s => s.tid == 18 || [65, 66, 82].indexOf(s.tid) > -1 || tileData.anomaly.indexOf(s.tid) > -1);
                  }
                  if(req.edge){
                    systems = systems.filter( s => neighbors([s.q, s.r]).toArray().length < 6);
                  }

                  if(systems.length < req.system){
                    return;
                  }
                }
                else if(req.specialty){
                  let sum = 0;
                  planets.forEach(p => {
                    if(p.specialty) sum++;
                  });

                  if(sum < req.specialty){
                    return;
                  }
                }
                else if(req.neighbor){
                  let systems = G.tiles.filter( t => t.tdata.occupied === playerID || (t.tdata.planets && t.tdata.planets.some( p => p.occupied === playerID)) );
                  let neighbors = [];

                  systems.forEach( s => neighbors([s.q, s.r]).forEach( n => {
                    if(n.tdata.occupied !== undefined && n.tdata.occupied !== playerID){
                      if(neighbors.indexOf(n.tdata.occupied) === -1) neighbors.push(n.tdata.occupied);
                    }
                    else if(n.tdata.planets){
                      n.tdata.planets.forEach( p => { if(p.occupied !== undefined && p.occupied !== playerID){ 
                        if(neighbors.indexOf(n.tdata.occupied) === -1) neighbors.push(p.occupied) 
                      } })
                    }
                  }));

                  if(neighbors.length < req.neighbor){
                    return;
                  }

                  let goals = 0;

                  if(req.more === 'planet'){
                    neighbors.forEach( n => {
                      const pl = getPlayerPlanets(G.tiles, n);
                      if(pl.length < planets.length) goals++;
                    });
                  }

                  if(goals < req.neighbor){
                    return;
                  }
                }


                G.pubObjectives[oid].players.push(playerID);
              }
              else{
                return;
              }

              
            }
            events.endTurn();
          }
        },
        onBegin: ({ G, random }) => {
          G.passedPlayers = [];
          //return {...G, passedPlayers: []}
        },
        onEnd: ({ G }) => {
          //add new random public objective
        }
      },
      acts: {
        start: true,
        next: 'stats',
        turn: {
            /*minMoves: 1,
            maxMoves: 1,*/
            stages: {
              strategyCard: {
                minMoves: 0,
                maxMoves: 1,
                moves: {
                  joinStrategy: ({ G, playerID }) => {
                    
                    switch(G.strategy){
                      case 'LEADERSHIP':
                        G.races[playerID].tokens.new = 1;
                        break;
                      case 'DIPLOMACY':
                        break;
                      case 'POLITICS':
                          break;
                      case 'CONSTRUCTION':
                        break;
                      case 'TRADE':
                        break;
                      case 'WARFARE':
                        break;
                      case 'TECHNOLOGY':
                        break;
                      case 'IMPERIAL':
                        break;
                      default:
                        break;
                    }
                    
                  },
                  passStrategy: ({ events }) => {
                    
                  }
                }
              },
            },
            onBegin: ({ G, ctx }) => {
              G.tiles.forEach( t => t.active = false);
              G.races[ctx.currentPlayer].actions = [];
            },
            onMove: ({ G, ctx }) => {
              
            },
            onEnd: ({G}) => {
              G.strategy = undefined;
            }
        },
        moves: {
          useStrategy: ({ G, events, playerID}) => {
            if(G.races[playerID].actions.length > 0){
              console.log('too many actions');
              return INVALID_MOVE;
            }

            const strategy = G.races[playerID].strategy;
            if(!strategy || strategy.exhausted){
              console.log('strategy card exhausted');
              return INVALID_MOVE;
            }

            switch(strategy.id){
              case 'LEADERSHIP':
                G.races[playerID].tokens.new = 3;
                break;
              case 'DIPLOMACY':
                break;
              case 'POLITICS':
                  break;
              case 'CONSTRUCTION':
                break;
              case 'TRADE':
                break;
              case 'WARFARE':
                break;
              case 'TECHNOLOGY':
                break;
              case 'IMPERIAL':
                break;
              default:
                break;
            }

            strategy.exhausted = true;
            G.strategy = strategy.id;
            G.races[playerID].actions.push('STRATEGY_CARD');

            events.setActivePlayers({ others: 'strategyCard', minMoves: 1, maxMoves: 1 });
          },
          selectTile: ({ G }, tid) => {
            if(G.tiles[tid].selected === true){
              G.tiles[tid].selected = false;
            }
            else{
              G.tiles.forEach(t => t.selected = false);
              G.tiles[tid].selected = true;
            }
          },
          uploadUnits: ({ G, playerID }, planetId) => {

            const tile = G.tiles.find(t => t.selected === true);
            if( !tile ){
              console.log('no fleet');
              return INVALID_MOVE;
            }

            const pid = planetId || 0;

            if( tile.tdata.occupied != playerID ){
              console.log('not fleet owner');
              return INVALID_MOVE;
            }

            if(tile.tdata.fleet && tile.tdata.fleet.carrier > 0){
              if(tile.tdata.planets && tile.tdata.planets[pid] && tile.tdata.planets[pid].units){
                
                if( tile.tdata.planets[pid].occupied != playerID ){
                  console.log('not planet owner');
                  return INVALID_MOVE;
                }

                const units = tile.tdata.planets[pid].units;
                const fleet = tile.tdata.fleet;

                Object.keys(units).forEach(u => {
                  if( u === 'infantry' || u === 'mech' ){
                    if(!fleet[u]) fleet[u] = 0;
                    fleet[u] += units[u];
                    delete units[u];
                  }
                });
              }
              else{
                console.log('no units');
              }
            }
            else{
              console.log('no transport');
            }

          },
          downloadUnits: ({ G, playerID }, planetId) => {

            let tile = G.tiles.find(t => t.active === true);
            if(!tile){
              tile = G.tiles.find(t => t.selected === true);
            }
            const pid = planetId || 0;

            if(tile.tdata.occupied != playerID){
              console.log('not fleet owner');
              return INVALID_MOVE;
            }

            if(tile.tdata.fleet && tile.tdata.fleet.carrier > 0){

              if(tile.tdata.planets && tile.tdata.planets[pid]){
                if(!tile.tdata.planets[pid].units){
                  tile.tdata.planets[pid].units = {};
                }

                const fleet = tile.tdata.fleet;
                const units = tile.tdata.planets[pid].units;

                if( tile.tdata.planets[pid].occupied == playerID ){
                  Object.keys(fleet).forEach(u => {
                    if( u === 'infantry' || u === 'mech' ){

                      if(!units[u]){
                        units[u] = 0;
                      }

                      units[u] += fleet[u];
                      delete fleet[u];
                    }
                  });
                }
                else{
                  Object.keys(fleet).forEach(u => {
                    if( u === 'infantry' || u === 'mech' ){
                      if(!units[u]){
                        units[u] = 0;
                      }

                      if(units[u] === fleet[u]){
                        delete units[u];
                        delete fleet[u];  
                      }
                      else if(units[u] < fleet[u]){
                        fleet[u] -= units[u];
                        delete units[u];
                      }
                      else {
                        units[u] -= fleet[u];
                        delete fleet[u];
                      }
                    }
                  });

                  if(units['infantry'] > 0 || units['mech'] > 0){
                    console.log('retreat');
                    return;
                  }

                  if(fleet['infantry'] > 0 || fleet['mech'] > 0){
                    if(fleet['infantry']){
                      units['infantry'] = fleet['infantry'];
                      delete fleet['infantry'];
                    }
                    if(fleet['mech']){
                      units['mech'] = fleet['mech'];
                      delete fleet['mech'];
                    }
                    delete units['pds'];
                    delete units['dock'];

                    tile.tdata.planets[pid].occupied = playerID;
                  }
                }
              }
              else{
                console.log('no planet');
              }

            }
            else{
              console.log('no transport');
            }

          },
          activateTile: ({ G, playerID }, id) => {

            if(G.races[playerID].tokens.t <= 0){
              console.log('not enough tokens');
              return INVALID_MOVE;
            }

            if(G.races[playerID].actions.length > 0){
              console.log('too many actions');
              return INVALID_MOVE;
            }

            let tile;
            if(id !== undefined){
              tile = G.tiles[id];
            }
            else{
              tile = G.tiles.find(t => t.selected === true);
            }

            if(tile){
              tile.active = !tile.active;
            }
            else{
              console.log('no tile selected');
              return INVALID_MOVE;
            }

            if(tile.active){
              G.races[playerID].tokens.t--;
              G.races[playerID].actions.push('TILE_ACTIVATE');
            }

          },
          moveFleet: ({ G, playerID }, squadron) => {
            const dst = G.tiles.find( t => t.active === true );
            const src = G.tiles.find( t => t.selected === true );

            if(!src.tdata.fleet){
              console.log('no fleet');
              return INVALID_MOVE;
            }

            if(src.tdata.occupied != playerID){
              console.log('not fleet owner');
              return INVALID_MOVE;
            }

            if(!dst.tdata.occupied){
              dst.tdata.occupied = playerID;
            }
            
            if(!squadron){
              squadron = src.tdata.fleet;
              src.tdata.fleet = {};
            }
            else{
              Object.keys(squadron).forEach( s => {
                if(!src.tdata.fleet[s]){
                  delete squadron[s];
                  return;
                }
                else if(src.tdata.fleet[s] < squadron[s]){
                  squadron[s] = src.tdata.fleet[s];
                }

                src.tdata.fleet[s] -= squadron[s];
                if(src.tdata.fleet[s] < 1){
                  delete src.tdata.fleet[s];
                }
              });
            }

            if(!src.tdata.fleet || !Object.keys(src.tdata.fleet).length){
              src.tdata.occupied = undefined;
            }

            if(dst.tdata.occupied != playerID){
              Object.keys(squadron).forEach( u => {
                if(!dst.tdata.fleet[u]){
                  dst.tdata.fleet[u] = 0;
                }

                if(squadron[u] === dst.tdata.fleet[u]){
                  delete squadron[u];
                  delete dst.tdata.fleet[u];
                }
                else if(squadron[u] < dst.tdata.fleet[u]){
                  dst.tdata.fleet[u] -= squadron[u];
                  delete squadron[u];
                }
                else{
                  squadron[u] -= dst.tdata.fleet[u];
                  delete dst.tdata.fleet[u];
                }
              });

              if(dst.tdata.fleet && Object.keys(dst.tdata.fleet).length > 0){
                return;
              }
              else{
                dst.tdata.fleet = squadron;
                dst.tdata.occupied = playerID;
              }
            }
            else{
              if(!dst.tdata.fleet){
                dst.tdata.fleet = {};
              }

              Object.keys(squadron).forEach( u => {
                if(!dst.tdata.fleet[u]){
                  dst.tdata.fleet[u] = 0;
                }
                dst.tdata.fleet[u] += squadron[u];
              });
            }

          },
          produceUnits: ({ G, playerID }, units, planetId) => {

            const tile = G.tiles.find( t => t.active === true);
            const pid = planetId || 0;

            if(!tile){
              console.log('no active tile');
              return INVALID_MOVE;
            }

            if(tile.tdata.occupied != playerID){
              console.log('not owner');
              return INVALID_MOVE;
            }

            if(!units){
              console.log('no units');
              return INVALID_MOVE;
            }

            if(!tile.tdata.planets[pid] || !tile.tdata.planets[pid].units || !tile.tdata.planets[pid].units.dock){
              console.log('no production unit');
              return INVALID_MOVE;
            }

            const fleet = ['carrier', 'fighter', 'cruiser', 'dreadnought', 'destroyer', 'warsun', 'flagship'];
            const ground = ['infantry', 'mech', 'pds'];

            Object.keys(units).forEach( u => {
              if( fleet.indexOf(u) > -1 ){
                if(!tile.tdata.fleet[u]){
                  tile.tdata.fleet[u] = 0;
                }
                tile.tdata.fleet[u] += units[u];
              }
              else if( ground.indexOf(u) > -1 ){
                if(!tile.tdata.planets[pid].units[u]){
                  tile.tdata.planets[pid].units[u] = 0;
                }
                tile.tdata.planets[pid].units[u] += units[u];
              }
            });

          },
          learnTechnology: ({ G, playerID }, techId) => {
            const technology = techData.find( t => t.id === techId);

            if(!technology){
              console.log('no such technology');
              return INVALID_MOVE;
            }

            const knownTechs = G.races[playerID].knownTechs;

            if(knownTechs.indexOf(techId) > -1){
              console.log('already learned');
              return INVALID_MOVE;
            }

            if(technology.prereq){
              const available = { 'warfare': 0, 'biotic': 0, 'cybernetic': 0, 'propulsion': 0 };
              knownTechs.forEach( t => {
                const av = techData.find( a => a.id === t);
                if(av){
                  available[av.type]++;
                }
              });

              const prereq = Object.keys(technology.prereq);
              for(var i=0; i<prereq.length; i++){
                const p = prereq[i];
                if( technology.prereq[p] > available[p] ){
                  console.log('require ' + p + ' ' + technology.prereq[p]);
                  return INVALID_MOVE;
                }
              }
            }

            knownTechs.push(techId);            
          },
          pass: ({ G, playerID, events }) => {
            if(G.passedPlayers.indexOf(playerID) === -1){
              G.passedPlayers.push(playerID);
            }
            events.endTurn();
          }
        },
        onBegin: ({ G, random }) => {
          if(!G.pubObjectives.length){ // to strat phase!
            //cardData.objectives.public = random.Shuffle(cardData.objectives.public.filter( o => o.vp === 1 ));
            cardData.objectives.public.filter( o => o.vp === 1).forEach( o => {
              G.pubObjectives.push({ ...o, players: [] });
            });
          }
          //G.pubObjectives.push({...cardData.objectives.public.pop(), players: []});
          
        },
        endIf: ({ G, ctx }) => G.passedPlayers.length === ctx.numPlayers,
      }
    },
    onBegin: ({ G }) => {
      //G.tiles.forEach( t => t.blocked = [])
    },
    endIf: ({ G, ctx }) => {
        if (IsVictory(G, ctx)) {
          return { winner: ctx.currentPlayer };
        }
    },
};

//const WIN_POINTS = 10;
const IsVictory = (G, ctx) => {
    
  return false;//G.pubObjectives.filter( ag => ag.players.indexOf(ctx.currentPlayer) > -1 ) >= WIN_POINTS;

}

