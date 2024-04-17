

export const prematch = {
    name: 'prematch',
    validateSetupData: (setupData, numPlayers) => {
        if(!setupData){
            return 'setup data not valid';
        }
    },
    setup: ({ctx}, setupData) => {
        return {
            matchName: setupData.matchName,
            edition: setupData.edition,
            map: setupData.map
        }
    }
}


