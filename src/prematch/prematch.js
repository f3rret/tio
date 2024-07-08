

export const prematch = {
    name: 'prematch',
    validateSetupData: (setupData, numPlayers) => {
        if(!setupData){
            return 'setup data not valid';
        }
        if(!(setupData.matchName && setupData.matchName.length > 0 && setupData.matchName.length < 51)){
            return 'match name not valid';
        }
    },
    setup: ({ctx}, setupData) => {
        return {
            matchName: setupData.matchName.replace(/[^a-zA-Zа-яА-Я0-9 ]/g, ''),
            edition: setupData.edition,
            map: setupData.map,
            vp: setupData.vp
        }
    }
}


