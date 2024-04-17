import { LobbyClient } from 'boardgame.io/client';
import { useCallback, useState, useMemo, useEffect } from 'react';
import { Card, CardBody, CardTitle, CardFooter, CardText, Container, Row, Col, 
    Input, Button, FormFeedback, FormGroup, Label } from 'reactstrap';
import { produce } from 'immer';
import MapOptions from './map generator/options/MapOptions';
import MapOptionsRO from './map generator/options/MapOptionsRO';
import raceData from './map generator/data/raceData.json';
import { App } from './App';
import { PrematchApp } from './prematch/prematchApp';
import './scss/custom.scss';

let interval = null;

export const Lobby = ()=> {

    const playerNames = useMemo(() => ['Alice', 'Bob', 'Cecil', 'David', 'Eva', 'Frank', 'Gregory', 'Heilen'], []);
    const colors = useMemo(() => ['red', 'green', 'blue', 'yellow', 'gray', 'pink', 'orange', 'violet'], []);
    const races = useMemo(() => [...raceData.races, ...raceData.pokRaces], []);

    const [gameList, setGameList] = useState();
    const [prematchInfo, setPrematchInfo] = useState();
    const [prematchID, setPrematchID] = useState();
    const [playerCreds, setPlayerCreds] = useState();
    const [playerID, setPlayerID] = useState();
    const [playerName, setPlayerName] = useState();
    const [matchID, setMatchID] = useState();
    //const [playerName, setPlayerName] = useState(playerNames[0]);
    
    const lobbyClient = useMemo(() => new LobbyClient({ server: 'http://localhost:8000' }), []);

    const iAmReady = useMemo(() => {
        if(!playerID) return false;
        if(playerID === '0') return false;
        if(!prematchInfo) return false;
        if(!prematchInfo.players || !prematchInfo.players.length) return false;
        if(!prematchInfo.players[playerID]) return false;

        return prematchInfo.players[playerID].data && prematchInfo.players[playerID].data.ready;
    }, [prematchInfo, playerID]);

    const refreshMatchList = useCallback(() => {
        lobbyClient.listMatches('prematch')
        .then(data => data.matches && setGameList(data.matches))
        .catch(console.error)
    }, [lobbyClient]);

    const newPrematch = useCallback(() => {
        clearInterval(interval);

        setPrematchInfo({
            numPlayers: 2,
            setupData: {
                matchName: 'New Game',
                edition: 'PoK',
                map: 'random'
            }
        });

        setPrematchID(null);
    }, []);

    const getPrematch = useCallback(() => {
        lobbyClient.getMatch('prematch', prematchID)
        .then(data => {
            if(data.setupData){
                setPrematchInfo(data);
            }
        })
        .catch(console.err);
    }, [lobbyClient, prematchID]);

    const joinPrematch = useCallback((param) => {
        let nameId = 0;
 
        if(prematchInfo && prematchInfo.players && prematchInfo.players.length){
            nameId = prematchInfo.players.findIndex(p => !p.name);
        }

        lobbyClient.joinMatch('prematch', param || prematchID, {
            playerName: playerName || playerNames[nameId],
            playerID: '' + nameId,
            data: {ready: false}
        })
        .then(data => {
            data.playerCredentials && setPlayerCreds(data.playerCredentials);
            if(data.playerID !== undefined){
                setPlayerID(data.playerID);
                setPlayerName(playerNames[nameId]);
            }
        })
        .catch(console.err);
    }, [prematchID, prematchInfo, playerNames, lobbyClient, playerName]);

    const leavePrematch = useCallback(() => {
        lobbyClient.leaveMatch('prematch', prematchID, {
            playerID, 
            credentials: playerCreds 
        })
        .then(() => {
            /*setPlayerID(null); 
            setPlayerCreds(null)*/
            setPrematchID(null);
            setPrematchInfo(null);
            refreshMatchList();
        })
        .catch(console.err)
    }, [prematchID, playerID, playerCreds, lobbyClient, refreshMatchList]);

    const createPrematch = useCallback(() => {
        lobbyClient.createMatch('prematch', prematchInfo)
        .then(data => {
            if(data.matchID) {
                setPrematchID(data.matchID);
                joinPrematch(data.matchID);
                refreshMatchList();
            }
        })
        .catch(console.err);
    }, [prematchInfo, lobbyClient, refreshMatchList, joinPrematch]);

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

    const readyToPlay = useCallback(() => {
        lobbyClient.updatePlayer('prematch', prematchID, {
            playerID: playerID,
            credentials: playerCreds,
            data: {
                ready: true
            }
        })
        .then(data => {
            console.log(data);
        })
        .catch(console.err);
    }, [lobbyClient, playerID, playerCreds, prematchID]);

    const joinMatch = useCallback((mid) => {

        lobbyClient.joinMatch('TIO', mid, {
            playerName,
            playerID
        })
        .then(data => {
            if(prematchInfo.players[playerID] && prematchInfo.players[0].data){ //set signal that I already start the game
                const prevData = prematchInfo.players[playerID].data;
            
                lobbyClient.updatePlayer('prematch', prematchID, {
                    playerID: playerID,
                    credentials: playerCreds,
                    data: {
                        ...prevData,
                        matchID: mid
                    }
                })
                .then(resp => {
                    
                })
                .catch(console.err);
            }
            data.playerCredentials && setPlayerCreds(data.playerCredentials); //change creds from prematch to match 
        })
        .catch(console.err);

    }, [lobbyClient, prematchInfo, playerID, playerCreds, prematchID, playerName]);

    const runGame = useCallback((tiles) => {
        
        lobbyClient.createMatch('TIO', {numPlayers: prematchInfo.players.filter(p => p.name).length, 
            setupData: {...prematchInfo.setupData, mapArray: tiles}})
        .then(data => {
            if(data.matchID) {
                clearInterval(interval);
                setMatchID(data.matchID);

                if(prematchInfo.players[playerID].data.matchID !== data.matchID){
                    joinMatch(data.matchID);
                }
            }
        })
        .catch(console.err);
    }, [lobbyClient, prematchInfo, playerID, joinMatch]);


    const updateMapOptionsCallback = useCallback((payload) => {
        let prevData = {};
        let mapOptions = {};

        if(prematchInfo.players[playerID] && prematchInfo.players[0].data){
            prevData = prematchInfo.players[playerID].data;
        }

        if(prevData.mapOptions){
            mapOptions = prevData.mapOptions;
        }

        mapOptions = {...mapOptions, ...payload};

        lobbyClient.updatePlayer('prematch', prematchID, {
            playerID: playerID,
            credentials: playerCreds,
            data: {
                ...prevData,
                mapOptions
            }
        })
        .then(data => {
            if(data === undefined){ //for rapid change local copy of this data
                setPrematchInfo(produce(prematchInfo, draft => {
                    draft.players[playerID].data = {...prevData, mapOptions}
                }));
            }
        })
        .catch(console.err);
    }, [playerID, prematchID, lobbyClient, playerCreds, prematchInfo]);

    useEffect(() => {
        if(!matchID && prematchInfo && prematchInfo.players && prematchInfo.players.length){
            if(prematchInfo.players[playerID] && prematchInfo.players[playerID].data && !prematchInfo.players[playerID].data.matchID){
                const cp = prematchInfo.players.find(p => p.name && p.data && p.data.matchID);
                if(cp){
                    clearInterval(interval);
                    setMatchID(cp.data.matchID);

                    if(prematchInfo.players[playerID].data.matchID !== cp.data.matchID){
                        joinMatch(cp.data.matchID);
                    }
                }
            }
        }
    }, [prematchInfo, matchID, playerID, joinMatch])

    useEffect(() => {
        if(matchID){
            clearInterval(interval);
        }
    }, [matchID]);

    useEffect(() => {
        if(prematchID){
            getPrematch();
            clearInterval(interval);
            interval = setInterval(() => getPrematch(), 3000);
        }
        else{
            //setPrematchInfo(null);
            setPlayerID(null); 
            setPlayerCreds(null);
            if(interval) clearInterval(interval);
        }
    }, [prematchID, getPrematch]);

    useEffect(() => {
        clearInterval(interval);
        refreshMatchList();
        // eslint-disable-next-line
    }, []);

    return <>
            {playerID && matchID && playerCreds && <App playerID={playerID} matchID={matchID} credentials={playerCreds}/>}
            {(!playerID || !matchID || !playerCreds) && <div id='lobbyMain' style={{display: 'flex', justifyContent: 'space-between', width: '100%', height: '100%', 
                        padding: '2rem', fontFamily:'Handel Gothic'}}>  
                {(!playerCreds || !prematchID) && <Card style={{flex: 'auto', maxWidth: '49%', padding: '2rem', border: 'solid 1px rgba(255,255,255,.25)'}}>
                    <CardTitle style={{display: 'flex'}}>
                        <h3 style={{flex: 'auto'}}>Macthes list</h3>
                        <Button className='bi-repeat' style={{backgroundColor: 'transparent', marginRight: '.25rem'}} onClick={refreshMatchList}/>
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
                        {(playerCreds || prematchInfo.players) && <h3 className="text-center">{prematchInfo.setupData.matchName}</h3>}
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
                    <CardBody style={{display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
                        <div>
                            {prematchInfo.players && <CardText style={{marginBottom: '3rem'}}>{prematchInfo.setupData.edition + ' / ' + prematchInfo.setupData.map
                                        + ' map / ' + prematchInfo.players.length + ' players'}</CardText>}
                            {prematchInfo.players && 
                            <Container>{prematchInfo.players.map((p, i) => 
                            <Row key={i} style={{marginTop: '.25rem', minHeight: '2.5rem'}}>
                                <Col xs='1' style={{padding: 0}}><div style={{backgroundColor: colors[i], width: '2rem', height: '2rem', borderRadius: '50%'}}></div></Col>
                                {p.name && p.isConnected && <Col xs='4' style={{alignSelf: 'center', color: p.data && p.data.ready ? 'lime' : 'none'}}>{p.name}</Col>}
                                {p.name && !p.isConnected && <Col xs='4' style={{alignSelf: 'center', color: 'yellow'}}>{'[ connecting... ]'}</Col>}
                                {!p.name && <Col xs='4' style={{alignSelf: 'center'}}>{'[ open ]'}</Col>}
                                {p.name && <Col xs='7' style={{color: p.data && p.data.ready ? 'lime' : 'none'}}>
                                    {String(playerID) === String(p.id) && <Input style={{color: 'inherit'}} disabled={p.data && p.data.ready} type='select'>
                                        <option>random race</option>
                                    </Input>}
                                    {String(playerID) !== String(p.id) && <div style={{alignSelf: 'center', padding: '0.5rem 0rem 0.5rem .75rem'}}>random race</div>}
                                </Col>}
                                {!p.name && <Col xs='7' style={{alignSelf: 'center', padding: '0.5rem 0rem 0.5rem 1.5rem'}}></Col>}
                            </Row>)}
                            </Container>}
                        </div>
                        {playerCreds && <PrematchApp playerID={playerID} matchID={prematchID} credentials={playerCreds}/>}
                    </CardBody>
                    <CardFooter style={{display: 'flex', justifyContent: 'space-between'}}>
                        {!playerCreds && !prematchInfo.players && <Button color='success' onClick={createPrematch}>Create game <b className='bi-caret-right-square-fill' ></b></Button>}
                        {!playerCreds && !playerID && prematchInfo && prematchInfo.players && 
                            <Button color='success' disabled={!prematchInfo.players.find(p => !p || !p.name)} onClick={()=>joinPrematch()}>Join game <b className='bi-caret-right-square-fill' ></b></Button>}
                        {playerCreds && <Button color='danger' onClick={leavePrematch}><b className='bi-caret-left-square-fill' ></b> Leave</Button>}
                        {playerID && playerID !== '0' && !iAmReady && <Button color='success' onClick={readyToPlay}>Ready to play <b className='bi-check-square-fill' ></b></Button>}
                    </CardFooter>
                </Card>}
                {playerCreds && prematchInfo && prematchInfo.players && <Card style={{flex: 'auto', overflowY: 'hidden', maxWidth: '49%', padding: '2rem', border: 'solid 1px rgba(255,255,255,.25)'}}>
                    {playerID === '0' && <MapOptions visible={true} useProphecyOfKings={true} currentRaces={races} excludedTiles={[]} includedTiles={[]} lockedTiles={[]}
                        numberOfPlayers={prematchInfo.players.length} updateTiles={runGame} updateRaces={()=>{}} toggleProphecyOfKings={()=>{}}
                        currentPlayerNames={[]} updatePlayerNames={()=>{}} playerID={playerID} updateMapOptionsCallback={updateMapOptionsCallback}/>}
                    {playerID && playerID !== '0' && prematchInfo.players[0] && prematchInfo.players[0].data && 
                        <MapOptionsRO {...prematchInfo.players[0].data.mapOptions}/>}
                </Card>}
            </div>}
        </>;
}