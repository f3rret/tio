/* eslint eqeqeq: 0 */
import { INVALID_MOVE, TurnOrder } from 'boardgame.io/core';
import { HexGrid } from './Grid';
import tileData from './tileData.json';
import raceData from './raceData.json';
import techData from './techData.json';
import cardData from './cardData.json';
import { produce } from 'immer';
import { NUM_PLAYERS, checkObjective, /*getPlanetByName*/ } from './utils';

export const TIO = {
    
    setup: () => {
      const tiles = HexGrid.toArray().map( h => ({ tid: h.tileId, /*blocked: [],*/ tdata: {...tileData.all[h.tileId], tokens: []}, q: h.q, r: h.r, w: h.width, corners: h.corners}) );
      const races = HexGrid.toArray().map( h => ({ rid: h.tileId }))
                  .filter( i => tileData.green.indexOf(i.rid) > -1 ).slice(0, NUM_PLAYERS)
                  .map( r => ({...r, ...raceData[r.rid], strategy:[], actionCards:[], secretObjectives:[], 
                    exploration:[], vp: 0, tg: 10, tokens: { t: 3, f: 3, s: 2}, fragments: {u: 0, c: 0, h: 0, i: 0}, relics: []}) );
      
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
        r.promissory.forEach(r => r.racial = true);
        r.promissory.push(...cardData.promissory);
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
                
                if(draft.planets.length < 2){
                  draft.planets[0].units = {...races[idx].startingUnits.ground};
                }
                else{
                  draft.planets[0].units = {...races[idx].startingUnits.ground};
                  delete draft.planets[0].units.pds;

                  draft.planets[1].units = {pds: races[idx].startingUnits.ground.pds};
                }
              }
            }
          });
        }
        else{
          if(!t.tdata.planets || !t.tdata.planets.length){
            t.tdata.frontier = true;
          }
        }
      });

      const explorationDecks = {cultural:[], hazardous:[], industrial:[], frontier:[]};

      return {
        speaker: races[0].rid, 
        tiles,
        pubObjectives: [],
        secretObjDeck: [],
        actionsDeck: [],
        explorationDecks,
        agendaDeck: [],
        relicsDeck: [],
        passedPlayers: [],
        laws: [],
        TURN_ORDER: races.map((r,i)=>i),
        races
      }
    },

    phases: {
      strat: {
        start: true,
        next: 'acts',
        turn: {
          order: TurnOrder.CUSTOM_FROM('TURN_ORDER'),
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
         
          if(!G.pubObjectives.length){
            cardData.objectives.public = random.Shuffle(cardData.objectives.public.filter( o => o.vp === 1 ));
            G.pubObjectives.push({...cardData.objectives.public.pop(), players: []});
            //G.pubObjectives.push({...cardData.objectives.public.find(o => o.id === 'Push Boundaries'), players: []});
          }

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

         if(!G.explorationDecks['cultural'].length){
            
            Object.keys(cardData.exploration).forEach(k => {
              const deck = [];
              cardData.exploration[k].forEach(exp => {
                if(exp.count){
                  for(var i=0; i<exp.count; i++){
                    deck.push(exp);
                  }
                }
                else{
                  deck.push(exp);
                }
              });
              G.explorationDecks[k] = random.Shuffle(deck); 
            });

          }

          if(!G.agendaDeck.length){
            G.agendaDeck = random.Shuffle(cardData.agenda);
          }

          if(!G.relicsDeck.length){
            G.relicsDeck = random.Shuffle(cardData.relics);
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
        next: ({G}) => G.tiles[0].tdata.planets[0].occupied !== undefined ? 'strat':'agenda',
        turn: {
          order: TurnOrder.ONCE,
          /*minMoves: 1,
          maxMoves: 1*/
        },
        moves: {
          completeObjective: ({G, playerID, events}, oid, payment) => {
            completeObjective({G, playerID, oid, payment});
            events.endTurn();
          },
          pass: ({ G, playerID, events }) => {
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
          G.races.forEach( r => { 
            r.strategy = []; 
            r.initiative = undefined 
          });

          G.tiles.forEach( t => {
            if(t.tdata.planets && t.tdata.planets.length){
              t.tdata.planets.forEach(p => {
                if(p.exhausted){
                  p.exhausted = false;
                }
              })
            }
          });
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

                                      if(['carrier', 'cruiser', 'destroyer', 'dreadnought', 'flagship', 'warsun'].indexOf(ukl) > -1){
                                        if(!tile.tdata.fleet[ukl]) tile.tdata.fleet[ukl] = [];
                                        for(var l=0; l<result.deploy[uk]; l++){
                                          tile.tdata.fleet[ukl].push({});
                                        }
                                      }
                                      else{
                                        if(!p.units[ukl]) p.units[ukl] = 0;
                                        p.units[ukl] += result.deploy[uk];                                        
                                      }

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
                          if(result.objId){
                            completeObjective({G, playerID, oid: result.objId, payment: result.payment});
                          }
                        }
                        if((ctx.currentPlayer === playerID) && G.tiles[0].tdata.planets[0].occupied === playerID){
                          G.races[playerID].vp++;
                        }
                        else{
                          G.races[playerID].secretObjectives = G.races[playerID].secretObjectives.concat(G.secretObjDeck.slice(-1 * (parseInt(playerID)+1)).slice(0, 1));
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
          purgeFragments: ({G, playerID}, purgingFragments) => {
            if(purgingFragments.c + purgingFragments.u !== 3 && purgingFragments.h + purgingFragments.u !== 3 && purgingFragments.i + purgingFragments.u !== 3){
              console.log('not enough fragments');
              return INVALID_MOVE;
            }
            if(purgingFragments.c > G.races[playerID].fragments.c || purgingFragments.h > G.races[playerID].fragments.h ||
               purgingFragments.i > G.races[playerID].fragments.i || purgingFragments.u > G.races[playerID].fragments.u ){
              console.log('invalid fragments count');
              return INVALID_MOVE;
            }
            if(!G.relicsDeck.length){
              console.log('no relics');
              return INVALID_MOVE;
            }
            Object.keys(purgingFragments).forEach(k => {
              G.races[playerID].fragments[k] -= purgingFragments[k];
            });
            G.races[playerID].relics.push(G.relicsDeck.pop());
          },
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
          loadUnit: ({G, playerID}, {src, dst}) => {
            
            let from = G.tiles[src.tile].tdata.planets[src.planet].units[src.unit];
            const to = G.tiles[src.tile].tdata.fleet[dst.unit];
            const technology = G.races[playerID].technologies.find( t => t.id === dst.unit.toUpperCase());

            if(['infantry', 'fighter', 'mech'].indexOf(src.unit) > -1){
              if(from && to && technology){
                if(dst.i <= to.length){
                  if(technology.capacity && dst.j <= technology.capacity){
                    if(!to[dst.i].payload){
                      to[dst.i].payload = new Array(technology.capacity);
                    }
                    if(!to[dst.i].payload[dst.j]){
                      G.tiles[src.tile].tdata.planets[src.planet].units[src.unit]--;
                      if(G.tiles[src.tile].tdata.planets[src.planet].units[src.unit] === 0) delete G.tiles[src.tile].tdata.planets[src.planet].units[src.unit];
                      G.tiles[src.tile].tdata.fleet[dst.unit][dst.i].payload[dst.j] = src.unit;
                    }
                  }
                }
              }
            }

          },
          unloadUnit: ({G, playerID}, {src, dst}) => {
            
            let to = G.tiles[dst.tile].tdata.planets[dst.planet];
            const from = G.tiles[src.tile].tdata.fleet[src.unit];
           
            if(from && to){
              if(!to.units){
                to.units = {}
              }
              if(!to.units[from[src.i].payload[src.j]]){
                to.units[from[src.i].payload[src.j]]=0;
              }

              to.units[from[src.i].payload[src.j]]++;
              G.tiles[src.tile].tdata.fleet[src.unit][src.i].payload[src.j] = undefined;

              if(!to.occupied && to.trait){
                const explore = G.explorationDecks[to.trait].pop();
                if(explore.id.indexOf('Relic Fragment') > -1){
                  G.races[playerID].fragments[to.trait[0]]++;
                }
                G.races[playerID].exploration.push(explore);
              }
              if(to.occupied != playerID){
                to.occupied = playerID;
                to.exhausted = true;
              }
            }

          },
          activateTile: ({ G, playerID }, tIndex) => {

            const race = G.races[playerID];
            if(race.tokens.t <= 0){
              console.log('not enough tokens');
              return INVALID_MOVE;
            }

            /*if(race.actions.length > 0){
              console.log('too many actions');
              return INVALID_MOVE;
            }*/

            const tile = G.tiles[tIndex];

            if(tile){
              tile.tdata.tokens.push(race.rid);
              tile.active = true;
            }
            else{
              console.log('no tile selected');
              return INVALID_MOVE;
            }

            if(tile.active){
              race.tokens.t--;
              race.actions.push('TILE_ACTIVATE');
            }

            if(tile.tdata.frontier && tile.tdata.occupied == playerID && G.races[playerID].knownTechs.indexOf('DARK_ENERGY_TAP') > -1){
              const explore = G.explorationDecks['frontier'].pop();
                if(explore.id.indexOf('Relic Fragment') > -1){
                  G.races[playerID].fragments.u++;
                }
              race.exploration.push(explore);
              tile.tdata.frontier = false;
            }

          },
          moveShip: ({ G, playerID }, args) => {

            const dst = G.tiles.find( t => t.active === true );
            const src = G.tiles[args.tile];
            const unit = src.tdata.fleet[args.unit][args.shipIdx];

            if(dst && src && unit){
              if( dst.tdata.occupied != playerID ){
                dst.tdata.occupied = playerID;
              }

              if(!dst.tdata.fleet) dst.tdata.fleet = {};
              if(!dst.tdata.fleet[args.unit]) dst.tdata.fleet[args.unit] = [];
              dst.tdata.fleet[args.unit].push(unit);

              G.tiles[args.tile].tdata.fleet[args.unit].splice(args.shipIdx, 1);
              if(G.tiles[args.tile].tdata.fleet[args.unit].length === 0){
                delete G.tiles[args.tile].tdata.fleet[args.unit];
              }
            }

            if(dst.tdata.frontier && G.races[playerID].knownTechs.indexOf('DARK_ENERGY_TAP') > -1){
              const explore = G.explorationDecks['frontier'].pop();
                if(explore.id.indexOf('Relic Fragment') > -1){
                  G.races[playerID].fragments.u++;
                }
              G.races[playerID].exploration.push(explore);
              dst.tdata.frontier = false;
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
          G.passedPlayers = []; 
        },
        endIf: ({ G, ctx }) => G.passedPlayers.length === ctx.numPlayers,
      },
      agenda: {
        next: 'strat',
        turn: {
          order: TurnOrder.CUSTOM_FROM('TURN_ORDER'),
          minMoves: 2,
          maxMoves: 2,
        },

        moves: {
          vote: ({G, ctx, playerID}, result) => {
            let votes = 0;
            const exhaustPlanet = (exhausted, revert) => {
              if(exhausted && exhausted.length){
                G.tiles.forEach(tile => {
                  const planets = tile.tdata.planets;

                  if(planets && planets.length){
                    planets.forEach( p => {
                      if(p.occupied == playerID){
                        if(exhausted.indexOf(p.name) > -1){
                          p.exhausted = !revert;
                          votes += p.influence;
                        }
                      }
                    });
                  }
                });
              }
            };

            exhaustPlanet(Object.keys(result.ex));
            G.races[playerID].voteResults.push({vote: result.vote, count: votes});

            const agendaNumber = G.vote2 ? 2:1;
            if(G.races.every(r => r.voteResults.length === agendaNumber)){
              const voteResolution = {};
              G.races.forEach(r => {
                if(!voteResolution[r.voteResults[agendaNumber - 1].vote]){
                  voteResolution[r.voteResults[agendaNumber - 1].vote] = 0;
                }
                voteResolution[r.voteResults[agendaNumber - 1].vote] += (r.voteResults[agendaNumber - 1].votes || 0);
              });

              let decision;
              Object.keys(voteResolution).forEach(k => {
                if(!decision) decision = k;
                if(voteResolution[decision] < voteResolution[k]) decision = k;
              });

              G['vote' + agendaNumber].decision = decision;
              if(G['vote' + agendaNumber].type === 'LAW'){
                G.laws.push(G['vote' + agendaNumber]);
              }
            }

            if(G.vote2){
              if(G.passedPlayers.indexOf(playerID) === -1){
                G.passedPlayers.push(playerID);
              }
            }
            else if(!G.vote2){
              G.vote2 = G.agendaDeck.pop();
            }

            
          },
      
        },

        onBegin: ({ G, ctx }) => {
          G.tiles.forEach( t => t.active = false);
          G.races[ctx.currentPlayer].actions = [];
          G.vote1 = G.agendaDeck.pop();
          G.vote2 = undefined;

          G.races.forEach( r => {r.votesMax = 0; r.voteResults = []});
          
          G.tiles.forEach( t => {
            if(t.tdata.planets && t.tdata.planets.length){
              t.tdata.planets.forEach(p => {
                if(p.occupied !== undefined){
                  G.races[p.occupied].votesMax += p.influence;
                }
              })
            }
          });

          G.passedPlayers = [];
        },

        onEnd: ({G}) => {
          G.vote1 = undefined;
          G.vote2 = undefined;

          G.tiles.forEach( t => {
            if(t.tdata.planets && t.tdata.planets.length){
              t.tdata.planets.forEach(p => {
                if(p.exhausted){
                  p.exhausted = false;
                }
              })
            }
          });

          G.passedPlayers = [];
        },
        endIf: ({ G, ctx }) => G.passedPlayers.length === ctx.numPlayers
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

  const objective = G.pubObjectives.find(o => o.id === oid);
  if(objective && objective.players.indexOf(playerID) === -1){

    const req = objective.req;
    const race = G.races[playerID];
    
    if(objective.type === 'SPEND'){
      const rkeys = Object.keys(req);

      const check = rkeys.every((k) => {
        if(k === 'influence' || k === 'resources'){
            return payment[k] && payment[k].planets.reduce((a,b) => b[k] + a, 0) + payment[k].tg >= req[k]
        }
        else if(k === 'tg'){
            return G.races[playerID].tg >= req[k]
        }
        else if(k === 'token'){
            return payment[k] && payment[k].t + payment[k].s >= req[k]
        }
        else return false;
      });

      if(!check){
        console.log('not enough pay');
        return;
      }

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

      objective.players.push(playerID);
    }
    else if(objective.type === 'HAVE'){
      if(checkObjective(G, playerID, oid) === true){
        objective.players.push(playerID);
      }
    }
    else{
      return;
    }
    
  }

}


/*moveFleet: ({ G, playerID }, src, squadron) => {
            const dst = G.tiles.find( t => t.active === true );
            
            if(!src || !src.tdata.fleet){
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

          },*/
          /*produceUnits: ({ G, playerID }, units, planetId) => {

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

          },*/
          /*learnTechnology: ({ G, playerID }, techId) => {
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
          },*/