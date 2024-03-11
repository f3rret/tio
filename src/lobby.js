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
    const [playerID, setPlayerID] = useState();
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

    const getPrematch = useCallback(() => {
        lobbyClient.getMatch('prematch', prematchID)
        .then(data => {
            data.setupData && setPrematchInfo(data);
        })
        .catch(console.err);
    }, [lobbyClient, prematchID]);

    const joinPrematch = useCallback(() => {
        lobbyClient.joinMatch('prematch', prematchID, {
            playerName: playerNames[0]
        })
        .then(data => {
            data.playerCredentials && setPlayerCreds(data.playerCredentials);
            data.playerID !== undefined && setPlayerID(data.playerID)})
        .catch(console.err);
    }, [prematchID, playerNames, lobbyClient]);

    const leavePrematch = useCallback(() => {
        lobbyClient.leaveMatch('prematch', prematchID, {
            playerID, 
            credentials: playerCreds 
        })
        .then(() => {
            setPlayerID(null); 
            setPlayerCreds(null)})
        .catch(console.err)
    }, [prematchID, playerID, playerCreds, lobbyClient]);

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

    const rowClick = useCallback((mid) => {
        if(mid){
            if(mid !== prematchID){
                setPrematchID(mid);
            }
            else{
                setPrematchID(null);
            }
        }
    }, [prematchID]);

    useEffect(() => {
        if(prematchID){
            getPrematch();
        }
        else{
            setPrematchInfo(null);
        }
    }, [prematchID, joinPrematch, getPrematch]);

    useEffect(() => {
        refreshMatchList();
        // eslint-disable-next-line
    }, []);

    return <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', height: '100%', 
                        padding: '2rem', fontFamily:'Handel Gothic'}}>  
                {!playerCreds && <Card style={{flex: 'auto', maxWidth: '49%', padding: '2rem', border: 'solid 1px rgba(255,255,255,.25)'}}>
                    <CardTitle style={{display: 'flex'}}>
                        <h3 style={{flex: 'auto'}}>Macthes list</h3>
                        <Button className='bi-repeat' onClick={refreshMatchList}/>
                        <Button color='warning' onClick={newPrematch}>Create new</Button>
                    </CardTitle>
                    <CardBody style={{paddingTop: '5rem', overflowY: 'auto'}}>
                        <Container style={{fontSize: '80%'}}>
                            {gameList && [...gameList].reverse().map( (g, i) => 
                            <Row key={i} matchid={g.matchID} className={'hoverable ' + (prematchID && prematchID === g.matchID ? 'selectedMatch': '')} 
                                style={{padding: '.25rem 0', borderRadius: '0'}} onClick={() => rowClick(g.matchID)}>
                                <Col xs='4' style={{paddingRight: 0}}>{g.createdAt && (new Date(g.createdAt)).toLocaleString()}</Col>
                                <Col xs='3'>{g.setupData && g.setupData.matchName}</Col>
                                <Col xs='1'>{g.setupData && g.setupData.edition}</Col>
                                <Col xs='2'>{g.setupData && g.setupData.map}</Col>
                                <Col xs='2'>{g.players && g.players.filter(p => p.name).length + ' / ' + g.players.length}</Col>
                            </Row>
                            )}
                        </Container>
                    </CardBody>
                </Card>}
                {prematchInfo && <Card style={{flex: 'auto', overflowY: 'hidden', maxWidth: '49%', padding: '2rem', border: 'solid 1px rgba(255,255,255,.25)'}}>
                    <CardTitle>
                        {!playerCreds && !prematchInfo.players && <>
                            <Input valid placeholder={prematchInfo.setupData.matchName} onChange={(e) => changeOption('matchName', e.target)}/>
                            <FormFeedback valid>that name acceptable</FormFeedback>
                        </>}
                        {(playerCreds || prematchInfo.players) && <h3>{prematchInfo.setupData.matchName}</h3>}
                    </CardTitle>
                    {!playerCreds && !prematchInfo.players && <CardBody>
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
                    {(playerCreds || prematchInfo.players) && <CardBody>
                        <CardText>{prematchInfo.setupData.edition + ' / ' + prematchInfo.setupData.map
                                    + ' / ' + prematchInfo.players.length + ' players'}</CardText>
                    </CardBody>}
                    <CardFooter style={{display: 'flex', justifyContent: 'flex-end'}}>
                        {!playerCreds && !prematchInfo.players && <Button color='success' onClick={createPrematch}>Create match <b className='bi-forward-fill' ></b></Button>}
                        {playerCreds && <Button color='danger' onClick={leavePrematch}>Leave match <b className='bi-backward-fill' ></b></Button>}
                    </CardFooter>
                </Card>}
                {playerCreds && <Card style={{flex: 'auto', overflowY: 'hidden', maxWidth: '49%', padding: '2rem', border: 'solid 1px rgba(255,255,255,.25)'}}>
                    
                </Card>}
            </div>;
}