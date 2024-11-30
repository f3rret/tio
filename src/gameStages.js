import { produce } from 'immer';
import { INVALID_MOVE } from 'boardgame.io/core';
import { getUnitsTechnologies, haveTechnology, computeVoteResolution, enemyHaveTechnology, getPlanetByName, 
  completeObjective, loadUnitsOnRetreat, checkTacticalActionCard, playCombatAC, repairAllActiveTileUnits, 
  spliceCombatAC, checkIonStorm, checkSecretObjective, checkCommanderUnlock, useCommanderAbility, 
  adjustTechnologies, explorePlanetByName, occupyPlanet, getMaxActs, 
  enemyHaveCombatAC, dropACard, getPlayerUnits, UNITS_LIMIT, exploreFrontier, returnPromissory, 
  getPlayerPlanets, votingProcessDone,
  replenishCommodity, returnPromissoryToOwner} from './utils';
import cardData from './cardData.json';
import { botMove } from './botPlugin_ss';

export const useAgenda = ({G, ctx, playerID}, args) => {
  try{
    const {id, selectedTile} = args;

    if(id === 'Minister of War'){
      if(selectedTile > -1){
        const tile = G.tiles[selectedTile];

        if(tile && tile.tdata && tile.tdata.tokens){
          const idx = tile.tdata.tokens.indexOf(G.races[playerID].rid);
          if(idx > -1) tile.tdata.tokens.splice(idx, 1);

          if(tile.active){ tile.active = undefined }
        }

        G.races[playerID].exhaustedCards.push(id);
      }
    }
  }
  catch(e){
    console.log(e)
  }
}

export const adjustToken = ({ G, playerID}, tag, inc) => {
  let i = inc || 1;

  G.races[playerID].tokens.new -= i;
  G.races[playerID].tokens[tag] += i;
}

export const useRelic = ({G, ctx, playerID, ...plugins}, args) => {

  try{
    if(args.id === 'Maw of Worlds'){
      const planets = getPlayerPlanets(G.tiles, playerID);

      planets.forEach(p => {
        const planet = getPlanetByName(G.tiles, p.name);
        planet.exhausted = true;
      });

      if(args.techId) G.races[playerID].knownTechs.push(args.techId);
    }
    else if(args.id === 'Stellar Converter'){
      const tile = G.tiles[args.tile];
      if(!tile || !tile.tdata) return;

      const planet = tile.tdata.planets[args.planet];
      if(!planet) return;

      delete planet['units'];
      delete planet['occupied'];
      delete planet['attach'];
      planet.isDestroyed = true;

      G.races[playerID].actions.push('RELIC');
    }
    else if(args.id === 'The Codex'){
      const selected = args.selected;

      if(selected && selected.length){
        selected.sort().forEach( (s, i) => {
          G.races[playerID].actionCards.push(...G.discardedActions.splice(s - i, 1))
        });
      }

      G.races[playerID].actions.push('RELIC');
    }
    else if(args.id === 'The Crown of Emphidia'){
      if(ctx.phase === 'acts'){
        const tile = G.tiles[args.tile];
        if(!tile || !tile.tdata) return;

        const planet = tile.tdata.planets[args.planet];
        if(!planet) return;

        explorePlanetByName(G, playerID, planet.name);
        G.races[playerID].exhaustedCards.push(args.id);
        plugins.effects.tg();
        return;
      }
      else if(ctx.phase === 'stats'){
        G.races[playerID].vp++;
      }
    }

    const idx = G.races[playerID].relics.findIndex(r => r.id === args.id);
    G.races[playerID].relics.splice(idx, 1);

    //plugins.effects.relic_ex({id: args.id});
  }
  catch(e){console.log(e)}
}

export const usePromissory = ({G, ctx, playerID, ...plugins}, promissory, args) => {

  try{

    if(promissory && promissory.id === 'POLITICAL_SECRET'){
    
      const owner = returnPromissoryToOwner(G, playerID, promissory, plugins);
      const ownerID = G.races.findIndex(r => r.rid === owner.rid);

      owner.voteResults.push({vote: null, count: 0});
      owner.actions.push('DISABLED');

      if(G.vote2){
        if(G.passedPlayers.indexOf(ownerID) === -1){
          G.passedPlayers.push(ownerID, ownerID);
        }
        else{
          G.passedPlayers.push(ownerID);
        }
      }

    }
    else if(promissory && promissory.id === 'MILITARY_SUPPORT'){

      const owner = returnPromissoryToOwner(G, playerID, promissory, plugins);
      if(owner.tokens.s < 1) return;
      owner.tokens.s--;

      const {selectedTile, selectedPlanet} = args;

      if(promissory.owner !== undefined && G.races[playerID].rid !== promissory.owner && selectedTile > -1 && selectedPlanet > -1){
        const tile = G.tiles[selectedTile];
        const planet = tile.tdata.planets[selectedPlanet];

        if(String(planet.occupied) === String(playerID)){
          if(!planet.units) planet.units = {};
          if(!planet.units.infantry) planet.units.infantry = [];
          planet.units.infantry.push({}, {});
        }

      }

    }
    else if(promissory && promissory.id === 'PROMISE_OF_PROTECTION'){
      if(!promissory.isActive){
        const prom = G.races[playerID].promissory.find(p => p.id === promissory.id && p.owner === promissory.owner);
        prom.isActive = true;

        const owner = G.races.find(r => String(r.rid) === String(promissory.owner));
        const ownProm = owner.promissory.find(p => p.id === promissory.id && p.sold === G.races[playerID].rid);
        ownProm.isActive = true;

        G.races[playerID].actions.push('PROMISSORY');
      }
    }

  }
  catch(e){console.log(e)}

}

export const makeOffer = ({G, ctx, playerID, events}, pid) => {

  if(!ctx.activePlayers){
    const val = {};
    
    val[playerID] = {stage: 'trade'};
    val[pid] = {stage: 'trade'};

    events.setActivePlayers({value: val});
  }

} 
export const addTradeItem = ({G, playerID}, pid, item, count) => {

  try{
    G.races[playerID].trade = produce(G.races[playerID].trade, draft => {
      if(item){
        if(!draft[pid]) draft[pid] = {};
        if(!count) count = 1;
        const prevCount = draft[pid][item] || 0;

        if(item.startsWith('promissory.')){
          Object.keys(draft[pid]).forEach(it => {
            if(it.startsWith('promissory.')) delete draft[pid][it];
          })
        }
        else{
          if(item === 'tg' && G.races[playerID].tg <= count + prevCount){
            return;
          }
          else if(item === 'commodity' && G.races[playerID].commodity < count + prevCount){
            return;
          }
          else if(item.startsWith('fragment.')){
            const frag = item.substr(item.indexOf('.') + 1);
            if(G.races[playerID].fragments[frag] < count + prevCount){
              return;
            }
          }
        }

        if(!draft[pid][item]){
          draft[pid][item] = count;
        }
        else{
          draft[pid][item]++;
        }

      }
    });
  }
  catch(e){console.log(e)}

}
export const delTradeItem = ({G, playerID}, pid, item) => {

  try{
    G.races[playerID].trade = produce(G.races[playerID].trade, draft => {
      if(item && draft[pid]){
        if(draft[pid][item]){
          draft[pid][item]--;
        }
        if(!draft[pid][item]){
          delete draft[pid][item];
        }
      }
    });
  }
  catch(e){console.log(e)}

}
  
export const secretObjectiveConfirm = ({G, playerID, events}, oid, y) => {
  
  delete G.races[playerID].secretObjectiveConfirm;
  const objective = G.races[playerID].secretObjectives.find(o => o.id === oid);

  if(!objective) return;
  if(objective.players && objective.players.length) return;

  if(y === 0){
    if(!objective.players) objective.players = [];
    objective.players.push(playerID);
  }

  if(['Become a Martyr', 'Betray a Friend', 'Brave the Void', 'Darken the Skies', 'Demonstrate Your Power', 
      'Spark a Rebellion', 'Turn Their Fleets to Dust', 'Unveil Flagship'].includes(oid)){ 
        events.endStage(); 
  }
  if(oid === 'Prove Endurance'){ 
    G.passedPlayers.push(playerID);
    events.endTurn(); 
  }

}

export const dropSecretObjective = ({G, playerID}, oid) => { //todo: return obj to deck and shuffle
  if(G.races[playerID].secretObjectives){
    G.races[playerID].secretObjectives = G.races[playerID].secretObjectives.filter(o => o.id !== oid);
    delete G.races[playerID].mustDropSecObj;
  }
}

