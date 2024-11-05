
import cardData from './cardData.json';
import { neighbors as gridNeighbors} from "./Grid";
import { LocalizationContext } from "./utils";
import { EffectsBoardWrapper, useEffectListener } from 'bgio-effects/react';
import { useEffect, useMemo, useRef, useContext } from "react";
import { getUnitsTechnologies, getMyNeighbors } from './utils'; 


function BotTIOBoard ({ ctx, G, moves, undo, playerID, sendChatMessage, chatMessages, events }) {

    const G_stringify = useMemo(() => JSON.stringify(G), [G]);
    const G_tiles_stringify = useMemo(() => JSON.stringify(G.tiles), [G]);
    const G_races_stringify = useMemo(() => JSON.stringify(G.races), [G]);
    //const ctx_stringify = useMemo(() => JSON.stringify(ctx), [ctx]);

    //eslint-disable-next-line
    const race = useMemo(() => G.races[playerID], [G_races_stringify, playerID]);
    const isMyTurn = useMemo(() => ctx.currentPlayer === playerID, [ctx.currentPlayer, playerID]);
    //eslint-disable-next-line
    const neighbors = useMemo(() => getMyNeighbors(G, playerID), [G_tiles_stringify]);
    //const prevStages = useRef(null);
    const { t } = useContext(LocalizationContext);
    const random = useMemo(() => (new Random()).api(), []);

    const PLANETS = useMemo(()=> {
        const arr = [];

        G.tiles.forEach( t => {
            if(t.tdata.planets && t.tdata.planets.length){
                t.tdata.planets.forEach((p, pidx) => {
                    if(String(p.occupied) === String(playerID)){
                    arr.push({...p, tid: t.tid, pidx});
                    }
                })
            }
        });

        return arr;
    //eslint-disable-next-line
    }, [G_tiles_stringify, playerID]);

    const PLANETS_stringify = useMemo(() => JSON.stringify(PLANETS), [PLANETS]);

    useEffect(() => {

        try{
            if(isMyTurn && race && race.isBot){

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
                        moves.pickStrategy(strats[rand-1]);
                    }
                }
                else if(ctx.phase === 'acts'){
                    if(!ctx.activePlayers){
                        if(race.tokens.t > 0){
                            const ownTiles = getMyTiles(G, ctx.currentPlayer);
 
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
                                    let neighTiles = neigh.map(n => G.tiles.find(t => t.tid === n));
    
                                    //not own anyone and with planet
                                    neighTiles = neighTiles.filter( n => n.tdata && n.tdata.occupied === undefined && 
                                        !n.tdata.tokens.includes(race.rid) && n.tdata.planets && 
                                        n.tdata.planets.find(p => p.occupied === undefined));
                              
                                    const pref = getPreferredTile(neighTiles);

                                    if(pref){
                                        const prefIdx = G.tiles.findIndex(t => t.tid === pref.tid);
                                        const srcIdx = G.tiles.findIndex(t => t.tid === neigh2src[pref.tid]);
                                        moves.bot_loadAndMoveCarrier({prefIdx, srcIdx, neigh2src});
                                    }
                                    
                                    return events.endTurn();
                                }
                                else{
                                    return events.endTurn();
                                }
                            }
    
                        }
                        else{
                            return moves.pass();
                        }
                    }
                }
                else if(ctx.phase === 'stats'){
                    if(!ctx.activePlayers){
                        return moves.pass();
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
//eslint-disable-next-line
    }, [isMyTurn])

    const PREV_TECHNODATA = useRef([]); //todo: replace with bgio-effects
    useEffect(() => {

        if(race.tempTechnoData && race.tempTechnoData.length && race.tempTechnoData.length > PREV_TECHNODATA.current.length){
        const last = race.tempTechnoData.slice(PREV_TECHNODATA.current.length - race.tempTechnoData.length);
        const summary = {INFANTRY2: []};
        last.forEach(l => {
            if(Object.keys(summary).includes(l.id)){
            if(l.id === 'INFANTRY2'){
                if(l.success){
                summary[l.id].push('/dice-green ' + (l.dice === 10 ? 0:l.dice));
                }
                else{
                summary[l.id].push('/dice ' + (l.dice === 10 ? 0:l.dice));
                }
            }
            }
        });
        
        Object.keys(summary).forEach(k => {
            if(k === 'INFANTRY2' && summary['INFANTRY2'].length > 0){
            sendChatMessage(t('cards.techno.INFANTRY2.label') + '   ' + summary['INFANTRY2'].join('  '));
            }
        });

        }
        PREV_TECHNODATA.current = race.tempTechnoData;
    // eslint-disable-next-line
    }, [race.tempTechnoData])

    const PREV_EXPLORATION = useRef([]);//todo: replace with bgio-effects

    useEffect(()=>{
        if(race.exploration && race.exploration.length && race.exploration.length > PREV_EXPLORATION.current.length){
        PREV_EXPLORATION.current = race.exploration;
        sendChatMessage(t('board.got_new_exploration') + ' ' 
        + t('cards.exploration.' + race.exploration[race.exploration.length-1].id + '.label').toUpperCase() + ' ('
        + t('cards.exploration.' + race.exploration[race.exploration.length-1].id + '.effect') + ')');
        }
        // eslint-disable-next-line
    }, [race.exploration]);

    const PREV_RELICS = useRef([]);//todo: replace with bgio-effects

    useEffect(()=>{
        if(race.relics && race.relics.length && race.relics.length > PREV_RELICS.current.length){
        PREV_RELICS.current = race.relics;
        sendChatMessage(t('board.got_new_relic') + ': ' 
        + t('cards.relics.' + race.relics[race.relics.length-1].id + '.label').toUpperCase() + ' ('
        + t('cards.relics.' + race.relics[race.relics.length-1].id + '.effect'));
        }
        // eslint-disable-next-line
    }, [race.relics]);
    
    const PREV_PLANETS = useRef([]);//todo: replace with bgio-effects

    useEffect(()=>{  //occupied new planet
        if(PLANETS && PLANETS.length){
            if(!PREV_PLANETS.current || !PREV_PLANETS.current.length){
                //PREV_PLANETS.current = PLANETS;
            }
            else{
                if(PLANETS.length - PREV_PLANETS.current.length === 1){ //why 1?
                const newOne = PLANETS.find(p => {
                    const oldOne = PREV_PLANETS.current.find(pp => pp.name === p.name);
                    return !oldOne;
                });
                if(newOne){
                    //dispatch({type: 'just_occupied', payload: newOne.name});
                    sendChatMessage(t('board.has_occupied_planet') + ' ' + t('planets.' + newOne.name));
                    if(newOne.exploration === 'Freelancers'){
                // dispatch({type: 'producing', planet: newOne.name});
                    }
                }
                }
            }
            PREV_PLANETS.current = PLANETS;
        }
    console.log(PREV_PLANETS)
    //eslint-disable-next-line
    }, [PLANETS_stringify]);

    const MY_LAST_EFFECT = useRef('');
    useEffectListener('*', (...effectListenerProps) => 
        commonEffectListener({playerID, neighbors, ctx, G, ...effectListenerProps, MY_LAST_EFFECT, sendChatMessage, /*hud, dispatch,*/ t}), [G_stringify, playerID, neighbors]);
  
}

