/* eslint eqeqeq: 0 */
import tileData from './tileData.json';
import techData from './techData.json';
import { neighbors } from './Grid';
import { createContext } from 'react';

export const NUM_PLAYERS = 2;

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

export const getPlayerUnits = (tiles, playerID)=> {
    const units = [];
  
    tiles.forEach( t => {
      if(t.tdata.occupied == playerID){
        if(t.tdata.fleet){
          Object.keys(t.tdata.fleet).forEach( k => {
            if(!units[k]) units[k] = 0;
            units[k] += t.tdata.fleet[k];
          });
        }
      }
  
      if(t.tdata.planets && t.tdata.planets.length){
        t.tdata.planets.forEach(p => {
          if(p.occupied == playerID){
            if(p.units){
              Object.keys(p.units).forEach( k => {
                if(!units[k]) units[k] = 0;
                units[k] += p.units[k];
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
            if(req.unit.indexOf(k) > -1) sum += s.tdata.fleet[k];
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

        if(traits['industrial'] < req.trait && traits['cultural'] < req.trait && traits['hazardous'] < req.trait){
        return;
        }
    }
    else if(req.upgrade){
        const upgrades = race.knownTechs.filter(t => {
        const tech = techData.find(td => td.id === t);
        return tech.type === 'unit' && tech.upgrade === true
        });
        if(upgrades.length < req.upgrade){
        return;
        }
    }
    else if(req.attachment){
        let sum = 0;
        planets.forEach(p => {
        if(p.attachment) sum++;
        });

        if(sum < req.attachment){
        return;
        }
    }
    else if(req.technology){
        const colors = {'biotic': 0, 'warfare': 0, 'cybernetic': 0, 'propulsion': 0};
        race.knownTechs.forEach(t => {
        const tech = techData.find(td => td.id === t);
        if(colors[tech.type] !== undefined){ colors[tech.type]++; }
        });

        let goals = 0;
        Object.keys(colors).forEach(c => {
        if(colors[c] >= parseInt(req.technology.count)) goals++;
        });

        if(goals < parseInt(req.technology.color)){
        return;
        }
    }
    else if(req.planet){
        let result = planets;
        if(req.nhs){
        result = result.filter( p => p.tid != race.rid );
        }
        if(req.ground){
        result = result.filter( p => p.units && Object.keys(p.units).some( key => req.ground.indexOf(key) > -1));
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
        }

        if(req.noPlanet){
        systems = systems.filter( s => s.tdata.planets.length == 0);
        }
        if(req.adjacentMR){
        systems = systems.filter( s => (s.q >= -1 && s.q <= 1) && (s.r >=-1 && s.q <= -1) && !(s.r == 0 && s.q == 0));
        }
        if(req.MR && req.legendary && req.anomaly){
        systems = systems.filter( s => s.tid == 18 || [65, 66, 82].indexOf(s.tid) > -1 || tileData.anomaly.indexOf(s.tid) > -1);
        }
        if(req.edge){
        systems = systems.filter( s => neighbors([s.q, s.r]).toArray().length < 6);
        }

        if(systems.length < req.system){
        return;
        }
    }
    else if(req.specialty){
        let sum = 0;
        planets.forEach(p => {
          if(p.specialty) sum++;
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

    return true;
};

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

export const enemyHaveTechnology = (races, players, myId, techId) => {

  const enemyId = Object.keys(players).find(k => String(k) !== String(myId));
  
  if(enemyId){
    return races[enemyId].knownTechs.indexOf(techId) > -1;  
  }
  else{
    return false;
  }

}

export const getMyNeighbors = (G, playerID) => {
  let systems = G.tiles.filter( t => String(t.tdata.occupied) === String(playerID) || (t.tdata.planets && t.tdata.planets.some( p => String(p.occupied) === String(playerID))) );
  let neigh = [];

  systems.forEach( s => neighbors([s.q, s.r]).forEach( n => {
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

  return neigh;
}