/* eslint eqeqeq: 0 */
import { INVALID_MOVE, TurnOrder } from 'boardgame.io/core';
import { HexGrid } from './Grid';
import tileData from './tileData.json';
import raceData from './raceData.json';
import techData from './techData.json';
import cardData from './cardData.json';
import { produce } from 'immer';
 
export const TIO = {
    
    setup: () => {
      const tiles = HexGrid.toArray().map( h => ({ tid: h.tileId, /*blocked: [],*/ tdata: tileData.all[h.tileId], q: h.q, r: h.r, w: h.width, corners: h.corners}) );
      const races = HexGrid.toArray().map( h => ({ rid: h.tileId }))
                  .filter( i => tileData.green.indexOf(i.rid) > -1 )
                  .map( r => ({...r, ...raceData[r.rid], tokens: { t: 3, f: 3, s: 2}}) );

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
        activeGoals: [{gid: 0, players: []}],
        passedPlayers: [],
        races
      }
    },

    phases: {
      strat: {
        
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
        onBegin: ({ G, ctx }) => {
          G.races.forEach( r => r.strategy = undefined );
        },
        onEnd: ({ G }) => {
          
        }
      },
      stats: {
        next: 'strat',
        turn: {
          order: TurnOrder.ONCE,
          minMoves: 1,
          maxMoves: 1
        },
        moves: {
          completeGoal: ({G, playerID, events}, id) => {
            if(G.activeGoals[id] && G.activeGoals[id].players.indexOf(playerID) === -1 && GOALS[G.activeGoals[id].gid](G, playerID)){
              G.activeGoals[id].players.push(playerID);
            }
            events.endTurn();
          }
        },
        onBegin: ({ G }) => {
          return {...G, passedPlayers: []}
        },
        onEnd: ({ G }) => {
          //add new random goal
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

              if(Object.keys(dst.tdata.fleet).length > 0){
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
            const ground = ['infantry', 'mech'];

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

            if(G.races[playerID].technologies.indexOf(techId) > -1){
              console.log('already learned');
              return INVALID_MOVE;
            }

            if(technology.prereq){
              const available = { "warfare": 0, "biotic": 0, "cybernetic": 0, "propulsion": 0 };
              G.races[playerID].technologies.forEach( t => {
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

            G.races[playerID].technologies.push(techId);            
          },
          pass: ({ G, playerID, events }) => {
            if(G.passedPlayers.indexOf(playerID) === -1){
              G.passedPlayers.push(playerID);
            }
            events.endTurn();
          }
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

const GOALS = [
    (G, playerID) => { return G.tiles.filter(t => t && t.playerID === playerID).length > 2 }
];
const WIN_POINTS = 10;
const IsVictory = (G, ctx) => {
    
  return G.activeGoals.filter( ag => ag.players.indexOf(ctx.currentPlayer) > -1 ) >= WIN_POINTS;

}