export const BotBoardWithEffects = EffectsBoardWrapper(BotTIOBoard, {

});

/*export const botMove = ({G, ctx, events, random, plugins}) => {

    
   
}*/

export const commonEffectListener = ({playerID, neighbors, MY_LAST_EFFECT, ctx, G, hud, dispatch, sendChatMessage, t,
    effectName, effectProps, boardProps}) => { //! may doubled!!

    try{
        const race = G.races[playerID];

        if(effectName === 'rift'){
            if(String(playerID) === String(ctx.currentPlayer)){
                const {unit, dices} = effectProps;
                let rolls = '';
                dices.forEach(d => {
                if(d > 3){
                    rolls += ' /dice-green ' + d;
                }
                else{
                    rolls += ' /dice ' + d;
                }
                });
                sendChatMessage(t('board.gravity_rift').toUpperCase() + ' ' + t('cards.techno.' + unit.toUpperCase() + '.label').toLowerCase() + ' ' + rolls);
            }
        }
        else if(effectName === 'tg'){
            if(boardProps.G && boardProps.G.races){
                boardProps.G.races.forEach((nr, pid) => {

                if(String(pid) === String(playerID)){//mine
                    if(G.races[pid].tg < nr.tg){
                    sendChatMessage('/gain-tg ' + (nr.tg - G.races[pid].tg))
                    }
                }
                else{
                    if(race.rid === 2 && neighbors && neighbors.length > 0 && neighbors.includes(String(pid))){ //mentak pillage
                    if(G.races[pid].tg < nr.tg){
                        if(dispatch) dispatch({ type: 'ability', tag: 'pillage', add: true, playerID: pid })
                    }
                    }
                }

                })
            }
        }
        else if(effectName === 'trade'){
            const {src, dst, obj} = effectProps;
            let pid = G.races.findIndex((r) => r.rid === src);

            if(String(pid) === String(playerID)){
                let subj = '';
                Object.keys(obj).forEach(tradeItem => {
                const count = obj[tradeItem];
                subj += tradeItem === 'commodity' ? (count + ' ' + t('board.commodity')) : tradeItem === 'tg' ? (count + ' ' + t('board.trade_good')) : 
                tradeItem === 'fragment.c' ? (count + ' ' + t('board.cultural') + ' ' + t('board.fragment')) :
                tradeItem === 'fragment.h' ? (count + ' ' + t('board.hazardous') + ' ' + t('board.fragment')) :
                tradeItem === 'fragment.i' ? (count + ' ' + t('board.industrial') + ' ' + t('board.fragment')) :
                tradeItem === 'fragment.u' ? (count + ' ' + t('board.unknown') + ' ' + t('board.fragment')) :
                
                tradeItem.indexOf('action') === 0 ? t('cards.actions.' + tradeItem.substr(tradeItem.indexOf('.') + 1) + '.label'):
                tradeItem.indexOf('promissory') === 0 ? t('cards.promissory.' + tradeItem.substr(tradeItem.indexOf('.') + 1) + '.label'):
                tradeItem.substr(tradeItem.indexOf('.') + 1) 
                })
                sendChatMessage('/trade ' + t('races.' + dst + '.name') + ': ' + subj)
            }

            if(race.rid === 2 && hud){ //mentak
                if(pid > -1 && src !== 2 && (!hud.abilityData.pillage || !hud.abilityData.pillage.includes(src))){
                if(neighbors && neighbors.length > 0 && neighbors.includes(String(pid))){
                    if(dispatch) dispatch({type: 'ability', tag: 'pillage', add: true, playerID: pid})
                }
                }
        
                pid = G.races.findIndex((r) => r.rid === dst);
                if(pid > -1 && dst !== 2 && (!hud.abilityData.pillage || !hud.abilityData.pillage.includes(dst))){
                if(neighbors && neighbors.length > 0 && neighbors.includes(String(pid))){
                    if(dispatch) dispatch({type: 'ability', tag: 'pillage', add: true, playerID: pid})
                }
                }
            }
        }
        else if(effectName === 'relic_ex'){
            const {id, pid} = effectProps;
        
            if((pid !== undefined && String(playerID) === String(pid)) || (pid === undefined && String(playerID) === String(ctx.currentPlayer))){
                if(MY_LAST_EFFECT.current !== id){
                sendChatMessage(t('cards.relics.' + id + '.label'));
                MY_LAST_EFFECT.current = id;
                }
            }
        }
        else if(effectName === 'promissory'){
            const {src, dst, id} = effectProps;

            if(String(src) === String(playerID)){
                if(MY_LAST_EFFECT.current !== id){
                sendChatMessage(t('cards.promissory.' + id + '.label') + ' ' + t('races.' + G.races[dst].rid + '.name') + ' ' + t('board.complete'));
                MY_LAST_EFFECT.current = id;
                }
            }
        }

    }
    catch(e){console.log(e)}
        
}

