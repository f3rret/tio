import { getPlanetByName } from './utils';

export const ACTION_CARD_STAGE = {
    moves: {
      cancel: ({G, ctx, playerID, events}) => {
        const card = G.races[ctx.currentPlayer].currentActionCard || G.currentTacticalActionCard;
        if(String(card.playerID) === String(playerID)){
          events.setActivePlayers({});
          if(card.when === 'ACTION') G.races[card.playerID].currentActionCard = undefined;
          else if(card.when === 'TACTICAL') G.currentTacticalActionCard = undefined;
        }
      },
      pass: ({G, playerID, ctx, events}) => {
        const card = G.races[ctx.currentPlayer].currentActionCard || G.currentTacticalActionCard;
        card.reaction[playerID] = 'pass';
      },
      next: ({G, ctx, playerID, random}, target) => {
        const card = G.races[ctx.currentPlayer].currentActionCard || G.currentTacticalActionCard;

        if(String(card.playerID) === String(playerID)){
          card.target = target;

          if(card.id === 'Plague'){
            const planet = G.tiles[card.target.tidx].tdata.planets[card.target.pidx];
            const count = planet.units && planet.units.infantry ? planet.units.infantry.length : 0;
            const dice = random.D10( count );
            card.dice = dice;
          }

        }
      },
      done: ({G, ctx, events, playerID, random}) => {
        const card = G.races[ctx.currentPlayer].currentActionCard || G.currentTacticalActionCard;

        if(String(card.playerID) === String(playerID)){
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
            else if(card.id === 'Plagiarize'){
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

          G.races[card.playerID].actionCards.splice(G.races[card.playerID].actionCards.findIndex(a => a.id === card.id), 1);
          if(card.when === 'ACTION'){
            G.races[card.playerID].actions.push('ACTION_CARD');
            G.races[card.playerID].currentActionCard = undefined;
          }
          else if(card.when === 'TACTICAL'){
            G.currentTacticalActionCard = undefined;
          }                      
          events.setActivePlayers({});
        }
      }
    }
  }