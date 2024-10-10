import { STRAT_MOVES } from "./gameStages";


export const botMove = ({G, ctx, events, plugins}) => {

    const race = G.races[ctx.currentPlayer];
    if(race && race.isBot){

      STRAT_MOVES.pickStrategy({ G, playerID: ctx.currentPlayer, events }, 'LEADERSHIP');

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