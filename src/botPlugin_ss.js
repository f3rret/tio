
import cardData from './cardData.json';
import { neighbors as gridNeighbors} from "./Grid";
import { getUnitsTechnologies, UNITS_LIMIT } from './utils'; 
import { ACTS_MOVES, STATS_MOVES, STRAT_MOVES, ACTS_STAGES, AGENDA_MOVES } from './gameStages';
//import { current } from 'immer';


///////////////server side///////////////////////////////////

const fleetCount = (tile, playerID) => {
    let fc = 0;

    if(tile.tdata && tile.tdata.fleet && String(tile.tdata.occupied) === String(playerID)){
        const fleetKeys = Object.keys(tile.tdata.fleet);

        fleetKeys.forEach(fk => {
            if(tile.tdata.fleet[fk] && fk.toUpperCase() !== 'FIGHTER') fc += tile.tdata.fleet[fk].length;
        });
    }

    return fc;
}

const allUnitsCount = (G, playerID)=> {
    const units = [];

    G.tiles.forEach( t => {
      if(String(t.tdata.occupied) === String(playerID)){
        if(t.tdata.fleet){ //todo: or invasion fleet
          Object.keys(t.tdata.fleet).forEach( k => { 
            if(!units[k]) units[k] = 0;
            units[k] += t.tdata.fleet[k].length;
            
            t.tdata.fleet[k].forEach(ship => {
              if(ship && ship.payload && ship.payload.length){
                ship.payload.forEach(pl => {
                  if(pl && pl.id){
                    if(!units[pl.id]) units[pl.id] = 0;
                    units[pl.id]++;
                  }
                });
              }
            });
          });
        }
      }

      if(t.tdata.planets && t.tdata.planets.length){
        t.tdata.planets.forEach(p => {
          if(String(p.occupied) === String(playerID)){ //todo: or attacker forces
            if(p.units){
              Object.keys(p.units).forEach( k => {
                if(!units[k]) units[k] = 0;
                units[k] += Array.isArray(p.units[k]) ? p.units[k].length:p.units[k];
              });
            }
          }
        })
      }
    });
    
    return units;
}

const doProduction = ({G, ctx, playerID, plugins, events}) => {

    let prefIdx;
    const preferredBaseTile = G.tiles.find((tile, idx) => { //find spacedock closest to mecatol
        if(tile.tdata && tile.tdata.planets && (tile.active || !tile.tdata.tokens.includes(G.races[playerID].rid))){

            if(tile.tdata.occupied !== undefined && String(tile.tdata.occupied) !== String(playerID)){ //blocked by enemy
                return false;
            }

            if(fleetCount(tile, playerID) >= G.races[playerID].tokens.f - 1){
                return false;
            }

            prefIdx = idx;
            return tile.tdata.planets.find(planet => String(planet.occupied) === String(ctx.currentPlayer) && planet.units && planet.units.spacedock && planet.units.spacedock.length);
        }

        return false;
    });

    if(!preferredBaseTile) return false;

    let preferredBasePlanet = preferredBaseTile.tdata.planets[0]; //get planet with spacedock
    preferredBaseTile.tdata.planets.length > 1 && preferredBaseTile.tdata.planets.forEach(planet => {
        if(planet.units && planet.units.spacedock && planet.units.spacedock.length){
            preferredBasePlanet = planet;
        }
    });

    if(preferredBaseTile.active !== true){
        ACTS_MOVES.activateTile({G, playerID, events, effects: plugins.effects}, prefIdx);
    }


    const deploy = [
        {carrier: 1, destroyer: 1, infantry: 2, fighter: 2},
        {destroyer: 1, cruiser: 1},
        {dreadnought: 1, fighter: 1},
        {flagship: 1, infantry: 2, fighter: 2},
        {warsun: 1, infantry: 2, fighter: 2}
    ]

    //const fc = fleetCount(preferredBaseTile, playerID);
    const units = allUnitsCount(G, playerID);

    const dp = deploy.find(variant => {
        return !Object.keys(variant).find(key => {
            return units[key] + variant[key] > UNITS_LIMIT[key]
        })
    });

    if(!dp) return false;

    const payment = {resources: [], influence: []};
    ACTS_MOVES.producing({G, playerID, ctx, events}, preferredBasePlanet.name, dp, payment/*, exhaustedCards*/);

    return true;
}

