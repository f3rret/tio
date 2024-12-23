/* eslint eqeqeq: 0 */
import tileData from './tileData.json';
import techData from './techData.json';
import raceData from './raceData.json';
import cardData from './cardData.json';

import { neighbors } from './Grid';
import { Stage } from 'boardgame.io/core';
import { createContext } from 'react';
import { produce } from 'immer';
import { trueColors } from './colors';

const getTrueColors = (simpleColors) => {
  return simpleColors.map(c => trueColors[c])
}

export const getInitRaces = (hexGrid, numPlayers, simpleColors, players) => {
  const all_units = JSON.parse(JSON.stringify(techData.filter((t) => t.type === 'unit')));
  let races = hexGrid.map( h => ({ rid: h.tileId }))
    .filter( i => tileData.green.indexOf(i.rid) > -1 );

  const colors = getTrueColors(simpleColors);
  //races = races.slice(0, numPlayers);

  races = races.filter( (r, idx) => {
    return players.find(p => p.id === idx);
  })
  
  races = races.map( (r, idx) => {
    const rd = JSON.parse(JSON.stringify(raceData[r.rid]));
    const player = players.find((p, pidx) => pidx === idx);

    return {rid: r.rid, ...rd, isBot: player && player.data && player.data.bot, pid: idx, color: colors[idx], destroyedUnits: [], commodity: 0, strategy:[], actionCards:[], secretObjectives:[], exhaustedCards: [], reinforcement: {},
    exploration:[], vp: 0, tg: 0, tokens: { t: 3, f: 3, s: 2, new: 0}, fragments: {u: 0, c: 0, h: 0, i: 0}, relics: [], tempTechnoData: [], trade: {}}
  });

  races.forEach( (r, idx) => {

    all_units.forEach( t => {
      const tch = r.technologies.find( f => f.id === t.id);
      if(!tch){
        r.technologies.push(t);
      }
      else{
        //tch.racial = true;
      }
    });
    //r.promissory.forEach(r => r.racial = true);
    const cd = JSON.parse(JSON.stringify(cardData.promissory));
    r.promissory = r.promissory.map(p => cd.find(c => c.id === p));
    r.promissory.push(...cd.filter(c => !c.racial));
    r.promissory.forEach(p => p.color = colors[idx][2]);

    //r.actionCards.push(cardData.actions.find(a => a.id === 'Enigmatic Device')); //test only
  });

  return races;
}


