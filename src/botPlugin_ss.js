
import cardData from './cardData.json';
import { neighbors as gridNeighbors} from "./Grid";
import { getUnitsTechnologies } from './utils'; 
import { ACTS_MOVES, STATS_MOVES, STRAT_MOVES } from './gameStages';
//import { current } from 'immer';


///////////////server side///////////////////////////////////


const doProduction = ({G, ctx, playerID, plugins, events}) => {

    let prefIdx;
    const preferredBaseTile = G.tiles.find((tile, idx) => { //find spacedock closest to mecatol
        if(tile.tdata && tile.tdata.planets && (tile.active || !tile.tdata.tokens.includes(G.races[playerID].rid))){
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

    const deploy={carrier: 1, infantry: 2, fighter: 2};
    const payment = {resources: [], influence: []};
    ACTS_MOVES.producing({G, playerID, ctx, events}, preferredBasePlanet.name, deploy, payment/*, exhaustedCards*/);

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



export const botMove = ({G, ctx, random, events, ...plugins}) => {

    try{
        const playerID = ctx.currentPlayer;
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
                            else{
                                if(!doProduction({G, ctx, playerID, events, plugins})){
                                    return ACTS_MOVES.pass({G, playerID, events, ctx});
                                }
                            }
                        }
                        else{
                            if(!doProduction({G, ctx, playerID, events, plugins})){
                                return ACTS_MOVES.pass({G, playerID, events, ctx});
                            }
                        }

                        return events.endTurn();
                    }

                }
                else{
                    return ACTS_MOVES.pass({G, playerID, events, ctx});
                }
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