const getMyTiles = ({G, playerID}) => {
    
    return G.tiles.filter(t => 
        String(t.tdata.occupied) === String(playerID)
    )

}

const getPreferredTile = (tiles) => {

    if(!tiles || !tiles.length) return;

    const values = tiles.map( (t, idx) => {
        let value = 0;
        if(t.tdata && t.tdata.planets){
            t.tdata.planets.forEach(p => value += p.resources)
        }
        return {idx, value}
    });

    values.sort((a, b) => {
        if(a.value > b.value) return -1;
        if(a.value < b.value) return 1;
        return 0;
    });

    return tiles[values[0].idx];

}

const getTileClosestToMecatol = (tiles) => {

    if(!tiles || !tiles.length) return;

    const values = tiles.map( (t, idx) => {
        let value = Math.abs(t.q) + Math.abs(t.r);
        return {idx, value}
    });

    values.sort((a, b) => {
        if(a.value < b.value) return -1;
        if(a.value > b.value) return 1;
        return 0;
    });

    return tiles[values[0].idx];

}

const hasCarAndInf = (tile) => {

    if(!tile.tdata) return false;
    if(!tile.tdata.fleet || !tile.tdata.fleet.carrier) return false;

    //search for infantry
    const fleet = tile.tdata.fleet;
    const loadedInf = fleet.carrier.find(car => car.payload && car.payload.length && car.payload.find(p => p && p.id === 'infantry'));
    if(loadedInf) return true;
    
    const planets = tile.tdata.planets;
    if(!planets || !planets.length) return false;
    
    return planets.find(p => p.units && p.units.infantry);

}

const getPayloadedCarrier = (tile) => {

    if(!tile.tdata) return;
    if(!tile.tdata.fleet || !tile.tdata.fleet.carrier) return;

    const fleet = tile.tdata.fleet;
    const loadedInf = fleet.carrier.findIndex(car => car.payload && car.payload.length && car.payload.find(p => p && p.id === 'infantry'));

    if(loadedInf > -1) return loadedInf;

}

const payloadCarrier = ({G, playerID, tileIdx, tag, max}) => {

    const tile = G.tiles[tileIdx];
    const race = G.races[playerID];
    const technologies = getUnitsTechnologies(['carrier'], race);

    if(!tile.tdata) return -1;
    if(!tile.tdata.fleet || !tile.tdata.fleet.carrier) return -1;

    const fleet = tile.tdata.fleet;
    if(!fleet.carrier || !fleet.carrier.length) return -1;

    const car = fleet.carrier[0];
    if(!car) return -1;
    if(!car.payload) car.payload = [];

    const planets = tile.tdata.planets;
    if(!planets || !planets.length) return -1;
    
    planets.forEach(p => {
        if(p.units && p.units[tag] && car.payload.length < technologies['carrier'].capacity){
            while(car.payload.filter(p => p && p.id === tag).length < max && p.units[tag].length){
                const unit = {...p.units[tag].pop(), id: tag};
                car.payload.push(unit);
            }
            if(!p.units[tag].length) delete p.units[tag];
        }
    });

    return 0;

}

const getLandingForce = (tile) => {

    if(!tile.tdata) return;
    if(!tile.tdata.fleet || !tile.tdata.fleet.carrier) return;

    const fleet = tile.tdata.fleet;
    const i = fleet.carrier.findIndex(car => car.payload && car.payload.length && car.payload.find(p => p && p.id === 'infantry'));
    
    if(i > -1){
        const j = fleet.carrier[i].payload.findIndex(p => p && p.id === 'infantry');
        if(j > -1) return {unit: 'carrier', i, j};
    }

}

