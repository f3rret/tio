/* eslint eqeqeq: 0 */
import { INVALID_MOVE, TurnOrder } from 'boardgame.io/core';
import cardData from './cardData.json';
import { getHexGrid, neighbors } from './Grid';
import { ACTION_CARD_STAGE, ACTS_STAGES, secretObjectiveConfirm, producing, useHeroAbility, addTradeItem, delTradeItem, makeOffer, useRelic } from './gameStages';
import { checkTacticalActionCard, getUnitsTechnologies, haveTechnology, 
 getPlanetByName, votingProcessDone, dropACard, completeObjective, explorePlanetByName, 
 getPlayerUnits, UNITS_LIMIT, exploreFrontier, checkIonStorm, checkSecretObjective, 
 getInitRaces, getInitTiles, checkCommanderUnlock, doFlagshipAbility } from './utils';
import { EffectsPlugin } from 'bgio-effects/plugin';
import settings from '../package.json'

const effectsConfig = EffectsPlugin({
  effects: {
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
      const races = getInitRaces(hg, ctx.numPlayers, setupData.colors);
      
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
        discardedActions: []
      }
    },

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

          onBegin: ({G, ctx, events}) => {
            if(G.races[ctx.currentPlayer].exhaustedCards.indexOf('Political Stability') > -1){
              events.endTurn();
            }
          }
        },
        moves: {
          dropActionCard: dropACard,
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
            G.agendaDeck = random.Shuffle(cardData.agenda);
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
          const cardsCount = ctx.numPlayers > 4 ? 1 : settings.ip === 'localhost' ? 1 : 2; // testing
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
        moves: {
          secretObjectiveConfirm,
          useRelic,
          dropSecretObjective: ({G, playerID}, oid) => { //todo: return obj to deck and shuffle
            if(G.races[playerID].secretObjectives){
              G.races[playerID].secretObjectives = G.races[playerID].secretObjectives.filter(o => o.id !== oid);
              delete G.races[playerID].mustDropSecObj;
            }
          },
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
          moveToReinforcements: ({G, playerID, ...plugins}, args) => {
            const { groundUnitSelected, advUnitView, payloadCursor } = args;
            const { tile, planet, unit } = groundUnitSelected && groundUnitSelected.unit ? groundUnitSelected : advUnitView;
            if(tile === undefined || unit === undefined) return;

            if(groundUnitSelected && groundUnitSelected.unit){
              if(planet === undefined) return;
              const p = G.tiles[tile].tdata.planets[planet];

              if(String(p.occupied) !== String(playerID)) return;
              if(!p.units || !p.units[unit] || !p.units[unit].length) return;
              p.units[unit].pop();
              
              if(!p.units[unit].length){
                delete p.units[unit];
              }
              if(!Object.keys(p.units).length){
                delete p['units'];
              }

              if(p.exploration === 'Core Mine' && unit === 'infantry'){
                G.races[playerID].tg++;
                plugins.effects.tg();
                delete p['exploration'];
              }
              else if(p.exploration === 'Expedition' && unit === 'infantry'){
                p.exhausted = false;
                delete p['exploration'];
              }
              else if(p.exploration === 'Volatile Fuel Source' && unit === 'infantry'){
                if(G.races[playerID].tokens.t + G.races[playerID].tokens.s + G.races[playerID].tokens.f + G.races[playerID].tokens.new < 16){
                  G.races[playerID].tokens.new++;
                }
                delete p['exploration'];
              }
            }
            else{
              const tl = G.tiles[tile];
              if(String(tl.tdata.occupied) !== String(playerID)) return;
              let idx = 0;
              if(payloadCursor && !isNaN(payloadCursor.i)) idx = payloadCursor.i;
              const fleet = tl.tdata.fleet;

              if(fleet && fleet[unit] && fleet[unit][idx]){
                
                fleet[unit].splice(idx, 1);

                if(!fleet[unit].length){
                  delete fleet[unit];
                }
                if(!Object.keys(fleet).length){
                  delete tl.tdata['fleet'];
                  delete tl.tdata['occupied'];
                }
              }
            }

          },
          choiceDialog : ({G, playerID, ...plugins}, cidx) => {
            if(G.races[playerID].explorationDialog){
              if(G.races[playerID].explorationDialog.id === 'Abandoned Warehouses'){
                if(cidx === 0){
                  G.races[playerID].commodity = Math.min(G.races[playerID].commodity + 2, G.races[playerID].commCap);
                }
                else if(cidx === 1){
                  const c = Math.min(G.races[playerID].commodity, 2);
                  G.races[playerID].commodity -= c;
                  G.races[playerID].tg += c;
                }
              }
              else if(G.races[playerID].explorationDialog.id === 'Functioning Base'){
                if(cidx === 0){
                  G.races[playerID].commodity = Math.min(G.races[playerID].commodity + 1, G.races[playerID].commCap);
                }
                else if((cidx === 1 && G.races[playerID].commodity > 0) || (cidx === 2 && G.races[playerID].tg > 0)){
                  G.races[playerID][cidx === 1 ? 'commodity':'tg']--;
                  G.races[playerID].actionCards.push(G.actionsDeck.pop());
                }
              }
              else if(G.races[playerID].explorationDialog.id === 'Local Fabricators'){
                if(cidx === 0){
                  G.races[playerID].commodity = Math.min(G.races[playerID].commodity + 1, G.races[playerID].commCap);
                }
                else if((cidx === 1 && G.races[playerID].commodity > 0) || (cidx === 2 && G.races[playerID].tg > 0)){
                  G.races[playerID][cidx === 1 ? 'commodity':'tg']--;
                  const planet = getPlanetByName(G.tiles, G.races[playerID].explorationDialog.pname);
                  const units = getPlayerUnits(G.tiles, playerID);
                  if(!units['mech'] || units['mech'] < UNITS_LIMIT['mech']){
                    if(!planet.units) planet.units = {};
                    if(!planet.units.mech) planet.units.mech = [];
                    planet.units.mech.push({id: 'mech'});
                  }
                }
              }
              else if(G.races[playerID].explorationDialog.id === 'Ion Storm'){
                const side = cidx === 0 ? 'alpha':'beta';
                const tile = G.tiles.find(t => t.tid === G.races[playerID].explorationDialog.tid);
                if(tile && tile.tdata){
                  tile.tdata.wormhole = side;
                  tile.tdata.ionstorm = true;
                }
              }
              else if(G.races[playerID].explorationDialog.id === 'Merchant Station'){
                if(cidx === 0){
                  G.races[playerID].commodity = G.races[playerID].commCap;
                }
                else if(cidx === 1){
                  G.races[playerID].tg += G.races[playerID].commodity;
                  G.races[playerID].commodity = 0;
                }
              }

              delete G.races[playerID]['explorationDialog'];
              plugins.effects.tg();
            }
          },
          explorePlanet: ({G, playerID, ...plugins}, pname, exhaustedCards) => {
            explorePlanetByName(G, playerID, pname, exhaustedCards);
            plugins.effects.tg();
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
            if(exhaustedCards && exhaustedCards.indexOf('INFANTRY2')>-1){
              G.races[playerID].exhaustedCards.push('INFANTRY2');
              G.races[playerID].tempTechnoData = G.races[playerID].tempTechnoData.filter(td => td.id !== 'INFANTRY2');
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
          exhaustForTg: ({G, playerID, ...plugins}, pname) => {
            if(pname){
              const planet = getPlanetByName(G.tiles, pname);
              if(!planet.exhausted){
                planet.exhausted = true;
                G.races[playerID].tg += 1;
              }
              plugins.effects.tg();
            }
          },
          exhaustCard: ({G, playerID}, techId) => {
            if(G.races[playerID].exhaustedCards.indexOf(techId) === -1){
              G.races[playerID].exhaustedCards.push(techId);
            }
          },
          producing,
          invasion: ({G, playerID, events}, planet) => {
            const activeTile = G.tiles.find(t => t.active === true);
            const activePlanet = activeTile.tdata.planets.find(p => p.name === planet.name);
            if(activePlanet.attach && activePlanet.attach.length && activePlanet.attach.indexOf('Demilitarized Zone')>-1) return;

            if(!activePlanet.units) activePlanet.units = {};

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

              //mentak FLAGSHIP
              if(G.races[activeTile.tdata.occupied].rid === 2 && Object.keys(activeTile.tdata.fleet).includes('flagship')){
                G.races[activeTile.tdata.occupied].combatActionCards.push('FLAGSHIP');
              }
            }
          },
          antiFighterBarrage: ({G, playerID, events, random}) => {
            const activeTile = G.tiles.find(t => t.active === true);
            if(activeTile && activeTile.tdata.attacker){
              const def = {};
              let assaultCannon = false;
              
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
                assaultCannon = true;
              }

              if(haveTechnology(G.races[activeTile.tdata.occupied], 'ASSAULT_CANNON') && assaultReq(activeTile.tdata.fleet, activeTile.tdata.attacker)){
                if(def[activeTile.tdata.occupied].stage !== 'spaceCombat_step2') def[activeTile.tdata.occupied] = {stage: 'spaceCombat_await'};
                def[playerID] = {stage: 'spaceCombat_step2'};
                assaultCannon = true;
              }

              G.dice[activeTile.tdata.occupied] = {};
              G.dice[playerID] = {};
              G.spaceCombat = {assaultCannon};

              if(!assaultCannon && (G.races[playerID].rid === 2 || G.races[activeTile.tdata.occupied].rid === 2)){ //mentak ambush
                def[activeTile.tdata.occupied] = {stage: 'spaceCombat_step2'};
                def[playerID] = {stage: 'spaceCombat_step2'};

                const doAmbush = (pid, fleet) => {
                  let count = 0;

                  if(fleet['cruiser'] && fleet['cruiser'].length > 0){
                    count = fleet['cruiser'].length;
                    G.dice[pid] = {cruiser: {withTech: 'ambush', dice: random.D10(Math.min(count, 2))}}
                  }
                  if(count < 2 && fleet['destroyer'] && fleet['destroyer'].length > 0){
                    G.dice[pid] = {...G.dice[pid], destroyer: {withTech: 'ambush', dice: random.D10(Math.min(2 - count, fleet['destroyer'].length))}}
                  }

                  G.spaceCombat = {...G.spaceCombat, ambush: true};
                }

                if(G.races[playerID].rid === 2){
                  doAmbush(playerID, activeTile.tdata.attacker);
                }
                else if(G.races[activeTile.tdata.occupied].rid === 2){
                  doAmbush(activeTile.tdata.occupied, activeTile.tdata.fleet);
                }
              }

              events.setActivePlayers({value: def});

              //mentak FLAGSHIP
              if(G.races[playerID].rid === 2 && Object.keys(activeTile.tdata.attacker).includes('flagship')){
                if(!G.races[playerID].preCombatActionCards) G.races[playerID].preCombatActionCards = []; //preCombat!
                G.races[playerID].preCombatActionCards.push('FLAGSHIP');
              }
              else if(G.races[activeTile.tdata.occupied].rid === 2 && Object.keys(activeTile.tdata.fleet).includes('flagship')){
                G.races[activeTile.tdata.occupied].combatActionCards.push('FLAGSHIP'); //combat
              }

              if(activeTile.tdata.anomaly === 'nebula'){
                G.races[activeTile.tdata.occupied].combatActionCards.push('NEBULA');
              }

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
            const relic = G.relicsDeck.pop();
            G.races[playerID].relics.push(relic);
            if(relic && relic.id === 'The Obsidian' && G.secretObjDeck.length){
              G.races[playerID].secretObjectives.push(...G.secretObjDeck.splice(-1));
            }

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
                    if(to[dst.i]){
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
            }

          },
          unloadUnit: ({G, playerID, ...plugins}, {src, dst, payment}) => {
            
            let to = G.tiles[dst.tile].tdata.planets[dst.planet];
            if(to.attach && to.attach.length && to.attach.indexOf('Demilitarized Zone')>-1) return;

            const from = G.tiles[src.tile].tdata.fleet[src.unit];
           
            if(from && to){
              if(to.name === 'Mecatol Rex' && to.occupied === undefined){
                if(G.races[playerID].rid !== 7){
                  if(payment){
                    if(payment.influence){
                      payment.influence.forEach(pname => {
                        const planet = getPlanetByName(G.tiles, pname);
                        if(planet) planet.exhausted = true
                      });
                    }
                    if(payment.tg){
                      G.races[playerID].tg -= payment.tg;
                    }
                  }
                }
              }

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

              if(to.occupied === undefined){
                /*const explore = G.explorationDecks[to.trait].pop();
                if(explore.id.indexOf('Relic Fragment') > -1){
                  G.races[playerID].fragments[to.trait[0]]++;
                }
                G.races[playerID].exploration.push(explore);*/
                to.exhausted = true;
                to.occupied = playerID;
                checkCommanderUnlock(G, playerID);
                if(to.trait){
                  explorePlanetByName(G, playerID, to.name)
                  plugins.effects.tg();
                }
              }
              else if(to.occupied != playerID && G.races[to.occupied]){
                checkSecretObjective(G, to.occupied, 'Become a Martyr');
                
                const looserRace = G.races[to.occupied];
                if(looserRace && (to.legendary === true || String(G.tiles[dst.tile].tid) === String(looserRace.rid))){
                  const relicIdx = looserRace.relics.findIndex(r => r.id === 'Shard of the Throne');
                  if(relicIdx > -1){
                    G.races[playerID].relics.push(...looserRace.relics.splice(relicIdx, 1));
                  }
                }

                to.occupied = playerID;
                checkCommanderUnlock(G, playerID);
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
              exploreFrontier(G, playerID, tile);
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
          moveShip: ({ G, playerID, random, ...plugins }, args) => {

            try{
              const dst = G.tiles.find( t => t.active === true );
              if(dst.tdata.spaceCannons_done === true) dst.tdata.spaceCannons_done = false;

              const src = G.tiles[args.tile];
              const unit = src.tdata.fleet[args.unit][args.shipIdx];
              let isAttack = false;

              let fullpath = [];
              if(args.path && args.path.length){ //ion storm
                fullpath = args.path.map(p => G.tiles.find(t => String(t.tid) === String(p)));
              }

              if(dst && src && unit){
                if(fullpath){ //gravity-rift
                  const rifts = fullpath.filter((p,i) =>  (i < fullpath.length - 1) && p.tdata && p.tdata.anomaly === 'gravity-rift');

                  if(rifts && rifts.length){
                    let dices = random.D10(rifts.length);//rifts.length);
                    plugins.effects.rift({unit: args.unit, dices: dices});
                    
                    if(dices.find(d => d < 4)){
                      G.tiles[args.tile].tdata.fleet[args.unit].splice(args.shipIdx, 1);
                      if(G.tiles[args.tile].tdata.fleet[args.unit].length === 0){
                        delete G.tiles[args.tile].tdata.fleet[args.unit];
                      }

                      if(!G.tiles[args.tile].tdata.fleet || !Object.keys(G.tiles[args.tile].tdata.fleet).length){
                        G.tiles[args.tile].tdata.occupied = undefined;
                      }

                      return;
                    }
                  }
                }

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

              if(fullpath){ //ion storm
                //const fullpath = args.path.map(p => G.tiles.find(t => String(t.tid) === String(p)));
                checkIonStorm(G, args.path);
              }

              if(dst.tdata.frontier && G.races[playerID].knownTechs.indexOf('DARK_ENERGY_TAP') > -1){
                exploreFrontier(G, playerID, dst);
              }

              if(args.exhaustedCards){
                if(args.exhaustedCards.indexOf('GRAVITY_DRIVE')>-1){
                  G.races[playerID].exhaustedCards.push('GRAVITY_DRIVE');
                }
                if(args.exhaustedCards.indexOf('Dominus Orb')>-1){
                  const relic = G.races[playerID].relics.find(r => r.id === 'Dominus Orb');
                  if(relic){
                    relic.purged = true;
                    plugins.effects.relic_ex({id: 'Dominus Orb'});
                  }
                }
              }
            }
            catch(e){console.log(e)}

          },
          pass: ({ G, playerID, events, ctx }) => {
            let endLater = false;

            if(G.passedPlayers.indexOf(playerID) === -1){
              
              if(G.passedPlayers.length === ctx.numPlayers - 1){
                if(checkSecretObjective(G, playerID, 'Prove Endurance')){ 
                  endLater = true; 
                }
                else{
                  G.passedPlayers.push(playerID);
                }
              }
              else{
                G.passedPlayers.push(playerID);
              }
            }

            if(!endLater){ events.endTurn();}
          },
          addTradeItem, delTradeItem, makeOffer,
          
          dropActionCard: dropACard,
          useRacialAbility: ({G, playerID, ...plugins}, args) => {
            const race = G.races[playerID];
            race.actions.push(args.abilId);

            if(args.abilId === 'ORBITAL_DROP'){
              const {selectedTile, selectedPlanet} = args;
              if(selectedTile > -1 && selectedPlanet > -1){
                const tile = G.tiles[selectedTile];
        
                if(tile && tile.tdata && tile.tdata.planets){
                  const planet = tile.tdata.planets[selectedPlanet];
        
                  if(planet && String(planet.occupied) === String(playerID) && race.tokens.s > 0){
                    if(!(args.exhaustedCards && args.exhaustedCards.includes('Scepter of Emelpar'))){
                      race.tokens.s--;
                    }
                    else{
                      const relic = race.relics.find(r => r.id === 'Scepter of Emelpar');
                      if(relic){
                        relic.exhausted = true;
                        plugins.effects.relic_ex({id: 'Scepter of Emelpar', pid: playerID})
                      }
                    }
                    race.lastUsedPlanet = planet.name;

                    if(!planet.units) planet.units={};
                    if(!planet.units.infantry) planet.units.infantry = [];
                    planet.units.infantry.push({}, {});
                  }
                }
              }
            }
            else if(args.abilId === 'PILLAGE'){
              const {playerID: enemyID, param, withAgent} = args;
              if(enemyID !== undefined && param){
                const enemy = G.races[enemyID];
                if(param === 'tg' && enemy.tg > 0){
                  enemy.tg--;
                  race.tg++;
                }
                else if(param === 'commodity'){
                  race.tg += enemy.commodity;
                  enemy.commodity = 0;
                }

                if(withAgent && !race.exhaustedCards.includes('AGENT')){
                  race.exhaustedCards.push('AGENT');
                  race.actionCards.push(G.actionsDeck.pop());
                  enemy.actionCards.push(G.actionsDeck.pop());
                }
              }
            }

            plugins.effects.tg();
          },
          deployMech: ({G, playerID}, args) => {
            const race = G.races[playerID];

            if(race && race.rid === 1){
              const planet = getPlanetByName(G.tiles, args.planet);
              
              if(planet){
                let pay = 3;
                if(args.payment && args.payment.resources && args.payment.resources.length){
                  args.payment.resources.forEach(pname => {
                    const ex = getPlanetByName(G.tiles, pname);
                    if(ex){
                      if(ex.resources) pay -= ex.resources;
                      ex.exhausted = true 
                    }
                  })
                }
                if(pay > 0) race.tg -= args.payment.tg;
                if(!planet.units) planet.units={};
                if(!planet.units.mech) planet.units.mech = [];
                planet.units.mech.push({});
              }
            }
          },
          useHeroAbility
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
          useRelic,
          playActionCard: ({G, playerID, events}, card) => {
            if(card.when === 'STATUS'){
              G.races[playerID].currentActionCard = {...card, reaction: {}, playerID};
              events.setActivePlayers({ all: 'actionCard' });
            }
          },
          completeObjective: ({G, playerID, events}, oid, payment) => {
            completeObjective({G, playerID, oid, payment});
            //G.passedPlayers.push(playerID);
            //events.endTurn();
          },
          dropActionCard: dropACard,
          pass: ({ G, playerID, events }) => {
            G.passedPlayers.push(playerID);
            events.endTurn();
          }
        },
        onBegin: ({ G, events }) => {
          G.passedPlayers = [];
          
         // events.setPhase('agenda'); //test only!
        },
        onEnd: ({ G, random }) => {
          try{
            if(G.pubObjectives && G.pubObjectives.length === 5){
              G.pubObjDeck = random.Shuffle(cardData.objectives.public.filter( o => o.vp === 2 ));
            }
            G.pubObjectives.push({...G.pubObjDeck.pop(), players: []});
            G.races.forEach( r => {
              r.actionCards.push(G.actionsDeck.pop());
              if(haveTechnology(r, 'NEURAL_MOTIVATOR')){
                r.actionCards.push(G.actionsDeck.pop());
              }

              if(r.exhaustedCards.indexOf('Political Stability') === -1) r.strategy = []; 
              r.initiative = undefined;
              r.lastScoredObjType = undefined;
              let c = haveTechnology(r, 'HYPER_METABOLISM') ? 3:2;
              if(r.rid === 1) c++;
              
              let possible = 16 - (r.tokens.t + r.tokens.s + r.tokens.f + r.tokens.new);
              if(possible < 0) possible = 0;

              r.tokens.new += Math.min(c, possible);

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
          useRelic,
          secretObjectiveConfirm,
          vote: ({G, playerID, events, ...plugins}, result) => {
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
              votingProcessDone({G, agendaNumber, playerID, events});
              
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
      let result = 0;
      let race = G.races[ctx.currentPlayer];

      if(race){
        race.secretObjectives.concat(G.pubObjectives).forEach(o => {
          if(o && o.players && o.players.length > 0){
            if(o.players.indexOf(ctx.currentPlayer) > -1) result += (o.vp ? o.vp : 1);
          }
        });
  
        result += race.vp;
        if(race.relics && race.relics.find(r => r.id === 'Shard of the Throne')){
          result++;
        }
      }
  
      if(result >= G.vp) {
        return { winner: ctx.currentPlayer };
      }
        
    },
};

