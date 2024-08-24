import { produce } from 'immer';

export const credsReducer = (state, action) => {

    switch(action.type){
        case 'connect': case 'reconnect': {
            return {
                playerID: action.playerID,
                matchID: action.matchID,
                credentials: action.playerCreds,
                ready: action.playerID !== null && action.matchID !== null && action.playerCreds !== null
            }
        }
        default: {
            console.log('unknown action ', action);
        }
    }

}

export const hudReducer = (hudDraft, action) => {

    switch(action.type){
        case 'with_agent': {
            hudDraft.withAgent = !hudDraft.withAgent;
            break;
        }
        case 'ability': {
            if(action.tag === 'pillage'){
                if(action.add && action.playerID){
                    if(!hudDraft.abilityData.pillage){ hudDraft.abilityData.pillage = [] }
                    if(!hudDraft.abilityData.pillage.includes(action.playerID)){ hudDraft.abilityData.pillage.push(action.playerID) }
                }
                else if(action.del && action.playerID){
                    if(hudDraft.abilityData.pillage){ 
                        hudDraft.abilityData.pillage = hudDraft.abilityData.pillage.filter(a => String(a) !== String(action.playerID)) 
                    }
                    if(!hudDraft.abilityData.pillage || hudDraft.abilityData.pillage.length === 0){
                        hudDraft.rightBottomSubVisible = null;
                    }
                }
            }

            break;
        }
        /*case 'chat_msg': {
            if(action.tag && action.tag === 'pillage' && action.sender !== undefined){//mentak pillage
                if(!hudDraft.abilityData.pillage){
                    hudDraft.abilityData.pillage = [];
                }
                if(!hudDraft.abilityData.pillage.includes(action.sender)) hudDraft.abilityData.pillage.push(action.sender)
            }
            break;
        }*/
        case 'global_payment': {
            if(action.payload && action.payload.planet && action.payload.type){
                const planet = action.payload.planet;
                const type = action.payload.type;

                if(type !== 'cancel'){
                    if(!hudDraft.globalPayment.influence.includes(planet.name) && 
                        !hudDraft.globalPayment.resources.includes(planet.name) && 
                        !hudDraft.globalPayment.propulsion.includes(planet.name) && 
                        !hudDraft.globalPayment.biotic.includes(planet.name) && 
                        !hudDraft.globalPayment.cybernetic.includes(planet.name) && 
                        !hudDraft.globalPayment.warfare.includes(planet.name) &&
                        !planet.exhausted){
                        hudDraft.globalPayment = produce(hudDraft.globalPayment, draft => {
                            draft[type].push(planet.name);
                        });
                    }
                }
                else if(type === 'cancel'){
                    const pname = action.payload.planet;
                    if(hudDraft.globalPayment.influence.includes(pname) || hudDraft.globalPayment.resources.includes(pname) ||
                        hudDraft.globalPayment.propulsion.includes(pname)|| hudDraft.globalPayment.biotic.includes(pname) ||
                        hudDraft.globalPayment.cybernetic.includes(pname) || hudDraft.globalPayment.warfare.includes(pname)){
                        hudDraft.globalPayment = produce(hudDraft.globalPayment, draft => {
                            draft.influence = draft.influence.filter(p => p !== pname);
                            draft.resources = draft.resources.filter(p => p !== pname);
                            draft.propulsion = draft.propulsion.filter(p => p !== pname);
                            draft.biotic = draft.biotic.filter(p => p !== pname);
                            draft.cybernetic = draft.cybernetic.filter(p => p !== pname);
                            draft.warfare = draft.warfare.filter(p => p !== pname);
                        });
                    }
                }
                
            }
            else if(action.payload && action.payload.tg){
                hudDraft.globalPayment = produce(hudDraft.globalPayment, draft => {
                    draft.tg += action.payload.tg;
                    if(action.payload.tgMultiplier !== undefined){
                        draft.tgMultiplier = action.payload.tgMultiplier;
                    }
                });
            }
            else if(action.payload && action.payload.cancel){
                hudDraft.globalPayment = produce(hudDraft.globalPayment, draft => {
                    draft[action.payload.cancel] = [];
                })
            }
            else if(action.payload && action.payload.wipe){
                hudDraft.globalPayment = { influence: [], resources: [], tg: 0, token: { s:0, t:0 }, fragment: {h:0, i:0, c:0, u:0}, propulsion: [], biotic: [], cybernetic: [], warfare: [] }
                //phase changed
                hudDraft.abilityData = {}
            }
            
            break;
        }
        case 'planets_change' : {
            if(action.payload.planets){
                action.payload.planets.forEach(planet => {
                    if(planet.exhausted){
                        const pname = planet.name;
                        if(hudDraft.globalPayment.influence.includes(pname) || hudDraft.globalPayment.resources.includes(pname) || 
                        hudDraft.globalPayment.propulsion.includes(pname) || hudDraft.globalPayment.biotic.includes(pname) ||
                        hudDraft.globalPayment.cybernetic.includes(pname) || hudDraft.globalPayment.warfare.includes(pname)){
                            hudDraft.globalPayment = produce(hudDraft.globalPayment, draft => {
                                draft.influence = draft.influence.filter(p => p !== pname);
                                draft.resources = draft.resources.filter(p => p !== pname);
                                draft.propulsion = draft.propulsion.filter(p => p !== pname);
                                draft.biotic = draft.biotic.filter(p => p !== pname);
                                draft.cybernetic = draft.cybernetic.filter(p => p !== pname);
                                draft.warfare = draft.warfare.filter(p => p !== pname);
                            });
                        }
                    }
                });
            }
            break;
        }
        case 'pay_obj':{
            hudDraft.payObj = action.payload;
            break;
        }
        case 'just_occupied': {
            hudDraft.justOccupied = action.payload;
            break;
        }
        case 'temp_ct': {
            hudDraft.tempCt = action.payload;
            break;
        }
        case 'move_steps': {
            const index = action.payload;

            if(index){
                hudDraft.moveSteps = (produce(hudDraft.moveSteps, draft => {
                    const idx = draft.indexOf(index);
            
                    if(idx === -1){
                        draft.push(index);
                    }
                    else{
                        draft.splice(idx, 1);
                    }
              }));
            }
            else{
                hudDraft.moveSteps = [];
            }

            break;
        }
        case 'selected_tech': {
            hudDraft.selectedTech = action.payload;
            break;
        }
        case 'selected_planet': {
            hudDraft.selectedPlanet = action.payload;
            break;
        }
        case 'selected_tile': {
            if(hudDraft.groundUnitSelected && hudDraft.groundUnitSelected.unit){
                hudDraft.groundUnitSelected = {};
            }

            hudDraft.selectedPlanet = (action.planetIndex === undefined ? -1 : action.planetIndex);
            hudDraft.selectedTile = action.payload;
            break;
        }
        case 'right_bottom_sub_visible': {
            hudDraft.rightBottomSubVisible = action.payload;
            break;
        }
        case 'right_bottom_visible': {
            hudDraft.rightBottomVisible = action.payload;
            break;
        }
        case 'subcard_visible': {
            hudDraft.subcardVisible = action.payload;
            break;
        }
        case 'payload_cursor': {
            hudDraft.payloadCursor = action.payload;
            break;
        }
        case 'ground_unit_selected': {
            hudDraft.groundUnitSelected = action.payload;
            break;
        }
        case 'adv_unit_view': {
            hudDraft.advUnitView = action.payload;
            break;
        }
        case 'left_panel': {
            hudDraft.leftPanel = action.payload;
            break;
        }
        case 'producing': {
            hudDraft.producing = action.planet;
            break;
        }
        case 'exhaust_card': {
            if(action.cardId === 'INTEGRATED_ECONOMY'){
                if(!hudDraft.exhaustedCards.includes(action.cardId)){
                  if(action.planet && !hudDraft.producing){
                    hudDraft.producing = action.planet;
                  }
                }
                else{
                    hudDraft.producing = null;
                }
            }
            else if(action.cardId === 'SLING_RELAY'){
                if(!hudDraft.producing){
                    hudDraft.producing = action.planet;
                }
                else{
                    hudDraft.producing = null;
                }
            }

            hudDraft.exhaustedCards = produce(hudDraft.exhaustedCards, draft => {
                const idx = draft.indexOf(action.cardId)
                if( idx > -1){
                  draft.splice(idx, 1);
                }
                else{
                  draft.push(action.cardId);
                }
            });

            if(['BIO_STIMS', 'SCANLINK_DRONE_NETWORK', 'INFANTRY2'].includes(action.cardId)){
                hudDraft.rightBottomSubVisible(hudDraft.exhaustedCards.includes(action.cardId) ? null:action.cardId);
            }

            if(action.cardId === 'The Codex'){
                if(hudDraft.exhaustedCards.includes(action.cardId)){
                    hudDraft.rightBottomVisible = 'discardedActions'
                }
                else{
                    hudDraft.rightBottomVisible = 'relics'
                }
            }

            break;
        }
        case 'flush_exhausted_cards': {
            hudDraft.exhaustedCards = [];
            break;
        }
        default: {
            console.log('unknown action ', action);
        }
    }

}