import { produce } from 'immer';
import { INVALID_MOVE } from 'boardgame.io/core';
import { getUnitsTechnologies, haveTechnology, computeVoteResolution, enemyHaveTechnology, getPlanetByName, 
  completeObjective, loadUnitsOnRetreat, checkTacticalActionCard, playCombatAC, repairAllActiveTileUnits, 
  spliceCombatAC, checkIonStorm } from './utils';

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
      done: ({G, ctx, events, playerID, random}) => {
        let card = G.races[ctx.currentPlayer].currentActionCard || G.currentTacticalActionCard;
        if(ctx.phase === 'agenda') card = G.currentAgendaActionCard;
        if(!card) card = G.currentCombatActionCard;

        let sabotage;
        if(String(card.playerID) === String(playerID)){
          
          if(card.reaction && Object.keys(card.reaction).length){
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
                  G.races[ctx.currentPlayer].knownTechs.push(card.target.tech.id);
                  
                  if(card.target.exhausted){
                    Object.keys(card.target.exhausted).forEach(pname => {
                      const planet = getPlanetByName(G.tiles, pname);
                      if(planet) planet.exhausted = true;
                    });
                  }
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
                else if(card.id === 'Enigmatic Device'){ //from frontier

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
                    G.races[playerID].commodity = G.races[playerID].commCap;
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
                      G.passedPlayers.push(card.target.playerID);
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
                      G.passedPlayers.push(playerID);
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
                  G.races[playerID].tokens.new += 2;
                }
              }
            }
          }

          G.races[card.playerID].actionCards.splice(G.races[card.playerID].actionCards.findIndex(a => a.id === card.id), 1);
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
      },
      sabotage: ({G, ctx, playerID}) => {
        let card = G.races[ctx.currentPlayer].currentActionCard || G.currentTacticalActionCard;
        if(ctx.phase === 'agenda') card = G.currentAgendaActionCard;
        if(!card) card = G.currentCombatActionCard;

        const idx = G.races[playerID].actionCards.findIndex(c => c.id === 'Sabotage');
        if(idx > -1){
          card.reaction[playerID] = 'sabotage';
          G.races[playerID].actionCards.splice(idx, 1);
        }
      }
    }
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
      joinStrategy: ({ G, ctx, playerID, events }, {exhausted, tg, result, exhaustedCards}) => {
        const exhaustPlanet = (revert) => {
          if(exhausted && exhausted.length){
            G.tiles.forEach(tile => {
              const planets = tile.tdata.planets;

              if(planets && planets.length){
                planets.forEach( p => {
                  if(String(p.occupied) === String(playerID)){
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

                if(exhaustedCards && exhaustedCards.indexOf('AI_DEVELOPMENT_ALGORITHM') > -1){
                  G.races[playerID].exhaustedCards.push('AI_DEVELOPMENT_ALGORITHM');
                }

                if(tg){
                  G.races[playerID].tg -= tg;
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

              if(exhaustedCards && exhaustedCards.indexOf('AI_DEVELOPMENT_ALGORITHM') > -1){
                G.races[playerID].exhaustedCards.push('AI_DEVELOPMENT_ALGORITHM');
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
          G.races[playerID].tokens.s--;
        }
        
        if(Object.keys(ctx.activePlayers).length === 1){
          G.actionsDeck = G.actionsDeck.filter(a => a.issued !== true);
          G.secretObjDeck = G.secretObjDeck.filter(a => a.issued !== true);
        }

        events.endStage();
      },
      passStrategy: ({ G, ctx, events }) => {
        if(Object.keys(ctx.activePlayers).length === 1){
          G.actionsDeck = G.actionsDeck.filter(a => a.issued !== true);
          G.secretObjDeck = G.secretObjDeck.filter(a => a.issued !== true);
        }
        events.endStage();
      },
      exhaustForTg: ({G, playerID}, pname) => {
        if(pname){
          const planet = getPlanetByName(G.tiles, pname);
          if(!planet.exhausted){
            planet.exhausted = true;
            G.races[playerID].tg += 1;
          }
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

    nextStep: ({G, playerID, ctx, events}, hits) => {
      let fleet;
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
                if(p.hit){
                  if(p.hit > 1 || !technologies[p.id].sustain){
                    delete fleet[f][i].payload[j];
                    if(p.id === 'mech' && haveTechnology(G.races[playerID], 'SELF_ASSEMBLY_ROUTINES')){
                      G.races[playerID].tg += 1;
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
          }
          else{
            delete activeTile.tdata.fleet;
            delete activeTile.tdata.occupied;
          }
        }

        delete G['spaceCannons'];
      }
     
      events.endStage();
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

      rollDice: ({G, playerID, random}, unit, count) => {
        const dice = random.D10(count || 1);
        G.dice = produce(G.dice, draft => {
          draft[playerID][unit] = {dice};
        });
      },
      nextStep: ({G, events, ctx, playerID}) => {
        spliceCombatAC(G.races[playerID], 'Scramble Frequency');

        let hits = {};
        Object.keys(ctx.activePlayers).forEach(pid => {
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
      nextStep: ({G, playerID, events, ctx}, hits) => {
       
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

     chooseAndDestroy: chooseAndDestroyMove,
     nextStep: ({G, playerID, ctx, events}, hits, assaultCannon) => {
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

      Object.keys(fleet).forEach(f => { //remove destroyed units
        fleet[f].forEach((car, i) => {
          if(car.hit > 1 || (car.hit === 1 && !technologies[f].sustain)){
            G.races[playerID].destroyedUnits.push(f); //remember destroyed units
            delete fleet[f][i];
          }
          else if(car.payload && car.payload.length){
            car.payload.forEach((p, idx) => {
              if(p.hit > 1 || (p.hit === 1 && !technologies[p.id].sustain)){
                G.races[playerID].destroyedUnits.push(p.id);
                delete fleet[f][i].payload[idx];
                if(p.id === 'mech' && haveTechnology(G.races[playerID], 'SELF_ASSEMBLY_ROUTINES')){
                  G.races[playerID].tg += 1;
                }
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
          else if(assaultCannon){
            const val = {};
            val[activeTile.tdata.occupied] = {stage: 'antiFighterBarrage'};
            val[ctx.currentPlayer] = {stage: 'antiFighterBarrage'};
            
            G.dice[activeTile.tdata.occupied] = {};
            G.dice[ctx.currentPlayer] = {};
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

      chooseAndDestroy: chooseAndDestroyMove,
      endBattle: ({G, events, playerID, ctx}) => {
        const activeTile = G.tiles.find(t => t.active === true);
        let looser;

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
            activeTile.tdata.occupied = playerID;
          }
        }
        else if(String(activeTile.tdata.occupied) === String(playerID)){
          looser = ctx.currentPlayer;
          delete activeTile.tdata.attacker;
        }
        G.races[playerID].retreat = undefined;

        if(looser !== undefined && String(looser) !== String(playerID)){
          if(spliceCombatAC(G.races[playerID], 'Salvage')){
            G.races[playerID].commodity += G.races[looser].commodity;
            if(G.races[playerID].commodity > G.races[playerID].commCap) G.races[playerID].commodity = G.races[playerID].commCap;
            G.races[looser].commodity = 0;
          }
        }

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
          Object.keys(ap).forEach(pid => ap[pid] = {stage: 'spaceCombat'});
          events.setActivePlayers({value: ap});
        }

        const activeTile = G.tiles.find(t => t.active === true);

        if(selectedTile > -1 && Object.keys(escFleet).length){
          /*const neighs = neighbors([activeTile.q, activeTile.r]).toArray();
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

      rollDice: ({G, playerID, random}, unit, count) => {
        const dice = random.D10(count || 1);
        G.dice = produce(G.dice, draft => {
          draft[playerID][unit] = {dice};
        });
      },
      nextStep: ({G, events, playerID, ctx}, hits) => {
        if(String(playerID) === String(ctx.currentPlayer)){
          events.setStage('invasion_await');
        }
        else if(hits && Object.keys(hits).reduce((a,b) => a + hits[b], 0) === 0){ //defenser takes no hits
          const activeTile = G.tiles.find(t => t.active === true);
          const activePlanet = activeTile.tdata.planets.find(p => p.invasion);

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

      rollDice: ({G, playerID, random}, unit, count) => {
        const dice = random.D10(count || 1);
        G.dice = produce(G.dice, draft => {
          draft[playerID][unit] = {dice};
        });
      },
      rerollDice: ({G, playerID, random}, unit, didx) => {
        const dice = random.D10(1);
        if(!G.dice[playerID][unit].reroll) G.dice[playerID][unit].reroll = {};
        G.dice[playerID][unit].reroll[didx] = dice[0];
      },
      nextStep: ({G, events, playerID, ctx}, hits, setNoPds) => {

        if(spliceCombatAC(G.races[playerID], 'Emergency Repairs')){
          repairAllActiveTileUnits(G, playerID);
        }
        spliceCombatAC(G.races[playerID], 'Fire Team');

        const activeTile = G.tiles.find(t => t.active === true);
        const activePlanet = activeTile.tdata.planets.find(p => p.invasion);

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
      nextStep: ({G, playerID, ctx, events}, hits, prevStages) => {
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

        Object.keys(fleet).forEach(f => { //remove destroyed units
          fleet[f].forEach((car, i) => {
            if((car.hit === 1 && f !== 'mech') || car.hit > 1){
              G.races[playerID].destroyedUnits.push(f);
              delete fleet[f][i];
              if(f === 'mech' && haveTechnology(G.races[playerID], 'SELF_ASSEMBLY_ROUTINES')){
                G.races[playerID].tg += 1;
              }
            }
          });
          fleet[f] = fleet[f].filter(car => car);
          if(fleet[f].length === 0) delete fleet[f];
        });

        if(bacterialWeapon && hits['infantry'] && hits['infantry'].length){
          delete fleet['infantry'];
        }
        
        const defs = defenderForces();
        if(!(activePlanet.invasion.troops && Object.keys(activePlanet.invasion.troops).length) ||
          !(defs && Object.keys(defs).length)){
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

          if(!Object.keys(defenderForces()).length && activePlanet.invasion.troops && Object.keys(activePlanet.invasion.troops).length){
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
              }
              activePlanet.occupied = playerID;
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
          }
        }

        events.endStage();
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