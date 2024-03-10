import { LobbyClient } from 'boardgame.io/client';
import { useCallback, useState, useMemo, useEffect } from 'react';
import { Card, CardBody, CardTitle, CardFooter, CardText, Container, Row, Col, 
    Input, Button, FormFeedback, FormGroup, Label } from 'reactstrap';
import { produce } from 'immer';
import './scss/custom.scss';

export const Lobby = ()=> {

    const playerNames = useMemo(() => ['Alice', 'Bob', 'Cecil', 'David', 'Eva', 'Frank', 'Gregory', 'Heilen'], []);

    const [gameList, setGameList] = useState();
    const [prematchInfo, setPrematchInfo] = useState();
    const [prematchID, setPrematchID] = useState();
    const [playerCreds, setPlayerCreds] = useState();
    const [playerName, setPlayerName] = useState(playerNames[0]);
    
    const lobbyClient = useMemo(() => new LobbyClient({ server: 'http://localhost:8000' }), []);

    const refreshMatchList = useCallback(() => {
        lobbyClient.listMatches('prematch')
        .then(data => data.matches && setGameList(data.matches))
        .catch(console.error)
    }, [lobbyClient]);

    const newPrematch = useCallback(() => {
        setPrematchInfo({
            numPlayers: 2,
            setupData: {
                matchName: 'New Game',
                edition: 'PoK',
                map: 'random'
            }
        })
    }, []);

    const joinPrematch = useCallback(() => {
        lobbyClient.joinMatch('prematch', prematchID, {
            playerName: playerNames[0]
        })
        .then(data => {data.playerCredentials && setPlayerCreds(data.playerCredentials)})
        .catch(console.err);
    }, [prematchID, playerNames, lobbyClient]);

    const createPrematch = useCallback(() => {
        lobbyClient.createMatch('prematch', prematchInfo)
        .then(data => {data.matchID && setPrematchID(data.matchID)})
        .catch(console.err);
    }, [prematchInfo, lobbyClient]);

    const changeOption = useCallback((optName, input) => {
        setPrematchInfo(produce(prematchInfo, draft => {
            if(draft.setupData[optName] !== undefined){
                draft.setupData[optName] = input.value;
            }
        }));
    }, [prematchInfo]);

    useEffect(() => {
        if(prematchID){
            joinPrematch();
        }
    }, [prematchID, joinPrematch]);

    return <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', height: '100%', 
                        padding: '2rem', fontFamily:'Handel Gothic'}}>  
                {!playerCreds && <Card style={{flex: 'auto', maxWidth: '49%', padding: '2rem', border: 'solid 1px rgba(255,255,255,.25)'}}>
                    <CardTitle style={{display: 'flex'}}>
                        <h3 style={{flex: 'auto'}}>Macthes list</h3>
                        <Button className='bi-repeat' onClick={refreshMatchList}/>
                        <Button color='warning' onClick={newPrematch}>Create new</Button>
                    </CardTitle>
                    <CardBody style={{paddingTop: '5rem'}}>
                        <Container style={{overflowY: 'auto', fontSize: '90%'}}>
                            {gameList && [...gameList].reverse().map( (g, i) => 
                            <Row key={i}>
                                <Col xs='4'>{g.createdAt && (new Date(g.createdAt)).toLocaleString()}</Col>
                                <Col xs='7'>{g.setupData && g.setupData.matchName}</Col>
                                <Col xs='1'>{g.players && g.players.length}</Col>
                            </Row>
                            )}
                        </Container>
                    </CardBody>
                </Card>}
                {prematchInfo && <Card style={{flex: 'auto', overflowY: 'hidden', maxWidth: '49%', padding: '2rem', border: 'solid 1px rgba(255,255,255,.25)'}}>
                    <CardTitle>
                        {!playerCreds && <>
                            <Input valid placeholder={prematchInfo.setupData.matchName} onChange={(e) => changeOption('matchName', e.target)}/>
                            <FormFeedback valid>that name acceptable</FormFeedback>
                        </>}
                        {playerCreds && <h3>{prematchInfo.setupData.matchName}</h3>}
                    </CardTitle>
                    {!playerCreds && <CardBody>
                        <FormGroup>
                            <Input type='select' name='edition'><option>Prophecy of Kings</option></Input>
                        </FormGroup>
                        <FormGroup>
                            <Input type='select' name='map'><option>random map</option></Input>
                        </FormGroup>
                        <div style={{display: 'flex', marginTop: '2rem'}}>
                            Players:
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setPrematchInfo({...prematchInfo, numPlayers: 2})} name='numPlayers' id='numPlayers2' defaultChecked/><Label for='numPlayers2' check>2</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setPrematchInfo({...prematchInfo, numPlayers: 3})} name='numPlayers' id='numPlayers3'/><Label for='numPlayers3' check>3</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setPrematchInfo({...prematchInfo, numPlayers: 4})} name='numPlayers' id='numPlayers4' /><Label for='numPlayers4' check>4</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setPrematchInfo({...prematchInfo, numPlayers: 5})} name='numPlayers' id='numPlayers5' /><Label for='numPlayers5' check>5</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setPrematchInfo({...prematchInfo, numPlayers: 6})} name='numPlayers' id='numPlayers6' /><Label for='numPlayers6' check>6</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setPrematchInfo({...prematchInfo, numPlayers: 7})} name='numPlayers' id='numPlayers7' /><Label for='numPlayers7' check>7</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setPrematchInfo({...prematchInfo, numPlayers: 8})} name='numPlayers' id='numPlayers8' /><Label for='numPlayers8' check>8</Label>
                            </FormGroup>
                        </div>
                    </CardBody>}
                    {playerCreds && <CardBody>
                        <CardText>{prematchInfo.setupData.edition + ' / ' + prematchInfo.setupData.map
                                    + ' / ' + prematchInfo.numPlayers + ' players'}</CardText>
                    </CardBody>}
                    <CardFooter style={{display: 'flex', justifyContent: 'flex-end'}}>
                        {!playerCreds && <Button color='success' onClick={createPrematch}>Create match <b className='bi-forward-fill' ></b></Button>}
                    </CardFooter>
                </Card>}
                {playerCreds && <Card style={{flex: 'auto', overflowY: 'hidden', maxWidth: '49%', padding: '2rem', border: 'solid 1px rgba(255,255,255,.25)'}}>
                    
                </Card>}
            </div>;
}