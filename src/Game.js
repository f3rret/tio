/* eslint eqeqeq: 0 */
import { INVALID_MOVE, TurnOrder } from 'boardgame.io/core';
import { HexGrid } from './Grid';
import tileData from './tileData.json';
import raceData from './raceData.json';
import techData from './techData.json';
import cardData from './cardData.json';
import { produce } from 'immer';
import { NUM_PLAYERS, checkObjective } from './utils';

export const TIO = {
    
    setup: () => {
      const tiles = HexGrid.toArray().map( h => ({ tid: h.tileId, /*blocked: [],*/ tdata: {...tileData.all[h.tileId], tokens: []}, q: h.q, r: h.r, w: h.width, corners: h.corners}) );
      const races = HexGrid.toArray().map( h => ({ rid: h.tileId }))
                  .filter( i => tileData.green.indexOf(i.rid) > -1 ).slice(0, NUM_PLAYERS)
                  .map( r => ({...r, ...raceData[r.rid], strategy:[], actionCards:[], secretObjCards:[], tg: 10, tokens: { t: 3, f: 3, s: 2}}) );
      
      const all_units = techData.filter((t) => t.type === 'unit');
      races.forEach( r => {
        all_units.forEach( t => {
          const tch = r.technologies.find( f => f.id === t.id);
          if(!tch){
            r.technologies.push(t);
          }
          else{
            tch.racial = true;
          }
        });
      });

      tiles.forEach( (t, i) => {
        if( t.tdata.type === 'green' ){
          tiles[i].tdata = produce(tiles[i].tdata, draft => {
            const idx = races.findIndex(r => r.rid === t.tid);
            if(idx > -1){
              draft.occupied = idx;

              for( let j=0; j < draft.planets.length; j++ ){
                draft.planets[j].occupied = idx;
              }
              if(races[idx].startingUnits){
                draft.fleet = races[idx].startingUnits.fleet;
                draft.planets[0].units = races[idx].startingUnits.ground;
              }
            }
          });
        }
      });

      return {
        speaker: races[0].rid, 
        tiles,
        pubObjectives: [],
        secretObjDeck: [],
        actionsDeck: [],
        agendaDeck: [],
        passedPlayers: [],
        races
      }
    },

    phases: {
      strat: {
        start: true,
        next: 'acts',
        turn: {
          //order: TurnOrder.ONCE,
          minMoves: 1,
          maxMoves: 1
        },
        moves: {
          pickStrategy: ({G, playerID, events}, sid) => {
            if(!cardData.strategy[sid]){
              console.log('invalid card');
              return INVALID_MOVE;
            }

            if(G.races.find( r => r.strategy.length && r.strategy.find(s => s.id === sid))){
              console.log('already picked');
              return INVALID_MOVE;
            }

            const init = cardData.strategy[sid].init;
            
            if(G.races[playerID].initiative === undefined || G.races[playerID].initiative > init){
              G.races[playerID].initiative = init;
            }

            G.races[playerID].strategy.push({ id: sid, init });
            events.endTurn();
          }
        },
        onBegin: ({ G, ctx, random }) => {
          G.races.forEach( r => { r.strategy = []; r.initiative = undefined } );

          if(!G.pubObjectives.length){
            cardData.objectives.public = random.Shuffle(cardData.objectives.public.filter( o => o.vp === 1 ));
          }

          G.pubObjectives.push({...cardData.objectives.public.pop(), players: []});
          //G.pubObjectives.push({...cardData.objectives.public.find(o => o.id === 'Lead from the Front'), players: []});

          if(!G.actionsDeck.length){
            const deck = [];
            cardData.actions.forEach(a => {
              if(a.count){
                for(var i=0; i<a.count; i++){
                  deck.push(a);
                }
              }
              else{
                deck.push(a);
              }
            });

            G.actionsDeck = random.Shuffle(deck);
          }

          if(!G.agendaDeck.length){
            G.agendaDeck = random.Shuffle(cardData.agenda);
          }

          if(!G.secretObjDeck.length){
            G.secretObjDeck = random.Shuffle(cardData.objectives.secret);
          }

        },
        onEnd: ({ G }) => {
          G.TURN_ORDER = G.races.map((r, i) => ({initiative: r.initiative, i})).sort((a, b) => a.initiative > b.initiative ? 1 : (a.initiative < b.initiative ? -1 : 0)).map(r => r.i);
        },
        endIf: ({ G, ctx }) => {
          const cardsCount = ctx.numPlayers > 1 ? 1 : 2; // more than 4!
          return ctx.playOrder.every( r => G.races[r].strategy.length === cardsCount );
        }
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
            completeObjective({G, playerID, oid, payment});
            events.endTurn();
          }
        },
        onBegin: ({ G, random }) => {
          G.passedPlayers = [];
          G.races.forEach(r => {
            r.actionCards.push(G.actionsDeck.pop());
          });
          //return {...G, passedPlayers: []}
        },
        onEnd: ({ G }) => {
          G.pubObjectives.push({...cardData.objectives.public.pop(), players: []});
        }
      },
      acts: {
        //start: true,
        next: 'stats',
        turn: {
            /*minMoves: 1,
            maxMoves: 1,*/
            order: TurnOrder.CUSTOM_FROM('TURN_ORDER'),
            stages: {
              strategyCard: {
                minMoves: 1,
                maxMoves: 1,
                moves: {
                  joinStrategy: ({ G, ctx, playerID, events }, {exhausted, tg, result}) => {

                    const exhaustPlanet = (revert) => {
                      if(exhausted && exhausted.length){
                        G.tiles.forEach(tile => {
                          const planets = tile.tdata.planets;

                          if(planets && planets.length){
                            planets.forEach( p => {
                              if(p.occupied == playerID){
                                if(exhausted.indexOf(p.name) > -1){
                                  p.exhausted = !revert;
                                }
                              }
                            });
                          }
                        });
                      }
                    };

                    switch(G.strategy){
                      case 'LEADERSHIP':
                        exhaustPlanet();

                        G.races[playerID].tg -= tg;
                        G.races[playerID].tokens.new = result;
                        break;
                      case 'DIPLOMACY':
                        if(result > 0){
                          G.races.forEach((r, i) => {
                            if(i != playerID){
                              G.tiles[result].tdata.tokens.push(r.rid);
                            }
                          });
                        }
                        exhaustPlanet(true);
                        break;
                      case 'POLITICS':
                        if(result.selectedRace){
                          G.speaker = result.selectedRace;
                        }
                        //draw certain action cards, maybe in parallel with others
                        G.races[playerID].actionCards = G.races[playerID].actionCards.concat(G.actionsDeck.slice(-2 * (parseInt(playerID)+1)).slice(0, 2));
                        G.actionsDeck[(G.actionsDeck.length - 1) - (parseInt(playerID)+1)].issued = true;
                        G.actionsDeck[(G.actionsDeck.length - 1) - (parseInt(playerID)+1) - 1].issued = true;

                        if(result.agendaCards && result.agendaCards.length){
                          G.agendaDeck = G.agendaDeck.slice(0, -2);
                          
                          for(var i = 1; i >= 0; i--){
                            const a = result.agendaCards[i];
                            if(a.bottom){
                              G.agendaDeck = [a, ...G.agendaDeck];
                            }
                            else{
                              G.agendaDeck = [...G.agendaDeck, a];
                            }
                          }
                        }
                        break;
                      case 'CONSTRUCTION':
                        const build = (obj)=>{
                          const keys=Object.keys(obj);

                          if(keys.length){
                            G.tiles.forEach(tile => {
                              const planets = tile.tdata.planets;
    
                              if(planets && planets.length){
                                planets.some( p => {
                                  if(p.occupied == playerID && p.name === keys[0]){
                                    if(!p.units) p.units={}
                                    if(!p.units[obj[keys[0]]]) p.units[obj[keys[0]]]=0;
                                    p.units[obj[keys[0]]]++;

                                    if(ctx.currentPlayer != playerID){
                                      tile.tdata.tokens.push(G.races[playerID].rid);
                                    }

                                    return true;
                                  }
                                  return false;
                                });
                              }
                            });
                          }
                        };

                        build(result[0]);

                        if(ctx.currentPlayer === playerID){
                          build(result[1])
                        }

                        break;
                      case 'TRADE':
                        if(ctx.currentPlayer === playerID){
                          G.races[playerID].tg += 3;
                          G.races[playerID].commodity = G.races[playerID].commCap;

                          if(result.length){
                            G.races[playerID].strategy.find(s => s.id === 'TRADE').NO_TOKEN_RACES = result;
                          }
                        }
                        else{
                          G.races[playerID].commodity = G.races[playerID].commCap;

                          const noToken = G.races[ctx.currentPlayer].strategy.find(s => s.id === 'TRADE').NO_TOKEN_RACES;
                          if(noToken && noToken.length && noToken.indexOf(G.races[playerID].rid) > -1){
                            G.races[playerID].tokens.s++;
                          }
                        }
                        break;
                      case 'WARFARE':
                        if(ctx.currentPlayer === playerID){
                          G.races[playerID].tokens = result.tokens;

                          if(result.selectedTile && result.selectedTile > -1){
                            const ar = [...G.tiles[result.selectedTile].tdata.tokens];
                            const idx = ar.indexOf(G.races[playerID].rid);
                            if(idx > -1){
                              ar.splice(idx, 1);
                              G.tiles[result.selectedTile].tdata.tokens = ar;
                            }
                          }
                        }
                        else{
                          if(result.base && result.deploy){
                            exhaustPlanet();

                            if(tg){
                              G.races[playerID].tg -= tg;
                            }
                            
                            G.tiles.some(tile => {
                              const planets = tile.tdata.planets;

                              if(planets && planets.length){
                                const found = planets.some( p => {
                                  if(p.occupied == playerID && p.name === result.base){
                                    const ukeys = Object.keys(result.deploy);
                                    ukeys.forEach(uk => {
                                      const ukl = uk.toLowerCase();
                                      if(!tile.tdata.fleet[ukl]) tile.tdata.fleet[ukl] = 0;
                                      tile.tdata.fleet[ukl] += result.deploy[uk];
                                    });
                                    return true;
                                  }
                                  return false;
                                });
                                return found.length > 0;
                              }
                              return false;
                            });
                              
                          }
                        }
                        break;
                      case 'TECHNOLOGY':
                        const keys = Object.keys(result);

                        if(keys.length){
                          exhaustPlanet();
                          if(tg){ G.races[playerID].tg -= tg;}

                          keys.forEach(k => {
                            G.races[playerID].knownTechs.push(result[k].id);
          
                            if(result[k].type === 'unit' && result[k].upgrade === true){
                              const idx = G.races[playerID].technologies.findIndex(t => t.id + '2' === result[k].id);
                              if(idx > -1) G.races[playerID].technologies[idx] = {...result[k], upgrade: false, alreadyUpgraded: true, id: G.races[playerID].technologies[idx].id};
                            }
                          });
                          
                        }
                        break;
                      case 'IMPERIAL':
                        if(ctx.currentPlayer === playerID){
                          if(result.objId > -1){
                            completeObjective({G, playerID, oid: result.objId, payment: result.payment});
                          }
                        }
                        if((ctx.currentPlayer === playerID) && G.tiles[0].tdata.planets[0].occupied === playerID){
                          G.races[playerID].VP++;
                        }
                        else{
                          G.races[playerID].secretObjCards = G.races[playerID].secretObjCards.concat(G.secretObjDeck.slice(-1 * (parseInt(playerID)+1)).slice(0, 1));
                          G.secretObjDeck[(G.secretObjDeck.length - 1) - (parseInt(playerID)+1)].issued = true;
                        }

                        break;
                      default:
                        break;
                    }
                    
                    if(ctx.currentPlayer != playerID){
                      G.races[playerID].tokens.s--;
                    }
                    
                    if(Object.keys(ctx.activePlayers).length === 1){
                      G.actionsDeck = G.actionsDeck.filter(a => a.issued !== true);
                      G.secretObjDeck = G.secretObjDeck.filter(a => a.issued !== true);
                    }
                  },
                  passStrategy: ({ G, ctx }) => {
                    if(Object.keys(ctx.activePlayers).length === 1){
                      G.actionsDeck = G.actionsDeck.filter(a => a.issued !== true);
                      G.secretObjDeck = G.secretObjDeck.filter(a => a.issued !== true);
                    }
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
          adjustToken: ({ G, playerID}, tag) => {
            G.races[playerID].tokens.new--;
            G.races[playerID].tokens[tag]++;
          },
          useStrategy: ({ G, events, playerID}, idx) => {
            /*if(G.races[playerID].actions.length > 0){
              console.log('too many actions');
              return INVALID_MOVE;
            }*/

            if(idx === undefined) idx=0;
            const strategy = G.races[playerID].strategy[idx];

            if(!strategy || strategy.exhausted){
              console.log('strategy card exhausted');
              return INVALID_MOVE;
            }

            strategy.exhausted = true;
            G.strategy = strategy.id;
            G.races[playerID].actions.push('STRATEGY_CARD');

            events.setActivePlayers({ all: 'strategyCard', minMoves: 1, maxMoves: 1 });
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
                    delete units['spacedock'];

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

            if(!tile.tdata.planets[pid] || !tile.tdata.planets[pid].units || !tile.tdata.planets[pid].units.spacedock){
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
            
            if(technology.type === 'unit' && technology.upgrade === true){
              const idx = G.races[playerID].technologies.findIndex(t => t.id + '2' === techId);
              if(idx > -1) G.races[playerID].technologies[idx] = {...technology, upgrade: false, alreadyUpgraded: true, id: G.races[playerID].technologies[idx].id};
            }
          },
          pass: ({ G, playerID, events }) => {
            if(G.passedPlayers.indexOf(playerID) === -1){
              G.passedPlayers.push(playerID);
            }
            events.endTurn();
          }
        },
        onEnd: ({ G }) => {
          G.tiles.forEach( t => t.tdata.tokens = []);
        },
        onBegin: ({ G, random }) => {
                   
        },
        endIf: ({ G, ctx }) => G.passedPlayers.length === ctx.numPlayers,
      }
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

const completeObjective = ({G, playerID, oid, payment}) => {

  if(G.pubObjectives[oid] && G.pubObjectives[oid].players.indexOf(playerID) === -1){

    const req = G.pubObjectives[oid].req;
    const race = G.races[playerID];
    
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
      if(checkObjective(G, playerID, oid) === true){
        G.pubObjectives[oid].players.push(playerID);
      }
    }
    else{
      return;
    }
    
  }

}