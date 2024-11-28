/* eslint eqeqeq: 0 */
import { INVALID_MOVE, TurnOrder } from 'boardgame.io/core';
import cardData from './cardData.json';
import { getHexGrid, neighbors } from './Grid';
import { ACTION_CARD_STAGE, ACTS_STAGES, STRAT_MOVES, secretObjectiveConfirm, useRelic, usePromissory, dropSecretObjective, ACTS_MOVES, STATS_MOVES } from './gameStages';
import { haveTechnology, getPlanetByName, votingProcessDone, dropACard, checkSecretObjective, 
 getInitRaces, getInitTiles, doFlagshipAbility, getRaceVP} from './utils';
import { EffectsPlugin } from './effects/plugin.js';
import { botMove } from './botPlugin_ss.js';
//import settings from '../package.json'

const effectsConfig = EffectsPlugin({
  effects: {
    promissory:{
      create: (value) => value,
    },
    trade: {
      create: (value) => value,
      //duration: 1
    },
    tg: {
      create: () => {}
    },
    rift: {
      create: (value) => value
    },
    relic_ex: {
      create: (value) => value,
      //duration: 2
    },
    planet: {
      create: (value) => ({pname: value.pname, playerID: value.playerID})
    },
    pass: {
      create: (value) => value
    }
  },
});

