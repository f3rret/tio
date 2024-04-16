import {CardTitle, CardBody, FormGroup, UncontrolledTooltip, Input, Label} from 'reactstrap';


const MapOptionsRO = (props) => {
    const capitalize = (str) => {
        if(str) return str.charAt(0).toUpperCase() + str.slice(1);
    }
    return (
        <>
            <CardTitle>
                <h3 className="text-center">Random map options</h3>
            </CardTitle>
            <CardBody>
                <FormGroup>
                    <Input disabled={true} type="checkbox" className="custom-control-input" id="pokExpansion" name="useProphecyOfKings" 
                        checked={props.useProphecyOfKings === undefined ? true:props.useProphecyOfKings} />
                    <Label style={{marginLeft: '.5rem'}} className="custom-control-label" for="pokExpansion">Use Prophecy of Kings Expansion</Label>
                </FormGroup>

                <FormGroup>
                    <Label for="boardStyle" className="d-flex">Board Style
                    <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="boardStyleHelp" />
                    </Label>
                    
                    <Input disabled={true} type='select' className="form-control" id="boardStyle" name="currentBoardStyle">
                        <option>{capitalize(props.currentBoardStyle) || 'Normal'}</option>)
                    </Input>
                </FormGroup>

                <FormGroup>
                    <Label for="placementStyle" className="d-flex">Placement Style
                        <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="placementStyleHelp" />
                    </Label>
                    <Input disabled={true} type='select' className="form-control" id="placementStyle" name="currentPlacementStyle" >
                        <option>{capitalize(props.currentPlacementStyle) || 'Slice'}</option>)
                    </Input>
                </FormGroup>

                <FormGroup>
                    <Label for="pickStyle" className="d-flex">System Weighting
                        <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="systemWeightingHelp" />
                    </Label>
                    <Input disabled={true} type='select' className="form-control" id="pickStyle" name="currentPickStyle">
                        {<option>{capitalize(props.currentPickStyle) || 'Balanced'}</option>}
                    </Input>
                </FormGroup>

                <FormGroup className={"ml-2 collapse " + (props.currentPickStyle === "custom" ? "show" : "")} id="customPickStyle">
                    <div className="card card-body">
                        <label htmlFor="customResource">Resource</label>
                        <input type="range" className="custom-range" name="resourceWeight" value={props.resourceWeight} />

                        <label htmlFor="customInfluence">Influence</label>
                        <input type="range" className="custom-range" name="influenceWeight" value={props.influenceWeight}  />

                        <label htmlFor="customPlanetCount">Planet Count</label>
                        <input type="range" className="custom-range" name="planetCountWeight" value={props.planetCountWeight} />

                        <label htmlFor="customSpecialty">Specialty</label>
                        <input type="range" className="custom-range" name="specialtyWeight" value={props.specialtyWeight} />

                        <label htmlFor="customAnomaly">Anomaly</label>
                        <input type="range" className="custom-range" name="anomalyWeight" value={props.anomalyWeight} />

                        <label htmlFor="customWormhole">Wormhole</label>
                        <input type="range" className="custom-range" name="wormholeWeight" value={props.wormholeWeight} />
                    </div>
                </FormGroup>

                <FormGroup>
                    <Input disabled={true} type="checkbox" className="custom-control-input" id="ensureRacialAnomalies" name="ensureRacialAnomalies" 
                        checked={props.ensureRacialAnomalies === undefined ? true:props.ensureRacialAnomalies} />
                    <Label style={{marginLeft: '.5rem'}} className="custom-control-label" for="ensureRacialAnomalies">Ensure Racial Anomalies</Label>
                    <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="ensureAnomaliesHelp" />
                </FormGroup>

                <FormGroup>
                    <Input disabled={true} type="checkbox" className="custom-control-input" id="shuffleBoards" name="shuffleBoards" checked={props.shuffleBoards} />
                    <Label style={{marginLeft: '.5rem'}} className="custom-control-label" for="shuffleBoards">Randomize Priorities Before Placement</Label>
                    <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="shuffleBoardsHelp" />
                </FormGroup>

                <FormGroup>
                    <Input disabled={true} type="checkbox" className="custom-control-input" id="reversePlacementOrder" name="reversePlacementOrder" checked={props.reversePlacementOrder}/>
                    <Label style={{marginLeft: '.5rem'}} className="custom-control-label" for="reversePlacementOrder">Reverse Placement Order</Label>
                    <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="reversePlacementHelp" />
                </FormGroup>

                <UncontrolledTooltip target="boardStyleHelp" placement="right" trigger="hover">
                     <p style={{color: 'white', textAlign: 'justify'}}>
                     Board style changes how the tiles are actually laid out on a newly generated map.<br/><br/>
                     Changing this would cause you to expect different hex layouts, such as different patterns of tiles, usage of hyperlanes, or unorthodox placement of home worlds.
                     </p>
                </UncontrolledTooltip>
                <UncontrolledTooltip target="placementStyleHelp" placement="right" trigger="hover">
                     <p style={{color: 'white', textAlign: 'justify'}}>
                     Placement style dictates where important tiles are placed. Most revolve around having at least one tile near the home system with good resources.
                     <br/>
                     <br/>
                     <br/><b>Slice:</b> Places tiles like a normal player would. Prioritizes a good pathway to mecatol, and filling in the area around the home system with good tiles.
                     <br/><b>Initial:</b> Only guarantees a good tile right in front of the home system (on the way to mecatol). Everything else is random.
                     <br/><b>Home:</b> Prioritizes all of the adjacent tiles to the home system and everything else is random.
                     <br/><b>Random:</b> Shuffles the priority levels completely. No favoritism to tiles near the home system.
                     </p>
                </UncontrolledTooltip>
                <UncontrolledTooltip target="ensureAnomaliesHelp" placement="right" trigger="hover">
                     <p style={{color: 'white', textAlign: 'justify'}}>
                     Ensures that races get their beneficial anomalies
                     <br/>
                     <br/>
                     This option makes it so that Muaat will always receive a supernova, Saar will always receive an asteroid field, Empyrean will always receive a nebulae and Vuil'Raith will always receive a gravity rift.
                     </p>
                </UncontrolledTooltip>
                <UncontrolledTooltip target="systemWeightingHelp" placement="right" trigger="hover">
                     <p style={{color: 'white', textAlign: 'justify'}}>
                     Pick Style is used to determine how tiles are weighted for when they are placed on the board. A higher weighted tile means that the hex is more important, and so (depending on the placement style) it is put closer to home worlds to facilitate available assets.
                     <br/>
                     <br/><b>Balanced:</b> A custom weight which favors resources and planet count more than anomalies. This more accurately factors in tech specialties and influence as trade-offs to the "Resource" pick.
                     <br/><b>Resource:</b> Tiles are ordered primarily by their resource values. Higher resource planets are more coveted, and so are more important.
                     <br/><b>Influence:</b> Similar to "Resource", tiles are ordered primarily by their influence values.
                     <br/><b>Random:</b> Tiles are completely randomly ordered. Expect chaotic and unbalanced maps.
                     <br/><b>Custom:</b> Enter your own values in for balancing tradeoffs between various tile qualities.
                     </p>
                </UncontrolledTooltip>
                <UncontrolledTooltip target="shuffleBoardsHelp" placement="right" trigger="hover">
                     <p style={{color: 'white', textAlign: 'justify'}}>
                     Randomizes the priority picks for each picking round.
                     <br/>
                     <br/>
                     Normally when placing tiles, this tool attempts to place the tiles so player 1 does not always get the best tiles. To do this, it follows the game setup rules and (in a 6 player game) player 1 gets to place tile 1 and 12, while player 6 gets to place tile 6 and 7.
                     <br/>
                     <br/>
                     Turning this on stops this from happening, and instead completely randomizes the placement order.
                     </p>
                </UncontrolledTooltip>
                <UncontrolledTooltip target="reversePlacementHelp" placement="right" trigger="hover">
                     <p style={{color: 'white', textAlign: 'justify'}}>
                     Reverses which tiles are placed first in placement order.
                     <br/>
                     <br/>
                     Tiles are normally placed in priority (see randomize priority help). This reverses the order, so that the last picks are first, which generally has the effect of pushing the more valuable tiles towards the center of the galaxy.
                     </p>
                </UncontrolledTooltip>
                
            </CardBody>
        </>
    );
}

export default MapOptionsRO;