const payloadAnyTransport = ({G, playerID, tile}) => {

    const race = G.races[playerID];
    const transport = ['carrier', 'cruiser', 'dreadnought', 'flagship', 'warsun'];
    const technologies = getUnitsTechnologies(transport, race);

    if(!tile.tdata) return -1;

    const fleet = tile.tdata.fleet;
    if(!fleet) return -1;

    const planets = tile.tdata.planets;
    if(!planets || !planets.length) return -1;
    
    if(!fleet.carrier || !fleet.carrier.length) return -1;

    Object.keys(fleet).forEach(cartag => {
        if(fleet[cartag] && fleet[cartag].length && technologies[cartag] && technologies[cartag].capacity){
            fleet[cartag].forEach(car => {
                if(!car.payload) car.payload = [];

                planets.forEach(p => {
                    ['infantry', 'fighter', 'mech'].forEach(tag => {
                        while(p.units && p.units[tag] && p.units[tag].length && car.payload.length < technologies[cartag].capacity){
                            const unit = {...p.units[tag].pop(), id: tag};
                            car.payload.push(unit);

                            if(!p.units[tag].length) delete p.units[tag];
                        }
                    })
                });
            })
        }
    });

    return 0;

}

export const botMove = ({G, playerID, ctx, random, events, plugins}) => {

    try{
        const race = G.races[playerID];

        if(ctx.phase === 'strat'){

            if(!ctx.activePlayers){
                let strats = Object.keys(cardData.strategy);
                G.races.forEach(race => {
                    if(race.strategy && race.strategy.length){
                        race.strategy.forEach(s => {
                            if(s.id){
                                strats = strats.filter(st => st !== s.id);
                            }
                        });
                    }
                });

                const rand = random.Die(strats.length);
                STRAT_MOVES.pickStrategy({G, playerID, events}, strats[rand-1]);
            }

        }
        else if(ctx.phase === 'acts'){

            if(!ctx.activePlayers){
                if(race.tokens.t > 0){
                    const ownTiles = getMyTiles({G, playerID: ctx.currentPlayer});

                    if(ownTiles && ownTiles.length){
                        if(race.tokens.t === 1){
                            if(!doProduction({G, ctx, playerID, events, plugins})){ //need move fleet from spacedock

                                const preferredBaseTile = G.tiles.find((tile, idx) => { //find spacedock closest to mecatol
                                    if(tile.tdata && String(tile.tdata.occupied) === String(playerID) && tile.tdata.fleet && tile.tdata.planets && !tile.tdata.tokens.includes(G.races[playerID].rid)){
                                        return tile.tdata.planets.find(planet => String(planet.occupied) === String(ctx.currentPlayer) && planet.units && planet.units.spacedock && planet.units.spacedock.length);
                                    }
                            
                                    return false;
                                });

                                if(preferredBaseTile){
                                    const neigh = gridNeighbors(G.HexGrid, [preferredBaseTile.q, preferredBaseTile.r]).map(n => n.tileId);
                                    const neighTiles = neigh.map(n => G.tiles.find(t => t.tid === n))
                                                    .filter( n => n.tdata && (n.tdata.occupied === undefined || String(n.tdata.occupied) !== String(playerID)));

                                    const destination = getTileClosestToMecatol(neighTiles);
                                    if(destination){
                                        const destIdx = G.tiles.findIndex(t => t.tid === destination.tid);
                                        const srcIdx = G.tiles.findIndex(t => t.tid === preferredBaseTile.tid);

                                        let err = ACTS_MOVES.activateTile({G, playerID, events, effects: plugins.effects}, destIdx);
                                        if(!err){
                                            payloadAnyTransport({G, playerID, tile: preferredBaseTile});
                                            Object.keys(preferredBaseTile.tdata.fleet).forEach(c => {
                                                if(preferredBaseTile.tdata.fleet[c]){
                                                    err = ACTS_MOVES.moveShip({G, playerID, random, events, effects: plugins.effects}, {tile: srcIdx, path: [preferredBaseTile.tid, destination.tid], unit: c, shipIdx: 0});
                                                }
                                            });

                                            return events.endTurn();
                                        }

                                    }
                                }
                                
                            }

                            return ACTS_MOVES.pass({G, playerID, events, ctx, effects: plugins.effects});
                        }
                        else{
                            let neigh = [];
                            let neigh2src = {};

                            //find most attractive tile to capture
                            ownTiles.forEach(tile => {
                                if(tile.tdata && !tile.tdata.tokens.includes(race.rid) && hasCarAndInf(tile)){//only for those which have carriers & inf
                                    const n = gridNeighbors(G.HexGrid, [tile.q, tile.r]).map(n => n.tileId);
                                    
                                    n.forEach(nn => neigh2src[nn] = tile.tid); //remember src tile
                                    neigh.push(...n);
                                }
                            });
                            

                            neigh.filter((n, i) => neigh.indexOf(n) === i); //unique

                            if(neigh.length){
                                //not own anyone and with planet
                                let neighTiles = neigh.map(n => G.tiles.find(t => t.tid === n))
                                                    .filter( n => n.tdata && n.tdata.occupied === undefined && 
                                                        !n.tdata.tokens.includes(race.rid) && n.tdata.planets && 
                                                        n.tdata.planets.find(p => p.occupied === undefined));

                                let pref = getPreferredTile(neighTiles);

                                if(pref){
                                    const prefIdx = G.tiles.findIndex(t => t.tid === pref.tid);
                                    const srcIdx = G.tiles.findIndex(t => t.tid === neigh2src[pref.tid]);
                                    
                                    pref = G.tiles[prefIdx];
                                    let shipIdx = getPayloadedCarrier(G.tiles[srcIdx]);

                                    if(shipIdx === undefined){
                                        shipIdx = payloadCarrier({G, playerID, tileIdx: srcIdx, tag: 'infantry', max: 3});
                                        shipIdx = payloadCarrier({G, playerID, tileIdx: srcIdx, tag: 'fighter', max: 5});
                                    }

                                    if(shipIdx > -1){
                                        let err = ACTS_MOVES.activateTile({G, playerID, events, effects: plugins.effects}, prefIdx);

                                        if(!err){
                                            err = ACTS_MOVES.moveShip({G, playerID, random, events, effects: plugins.effects}, {tile: srcIdx, path: [neigh2src[pref.tid], pref.tid], unit: 'carrier', shipIdx});

                                            if(!err){
                                                if(G.tiles[srcIdx].tdata.fleet){ //send one ship to cover carrier
                                                    let convoy = ['cruiser', 'destroyer'];
                                                    convoy.forEach(c => {
                                                        if(G.tiles[srcIdx].tdata.fleet[c]){
                                                            err = ACTS_MOVES.moveShip({G, playerID, random, events, effects: plugins.effects}, {tile: srcIdx, path: [neigh2src[pref.tid], pref.tid], unit: c, shipIdx: 0});
                                                        }
                                                    });
                                                }

                                                //capture unowned planets
                                                pref.tdata.planets.forEach((p, pidx) => {
                                                    if(String(p.occupied) !== String(playerID)){
                                                        let force = getLandingForce(pref);

                                                        if(force){
                                                            err = ACTS_MOVES.unloadUnit({G, playerID, random, events, effects: plugins.effects}, {src: {...force, tile: prefIdx}, dst: {tile: prefIdx, planet: pidx}});
                                                            if(G.races[playerID].explorationDialog){
                                                                ACTS_MOVES.choiceDialog({G, playerID, random, events, effects: plugins.effects}, 0);
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                        }
                                    }
                                }
                                else{//try to move fleet close to Mecatol
                                    neighTiles = neigh.map(n => G.tiles.find(t => t.tid === n))
                                                    .filter( n => n.tdata && (n.tdata.occupied === undefined || String(n.tdata.occupied) !== String(playerID)));

                                    pref = getTileClosestToMecatol(neighTiles);

                                    if(pref){
                                        const prefIdx = G.tiles.findIndex(t => t.tid === pref.tid);
                                        const srcIdx = G.tiles.findIndex(t => t.tid === neigh2src[pref.tid]);
                                        
                                        //pref = G.tiles[prefIdx];
                                        let shipIdx = getPayloadedCarrier(G.tiles[srcIdx]);

                                        if(shipIdx === undefined){
                                            shipIdx = payloadCarrier({G, playerID, tileIdx: srcIdx, tag: 'infantry', max: 3});
                                            shipIdx = payloadCarrier({G, playerID, tileIdx: srcIdx, tag: 'fighter', max: 5});
                                        }

                                        if(shipIdx > -1){
                                            let err = ACTS_MOVES.activateTile({G, playerID, events, effects: plugins.effects}, prefIdx);

                                            if(!err){
                                                err = ACTS_MOVES.moveShip({G, playerID, random, events, effects: plugins.effects}, {tile: srcIdx, path: [neigh2src[pref.tid], pref.tid], unit: 'carrier', shipIdx});
        
                                                if(!err){
                                                    if(G.tiles[srcIdx].tdata.fleet){ //send one ship to cover carrier
                                                        let convoy = ['cruiser', 'destroyer'];
                                                        convoy.forEach(c => {
                                                            if(G.tiles[srcIdx].tdata.fleet[c]){
                                                                err = ACTS_MOVES.moveShip({G, playerID, random, events, effects: plugins.effects}, {tile: srcIdx, path: [neigh2src[pref.tid], pref.tid], unit: c, shipIdx: 0});
                                                            }
                                                        });
                                                    }
                                                }
                                            }
                                        }

                                    }
                                    else if(!doProduction({G, ctx, playerID, events, plugins})){
                                        return ACTS_MOVES.pass({G, playerID, events, ctx, effects: plugins.effects});
                                    }
                                }
                            }
                            else{
                                if(!doProduction({G, ctx, playerID, events, plugins})){
                                    return ACTS_MOVES.pass({G, playerID, events, ctx, effects: plugins.effects});
                                }
                            }
                        }

                        return events.endTurn();
                    }

                }
                else{
                    return ACTS_MOVES.pass({G, playerID, events, ctx, effects: plugins.effects});
                }
            }
            else if(ctx.activePlayers[0] === 'strategyCard'){
                ACTS_STAGES.strategyCard.moves.passStrategy({G, ctx, events})
            }
            else if(ctx.activePlayers[0] === 'spaceCombat'){
                //ACTS_STAGES.strategyCard.moves.passStrategy({G, ctx, events})
            }
            else if(ctx.activePlayers[0] === 'spaceCombat_step2'){
                let hits = {};
                ACTS_STAGES.spaceCombat_step2.moves.nextStep({G, playerID, ctx, random, events, effects: plugins.effects}, hits);
            }
            else if(ctx.activePlayers[0] === 'spaceCombat_await'){
                //ACTS_STAGES.strategyCard.moves.passStrategy({G, ctx, events})
            }


        }
        else if(ctx.phase === 'stats'){
            if(!ctx.activePlayers){
                while(race.tokens.new > 0){
                    race.tokens.t++;
                    race.tokens.new--;
                }

                race.vp++;
                return STATS_MOVES.pass({G, playerID, events});
            }
        }
        else if(ctx.phase === 'agenda'){
            if(!ctx.activePlayers){
                //let err = AGENDA_MOVES.pass({G, playerID, events});
                //console.log('bot pass', playerID, err);
                //G.passedPlayers.push(playerID);

                const agendaNumber = G.vote2 ? 2:1;

                if(!G.races[playerID].voteResults || G.races[playerID].voteResults.length < agendaNumber){
                    if(!G.races[playerID].actions || G.races[playerID].actions.length < agendaNumber){
                        AGENDA_MOVES.pass({G, playerID, events});
                    }
                    else{
                        AGENDA_MOVES.vote({G, playerID, random, events, effects: plugins.effects}, {vote: 'pass', payment:{influence: []}});
                    }
                }
                else if(agendaNumber === 2){
                    AGENDA_MOVES.endVote({G, playerID, events});
                }
                
                //err = AGENDA_MOVES.endVote({G, playerID, events});
                //console.log('bot end vote', playerID, err);
            }
        }
        else{
            console.log('unknown phase:', ctx.phase);
            return events.endTurn();
        }
    }
    catch(e){
        console.log(e);
        return events.endTurn();
    }

}