export const TIO = {
    name: 'TIO',
    plugins: [effectsConfig],
    validateSetupData: (setupData, numPlayers) => {
      if(!setupData || !setupData.mapArray){
        return 'setup data not valid';
      }
    },
    setup: ({ctx}, setupData) => {

      const HexGrid = getHexGrid(setupData.mapArray);
      const hg = HexGrid.toArray().filter(a => a);
      const races = getInitRaces(hg, ctx.numPlayers, setupData.colors, setupData.players);
      
      return {
        matchName: setupData.matchName || 'New game',
        speaker: races[0].rid,
        mapArray: setupData.mapArray, 
        tiles: getInitTiles(hg, races),
        pubObjDeck: [],
        pubObjectives: [],
        secretObjDeck: [],
        actionsDeck: [],
        explorationDecks: {cultural:[], hazardous:[], industrial:[], frontier:[]},
        agendaDeck: [],
        relicsDeck: [],
        passedPlayers: [],
        laws: [],
        TURN_ORDER: races.map((r,i)=>i),
        races,
        dice: (new Array(ctx.numPlayers)).map(a => { return {}}),
        HexGrid: JSON.stringify(HexGrid),
        vp: setupData.vp || 10,
        discardedActions: [],
        players: setupData.players
      }
    },

    deltaState: true, //important to proper effects work!
    minPlayers: 1,
    maxPlayers: 8,

    phases: {
      strat: {
        start: true,
        next: 'acts',
        turn: {
          order: TurnOrder.CUSTOM_FROM('TURN_ORDER'),
          /*minMoves: 0,
          maxMoves: 1,*/
          stages: {
            actionCard: ACTION_CARD_STAGE
          },

          onBegin: ({G, ctx, events, random, ...plugins}) => {
            if(G.races[ctx.currentPlayer].exhaustedCards.indexOf('Political Stability') > -1){
              events.endTurn();
            }

            if(G.races[ctx.currentPlayer].isBot) botMove({G, ctx, events, random, playerID: ctx.currentPlayer, plugins});
          }
        },
        moves: STRAT_MOVES,
        onBegin: ({ G, ctx, random, events }) => {
         try{
            if(!G.pubObjDeck || !G.pubObjDeck.length){
              G.pubObjDeck = random.Shuffle(cardData.objectives.public.filter( o => o.vp === 1 ));
              G.pubObjectives.push({...G.pubObjDeck.pop(), players: []});
              G.pubObjectives.push({...G.pubObjDeck.pop(), players: []});
              //G.pubObjectives.push({...cardData.objectives.public.find(o => o.id === 'Adapt New Strategies'), players: []});
            }

            if(!G.actionsDeck.length){
              const deck = [];
              cardData.actions.filter(a => !a.mod).forEach(a => {
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

            //G.races[ctx.currentPlayer].actionCards.push(G.actionsDeck.find(a => a.id === 'Warfare Rider')) //test only

            if(!G.explorationDecks['cultural'].length){ //need purge GammaWormhole on deck reuse case
                
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
                //no shuffle for testing only!!
                //G.explorationDecks[k] = deck;
                G.explorationDecks[k] = random.Shuffle(deck); 
              });

            }

            if(!G.agendaDeck.length){
              G.agendaDeck = random.Shuffle(cardData.agenda.filter(a => a.ready));
              //G.agendaDeck.push({...cardData.agenda.find(a => a.elect === 'Planet')});
            }

            if(!G.relicsDeck.length){
              G.relicsDeck = random.Shuffle(cardData.relics.filter(r => !r.mod));
              //G.races[ctx.currentPlayer].relics.push(...G.relicsDeck) //test only!
            }

            if(!G.secretObjDeck.length){
              G.secretObjDeck = random.Shuffle(cardData.objectives.secret);
              G.races.forEach(r => {
                r.secretObjectives.push(...G.secretObjDeck.splice(-1)); //2!
                //r.mustDropSecObj = true;

                //r.secretObjectives.push({...G.secretObjDeck.find(o => o.id === 'Destroy Heretical Works'), players: []});
              });
            }

            if(G.NEW_CONSTITUTION){
              delete G['NEW_CONSTITUTION'];
              
              G.races.forEach(r => {
                const home = G.tiles.find(t => t.tid === r.rid);
                if(home && home.tdata && home.tdata.planets){
                  home.tdata.planets.forEach(p => p.exhausted = true)
                }
              })
            }
            //events.endPhase(); //test only!
          }
          catch(e){
            console.log(e)
          }
        },
        onEnd: ({ G }) => {
          G.TURN_ORDER = G.races.map((r, i) => ({initiative: r.initiative, i})).sort((a, b) => a.initiative > b.initiative ? 1 : (a.initiative < b.initiative ? -1 : 0)).map(r => r.i);
          
          G.races.forEach(r => {
            if(r.forbiddenStrategy) delete r.forbiddenStrategy;
          });
        },
        endIf: ({ G, ctx }) => {
          const cardsCount = ctx.numPlayers > 4 ? 1 : 2;
          return ctx.playOrder.every( r => G.races[r].strategy.length === cardsCount );
        }
      },
      acts: {
        next: 'stats',
        turn: {
            //order: TurnOrder.CUSTOM_FROM('TURN_ORDER'),
            
            order: {
              first: () => 0,
              next: ({ G, ctx }) => {
                try{
                  if(G.passedPlayers.length >= ctx.numPlayers) return;

                  let pos = ctx.playOrderPos;
                  
                  do{
                    pos = (pos + 1) % ctx.numPlayers;
                  }
                  while(G.passedPlayers.includes(String(G.TURN_ORDER[pos])));

                  return pos;
                }
                catch(e){console.log(e)}
              },
              playOrder: ({ G, ctx }) => G.TURN_ORDER
            },

            stages: ACTS_STAGES,

            onBegin: ({ G, ctx, random, events, ...plugins }) => {
              G.tiles.filter(t => t.active === true).forEach( t => { 
                t.active = undefined;
                if(t.tdata && t.tdata.ceasefire) t.tdata.ceasefire = undefined; 
              });
              G.races[ctx.currentPlayer].actions = [];
              G.races[ctx.currentPlayer].destroyedUnits = [];
              G.tiles.forEach(t => {
                if(t.tdata.planets){
                  t.tdata.planets.forEach(p => {
                    if(p.experimentalBattlestation) delete p['experimentalBattlestation'];
                  });
                }
              });

              if(G.races[ctx.currentPlayer].isBot) botMove({G, playerID: ctx.currentPlayer, ctx, events, random, plugins});
            },

            onMove: ({ G, ctx, playerID, ...plugins }) => {

              try{
                if(!ctx.activePlayers || !ctx.activePlayers[playerID]){
                  G.races[playerID].combatActionCards = [];

                  if(G.races[playerID].relics && G.races[playerID].relics.find(r => r.id === 'The Crown of Thalnos')){
                    G.races[playerID].combatActionCards.push('The Crown of Thalnos');
                  }

                  if(G.races[playerID].preCombatActionCards && G.races[playerID].preCombatActionCards.length){
                    G.races[playerID].combatActionCards.push(...G.races[playerID].preCombatActionCards);
                    G.races[playerID].preCombatActionCards = [];
                  }
                }

                //space cannon todo: make this check more selective, not after each move
                if(!G.spaceCannons && !ctx.activePlayers){
                  const activeTile = G.tiles.find(t => t.active === true);

                  if(activeTile && (activeTile.tdata.attacker || (activeTile.tdata.fleet && String(activeTile.tdata.occupied) === String(ctx.currentPlayer)) )){

                    if(!activeTile.tdata.spaceCannons_done && !G.races[ctx.currentPlayer].spaceCannonsImmunity){
                      let spaceCannons = {};
                      //enemy's pds at same tile
                      if(activeTile.tdata.planets){
                        activeTile.tdata.planets.forEach(p =>{ 
                          if(p.occupied !== undefined && p.occupied != ctx.currentPlayer && p.units && (p.units.pds || p.experimentalBattlestation)){
                            spaceCannons[p.occupied] = 'spaceCannonAttack';
                          }
                        });
                      }

                      //cannon in adjacent systems
                      const races = G.races.filter((r, i) => i != ctx.currentPlayer && r.technologies.find(t => t.id === 'PDS').spaceCannon.range > 1).map(r => String(r.rid));
                      const neighs = neighbors(G.HexGrid, [activeTile.q, activeTile.r]);

                      neighs.forEach(nei => {
                        const n = G.tiles.find(t => t.tid === nei.tileId);

                        if(n.tdata.planets){
                          n.tdata.planets.forEach(p =>{ 
                            if(p.experimentalBattlestation || (p.occupied !== undefined && G.races[p.occupied] && races.indexOf(String(G.races[p.occupied].rid)) > -1 && p.units && p.units.pds)){
                              spaceCannons[p.occupied] = 'spaceCannonAttack';
                            }
                          });
                        }
                      });
                    
                      if(spaceCannons && Object.keys(spaceCannons).length > 0){
                        G.spaceCannons = spaceCannons;
                      }
                    }
                  }
                  
                }
                else if(G.spaceCannons && ctx.activePlayers && ctx.activePlayers[ctx.currentPlayer] === 'spaceCannonAttack_step2'){
                  delete G['spaceCannons'];
                }
              }
              catch(e){
                console.log(e)
              }


            },

            onEnd: ({G, ctx}) => {
              G.strategy = undefined;
              G.spaceCombat = {};
              if(G.wormholesAdjacent) delete G['wormholesAdjacent'];
              if(G.races[ctx.currentPlayer].moveBoost) delete G.races[ctx.currentPlayer]['moveBoost'];
              if(G.races[ctx.currentPlayer].moveThroughEnemysFleet) delete G.races[ctx.currentPlayer]['moveThroughEnemysFleet'];
              if(G.races[ctx.currentPlayer].spaceCannonsImmunity) delete G.races[ctx.currentPlayer]['spaceCannonsImmunity'];

              const myProds = G.tiles.filter(t =>{ 
                if(t.tdata.producing_done === true){
                  if(String(t.tdata.occupied) === String(ctx.currentPlayer)){
                    return true;
                  }
                  else{
                    if(t.tdata.planets && t.tdata.planets.find(p => String(p.occupied) === String(ctx.currentPlayer))){
                      return true;
                    }
                  }
                }
                return false;
              });
              myProds.forEach(t => t.tdata.producing_done = undefined);

              G.tiles.forEach(t => {
                if(t.tdata.planets){
                  t.tdata.planets.forEach(p => {
                    if(p.exploration) delete p['exploration'];
                  });
                }
              });
            }
        },
        moves: ACTS_MOVES,
        onEnd: ({ G }) => {
          G.tiles.forEach( t => t.tdata.tokens = []);
          G.passedPlayers = [];
        },
        onBegin: ({ G, random }) => {
          G.passedPlayers = [];
          G.races.forEach(r => {r.combatActionCards = []; r.destroyedUnits = []}); 
        },
        endIf: ({ G, ctx }) => G.passedPlayers.length === ctx.numPlayers
      },
      stats: {
        next: ({G}) => G.tiles[0].tdata.planets[0].occupied === undefined ? 'strat':'agenda',
        turn: {
          order: TurnOrder.CUSTOM_FROM('TURN_ORDER'),
          stages: {
            actionCard: ACTION_CARD_STAGE
          },
          onBegin: ({G, ctx, events, random, ...plugins}) => {
            if(G.races[ctx.currentPlayer].isBot) botMove({G, playerID: ctx.currentPlayer, ctx, events, random, plugins});
          }
        },
        moves: STATS_MOVES,
        onBegin: ({ G, events, ctx, random, ...plugins }) => {
          G.passedPlayers = [];

          G.races.forEach(r => {
            let c = haveTechnology(r, 'HYPER_METABOLISM') ? 3:2;
            if(r.rid === 1) c++;
            
            let possible = 16 - (r.tokens.t + r.tokens.s + r.tokens.f + r.tokens.new);
            if(possible < 0) possible = 0;

            r.tokens.new += Math.min(c, possible);
          });
          
         // events.setPhase('agenda'); //test only!
        },
        onEnd: ({ G, random }) => {
          try{
            if(G.pubObjectives && G.pubObjectives.length === 5){
              G.pubObjDeck.push(...random.Shuffle(cardData.objectives.public.filter( o => o.vp === 2 && !G.pubObjDeck.find(p => p.id === o.id) ))); //vp2 may be added by different way
            }
            G.pubObjectives.push({...G.pubObjDeck.pop(), players: []});
            G.races.forEach( r => {
              r.actionCards.push(G.actionsDeck.pop());
              
              const law = G.laws.find(l => l.id === 'Minister of Policy');
              if(law && law.decision === r.name){
                r.actionCards.push(G.actionsDeck.pop());
              }

              if(haveTechnology(r, 'NEURAL_MOTIVATOR')){
                r.actionCards.push(G.actionsDeck.pop());
              }

              if(r.exhaustedCards.indexOf('Political Stability') === -1) r.strategy = []; 
              r.initiative = undefined;
              r.lastScoredObjType = undefined;
              r.exhaustedCards = [];
              r.combatActionCards = [];
              r.relics = r.relics.filter(r => r && !r.purged);
              r.relics.forEach(relic => relic.exhausted = false)
            });

            G.passedPlayers = [];
            let order = G.races.map((r,i)=>i);
            /*const spkIdx = G.races.findIndex(r => String(r.rid) === String(G.speaker));
            order = [...order.slice(spkIdx), ...order.slice(0, spkIdx)];
            G.TURN_ORDER = [...order.slice(1), order[0]]; //speaker at the end*/
            G.TURN_ORDER = order;
            doFlagshipAbility({G, rid: 1});

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
          catch(e){console.log(e)}
        },
        endIf: ({ G, ctx }) => G.passedPlayers.length === ctx.numPlayers
      },
      agenda: {
        next: 'strat',

        turn: {
          order: {//TurnOrder.CUSTOM_FROM('TURN_ORDER'),
            playOrder: ({ G }) => G.TURN_ORDER,
            first: ({ctx}) => ctx.numPlayers > 1 ? 1:0, //speaker at the end
            next: ({ G, ctx }) => {
              if(ctx.numPlayers === 1) return 0;

              const agendaNumber = G.vote2 ? 2:1;
              let acPlayers = 0;
              let votedPlayers = 0;

              G.races.forEach(r => {
                if(!r.actions){
                  acPlayers++;
                }
                else{
                  if(r.actions.length < agendaNumber) acPlayers++;
                  if(r.voteResults && r.voteResults.length === agendaNumber) votedPlayers++;
                }
              });

              if(acPlayers === 0){
                if(G.TURN_ORDER_IS_REVERSED === true){
                  if(votedPlayers === 0) return ctx.numPlayers - 1; //next before speaker

                  let result = 1;
                  if(ctx.playOrderPos){
                    result = ctx.playOrderPos - 1;
                  }
                  return Math.abs(result % ctx.numPlayers);
                }
                else{ 
                  if(votedPlayers === 0) return 1;
                  else return (ctx.playOrderPos + 1) % ctx.numPlayers;
                }
              }
              else{
                if(acPlayers === ctx.numPlayers) return 1;
                else return (ctx.playOrderPos + 1) % ctx.numPlayers;
              }
            }
          },
          onBegin: ({ G, ctx, events, random }) => {
            if(!ctx.activePlayers){ //pass turn if some action cards was effect
              const agendaNumber = G.vote2 ? 2:1;
              const voteResults = G.races[ctx.currentPlayer].voteResults;

              if(voteResults && voteResults.length === agendaNumber){
                if(voteResults[agendaNumber-1].vote === null){
                  if(G.races.every(r => r.voteResults.length === agendaNumber)){ // voting process done
                    if(!G.agendaDeck.length) G.agendaDeck = random.Shuffle(cardData.agenda.filter(a => a.ready));
                    votingProcessDone({G, agendaNumber, playerID: ctx.currentPlayer, events});
                  }
                  else{
                    events.endTurn();
                  }
                }
              }
            }
          },
          stages: {
            actionCard: ACTION_CARD_STAGE,
            afterVoteActionCard: {
              moves: {
                playActionCard: ({G, playerID, events, ctx}, card) => {
                  if(card.when === 'AGENDA' && card.after === true){
                    if(!G.races[ctx.currentPlayer].currentActionCard){ //no current card from active player
                      if(!G.currentAgendaActionCard){ //no current after-vote-agenda card
                        G.currentAgendaActionCard = {...card, reaction: {}, playerID};
                        events.setActivePlayers({ all: 'actionCard' });
                      }
                    }
                  }
                },
                pass: ({ctx, events}) => {
                  events.endStage();
                  if(ctx.activePlayers && Object.keys(ctx.activePlayers).length === 1) events.endTurn();
                },
                dropActionCard: dropACard,
                dropSecretObjective
              }
            }
          }
        },

        moves: {
          useRelic,
          usePromissory,
          secretObjectiveConfirm,
          dropSecretObjective,
          vote: ({G, playerID, random, events, ...plugins}, result) => {
            try{
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

              if(result.exhaustedCards && result.exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE')>-1){
                votes += 3;
                G.races[playerID].exhaustedCards.push('PREDICTIVE_INTELLIGENCE');
              }

              exhaustPlanet(result.payment.influence);
              
              let vr = {vote: result.vote, count: votes};
              if(result.exhaustedCards && result.exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE')>-1){
                vr.withTech = 'PREDICTIVE_INTELLIGENCE';
              }
              G.races[playerID].voteResults.push(vr);

              const agendaNumber = G.vote2 ? 2:1;

              if(G.races.every(r => r.voteResults.length === agendaNumber)){ // voting process done
                if(!G.agendaDeck.length) G.agendaDeck = random.Shuffle(cardData.agenda.filter(a => a.ready));
                votingProcessDone({G, agendaNumber, playerID, events});
                
                
                
                if(G['vote' + agendaNumber].id === 'Archived Secret'){
                  const elected = G.races.find(r => r.name === G['vote' + agendaNumber].decision);
                  if(elected){
                    elected.secretObjectives.push(...G.secretObjDeck.splice(-1));
                  }
                }
                else if(G['vote' + agendaNumber].id === 'Compensated Disarmament'){
                  const elected = getPlanetByName(G.tiles, G['vote' + agendaNumber].decision);
                  if(elected && elected.occupied !== undefined){
                    let count = 0;
                    if(elected.units){
                      Object.keys(elected.units).forEach(k => {
                        if(elected.units[k]) count += elected.units[k].length;
                      });
                    }

                    if(count){
                      const r = G.races[elected.occupied];
                      if(r){
                        r.tg += count;
                      }
                    }

                    elected.units = undefined;
                  }
                }
                else if(G['vote' + agendaNumber].id === 'Economic Equality'){
                  if(G['vote' + agendaNumber].decision.toUpperCase() === 'FOR'){
                    G.races.forEach(r => {
                      r.tg = 5;
                    })
                  }
                  else{
                    G.races.forEach(r => {
                      r.tg = 0;
                    })
                  }
                }
                else if(G['vote' + agendaNumber].id === 'Incentive Program'){
                  if(G['vote' + agendaNumber].decision.toUpperCase() === 'FOR'){
                    const oi = G.pubObjDeck.findIndex(o => o.vp === 1);
                    const obj = G.pubObjDeck.splice(oi, 1)[0];
                    obj.players = [];
                    G.pubObjectives.push(obj);
                  }
                  else{
                    const oi = G.pubObjDeck.findIndex(o => o.vp === 2);
                    if(oi === -1){
                      const vp2 = random.Shuffle(cardData.objectives.public.filter( o => o.vp === 2));
                      G.pubObjectives.push({...vp2.pop(), players: []});
                    }
                  }
                }
                else if(G['vote' + agendaNumber].id === 'Mutiny'){
                  if(G['vote' + agendaNumber].decision.toUpperCase() === 'FOR'){
                    G.races.forEach(r => {
                      const v = r.voteResults[agendaNumber - 1];
                      if(v && v.vote && v.vote.toUpperCase() === 'FOR'){
                        r.vp++;
                      }
                    });
                  }
                  else{
                    G.races.forEach(r => {
                      const v = r.voteResults[agendaNumber - 1];
                      if(v && v.vote && v.vote.toUpperCase() === 'FOR'){
                        if(r.vp > 0) r.vp--;
                      }
                    });
                  }
                }
                else if(G['vote' + agendaNumber].id === 'New Constitution'){
                  if(G['vote' + agendaNumber].decision.toUpperCase() === 'FOR'){
                    G.laws = [];
                    G.NEW_CONSTITUTION = true;
                  }
                }
                else if(G['vote' + agendaNumber].id === 'Shared Research'){
                  if(G['vote' + agendaNumber].decision.toUpperCase() === 'AGAINST'){
                    G.races.forEach(r => {
                      if(r.tokens.t + r.tokens.s + r.tokens.f + r.tokens.new < 16){
                        const home = G.tiles.find(t => t.tid === r.rid);

                        if(home && home.tdata){
                          if(!home.tdata.tokens) home.tdata.tokens = [];
                          home.tdata.tokens.push(r.rid);
                        }
                      }
                    })
                  }
                }
                else if(G['vote' + agendaNumber].id === 'Swords to Plowshares'){
                  if(G['vote' + agendaNumber].decision.toUpperCase() === 'FOR'){

                    G.races.forEach((r, pid) => {
                      let tg = 0;

                      G.tiles.forEach( t => {
                        if(t.tdata.planets && t.tdata.planets.length){
                    
                            t.tdata.planets.forEach(p => {
                              if(String(p.occupied) === String(pid)){
                                if(p.units && p.units.infantry && p.units.infantry.length){
                                  const count = Math.ceil(p.units.infantry.length / 2);
                                  tg += count;
                                  
                                  p.units.infantry.splice(-count);
                                  if(!p.units.infantry.length) delete p.units['infantry'];
                                  if(!Object.keys(p.units).length) delete p['units'];
                                }
                              }
                            })
                          
                        }
                      });
                      
                      r.tg += tg;
                    })
                    
                  }
                  else if(G['vote' + agendaNumber].decision.toUpperCase() === 'AGAINST'){
                    G.tiles.forEach( t => {
                      if(t.tdata.planets && t.tdata.planets.length){
                  
                          t.tdata.planets.forEach(p => {
                            if(p.occupied !== undefined){
                              if(!(p.attach && p.attach.length && p.attach.indexOf('Demilitarized Zone') > -1)){
                                if(!p.units) p.units = {};
                                if(!p.units.infantry) p.units.infantry = [];
                                p.units.infantry.push({});
                              }
                            }
                          })
                        
                      }
                    });
                  }
                }
                else if(G['vote' + agendaNumber].id === 'Unconventional Measures'){
                  if(G['vote' + agendaNumber].decision.toUpperCase() === 'FOR'){
                    G.races.forEach(r => {
                      const v = r.voteResults[agendaNumber - 1];
                      if(v && v.vote && v.vote.toUpperCase() === 'FOR'){
                        G.races[playerID].actionCards.push(...G.actionsDeck.splice(-2));
                      }
                    });
                  }
                  else{
                    G.races.forEach(r => {
                      const v = r.voteResults[agendaNumber - 1];
                      if(v && v.vote && v.vote.toUpperCase() === 'FOR'){
                        G.discardedActions.push(...G.races[playerID].actionCards);
                        G.races[playerID].actionCards = [];
                      }
                    });
                  }
                }
                else if(G['vote' + agendaNumber].id === 'Wormhole Reconstruction'){
                  if(G['vote' + agendaNumber].decision.toUpperCase() === 'AGAINST'){
                    G.tiles.forEach(t => {
                      if(t && t.tdata && (t.tdata.wormhole === 'alpha' || t.tdata.wormhole === 'beta')){
                        if(t.tdata.occupied !== undefined){
                          if(!t.tdata.tokens) t.tdata.tokens = [];
                          const rid = G.races[t.tdata.occupied].rid;
                          if(!t.tdata.tokens.includes(rid)) t.tdata.tokens.push(rid);
                        }
                      }
                    })
                  }
                }
                else if(G['vote' + agendaNumber].id === 'Armed Forces Standardization'){
                  const elected = G.races.find(r => r.name === G['vote' + agendaNumber].decision);
                  if(elected){
                    elected.tokens = {t: 3, f: 3, s: 2, new: 0}
                  }
                }
                else if(G['vote' + agendaNumber].id === 'Clandestine Operations'){
                  if(G['vote' + agendaNumber].decision.toUpperCase() === 'FOR'){
                    G.races.forEach(r => r.tokens.new -= 2)
                  }
                  else{
                    G.races.forEach(r => { if(r.tokens.f > 0) r.tokens.f-- });
                  }
                }
                else if(G['vote' + agendaNumber].id === 'Minister of Antiques'){
                  const elected = G.races.find(r => r.name === G['vote' + agendaNumber].decision);
                  if(elected && G.relicsDeck.length){
                    elected.relics.push(G.relicsDeck.pop());
                  }
                }
                
                if(G['vote' + agendaNumber].type === 'LAW' && G['vote' + agendaNumber].decision && G['vote' + agendaNumber].decision.toUpperCase() !== 'AGAINST'){
                  G.laws.push(G['vote' + agendaNumber]);
                }
                

                if(G.laws && G.laws.length > 2){
                  G.races.forEach((r, i) => {
                    checkSecretObjective(G, i, 'Dictate Policy');
                  });
                }

                if(G['vote' + agendaNumber].elect === 'Player'){
                  const electedRace = G.races.findIndex(r => r.name === G['vote' + agendaNumber].decision);
                  if(electedRace > -1) checkSecretObjective(G, electedRace, 'Drive the Debate');
                }

                if(G['vote' + agendaNumber].elect && G['vote' + agendaNumber].elect.indexOf('Planet') > -1){
                  const planet = getPlanetByName(G.tiles, G['vote' + agendaNumber].decision);
                  if(planet && planet.occupied !== undefined){
                    checkSecretObjective(G, planet.occupied, 'Drive the Debate');
                  }
                }
              }
              else if(G.vote2){
                if(G.passedPlayers.indexOf(playerID) === -1){
                  G.passedPlayers.push(playerID);
                }

                events.endTurn();
              }
              else{
                events.endTurn();
              }
              
              plugins.effects.tg();

            }
            catch(e){console.log(e)}
          },
          endVote: ({G, playerID, events}) => {
            G.passedPlayers.push(playerID);
            events.endTurn();
          },
          pass: ({G, playerID, events}) => {
            G.races[playerID].actions.push('PASS');
            events.endTurn();
          },
          dropActionCard: dropACard,
          playActionCard: ({G, playerID, events}, card) => {
            if(card.when === 'AGENDA'){
              const agendaNumber = G.vote2 ? 2:1;

              if(G.races[playerID].actions.length >= agendaNumber){
                console.log('too many actions');
                return INVALID_MOVE;
              }

              G.currentAgendaActionCard = {...card, reaction: {}, playerID};
              events.setActivePlayers({ all: 'actionCard' });
            } 
          }
        },

        onBegin: ({ G }) => {
          G.vote1 = G.agendaDeck.pop();
          G.vote2 = undefined;

          G.races.forEach( r => {r.votesMax = 0; r.voteResults = []; r.actions = []});
          
          G.tiles.forEach( t => {
            if(t.active){
              t.active = undefined;
              if(t.tdata && t.tdata.ceasefire) t.tdata.ceasefire = undefined;
            }
            if(t.tdata.planets && t.tdata.planets.length){
              t.tdata.planets.forEach(p => {
                //p.exhausted = false;

                if(p.occupied !== undefined){
                  G.races[p.occupied].votesMax += p.influence;
                }
              })
            }
          });

          G.passedPlayers = [];
          G.predict = []; //vote prediction by agenda action card
          if(G.laws && G.laws.length > 2){
            G.races.forEach((r, i) => {
              checkSecretObjective(G, i, 'Dictate Policy');
            });
          }
        },

        onEnd: ({ G, ctx }) => {
          
          /*for(var i=1; i<=2; i++){
            if(G['vote' + i].type === 'LAW' && G['vote' + i].decision.toUpperCase() !== 'AGAINST'){
              G.laws.push(G['vote' + i]);
            }
          }*/

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

          G.races.forEach(r => r.actions = []);
          G.passedPlayers = [];
          G.predict = []; //vote prediction by agenda action card

          let order = G.races.map((r,i)=>i);
          const spkIdx = G.races.findIndex(r => String(r.rid) === String(G.speaker));
          order = [...order.slice(spkIdx), ...order.slice(0, spkIdx)];
          G.TURN_ORDER = order; //speaker at the begin
        },

        endIf: ({ G, ctx }) => G.passedPlayers.length === ctx.numPlayers * 2
      }
    },
    
    endIf: ({ G, ctx }) => {
      
      let result = getRaceVP(G, ctx.currentPlayer);

      if(result >= G.vp) {
        return { winner: ctx.currentPlayer };
      }
        
    },

};

