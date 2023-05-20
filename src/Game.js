/* eslint eqeqeq: 0 */
import { INVALID_MOVE, TurnOrder } from 'boardgame.io/core';
import { HexGrid, neighbors } from './Grid';
import tileData from './tileData.json';
import raceData from './raceData.json';
import techData from './techData.json';
import cardData from './cardData.json';
import { produce } from 'immer';
import { NUM_PLAYERS, checkObjective, getUnitsTechnologies/*getPlanetByName*/ } from './utils';

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
          if(t.tdata.type !== 'hyperlane' && (!t.tdata.planets || !t.tdata.planets.length)){
            t.tdata.frontier = true;
          }
        }
      });

      const explorationDecks = {cultural:[], hazardous:[], industrial:[], frontier:[]};
      const dice= {};
      for(let i=0; i<NUM_PLAYERS; i++){
        dice[i] = {};
      }

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
        races,
        dice
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
        next: ({G}) => G.tiles[0].tdata.planets[0].occupied === undefined ? 'strat':'agenda',
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
                                    if(!p.units[obj[keys[0]]]) p.units[obj[keys[0]]]=[];
                                    p.units[obj[keys[0]]].push({});

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
                                      var l = 0;
                                      if(['carrier', 'cruiser', 'destroyer', 'dreadnought', 'flagship', 'warsun'].indexOf(ukl) > -1){
                                        if(!tile.tdata.fleet[ukl]) tile.tdata.fleet[ukl] = [];
                                        for(l=0; l<result.deploy[uk]; l++){
                                          tile.tdata.fleet[ukl].push({});
                                        }
                                      }
                                      else{
                                        if(!p.units[ukl]) p.units[ukl] = [];
                                        for(l=0; l<result.deploy[uk]; l++){
                                          p.units[ukl].push({});
                                        }
                                        //p.units[ukl] += result.deploy[uk];                                        
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
              spaceCannonAttack: {
                moves: {
                 rollDice: ({G, ctx, playerID, random}, unit, count) => {
                  const dice = random.D10(count || 1);
                  G.dice = produce(G.dice, draft => {
                    draft[playerID][unit] = dice;
                  });
                 },
                 nextStep: ({G, events, ctx, playerID}) => {

                  const getHits = () => {
                    let result = 0;
                    if(G.spaceCannons !== undefined){
                      Object.keys(G.spaceCannons).forEach(pid => {
                          if(G.dice[pid]){
                              Object.keys(G.dice[pid]).forEach(unit => {
                                  const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                                  if(technology && technology.spaceCannon){
                                      result += G.dice[pid][unit].filter(die => die >= technology.spaceCannon.value).length;
                                  }
                              });
                          }
                      });
                    }
                    return result;
                  }

                  if(ctx.currentPlayer !== playerID){
                    if(Object.keys(ctx.activePlayers).filter(s => ctx.activePlayers[s] === 'spaceCannonAttack').length === 2){ //me and active player
                      //pass next step if no hits
                      if(getHits() === 0){
                        events.endStage();
                        return;
                      }
                    }
                   
                    events.setStage('spaceCannonAttack_step2');
                  }
                  else{
                    if(Object.keys(ctx.activePlayers).filter(s => ctx.activePlayers[s] === 'spaceCannonAttack').length === 1){
                      if(getHits() === 0){
                        delete G['spaceCannons'];
                        events.setActivePlayers({});
                      }
                      else{
                        events.setStage('spaceCannonAttack_step2');
                      }
                    }
                  }
                 } 
                },
              },
              spaceCannonAttack_step2: {
                moves: {
                 nextStep: ({G, playerID, ctx, events}, hits) => {
                  let fleet;
                  const activeTile = G.tiles.find(t => t.active === true);
                   
                  if((activeTile.tdata.occupied !== ctx.currentPlayer) && activeTile.tdata.attacker){
                      fleet = activeTile.tdata.attacker;
                  }
                  else{
                      fleet = activeTile.tdata.fleet;
                  }

                  if(playerID === ctx.currentPlayer){
                    hits && Object.keys(hits).forEach(unit => {
                      if(hits[unit].length){
                        hits[unit].forEach((car, idx) => {
                          if(car.hit){
                            fleet[unit][idx].hit = car.hit;
                          }
  
                          if(car.payload && car.payload.length){
                            car.payload.forEach(p => {
                              if(p.hit){
                                fleet[unit][idx].payload[p.pidx].hit = p.hit;
                              }
                            })
                          }
                        });
                      }  
                    });
                  }
                  
                  if(Object.keys(ctx.activePlayers).length === 1){ //make hits permanent
                    const technologies = getUnitsTechnologies([...Object.keys(fleet), 'fighter', 'mech'], G.races[ctx.currentPlayer]);

                    Object.keys(fleet).forEach(f => {
                      fleet[f].forEach((car, i) => {
                        if(car.hit){
                          if(car.hit > 1 || !technologies[f].sustain){
                            delete fleet[f][i];
                          }
                        }
                        else if(car.payload && car.payload.length){
                          car.payload.forEach((p, j) => {
                            if(p.hit){
                              if(p.hit > 1 || !technologies[p.id].sustain){
                                delete fleet[f][i].payload[j];
                              }
                            }
                          });
                          car.payload = car.payload.filter(p => p);
                        }
                      });
                      fleet[f] = fleet[f].filter(car => car);
                    });
                  }
                 
                  events.endStage();
                 } 

                },
              },
              antiFighterBarrage: {
                moves: {
                  rollDice: ({G, playerID, random}, unit, count) => {
                    const dice = random.D10(count || 1);
                    G.dice = produce(G.dice, draft => {
                      draft[playerID][unit] = dice;
                    });
                  },
                  nextStep: ({G, events, ctx, playerID}) => {
                    let hits = {};
                    Object.keys(ctx.activePlayers).forEach(pid => {
                        let h = 0;
                        if(G.dice[pid]){
                            Object.keys(G.dice[pid]).forEach(unit => {
                                const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                                if(technology && technology.barrage){
                                    h += G.dice[pid][unit].filter(die => die >= technology.barrage.value).length;
                                }
                            });
                        }
                        hits[pid] = h;
                    });
                    
                    const activeTile = G.tiles.find(t => t.active === true);
                    const attackerHits = hits[ctx.currentPlayer];
                    const defenderHits = hits[activeTile.tdata.occupied];
  
                    const makeHit = (fleet, count) => {
                      let remain = count;
  
                      Object.keys(fleet).forEach(tag => {
                        if(remain > 0){
                          fleet[tag].forEach((car, c) => {
                            if(remain > 0 && tag === 'fighter'){
                              delete fleet[tag][c];
                              remain--;
                            }
                            else if(car.payload && remain > 0){
                              car.payload.forEach((p, i) => {
                                if(p.id === 'fighter' && remain > 0){
                                  delete car.payload[i];
                                  remain--;
                                }
                              });
                              car.payload = car.payload.filter(p => p);
                            }
                          });
                          fleet[tag] = fleet[tag].filter(car => car);
                        }
                      });
                    }
  
                    if(playerID !== ctx.currentPlayer){
                      makeHit(activeTile.tdata.attacker, defenderHits);
                    }
                    else{
                      makeHit(activeTile.tdata.fleet, attackerHits);
                    }

                    /*if(Object.keys(ctx.activePlayers).filter(k => ctx.activePlayers[k] === 'antiFighterBarrage').length === 1){
                      G.dice[activeTile.tdata.occupied] = {};
                      G.dice[ctx.currentPlayer] = {};
                    }*/

                    if(Object.keys(activeTile.tdata.attacker).length && Object.keys(activeTile.tdata.fleet).length){
                      /*const ap = {...ctx.activePlayers};
                      Object.keys(ap).forEach(k => ap[k] = 'spaceCombat');
                      events.setActivePlayers({value: ap});*/
                      
                      let needAwait = true;
                      Object.keys(ctx.activePlayers).forEach(pid => {
                        if(ctx.activePlayers[pid] === 'spaceCombat_await') needAwait = false;
                      });
                      
                      if(needAwait){
                        events.setStage('spaceCombat_await');
                      }
                      else{
                        const val = {};
                        val[activeTile.tdata.occupied] = {stage: 'spaceCombat'};
                        val[ctx.currentPlayer] = {stage: 'spaceCombat'};
                        
                        G.dice[activeTile.tdata.occupied] = {};
                        G.dice[ctx.currentPlayer] = {};
                        events.setActivePlayers({value: val});
                      }
                    }
                    else{
                      events.endStage();
                    }

                  },
                  retreat: ({G, playerID}) => {
                    G.races[playerID].retreat = true;
                    loadUnitsOnRetreat(G, playerID);
                  }
                },
                
              },
              spaceCombat: {
                moves: {
                  rollDice: ({G, playerID, random}, unit, count) => {
                    const dice = random.D10(count || 1);
                    G.dice = produce(G.dice, draft => {
                      draft[playerID][unit] = dice;
                    });
                  },
                  nextStep: ({G, playerID, events, ctx}, hits) => {
                    if(hits && Object.keys(hits).reduce((a,b) => a + hits[b], 0) === 0){
                      if(G.races[playerID].retreat !== true){
                        const enemyRetreat = Object.keys(ctx.activePlayers).find(k => G.races[k].retreat === true);
                        if(enemyRetreat !== undefined){
                          events.setStage('spaceCombat_await'); //await while enemy retreating
                        }
                        else{
                          Object.keys(hits).forEach(pid => G.dice[pid] = {});
                          events.setStage('spaceCombat');
                        }
                      }
                      else{
                        events.setStage('combatRetreat');
                      }
                    }
                    else{
                      events.setStage('spaceCombat_step2');
                    }
                  },
                  retreat: ({G, playerID}) => {
                    G.races[playerID].retreat = true;
                    loadUnitsOnRetreat(G, playerID);
                  }
                }
              },
              spaceCombat_step2: {
                moves: {
                 nextStep: ({G, playerID, ctx, events}, hits) => {
                  let fleet;
                  const activeTile = G.tiles.find(t => t.active === true);
                   
                  if(playerID === ctx.currentPlayer){
                    fleet = activeTile.tdata.attacker;
                  }
                  else{
                    fleet = activeTile.tdata.fleet;
                  }
                  
                  const technologies = getUnitsTechnologies([...Object.keys(fleet), 'fighter', 'mech'], G.races[playerID]);
  
                  hits && Object.keys(hits).forEach(unit => { //hits assignment
                    if(hits[unit].length){
                      hits[unit].forEach((car, i) => {
                        if(car.hit){
                          if(!fleet[unit][car.idx].hit) fleet[unit][car.idx].hit = 0;
                          fleet[unit][car.idx].hit += car.hit;
                        }

                        if(car.payload && car.payload.length){
                          car.payload.forEach((p, j) => {
                            if(p.hit){
                              const pl = fleet[unit][car.idx].payload[p.pidx];
                              if(!pl.hit) pl.hit = 0;
                              pl.hit += p.hit;
                            }
                          })
                        }
                      });
                    }  
                  });

                  Object.keys(fleet).forEach(f => { //remove destroyed units
                    fleet[f].forEach((car, i) => {
                      if(car.hit > 1 || (car.hit === 1 && !technologies[f].sustain)){
                        delete fleet[f][i];
                      }
                      else if(car.payload && car.payload.length){
                        car.payload.forEach((p, idx) => {
                          if(p.hit > 1 || (p.hit === 1 && !technologies[p.id].sustain)){
                            delete fleet[f][i].payload[idx];
                          }
                        });
                        car.payload = car.payload.filter(p => p);
                      }
                    });
                    fleet[f] = fleet[f].filter(car => car);
                    if(fleet[f].length === 0) delete fleet[f];
                  });
                  
                  if(!(activeTile.tdata.attacker && Object.keys(activeTile.tdata.attacker).length) ||
                    !(activeTile.tdata.fleet && Object.keys(activeTile.tdata.fleet).length)){
                    events.setStage('spaceCombat_await'); //end space battle
                  }
                  else{
                    if(G.races[playerID].retreat){ //if I retreat
                      events.setStage('combatRetreat');
                    }
                    else{
                      let needAwait = true; //wait before new round or while enemy retreat
                      Object.keys(ctx.activePlayers).forEach(pid => {
                        if(ctx.activePlayers[pid] === 'spaceCombat_await') needAwait = false;
                      });
                      
                      if(needAwait){
                        events.setStage('spaceCombat_await');
                      }
                      else{
                        const val = {};
                        val[activeTile.tdata.occupied] = {stage: 'spaceCombat'};
                        val[ctx.currentPlayer] = {stage: 'spaceCombat'};
                        
                        G.dice[activeTile.tdata.occupied] = {};
                        G.dice[ctx.currentPlayer] = {};
                        events.setActivePlayers({value: val});
                      }
                    }
                  }

                 } 
                }
              },
              spaceCombat_await:{
                moves: {
                  endBattle: ({G, events, playerID, ctx}) => {
                    const activeTile = G.tiles.find(t => t.active === true);

                    if(!Object.keys(activeTile.tdata.fleet).length && Object.keys(activeTile.tdata.attacker).length){
                      if(ctx.currentPlayer === playerID){
                        activeTile.tdata.fleet = {...activeTile.tdata.attacker};
                        delete activeTile.tdata.attacker;
                        activeTile.tdata.occupied = playerID;
                      }
                    }
                    else if(String(activeTile.tdata.occupied) === String(playerID)){
                      delete activeTile.tdata.attacker;
                    }
                    G.races[playerID].retreat = undefined;
                    events.endStage();
                  }
                }
              },
              combatRetreat: {
                moves: {
                  nextStep: ({G, ctx, playerID, events}, selectedTile, escFleet, escGround) => {
                    const returnToCombat = () => {
                      G.dice[activeTile.tdata.occupied] = {};
                      G.dice[ctx.currentPlayer] = {};
                      G.races[playerID].retreat = undefined;

                      const ap = {...ctx.activePlayers};
                      Object.keys(ap).forEach(pid => ap[pid] = 'spaceCombat');
                      events.setActivePlayers({value: ap});
                    }

                    const activeTile = G.tiles.find(t => t.active === true);

                    if(selectedTile > -1 && Object.keys(escFleet).length){
                      const neighs = neighbors([activeTile.q, activeTile.r]).toArray();
                      const possible = neighs.filter(n => {
                          const tile = G.tiles.find(t => t.tid === n.tileId);

                          if(tile && tile.tdata){
                              if(tile.tdata.occupied !== undefined){
                                  return String(tile.tdata.occupied) === String(playerID);
                              }
                              if(tile.tdata.planets){
                                  for(var i=0; i<tile.tdata.planets.length; i++){
                                      if(String(tile.tdata.planets[i].occupied) === String(playerID)) return true;
                                  }
                              }
                          }
                          return false;
                      });

                      const hex = possible.find(t => t.tileId === G.tiles[selectedTile].tid);

                      if(hex){
                        const tile = G.tiles.find(t => t.tid === hex.tileId);
                        const forces = (playerID === ctx.currentPlayer ? activeTile.tdata.attacker : activeTile.tdata.fleet);

                        if(escGround && Object.keys(escGround).length){ //load ground units
                          let payload = [];

                          Object.keys(escGround).forEach(tag => { //remove from src
                            escGround[tag].forEach(elem => {
                              const planet = activeTile.tdata.planets.find(p => p.name === elem.pname);
                              payload.push({...planet.units[tag][elem.idx], id: tag});
                              planet.units[tag][elem.idx] = undefined;
                              planet.units[tag] = planet.units[tag].filter(e => e);
                              if(!planet.units[tag].length) delete planet.units[tag];
                            });
                          });

                          const technologies = getUnitsTechnologies(Object.keys(escFleet), G.races[playerID]); //load
                          Object.keys(escFleet).forEach(tag => {
                            escFleet[tag].forEach(elem => {
                              if(technologies[tag] && technologies[tag].capacity){
                                if(!forces[tag][elem].payload) forces[tag][elem].payload=[];
                                while((forces[tag][elem].payload.length < technologies[tag].capacity) && payload.length){
                                  forces[tag][elem].payload.push(payload.pop());
                                }
                              }
                            });
                          });
                        }

                        if(!tile.tdata.fleet) tile.tdata.fleet = {};
                        
                        Object.keys(escFleet).forEach(tag => { //move fleet to dst
                          if(!tile.tdata.fleet[tag]) tile.tdata.fleet[tag] = [];
                          escFleet[tag].forEach(elem => {
                            tile.tdata.fleet[tag].push({...forces[tag][elem]});
                            forces[tag][elem] = undefined;
                          });
                        });

                        Object.keys(forces).forEach(tag => {
                          forces[tag] = forces[tag].filter(e => e);
                          if(!forces[tag].length) delete forces[tag];
                        })

                        
                        if(activeTile.tdata.attacker && Object.keys(activeTile.tdata.attacker).length &&
                        activeTile.tdata.fleet && Object.keys(activeTile.tdata.fleet).length){
                          returnToCombat(); //if both space forces
                        }
                        else{
                          events.setStage('spaceCombat_await'); //else end combat
                        }
                      }
                      else{
                        returnToCombat();
                      }

                    }
                    else{
                      returnToCombat();
                    }

                  }
                }
              },
              bombardment: {
                moves: {
                  rollDice: ({G, playerID, random}, unit, count) => {
                    const dice = random.D10(count || 1);
                    G.dice = produce(G.dice, draft => {
                      draft[playerID][unit] = dice;
                    });
                  },
                  nextStep: ({events, playerID, ctx}, hits) => {
                    if(String(playerID) === String(ctx.currentPlayer)){
                      events.setStage('invasion_await');
                    }
                    else if(hits && Object.keys(hits).reduce((a,b) => a + hits[b], 0) === 0){
                      events.setStage('invasion_await');
                    }
                    else{
                      events.setStage('invasion_step2');
                    }
                  }
                }
              },
              invasion : {
                moves: {
                  rollDice: ({G, playerID, random}, unit, count) => {
                    const dice = random.D10(count || 1);
                    G.dice = produce(G.dice, draft => {
                      draft[playerID][unit] = dice;
                    });
                  },
                  nextStep: ({G, events, playerID, ctx}, hits) => {

                    const activeTile = G.tiles.find(t => t.active === true);
                    const activePlanet = activeTile.tdata.planets.find(p => p.invasion);
                    const uk = Object.keys(activePlanet.units);

                    if(uk.indexOf('infantry') === -1 && uk.indexOf('mech') === -1){
                      if(ctx.currentPlayer === playerID){
                        if(hits && hits[activePlanet.occupied]){
                          events.setStage('invasion_step2');
                        }
                        else{
                          events.setStage('invasion_await');
                        }
                      }
                      else{
                        events.setStage('invasion_await');
                      }
                    }
                    else{
                      if(hits && Object.keys(hits).reduce((a,b) => a + hits[b], 0) === 0){
                        Object.keys(hits).forEach(pid => G.dice[pid] = {});
                        events.setStage('invasion');
                      }
                      else{
                        events.setStage('invasion_step2');
                      }
                    }
                   
                  }
                }
              },
              invasion_step2 : {
                moves: {
                  rollDice: ({G, playerID, random}, unit, count) => {
                    const dice = random.D10(count || 1);
                    G.dice = produce(G.dice, draft => {
                      draft[playerID][unit] = dice;
                    });
                  },
                  nextStep: ({G, playerID, ctx, events}, hits) => {
                    let fleet = {};
                    const activeTile = G.tiles.find(t => t.active === true);
                    const activePlanet = activeTile.tdata.planets.find(p => p.invasion);
                    if(!activePlanet.invasion.nopds) activePlanet.invasion.nopds = true;
                    
                    const defenderForces = () => {
                        const result = {};
                        Object.keys(activePlanet.units).forEach(k => {
                            if(['infantry', 'mech'].indexOf(k) > -1){
                                result[k] = activePlanet.units[k];
                            }
                        });
                        return result;
                    }

                    if(playerID === ctx.currentPlayer){
                      fleet = activePlanet.invasion.troops;
                    }
                    else{
                      fleet = activePlanet.units;
                    }
                    
                    hits && Object.keys(hits).forEach(unit => { //hits assignment
                      if(hits[unit].length){
                        hits[unit].forEach((car, i) => {
                          if(car.hit){
                            if(!fleet[unit][car.idx].hit) fleet[unit][car.idx].hit = 0;
                            fleet[unit][car.idx].hit += car.hit;
                          }
                        });
                      }  
                    });
  
                    Object.keys(fleet).forEach(f => { //remove destroyed units
                      fleet[f].forEach((car, i) => {
                        if((car.hit === 1 && f !== 'mech') || car.hit > 1){
                          delete fleet[f][i];
                        }
                      });
                      fleet[f] = fleet[f].filter(car => car);
                      if(fleet[f].length === 0) delete fleet[f];
                    });
                    
                    const defs = defenderForces();
                    if(!(activePlanet.invasion.troops && Object.keys(activePlanet.invasion.troops).length) ||
                      !(defs && Object.keys(defs).length)){
                      events.setStage('invasion_await'); //end space battle
                    }
                    else{
                      let needAwait = true; //wait before new round
                      Object.keys(ctx.activePlayers).forEach(pid => {
                        if(ctx.activePlayers[pid] === 'invasion_await') needAwait = false;
                      });
                      
                      if(needAwait){
                        events.setStage('invasion_await');
                      }
                      else{
                        const val = {};
                        val[activePlanet.occupied] = {stage: 'invasion'};
                        val[ctx.currentPlayer] = {stage: 'invasion'};
                        
                        G.dice[activePlanet.occupied] = {};
                        G.dice[ctx.currentPlayer] = {};
                        events.setActivePlayers({value: val});
                      }
                      
                    }
  
                  } 
                }
              },
              invasion_await:{
                moves: {
                  endBattle: ({G, events, playerID, ctx}) => {
                    const activeTile = G.tiles.find(t => t.active === true);
                    const activePlanet = activeTile.tdata.planets.find(p => p.invasion);

                    if(activePlanet){
                      const defenderForces = () => {
                        const result = {};
                        Object.keys(activePlanet.units).forEach(k => {
                            if(['infantry', 'mech'].indexOf(k) > -1){
                                result[k] = activePlanet.units[k];
                            }
                        });
                        return result;
                      }

                      if(!Object.keys(defenderForces()).length && Object.keys(activePlanet.invasion.troops).length){
                        if(ctx.currentPlayer === playerID){
                          activePlanet.units = {...activePlanet.invasion.troops};
                          delete activePlanet.invasion;
                          activePlanet.occupied = playerID;
                        }
                      }
                      else if(String(activePlanet.occupied) === String(playerID)){
                        delete activePlanet.invasion;
                      }
                    }

                    events.endStage();
                  },

                  landTroops: ({G, ctx, events}, troops) => {
                    const activeTile = G.tiles.find(t => t.active === true);
                    const activePlanet = activeTile.tdata.planets.find(p => p.invasion);

                    if(!troops || troops.length === 0){ //cancel landing
                      G.dice[activePlanet.occupied] = {};
                      G.dice[ctx.currentPlayer] = {};
                      
                      activePlanet.invasion = undefined;
                      events.setActivePlayers({});
                    }
                    else{
                      if(!activePlanet.invasion.troops) activePlanet.invasion.troops = {};

                      troops.forEach(t => {
                        const split = t.split('.'); //car tag, car idx, payload idx
                        const troop = activeTile.tdata.fleet[split[0]][split[1]].payload[split[2]];

                        if(!activePlanet.invasion.troops[troop.id]) activePlanet.invasion.troops[troop.id]=[];
                        activePlanet.invasion.troops[troop.id].push({...troop});
                        delete activeTile.tdata.fleet[split[0]][split[1]].payload[split[2]];
                      });

                      //clean empty
                      Object.keys(activeTile.tdata.fleet).forEach(k => {
                        activeTile.tdata.fleet[k].forEach(car => {
                          if(car.payload) car.payload = car.payload.filter(p => p);
                        });
                      })

                      if(ctx.activePlayers[activePlanet.occupied] === 'invasion_await'){
                        const val = {};
                        val[activePlanet.occupied] = {stage: 'invasion'};
                        val[ctx.currentPlayer] = {stage: 'invasion'};
                        
                        G.dice[activePlanet.occupied] = {};
                        G.dice[ctx.currentPlayer] = {};
                        events.setActivePlayers({value: val});
                      }
                      else{
                        events.setStage('invasion_await');
                      }
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

              //space cannon
              if(!G.spaceCannons && !ctx.activePlayers){
                const activeTile = G.tiles.find(t => t.active === true);

                if(activeTile && (activeTile.tdata.attacker || (activeTile.tdata.fleet && activeTile.tdata.occupied === ctx.currentPlayer))){
                  let spaceCannons = {};
                  //enemy's pds at same tile
                  if(activeTile.tdata.planets){
                    activeTile.tdata.planets.forEach(p =>{ 
                      if(p.occupied !== undefined && p.occupied != ctx.currentPlayer && p.units && p.units.pds){
                        spaceCannons[p.occupied] = 'spaceCannonAttack';
                      }
                    });
                  }

                  //cannon in adjacent systems
                  const races = G.races.filter((r, i) => i != ctx.currentPlayer && r.technologies.find(t => t.id === 'PDS').spaceCannon.range > 1).map(r => r.rid);

                  if(races.length > 0){
                    const neighs = neighbors([activeTile.q, activeTile.r]).toArray();
                    neighs.forEach(n => {
                      if(n.tdata.planets){
                        n.tdata.planets.forEach(p =>{ 
                          if(races.indexOf(p.occupied) > -1 && p.units && p.units.pds){
                            spaceCannons[p.occupied] = 'spaceCannonAttack';
                          }
                        });
                      }
                    });
                  }
                
                  if(spaceCannons && Object.keys(spaceCannons).length > 0){
                    G.spaceCannons = spaceCannons;
                  }
                }
                
              }
              else if(G.spaceCannons && ctx.activePlayers && ctx.activePlayers[ctx.currentPlayer] === 'spaceCannonAttack_step2'){
                delete G['spaceCannons'];
              }

            },
            onEnd: ({G, ctx, events}) => {
              G.strategy = undefined;
            }
        },
        moves: {
          producing: ({G, playerID}, pname, deploy, exhausted, tg) => {

            if(!pname || !deploy) return;

            if(exhausted && exhausted.length){
              G.tiles.forEach(tile => {
                const planets = tile.tdata.planets;

                if(planets && planets.length){
                  planets.forEach( p => {
                    if(String(p.occupied) === String(playerID)){
                      if(exhausted.indexOf(p.name) > -1){
                        p.exhausted = true;
                      }
                    }
                  });
                }
              });
            }

            if(tg){
              G.races[playerID].tg -= tg;
            }
            
            const activeTile = G.tiles.find(t => t.active === true);
            const planet = activeTile.tdata.planets.find(p => p.name === pname);
            const ukeys = Object.keys(deploy);

            ukeys.forEach(uk => {
              const ukl = uk.toLowerCase();
              var l = 0;
              if(['carrier', 'cruiser', 'destroyer', 'dreadnought', 'flagship', 'warsun'].indexOf(ukl) > -1){
                if(!activeTile.tdata.fleet[ukl]) activeTile.tdata.fleet[ukl] = [];
                for(l=0; l<deploy[uk]; l++){
                  activeTile.tdata.fleet[ukl].push({});
                }
              }
              else{
                if(!planet.units[ukl]) planet.units[ukl] = [];
                for(l=0; l<deploy[uk]; l++){
                  planet.units[ukl].push({});
                }                                    
              }
            });
                 
          },
          invasion: ({G, playerID, events}, planet) => {
            const activeTile = G.tiles.find(t => t.active === true);
            const activePlanet = activeTile.tdata.planets.find(p => p.name === planet.name);
            const defUnits = Object.keys(activePlanet.units);
            
            let stage = 'bombardment';
            if(defUnits.indexOf('infantry') === -1 && defUnits.indexOf('mech') === -1){ //if only pds
              stage = 'invasion_await';
            }

            activePlanet.invasion = {};

            const def = {};
            def[planet.occupied] = {stage};
            
            G.dice[planet.occupied] = {};
            G.dice[playerID] = {};
            
            events.setActivePlayers({value: def, currentPlayer: {stage}});
          },
          spaceCannonAttack: ({G, playerID, events}) => {
            if(G.spaceCannons && Object.keys(G.spaceCannons).length > 0){
              const sc = {};
              Object.keys(G.spaceCannons).forEach(pid => {
                sc[pid] = {stage: 'spaceCannonAttack'}
                G.dice[pid] = {};
              });

              G.dice[playerID] = {};
              events.setActivePlayers({value: sc, currentPlayer: {stage: 'spaceCannonAttack'}});
            }
          },
          antiFighterBarrage: ({G, playerID, events}) => {
            const activeTile = G.tiles.find(t => t.active === true);
            if(activeTile && activeTile.tdata.attacker){
              const def = {};
              def[activeTile.tdata.occupied] = {stage: 'antiFighterBarrage'};
              
              G.dice[activeTile.tdata.occupied] = {};
              G.dice[playerID] = {};
              events.setActivePlayers({value: def, currentPlayer: {stage: 'antiFighterBarrage'}});
            }
          },
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
                      const unit = {...G.tiles[src.tile].tdata.planets[src.planet].units[src.unit].pop(), id: src.unit};
                      if(G.tiles[src.tile].tdata.planets[src.planet].units[src.unit].length === 0) delete G.tiles[src.tile].tdata.planets[src.planet].units[src.unit];
                      G.tiles[src.tile].tdata.fleet[dst.unit][dst.i].payload[dst.j] = unit;
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
              if(!to.units[from[src.i].payload[src.j].id]){
                to.units[from[src.i].payload[src.j].id] = [];
              }

              const unit = G.tiles[src.tile].tdata.fleet[src.unit][src.i].payload[src.j];
              to.units[from[src.i].payload[src.j].id].push(unit);
              delete G.tiles[src.tile].tdata.fleet[src.unit][src.i].payload[src.j];
              G.tiles[src.tile].tdata.fleet[src.unit][src.i].payload = 
                G.tiles[src.tile].tdata.fleet[src.unit][src.i].payload.filter(p => p);

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
            let isAttack = false;

            if(dst && src && unit){
              if( dst.tdata.occupied != playerID ){
                if(dst.tdata.fleet && Object.keys(dst.tdata.fleet).length > 0){
                  isAttack = true;
                }
                else{
                  dst.tdata.occupied = playerID;
                }
              }

              if(!isAttack){
                if(!dst.tdata.fleet) dst.tdata.fleet = {};
                if(!dst.tdata.fleet[args.unit]) dst.tdata.fleet[args.unit] = [];
                dst.tdata.fleet[args.unit].push(unit);
              }
              else{
                if(!dst.tdata.attacker) dst.tdata.attacker = {};
                if(!dst.tdata.attacker[args.unit]) dst.tdata.attacker[args.unit] = [];
                dst.tdata.attacker[args.unit].push(unit);
              }

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
          },
          trade: ({G, playerID}, args) => {
            const src = G.races[playerID];
            const dst = G.races.find(r => r.rid === args.rid);
           
            if(args.tradeItem === 'tg' && src.tg > 0){
              src.tg--;
              dst.tg++;
            }
            else if(args.tradeItem === 'commodity' && src.commodity > 0){
              src.commodity--;
              dst.tg++;
            }
            else if(args.tradeItem.startsWith('fragment.')){
              const frag = args.tradeItem.substr(args.tradeItem.indexOf('.') + 1);
              if(src.fragments[frag] > 0){
                src.fragments[frag]--;
                dst.fragments[frag]++;
              }
            }
            else if(args.tradeItem.startsWith('promissory.')){
              const cid =  args.tradeItem.substr(args.tradeItem.indexOf('.') + 1);
              const card = src.promissory.find(c => c.id === cid);
              if(card){
                if(card.owner){
                  if(card.owner === dst.rid){
                    dst.promissory.find(c => c.id === cid && c.sold === src.rid).sold = undefined;
                  }
                  else{
                    dst.promissory.push({...card});
                    G.races.find(r => r.rid === card.owner).promissory.find(c => c.id === cid && c.sold === src.rid).sold = dst.rid;
                  }
                  src.promissory.splice(src.promissory.findIndex(c => c.id === cid && c.owner === dst.rid), 1);
                }
                else if(!card.sold){
                  dst.promissory.push({...card, owner: src.rid});
                  card.sold = dst.rid;
                }
              }
            }
            else if(args.tradeItem.startsWith('relic.')){
              const cid =  args.tradeItem.substr(args.tradeItem.indexOf('.') + 1);
              const card = src.relics.find(c => c.id === cid);
              if(card){
                dst.relics.push({...card});
                src.relics = src.relics.filter(c => c.id !== cid);
              }
            }
            else if(args.tradeItem.startsWith('action.')){
              const cid =  args.tradeItem.substr(args.tradeItem.indexOf('.') + 1);
              const card = src.actionCards.find(c => c.id === cid);
              if(card){
                dst.actionCards.push({...card});
                src.actionCards.splice(src.actionCards.findIndex(c => c.id === cid), 1);
              }
            }
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


const loadUnitsOnRetreat = (G, playerID) => {
  
  const activeTile = G.tiles.find(t => t.active === true);

  if(String(activeTile.tdata.occupied) === String(playerID) && activeTile.tdata.planets){ //load fighters and mech if capacity
    const fleet = activeTile.tdata.fleet;
    
    Object.keys(fleet).forEach(tag => {

      const technology = G.races[playerID].technologies.find(t => t.id === tag.toUpperCase());

      if(technology && technology.capacity){
        fleet[tag].forEach((car, c) => {
          if(!car.payload) car.payload=[];
          
          for(var i=0; i<technology.capacity; i++){
              if(car.payload.length < i) car.payload.push({});
              const place = car.payload[i];

              activeTile.tdata.planets.forEach(planet => {
                if(String(planet.occupied) === String(playerID)){
                  if(!place || !place.id){
                    if(planet.units.fighter && planet.units.fighter.length){
                      car.payload.push({...planet.units.fighter[0], id: 'fighter'});
                      planet.units.fighter.splice(0,1);
                      if(planet.units.fighter.length === 0) delete planet.units['fighter'];
                    }
                    else if(planet.units.mech && planet.units.mech.length){
                      car.payload.push({...planet.units.mech[0], id: 'mech'});
                      planet.units.mech.splice(0,1);
                      if(planet.units.mech.length === 0) delete planet.units['mech']
                    } 
                  }
                }
              });

              car.payload = car.payload.filter( p => p.id);
          }
          
        });
      }

    });
  }
  
}
