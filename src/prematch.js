
export const prematch = {
    name: 'prematch',
    setup: ({ctx}, setupData) => {
        return {
            matchName: setupData.matchNames,
            edition: setupData.edition,
            map: setupData.map
        }
    }
}