export const getInitTiles = (hexGrid, races) => {
  let tiles = hexGrid.filter(h => h.tileId && h.tileId !== -1).map( h => ({ tid: h.tileId, 
                                    tdata: {...tileData.all[h.tileId], tokens: []}, 
                                    q: h.q, r: h.r, w: h.width, corners: h.corners}) );

  tiles.forEach( (t, i) => {
    if( t.tdata.type === 'green' ){
      tiles[i].tdata = produce(tiles[i].tdata, draft => {
        const idx = races.findIndex(r => r.rid === t.tid); //todo: make possible to play two or more identical races
        if(idx > -1){
          draft.occupied = String(idx);

          for( let j=0; j < draft.planets.length; j++ ){
            draft.planets[j].occupied = String(idx);
          }
          if(races[idx].startingUnits){
            draft.fleet = races[idx].startingUnits.fleet;
            
            //if(draft.planets.length < 2){
              if(draft.planets && draft.planets.length){
                draft.planets[0].units = {...races[idx].startingUnits.ground};
              }
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

  return tiles;
}

export const UNITS_LIMIT = {
  spacedock: 3,
  pds: 6,
  destroyer: 8,
  cruiser: 8,
  warsun: 2,
  infantry: 99,
  fighter: 99,
  carrier: 4,
  dreadnought: 5,
  flagship: 1,
  mech: 4
};

export const StateContext = createContext(null);
export const LocalizationContext = createContext(null);

export const getPlayerUnits = (tiles, playerID)=> {
    const units = [];
  
    tiles.forEach( t => {
      if(t.tdata.occupied == playerID){
        if(t.tdata.fleet){
          Object.keys(t.tdata.fleet).forEach( k => {
            if(!units[k]) units[k] = 0;
            units[k] += t.tdata.fleet[k].length; //todo: also count payloaded units
          });
        }
      }
  
      if(t.tdata.planets && t.tdata.planets.length){
        t.tdata.planets.forEach(p => {
          if(p.occupied == playerID){
            if(p.units){
              Object.keys(p.units).forEach( k => {
                if(!units[k]) units[k] = 0;
                units[k] += p.units[k].length;
              });
            }
          }
        })
      }
    });
    
    return units;
};
  
export const getPlayerPlanets = (tiles, playerID)=> {
    const arr = [];
  
    tiles.forEach( t => {
      if(t.tdata.planets && t.tdata.planets.length){
  
          t.tdata.planets.forEach(p => {
            if(p.occupied == playerID){
              arr.push({...p, 'systemType': t.tdata.type, 'tid': t.tid});
            }
          })
        
      }
    });
  
    return arr;
};
  
export const checkSpend = (G, req, playerID) => {
  
    const rkeys = Object.keys(req);
    const planets = getPlayerPlanets(G.tiles, playerID);
    const race = G.races[playerID];
    //todo: tgMultiplier
  
    let influence = 0;
    let resource = 0;
    
    planets.forEach( p => {
      influence += p.influence;
      resource += p.resources;
    });
  
    for(var i=0; i < rkeys.length; i++){
      switch(rkeys[i]){
        case 'tg':
          if(race.tg < req[rkeys[i]]) return;
          break;
        case 'influence':
          if(influence + race.tg < req[rkeys[i]]) return;
          break;
        case 'resource':
          if(resource + race.tg < req[rkeys[i]]) return;
          break;
        case 'token':
          if(race.tokens.t + race.tokens.s < req[rkeys[i]]) return;
          break;
        default:
          break;
      }
    }
  
    return true;
};

export const checkObjective = (G, playerID, oid) => {

    let objective = G.pubObjectives.find(o => o.id === oid);
    if(!objective) objective = G.races[playerID].secretObjectives.find(o => o.id === oid);
    if(!objective) return;

    const req = objective.req;
    if(!req) return;

    const race = G.races[playerID];
    const planets = getPlayerPlanets(G.tiles, playerID);
    const units = getPlayerUnits(G.tiles, playerID);

    if(req.unit && Array.isArray(req.unit)){
        if(req.squadron){
          let systems = G.tiles.filter( s => s.tdata.occupied == playerID && s.tdata.fleet && Object.keys(s.tdata.fleet).length > 0 );

          const goal = systems.some( s => {
              let sum = 0;
              Object.keys(s.tdata.fleet).forEach( k => {
              if(req.unit.indexOf(k) > -1) sum += s.tdata.fleet[k].length;
              });
              return sum >= req.squadron;
          });

          if(goal == 0){
              return;
          }
        }
        else{
          let sum = 0;
          req.unit.forEach(u => { if(units[u]) { sum += units[u] } });
          if(sum < req.count) return;
        }
    }
    else if(req.trait){
      const traits = {'industrial': 0, 'cultural': 0, 'hazardous': 0};

      planets.forEach(p => {
        if(p.trait && traits[p.trait] !== undefined){
            traits[p.trait]++;
        }
      });

      if(isNumeric(req.trait)){
        if(traits['industrial'] < req.trait && traits['cultural'] < req.trait && traits['hazardous'] < req.trait){
          return;
        }
      }
      else if(req.count){
        if(!traits[req.trait] || traits[req.trait] < req.count){
          return;
        }
      }
    }
    else if(req.upgrade){
        const upgrades = race.knownTechs.filter(t => {
        const tech = techData.find(td => td.id === t);
        return tech && tech.type === 'unit' && tech.upgrade === true
        });
        if(upgrades.length < req.upgrade){
        return;
        }
    }
    else if(req.attachment){
        let sum = 0;
        planets.forEach(p => {
          if(p.attach && p.attach.length) sum++;
        });

        if(sum < req.attachment){
        return;
        }
    }
    else if(req.technology){
      if(req.technology.color){
        const colors = {'biotic': 0, 'warfare': 0, 'cybernetic': 0, 'propulsion': 0};
        race.knownTechs.forEach(t => {
          let tech = techData.find(td => td.id === t);
          if(!tech){//probably racial
            tech = race.technologies.find(td => td.id === t);
          } 
          if(tech && tech.type !== 'unit' && colors[tech.type] !== undefined){ colors[tech.type]++; }
        });

        let goals = 0;
        Object.keys(colors).forEach(c => {
          if(colors[c] >= parseInt(req.technology.count)) goals++;
        });

        if(goals < parseInt(req.technology.color)){
          return;
        }
      }
      if(req.technology.faction){
        let goals = 0;
        race.knownTechs.forEach(t => {
          const tech = race.technologies.find(td => td.id === t && (td.type !== 'unit' || td.upgrade === true));
          if(tech) goals++;
        });
        if(goals < parseInt(req.technology.count)){
          return;
        }
      }
    }
    else if(req.planet){
        let result = planets;
        if(req.nhs){
          result = result.filter( p => p.tid != race.rid );
        }
        if(req.ohs){
          result = result.filter( p => tileData.green.indexOf(p.tid) > -1 );
        }
        if(req.ground){
          result = result.filter( p => p.units && Object.keys(p.units).some( key => req.ground.indexOf(key) > -1));
        }
        if(req.withoutUnit){
          result = result.filter( p => !p.units || !Object.keys(p.units).find( key => req.withoutUnit.indexOf(key) > -1));
        }
        if(req.squadron){
          const goal = result.some( s => {
              let sum = 0;

              if(s.units){
                Object.keys(s.units).forEach( k => {
                  if(req.ground.indexOf(k) > -1) sum += s.units[k].length;
                });
              }

              return sum >= req.squadron;
          });

          if(goal == 0){
              return;
          }
        }
        if(req.ohsOrAdjacentDifferent){
          result = result.map ( p => {
            const hs = tileData.green.indexOf(p.tid);
            if( hs > -1 && p.tid != race.rid) return hs;

            const tile = G.tiles.find(t => t.tid === p.tid);

            if(tile){
              const neigh = neighbors(G.HexGrid, [tile.q, tile.r]).map(n => n.tileId);
              const ns = neigh.find(n => tileData.green.indexOf(n) > -1 && n != race.rid);
              if(ns) return tileData.green.indexOf(ns);
            }
            return undefined;
          });
          result = result.filter((value, index, array) => value !== undefined && array.indexOf(value) === index);
        }
        if(req.legendary){
          result = result.filter( p => p.legendary);
        }
        if(result.length < req.planet){
          return;
        }
    }
    else if(req.system){

        let systems = G.tiles.filter( t => t.tdata.occupied === playerID || (t.tdata.planets && t.tdata.planets.some( p => p.occupied === playerID)) );

        if(req.fleet && req.ground){ 
          systems = systems.filter( s => 
              (s.tdata.fleet && Object.keys(s.tdata.fleet).length > 0) || 
              (s.tdata.planets && s.tdata.planets.length && s.tdata.planets.some( p => p.occupied === playerID && p.units && p.units.length ))
          );
        }
        else if(req.fleet){
          systems = systems.filter( s => s.tdata.fleet && Object.keys(s.tdata.fleet).length > 0 );
          if(Array.isArray(req.fleet) && req.fleet.length){
            systems = systems.filter( s => Object.keys(s.tdata.fleet).some(k => req.fleet.indexOf(k) > -1) );
          }
        }

        if(req.noPlanet){
          systems = systems.filter( s => s.tdata.planets.length == 0);
        }
        if(req.adjacentMR){
          systems = systems.filter( s => (s.q >= -1 && s.q <= 1) && (s.r >=-1 && s.q <= -1) && !(s.r == 0 && s.q == 0));
        }
        if(req.nhs){
          systems = systems.filter( s => s.tid != race.rid );
        }
        if(req.MR){
          if(req.legendary && req.anomaly){
            systems = systems.filter( s => s.tid == 18 || [65, 66, 82].indexOf(s.tid) > -1 || tileData.anomaly.indexOf(s.tid) > -1);
          }
          else if(req.ohs){
            systems = systems.filter( s => s.tid == 18 || tileData.green.indexOf(s.tid) > -1);
          }
          else {
            systems = systems.filter( s => s.tid == 18 && s.tdata.planets[0].occupied === playerID );
          }
        }
        if(req.edge){
          systems = systems.filter( s => neighbors(G.HexGrid, [s.q, s.r]).length < 6);
        }
        if(req.wormholes && Array.isArray(req.wormholes)){
          systems = systems.filter( s => s.tdata.wormhole && req.wormholes.indexOf(s.tdata.wormhole) > -1);
          if(req.wormholes.find(w => !systems.find(s => s.tdata.wormhole === w))){ //we need each wh to be under control
            return false;
          }
        }
        if(req.enemyGround && Array.isArray(req.enemyGround)){
          systems = systems.filter( s => {
            if(s.tdata && s.tdata.planets && s.tdata.planets.length){
              return s.tdata.planets.find( p => 
                p.occupied !== undefined && p.occupied !== playerID && p.units && Object.keys(p.units) && 
                Object.keys(p.units).some(key => req.enemyGround.includes(key) && p.units[key].length)
              );
            }
            return false;
          });
        }
        if(req.myPlanet && req.enemyPlanet){
          systems = systems.filter( s => {
            if(s.tdata.planets && s.tdata.planets.length > 1){
              return s.tdata.planets.find( p => p.occupied === playerID) &&
              s.tdata.planets.find( p => p.occupied !== undefined && p.occupied !== playerID)
            }
            return false;
          });
        }
        if(req.nexus){
          systems = systems.filter( s => s.tid === 82);
        }
        if(req.adjacentAnomaly){
          systems = systems.filter( s => {
            const neigh = neighbors(G.HexGrid, [s.q, s.r]).map(n => n.tileId);
            return neigh.find(n => tileData.anomaly.indexOf(n) > -1);
          });
        }
        if(req.squadron){
          let systems = G.tiles.filter( s => s.tdata.occupied == playerID && s.tdata.fleet && Object.keys(s.tdata.fleet).length > 0 );

          const goal = systems.some( s => {
              let sum = 0;
              Object.keys(s.tdata.fleet).forEach( k => {
                sum += s.tdata.fleet[k].length;
              });
              return sum >= req.squadron;
          });

          if(goal == 0){
              return;
          }
        }
        if(req.combinedUnitsProduction){
          const technologies = getUnitsTechnologies(['spacedock', 'mech', 'infantry', 'pds'], race);

          systems = systems.filter(s => {
            let sum = 0;
            if(s.tdata.fleet){
              Object.keys(s.tdata.fleet).forEach(k => {
                if(technologies[k] && technologies[k].production){
                  sum += s.tdata.fleet[k].length * technologies[k].production;
                }
              });
            }

            if(s.tdata.planets){
              s.tdata.planets.forEach(p => {
                if(p.units){
                  Object.keys(p.units).forEach(k => {
                    if(technologies[k] && technologies[k].production){
                      sum += p.units[k].length * technologies[k].production;
                    }
                  });
                }
              });
            }

            return sum >= req.combinedUnitsProduction;

          });
        }
        if(req.adjacentOhs){
          systems = systems.filter( s => {
            const neigh = neighbors(G.HexGrid, [s.q, s.r]).map(n => n.tileId);
            return neigh.find(n => n != race.rid && tileData.green.indexOf(n) > -1);
          });
        }

        if(systems.length < req.system){
          return;
        }
    }
    else if(req.specialty){
        let sum = 0;
        planets.forEach(p => {
          if(p.specialty && (!req.type || p.specialty === req.type)) sum++;
        });

        if(sum < req.specialty){
          return;
        }
    }
    else if(req.neighbor){
        //let systems = G.tiles.filter( t => t.tdata.occupied === playerID || (t.tdata.planets && t.tdata.planets.some( p => p.occupied === playerID)) );
        let neigh = getMyNeighbors(G, playerID);//[];

        /*systems.forEach( s => neighbors([s.q, s.r]).forEach( n => {
          const tile = G.tiles.find(t => t.tid === n.tileId);
            if(tile){
              if(tile.tdata.occupied !== undefined && tile.tdata.occupied !== playerID){
                  if(neigh.indexOf(tile.tdata.occupied) === -1) neigh.push(tile.tdata.occupied);
              }
              else if(tile.tdata.planets){
                tile.tdata.planets.forEach( p => { if(p.occupied !== undefined && p.occupied !== playerID){ 
                  if(neigh.indexOf(tile.tdata.occupied) === -1) neigh.push(p.occupied) 
                  } })
              }
            }
          })
        );*/

        if(neigh.length < req.neighbor){
          return;
        }

        let goals = 0;

        if(req.more === 'planet'){
          neigh.forEach( n => {
            const pl = getPlayerPlanets(G.tiles, n);
            if(pl.length < planets.length) goals++;
        });
        }

        if(goals < req.neighbor){
        return;
        }
    }
    else if(req.influence){
      let sum = 0 ;
      planets.forEach(p => sum += p.influence);

      if(sum < req.influence) return false;
    }
    else if(req.resources){
      let sum = 0 ;
      planets.forEach(p => sum += p.resources);

      if(sum < req.resources) return false;
    }
    else if(req.promissory){

      return race.promissory && race.promissory.find(p => p.owner !== undefined && String(p.owner) !== String(playerID));

    }

    return true;
};

export const checkSecretObjective = (G, playerID, oid, param) => {

  const objective = G.races[playerID].secretObjectives.find(o => o.id === oid);
  if(!objective) return;
  if(objective.players && objective.players.length) return;

  const makeDialog = () => {
    G.races[playerID].secretObjectiveConfirm = {oid, type: 'secret objective', text: 'SECRET OBJECTIVE: ' + oid + '. ' + objective.title, 
    options: [{label: 'do_it_immediately'}, {label : 'next_time'}]};
  }

  if(['Become a Martyr', 'Destroy Their Greatest Ship', 'Make an Example of Their World', 
  'Prove Endurance', 'Turn Their Fleets to Dust', 'Dictate Policy', 'Drive the Debate'].includes(oid)){
    makeDialog();
    return true;
  }
  else if(oid === 'Betray a Friend'){
    const prs = G.races[playerID].promissory;
    if(prs && prs.length && !isNaN(parseInt(param))){
      const enemy = G.races[parseInt(param)];

      if(enemy && prs.find(p => String(p.owner) === String(enemy.rid))){
        makeDialog();
        return true;
      }
    }
  }
  else if(oid === 'Brave the Void'){
    if(!isNaN(param) && tileData.anomaly.includes(param)){
      makeDialog();
      return true;
    }
  }
  else if(oid === 'Darken the Skies'){
    if(!isNaN(param) && tileData.green.includes(param) && param !== G.races[playerID].rid){
      makeDialog();
      return true;
    }
  }
  else if(oid === 'Demonstrate Your Power'){
    if(param && Object.keys(param) && Object.keys(param).length){
      let ships = 0;
      Object.keys(param).forEach(key => {
        if(key !== 'fighter'){
          if(param[key] && Array.isArray(param[key]) && param[key].length){
            ships += param[key].length;
          }
        }
      });

      if(ships > 2){
        makeDialog();
        return true;
      }
    }
  }
  else if(oid === 'Fight with Precision'){
    if(param && Object.keys(param)){
      if(Object.keys(param).find(key => {
        if(key === 'fighter' && Array.isArray(param[key]) && param[key].length) return true;
        return param[key].find(car => car.payload && car.payload.find(p => p.id === 'fighter')); 
      })){ return false; }
    }
    makeDialog();
    return true;
  }
  else if(oid === 'Spark a Rebellion'){
    if(param && !isNaN(param) && G.races[param]){
      const enemyVP = getRaceVP(G, parseInt(param));
      if(!G.races.find((r,i) => getRaceVP(G,i) > enemyVP)){
        makeDialog();
        return true;
      }
    }
  }
  else if(oid === 'Unveil Flagship'){
    if(param && param['flagship'] && param['flagship'].length){
      makeDialog();
      return true;
    }
  }

  return false;
}

export const checkCommanderUnlock = (G, playerID) => {

  const race = G.races[playerID];
  if(race.commanderIsUnlocked) return;

  if(race){
    
    if(race.rid === 1){
      const planets = getPlayerPlanets(G.tiles, playerID);
      let res = 0;
      planets.forEach(p => {
        if(p && p.resources) {res += p.resources}
      });
      if(res >= 12){
        race.commanderIsUnlocked = true;
      }
    }
    else if(race.rid === 2){
      let crcount = 0;

      G.tiles.forEach( t => {
        if(String(t.tdata.occupied) === String(playerID)){
          if(t.tdata.fleet){ //todo: or invasion fleet
            if(t.tdata.fleet['cruiser'] && t.tdata.fleet['cruiser'].length){
              crcount += t.tdata.fleet['cruiser'].length;
              if(crcount > 3){
                race.commanderIsUnlocked = true;
                return;
              }
            }
          }
        }
      })
    }

  }

}

export const useCommanderAbility = (G, playerID) => {

  const race = G.races[playerID];

  if(race && race.exhaustedCards.indexOf('COMMANDER') === -1){
    if(haveRaceCommanderAbility(G, race, 1)){
      const planets = getPlayerPlanets(G.tiles, playerID);

      if(planets && planets.length){
        const planet = planets.find(p => p.invasion);
        
        if(planet && String(planet.occupied) === String(playerID)){
          if(!planet.units) planet.units={};
          if(!planet.units.infantry) planet.units.infantry=[];
          planet.units.infantry.push({});
        }
      }
    }

    race.exhaustedCards.push('COMMANDER');
  }

}

export const getPlanetByName = (tiles, pname) => {
  let planet;

  tiles.find(t => {
    if(t.tdata.planets){
      planet = t.tdata.planets.find(p => p.name === pname);
      return planet;
    }
    return false;
  })

  return planet;
}

export const getTileByPlanetName = (tiles, pname) => {
  
  return tiles.find(t => {
    if(t.tdata.planets){
      return t.tdata.planets.find(p => p.name === pname);
    }
    return false;
  })

}

export const getUnitsTechnologies = (keys, race) => {
  let result = {};

  keys.forEach( k => {
      const technology = race.technologies.find(t => t.id === k.toUpperCase());
      result[k] = technology;
  });

  return result;
}

export const haveTechnology = (race, techId) => {

  return race.knownTechs.indexOf(techId) > -1;

}

export const haveAbility = (race, abilId) => {

  return race.abilities.find(a => a.id === abilId);

}

export const enemyHaveTechnology = (races, players, myId, techId) => {

  const enemyId = Object.keys(players).find(k => String(k) !== String(myId));
  
  if(enemyId){
    return races[enemyId].knownTechs.indexOf(techId) > -1;  
  }
  else{
    return false;
  }

}

export const adjustTechnologies = (G, ctx, owner, techs) => {

  if(!techs || !Object.keys(techs) || !Object.keys(techs).length) return techs;

  let result = {...techs};
  const enemyId = getEnemyId(ctx.activePlayers, owner);

  if(enemyId !== undefined){
      if(G.races[enemyId].rid === 2){ //mentak
          if(enemyHaveCombatAC(G.races, ctx.activePlayers, owner, 'FLAGSHIP')){

              Object.keys(result).forEach(t => {
                  if(result[t].sustain && ['FLAGSHIP', 'DREADNOUGHT', 'WARSUN', 'CARRIER', 'CRUISER'].includes(result[t].id)){
                      result[t].sustain = false;
                  }
                  
              })
          }
          else if(enemyHaveCombatAC(G.races, ctx.activePlayers, owner, 'MECH')){
              Object.keys(result).forEach(t => {
                  if(result[t].sustain && ['MECH', 'PDS'].includes(result[t].id)){
                    result[t].sustain = false
                  }
              })
          }
      }
  }

  return result;

}

export const getEnemyId = (players, myId) => {
  const enemyId = Object.keys(players).find(k => String(k) !== String(myId));
  return enemyId;
}

export const enemyHaveCombatAC = (races, players, myId, acId) => {

  const enemyId = getEnemyId(players, myId);
  
  if(enemyId){
    return races[enemyId].combatActionCards.indexOf(acId) > -1;  
  }
  else{
    return false;
  }

}


export const getMyNeighbors = (G, playerID) => {
  let systems = G.tiles.filter( t => String(t.tdata.occupied) === String(playerID) || (t.tdata.planets && t.tdata.planets.some( p => String(p.occupied) === String(playerID))) );
  let neigh = [];

  try{
    systems.forEach( s => neighbors(G.HexGrid, [s.q, s.r]).forEach( n => {
      const tile = G.tiles.find(t => t.tid === n.tileId);
        if(tile){
          if(tile.tdata.occupied !== undefined && String(tile.tdata.occupied) !== String(playerID)){
              if(neigh.indexOf(tile.tdata.occupied) === -1) neigh.push(tile.tdata.occupied);
          }
          else if(tile.tdata.planets){
            tile.tdata.planets.forEach( p => { if(p.occupied !== undefined && String(p.occupied) !== String(playerID)){ 
              if(neigh.indexOf(tile.tdata.occupied) === -1) neigh.push(p.occupied) 
              } })
          }
        }
      })
    );
  }
  catch(e){
    console.log(e)
  }

  return neigh;
}

export const wormholesAreAdjacent = (G, wormhole1, wormhole2) => {

  if(wormhole1 === wormhole2 || wormhole1 === 'all' || wormhole2 === 'all'){
    return true;
  }
  if(G.wormholesAdjacent){
    if(G.wormholesAdjacent.indexOf(wormhole1) > -1 && G.wormholesAdjacent.indexOf(wormhole2) > -1){
      return true;
    }
  }
  if(((wormhole1 === 'alpha' && wormhole2 === 'beta') || (wormhole2 === 'alpha' && wormhole1 === 'beta')) &&
   G.laws.find(l => l.id === 'Wormhole Reconstruction')){
    return true;
   }

  return false;
}

export const computeVoteResolution = (G, agendaNumber) => {

  const voteResolution = {};
  G.races.forEach(r => {
    if(r.voteResults[agendaNumber - 1].vote){
      if(!voteResolution[r.voteResults[agendaNumber - 1].vote]){
        voteResolution[r.voteResults[agendaNumber - 1].vote] = 0;
      }
      voteResolution[r.voteResults[agendaNumber - 1].vote] += (r.voteResults[agendaNumber - 1].count || 0);
    }
  });

  let decision;
  Object.keys(voteResolution).forEach(k => {
    if(!decision) decision = k;
    if(voteResolution[decision] < voteResolution[k]) decision = k;
  });

  if(G.predict && G.predict.length){

    G.predict.forEach(predict => {
      const card = predict.card;

      if(String(card.target.selection).toUpperCase() === String(decision).toUpperCase()){

        if(card.id === 'Construction Rider'){
          const tile = G.tiles[card.target.tidx];
          const planet = tile.tdata.planets[card.target.pidx];

          if(!planet.units) planet.units = {};
          if(!planet.units.spacedock) planet.units.spacedock = [];
          if(planet.units.spacedock.length === 0){
            const units = getPlayerUnits(G.tiles, predict.playerID);

            if(!units['spacedock'] || units['spacedock'] < UNITS_LIMIT['spacedock']){
              planet.units.spacedock.push({});
            }
          }
        }
        else if(card.id === 'Diplomacy Rider'){
          const tile = G.tiles[card.target.tidx];
          G.races.forEach((r, i) => {
            if(String(predict.playerID) !== String(i)){
              tile.tdata.tokens.push(r.rid);
            }
          });
        }
        else if(card.id === 'Imperial Rider'){
          G.races[card.playerID].vp++;
        }
        else if(card.id === 'Leadership Rider'){
          let possible = 16 - (G.races[card.playerID].tokens.new + G.races[card.playerID].tokens.s + G.races[card.playerID].tokens.t + G.races[card.playerID].tokens.f);
          if(possible < 0) possible = 0;
          G.races[card.playerID].tokens.new += Math.min(3, possible);
        }
        else if(card.id === 'Politics Rider'){
          G.races[card.playerID].actionCards.push(...G.actionsDeck.splice(-3));
          G.speaker = G.races[card.playerID].rid;
        }
        else if(card.id === 'Sanction'){
          G.races.forEach(r => {
            if(r.voteResults && r.voteResults[agendaNumber-1] && String(r.voteResults[agendaNumber-1].vote) === String(decision)){
              if(r.tokens.f) r.tokens.f--;
            }
          });
        }
        else if(card.id === 'Technology Rider'){
          G.races[card.playerID].knownTechs.push(card.target.tech.id);
          if(card.target.AI_DEVELOPMENT){
            G.races[card.playerID].exhaustedCards.push('AI_DEVELOPMENT_ALGORITHM');
          }
          if(card.target.exhausted){
            Object.keys(card.target.exhausted).forEach(pname => {
              const planet = getPlanetByName(G.tiles, pname);
              planet.exhausted = true;
            });
          }
        }
        else if(card.id === 'Trade Rider'){
          G.races[card.playerID].tg += 5;
        }
        else if(card.id === 'Warfare Rider'){
          if(card.target.tidx > -1){
            const tile = G.tiles[card.target.tidx];

            if(!tile.tdata.fleet['dreadnought']) tile.tdata.fleet.dreadnought = [];
            tile.tdata.fleet['dreadnought'].push({});
          }
        }

      }

    });

  }

  G.predict = [];

  return decision;

}

export const votingProcessDone = ({G, agendaNumber, playerID, events}) => {

  if(G.TURN_ORDER_IS_REVERSED){
    delete G['TURN_ORDER_IS_REVERSED'];
  }
  
  G['vote' + agendaNumber].decision = computeVoteResolution(G, agendaNumber);

  G.races.forEach(r => {
    if(r.voteResults[agendaNumber - 1].withTech === 'PREDICTIVE_INTELLIGENCE'){
      if(r.voteResults[agendaNumber - 1].vote === G['vote' + agendaNumber].decision){
        r.exhaustedCards.splice(r.exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE'), 1);
      }
    }
  });

  let afterVoteActions = {}; //check if players have this type action cards
  G.races.forEach((r, i) => {
    if(r.actionCards && r.actionCards.length){
      const haveCard = r.actionCards.find(ac => {
        if(ac.after === true){
          if(ac.id !== 'Confusing Legal Text'){
            return true;
          }
          else{
            if(G['vote' + agendaNumber].decision === r.name){
              return true;
            }
          }
        }
        return false;
      });
      if(haveCard){
        afterVoteActions[i]={stage: 'afterVoteActionCard'};
      }
    }
  });

  if(Object.keys(afterVoteActions).length){
    events.setActivePlayers({value: afterVoteActions});
  }

  if(!G.vote2){
    G.vote2 = G.agendaDeck.pop();
  }
  else{
    if(G.passedPlayers.indexOf(playerID) === -1){
      G.passedPlayers.push(playerID);
    }
  }

  if(!Object.keys(afterVoteActions).length){
    events.endTurn();
  }
}

export const dropACard = ({G, playerID}, cardId) => {
  try{
    const idx = G.races[playerID].actionCards.findIndex(a => a.id === cardId);

    if(idx > -1){
      G.discardedActions.push(...G.races[playerID].actionCards.splice(idx, 1));
      //delete G.races[playerID].actionCards[idx];
      //G.races[playerID].actionCards = G.races[playerID].actionCards.filter(a => a);
    }
  }
  catch(e){console.log(e)}
}

export const playCombatAC = ({G, playerID}, card) => {

  if(card.when === 'COMBAT'){
    const idx = G.races[playerID].actionCards.findIndex(ac => ac.id === card.id);
    if(idx > -1){
      //G.races[playerID].actionCards.splice(idx, 1);
      G.currentCombatActionCard = {...card, reaction: {}, playerID};
      //G.races[playerID].combatActionCards.push(card.id);
    }
  }

}

export const repairUnits = (ships, race) => {
  const technologies = getUnitsTechnologies([...Object.keys(ships), 'mech'], race);
  Object.keys(ships).forEach(unit => {
    if(ships[unit] && technologies[unit] && technologies[unit].sustain){
      ships[unit].forEach(ship => {
        if(ship.hit) ship.hit = 0;
      });
    }
    if(ships[unit] && technologies[unit] && technologies[unit].capacity){
      ships[unit].forEach(ship => {
        if(ship.payload){
          ship.payload.forEach(p => {
            if(p.id && technologies[p.id] && technologies[p.id].sustain){
              if(p.hit) p.hit = 0;
            }
          })
        }
      });
    }
  });
}

export const repairAllActiveTileUnits = (G, playerID) => {
  const activeTile = G.tiles.find(t => t.active);
  let ships = activeTile.tdata.attacker;

  if(String(activeTile.tdata.occupied) === String(playerID)){
    ships = activeTile.tdata.fleet;
  }

  if(ships && Object.keys(ships).length){
    repairUnits(ships, G.races[playerID]);
  }

  if(activeTile.tdata.planets){
    activeTile.tdata.planets.forEach(p => {
      if(String(p.occupied) === String(playerID) && p.units){
        repairUnits(p.units, G.races[playerID]);
      }
      else if(p.invasion && p.invasion.troops){
        repairUnits(p.invasion.troops, G.races[playerID]);
      }
    })
  }
}

export const completeObjective = ({G, playerID, oid, payment}) => {

  let objType = 'public';
  let objective = G.pubObjectives.find(o => o.id === oid);

  if(!objective){
    objType = 'private';
    objective = G.races[playerID].secretObjectives.find(o => o.id === oid);
  }
  if(objective && (!objective.players || !objective.players.includes(playerID))){

    const req = objective.req;
    const race = G.races[playerID];
    const tgMultiplier = (payment && payment.tgMultiplier !== undefined) ? payment.tgMultiplier : 1; 
    
    if(objective.type === 'SPEND'){
      const rkeys = Object.keys(req);

      const check = rkeys.every((k) => {
        if(k === 'influence' || k === 'resources'){
            return payment[k] && payment[k].planets.reduce((a,b) => b[k] + a, 0) + (payment[k].tg * tgMultiplier) >= req[k]
        }
        else if(k === 'tg'){
            return G.races[playerID].tg >= req[k]
        }
        else if(k === 'token'){
            return payment[k] && (payment[k].t + payment[k].s >= req[k])
        }
        else if(k === 'fragment'){
          return payment[k] && (payment[k].h + payment[k].c + payment[k].i + payment[k].u >= req[k])
        }
        else return false;
      });

      if(!check){
        console.log('not enough pay');
        return;
      }

      if(rkeys.indexOf('token') > -1){
        if(race.tokens && payment.token){
          race.tokens.t -= payment.token.t;
          race.tokens.s -= payment.token.s;
        }
      }
      else if(rkeys.indexOf('fragment') > -1){
        if(race.fragments && payment.fragment){
          race.fragments.h -= payment.fragment.h;
          race.fragments.c -= payment.fragment.c;
          race.fragments.i -= payment.fragment.i;
          race.fragments.u -= payment.fragment.u;
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
          if(req.tg){
            race.tg -= req.tg;
          }
      }           

      if(!objective.players) objective.players = [];
      objective.players.push(playerID)
      G.races[playerID].lastScoredObjType = objType; 

      checkHeroUnlock(G, playerID);
    }
    else if(objective.type === 'HAVE'){
      if(checkObjective(G, playerID, oid) === true){
        if(!objective.players) objective.players = [];
        objective.players.push(playerID);
        G.races[playerID].lastScoredObjType = objType; 
        
        checkHeroUnlock(G, playerID);
      }
    }
    else{
      return;
    }
    
  }

}

export const checkHeroUnlock = (G, playerID) => {
  let result = 0;
  let race = G.races[playerID];

  if(race.heroIsUnlocked) return;

  if(race){
    race.secretObjectives.concat(G.pubObjectives).forEach(o => {
      if(o && o.players && o.players.length > 0){
        if(o.players.indexOf(playerID) > -1) result += (o.vp ? o.vp : 1);
      }
    });
  }

  if(result >= 3){
    race.heroIsUnlocked = true;
  }
}

export const loadUnitsOnRetreat = (G, playerID) => {
  
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

export const loadUnitsBackToSpace = (G, playerID, planet) => {
  
  const activeTile = G.tiles.find(t => t.active === true);
  const fleet = activeTile.tdata.fleet;//load fighters, infantry and mech if capacity
  
  Object.keys(fleet).forEach(tag => {

    const technology = G.races[playerID].technologies.find(t => t.id === tag.toUpperCase());

    if(technology && technology.capacity){
      fleet[tag].forEach((car, c) => {
        if(!car.payload) car.payload=[];
        
        for(var i=0; i<technology.capacity; i++){
            if(car.payload.length < i) car.payload.push({});
            const place = car.payload[i];

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
              else if(planet.units.infantry && planet.units.infantry.length){
                car.payload.push({...planet.units.infantry[0], id: 'infantry'});
                planet.units.infantry.splice(0,1);
                if(planet.units.infantry.length === 0) delete planet.units['infantry']
              }
            }

            car.payload = car.payload.filter( p => p && p.id);
        }
        
      });
    }

  });
  
  
}

export const checkTacticalActionCard = ({G, events, playerID, atype}) => {
  const players={};

  if(atype === 'TILE_ACTIVATED'){
    const activeTile = G.tiles.find(t => t.active === true);
    const race = G.races[playerID];

    if(activeTile){
      //Counterstroke
      let cardOwners = G.races.filter(r => r.actionCards.find(a => a.id === 'Counterstroke')).map(r => String(r.rid));
      activeTile.tdata.tokens.filter(t => String(t) !== String(race.rid) && cardOwners.indexOf(String(t)) > -1 ).forEach(rid => { 
        const ri = G.races.findIndex(r => r.rid === rid);
        if(ri > -1){        
          players[ri]={stage: 'tacticalActionCard'};
        }
      });

      //Experimental Battlestation
      cardOwners = G.races.filter(r => r.actionCards.find(a => a.id === 'Experimental Battlestation')).map(r => String(r.rid));
      const neigh = neighbors(G.HexGrid, [activeTile.q, activeTile.r]).map(n => n.tileId);
      const tids = [activeTile.tid, ...neigh];

      tids.forEach(tid => {
        const t = G.tiles.find(f => f.tid === tid);

        if(t.tdata.planets){
          t.tdata.planets.forEach(p => {
            if(p.occupied !== undefined && String(p.occupied) !== String(playerID) && p.units && p.units.spacedock){         
                if(!players[p.occupied] && cardOwners.indexOf(String(G.races[p.occupied].rid)) > -1){
                  players[p.occupied]={stage: 'tacticalActionCard'};
                }
            }
          });
        }
      });

      //Forward Supply Base
      cardOwners = G.races.filter(r => r.actionCards.find(a => a.id === 'Forward Supply Base')).map(r => String(r.rid));

      if(activeTile.tdata.occupied !== undefined && String(activeTile.tdata.occupied) !== String(playerID)){
        if(!players[activeTile.tdata.occupied] && cardOwners.indexOf(String(G.races[activeTile.tdata.occupied].rid)) > -1){
          players[activeTile.tdata.occupied] = {stage: 'tacticalActionCard'};
        }
      }
      else if(activeTile.tdata.planets){
        const otherPlanet = activeTile.tdata.planets.find(p => p.occupied !== undefined && String(p.occupied) !== String(playerID) && p.units && Object.keys(p.units).length);
        if(otherPlanet){
            if(!players[activeTile.tdata.occupied] && cardOwners.indexOf(String(G.races[otherPlanet.occupied].rid)) > -1){
              players[activeTile.tdata.occupied] = {stage: 'tacticalActionCard'};
            }
        }
      }
    }
  }
  else if(atype === 'PLANET_OCCUPIED'){
    //Reparations
    const race = G.races[playerID];
    if(race && race.actionCards.find(a => a.id === 'Reparations')){
      players[playerID] = {stage: 'tacticalActionCard'};
    }
  }

  if(Object.keys(players).length > 0){
    events.setActivePlayers({currentPlayer: Stage.NULL, value: players});
  }

}

export const spliceCombatAC = (race, cardid) => {
  const acIdx = race.combatActionCards.indexOf(cardid);
  if(acIdx > -1){
    race.combatActionCards.splice(acIdx, 1);
    return true;
  }
  return false;
}

export const exploreFrontier = (G, playerID, tile) => {
  const explore = G.explorationDecks['frontier'].pop();

  if(explore.id.indexOf('Relic Fragment') > -1){
    G.races[playerID].fragments.u++;
  }
  else if(explore.id === 'Derelict Vessel'){
    G.races[playerID].secretObjectives.push(G.secretObjDeck.pop());
  }
  else if(explore.id === 'Enigmatic Device'){
    G.races[playerID].actionCards.push({
      id: explore.id,
      when: 'ACTION',
      description: explore.effect
    });
  }
  else if(explore.id === 'Gamma Relay'){
    if(tile) tile.tdata.wormhole = 'gamma'; //todo: purge this card
  }
  else if(explore.id === 'Ion Storm'){
    G.races[playerID].explorationDialog = {
      id: explore.id,
      type: 'exploration',
      tid: tile.tid,
      options: [
        {label: 'alpha'},
        {label: 'beta'}
      ]
    };
  }
  else if(explore.id === 'Lost Crew'){
    G.races[playerID].actionCards.push(...G.actionsDeck.splice(-2));
  }
  else if(explore.id === 'Merchant Station'){
    G.races[playerID].explorationDialog = {
      id: explore.id,
      type: 'exploration',
      options: [
        {label: 'replenish'},
        {label: 'convert'}
      ]
    };
  }
  else if(explore.id === 'Mirage'){
    if(tile && tile.tdata){
      if(!tile.tdata.planets) tile.tdata.planets = [];
      tile.tdata.mirage = true;
      tile.tdata.planets.push({
        "name": "Mirage",
        "resources": 1,
        "influence": 2,
        "trait": "cultural",
        "specialty": null,
        "legendary": true,
        "hitCenter": [180,150],
        "hitRadius": [70],
        "occupied": playerID
      });
    }
  }

  G.races[playerID].exploration.push(explore);
  tile.tdata.frontier = false;
}

export const explorePlanetByName = (G, playerID, pname, exhaustedCards) => {
  
  try{
    const planet = getPlanetByName(G.tiles, pname);
    if(!planet.trait) return;

    const explore = G.explorationDecks[planet.trait].pop();

    if(explore.id.indexOf('Relic Fragment') > -1){
      G.races[playerID].fragments[planet.trait[0]]++;
    }
    else if(explore.type === 'ATTACH'){
      if(!planet.attach || !planet.attach.length){
        planet.attach = [];
      }
      planet.attach.push(explore.id);
    }

    if(explore.id === 'Demilitarized Zone'){ //cultural
      const ukeys = Object.keys(planet.units || {});
      if(planet.units && ukeys.length){
        loadUnitsBackToSpace(G, playerID, planet);
      }
      delete planet.units;
    }
    else if(explore.id === 'Dyson Sphere'){
      planet.resources = planet.resources+2;
      planet.influence = planet.influence+1;
    }
    else if(explore.id === 'Paradise World'){
      planet.influence = planet.influence+2;
    }
    else if(explore.id === 'Tomb of Emphidia'){
      planet.influence = planet.influence+1;
    }
    else if(explore.id === 'Lazax Survivors'){
      planet.resources = planet.resources+1;
      planet.influence = planet.influence+2;
    }
    else if(explore.id === 'Mining World'){
      planet.resources = planet.resources+2;
    }
    else if(explore.id === 'Rich World'){
      planet.resources = planet.resources+1;
    }
    else if(explore.id === 'Freelancers'){
      planet.exploration = 'Freelancers'
    }
    else if(explore.id === 'Gamma Wormhole'){
      const tile = getTileByPlanetName(G.tiles, pname);
      if(tile) tile.tdata.wormhole = 'gamma';
    }
    else if(explore.id === 'Mercenary Outfit'){
      const units = getPlayerUnits(G.tiles, playerID);
      if(units['infantry'] < UNITS_LIMIT['infantry']){
        if(!planet.units) planet.units={};
        if(!planet.units.infantry) planet.units.infantry=[];
        
        planet.units.infantry.push({id: 'infantry'});
      }
    }
    else if(explore.id === 'Core Mine'){ //hazardous
      if(planet.units){
        if(planet.units['mech'] && planet.units['mech'].length){
          G.races[playerID].tg++;
        }
        else if(planet.units['infantry'] && planet.units['infantry'].length){
          planet.exploration = 'Core Mine';
        }
      }
    }
    else if(explore.id === 'Expedition'){
      if(planet.exhausted && planet.units){
        if(planet.units['mech'] && planet.units['mech'].length){
          planet.exhausted = false;
        }
        else if(planet.units['infantry'] && planet.units['infantry'].length){
          planet.exploration = 'Expedition';
        }
      }
    }
    else if(explore.id === 'Volatile Fuel Source'){
      if(planet.units){
        if(planet.units['mech'] && planet.units['mech'].length){
          if(G.races[playerID].tokens.new + G.races[playerID].tokens.s + G.races[playerID].tokens.t + G.races[playerID].tokens.f < 16){
            G.races[playerID].tokens.new++;
          }
        }
        else if(planet.units['infantry'] && planet.units['infantry'].length){
          planet.exploration = 'Volatile Fuel Source';
        }
      }
    }
    else if(explore.id === 'Warfare Research Facility'){
      if(planet.specialty){
        planet.resources = planet.resources+1;
        planet.influence = planet.influence+1;
      }
      else{
        planet.specialty = 'warfare';
      }
    }
    else if(explore.id === 'Abandoned Warehouses'){ //industrial
      G.races[playerID].explorationDialog = {
        id: explore.id,
        type: 'exploration',
        options: [
          {label: 'replenish'},
          {label: 'convert'}
        ]
      };
    }
    else if(explore.id === 'Biotic Research Facility'){
      if(planet.specialty){
        planet.resources = planet.resources+1;
        planet.influence = planet.influence+1;
      }
      else{
        planet.specialty = 'biotic';
      }
    }
    else if(explore.id === 'Cybernetic Research Facility'){
      if(planet.specialty){
        planet.resources = planet.resources+1;
        planet.influence = planet.influence+1;
      }
      else{
        planet.specialty = 'cybernetic';
      }
    }
    else if(explore.id === 'Functioning Base'){
      G.races[playerID].explorationDialog = {
        id: explore.id,
        type: 'exploration',
        options: [
          {label: 'gain_1_commodity'},
          {label: 'spend_1_commodity'},
          {label: 'spend_1_tg'}
        ]
      };
    }
    else if(explore.id === 'Local Fabricators'){
      G.races[playerID].explorationDialog = {
        id: explore.id,
        type: 'exploration',
        pname,
        options: [
          {label: 'gain_1_commodity'},
          {label: 'spend_1_commodity'},
          {label: 'spend_1_tg'}
        ]
      };
    }
    else if(explore.id === 'Propulsion Research Facility'){
      if(planet.specialty){
        planet.resources = planet.resources+1;
        planet.influence = planet.influence+1;
      }
      else{
        planet.specialty = 'propulsion';
      }
    }
    

    G.races[playerID].exploration.push(explore);

    if(exhaustedCards && exhaustedCards.indexOf('SCANLINK_DRONE_NETWORK') > -1){
      G.races[playerID].exhaustedCards.push('SCANLINK_DRONE_NETWORK');
    }
  }
  catch(e){console.log(e)}
}

export const checkIonStorm = (G, fullpath) => {
  fullpath.some((t, idx) => {
    let swap = false;
    if(t && t.tdata){
      if(t.tdata.ionstorm){
        if(fullpath.length > idx+1){ //check if enter the storm
          const t2 = fullpath[idx+1];
          if(t2 && t2.tdata && wormholesAreAdjacent(G, t.tdata.wormhole, t2.tdata.wormhole)){
            swap = true;
          }
        }
        if(!swap && idx > 0){ //check if exit the storm
          const t0 = fullpath[idx-1];
          if(t0 && t0.tdata && wormholesAreAdjacent(G, t.tdata.wormhole, t0.tdata.wormhole)){
            swap = true;
          }
        }

        if(swap){
          if(t.tdata.wormhole === 'alpha') t.tdata.wormhole = 'beta';
          else if(t.tdata.wormhole === 'beta') t.tdata.wormhole = 'alpha';
        }
       
      }
    }
    return swap;
  });
}

export const isNumeric = function(param) {
  return !isNaN(parseFloat(param)) && isFinite(param);
};

/*export const getVP = function(G, playerID) {
  let result = 0;
  const race = G.races[playerID];

  if(race){
    race.secretObjectives.concat(G.pubObjectives).forEach(o => {
      if(o && o.players && o.players.length > 0){
        if(o.players.indexOf(playerID) > -1) result += (o.vp ? o.vp : 1);
      }
    });

    result += race.vp;
  }

  return result;
}*/

export const shuffle = (array) => {
  let m = array.length, t, i;

  // While there remain elements to shuffle…
  while (m) {
      // Pick a remaining element…
      i = Math.floor(Math.random() * m--);

      // And swap it with the current element.
      t = array[m];
      array[m] = array[i];
      array[i] = t;
      //++seed
  }

  return array;
}

export const doFlagshipAbility = ({G, rid}) => {

  try{
    const playerID = G.races.findIndex(r => r && r.rid === rid);

    if(playerID > -1){

      if(rid === 1){
          G.tiles.some(tile => {
            if(tile && tile.tdata && String(tile.tdata.occupied) === String(playerID)){
              const fleet = tile.tdata.fleet;
              
              if(fleet && fleet.flagship && fleet.flagship.length){
                const technologies = getUnitsTechnologies(['flagship', 'carrier', 'dreadnought', 'warsun'], G.races[playerID]);
                
                Object.keys(fleet).some(k => {
                  if(technologies[k] && fleet[k] && fleet[k].length){
                    return fleet[k].some(ship => {
                      if(!ship.payload){
                        ship.payload = [];
                      }
                        
                      if(ship.payload.length < technologies[k].capacity){
                        ship.payload.push({id: 'infantry'});
                        return true;
                      }
                      return false;
                    });
                  }
                  return false;
                })
                return true;
              }
            }
            return false;
          });
      }

    }
  }
  catch(e){
    console.log(e);
  }

}

export const normalizeName = (name) => {
  return name.replace(/[_\s']/igm, '');
}

export const checkIfMyNearbyUnit = (G, playerID, tile, units) => {

  const neigh = neighbors(G.HexGrid, [tile.q, tile.r]).map(n => n.tileId); //todo: wormholes
  const withPayload = units.includes('mech');

  return neigh.find(n => {
    const tile = G.tiles.find(t => t.tid === n);

    if(tile && tile.tdata){
      let result = false;

      if(String(tile.tdata.occupied) === String(playerID)){
        if(tile.tdata.fleet && Object.keys(tile.tdata.fleet)){
          result = Object.keys(tile.tdata.fleet).find(tag => {
            if(units.includes(tag)) return true;

            if(withPayload){
              return tile.tdata.fleet[tag].find(car => {
                if(car.payload && car.payload.find(p => p && p.id === 'mech')){
                  return true;
                }
                return false;
              })
            }

            return false;
          });
        }
      }

      if(!result && withPayload && tile.tdata.planets){
        result = tile.tdata.planets.find(p => {
          if(String(p.occupied) === String(playerID)){
            if(p.units && Object.keys(p.units) && Object.keys(p.units).includes('mech')){
              return true;
            }
          }

          return false
        })
      }

      return result;
    }

    return false;
  })

}

export const checkSoldPromissory = (race, PROMISSORY) => {
  return race.promissory.find(p => p.id === PROMISSORY && p.sold !== undefined);
}

export const returnPromissory = (G, playerID, promissory, plugins) => {
  const acceptorId = G.races.findIndex(r => r.rid === promissory.sold);
  const acceptor = G.races[acceptorId];
    
  if(acceptor){
    const idx = acceptor.promissory.findIndex(p => p.id === promissory.id && p.owner === G.races[playerID].rid);
    if(idx > -1){
      acceptor.promissory.splice(idx, 1);
    }
    
    promissory.sold = undefined;

    if(plugins){
      plugins.effects.promissory({src: acceptorId, dst: playerID, id: promissory.id});
    }

    return acceptor;
  }
}

export const returnPromissoryToOwner = (G, playerID, promissory, plugins) => {
  const ownerID = G.races.findIndex(r => r.rid === promissory.owner);
  const owner = G.races[ownerID];
    
  if(owner){
    const p = owner.promissory.find(p => p.id === promissory.id && p.sold === G.races[playerID].rid);
    if(p){
      p.sold = undefined;
    }
    
    const idx = G.races[playerID].promissory.findIndex(p => p.id === promissory.id && p.owner === promissory.owner);
    if(idx > -1){
      G.races[playerID].promissory.splice(idx, 1);
    }

    if(plugins) plugins.effects.promissory({src: playerID, dst: ownerID, id: promissory.id});
    return owner;
  }
}

export const replenishCommodity = (G, playerID, count, plugins) => {
  
  try{
    const promissory = checkSoldPromissory(G.races[playerID], 'TRADE_AGREEMENT');
    
    if(promissory){
      const acceptor = returnPromissory(G, playerID, promissory, plugins);
      
      if(acceptor){
        acceptor.tg += count;
        //if(plugins) plugins.effects.tg();
      }
    }
    else{
      G.races[playerID].commodity += Math.min(count, G.races[playerID].commCap);

      const law = G.laws.find(l => l.id === 'Minister of Commerce');
      if(law && law.decision === G.races[playerID].name){
        const neigh = getMyNeighbors(G, playerID);
        G.races[playerID].tg += neigh.length;
      }
    }
  }
  catch(e){
    console.log(e)
  }

}

export const getRaceVP = (G, pid) => {
  let result = 0;
  let race = G.races[pid];

  if(race){
    race.secretObjectives.concat(G.pubObjectives).forEach(o => {
      
      if(o && o.players && o.players.length > 0){
        if(o.players.find(p => String(p) === String(pid))){
          result += (o.vp ? o.vp : 1);
        }
      }
    });

    result += race.vp;
    if(race.relics && race.relics.find(r => r.id === 'Shard of the Throne')){
      result++;
    }

    const supports = race.promissory.filter(p => p.id === 'SUPPORT_FOR_THE_THRONE' && p.owner !== undefined); //todo: except elliminated players
    if(supports && supports.length) result += supports.length;

    if(G.laws.find(l => l.id === 'Political Censure' && l.decision === race.name)) result++;
  }

  return result;
}

export const haveRaceCommanderAbility = (G, race, rid) => {
  if(race.rid === rid){
    return race.commanderIsUnlocked;
  }
  else{
    const alliance = race.promissory.find(p => p.id === 'ALLIANCE' && p.owner === rid);
    if(alliance){
      const ally = G.races.find(r => r.rid === rid);
      return ally && ally.commanderIsUnlocked;
    }
  }
}

export const occupyPlanet = (args) => {
  const {G, playerID, planet, explore, plugins} = args;

  try{
    planet.exhausted = true;
    planet.occupied = playerID;
   
    plugins.effects.planet({pname: planet.name, playerID});
    checkCommanderUnlock(G, playerID);

    if(explore && planet.trait){
      explorePlanetByName(G, playerID, planet.name)
    }

    const law = G.laws.find(l => l.id === 'Minister of Exploration');
    if(law && law.decision === G.races[playerID].name){
      G.races[playerID].tg++;
    }

    plugins.effects.tg();
  }
  catch(e){
    console.log(e)
  }

}

export const getMaxActs = (G, playerID) => {
  try{
    let result = 0;
    const race = G.races[playerID];

    if(race){
      result = haveTechnology(race, 'FLEET_LOGISTICS') ? 2:1;
      if(race.exhaustedCards.includes('Minister of War')) result++;
    }

    return result;
  }
  catch(e){
    console.log(e)
  }
}

export const calculateSpaceCombatHits = ({G, ctx, playerID, prevStages}) => {

  try{
    const activeTile = G.tiles.find(t => t.active === true);
    const ambush = G.spaceCombat && G.spaceCombat.ambush;
    const assaultCannon = !ambush && G.spaceCombat && G.spaceCombat.assaultCannon;

    let result = {};

    if(assaultCannon){
        const enemy = Object.keys(ctx.activePlayers).find(k => String(k)!==String(playerID));
        result[enemy] = 1;
        return result;
    }

    Object.keys(ctx.activePlayers).forEach(pid => {
        let h = 0;
        if(G.dice[pid]){
            Object.keys(G.dice[pid]).forEach(unit => {
                let adj = (unit === 'fighter' && G.races[pid].combatActionCards.indexOf('Fighter Prototype') > -1 &&
                    prevStages[pid].filter(s => s === 'spaceCombat').length === 1) ? 2:0;
                if(G.races[pid].combatActionCards.indexOf('Morale Boost') > -1 && unit !== 'pds' && unit !== 'spacedock'){
                    adj++;
                }
                if(G.races[pid].combatActionCards.includes('NEBULA') && !ambush) adj++;

                const technology = G.races[pid].technologies.find(t => t.id === unit.toUpperCase());
                
                if(technology && technology.combat){
                    //h += G.dice[pid][unit].dice.filter(d => d+adj >= technology.combat).length;

                    h += G.dice[pid][unit].dice.filter((die, idx) => {
                        const val = G.dice[pid][unit].reroll ? G.dice[pid][unit].reroll[idx] || die : die;
                        return val+adj >= technology.combat}).length;
                }

                if(G.races[pid].combatActionCards.indexOf('Reflective Shielding') > -1){
                    let fleet = (String(pid) === String(ctx.currentPlayer)) ? activeTile.tdata.attacker : activeTile.tdata.fleet;
                    let hitted = Object.keys(fleet).find(tag =>{
                        if(fleet[tag] && fleet[tag].length){
                            return fleet[tag].find(c => c.hit && c.hit > 0)
                        }
                        return false;
                    }); 
                        
                    if(hitted) h += 2;
                }
                if(enemyHaveCombatAC(G.races, ctx.activePlayers, pid, 'Shields Holding')){
                    h -= 2;
                    if(h < 0) h=0;
                }
            });
        }
        result[pid] = h;
    });

    return result;
  }
  catch(e){console.log(e)}

}

export const setSpaceCombatHit = ({G, hits, units, technologies}, {tag, idx, pidx, payloadId}) => {

  try{
    const ambush = G.spaceCombat && G.spaceCombat.ambush;
    const assaultCannon = !ambush && G.spaceCombat && G.spaceCombat.assaultCannon;

    return produce(hits, draft => {
      if(!draft[tag]) draft[tag]=[];
      if(pidx === undefined){
          const dmg = draft[tag].findIndex(ship => ship.idx === idx);
          if(dmg === -1){
              draft[tag].push({idx, payload:[], hit: (assaultCannon && technologies[tag].sustain) ? 2:1});
          }
          else{
              if(assaultCannon && technologies[tag].sustain){
                  draft[tag][dmg].hit += 2;
                  if(draft[tag][dmg].hit > 2) draft[tag][dmg].hit = 0;
              }
              else if(technologies[tag].sustain && !units[tag][dmg].hit){
                  draft[tag][dmg].hit = (draft[tag][dmg].hit || 0 ) + 1;
                  if(draft[tag][dmg].hit > 2) draft[tag][dmg].hit = 0;
              }
              else{
                  draft[tag][dmg].hit = !draft[tag][dmg].hit;
              }
          }
      }
      else{
          const dmg = draft[tag].findIndex(ship => ship.idx === idx);
          let carrier = draft[tag][dmg];
          if(!carrier){
              draft[tag].push({idx, payload: [{pidx, id: payloadId, hit: 1}]});
          }
          else{       
              let index = carrier.payload.findIndex(p => p.pidx === pidx);
              if(index === -1){
                  carrier.payload.push({pidx, id: payloadId, hit: 1});
              }
              else{
                  if(technologies[payloadId].sustain && !units[tag][dmg].payload[index].hit){
                      carrier.payload[index].hit++;
                      if(carrier.payload[index].hit > 2) carrier.payload[index].hit = 0;
                  }
                  else{
                      carrier.payload[index].hit = !carrier.payload[index].hit;
                  }
              }
          }
      }
    })
  }
  catch(e){
    console.log(e)
  }

}