/* eslint eqeqeq: 0 */
import { INVALID_MOVE, TurnOrder } from 'boardgame.io/core';
import { HexGrid, neighbors } from './Grid';
import tileData from './tileData.json';
import raceData from './raceData.json';
import techData from './techData.json';
import cardData from './cardData.json';
import { ACTION_CARD_STAGE, ACTS_STAGES } from './gameStages';
import { produce } from 'immer';
import { NUM_PLAYERS, checkTacticalActionCard, getUnitsTechnologies, haveTechnology, 
 getPlanetByName, votingProcessDone, dropACard, completeObjective } from './utils';

export const TIO = {
    
    setup: () => {
      const tiles = HexGrid.toArray().map( h => ({ tid: h.tileId, /*blocked: [],*/ tdata: {...tileData.all[h.tileId], tokens: []}, q: h.q, r: h.r, w: h.width, corners: h.corners}) );
      const races = HexGrid.toArray().map( h => ({ rid: h.tileId }))
                  .filter( i => tileData.green.indexOf(i.rid) > -1 ).slice(0, NUM_PLAYERS)
                  .map( (r, idx) => ({...r, ...raceData[r.rid], pid: idx, destroyedUnits: [], commodity: 0, strategy:[], actionCards:[], secretObjectives:[], exhaustedCards: [], reinforcement: {},
                    exploration:[], vp: 0, tg: 10, tokens: { t: 3, f: 3, s: 2, new: 0}, fragments: {u: 0, c: 0, h: 0, i: 0}, relics: []}) );
      
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

        //r.actionCards.push(...cardData.actions.slice(70, 76)); //test only
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
                
                //if(draft.planets.length < 2){
                  draft.planets[0].units = {...races[idx].startingUnits.ground};
                /*}
                else{
                  draft.planets[0].units = {...races[idx].startingUnits.ground};
                  delete draft.planets[0].units.pds;

                  draft.planets[1].units = {pds: races[idx].startingUnits.ground.pds};
                }*/
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
          /*minMoves: 0,
          maxMoves: 1,*/
          stages: {
            actionCard: ACTION_CARD_STAGE
          },

          onBegin: ({G, ctx, events}) => {
            if(G.races[ctx.currentPlayer].exhaustedCards.indexOf('Political Stability') > -1){
              events.endTurn();
            }
          }
        },
        moves: {
          playActionCard: ({G, playerID, events}, card) => {
            if(card.when === 'STRATEGY'){
              G.races[playerID].currentActionCard = {...card, reaction: {}, playerID};
              events.setActivePlayers({ all: 'actionCard' });
            }
          },
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
        onBegin: ({ G, ctx, random, events }) => {
         
          if(!G.pubObjectives.length){
            cardData.objectives.public = random.Shuffle(cardData.objectives.public.filter( o => o.vp === 1 ));
            G.pubObjectives.push({...cardData.objectives.public.pop(), players: []});
            //G.pubObjectives.push({...cardData.objectives.public.find(o => o.id === 'Amass Wealth'), players: []});
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

          //events.endPhase(); //test only!
        },
        onEnd: ({ G }) => {
          G.TURN_ORDER = G.races.map((r, i) => ({initiative: r.initiative, i})).sort((a, b) => a.initiative > b.initiative ? 1 : (a.initiative < b.initiative ? -1 : 0)).map(r => r.i);
          G.tiles.forEach( t => {
            if(t.tdata.planets && t.tdata.planets.length){
              t.tdata.planets.forEach(p => {
                if(p.exhausted){
                  p.exhausted = false;
                }
              })
            }
          });
          G.races.forEach(r => {
            if(r.forbiddenStrategy) delete r.forbiddenStrategy;
          });
        },
        endIf: ({ G, ctx }) => {
          const cardsCount = ctx.numPlayers > 1 ? 1 : 2; // more than 4!
          return ctx.playOrder.every( r => G.races[r].strategy.length === cardsCount );
        }
      },
      acts: {
        next: 'stats',
        turn: {
            order: TurnOrder.CUSTOM_FROM('TURN_ORDER'),
            stages: ACTS_STAGES,

            onBegin: ({ G, ctx }) => {
              G.tiles.filter(t => t.active === true).forEach( t => { t.active = false });
              G.races[ctx.currentPlayer].actions = [];
              G.races[ctx.currentPlayer].destroyedUnits = [];
              G.tiles.forEach(t => {
                if(t.tdata.planets){
                  t.tdata.planets.forEach(p => {
                    if(p.experimentalBattlestation) delete p['experimentalBattlestation'];
                  });
                }
              });
            },

            onMove: ({ G, ctx, playerID }) => {
              if(!ctx.activePlayers || !ctx.activePlayers[playerID]){
                G.races[playerID].combatActionCards = [];
              }

              //space cannon
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
                    const races = G.races.filter((r, i) => i != ctx.currentPlayer && r.technologies.find(t => t.id === 'PDS').spaceCannon.range > 1).map(r => r.rid);
                    const neighs = neighbors([activeTile.q, activeTile.r]).toArray();

                    neighs.forEach(nei => {
                      const n = G.tiles.find(t => t.tid === nei.tileId);
                      if(n.tdata.planets){
                        n.tdata.planets.forEach(p =>{ 
                          if(p.experimentalBattlestation || (races.indexOf(p.occupied) > -1 && p.units && p.units.pds)){
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

            },

            onEnd: ({G, ctx}) => {
              G.strategy = undefined;
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
            }
        },
        moves: {
          endTurn: ({G, events}) => {
            if(!G.currentTacticalActionCard){
              events.setActivePlayers({}); //to end tacticalActionCard stage
              events.endTurn();
            }
          },
          playActionCard: ({G, playerID, events}, card) => {
            if(card.when === 'ACTION'){
              const maxActs = G.races[playerID].knownTechs.indexOf('FLEET_LOGISTICS')>-1 ? 1:0;
              if(G.races[playerID].actions.length > maxActs){
                console.log('too many actions');
                return INVALID_MOVE;
              }

              G.races[playerID].currentActionCard = {...card, reaction: {}, playerID};
              events.setActivePlayers({ all: 'actionCard' });
            }
            else if(card.when === 'TACTICAL' && card.who === 'self'){
              G.races[playerID].currentActionCard = {...card, reaction: {}, playerID};
              events.setActivePlayers({ all: 'actionCard' });
            }
          },
          moveFromTransit: ({G, playerID}, tileIndex, planetIndex, exhaustedCards) => {
            const race = G.races[playerID];
            const planet = G.tiles[tileIndex].tdata.planets[planetIndex];
            if(!planet.units) planet.units = {};

            race.reinforcement.transit.forEach(trooper => {
              const tag = trooper.from.unit;
              if(!planet.units[tag]) planet.units[tag]=[];
              planet.units[tag].push({});
            });

            race.reinforcement.transit = [];

            if(exhaustedCards && exhaustedCards.indexOf('TRANSIT_DIODES') > -1){
              race.exhaustedCards.push('TRANSIT_DIODES');
            }
          },
          moveToTransit: ({G, playerID}, args) => {
            const { tile, planet, unit } = args;
            const race = G.races[playerID];

            if(!race.reinforcement.transit) race.reinforcement.transit = [];
            const trooper = G.tiles[tile].tdata.planets[planet].units[unit].pop();
            trooper.from = args;
            race.reinforcement.transit.push(trooper);

            if(G.tiles[tile].tdata.planets[planet].units[unit].length === 0){
              delete G.tiles[tile].tdata.planets[planet].units[unit];
            }
            if(Object.keys(G.tiles[tile].tdata.planets[planet].units) === 0){
              G.tiles[tile].tdata.planets[planet].units = undefined;
            }
          },
          explorePlanet: ({G, playerID}, pname, exhaustedCards) => {
            const planet = getPlanetByName(G.tiles, pname);
            const explore = G.explorationDecks[planet.trait].pop();

            if(explore.id.indexOf('Relic Fragment') > -1){
              G.races[playerID].fragments[planet.trait[0]]++;
            }
            G.races[playerID].exploration.push(explore);

            if(exhaustedCards && exhaustedCards.indexOf('SCANLINK_DRONE_NETWORK') > -1){
              G.races[playerID].exhaustedCards.push('SCANLINK_DRONE_NETWORK');
            }
          },
          fromReinforcement: ({G, playerID}, pname, units, exhaustedCards) => {
            const planet = getPlanetByName(G.tiles, pname);
            if(!planet.units) planet.units = {};

            Object.keys(units).forEach(u => {
              if(!planet.units[u]) planet.units[u] = [];
              for(var i=0; i<units[u]; i++){
                planet.units[u].push({});
              }
            });

            if(exhaustedCards && exhaustedCards.indexOf('SELF_ASSEMBLY_ROUTINES')>-1){
              G.races[playerID].exhaustedCards.push('SELF_ASSEMBLY_ROUTINES');
            }
          },
          readyTechnology: ({G, playerID}, techId, exhaustedCards) => {
            const idx = G.races[playerID].exhaustedCards.indexOf(techId);
            if(idx > -1){
              G.races[playerID].exhaustedCards.splice(idx, 1);
            }
            if(exhaustedCards && exhaustedCards.indexOf('BIO_STIMS') > -1){
              G.races[playerID].exhaustedCards.push('BIO_STIMS');
            }
          },
          readyPlanet: ({G, playerID}, pname, exhaustedCards) => {
            const planet = getPlanetByName(G.tiles, pname);
            if(planet && planet.exhausted){
              planet.exhausted = undefined;
            }
            if(exhaustedCards && exhaustedCards.indexOf('BIO_STIMS') > -1){
              G.races[playerID].exhaustedCards.push('BIO_STIMS');
            }
          },
          exhaustForTg: ({G, playerID}, pname) => {
            if(pname){
              const planet = getPlanetByName(G.tiles, pname);
              if(!planet.exhausted){
                planet.exhausted = true;
                G.races[playerID].tg += 1;
              }
            }

          },
          exhaustCard: ({G, playerID}, techId) => {
            if(G.races[playerID].exhaustedCards.indexOf(techId) === -1){
              G.races[playerID].exhaustedCards.push(techId);
            }
          },
          producing: ({G, playerID}, pname, deploy, exhausted, tg, exhaustedCards) => {

            if(!pname || !deploy) return;

            if(exhaustedCards && exhaustedCards.indexOf('SLING_RELAY') > -1){
              const maxActs = G.races[playerID].knownTechs.indexOf('FLEET_LOGISTICS')>-1 ? 1:0;
              if(G.races[playerID].actions.length > maxActs){
                console.log('too many actions');
                return INVALID_MOVE;
              }
            }

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
            
            let activeTile;
            if(exhaustedCards && exhaustedCards.indexOf('SLING_RELAY') > -1){
              activeTile = G.tiles.find(t => t.tdata.planets && t.tdata.planets.find(p => p.name === pname));
            }
            else{
              activeTile = G.tiles.find(t => t.active === true);
            }
            
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
               
            if(exhaustedCards && exhaustedCards.indexOf('SLING_RELAY') > -1){
              G.races[playerID].exhaustedCards.push('SLING_RELAY');
              G.races[playerID].actions.push('PRODUCING');
            }

            if(exhaustedCards && exhaustedCards.indexOf('AI_DEVELOPMENT_ALGORITHM') > -1){
              G.races[playerID].exhaustedCards.push('AI_DEVELOPMENT_ALGORITHM');
            }

            activeTile.tdata.producing_done = true;
          },
          invasion: ({G, playerID, events}, planet) => {
            const activeTile = G.tiles.find(t => t.active === true);
            const activePlanet = activeTile.tdata.planets.find(p => p.name === planet.name);
            const defUnits = Object.keys(activePlanet.units);
            
            const defTechs = getUnitsTechnologies(defUnits, G.races[planet.occupied]);
            G.races[planet.occupied].combatActionCards = [];
            if(defUnits.find(u => defTechs[u] && defTechs[u].planetaryShield)){
              G.races[planet.occupied].combatActionCards.push('PLANETARY SHIELD');
            }

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
              const activeTile = G.tiles.find(t => t.active === true);
              if(activeTile) activeTile.tdata.spaceCannons_done = true; 
            }
          },
          antiFighterBarrage: ({G, playerID, events}) => {
            const activeTile = G.tiles.find(t => t.active === true);
            if(activeTile && activeTile.tdata.attacker){
              const def = {};
              
              const assaultReq = (my, enemy) => {
                let myFleet = 0;
                Object.keys(my).filter(k => k!=='fighter').forEach(k => myFleet += my[k].length);

                let enemyFleet = 0;
                Object.keys(enemy).filter(k => k!=='fighter').forEach(k => enemyFleet += enemy[k].length);

                return (myFleet >= 3) && (enemyFleet > 0);
              }

              G.races[activeTile.tdata.occupied].destroyedUnits = [];
              G.races[playerID].destroyedUnits = [];

              def[activeTile.tdata.occupied] = {stage: 'antiFighterBarrage'};
              def[playerID] = {stage: 'antiFighterBarrage'};

              if(haveTechnology(G.races[playerID], 'ASSAULT_CANNON') && assaultReq(activeTile.tdata.attacker, activeTile.tdata.fleet)){
                def[activeTile.tdata.occupied] = {stage: 'spaceCombat_step2'};
                def[playerID] = {stage: 'spaceCombat_await'};
              }

              if(haveTechnology(G.races[activeTile.tdata.occupied], 'ASSAULT_CANNON') && assaultReq(activeTile.tdata.fleet, activeTile.tdata.attacker)){
                if(def[activeTile.tdata.occupied].stage !== 'spaceCombat_step2') def[activeTile.tdata.occupied] = {stage: 'spaceCombat_await'};
                def[playerID] = {stage: 'spaceCombat_step2'};
              }
              
              G.dice[activeTile.tdata.occupied] = {};
              G.dice[playerID] = {};
              events.setActivePlayers({value: def});
            }
          },
          purgeFragments: ({G, playerID}, purgingFragments) => {
            const maxActs = G.races[playerID].knownTechs.indexOf('FLEET_LOGISTICS')>-1 ? 1:0;
            if(G.races[playerID].actions.length > maxActs){
              console.log('too many actions');
              return INVALID_MOVE;
            }

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
            G.races[playerID].actions.push('FRAGMENTS_PURGE');
          },
          adjustToken: ({ G, playerID}, tag, inc) => {
            let i = inc || 1;
      
            G.races[playerID].tokens.new -= i;
            G.races[playerID].tokens[tag] += i;
          },
          redistTokens: ({ G, playerID}, inc, exhaustedCards) => {
            Object.keys(inc).forEach(tag => {
              G.races[playerID].tokens[tag] += inc[tag];
            });
            if(exhaustedCards && exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1){
              G.races[playerID].exhaustedCards.push('PREDICTIVE_INTELLIGENCE');
            }            
          },
          useStrategy: ({ G, events, playerID}, idx) => {
            if(idx === undefined) idx=0;
            const strategy = G.races[playerID].strategy[idx];

            const maxActs = G.races[playerID].knownTechs.indexOf('FLEET_LOGISTICS')>-1 ? 1:0;
            if(G.races[playerID].actions.length > maxActs){
              console.log('too many actions');
              return INVALID_MOVE;
            }

            if(!strategy || strategy.exhausted){
              console.log('strategy card exhausted');
              return INVALID_MOVE;
            }

            strategy.exhausted = true;
            G.strategy = strategy.id;
            G.races[playerID].actions.push('STRATEGY_CARD');

            events.setActivePlayers({ all: 'strategyCard', minMoves: 1 });
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
          activateTile: ({ G, playerID, events }, tIndex) => {

            const race = G.races[playerID];
            if(race.tokens.t <= 0){
              console.log('not enough tokens');
              return INVALID_MOVE;
            }

            const maxActs = race.knownTechs.indexOf('FLEET_LOGISTICS')>-1 ? 1:0;
            if(race.actions.length > maxActs){
              console.log('too many actions');
              return INVALID_MOVE;
            }
            
            const tile = G.tiles[tIndex];

            if(tile){
              if(tile.tdata.tokens && tile.tdata.tokens.indexOf(race.rid) > -1){
                console.log('already blocked');
                return INVALID_MOVE;
              }
              tile.tdata.tokens.push(race.rid);

              const prevActive = G.tiles.find(t => t.active === true);
              if(prevActive) prevActive.active = undefined;
            
              tile.active = true;
              if(race.moveBoost) delete race['moveBoost'];
              if(race.spaceCannonsImmunity) delete race['spaceCannonsImmunity'];
              checkTacticalActionCard({G, playerID, events, atype: 'TILE_ACTIVATED'});
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

            let idx = race.exhaustedCards.indexOf('GRAVITY_DRIVE');
            if(idx > -1){
              race.exhaustedCards.splice(idx, 1);
            }

            idx = race.exhaustedCards.indexOf('SCANLINK_DRONE_NETWORK');
            if(idx > -1){
              race.exhaustedCards.splice(idx, 1);
            }

          },
          moveShip: ({ G, playerID }, args) => {

            const dst = G.tiles.find( t => t.active === true );
            if(dst.tdata.spaceCannons_done === true) dst.tdata.spaceCannons_done = false;

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

              if(!G.tiles[args.tile].tdata.fleet || !Object.keys(G.tiles[args.tile].tdata.fleet).length){
                G.tiles[args.tile].tdata.occupied = undefined;
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

            if(args.exhaustedCards){
              if(args.exhaustedCards.indexOf('GRAVITY_DRIVE')>-1){
                G.races[playerID].exhaustedCards.push('GRAVITY_DRIVE');
              }
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
          }
        },
        moves: {
          playActionCard: ({G, playerID, events}, card) => {
            if(card.when === 'STATUS'){
              G.races[playerID].currentActionCard = {...card, reaction: {}, playerID};
              events.setActivePlayers({ all: 'actionCard' });
            }
          },
          completeObjective: ({G, playerID, events}, oid, payment) => {
            completeObjective({G, playerID, oid, payment});
            G.passedPlayers.push(playerID);
            events.endTurn();
          },
          dropActionCard: dropACard,
          pass: ({ G, playerID, events }) => {
            G.passedPlayers.push(playerID);
            events.endTurn();
          }
        },
        onBegin: ({ G, events }) => {
          G.passedPlayers = [];
          G.races.forEach(r => {
            r.actionCards.push(G.actionsDeck.pop());
            if(haveTechnology(r, 'NEURAL_MOTIVATOR')){
              r.actionCards.push(G.actionsDeck.pop());
            }
            r.exhaustedCards = [];
            r.combatActionCards = [];
          });
          
         // events.setPhase('agenda'); //test only!
        },
        onEnd: ({ G }) => {
          G.pubObjectives.push({...cardData.objectives.public.pop(), players: []});
          G.races.forEach( r => { 
            if(r.exhaustedCards.indexOf('Political Stability') === -1) r.strategy = []; 
            r.initiative = undefined;
            r.tokens.new += haveTechnology(r, 'HYPER_METABOLISM') ? 3:2; 
          });

          G.passedPlayers = [];
          let order = G.races.map((r,i)=>i);
          /*const spkIdx = G.races.findIndex(r => String(r.rid) === String(G.speaker));
          order = [...order.slice(spkIdx), ...order.slice(0, spkIdx)];
          G.TURN_ORDER = [...order.slice(1), order[0]]; //speaker at the end*/
          G.TURN_ORDER = order;
        },
        endIf: ({ G, ctx }) => G.passedPlayers.length === ctx.numPlayers
      },
      agenda: {
        next: 'strat',

        turn: {
          order: {//TurnOrder.CUSTOM_FROM('TURN_ORDER'),
            playOrder: ({ G }) => G.TURN_ORDER,
            first: () => 1, //speaker at the end
            next: ({ G, ctx }) => {
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
          onBegin: ({ G, ctx, events }) => {
            if(!ctx.activePlayers){ //pass turn if some action cards was effect
              const agendaNumber = G.vote2 ? 2:1;
              const voteResults = G.races[ctx.currentPlayer].voteResults;

              if(voteResults && voteResults.length === agendaNumber){
                if(voteResults[agendaNumber-1].vote === null){
                  if(G.races.every(r => r.voteResults.length === agendaNumber)){ // voting process done
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
                dropActionCard: dropACard
              }
            }
          }
        },

        moves: {
          vote: ({G, ctx, playerID, events}, result) => {
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

            exhaustPlanet(Object.keys(result.ex));
            
            let vr = {vote: result.vote, count: votes};
            if(result.exhaustedCards && result.exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE')>-1){
              vr.withTech = 'PREDICTIVE_INTELLIGENCE';
            }
            G.races[playerID].voteResults.push(vr);

            const agendaNumber = G.vote2 ? 2:1;

            if(G.races.every(r => r.voteResults.length === agendaNumber)){ // voting process done
              votingProcessDone({G, agendaNumber, playerID, events});
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
            if(t.active) t.active = false;
            if(t.tdata.planets && t.tdata.planets.length){
              t.tdata.planets.forEach(p => {
                p.exhausted = false;

                if(p.occupied !== undefined){
                  G.races[p.occupied].votesMax += p.influence;
                }
              })
            }
          });

          G.passedPlayers = [];
          G.predict = []; //vote prediction by agenda action card
        },

        onEnd: ({ G, ctx }) => {
          
          for(var i=1; i<=2; i++){
            if(G['vote' + i].type === 'LAW' && G['vote' + i].decision.toUpperCase() !== 'AGAINST'){
              G.laws.push(G['vote' + i]);
            }
          }

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