const getMyTiles = (G, playerID) => {
    
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




export const getPayloadedCarrier = (tile) => {

    if(!tile.tdata) return;
    if(!tile.tdata.fleet || !tile.tdata.fleet.carrier) return;

    const fleet = tile.tdata.fleet;
    const loadedInf = fleet.carrier.findIndex(car => car.payload && car.payload.length && car.payload.find(p => p && p.id === 'infantry'));

    if(loadedInf > -1) return loadedInf;

}

export const payloadCarrier = ({G, playerID, tileIdx, tag, max}) => {

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
        if(p.units[tag] && car.payload.length < technologies['carrier'].capacity){
            while(car.payload.filter(p => p && p.id === tag).length < max && p.units[tag].length){
                const unit = {...p.units[tag].pop(), id: tag};
                car.payload.push(unit);
            }
            if(!p.units[tag].length) delete p.units[tag];
        }
    });

    return 0;

}

export const getLandingForce = (tile) => {

    if(!tile.tdata) return;
    if(!tile.tdata.fleet || !tile.tdata.fleet.carrier) return;

    const fleet = tile.tdata.fleet;
    const i = fleet.carrier.findIndex(car => car.payload && car.payload.length && car.payload.find(p => p && p.id === 'infantry'));
    
    if(i > -1){
        const j = fleet.carrier[i].payload.findIndex(p => p && p.id === 'infantry');
        if(j > -1) return {unit: 'carrier', i, j};
    }

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








class Alea {
    constructor(seed) {
        const mash = Mash();
        // Apply the seeding algorithm from Baagoe.
        this.c = 1;
        this.s0 = mash(' ');
        this.s1 = mash(' ');
        this.s2 = mash(' ');
        this.s0 -= mash(seed);
        if (this.s0 < 0) {
            this.s0 += 1;
        }
        this.s1 -= mash(seed);
        if (this.s1 < 0) {
            this.s1 += 1;
        }
        this.s2 -= mash(seed);
        if (this.s2 < 0) {
            this.s2 += 1;
        }
    }
    next() {
        const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10; // 2^-32
        this.s0 = this.s1;
        this.s1 = this.s2;
        return (this.s2 = t - (this.c = Math.trunc(t)));
    }
}
function Mash() {
    let n = 0xefc8249d;
    const mash = function (data) {
        const str = data.toString();
        for (let i = 0; i < str.length; i++) {
            n += str.charCodeAt(i);
            let h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 0x100000000; // 2^32
        }
        return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
    };
    return mash;
}
function copy(f, t) {
    t.c = f.c;
    t.s0 = f.s0;
    t.s1 = f.s1;
    t.s2 = f.s2;
    return t;
}
function alea(seed, state) {
    const xg = new Alea(seed);
    const prng = xg.next.bind(xg);
    if (state)
        copy(state, xg);
    prng.state = () => copy(xg, {});
    return prng;
}

/*
 * Copyright 2017 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
/**
 * Random
 *
 * Calls that require a pseudorandom number generator.
 * Uses a seed from ctx, and also persists the PRNG
 * state in ctx so that moves can stay pure.
 */
class Random {
    /**
     * constructor
     * @param {object} ctx - The ctx object to initialize from.
     */
    constructor(state) {
        // If we are on the client, the seed is not present.
        // Just use a temporary seed to execute the move without
        // crashing it. The move state itself is discarded,
        // so the actual value doesn't matter.
        this.state = state || { seed: '0' };
        this.used = false;
    }
    /**
     * Generates a new seed from the current date / time.
     */
    static seed() {
        return Date.now().toString(36).slice(-10);
    }
    isUsed() {
        return this.used;
    }
    getState() {
        return this.state;
    }
    /**
     * Generate a random number.
     */
    _random() {
        this.used = true;
        const R = this.state;
        const seed = R.prngstate ? '' : R.seed;
        const rand = alea(seed, R.prngstate);
        const number = rand();
        this.state = {
            ...R,
            prngstate: rand.state(),
        };
        return number;
    }
    api() {
        const random = this._random.bind(this);
        const SpotValue = {
            D4: 4,
            D6: 6,
            D8: 8,
            D10: 10,
            D12: 12,
            D20: 20,
        };
        // Generate functions for predefined dice values D4 - D20.
        const predefined = {};
        for (const key in SpotValue) {
            const spotvalue = SpotValue[key];
            predefined[key] = (diceCount) => {
                return diceCount === undefined
                    ? Math.floor(random() * spotvalue) + 1
                    : Array.from({ length: diceCount }).map(() => Math.floor(random() * spotvalue) + 1);
            };
        }
        function Die(spotvalue = 6, diceCount) {
            return diceCount === undefined
                ? Math.floor(random() * spotvalue) + 1
                : Array.from({ length: diceCount }).map(() => Math.floor(random() * spotvalue) + 1);
        }
        return {
            /**
             * Similar to Die below, but with fixed spot values.
             * Supports passing a diceCount
             *    if not defined, defaults to 1 and returns the value directly.
             *    if defined, returns an array containing the random dice values.
             *
             * D4: (diceCount) => value
             * D6: (diceCount) => value
             * D8: (diceCount) => value
             * D10: (diceCount) => value
             * D12: (diceCount) => value
             * D20: (diceCount) => value
             */
            ...predefined,
            /**
             * Roll a die of specified spot value.
             *
             * @param {number} spotvalue - The die dimension (default: 6).
             * @param {number} diceCount - number of dice to throw.
             *                             if not defined, defaults to 1 and returns the value directly.
             *                             if defined, returns an array containing the random dice values.
             */
            Die,
            /**
             * Generate a random number between 0 and 1.
             */
            Number: () => {
                return random();
            },
            /**
             * Shuffle an array.
             *
             * @param {Array} deck - The array to shuffle. Does not mutate
             *                       the input, but returns the shuffled array.
             */
            Shuffle: (deck) => {
                const clone = [...deck];
                let sourceIndex = deck.length;
                let destinationIndex = 0;
                const shuffled = Array.from({ length: sourceIndex });
                while (sourceIndex) {
                    const randomIndex = Math.trunc(sourceIndex * random());
                    shuffled[destinationIndex++] = clone[randomIndex];
                    clone[randomIndex] = clone[--sourceIndex];
                }
                return shuffled;
            },
            _private: this,
        };
    }
}