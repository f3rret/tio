import { STATS_MOVES, STRAT_MOVES, ACTS_MOVES } from "./gameStages";
import cardData from './cardData.json';
import { neighbors } from "./Grid";

export const botMove = ({G, ctx, events, random, plugins}) => {

    try{
        const race = G.races[ctx.currentPlayer];

        if(race && race.isBot){
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
                    STRAT_MOVES.pickStrategy({ G, playerID: ctx.currentPlayer, events }, strats[rand-1]);
                }
            }
            else if(ctx.phase === 'acts'){
                if(!ctx.activePlayers){
                    if(race.tokens.t > 0){
                        const ownTiles = getMyTiles(G, ctx.currentPlayer);
                        console.log('ownTiles', ownTiles.length)
                        if(ownTiles && ownTiles.length){
                            let neigh = [];
                            let neigh2src = {};

                            //find most attractive tile to capture
                            ownTiles.forEach(tile => {
                                if(tile.tdata && !tile.tdata.tokens.includes(race.rid) && hasCarAndInf(tile)){//only for those which have carriers & inf
                                    const n = neighbors(G.HexGrid, [tile.q, tile.r]).map(n => n.tileId);
                                    n.forEach(nn => neigh2src[nn] = tile.tid); //remember src tile
                                    neigh.push(...n);
                                }
                            });

                            neigh.filter((n, i) => neigh.indexOf(n) === i); //unique
                            console.log('neigh', neigh)
                            console.log('neigh2src', neigh2src)

                            if(neigh.length){
                                let neighTiles = neigh.map(n => G.tiles.find(t => t.tid === n));

                                //not own anyone and with planet
                                neighTiles = neighTiles.filter( n => n.tdata && n.tdata.occupied === undefined && 
                                    !n.tdata.tokens.includes(race.rid) && n.tdata.planets && 
                                    n.tdata.planets.find(p => p.occupied === undefined)); 
                                const pref = getPreferredTile(neighTiles);
                                console.log('pref', pref.tid)
                                if(pref){
                                    const prefIdx = G.tiles.findIndex(t => t.tid === pref.tid);
                                    const err = ACTS_MOVES.activateTile({ G, playerID: ctx.currentPlayer, events, ctx }, prefIdx);
                                    if(!err){
                                        const srcIdx = G.tiles.findIndex(t => t.tid === neigh2src[pref.tid]);
                                        ACTS_MOVES.moveShip({ G, playerID: ctx.currentPlayer, events, ctx }, {tile: srcIdx, path: [neigh2src[pref.tid], pref.tid], unit: 'carrier', shipIdx: 0});
                                        return events.endTurn();
                                    }
                                }
                                else{
                                    return events.endTurn();
                                }
                            }
                            else{
                                return events.endTurn();
                            }
                        }

                    }
                    else{
                        return ACTS_MOVES.pass({ G, playerID: ctx.currentPlayer, events, ctx });
                    }
                }
            }
            else if(ctx.phase === 'stats'){
                if(!ctx.activePlayers){
                    return STATS_MOVES.pass({ G, playerID: ctx.currentPlayer, events, ctx });
                }
            }
            else{
                console.log('unknown phase:', ctx.phase);
                return events.endTurn();
            }
        }
    }
    catch(e){
        console.log(e);
        return events.endTurn();
    }
   
}


const getMyTiles = (G, playerID) => {
    
    return G.tiles.filter(t => 
        String(t.tdata.occupied) === String(playerID)
    )

}

const getPreferredTile = (tiles) => {

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

/*export const BotPlugin = (config) => {
    const plugin = {
        name: 'bot',
        setup: () => {},
        api: ({ data, game }) => {

            const api = {
                move: ({G, ctx, events}) => {
                    console.log('bot make move for ', ctx.currentPlayer);
                    STRAT_MOVES.pickStrategy({ G, playerID: ctx.currentPlayer, events }, 'LEADERSHIP');
                    //const newG = game.processMove({ctx, G}, {playerID, type: fn, args})
                    //return newG;
                }
            };
            return api;
        },
        //flush: ({ data }) => {
        //    return data;
        //},
        /*fnWrap: (fn, fnType) => ({ G, ...rest }, ...args) => {
            try{
                const { ctx, events } = rest;
                //G = preprocess(G);
                G = fn({ G, ...rest }, ...args);
                //if (fnType === GameMethod.TURN_ON_END) {
                // only run when wrapping a turn’s onEnd function
                //}
                //G = postprocess(G);
                if(G.races[ctx.currentPlayer].isBot && fnType === 'TURN_ON_BEGIN'){
                    if(ctx.phase === 'strat'){
                        //G = bot.move({ctx, G, playerID: ctx.currentPlayer}, 'pickStrategy', ['LEADERSHIP'])
                        console.log('try to move')
                        const newG = Object.assign({}, G);
                        STRAT_MOVES.pickStrategy({ G: newG, playerID: ctx.currentPlayer, events }, 'LEADERSHIP');
                    }
                }
                return G;
            }
            catch(e){
                console.log(e);
                return G;
            }
        },
        noClient: ({ G, ctx, game, data, api }) => true,
    };
    return plugin;
};*/