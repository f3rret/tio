
import { LocalizationContext } from "./utils";
import { EffectsBoardWrapper, useEffectListener } from './effects/react';
import { useEffect, useMemo, useRef, useContext } from "react";

/////////////////client side/////////////////////////////////


function BotTIOBoard ({ ctx, G, moves, undo, playerID, sendChatMessage, chatMessages, events }) {

    //const G_stringify = useMemo(() => JSON.stringify(G), [G]);
    //const G_tiles_stringify = useMemo(() => JSON.stringify(G.tiles), [G]);
    const G_races_stringify = useMemo(() => JSON.stringify(G.races), [G]);
    //const ctx_stringify = useMemo(() => JSON.stringify(ctx), [ctx]);

    //eslint-disable-next-line
    const race = useMemo(() => G.races[playerID], [G_races_stringify, playerID]);
    //const isMyTurn = useMemo(() => ctx.currentPlayer === playerID, [ctx.currentPlayer, playerID]);
    //eslint-disable-next-line
    //const neighbors = useMemo(() => getMyNeighbors(G, playerID), [G_tiles_stringify]);
    //const prevStages = useRef(null);
    const { t } = useContext(LocalizationContext);
    //const random = useMemo(() => (new Random()).api(), []);

    /*const PLANETS = useMemo(()=> {
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
    }, [G_tiles_stringify, playerID]);*/

    //const PLANETS_stringify = useMemo(() => JSON.stringify(PLANETS), [PLANETS]);

    /*useEffect(() => {

        
//eslint-disable-next-line
    }, [isMyTurn, ctx.phase])*/

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

    useEffect(() => {
        if(ctx.activePlayers && ctx.activePlayers[playerID]){
            if(ctx.activePlayers[playerID] === 'strategyCard'){
                console.log('bot stage move');
                moves.botStageMove();
            }
        }
    //eslint-disable-next-line
    }, [ctx.activePlayers])

    //const MY_LAST_EFFECT = useRef('');
    
    useEffectListener('*', ()=>{}, [], (effectName, effectProps, boardProps) => {
        commonEffectListener({playerID, /*neighbors,*/ ctx, G, effectName, effectProps, boardProps, /*MY_LAST_EFFECT,*/ sendChatMessage, /*hud, dispatch,*/ t})
    //eslint-disable-next-line
    }, [G]);
  
}

export const BotBoardWithEffects = EffectsBoardWrapper(BotTIOBoard, {
    /*updateStateAfterEffects: true,
    speed: 1*/
});

export const commonEffectListener = ({playerID, neighbors, /*MY_LAST_EFFECT,*/ ctx, G, hud, dispatch, sendChatMessage, t,
    effectName, effectProps, boardProps}) => {

    try{
        const race = G.races[playerID];

        if(effectName === 'rift'){
            const {pid, unit, dices} = effectProps;

            if(String(playerID) === String(pid)){
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
                //if(MY_LAST_EFFECT.current !== id){
                sendChatMessage(t('cards.relics.' + id + '.label'));
                //MY_LAST_EFFECT.current = id;
                //}
            }
        }
        else if(effectName === 'promissory'){
            const {src, dst, id} = effectProps;

            if(String(src) === String(playerID)){
                //if(MY_LAST_EFFECT.current !== id){
                sendChatMessage(t('cards.promissory.' + id + '.label') + ' ' + t('races.' + G.races[dst].rid + '.name') + ' ' + t('board.complete'));
                //MY_LAST_EFFECT.current = id;
                //}
            }
        }
        else if(effectName === 'planet' && String(effectProps.playerID) === String(playerID)){
            //if(effectProps.unid && !EFFECTS_QUEUE.includes(effectProps.unid)){
                sendChatMessage(t('board.has_occupied_planet') + ' ' + t('planets.' + effectProps.pname));
            //}
        }

    }
    catch(e){console.log(e)}
        
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

/*

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
/*class Random {
    /**
     * constructor
     * @param {object} ctx - The ctx object to initialize from.
     *
    constructor(state) {
        // If we are on the client, the seed is not present.
        // Just use a temporary seed to execute the move without
        // crashing it. The move state itself is discarded,
        // so the actual value doesn't matter.
        this.state = state || { seed: Date.now().toString(36).slice(-10) };
        this.used = false;
    }
    /**
     * Generates a new seed from the current date / time.
     *
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
     *
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
             *
            ...predefined,
            /**
             * Roll a die of specified spot value.
             *
             * @param {number} spotvalue - The die dimension (default: 6).
             * @param {number} diceCount - number of dice to throw.
             *                             if not defined, defaults to 1 and returns the value directly.
             *                             if defined, returns an array containing the random dice values.
             *
            Die,
            /**
             * Generate a random number between 0 and 1.
             *
            Number: () => {
                return random();
            },
            /**
             * Shuffle an array.
             *
             * @param {Array} deck - The array to shuffle. Does not mutate
             *                       the input, but returns the shuffled array.
             *
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
*/