export const producing = ({G, playerID, ctx, events}, pname, deploy, payment, exhaustedCards) => {

  if(deploy){
    let activeTile;

    if(exhaustedCards && exhaustedCards.includes('SLING_RELAY')){
      activeTile = G.tiles.find(t => t.tdata.planets && t.tdata.planets.find(p => p.name === pname));
    }
    else{
      activeTile = G.tiles.find(t => t.active === true);
    }

    if(exhaustedCards && exhaustedCards.indexOf('SLING_RELAY') > -1){

      if(G.races[playerID].actions.length > getMaxActs(G, playerID) - 1){
        console.log('too many actions');
        return INVALID_MOVE;
      }
    }

    const exhausted = [...payment.resources, ...payment.influence];

    if(exhausted && exhausted.length){
      G.tiles.forEach(tile => {
        const planets = tile.tdata.planets;

        if(planets && planets.length){
          planets.forEach( p => {
            if(String(p.occupied) === String(playerID)){
              if(exhausted.includes(p.name)){
                p.exhausted = true;
              }
            }
          });
        }
      });
    }

    if(payment.tg){
      G.races[playerID].tg -= payment.tg;
    }
    
    let planet;

    if(pname){
      planet = activeTile.tdata.planets.find(p => p.name === pname);
      if(planet && planet.attach && planet.attach.length && planet.attach.indexOf('Demilitarized Zone')>-1) return;
      if(planet.exploration === 'Freelancers') delete planet['exploration'];
    }
    else if(!G.races[playerID].makeCustomProducing){
      return 'NO PLANET';
    }

    const ukeys = Object.keys(deploy);

    ukeys.forEach(uk => {
      const ukl = uk.toLowerCase();
      var l = 0;
      if(['carrier', 'cruiser', 'destroyer', 'dreadnought', 'flagship', 'warsun'].indexOf(ukl) > -1){
        if(!activeTile.tdata.fleet[ukl]) activeTile.tdata.fleet[ukl] = [];
        if(activeTile.tdata.occupied === undefined) activeTile.tdata.occupied = playerID;
        for(l=0; l<deploy[uk]; l++){
          activeTile.tdata.fleet[ukl].push({});
        }
      }
      else if(planet){
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
  }

  if(G.races[playerID].makeCustomProducing){
    if(G.races[playerID].makeCustomProducing.onClose === 'endStage'){
      if(ctx.activePlayers){
        events.endStage();
      }
    }
    delete G.races[playerID]['makeCustomProducing'];
  }

  if(G.races[playerID].rid === 2 && !G.races[playerID].commanderIsUnlocked){ //mentak
    checkCommanderUnlock(G, playerID);
  }
}

export const useHeroAbility = ({G, playerID}) => {
  const race = G.races[playerID];
  if(race && race.heroIsUnlocked && !race.heroIsExhausted){
    if(race.rid === 1){
      G.tiles.forEach(t => {
        if(t && t.tdata && t.tdata.tokens){
          const idx = t.tdata.tokens.indexOf(race.rid);
          if(idx > -1){
            t.tdata.tokens.splice(idx, 1);
          }
        }
      })
    }
    else if(race.rid === 2){
      race.combatActionCards.push('HERO');
    }

    race.heroIsExhausted = true;
  }
}

export const ACTION_CARD_STAGE = {
    moves: {
      cancel: ({G, ctx, playerID, events}) => {
        let card = G.races[ctx.currentPlayer].currentActionCard || G.currentTacticalActionCard;
        if(ctx.phase === 'agenda') card = G.currentAgendaActionCard;
        if(!card) card = G.currentCombatActionCard;

        if(String(card.playerID) === String(playerID)){
          if(card.when !== 'COMBAT') events.setActivePlayers({});
          
          if(card.when === 'ACTION') G.races[card.playerID].currentActionCard = undefined;
          else if(card.when === 'TACTICAL') G.currentTacticalActionCard = undefined;
          else if(card.when === 'AGENDA') G.currentAgendaActionCard = undefined;
          else if(card.when === 'COMBAT') G.currentCombatActionCard = undefined;
        }
      },
      pass: ({G, playerID, ctx, events}) => {
        let card = G.races[ctx.currentPlayer].currentActionCard || G.currentTacticalActionCard;
        if(ctx.phase === 'agenda') card = G.currentAgendaActionCard;
        if(!card) card = G.currentCombatActionCard;

        card.reaction[playerID] = 'pass';
      },
      next: ({G, ctx, playerID, random}, target) => {
        let card = G.races[ctx.currentPlayer].currentActionCard || G.currentTacticalActionCard;
        if(ctx.phase === 'agenda') card = G.currentAgendaActionCard;
        if(!card) card = G.currentCombatActionCard;

        if(String(card.playerID) === String(playerID)){
          card.target = target;

          if(card.id === 'Plague'){
            const planet = G.tiles[card.target.tidx].tdata.planets[card.target.pidx];
            const count = planet.units && planet.units.infantry ? planet.units.infantry.length : 0;
            const dice = random.D10( count );
            card.dice = dice;
          }
          else if(card.id === 'Insider Information'){
            if(G.agendaDeck.length){
              card.nextAgenda = {...G.agendaDeck[G.agendaDeck.length-1]};
            }
          }
          else if(card.id === 'Courageous to the End'){
            const dice = random.D10( 2 );
            card.dice = dice;

            const destroyed = G.races[playerID].destroyedUnits;
            const technologies = getUnitsTechnologies(destroyed, G.races[playerID]);
            let min = {combat: 11};

            Object.keys(technologies).forEach(t => {
              if(technologies[t].combat){
                if(technologies[t].combat < min.combat) min = technologies[t];
              }
            });

            card.target = min;
          }
        }
      },
      done: ({G, ctx, events, playerID, random, ...plugins}) => {
        let card = G.races[ctx.currentPlayer].currentActionCard || G.currentTacticalActionCard;
        if(ctx.phase === 'agenda') card = G.currentAgendaActionCard;
        if(!card) card = G.currentCombatActionCard;

        let sabotage;
        if(String(card.playerID) === String(playerID)){

          if(ctx.numPlayers === 1 || (card.reaction && Object.keys(card.reaction).length)){
            sabotage = Object.keys(card.reaction).find(pid => card.reaction[pid] === 'sabotage');

            if(sabotage === undefined){
              if(card.when === 'ACTION'){
                if(card.id === 'Cripple Defenses'){
                  if(card.target.tidx > -1 && card.target.pidx > -1){
                    const planet = G.tiles[card.target.tidx].tdata.planets[card.target.pidx];
                    delete planet.units['pds'];
                  }
                }
                else if(card.id === 'Economic Initiative'){
                  G.tiles.forEach(t =>{
                    if(t.tdata.planets){
                      t.tdata.planets.forEach(p => {
                        if(String(p.occupied) === String(ctx.currentPlayer) && p.trait === 'cultural' && p.exhausted){
                          p.exhausted = false;
                        }
                      })
                    }
                  });
                }
                else if(card.id === 'Fighter Conscription'){
                  G.tiles.forEach(t => {
                    let got = false;
                    if(t.tdata.planets && (!t.tdata.occupied || String(t.tdata.occupied) === String(ctx.currentPlayer))){           
                      t.tdata.planets.find(p => {
                        if(!got && String(p.occupied) === String(ctx.currentPlayer) && p.units && p.units.spacedock && p.units.spacedock.length){

                          if(!p.units.fighter) p.units.fighter=[];
                          p.units.fighter.push({});
                          got = true;
                        }
                        return got;
                      });

                      if(!got && t.tdata.fleet){
                        Object.keys(t.tdata.fleet).forEach(k => {

                          if(!got){
                            const technology = G.races[ctx.currentPlayer].technologies.find(t => t.id === k.toUpperCase());
                            if(technology && technology.capacity){
                              t.tdata.fleet[k].find(car => {
                                if(!car.payload) car.payload = [];
                                if(car.payload.length < technology.capacity){
                                  car.payload.push({id: 'fighter'});
                                  got = true;
                                }
                                return got;
                              });
                            }
                          }
                        });
                      }
                    }

                  });
                }
                else if(card.id === 'Focused Research'){
                  if(G.races[ctx.currentPlayer].tg >= 4){
                    G.races[ctx.currentPlayer].knownTechs.push(card.target.tech.id);
                    if(card.target.AI_DEVELOPMENT){
                      G.races[ctx.currentPlayer].exhaustedCards.push('AI_DEVELOPMENT_ALGORITHM');
                    }
                    if(card.target.exhausted){
                      Object.keys(card.target.exhausted).forEach(pname => {
                        const planet = getPlanetByName(G.tiles, pname);
                        planet.exhausted = true;
                      });
                    }
                    G.races[ctx.currentPlayer].tg -= 4;
                  }
                }
                else if(card.id === 'Frontline Deployment'){
                  if(card.target.tidx > -1 && card.target.pidx > -1){
                    const planet = G.tiles[card.target.tidx].tdata.planets[card.target.pidx];
                    if(!planet.units) planet.units={};
                    if(!planet.units['infantry']) planet.units.infantry = [];
                    planet.units['infantry'].push({}, {}, {});
                  }
                }
                else if(card.id === 'Ghost Ship'){
                  if(card.target.tidx > -1){
                    const tile = G.tiles[card.target.tidx];

                    if(!tile.tdata.fleet) tile.tdata.fleet={};
                    if(!tile.tdata.fleet['destroyer']) tile.tdata.fleet.destroyer = [];
                    tile.tdata.fleet['destroyer'].push({});
                    tile.tdata.occupied = playerID;
                  }
                }
                else if(card.id === 'Impersonation'){
                  if(card.target.exhausted){
                    card.target.exhausted.forEach(p => {
                      const planet = getPlanetByName(G.tiles, p.name);
                      planet.exhausted = true;
                    });
                  }
                  G.races[playerID].secretObjectives.push(G.secretObjDeck.pop());
                }
                else if(card.id === 'Industrial Initiative'){
                  let sum = 0;
                  G.tiles.forEach(t =>{
                    if(t.tdata.planets){
                      t.tdata.planets.forEach(p => {
                        if(String(p.occupied) === String(ctx.currentPlayer) && p.trait === 'industrial'){
                          sum++;
                        }
                      })
                    }
                  });
                  G.races[playerID].tg += sum;
                }
                else if(card.id === 'Insubordination'){
                  const race = G.races[card.target.playerID];
                  if(race && race.tokens.t){
                    race.tokens.t -= 1;
                  }
                }
                else if(card.id === 'Lucky Shot'){
                  const tile = G.tiles[card.target.selectedUnit.tile];
                  const units = tile.tdata.fleet[card.target.selectedUnit.unit];
                  units.pop();
                  if(!units.length) delete tile.tdata.fleet[card.target.selectedUnit.unit];
                }
                else if(card.id === 'Mining Initiative'){
                  let tg = 0;
                  if(card.target.exhausted){
                    card.target.exhausted.forEach(p => {
                      const planet = getPlanetByName(G.tiles, p.name);
                      tg = planet.resources;
                    });
                  }
                  G.races[playerID].tg += tg;
                }
                else if(card.id === 'Plagiarize' || card.id === 'Enigmatic Device'){
                  /*G.races[ctx.currentPlayer].knownTechs.push(card.target.tech.id);
                  
                  if(card.target.exhausted){
                    Object.keys(card.target.exhausted).forEach(pname => {
                      const planet = getPlanetByName(G.tiles, pname);
                      if(planet) planet.exhausted = true;
                    });
                  }*/
                  G.races[ctx.currentPlayer].knownTechs.push(card.target.tech.id);
                  
                  if(card.target.tech.type === 'unit' && card.target.tech.upgrade === true){
                    const idx = G.races[playerID].technologies.findIndex(t => t.id + '2' === card.target.tech.id);
                    if(idx > -1) G.races[playerID].technologies[idx] = {...card.target.tech, upgrade: false, alreadyUpgraded: true, id: G.races[playerID].technologies[idx].id};
                  }

                  if(card.target.AI_DEVELOPMENT){
                    G.races[ctx.currentPlayer].exhaustedCards.push('AI_DEVELOPMENT_ALGORITHM');
                  }
                  let payment = card.target.payment;
                  
                  if(payment){
                    let ex = [...payment.resources, ...payment.influence, ...payment.propulsion, ...payment.biotic, 
                      ...payment.cybernetic, ...payment.warfare];
                    ex.forEach(pname => {
                      const planet = getPlanetByName(G.tiles, pname);
                      if(planet) planet.exhausted = true;
                    });
                  }
                  G.races[ctx.currentPlayer].tg -= payment.tg;
                }
                else if(card.id === 'Plague'){
                  if(card.target.tidx > -1 && card.target.pidx > -1){
                    const planet = G.tiles[card.target.tidx].tdata.planets[card.target.pidx];
                    if(planet.units && planet.units.infantry){
                      planet.units.infantry.splice(0, card.dice.filter(d => d >= 6).length);
                      if(!planet.units.infantry.length) delete planet.units['infantry'];
                    }
                  }
                }
                else if(card.id === 'Reactor Meltdown'){
                  if(card.target.tidx > -1 && card.target.pidx > -1){
                    const planet = G.tiles[card.target.tidx].tdata.planets[card.target.pidx];
                    if(planet.units && planet.units.spacedock){
                      planet.units.spacedock.splice(0, 1);
                      if(!planet.units.spacedock.length) delete planet.units['spacedock'];
                    }
                  }
                }
                else if(card.id === 'Repeal Law'){
                  const idx = G.laws.findIndex(l => l.id === card.target.law.id);
                  if(idx > -1){
                    G.laws.splice(idx, 1); // need discard law effects
                  }
                }
                else if(card.id === 'Rise of a Messiah'){
                  G.tiles.forEach(t =>{
                    if(t.tdata.planets){
                      t.tdata.planets.forEach(p => {
                        if(String(p.occupied) === String(ctx.currentPlayer)){
                          if(!p.units) p.units={};
                          if(!p.units.infantry) p.units.infantry = [];
                          p.units.infantry.push({});
                        }
                      })
                    }
                  });
                }
                else if(card.id === 'Signal Jamming'){
                  if(card.target.tidx > -1){
                    const tile = G.tiles[card.target.tidx];
                    const race = G.races[card.target.playerID];
                    tile.tdata.tokens.push(race.rid);
                  }
                }
                else if(card.id === 'Spy'){
                  const enemy = G.races[card.target.playerID];
                  if(enemy && enemy.actionCards.length){
                    const arr = random.Shuffle([...enemy.actionCards]);
                    G.races[playerID].actionCards.push(arr[0]);

                    const idx = enemy.actionCards.findIndex(a => a.id === arr[0].id);
                    enemy.actionCards.splice(idx, 1);
                  }
                }
                else if(card.id === 'Tactical Bombardment'){
                  if(card.target.tidx > -1){
                    const tile = G.tiles[card.target.tidx];
                    if(tile.tdata.planets){
                      tile.tdata.planets.forEach(p => {
                        if(p.occupied !== undefined && String(p.occupied) !== String(playerID)){
                          p.exhausted = true;
                        }
                      });
                    }
                  }
                }
                else if(card.id === 'Unexpected Action'){
                  if(card.target.tidx > -1){
                    const tile = G.tiles[card.target.tidx];
                    const race = G.races[playerID];
                    const idx = tile.tdata.tokens.indexOf(race.rid);
                    if(idx > -1){
                      tile.tdata.tokens.splice(idx, 1);
                    }
                  }
                }
                else if(card.id === 'Unstable Planet'){
                  if(card.target.tidx > -1 && card.target.pidx > -1){
                    const planet = G.tiles[card.target.tidx].tdata.planets[card.target.pidx];
                    planet.exhausted = true;
                    if(planet.units && planet.units.infantry){
                      planet.units.infantry.splice(0, 3);
                      if(!planet.units.infantry.length) delete planet.units['infantry'];
                    }
                  }
                }
                else if(card.id === 'Uprising'){
                  if(card.target.tidx > -1 && card.target.pidx > -1){
                    const planet = G.tiles[card.target.tidx].tdata.planets[card.target.pidx];
                    planet.exhausted = true;
                    G.races[playerID].tg += planet.resources;
                  }
                }
                else if(card.id === 'War Effort'){
                  if(card.target.tidx > -1){
                    const tile = G.tiles[card.target.tidx];

                    if(!tile.tdata.fleet['cruiser']) tile.tdata.fleet.cruiser = [];
                    tile.tdata.fleet['cruiser'].push({});
                  }
                }
              }
              else if(card.when === 'TACTICAL'){
                if(card.id === 'Counterstroke'){
                  const activeTile = G.tiles.find(t => t.active === true);

                  if(activeTile && activeTile.tdata.tokens){
                    const idx = activeTile.tdata.tokens.indexOf(G.races[card.playerID].rid);
                    if(idx > -1){
                      activeTile.tdata.tokens.splice(idx, 1);
                    }
                  }
                }
                else if(card.id === 'Experimental Battlestation'){
                  const activeTile = G.tiles.find(t => t.active === true);

                  if(activeTile && !activeTile.tdata.spaceCannons_done && !G.races[ctx.currentPlayer].spaceCannonsImmunity){
                    if(G.spaceCannons){
                      if(!G.spaceCannons[playerID]){
                        G.spaceCannons[playerID] = 'spaceCannonAttack';
                      }
                    }
                    else if(activeTile.tdata.attacker || (String(activeTile.tdata.occupied) !== String(playerID) && activeTile.tdata.fleet)){
                      G.spaceCannons = {};
                      G.spaceCannons[playerID] = 'spaceCannonAttack';
                    }

                    const planet = G.tiles[card.target.tidx].tdata.planets[card.target.pidx];
                    if(planet){
                      planet.experimentalBattlestation = true;
                    }
                  }
                }
                else if(card.id === 'Flank Speed'){
                  G.races[playerID].moveBoost = 1;
                }
                else if(card.id === 'Forward Supply Base'){
                  G.races[playerID].tg += 3;
                  const race = G.races[card.target.playerID];
                  if(race){
                    race.tg += 1;
                  }
                }
                else if(card.id === 'Harness Energy'){
                  const activeTile = G.tiles.find(t => t.active === true);
                  if(activeTile && activeTile.tdata.type === 'red'){
                    //G.races[playerID].commodity = G.races[playerID].commCap;
                    replenishCommodity(G, playerID, G.races[playerID].commCap, plugins);
                  }
                }
                else if(card.id === 'In The Silence Of Space'){
                  G.races[playerID].moveThroughEnemysFleet = String(G.tiles[card.target.tidx].tid);
                }
                else if(card.id === 'Lost Star Chart'){
                  G.wormholesAdjacent = ['alpha', 'beta'];
                }
                else if(card.id === 'Master Plan'){
                  G.races[playerID].actions.splice(-1);
                }
                else if(card.id === 'Rally'){
                  const activeTile = G.tiles.find(t => t.active === true);
                  if(activeTile && activeTile.tdata.fleet && String(activeTile.tdata.occupied)!==String(playerID)){
                    G.races[playerID].tokens.f += 2;
                  }
                }
                else if(card.id === 'Reparations'){
                  if(card.target.exhausted2){
                    card.target.exhausted2.forEach(p => {
                      const planet = getPlanetByName(G.tiles, p.name);
                      planet.exhausted = true;
                    });
                  }
                  if(card.target.exhausted){
                    card.target.exhausted.forEach(p => {
                      const planet = getPlanetByName(G.tiles, p.name);
                      planet.exhausted = false;
                    });
                  }
                }
                else if(card.id === 'Solar Flare'){
                  const activeTile = G.tiles.find(t => t.active === true);
                  if(activeTile){
                    G.races[playerID].spaceCannonsImmunity = true;
                  }
                }
                else if(card.id === 'Upgrade'){
                  const activeTile = G.tiles.find(t => t.active === true);
                  if(activeTile){
                    const fleet = activeTile.tdata.fleet;
                    if(fleet && fleet['cruiser'] && String(activeTile.tdata.occupied) === String(playerID)){
                      fleet['cruiser'].pop();
                      if(!fleet['cruiser'].length) delete fleet['cruiser'];
                      if(!fleet['dreadnought']) fleet.dreadnought = [];
                      fleet['dreadnought'].push({});
                    }
                  }
                }
              }
              else if(card.when === 'AGENDA'){
                if(card.id === 'Ancient Burial Sites'){
                  G.tiles.forEach(t =>{
                    if(t.tdata.planets){
                      t.tdata.planets.forEach(p => {
                        if(String(p.occupied) === String(card.target.playerID) && p.trait === 'cultural'){
                          p.exhausted = true;
                        }
                      })
                    }
                  });
                }
                else if(card.id === 'Assassinate Representative'){
                  G.races[card.target.playerID].voteResults.push({vote: null, count: 0});
                  if(G.vote2){
                    if(G.passedPlayers.indexOf(card.target.playerID) === -1){
                      G.passedPlayers.push(card.target.playerID, card.target.playerID);
                    }
                  }
                }
                else if(card.id === 'Bribery'){
                  const agendaNumber = G.races[playerID].voteResults.length;
                  G.races[playerID].voteResults[agendaNumber - 1].count += card.target.tg;
                  G['vote' + agendaNumber].decision = computeVoteResolution(G, agendaNumber);
                }
                else if(card.id === 'Confusing Legal Text'){
                  const agendaNumber = G.races[playerID].voteResults.length;
                  G['vote' + agendaNumber].decision = G.races[card.target.playerID].name;
                }
                else if(['Construction Rider', 'Diplomacy Rider', 'Imperial Rider', 'Leadership Rider', 'Politics Rider', 'Sanction', 
                'Technology Rider', 'Trade Rider', 'Warfare Rider'].indexOf(card.id)>-1){
                  G.predict.push({playerID, card});
                  G.races[playerID].voteResults.push({vote: null, count: 0});

                  if(G.vote2){
                    if(G.passedPlayers.indexOf(playerID) === -1){
                      G.passedPlayers.push(playerID, playerID);
                    }
                  }
                }
                else if(card.id === 'Distinguished Councilor'){
                  const agendaNumber = G.races[playerID].voteResults.length;
                  G.races[playerID].voteResults[agendaNumber - 1].count += 5;
                  G['vote' + agendaNumber].decision = computeVoteResolution(G, agendaNumber);
                }
                else if(card.id === 'Hack Election'){
                  G.TURN_ORDER_IS_REVERSED = true;
                }
                else if(card.id === 'Insider Information'){
                  //nothing
                }
                else if(card.id === 'Veto'){
                  if(G.agendaDeck.length){
                    const agendaNumber = G.vote2 ? 2:1;
                    G['vote'+agendaNumber] = G.agendaDeck.pop();
                  }
                }
              }
              else if(card.when === 'COMBAT'){
                if(card.id === 'Ghost Squad'){
                  const activeTile = G.tiles.find(t => t.active === true);
                  
                  if(card.target.from !== undefined){
                    const from = activeTile.tdata.planets[parseInt(card.target.from)];
                    
                    if(card.target.to !== undefined){
                      const to = activeTile.tdata.planets[parseInt(card.target.to)];
                      
                      if(from && String(from.occupied) === String(playerID) && to && String(to.occupied) === String(playerID) && card.target.forces){
                        Object.keys(card.target.forces).forEach(u => {
                          const units = card.target.forces[u];

                          if(units && units.length){
                            if(!to.units) to.units = {};
                            if(!to.units[u]) to.units[u] = [];
                            
                            units.forEach(f => {
                              to.units[u].push({...from.units[u][f.idx]});
                              from.units[u][f.idx] = null;
                            });

                            units.forEach(f => {
                              from.units[u] = from.units[u].filter(f => f !== null);
                            });

                            if(from.units[u].length === 0) delete from.units[u];
                          }
                        });
                      }
                    }
                  }
                }
                else if(card.id === 'Intercept'){
                  if(ctx.activePlayers){
                    Object.keys(ctx.activePlayers).forEach(apid => {
                      if(String(apid) !== String(playerID)){
                        if(G.races[apid].retreat === true){
                          G.races[apid].retreat = 'cancel';
                        }
                      }
                    });
                  }
                }
                else if(card.id === 'Parley'){
                  const activeTile = G.tiles.find(t => t.active === true);
                  if(!activeTile || !activeTile.tdata.planets) return INVALID_MOVE;
                  if(!activeTile.tdata.fleet || (String(activeTile.tdata.occupied) === String(playerID))) return INVALID_MOVE;

                  const activePlanet = activeTile.tdata.planets.find(p => p.invasion);
                  if(!activePlanet || !activePlanet.invasion.troops) return INVALID_MOVE;
                  
                  const queue = [];
                  Object.keys(activePlanet.invasion.troops).forEach(tag => {
                    const units = activePlanet.invasion.troops[tag];
                    if(units && units.length){
                      queue.push(...units);
                    }
                  });

                  const technologies = getUnitsTechnologies(Object.keys(activeTile.tdata.fleet), G.races[activeTile.tdata.occupied]);
                  Object.keys(activeTile.tdata.fleet).forEach(tag => {
                    if(technologies[tag] && technologies[tag].capacity){
                      const cars = activeTile.tdata.fleet[tag];
                      if(cars && cars.length){
                        cars.forEach(c => {
                          if(!c.payload) c.payload = [];
                          while((c.payload.length < technologies[tag].capacity) && queue.length){
                            c.payload.push(queue.pop());
                          }
                        });
                      }
                    }
                  });

                  delete activePlanet.invasion['troops'];
                }
                else if(card.id === 'Scramble Frequency'){
                  if(!ctx.activePlayers) return INVALID_MOVE;

                  const enemyId = Object.keys(ctx.activePlayers).find(apid => String(apid) !== String(playerID));
                  if(enemyId === undefined) return INVALID_MOVE;

                  let spaceCannonDefence;

                  if(ctx.activePlayers[enemyId] === 'invasion'){
                    const activeTile = G.tiles.find(t => t.active === true);
                    if(!activeTile || !activeTile.tdata.planets) return INVALID_MOVE;
                    const activePlanet = activeTile.tdata.planets.find(p => p.invasion);

                    if(String(activePlanet.occupied) === String(enemyId)){
                      if(activePlanet.invasion && !activePlanet.invasion.nopds){
                        spaceCannonDefence = true;
                      }
                    }
                  }

                  if(ctx.activePlayers[enemyId] === 'bombardment' || ctx.activePlayers[enemyId] === 'antiFighterBarrage' || 
                  ctx.activePlayers[enemyId] === 'spaceCannonAttack' || spaceCannonDefence){
                    if(G.dice[enemyId]){
                      G.dice[enemyId]={};
                    }
                  }
                }
                else if(card.id === 'Skilled Retreat'){
                  const dst = G.tiles[card.target.tidx];
                  if(!dst.tdata.fleet) dst.tdata.fleet = {};

                  const activeTile = G.tiles.find(t => t.active === true);
                  let myFleet;
                  if(String(activeTile.tdata.occupied) === String(playerID)){
                    myFleet = activeTile.tdata.fleet;
                  }
                  else{
                    myFleet = activeTile.tdata.attacker;
                  }

                  Object.keys(myFleet).forEach(tag => {
                    if(myFleet[tag] && myFleet[tag].length){
                      if(!dst.tdata.fleet[tag]) dst.tdata.fleet[tag] = [];
                      dst.tdata.fleet[tag].push(...myFleet[tag]);
                    }
                  });

                  if(String(activeTile.tdata.occupied) === String(playerID)){
                    activeTile.tdata.fleet = activeTile.tdata.attacker;
                    activeTile.tdata.occupied = ctx.currentPlayer;
                  }
                  
                  delete activeTile.tdata.attacker;
                  dst.tdata.occupied = playerID;
                  if(!dst.tdata.tokens) dst.tdata.tokens=[];
                  dst.tdata.tokens.push(G.races[playerID].rid);

                  events.setActivePlayers({});
                }
                else if(card.id === 'Courageous to the End'){
                  const count = card.dice.filter(d => d >= card.target.combat).length;
                  if(count){
                    const enemyId = Object.keys(ctx.activePlayers).find(apid => String(apid) !== String(playerID));
                    if(enemyId){
                      G.races[enemyId].mustChooseAndDestroy = {
                        count,
                        tile: 'active'
                      }
                    }
                  }
                }
                else if(card.id === 'Direct Hit'){
                  const activeTile = G.tiles.find(t => t.active === true);
                  let fleet;

                  if(String(activeTile.tdata.occupied) === String(playerID)){
                    fleet = activeTile.tdata.attacker;
                  }
                  else{
                    fleet = activeTile.tdata.fleet;
                  }

                  if(fleet){
                    if(card.target.tag && fleet[card.target.tag] && fleet[card.target.tag][card.target.idx]){
                      delete fleet[card.target.tag][card.target.idx];
                      fleet[card.target.tag] = fleet[card.target.tag].filter(f => f);
                      if(!fleet[card.target.tag].length) delete fleet[card.target.tag];
                    }
                  }
                }
              }
              else if(card.when === 'STATUS'){
                if(card.id === 'Political Stability'){
                  G.races[playerID].exhaustedCards.push(card.id);
                }
              }
              else if(card.when === 'STRATEGY'){
                if(card.id === 'Public Disgrace'){
                  G.races[card.target.playerID].forbiddenStrategy = G.races[card.target.playerID].strategy.splice(-1);
                }
                else if(card.id === 'Summit'){
                  let possible = 16 - (G.races[playerID].tokens.new + G.races[playerID].tokens.s + G.races[playerID].tokens.t + G.races[playerID].tokens.f);
                  if(possible < 0) possible = 0;
                  G.races[playerID].tokens.new += Math.min(2, possible);
                }
              }
            }
          }

          const idx = G.races[card.playerID].actionCards.findIndex(a => a.id === card.id);
          G.discardedActions.push(...G.races[card.playerID].actionCards.splice(idx, 1));

          if(card.when === 'ACTION'){
            G.races[card.playerID].actions.push('ACTION_CARD');
            G.races[card.playerID].currentActionCard = undefined;
          }
          else if(card.when === 'TACTICAL'){
            G.currentTacticalActionCard = undefined;
            G.races[card.playerID].currentActionCard = undefined;
          }
          else if(card.when === 'AGENDA'){
            G.currentAgendaActionCard = undefined;
            G.races[playerID].actions.push('ACTION_CARD');
            events.endTurn();
          }
          else if(card.when === 'COMBAT'){
            G.currentCombatActionCard = undefined;
            if(!sabotage) G.races[playerID].combatActionCards.push(card.id);
          }                      
          
          if(card.when !== 'COMBAT') events.setActivePlayers({});
        }

        plugins.effects.tg();
      },
      sabotage: ({G, ctx, playerID}) => {
        let card = G.races[ctx.currentPlayer].currentActionCard || G.currentTacticalActionCard;
        if(ctx.phase === 'agenda') card = G.currentAgendaActionCard;
        if(!card) card = G.currentCombatActionCard;

        const idx = G.races[playerID].actionCards.findIndex(c => c.id === 'Sabotage');
        if(idx > -1){
          card.reaction[playerID] = 'sabotage';
          G.discardedActions.push(...G.races[playerID].actionCards.splice(idx, 1));
          //G.races[playerID].actionCards.splice(idx, 1);
        }
      }
    }
  }


const rerollDice = ({G, playerID, random}, unit, didx, ability, adj) => {
  try{
    const dice = random.D10(1);
    if(!G.dice[playerID][unit].reroll) G.dice[playerID][unit].reroll = {};
    G.dice[playerID][unit].reroll[didx] = dice[0];

    if(G.races[playerID].combatActionCards.includes('The Crown of Thalnos')){
      if(dice[0]+adj < ability.value){
        G.dice[playerID][unit].reroll[didx] = -dice[0];
      }
    }
  }
  catch(e){console.log(e)}
}

const chooseAndDestroyMove = ({G, playerID},  destroyed) => {
  const info = G.races[playerID].mustChooseAndDestroy;
  let fleet = {};

  if(info.tile === 'active'){
      const activeTile = G.tiles.find(t => t.active === true);
      if(!activeTile) return;

      if(String(activeTile.tdata.occupied) === String(playerID)){
          fleet = activeTile.tdata.fleet;
      }
      else if(activeTile.tdata.attacker){
        fleet = activeTile.tdata.attacker;
      }
  }

  Object.keys(destroyed).forEach(tag => {
    destroyed[tag].forEach(car => {
      if(car.payload && car.payload.length){
        car.payload.forEach(p => {
          if(fleet[tag] && fleet[tag][car.idx] && fleet[tag][car.idx].payload){
            if(fleet[tag][car.idx].payload[p.pidx]){
              delete fleet[tag][car.idx].payload[p.pidx];
              G.races[playerID].destroyedUnits.push(p.id); //remember destroyed units
            }
          }
        });

        if(fleet[tag] && fleet[tag][car.idx] && fleet[tag][car.idx].payload){
          fleet[tag][car.idx].payload = fleet[tag][car.idx].payload.filter(p => p);
        }
      }

      if(car.hit && fleet[tag] && fleet[tag][car.idx]){
        delete fleet[tag][car.idx];
        G.races[playerID].destroyedUnits.push(tag); //remember destroyed units
      }
    });

    fleet[tag] = fleet[tag].filter(f => f);
    if(!fleet[tag].length) delete fleet[tag];
  });

  delete G.races[playerID].mustChooseAndDestroy;
}

export const ACTS_STAGES = {
  trade: {
    moves: {
      accept: ({ctx, playerID, events}, pid) => {
        if(ctx.activePlayers){
          const val = {};
          
          val[playerID] = {stage: 'trade2'};
          val[pid] = {stage: 'trade2'};
      
          events.setActivePlayers({value: val});
        }
      },
      decline: ({events}) => {
        events.setActivePlayers({});
      },
      addTradeItem,
      delTradeItem
    }
  },
  trade2: {
    moves: {
      accept: ({G, playerID, events, ctx, ...plugins}) => {
        try{
          const from = G.races[playerID];
          const toId = Object.keys(ctx.activePlayers).find(apk => String(apk) !== String(playerID));
          const to = G.races[toId];

          const makeTrade = (src, dst, tradeItem, count) => {
            if(tradeItem === 'tg' && src.tg >= count){
              src.tg -= count;
              dst.tg += count;
            }
            else if(tradeItem === 'commodity' && src.commodity >= count){
              src.commodity -= count;
              dst.tg += count;
            }
            else if(tradeItem.startsWith('fragment.')){
              const frag = tradeItem.substr(tradeItem.indexOf('.') + 1);
              if(src.fragments[frag] >= count){
                src.fragments[frag] -= count;
                dst.fragments[frag] += count;
              }
            }
            else if(tradeItem.startsWith('promissory.')){
              const cid =  tradeItem.substr(tradeItem.indexOf('.') + 1);
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
                  dst.promissory.push({...card, owner: src.rid, isActive: ['TRADE_AGREEMENT', 'ALLIANCE', 'CEASEFIRE', 'SUPPORT_FOR_THE_THRONE'].includes(card.id) ? true : undefined});
                  card.sold = dst.rid;
                }
              }
            }
            else if(tradeItem.startsWith('action.')){
              const cid =  tradeItem.substr(tradeItem.indexOf('.') + 1);
              const card = src.actionCards.find(c => c.id === cid);

              if(card){
                dst.actionCards.push({...card});
                src.actionCards.splice(src.actionCards.findIndex(c => c.id === cid), 1);
              }
            }
          }

          let tradeObj = from.trade[toId];
          if(tradeObj && Object.keys(tradeObj)){
            Object.keys(tradeObj).forEach(itemName => {
              makeTrade(from, to, itemName, tradeObj[itemName]);
            });

            plugins.effects.trade({src: from.rid, dst: to.rid, obj: {...tradeObj}});
          }

          tradeObj = to.trade[playerID];
          if(tradeObj && Object.keys(tradeObj)){
            Object.keys(tradeObj).forEach(itemName => {
              makeTrade(to, from, itemName, tradeObj[itemName])
            });

            plugins.effects.trade({src: to.rid, dst: from.rid, obj: {...tradeObj}});
          }

          delete from.trade[toId];
          delete to.trade[playerID];
        }
        catch(e){
          console.log(e)
        }
        finally{
          events.setActivePlayers({});
        }
      },
      decline: ({events}) => {
        events.setActivePlayers({});
      }
    }
  },
  tacticalActionCard: {
    moves: {
      playActionCard: ({G, playerID, events, ctx}, card) => {
        if(card.when === 'TACTICAL'){
          if(!G.races[ctx.currentPlayer].currentActionCard){ //no current card from active player
            if(!G.currentTacticalActionCard){ //no current tactical card
              G.currentTacticalActionCard = {...card, reaction: {}, playerID};
              events.setActivePlayers({ all: 'actionCard' });
            }
          }
        }
      },
      /*cancel: ({G, ctx, playerID, events}) => {
        if(String(ctx.currentPlayer) === String(playerID)){
          events.setActivePlayers({});
          G.races[ctx.currentPlayer].currentActionCard = undefined;
        }
      }*/
    }
  },
  actionCard: ACTION_CARD_STAGE,
  strategyCard: {
    moves: {
      botStageMove: ({ G, ctx, playerID, random, events, ...plugins }) => {
        botMove({G, playerID, ctx, events, random, plugins});
      },
      joinStrategy: ({ G, ctx, playerID, events, ...plugins }, {exhausted, payment, result, exhaustedCards}) => {
        const exhaustPlanet = (revert) => {
          if(exhausted && exhausted.length){
            
            G.tiles.forEach(tile => {
              const planets = tile.tdata.planets;

              if(planets && planets.length){
                planets.forEach( p => {
                  if(String(p.occupied) === String(playerID)){
                    if(exhausted.includes(p.name)){
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

            G.races[playerID].tg -= payment.tg;
            let possible = 16 - (G.races[playerID].tokens.new + G.races[playerID].tokens.s + G.races[playerID].tokens.t + G.races[playerID].tokens.f);
            if(possible < 0) possible = 0;
            G.races[playerID].tokens.new = Math.min(result, possible);
            break;
          case 'DIPLOMACY':
            if(result > 0 && ctx.currentPlayer === playerID){
              G.races.forEach((r, i) => {
                if(String(i) !== String(playerID)){
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
                      if(p.attach && p.attach.length && p.attach.indexOf('Demilitarized Zone')>-1) return false;
                      if(String(p.occupied) === String(playerID) && p.name === keys[0]){
                        if(!p.units) p.units={}
                        if(!p.units[obj[keys[0]]]) p.units[obj[keys[0]]]=[];
                        p.units[obj[keys[0]]].push({});

                        if(String(ctx.currentPlayer) !== String(playerID)){
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
              //G.races[playerID].commodity = G.races[playerID].commCap;
              replenishCommodity(G, playerID, G.races[playerID].commCap, plugins);

              if(result.length){
                G.races[playerID].strategy.find(s => s.id === 'TRADE').NO_TOKEN_RACES = result;
              }
            }
            else{
              //G.races[playerID].commodity = G.races[playerID].commCap;
              replenishCommodity(G, playerID, G.races[playerID].commCap, plugins);

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

                if(exhaustedCards && exhaustedCards.indexOf('AI_DEVELOPMENT_ALGORITHM') > -1){
                  G.races[playerID].exhaustedCards.push('AI_DEVELOPMENT_ALGORITHM');
                }

                if(payment.tg){
                  G.races[playerID].tg -= payment.tg;
                }
                
                G.tiles.some(tile => {
                  const planets = tile.tdata.planets;

                  if(planets && planets.length){
                    const found = planets.some( p => {
                      if(String(p.occupied) === String(playerID) && p.name === result.base){
                        tile.tdata.producing_done = true;
                        const ukeys = Object.keys(result.deploy);
                        ukeys.forEach(uk => {
                          const ukl = uk.toLowerCase();
                          var l = 0;
                          if(['carrier', 'cruiser', 'destroyer', 'dreadnought', 'flagship', 'warsun'].indexOf(ukl) > -1){
                            if(!tile.tdata.fleet[ukl]) tile.tdata.fleet[ukl] = [];
                            if(tile.tdata.occupied === undefined) tile.tdata.occupied = playerID;
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
              G.races[playerID].tg -= payment.tg;

              keys.forEach(k => {
                G.races[playerID].knownTechs.push(result[k].id);

                if(result[k].type === 'unit' && result[k].upgrade === true){
                  const idx = G.races[playerID].technologies.findIndex(t => t.id + '2' === result[k].id);
                  if(idx > -1) G.races[playerID].technologies[idx] = {...result[k], upgrade: false, alreadyUpgraded: true, id: G.races[playerID].technologies[idx].id};
                }
              });

              if(exhaustedCards){
                if(exhaustedCards.includes('AI_DEVELOPMENT_ALGORITHM')){
                  G.races[playerID].exhaustedCards.push('AI_DEVELOPMENT_ALGORITHM');
                }
                if(exhaustedCards.includes("The Prophet's Tears")){
                  G.races[playerID].exhaustedCards.push("The Prophet's Tears");
                }
                if(exhaustedCards.includes("The Prophet's Tears_1")){
                  if(G.actionsDeck.length){
                    G.races[playerID].actionCards.push(G.actionsDeck.pop());
                  }
                  G.races[playerID].exhaustedCards.push("The Prophet's Tears");
                }
              }
              
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
        
        if(String(ctx.currentPlayer) !== String(playerID)){
          if(G.strategy !== 'LEADERSHIP'){
            if(!(exhaustedCards && exhaustedCards.includes('Scepter of Emelpar'))){
              G.races[playerID].tokens.s--;
            }
            else{
              const relic = G.races[playerID].relics.find(r => r.id === 'Scepter of Emelpar');
              if(relic){
                relic.exhausted = true;
                plugins.effects.relic_ex({id: 'Scepter of Emelpar', pid: playerID})
              }
            }
          }
        }
        
        if(Object.keys(ctx.activePlayers).length === 1){
          G.actionsDeck = G.actionsDeck.filter(a => a.issued !== true);
          G.secretObjDeck = G.secretObjDeck.filter(a => a.issued !== true);
        }

        events.endStage();
        plugins.effects.tg();
      },
      passStrategy: ({ G, ctx, events }) => {
        if(Object.keys(ctx.activePlayers).length === 1){
          G.actionsDeck = G.actionsDeck.filter(a => a.issued !== true);
          G.secretObjDeck = G.secretObjDeck.filter(a => a.issued !== true);
        }
        events.endStage();
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
      }
    }
  },
  spaceCannonAttack: {
    moves: {
    playActionCard: playCombatAC,
    actionCardCancel: ACTION_CARD_STAGE.moves.cancel,
    actionCardNext: ACTION_CARD_STAGE.moves.next,
    actionCardPass: ACTION_CARD_STAGE.moves.pass,
    actionCardDone: ACTION_CARD_STAGE.moves.done,
    actionCardSabotage: ACTION_CARD_STAGE.moves.sabotage,

     rollDice: ({G, playerID, random}, unit, count, withTech) => {
      const dice = random.D10(count || 1);
      G.dice = produce(G.dice, draft => {
        draft[playerID][unit] = {dice, withTech};
      });
      if(withTech.indexOf('GRAVITON_LASER_SYSTEM')>-1){
        G.races[playerID].exhaustedCards.push('GRAVITON_LASER_SYSTEM');
      }
     },
     nextStep: ({G, events, ctx, playerID}) => {

      const getHits = () => {
        let result = 0;
        if(G.spaceCannons !== undefined){
          const adj = haveTechnology(G.races[ctx.currentPlayer], 'ANTIMASS_DEFLECTORS') ? -1:0;
          Object.keys(G.spaceCannons).forEach(pid => {
              if(G.dice[pid]){
                  Object.keys(G.dice[pid]).forEach(unit => {
                      const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                      if(technology && technology.spaceCannon){
                        result += G.dice[pid][unit].dice.filter(d => d + adj >= technology.spaceCannon.value).length;
                      }
                      else if(unit === 'spacedock' && G.dice[pid][unit].withTech.indexOf('Experimental Battlestation') > -1){
                        result += G.dice[pid][unit].dice.filter(d => d + adj >= 5).length;
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
    playActionCard: playCombatAC,
    actionCardCancel: ACTION_CARD_STAGE.moves.cancel,
    actionCardNext: ACTION_CARD_STAGE.moves.next,
    actionCardPass: ACTION_CARD_STAGE.moves.pass,
    actionCardDone: ACTION_CARD_STAGE.moves.done,
    actionCardSabotage: ACTION_CARD_STAGE.moves.sabotage,
    secretObjectiveConfirm,

    nextStep: ({G, playerID, ctx, events, ...plugins}, hits) => {
      let fleet;
      let endLater = false;
      const activeTile = G.tiles.find(t => t.active === true);
      if(!activeTile.tdata.spaceCannons_done) activeTile.tdata.spaceCannons_done = true;
       
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
                if(p && p.hit){
                  if(p.hit > 1 || !technologies[p.id].sustain){
                    delete fleet[f][i].payload[j];
                    if(p.id === 'mech' && haveTechnology(G.races[playerID], 'SELF_ASSEMBLY_ROUTINES')){
                      G.races[playerID].tg += 1;
                      plugins.effects.tg();
                    }
                  }
                }
              });
              car.payload = car.payload.filter(p => p);
            }
          });
          fleet[f] = fleet[f].filter(car => car);
          if(!fleet[f].length) delete fleet[f];
        });

        if(!Object.keys(fleet).length){
          if((activeTile.tdata.occupied !== ctx.currentPlayer) && activeTile.tdata.attacker){
            delete activeTile.tdata.attacker;
            if(checkSecretObjective(G, activeTile.tdata.occupied, 'Turn Their Fleets to Dust')){ endLater = true; }
          }
          else{
            delete activeTile.tdata.fleet;
            delete activeTile.tdata.occupied;
            if(checkSecretObjective(G, ctx.currentPlayer, 'Turn Their Fleets to Dust')){ endLater = true; }
          }
          
        }

        delete G['spaceCannons'];
      }
     
      if(!endLater){ events.endStage(); }
    } 

    },
  },
  antiFighterBarrage: {
    moves: {
      playActionCard: playCombatAC,
      actionCardCancel: ACTION_CARD_STAGE.moves.cancel,
      actionCardNext: ACTION_CARD_STAGE.moves.next,
      actionCardPass: ACTION_CARD_STAGE.moves.pass,
      actionCardDone: ACTION_CARD_STAGE.moves.done,
      actionCardSabotage: ACTION_CARD_STAGE.moves.sabotage,
      secretObjectiveConfirm,
      useHeroAbility,

      rollDice: ({G, playerID, random}, unit, count) => {
        const dice = random.D10(count || 1);
        G.dice = produce(G.dice, draft => {
          draft[playerID][unit] = {dice};
        });
      },
      nextStep: ({G, events, ctx, playerID}) => {

        try{
          G.spaceCombat = {}; //flush assault_cannon and ambush flags
          spliceCombatAC(G.races[playerID], 'Scramble Frequency');
          let enemyId;
          let hits = {};
          Object.keys(ctx.activePlayers).forEach(pid => {
            if(String(playerID) !== String(pid)){ enemyId = pid; }
            let h = 0;
            if(G.dice[pid]){
                Object.keys(G.dice[pid]).forEach(unit => {
                    const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                    if(technology && technology.barrage){
                        h += G.dice[pid][unit].dice.filter(d => d >= technology.barrage.value).length;
                    }
                });
            }
            hits[pid] = h;
          });
          
          const activeTile = G.tiles.find(t => t.active === true);
          const attackerHits = hits[ctx.currentPlayer];
          const defenderHits = hits[activeTile.tdata.occupied];

          const enemyUseHero = enemyHaveCombatAC(G.races, ctx.activePlayers, playerID, 'HERO');

          const makeHit = (fleet, count, enemyFleet) => {
            let remain = count;

            Object.keys(fleet).forEach(tag => {
              if(remain > 0){
                fleet[tag].forEach((car, c) => {
                  if(remain > 0 && tag === 'fighter'){
                    delete fleet[tag][c];
                    G.races[playerID].destroyedUnits.push(tag);

                    if(G.races[enemyId] && G.races[enemyId].rid === 2 && enemyUseHero){//mentak
                      if(!enemyFleet[tag]) enemyFleet[tag] = [];
                      enemyFleet[tag].push({...fleet[tag][c], hit: 0});
                    }

                    remain--;
                  }
                  else if(car.payload && remain > 0){
                    car.payload.forEach((p, i) => {
                      if(p && p.id === 'fighter' && remain > 0){
                        delete car.payload[i];
                        G.races[playerID].destroyedUnits.push(p.id);

                        if(G.races[enemyId] && G.races[enemyId].rid === 2 && enemyUseHero){//mentak
                          if(!enemyFleet[p.id]) enemyFleet[p.id] = [];
                          enemyFleet[p.id].push({...p, hit: 0});
                        }

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
            if(defenderHits > 0 && enemyId !== undefined){
              checkSecretObjective(G, playerID, 'Fight with Precision', activeTile.tdata.attacker);
            }
          }
          else{
            makeHit(activeTile.tdata.fleet, attackerHits);
            if(attackerHits > 0 && enemyId !== undefined){
              checkSecretObjective(G, playerID, 'Fight with Precision', activeTile.tdata.fleet);
            }
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

        }
        catch(e){
          console.log(e)
        }

      },
      retreat: ({G, playerID}) => {
        if(G.races[playerID].retreat !== 'cancel'){
          G.races[playerID].retreat = true;
          loadUnitsOnRetreat(G, playerID);
        }
      }
    },
    
  },
  spaceCombat: {
    moves: {
      playActionCard: playCombatAC,
      actionCardCancel: ACTION_CARD_STAGE.moves.cancel,
      actionCardNext: ACTION_CARD_STAGE.moves.next,
      actionCardPass: ACTION_CARD_STAGE.moves.pass,
      actionCardDone: ACTION_CARD_STAGE.moves.done,
      actionCardSabotage: ACTION_CARD_STAGE.moves.sabotage,

      chooseAndDestroy: chooseAndDestroyMove,
      rollDice: ({G, playerID, random}, unit, count) => {
        const dice = random.D10(count || 1);
        G.dice = produce(G.dice, draft => {
          draft[playerID][unit] = {dice};
        });
      },
      rerollDice,
      nextStep: ({G, playerID, events, ctx}, hits) => {
        try{
          let fleet;
          const activeTile = G.tiles.find(t => t.active === true);
          
          if(String(playerID) === String(ctx.currentPlayer)){
            fleet = activeTile.tdata.attacker;
          }
          else{
            fleet = activeTile.tdata.fleet;
          }
          
          let technologies = getUnitsTechnologies([...Object.keys(fleet), 'fighter', 'mech'], G.races[playerID]);
          let needFilterDeleted = false;

          Object.keys(G.dice[playerID]).forEach(u => { //remove units after unluck reroll with relic
            if(G.dice[playerID][u] && G.dice[playerID][u].reroll){
              Object.keys(G.dice[playerID][u].reroll).forEach(kstr => {
                
                const k = parseInt(kstr);

                if(G.dice[playerID][u].reroll[k] && G.dice[playerID][u].reroll[k] < 0){
                  let doCheck = true;
                  let uidx = k;

                  if(technologies[u] && technologies[u].shot > 1){//flagship or warsun
                    doCheck = false;

                    if(k % technologies[u].shot === 0){
                      if(G.dice[playerID][u].reroll[k-1] && G.dice[playerID][u].reroll[k-1] < 0){
                        if(technologies[u].shot > 2){
                          if(G.dice[playerID][u].reroll[k-2] && G.dice[playerID][u].reroll[k-2] < 0){
                            uidx = k / 3;
                            doCheck = true;
                          }
                        }
                        else{
                          uidx = k / 2;
                          doCheck = true;
                        }
                      }
                    }
                  }

                  if(doCheck){
                    if(fleet[u] && fleet[u][uidx]){
                      delete fleet[u][uidx];
                    }
                    else{ //remove payload by index
                      let index = 0;
                      Object.keys(fleet).find(sheep => {

                        return fleet[sheep].find((car, caridx) => {
                          if(car && car.payload && car.payload.length){
                            return car.payload.find((p, pidx) => {

                              if(p && p.id === u){
                                if(index === uidx){
                                  delete fleet[sheep][caridx].payload[pidx];
                                  return true;
                                }
                                else index++;
                              }
                              else if(!p){index++} //already deleted

                              return false;
                            })
                          }

                          return false;
                        })
                      });

                    }

                    needFilterDeleted = true;
                    G.races[playerID].destroyedUnits.push(u); //remember destroyed units
                  }
                }

              })
            }
          });
        
          if(needFilterDeleted){ //filter deleted units
            Object.keys(fleet).forEach(sheep => {
              fleet[sheep] = fleet[sheep].filter(s => s);

              fleet[sheep].forEach((car) => {
                if(car && car.payload){
                  car.payload = car.payload.filter(p => p)
                }
              });
            });
          }


          
          if(spliceCombatAC(G.races[playerID], 'Emergency Repairs')){
            repairAllActiveTileUnits(G, playerID);
          }
        
          if(hits && Object.keys(hits).reduce((a,b) => a + hits[b], 0) === 0){
            if(G.races[playerID].retreat !== true){
              if(G.races[playerID].retreat === 'cancel'){
                G.races[playerID].retreat = undefined;
              }

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
        }
        catch(e){console.log(e)}
      },
      retreat: ({G, playerID}) => {
        if(G.races[playerID].retreat !== 'cancel'){
          G.races[playerID].retreat = true;
          loadUnitsOnRetreat(G, playerID);
        }
      },
      
    }
  },
  spaceCombat_step2: {
    moves: {
      playActionCard: playCombatAC,
      actionCardCancel: ACTION_CARD_STAGE.moves.cancel,
      actionCardNext: ACTION_CARD_STAGE.moves.next,
      actionCardPass: ACTION_CARD_STAGE.moves.pass,
      actionCardDone: ACTION_CARD_STAGE.moves.done,
      actionCardSabotage: ACTION_CARD_STAGE.moves.sabotage,
      secretObjectiveConfirm,
      useHeroAbility,

      chooseAndDestroy: chooseAndDestroyMove,
      nextStep: ({G, playerID, ctx, events, random, ...plugins}, hits, ability) => {
        try{
          let fleet;
          let enemyFleet;

          const activeTile = G.tiles.find(t => t.active === true);
          
          if(String(playerID) === String(ctx.currentPlayer)){
            fleet = activeTile.tdata.attacker;
            enemyFleet = activeTile.tdata.fleet;
          }
          else{
            fleet = activeTile.tdata.fleet;
            enemyFleet = activeTile.tdata.attacker;
          }
          
          let technologies = getUnitsTechnologies([...Object.keys(fleet), 'fighter', 'mech'], G.races[playerID]);
          technologies = adjustTechnologies(G, ctx, playerID, technologies);

          hits && Object.keys(hits).forEach(unit => { //hits assignment
            if(hits[unit].length){
              hits[unit].forEach((car, i) => {
                if(car.hit){
                  if(!unit.startsWith('-')){
                    if(!fleet[unit][car.idx].hit) fleet[unit][car.idx].hit = 0;
                    fleet[unit][car.idx].hit += car.hit;
                  }
                  else{ //repair
                    fleet[unit.replace('-', '')][car.idx].hit = 0;
                  }
                }

                if(car.payload && car.payload.length){
                  car.payload.forEach((p, j) => {
                    if(p.hit){
                      if(!unit.startsWith('-')){
                        const pl = fleet[unit][car.idx].payload[p.pidx];
                        if(!pl.hit) pl.hit = 0;
                        pl.hit += p.hit;
                      }
                      else{ //repair
                        fleet[unit][car.idx].payload[p.pidx].hit = 0;
                      }
                    }
                  })
                }
              });
            }  
          });

          const enemyId = Object.keys(ctx.activePlayers).find(a => String(a)!== String(playerID));
          const enemyUseHero = enemyHaveCombatAC(G.races, ctx.activePlayers, playerID, 'HERO');

          Object.keys(fleet).forEach(f => { //remove destroyed units
            fleet[f].forEach((car, i) => {
              if(car.hit > 1 || (car.hit === 1 && !technologies[f].sustain)){
                G.races[playerID].destroyedUnits.push(f); //remember destroyed units
                delete fleet[f][i];

                if(G.races[enemyId] && G.races[enemyId].rid === 2 && enemyUseHero){//mentak
                  if(!enemyFleet[f]) enemyFleet[f] = [];
                  enemyFleet[f].push({...car, hit: 0});
                }

                if(['flagship', 'warsun'].includes(f) && ctx.activePlayers && Object.keys(ctx.activePlayers).length){ //todo: make this check for any kind of destruction
                  if(!isNaN(enemyId)) checkSecretObjective(G, parseInt(enemyId), 'Destroy Their Greatest Ship');
                }
              }
              else if(car.payload && car.payload.length){
                car.payload.forEach((p, idx) => {
                  if(p && (p.hit > 1 || (p.hit === 1 && !technologies[p.id].sustain))){
                    G.races[playerID].destroyedUnits.push(p.id);
                    delete fleet[f][i].payload[idx];

                    if(p.id === 'fighter' && G.races[enemyId] && G.races[enemyId].rid === 2 && enemyUseHero){//mentak
                      if(!enemyFleet[p.id]) enemyFleet[p.id] = [];
                      enemyFleet[p.id].push({...p, hit: 0});
                    }

                    if(p.id === 'mech' && haveTechnology(G.races[playerID], 'SELF_ASSEMBLY_ROUTINES')){
                      G.races[playerID].tg += 1;
                      plugins.effects.tg();
                    }
                  }
                });
                car.payload = car.payload.filter(p => p);
              }
            });
            fleet[f] = fleet[f].filter(car => car);
            if(fleet[f].length === 0) delete fleet[f];
          });

          if(G.races[playerID].destroyedUnits.includes('flagship') &&  G.races[playerID].combatActionCards.includes('FLAGSHIP')){
            G.races[playerID].combatActionCards =  G.races[playerID].combatActionCards.filter(ac => ac !== 'FLAGSHIP')
          }
          
          if(!(activeTile.tdata.attacker && Object.keys(activeTile.tdata.attacker).length) ||
            !(activeTile.tdata.fleet && Object.keys(activeTile.tdata.fleet).length)){
            events.setStage('spaceCombat_await'); //end space battle
          }
          else{
            if(G.races[playerID].retreat === true){ //if I retreat
              events.setStage('combatRetreat');
            }
            else{
              if(G.races[playerID].retreat === 'cancel'){
                G.races[playerID].retreat = undefined;
              }
              let needAwait = true; //wait before new round or while enemy retreat
              Object.keys(ctx.activePlayers).forEach(pid => {
                if(ctx.activePlayers[pid] === 'spaceCombat_await') needAwait = false;
              });
              
              if(needAwait){
                events.setStage('spaceCombat_await');
              }
              else if(ability === 'assaultCannon' || ability === 'ambush'){
                const val = {};
                val[activeTile.tdata.occupied] = {stage: 'antiFighterBarrage'};
                val[ctx.currentPlayer] = {stage: 'antiFighterBarrage'};
                
                G.dice[activeTile.tdata.occupied] = {};
                G.dice[ctx.currentPlayer] = {};
                delete G.spaceCombat['assaultCannon'];

                if(ability === 'assaultCannon' && (G.races[playerID].rid === 2 || G.races[activeTile.tdata.occupied].rid === 2)){ //mentak ambush
                  val[activeTile.tdata.occupied] = {stage: 'spaceCombat_step2'};
                  val[playerID] = {stage: 'spaceCombat_step2'};

                  const doAmbush = (pid, fleet) => {
                    let count = 0;

                    if(fleet['cruiser'] && fleet['cruiser'].length > 0){
                      count = fleet['cruiser'].length;
                      G.dice[pid] = {cruiser: {withTech: 'ambush', dice: random.D10(Math.min(count, 2))}}
                    }
                    if(count < 2 && fleet['destroyer'] && fleet['destroyer'].length > 0){
                      G.dice[pid] = {...G.dice[pid], destroyer: {withTech: 'ambush', dice: random.D10(Math.min(2 - count, fleet['destroyer'].length))}}
                    }
                  }

                  if(G.races[playerID].rid === 2){
                    doAmbush(playerID, activeTile.tdata.attacker);
                    G.spaceCombat.ambush = true;
                  }
                  else if(G.races[activeTile.tdata.occupied].rid === 2){
                    doAmbush(activeTile.tdata.occupied, activeTile.tdata.fleet);
                    G.spaceCombat.ambush = true;
                  }
                }
                else if(ability === 'ambush'){
                  delete G.spaceCombat['ambush'];

                  /*const assaultReq = (my, enemy) => {
                    let myFleet = 0;
                    Object.keys(my).filter(k => k!=='fighter').forEach(k => myFleet += my[k].length);
    
                    let enemyFleet = 0;
                    Object.keys(enemy).filter(k => k!=='fighter').forEach(k => enemyFleet += enemy[k].length);
    
                    return (myFleet >= 3) && (enemyFleet > 0);
                  }

                  if(haveTechnology(G.races[ctx.currentPlayer], 'ASSAULT_CANNON') && assaultReq(activeTile.tdata.attacker, activeTile.tdata.fleet)){
                    val[activeTile.tdata.occupied] = {stage: 'spaceCombat_step2'};
                    val[ctx.currentPlayer] = {stage: 'spaceCombat_await'};
                    G.spaceCombat['assaultCannon'] = true;
                  }
    
                  if(haveTechnology(G.races[activeTile.tdata.occupied], 'ASSAULT_CANNON') && assaultReq(activeTile.tdata.fleet, activeTile.tdata.attacker)){
                    if(val[activeTile.tdata.occupied].stage !== 'spaceCombat_step2') val[activeTile.tdata.occupied] = {stage: 'spaceCombat_await'};
                    val[ctx.currentPlayer] = {stage: 'spaceCombat_step2'};
                    G.spaceCombat['assaultCannon'] = true;
                  }*/
                  
                }

                events.setActivePlayers({value: val});
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


          if(spliceCombatAC(G.races[playerID], 'Emergency Repairs')){
            repairAllActiveTileUnits(G, playerID);
          }
          spliceCombatAC(G.races[playerID], 'Morale Boost');
          spliceCombatAC(G.races[playerID], 'Reflective Shielding');
          spliceCombatAC(G.races[playerID], 'Shields Holding');

        }
        catch(e){
          console.log(e)
        } 
      }

    }
  },
  spaceCombat_await:{
    moves: {
      playActionCard: playCombatAC,
      actionCardCancel: ACTION_CARD_STAGE.moves.cancel,
      actionCardNext: ACTION_CARD_STAGE.moves.next,
      actionCardPass: ACTION_CARD_STAGE.moves.pass,
      actionCardDone: ACTION_CARD_STAGE.moves.done,
      actionCardSabotage: ACTION_CARD_STAGE.moves.sabotage,
      secretObjectiveConfirm,
      chooseAndDestroy: chooseAndDestroyMove,
      endBattle: ({G, events, playerID, ctx, ...plugins}) => {
        const activeTile = G.tiles.find(t => t.active === true);
        let looser;
        let endLater = false;

        if(activeTile.tdata.fleet && !Object.keys(activeTile.tdata.fleet).length && 
        activeTile.tdata.attacker && !Object.keys(activeTile.tdata.attacker).length){ //draft
          if(ctx.activePlayers && Object.keys(ctx.activePlayers).length === 1){ //last player in stage
            delete activeTile.tdata.attacker;
            delete activeTile.tdata.fleet;
            delete activeTile.tdata.occupied;
          }
        }
        else  if(!Object.keys(activeTile.tdata.fleet).length && Object.keys(activeTile.tdata.attacker).length){
          if(String(ctx.currentPlayer) === String(playerID)){
            activeTile.tdata.fleet = {...activeTile.tdata.attacker};
            delete activeTile.tdata.attacker;
            looser = activeTile.tdata.occupied;
            
            if(checkSecretObjective(G, playerID, 'Betray a Friend', activeTile.tdata.occupied)){ endLater = true; } //todo: some objs can be done at same time
            else if(checkSecretObjective(G, playerID, 'Brave the Void', activeTile.tid)){ endLater = true; }
            else if(checkSecretObjective(G, playerID, 'Darken the Skies', activeTile.tid)){ endLater = true; }
            else if(checkSecretObjective(G, playerID, 'Demonstrate Your Power', activeTile.tdata.fleet)){ endLater = true; }
            else if(checkSecretObjective(G, playerID, 'Spark a Rebellion', looser)) { endLater = true; }
            else if(checkSecretObjective(G, playerID, 'Unveil Flagship', activeTile.tdata.fleet)) { endLater = true; }

            activeTile.tdata.occupied = playerID;
          }
        }
        else if(String(activeTile.tdata.occupied) === String(playerID)){
          looser = ctx.currentPlayer;

          if(checkSecretObjective(G, playerID, 'Brave the Void', activeTile.tid)){ endLater = true; }
          else if(checkSecretObjective(G, playerID, 'Darken the Skies', activeTile.tid)){ endLater = true; }
          else if(checkSecretObjective(G, playerID, 'Demonstrate Your Power', activeTile.tdata.fleet)){ endLater = true; }
          else if(checkSecretObjective(G, playerID, 'Spark a Rebellion', looser)) { endLater = true; }
          else if(checkSecretObjective(G, playerID, 'Unveil Flagship', activeTile.tdata.fleet)) { endLater = true; }

          delete activeTile.tdata.attacker;
        }
        G.races[playerID].retreat = undefined;

        if(looser !== undefined && String(looser) !== String(playerID)){
          if(spliceCombatAC(G.races[playerID], 'Salvage')){
            /*G.races[playerID].commodity += G.races[looser].commodity;
            if(G.races[playerID].commodity > G.races[playerID].commCap) G.races[playerID].commodity = G.races[playerID].commCap;
            G.races[looser].commodity = 0;*/
            G.races[playerID].tg += G.races[looser].tg;
            G.races[looser].tg = 0;
          }
        }

        if(haveTechnology(G.races[playerID], 'SALVAGE_OPERATIONS')){
          G.races[playerID].tg++;
          plugins.effects.tg();
          if(looser !== undefined && String(looser) !== String(playerID)){
            G.races[playerID].makeCustomProducing = {units: [...G.races[looser].destroyedUnits, ...G.races[playerID].destroyedUnits], count: 1, onClose: 'endStage'};
            endLater = true;
          }
        }
        if(!endLater) { events.endStage(); }
      },
      producing,
      claimPromissoryCard: ({G, events, playerID}, looser) => {
        try{
          const looserRace = G.races[looser];
          if(looserRace && looserRace.promissory && looserRace.promissory.find(p => p.sold === undefined || String(p.sold) === String(looser))){
            looserRace.reparation = { to: playerID, type: 'promissory' }
            let val = {};
            val[looser] = {stage: 'reparations'};
            val[playerID] = {stage: 'spaceCombat_await'}

            events.setActivePlayers({value: val})
          }
        }
        catch(e){
          console.log(e)
        }
      }
    }
  },
  reparations: {
    moves: {

      transferPromissoryCard: ({ G, playerID, events }, cid) => {
        try{
          const src = G.races[playerID];
          const dst = G.races[src.reparation.to];
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

          delete src['reparation'];
          events.endStage();

        }
        catch(e){
          console.log(e)
        }
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
          Object.keys(ap).forEach(pid => ap[pid] = {stage: 'spaceCombat'});
          events.setActivePlayers({value: ap});
        }

        const activeTile = G.tiles.find(t => t.active === true);

        if(selectedTile > -1 && Object.keys(escFleet).length){
          /*const neighs = neighbors(G.HexGrid,[activeTile.q, activeTile.r]).toArray();
          const possible = neighs.filter(n => {
              const tile = G.tiles.find(t => t.tid === n.tileId);

              if(tile && tile.tdata){
                  if(tile.tdata.occupied !== undefined){
                      return String(tile.tdata.occupied) === String(playerID);
                  }
                  else if(haveTechnology(G.races[playerID], 'DARK_ENERGY_TAP')){
                    return true;
                  }
                  if(tile.tdata.planets){
                      for(var i=0; i<tile.tdata.planets.length; i++){
                          if(String(tile.tdata.planets[i].occupied) === String(playerID)) return true;
                      }
                  }
              }
              return false;
          });

          const hex = possible.find(t => t.tileId === G.tiles[selectedTile].tid);*/
          const hex = {tileId: G.tiles[selectedTile].tid};

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

            checkIonStorm(G, [activeTile, tile]);

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
      playActionCard: playCombatAC,
      actionCardCancel: ACTION_CARD_STAGE.moves.cancel,
      actionCardNext: ACTION_CARD_STAGE.moves.next,
      actionCardPass: ACTION_CARD_STAGE.moves.pass,
      actionCardDone: ACTION_CARD_STAGE.moves.done,
      actionCardSabotage: ACTION_CARD_STAGE.moves.sabotage,
      secretObjectiveConfirm,
      rollDice: ({G, playerID, random}, unit, count) => {
        const dice = random.D10(count || 1);
        G.dice = produce(G.dice, draft => {
          draft[playerID][unit] = {dice};
        });
      },
      nextStep: ({G, events, playerID, ctx}, hits) => {
        const activeTile = G.tiles.find(t => t.active === true);
        const activePlanet = activeTile.tdata.planets.find(p => p.invasion);

        if(String(playerID) === String(ctx.currentPlayer)){
          events.setStage('invasion_await');
        }
        else if(hits && Object.keys(hits).reduce((a,b) => a + hits[b], 0) === 0){ //defenser takes no hits

          if(ctx.activePlayers[ctx.currentPlayer] === 'invasion_await' && activePlanet.invasion.troops){
            if(haveTechnology(G.races[playerID], 'MAGEN_DEFENSE_GRID')){
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
          else{
            events.setStage('invasion_await');
          }
        }
        else{
          events.setStage('invasion_step2');
        }

        spliceCombatAC(G.races[playerID], 'Scramble Frequency');
      }
    }
  },
  invasion : {
    moves: {
      playActionCard: playCombatAC,
      actionCardCancel: ACTION_CARD_STAGE.moves.cancel,
      actionCardNext: ACTION_CARD_STAGE.moves.next,
      actionCardPass: ACTION_CARD_STAGE.moves.pass,
      actionCardDone: ACTION_CARD_STAGE.moves.done,
      actionCardSabotage: ACTION_CARD_STAGE.moves.sabotage,

      rollDice: ({G, playerID, random}, unit, count, withTech) => {
        const dice = random.D10(count || 1);
        G.dice = produce(G.dice, draft => {
          draft[playerID][unit] = {dice};
        });
        if(withTech.indexOf('AGENT')>-1){
          G.races[playerID].exhaustedCards.push('AGENT');
        }
      },
      rerollDice,
      nextStep: ({G, events, playerID, ctx}, hits, setNoPds) => {
        try{
          let fleet;
          const activeTile = G.tiles.find(t => t.active === true);
          const activePlanet = activeTile.tdata.planets.find(p => p.invasion);
          
          if(String(playerID) === String(ctx.currentPlayer)){
            fleet = activePlanet.invasion.troops;
          }
          else{
            fleet = activePlanet.units;
          }
          
          let technologies = getUnitsTechnologies(Object.keys(fleet), G.races[playerID]);
          let needFilterDeleted = false;

          Object.keys(G.dice[playerID]).forEach(u => { //remove units after unluck reroll with relic
            if(G.dice[playerID][u] && G.dice[playerID][u].reroll){
              Object.keys(G.dice[playerID][u].reroll).forEach(kstr => {
                
                const k = parseInt(kstr);

                if(G.dice[playerID][u].reroll[k] && G.dice[playerID][u].reroll[k] < 0){
                  let doCheck = true;
                  let uidx = k;

                  if(technologies[u] && technologies[u].shot > 1){//maybe mech
                    doCheck = false;

                    if(k % technologies[u].shot === 0){
                      if(G.dice[playerID][u].reroll[k-1] && G.dice[playerID][u].reroll[k-1] < 0){
                        uidx = k / 2;
                        doCheck = true;
                      }
                    }
                  }

                  if(doCheck){
                    if(fleet[u] && fleet[u][uidx]){
                      delete fleet[u][uidx];
                    }

                    needFilterDeleted = true;
                    G.races[playerID].destroyedUnits.push(u); //remember destroyed units
                  }
                }

              })
            }
          });
        
          if(needFilterDeleted){ //filter deleted units
            Object.keys(fleet).forEach(sheep => {
              fleet[sheep] = fleet[sheep].filter(s => s);
            });
          }

          if(spliceCombatAC(G.races[playerID], 'Emergency Repairs')){
            repairAllActiveTileUnits(G, playerID);
          }
          spliceCombatAC(G.races[playerID], 'Fire Team');

          if(!activePlanet.invasion.troops){
            events.setStage('invasion_await');
            return;
          }

          if(setNoPds && String(playerID) === String(activePlanet.occupied)) activePlanet.invasion.nopds = true;
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
        catch(e){console.log(e)}
      },
      useCommander: ({G, playerID}) => {
        useCommanderAbility(G, playerID)
      }
    }
  },
  invasion_step2 : {
    moves: {
      playActionCard: playCombatAC,
      actionCardCancel: ACTION_CARD_STAGE.moves.cancel,
      actionCardNext: ACTION_CARD_STAGE.moves.next,
      actionCardPass: ACTION_CARD_STAGE.moves.pass,
      actionCardDone: ACTION_CARD_STAGE.moves.done,
      actionCardSabotage: ACTION_CARD_STAGE.moves.sabotage,

      rollDice: ({G, playerID, random}, unit, count) => {
        const dice = random.D10(count || 1);
        G.dice = produce(G.dice, draft => {
          draft[playerID][unit] = {dice};
        });
      },
      nextStep: ({G, playerID, ctx, events, random, ...plugins}, hits, prevStages) => {
        let fleet = {};
        const activeTile = G.tiles.find(t => t.active === true);
        const activePlanet = activeTile.tdata.planets.find(p => p.invasion);
       
        const defenderForces = () => {
            const result = {};
            Object.keys(activePlanet.units).forEach(k => {
                if(['infantry', 'mech'].indexOf(k) > -1){
                    result[k] = activePlanet.units[k];
                }
            });
            return result;
        }

        let bacterialWeapon = false;

        if(playerID === ctx.currentPlayer){
          fleet = activePlanet.invasion.troops;
        }
        else{
          fleet = activePlanet.units;

          if(prevStages.length === 2 && prevStages[0] === 'bombardment'){
            if(enemyHaveTechnology(G.races, ctx.activePlayers, playerID, 'X89_BACTERIAL_WEAPON')){
              bacterialWeapon = true;
            }

          }
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

        const technologies = getUnitsTechnologies(['infantry'], G.races[playerID]);

        Object.keys(fleet).forEach(f => { //remove destroyed units
          fleet[f].forEach((car, i) => {
            if((car.hit === 1 && f !== 'mech') || car.hit > 1){
              G.races[playerID].destroyedUnits.push(f);
              delete fleet[f][i];
              if(f === 'mech' && haveTechnology(G.races[playerID], 'SELF_ASSEMBLY_ROUTINES')){
                G.races[playerID].tg += 1;
              }
              else if(f === 'infantry' && haveTechnology(G.races[playerID], 'INFANTRY2')){
                const d = random.D10(1);
                G.races[playerID].tempTechnoData.push({id: 'INFANTRY2', dice: d, success: d[0]>technologies['infantry'].resurectAbove});
              }
            }
          });
          fleet[f] = fleet[f].filter(car => car);
          if(fleet[f].length === 0) delete fleet[f];
        });

        if(G.races[playerID].destroyedUnits.includes('mech') &&  G.races[playerID].combatActionCards.includes('MECH')){
          if(!fleet['mech']){
            G.races[playerID].combatActionCards =  G.races[playerID].combatActionCards.filter(ac => ac !== 'MECH')
          }
        }

        if(bacterialWeapon && hits['infantry'] && hits['infantry'].length){
          delete fleet['infantry'];
        }
        
        const defs = defenderForces();
        if(!(activePlanet.invasion.troops && Object.keys(activePlanet.invasion.troops).length) ||
          !(defs && Object.keys(defs).length)){
          if(prevStages.length === 2 && prevStages[0] === 'bombardment'){
            if(playerID !== ctx.currentPlayer && Object.keys(ctx.activePlayers)){
              const enemyId = Object.keys(ctx.activePlayers).find(k => k!== playerID);
              if(enemyId !== undefined) checkSecretObjective(G, enemyId, 'Make an Example of Their World');
            }
          }
          events.setStage('invasion_await'); //end ground battle
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

        if(spliceCombatAC(G.races[playerID], 'Emergency Repairs')){
          repairAllActiveTileUnits(G, playerID);
        }
        spliceCombatAC(G.races[playerID], 'Morale Boost');
        spliceCombatAC(G.races[playerID], 'Scramble Frequency');

        plugins.effects.tg();
      } 
    }
  },
  invasion_await:{
    moves: {
      playActionCard: playCombatAC,
      actionCardCancel: ACTION_CARD_STAGE.moves.cancel,
      actionCardNext: ACTION_CARD_STAGE.moves.next,
      actionCardPass: ACTION_CARD_STAGE.moves.pass,
      actionCardDone: ACTION_CARD_STAGE.moves.done,
      actionCardSabotage: ACTION_CARD_STAGE.moves.sabotage,
      secretObjectiveConfirm,
      endBattle: ({G, events, playerID, ctx, ...plugins}) => {
        try{
          const activeTile = G.tiles.find(t => t.active === true);
          const activePlanet = activeTile.tdata.planets.find(p => p.invasion);
          let defendersDied = false;
          let endLater = false;

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

            defendersDied = !Object.keys(defenderForces()).length && activePlanet.invasion.troops && Object.keys(activePlanet.invasion.troops).length;

            if(defendersDied){
              if(ctx.currentPlayer === playerID){
                if(G.races[playerID].combatActionCards && G.races[playerID].combatActionCards.indexOf('Infiltrate')>-1){
                  if(activePlanet.units && activePlanet.units.pds && activePlanet.units.pds.length){
                    activePlanet.invasion.troops.pds = {...activePlanet.units.pds};
                  }
                  if(activePlanet.units && activePlanet.units.spacedock && activePlanet.units.spacedock.length){
                    activePlanet.invasion.troops.spacedock = {...activePlanet.units.spacedock};
                  }
                }

                activePlanet.units = {...activePlanet.invasion.troops};
                delete activePlanet.invasion;

                if(activePlanet.occupied !== undefined && String(activePlanet.occupied) !== String(playerID)){
                  checkTacticalActionCard({G, events, playerID: String(activePlanet.occupied), atype: 'PLANET_OCCUPIED'});
                  if(checkSecretObjective(G, playerID, 'Betray a Friend', activePlanet.occupied)){ endLater = true; }
                  else if(checkSecretObjective(G, playerID, 'Brave the Void', activeTile.tid)){ endLater = true; }
                  else if(checkSecretObjective(G, playerID, 'Darken the Skies', activeTile.tid)){ endLater = true; }
                  else if(checkSecretObjective(G, playerID, 'Spark a Rebellion', activePlanet.occupied)) { endLater = true; }

                  const looserRace = G.races[activePlanet.occupied];
                  if(looserRace && (activePlanet.legendary === true || String(activeTile.tid) === String(looserRace.rid))){
                    const relicIdx = looserRace.relics.findIndex(r => r.id === 'Shard of the Throne');
                    if(relicIdx > -1){
                      G.races[playerID].relics.push(...looserRace.relics.splice(relicIdx, 1));
                    }
                  }
                }

                occupyPlanet({G, playerID, planet: activePlanet, explore: false, plugins});

                if(haveTechnology(G.races[playerID], 'DACXIVE_ANIMATORS')){
                  if(!activePlanet.units['infantry']) activePlanet.units['infantry']=[];
                  activePlanet.units['infantry'].push({id: 'infantry'});
                }
              }
            }
            else if(String(activePlanet.occupied) === String(playerID)){
              delete activePlanet.invasion;
              if(haveTechnology(G.races[playerID], 'DACXIVE_ANIMATORS')){
                if(!activePlanet.units['infantry']) activePlanet.units['infantry']=[];
                activePlanet.units['infantry'].push({id: 'infantry'});
              }
              if(checkSecretObjective(G, playerID, 'Brave the Void', activeTile.tid)){ endLater = true; }
              else if(checkSecretObjective(G, playerID, 'Darken the Skies', activeTile.tid)){ endLater = true; }
              else if(checkSecretObjective(G, playerID, 'Spark a Rebellion', ctx.currentPlayer)) { endLater = true; }
            }
          }

          if(String(ctx.currentPlayer) !== String(playerID)){
            if(!activePlanet || (String(activePlanet.occupied) === String(ctx.currentPlayer) || defendersDied)){
              if(checkSecretObjective(G, playerID, 'Become a Martyr')){ endLater = true; }
            }
          }

          if(!endLater){events.endStage();}
        }
        catch(e){
          console.log(e)
        }
      },

      landTroops: ({G, ctx, events, playerID}, troops) => {
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

          //if defenser await and have units
          if(ctx.activePlayers[activePlanet.occupied] === 'invasion_await' && activePlanet.units && Object.keys(activePlanet.units).length){
            if(enemyHaveTechnology(G.races, ctx.activePlayers, playerID, 'MAGEN_DEFENSE_GRID') && 
              ((activePlanet.units.pds && activePlanet.units.pds.length) || 
              (activePlanet.units.spacedock && activePlanet.units.spacedock.length))){
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
          else{
            events.setStage('invasion_await');
          }


          if(G.races[playerID].rid === 2){ //mentak MECH
            if(activePlanet.invasion.troops && Object.keys(activePlanet.invasion.troops).includes('mech')){
              if(!G.races[playerID].combatActionCards.includes('MECH')) G.races[playerID].combatActionCards.push('MECH');
            }
          }
          else if(G.races[activePlanet.occupied].rid === 2){
            if(activePlanet.units && Object.keys(activePlanet.units).includes('mech')){
              if(!G.races[activePlanet.occupied].combatActionCards.includes('MECH')) G.races[activePlanet.occupied].combatActionCards.push('MECH');
            }
          }


        }
      },

      magenDefense: ({G, ctx, events}, hits) => {
        
        const activeTile = G.tiles.find(t => t.active === true);
        const activePlanet = activeTile.tdata.planets.find(p => p.invasion);
        if(!activePlanet.invasion.magenUsed) activePlanet.invasion.magenUsed = true;
        let fleet = activePlanet.invasion.troops;

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

        const defs = {};
        Object.keys(activePlanet.units).forEach(k => {
            if(['infantry', 'mech'].indexOf(k) > -1){
                defs[k] = activePlanet.units[k];
            }
        });
        
        if(!(activePlanet.invasion.troops && Object.keys(activePlanet.invasion.troops).length) ||
          !(defs && Object.keys(defs).length)){
          events.setStage('invasion_await'); //end ground battle
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
  },
}



export const STRAT_MOVES = {

  dropActionCard: dropACard,
  playActionCard: ({G, playerID, events}, card) => {
    if(card.when === 'STRATEGY'){
      G.races[playerID].currentActionCard = {...card, reaction: {}, playerID};
      events.setActivePlayers({ all: 'actionCard' });
    }
  },
  pickStrategy: ({G, playerID, events}, sid) => {
    try{
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

      //return G;
    }
    catch(e){
      console.log(e)
    }
  }

}

export const ACTS_MOVES = {
  
  secretObjectiveConfirm,
  useRelic,
  usePromissory,
  useAgenda,
  useLegendary: ({G, playerID, ctx, ...plugins}, args) => {
    try{
      const {planetId, choice, selectedTile, selectedPlanet} = args;

      if(planetId === 'Primor'){
        const count = choice === 0 ? 2:1;
        const units = getPlayerUnits(G.tiles, playerID);
        if(units['infantry'] + count <= UNITS_LIMIT['infantry']){
          const tile = G.tiles[selectedTile];
          if(tile && tile.tdata && tile.tdata.planets){
            const planet = tile.tdata.planets[selectedPlanet];
            if(planet && String(planet.occupied) === String(playerID)){
              if(!planet.units) planet.units = {};
              if(!planet.units.infantry) planet.units.infantry = [];
              planet.units.infantry.push(...Array(count).fill({}));
            }
          }
        }
      }
      else if(planetId === "Hope's End"){
        if(choice === 0){
          const units = getPlayerUnits(G.tiles, playerID);

          if(units['mech'] <= UNITS_LIMIT['mech']){
            const tile = G.tiles[selectedTile];
            if(tile && tile.tdata && tile.tdata.planets){
              const planet = tile.tdata.planets[selectedPlanet];
              if(planet && String(planet.occupied) === String(playerID)){
                if(!planet.units) planet.units = {};
                if(!planet.units.mech) planet.units.mech = [];
                planet.units.mech.push({});
              }
            }
          }
        }
        else{
          G.races[playerID].actionCards.push(G.actionsDeck.pop());
        }
      }
      else if(planetId === 'Mallice'){
        if(choice === 0){
          G.races[playerID].tg += 2;
        }
        else{
          G.races[playerID].tg += G.races[playerID].commodity;
          G.races[playerID].commodity = 0;
        }

        plugins.effects.tg();
      }
      else if(planetId === 'Mirage'){
        const count = choice === 0 ? 2:1;
        const units = getPlayerUnits(G.tiles, playerID);

        if(units['fighter'] + count <= UNITS_LIMIT['fighter']){
          const tile = G.tiles[selectedTile];

          if(tile && tile.tdata && String(tile.tdata.occupied) === String(playerID)){
            if(!tile.tdata.fleet.fighter) tile.tdata.fleet.fighter = [];
            tile.tdata.fleet.fighter.push(...Array(count).fill({}));
          }
        }
      }

      const legendary = getPlanetByName(G.tiles, planetId);
      legendary.exhausted = true;
    }
    catch(e){
      console.log(e)
    }
  }, 
  dropSecretObjective,
  endTurn: ({G, ctx, events}) => {
    if(!G.currentTacticalActionCard){
      if(ctx.activePlayers && Object.keys(ctx.activePlayers)) events.setActivePlayers({}); //to end tacticalActionCard stage
      events.endTurn();
    }
  },
  playActionCard: ({G, playerID, events}, card) => {
    if(card.when === 'ACTION'){
      
      if(G.races[playerID].actions.length > getMaxActs(G, playerID) - 1){
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
          //G.races[playerID].commodity = Math.min(G.races[playerID].commodity + 2, G.races[playerID].commCap);
          replenishCommodity(G, playerID, Math.min(G.races[playerID].commodity + 2, G.races[playerID].commCap), plugins);
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
          //G.races[playerID].commodity = Math.min(G.races[playerID].commodity + 1, G.races[playerID].commCap);
          replenishCommodity(G, playerID, Math.min(G.races[playerID].commodity + 1, G.races[playerID].commCap), plugins);
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
          //G.races[playerID].commodity = G.races[playerID].commCap;
          replenishCommodity(G, playerID, G.races[playerID].commCap, plugins);
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

    if(G.races[playerID].actions.length > getMaxActs(G, playerID) - 1){
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
  adjustToken,
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

    if(G.races[playerID].actions.length > getMaxActs(G, playerID) - 1){
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

    const val = {};
    G.races.forEach((r, i) => {
      if(!G.passedPlayers.includes(String(i))){
        val[i] = {stage: 'strategyCard'}
      }
    })

    events.setActivePlayers({ value: val, minMoves: 1 });
  },
  loadUnit: ({G, playerID}, {src, dst}) => {
    try{
      let from = G.tiles[src.tile].tdata.planets[src.planet].units[src.unit];

      if(dst){
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
      }
      else if(src.unit === 'fighter'){
        if(!G.tiles[src.tile].tdata.fleet){
          G.tiles[src.tile].tdata.occupied = playerID;
          G.tiles[src.tile].tdata.fleet = {};
        }
        if(!G.tiles[src.tile].tdata.fleet.fighter) G.tiles[src.tile].tdata.fleet.fighter = [];

        const unit = {...G.tiles[src.tile].tdata.planets[src.planet].units[src.unit].pop(), id: src.unit};
        if(G.tiles[src.tile].tdata.planets[src.planet].units[src.unit].length === 0) delete G.tiles[src.tile].tdata.planets[src.planet].units[src.unit];
        G.tiles[src.tile].tdata.fleet.fighter.push(unit);
      }
    }
    catch(e){console.log(e)}
  },
  unloadUnit: ({G, playerID, ...plugins}, {src, dst, payment}) => {
    try{

      let to = G.tiles[dst.tile].tdata.planets[dst.planet];
      if(to.attach && to.attach.length && to.attach.indexOf('Demilitarized Zone') > -1) return;

      const from = G.tiles[src.tile].tdata.fleet[src.unit];
    
      if(src.unit.toUpperCase() === 'FIGHTER' && to){
        if(to.occupied === playerID){
          if(!to.units) to.units = {};
          if(!to.units.fighter) to.units.fighter = [];
          to.units.fighter.push(G.tiles[src.tile].tdata.fleet[src.unit].pop());
          if(!G.tiles[src.tile].tdata.fleet[src.unit].length){
            delete G.tiles[src.tile].tdata.fleet[src.unit];
          }
        }
      }
      else if(from && to){
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
          occupyPlanet({G, playerID, planet: to, explore: to.trait, plugins});
        }
        else if(String(to.occupied) !== String(playerID) && G.races[to.occupied]){
          checkSecretObjective(G, to.occupied, 'Become a Martyr');
          
          const looserRace = G.races[to.occupied];
          if(looserRace && (to.legendary === true || String(G.tiles[dst.tile].tid) === String(looserRace.rid))){
            const relicIdx = looserRace.relics.findIndex(r => r.id === 'Shard of the Throne');
            if(relicIdx > -1){
              G.races[playerID].relics.push(...looserRace.relics.splice(relicIdx, 1));
            }
          }

          occupyPlanet({G, playerID, planet: to, explore: false, plugins});
        }
      }

    }
    catch(e){console.log(e)}
  },
  activateTile: ({ G, playerID, events, ...plugins }, tIndex) => {

    try{
      const race = G.races[playerID];
      if(race.tokens.t <= 0){
        console.log('not enough tokens');
        return INVALID_MOVE;
      }

      if(race.actions.length > getMaxActs(G, playerID) - 1){
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
        if(prevActive){
          prevActive.active = undefined;
          if(prevActive.tdata && prevActive.tdata.ceasefire) prevActive.tdata.ceasefire = undefined;
        }
      
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

      if(tile.tdata.frontier && String(tile.tdata.occupied) === String(playerID) && G.races[playerID].knownTechs.indexOf('DARK_ENERGY_TAP') > -1){
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

      const rids = tile.tdata.tokens.filter(t => t !== race.rid);

      if(rids && rids.length){
        const ceasefires = race.promissory.filter(p => p.id === 'CEASEFIRE' && rids.includes(p.sold));

        if(ceasefires && ceasefires.length){
          ceasefires.forEach(ceasefire => {
            const acceptor = returnPromissory(G, playerID, ceasefire, plugins);

            if(acceptor){
              const acceptorId = G.races.findIndex(r => r.rid === acceptor.rid);
              let doCeasefire = false;

              if(tile.tdata && String(tile.tdata.occupied) === String(acceptorId)){
                doCeasefire = true;
              }
              else if(tile.tdata){
                const planets = tile.tdata.planets;

                if(planets && planets.length){
                  if(planets.find(p => String(p.occupied) === String(acceptorId) && p.units && Object.keys(p.units).length)){
                    doCeasefire = true;
                  }
                }
              }

              if(doCeasefire){
                tile.tdata.ceasefire = true;
              }
            }
          })
        }

        const supports = race.promissory.filter(p =>  ['SUPPORT_FOR_THE_THRONE', 'ALLIANCE', 'PROMISE_OF_PROTECTION'].includes(p.id) && rids.includes(p.owner))

        if(supports && supports.length){
          
          supports.forEach(s => {
            let returnSupport = false;
            let ownerId = G.races.findIndex(r => r.rid === s.owner);

            if(tile.tdata && String(tile.tdata.occupied) === String(ownerId)){
              returnSupport = true;
            }
            else if(tile.tdata){
              const planets = tile.tdata.planets;

              if(planets && planets.length){
                if(planets.find(p => String(p.occupied) === String(ownerId) && p.units && Object.keys(p.units).length)){
                  returnSupport = true;
                }
              }
            }

            if(returnSupport){
              returnPromissoryToOwner(G, playerID, s, plugins); 
            }
          })

        }
      }

    }
    catch(e){console.log(e)}
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
        if(fullpath && fullpath.length){ //gravity-rift
          const rifts = fullpath.filter((p,i) =>  (i < fullpath.length - 1) && p.tdata && p.tdata.anomaly === 'gravity-rift');

          if(rifts && rifts.length){
            let dices = random.D10(rifts.length);//rifts.length);
            plugins.effects.rift({pid: playerID, unit: args.unit, dices: dices});
            
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

        if( String(dst.tdata.occupied) !== String(playerID) ){
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

      if(fullpath && fullpath.length){ //ion storm
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

      if(dst.tid === 82 && !dst.side){
        dst.side = 'A';
        dst.tdata.wormhole = 'all';
      }
    }
    catch(e){console.log(e)}

  },
  pass: ({ G, playerID, events, ctx, ...plugins }) => {
    plugins.effects.pass({pid: playerID})

    let endLater = false;

    if(!G.passedPlayers.includes(String(playerID))){
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

    if(!endLater){ events.endTurn() }
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
  useHeroAbility,

}

export const STATS_MOVES = {
  adjustToken,
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
} 

export const AGENDA_MOVES = {
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
                if(String(p.occupied) === String(playerID)){
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
}