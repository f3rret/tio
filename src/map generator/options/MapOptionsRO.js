import {CardTitle, CardBody, FormGroup, UncontrolledTooltip, Input, Label} from 'reactstrap';
import Markdown from 'react-markdown';
import { useContext } from 'react';
import { LocalizationContext } from '../../utils';


const MapOptionsRO = (props) => {
    const { t } = useContext(LocalizationContext);

    return (
        <>
            <CardTitle>
                <h3 className="text-center">{t('lobby.random_map_options')}</h3>
            </CardTitle>
            <CardBody>
                <FormGroup>
                    <Input disabled={true} type="checkbox" className="custom-control-input" id="pokExpansion" name="useProphecyOfKings" 
                        checked={props.useProphecyOfKings === undefined ? true:props.useProphecyOfKings} />
                    <Label style={{marginLeft: '.5rem'}} className="custom-control-label" for="pokExpansion">{t('lobby.use_pok')}</Label>
                </FormGroup>

                <FormGroup>
                    <Label for="boardStyle" className="d-flex">{t('lobby.board_style')}
                    <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="boardStyleHelp" />
                    </Label>
                    
                    <Input disabled={true} type='select' className="form-control" id="boardStyle" name="currentBoardStyle">
                        <option>{t('lobby.board_style_' + (props.currentBoardStyle || 'normal'))}</option>
                    </Input>
                </FormGroup>

                <FormGroup>
                    <Label for="placementStyle" className="d-flex">{t('lobby.placement_style')}
                        <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="placementStyleHelp" />
                    </Label>
                    <Input disabled={true} type='select' className="form-control" id="placementStyle" name="currentPlacementStyle" >
                        <option>{t('lobby.placement_style_' + (props.currentPlacementStyle || 'slice'))}</option>
                    </Input>
                </FormGroup>

                <FormGroup>
                    <Label for="pickStyle" className="d-flex">{t('lobby.system_weighting')}
                        <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="systemWeightingHelp" />
                    </Label>
                    <Input disabled={true} type='select' className="form-control" id="pickStyle" name="currentPickStyle">
                        <option>{t('lobby.system_weighting_' + (props.currentPickStyle || 'balanced'))}</option>
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
                    <Label style={{marginLeft: '.5rem'}} className="custom-control-label" for="ensureRacialAnomalies">{t('lobby.ensure_racial_anomalies')}</Label>
                    <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="ensureAnomaliesHelp" />
                </FormGroup>

                <FormGroup>
                    <Input disabled={true} type="checkbox" className="custom-control-input" id="shuffleBoards" name="shuffleBoards" checked={props.shuffleBoards} />
                    <Label style={{marginLeft: '.5rem'}} className="custom-control-label" for="shuffleBoards">{t('lobby.randomize_priorities')}</Label>
                    <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="shuffleBoardsHelp" />
                </FormGroup>

                <FormGroup>
                    <Input disabled={true} type="checkbox" className="custom-control-input" id="reversePlacementOrder" name="reversePlacementOrder" checked={props.reversePlacementOrder}/>
                    <Label style={{marginLeft: '.5rem'}} className="custom-control-label" for="reversePlacementOrder">{t('lobby.reverse_placement_order')}</Label>
                    <b style={{marginLeft: '.5rem'}} className="bi-question-circle" id="reversePlacementHelp" />
                </FormGroup>

                <UncontrolledTooltip target="boardStyleHelp" placement="right" trigger="hover">
                        <span style={{color: 'white', textAlign: 'justify'}}>
                        <Markdown>{t('lobby.board_style_help')}</Markdown>
                        </span>
                </UncontrolledTooltip>
                <UncontrolledTooltip target="placementStyleHelp" placement="right" trigger="hover">
                        <span style={{color: 'white', textAlign: 'justify', width: '40rem'}}>
                        <Markdown>{t('lobby.placement_style_help')}</Markdown>
                        </span>
                </UncontrolledTooltip>
                
                <UncontrolledTooltip target="systemWeightingHelp" placement="right" trigger="hover">
                        <span style={{color: 'white', textAlign: 'justify'}}>
                        <Markdown>{t('lobby.system_weighting_help')}</Markdown>
                        </span>
                </UncontrolledTooltip>
                <UncontrolledTooltip target="ensureAnomaliesHelp" placement="right" trigger="hover">
                        <span style={{color: 'white', textAlign: 'justify'}}>
                        <Markdown>{t('lobby.ensure_anomalies_help')}</Markdown>
                        </span>
                </UncontrolledTooltip>
                <UncontrolledTooltip target="shuffleBoardsHelp" placement="right" trigger="hover">
                    <span style={{color: 'white', textAlign: 'justify'}}>
                        <Markdown>{t('lobby.randomize_priorities_help')}</Markdown>
                        </span>
                </UncontrolledTooltip>
                <UncontrolledTooltip target="reversePlacementHelp" placement="right" trigger="hover">
                    <span style={{color: 'white', textAlign: 'justify'}}>
                        <Markdown>{t('lobby.reverse_placement_help')}</Markdown>
                        </span>
                </UncontrolledTooltip>
                
            </CardBody>
        </>
    );
}


export default MapOptionsRO;