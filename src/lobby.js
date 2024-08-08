import { LobbyClient } from 'boardgame.io/client';
import { useCallback, useState, useMemo, useEffect, useContext } from 'react';
import { Card, CardBody, CardTitle, CardFooter, CardText, Container, Row, Col, 
    Input, ButtonGroup, FormFeedback, FormGroup, Label } from 'reactstrap';
import { produce } from 'immer';
import { useCookies } from 'react-cookie';
import MapOptions from './map generator/options/MapOptions';
import MapOptionsRO from './map generator/options/MapOptionsRO';
import raceData from './map generator/data/raceData.json';
import settings from '../package.json'

import { PrematchApp } from './prematch/prematchApp';
import { LocalizationContext, shuffle } from './utils';
import { colors, trueColors } from './colors';
import useImagePreloader from './imgUtils.js';
import imgSrc from './imgsrc.json';
import { Blocks } from 'react-loader-spinner';

import './scss/custom.scss';

let interval = null;

export const Lobby = ({dispatch})=> {


    const { t, locale, setLocale } = useContext(LocalizationContext);
    const playerNames = useMemo(() => ['Alice', 'Bob', 'Cecil', 'David', 'Eva', 'Frank', 'Gregory', 'Heilen'], []);
    const races = useMemo(() => [...raceData.races, ...raceData.pokRaces], []);
    const sortedRacesList = useMemo(() =>
        races.map(r => {const idx = raceData.raceToHomeSystemMap[r]; return [idx, t('races.' + idx + '.name')]})
            .sort((a,b) => { if(a[1]>b[1]){return 1} else if(a[1]<b[1]){ return -1} else return 0; })
    , [races, t]);

    const [gameList, setGameList] = useState(null);
    const [prematchInfo, setPrematchInfo] = useState(null);
    const [prematchID, setPrematchID] = useState(null);
    const [playerCreds, setPlayerCreds] = useState(null);
    const [playerID, setPlayerID] = useState(null);
    const [playerName, setPlayerName] = useState(null);
    const [matchID, setMatchID] = useState(null);
    const [aboutVisible, setAboutVisible] = useState(false);
    const [autoJoinPrematch, setAutoJoinPrematch] = useState(false);
    const [cookie, setCookie] = useCookies(['matchID', 'playerID', 'playerCreds']);
    //const [playerName, setPlayerName] = useState(playerNames[0]);
    
    const lobbyClient = useMemo(() => new LobbyClient({ server: window.location.protocol + '//' + settings.ip + ':8000' }), []);
    const prematchInfoString = useMemo(() => {
        return JSON.stringify(prematchInfo);
    }, [prematchInfo]); //for optimization memo recalc

    /*const iAmReady = useMemo(() => {
        if(!playerID) return false;
        if(playerID === '0') return false;
        if(!prematchInfo) return false;
        if(!prematchInfo.players || !prematchInfo.players.length) return false;
        if(!prematchInfo.players[playerID]) return false;

        return prematchInfo.players[playerID].data && prematchInfo.players[playerID].data.ready;
    // eslint-disable-next-line
    }, [prematchInfoString, playerID]);*/

    const currentRaces = useMemo(() => {
        if(prematchInfo && prematchInfo.players && prematchInfo.players.length){
            let selectedRaces = prematchInfo.players.map(p => {
                if(p.data && p.data.race && p.data.race !== '0'){
                    return raceData.homeSystemToRaceMap[p.data.race];
                }
                else{
                    return '0';
                }
            });
            
            let unselectedRaces = shuffle(races.filter(r => !selectedRaces.includes(r)));
            selectedRaces = selectedRaces.map(r => {
                if(r === '0'){
                    return unselectedRaces.pop();
                }
                else{
                    return r;
                }
            });

            return selectedRaces;
        }
    // eslint-disable-next-line
    }, [prematchInfoString]);

    const matchNameIsValid = useMemo(() => {
        if(prematchInfo && prematchInfo.setupData && prematchInfo.setupData.matchName &&
            prematchInfo.setupData.matchName.length > 0 && prematchInfo.setupData.matchName.length < 51){
            
            if(!prematchInfo.setupData.matchName.match(/[^a-zA-Zа-яА-Я0-9 ]/g)){
                return true;
            }
            else{
                return false;
            }
        }
        else{
            return false;
        }}, [prematchInfo]);

    const refreshMatchList = useCallback(() => {
        lobbyClient.listMatches('prematch')
        .then(data => {
            let matches = [];

            if(data.matches){
                matches = [...data.matches];
            }

            lobbyClient.listMatches('TIO')
            .then(dt => {
                if(dt.matches){
                    matches = [...dt.matches, ...matches];
                }

                setGameList(matches.filter(m => m.players && m.players.length && m.players.find(p => p.isConnected)));
            })
            .catch(console.error)
        })
        .catch(console.error)
    }, [lobbyClient]);

    const newPrematch = useCallback(() => {
        clearInterval(interval);

        setPrematchInfo({
            numPlayers: 2,
            setupData: {
                matchName: t('lobby.new_game'),
                edition: 'PoK',
                map: 'random',
                colors,
                vp: 10
            },
            gameName: 'prematch'
        });

        setPrematchID(null);
    }, [t]);

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

        lobbyClient.joinMatch(prematchInfo.gameName, param || prematchID, {
            playerName: playerName || playerNames[nameId],
            playerID: '' + nameId,
            data: {ready: false, race: '0'}
        })
        .then(data => {
            data.playerCredentials && setPlayerCreds(data.playerCredentials);
            if(data.playerID !== undefined){
                setPlayerID(data.playerID);
                setPlayerName(playerNames[nameId]);

                setCookie('matchID', param || prematchID);
                setCookie('playerID', data.playerID);
                setCookie('playerCreds', data.playerCredentials);
                setCookie('playerName', playerName || playerNames[nameId]);
            }
        })
        .catch(console.err);
    // eslint-disable-next-line
    }, [prematchID, prematchInfoString, playerNames, lobbyClient, playerName, setCookie]);

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
                setAutoJoinPrematch(true);
                setPrematchID(data.matchID);
                joinPrematch(data.matchID);
                refreshMatchList();
            }
        })
        .catch(console.err);
    // eslint-disable-next-line
    }, [prematchInfoString, lobbyClient, refreshMatchList, joinPrematch]);

    const changeOption = useCallback((optName, input) => {
        let val = input.value;

        setPrematchInfo(produce(prematchInfo, draft => {
            if(draft.setupData[optName] !== undefined){
                draft.setupData[optName] = val;
            }
        }));
    // eslint-disable-next-line
    }, [prematchInfoString]);

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

    /*const readyToPlay = useCallback(() => {
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
    }, [lobbyClient, playerID, playerCreds, prematchID]);*/

    const updatePlayerInfo = useCallback((info) => {
        lobbyClient.updatePlayer('prematch', prematchID, {
            playerID: playerID,
            credentials: playerCreds,
            data: {...prematchInfo.players[playerID].data, ...info}
        })
        .then(data => {
            //console.log(data);
        })
        .catch(console.err);
    // eslint-disable-next-line
    }, [lobbyClient, playerID, playerCreds, prematchID, prematchInfoString]);

    const joinMatch = useCallback((mid) => {

        lobbyClient.joinMatch('TIO', mid, {
            playerName: playerName,
            playerID: playerID
        })
        .then(data => {
            if(prematchInfo.gameName === 'prematch'){
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

                setCookie('matchID', mid);
                setCookie('playerID', playerID);
                setCookie('playerCreds', data.playerCredentials);
                setCookie('playerName', playerName);

                /*args.setPlayerID(playerID);
                args.setMatchID(mid);
                args.setPlayerCreds(data.playerCredentials);*/
                dispatch({
                    type: 'connect',
                    playerID,
                    matchID: mid,
                    playerCreds: data.playerCredentials
                });
            }
        })
        .catch(console.err);
    // eslint-disable-next-line
    }, [lobbyClient, prematchInfoString, playerID, playerCreds, prematchID, playerName, setCookie]);

    const reconnect = useCallback(() => {
        setPlayerCreds(cookie.playerCreds);
        setPlayerID(String(cookie.playerID));
        setPlayerName(cookie.playerName);

        if(prematchInfo.gameName === 'TIO'){
            clearInterval(interval);
            setMatchID(prematchInfo.matchID);

            /*args.setPlayerID(String(cookie.playerID));
            args.setMatchID(prematchInfo.matchID);
            args.setPlayerCreds(cookie.playerCreds);*/
            dispatch({
                type: 'reconnect',
                playerID: String(cookie.playerID),
                matchID: prematchInfo.matchID,
                playerCreds: cookie.playerCreds
            });
        }
    // eslint-disable-next-line
    }, [cookie, prematchInfoString]);

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
    // eslint-disable-next-line
    }, [playerID, prematchID, lobbyClient, playerCreds, prematchInfoString]);

    useEffect(() => {
        if(!matchID && prematchInfo && prematchInfo.players && prematchInfo.players.length && prematchInfo.gameName === 'prematch'){
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

    useEffect(() => {
        let overlay = document.getElementById('tempOverlay');
        if(overlay){
          overlay.remove();
        }
    }, [])

    const { imagesPreloaded, lastLoaded, loadingError } = useImagePreloader(imgSrc.lobbyImages)

    if (!imagesPreloaded) {
      return <div style={{width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, backgroundColor: 'black', zIndex: 101, display: 'flex', justifyContent: 'center', alignItems: 'center', flexFlow: 'column'}}>
                
                <Blocks
                    height="80"
                    width="80"
                    color="#4fa94d"
                    ariaLabel="blocks-loading"
                    wrapperStyle={{}}
                    wrapperClass="blocks-wrapper"
                    visible={true}
                    />
                {!loadingError && <span style={{fontFamily: 'system-ui', color: 'antiquewhite'}}>{lastLoaded}</span>}
                {loadingError && <span style={{fontFamily: 'system-ui', color: 'red'}}>{'ошибка загрузки ' + loadingError}</span>}
            </div>
    }

    return <>
            {(!playerID || !matchID || !playerCreds) && <>
                <div id='topPanel' style={{width: '100%', padding: '3rem 3rem 0', display: 'flex', flexFlow: 'row-reverse'}}>
                    <ButtonGroup>
                        <button className={'styledButton ' + (locale === 'en' ? 'blue':'black')} onClick={() => setLocale('en')}>ENG</button>
                        <button className={'styledButton ' + (locale === 'ru' ? 'blue':'black')} onClick={() => setLocale('ru')}>РУС</button>
                    </ButtonGroup>
                </div>
                <div id='lobbyMain'>
                
                {(!playerCreds || !prematchID) && <Card className='borderedPanel' style={{flex: 'auto', margin: '4rem 0 5% 4rem', maxWidth: '42%', padding: '2rem'}}>
                    <CardTitle style={{display: 'flex'}}>
                        <h3 style={{flex: 'auto'}}>{t('lobby.matches_list_label')}</h3>
                        <button className='bi-repeat styledButton black' style={{marginRight: '.25rem'}} onClick={refreshMatchList}/>
                        <button className='styledButton yellow' onClick={newPrematch}>{t('lobby.create_new')}</button>
                    </CardTitle>
                    <CardBody style={{paddingTop: '5rem', overflowY: 'auto'}}>
                        <Container style={{fontSize: '80%'}}>
                            {gameList && [...gameList].reverse().map( (g, i) => 
                            <Row key={i} matchid={g.matchID} className={'hoverable ' + (prematchID && prematchID === g.matchID ? 'selectedMatch ': '') + g.gameName + 'Lobby'} 
                                style={{padding: '.25rem 0', borderRadius: '0'}} onClick={() => rowClick(g.matchID)}>
                                <Col xs='4' style={{paddingRight: 0}}>{g.createdAt && (new Date(g.createdAt)).toLocaleString()}</Col>
                                <Col xs='3'>{g.setupData && g.setupData.matchName}</Col>
                                <Col xs='1'>{g.setupData && t('lobby.edition_' + g.setupData.edition)}</Col>
                                <Col xs='2'>{g.setupData && t('lobby.map_type_' + g.setupData.map) + ' (' + g.setupData.vp + ')'}</Col>
                                <Col xs='2'>{g.players && g.players.filter(p => p.name).length + ' / ' + g.players.length}</Col>
                            </Row>
                            )}
                        </Container>
                    </CardBody>
                </Card>}
                {prematchInfo && <Card className='borderedPanel' style={{flex: 'auto', margin: '4rem 4rem 5%', overflowY: 'hidden', maxWidth: '42%', padding: '2rem'}}>
                    <CardTitle>
                        {!playerCreds && !prematchInfo.players && <>
                            <Input valid={matchNameIsValid} invalid={!matchNameIsValid} 
                                placeholder={prematchInfo.setupData.matchName} onChange={(e) => changeOption('matchName', e.target)}/>
                            {!matchNameIsValid && <FormFeedback>{t('lobby.name_inacceptable')}</FormFeedback>}
                        </>}
                        {(playerCreds || prematchInfo.players) && <div style={{display: 'flex', justifyContent: 'space-between'}}>
                            <h3 className="text-center">{prematchInfo.setupData.matchName}</h3>
                            {prematchInfo.players && <CardText>
                                {t('lobby.edition_' + prematchInfo.setupData.edition) + ' / ' + t('lobby.map_type_' + prematchInfo.setupData.map)
                                + ' / ' + prematchInfo.setupData.vp + ' / ' + prematchInfo.players.length}</CardText>}
                        </div>}
                    </CardTitle>
                    {!playerCreds && !prematchInfo.players && <CardBody>
                        <FormGroup>
                            <Input type='select' name='edition'><option value="pok">{t('lobby.prophecy_of_kings')}</option></Input>
                        </FormGroup>
                        <FormGroup>
                            <Input type='select' name='map'><option value="random">{t('lobby.random_map')}</option></Input>
                        </FormGroup>
                        <div style={{display: 'flex', marginTop: '2rem'}}>
                            {t('lobby.players')}:
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
                        <div style={{display: 'flex', marginTop: '2rem'}}>
                            {t('lobby.vp')}:
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => changeOption('vp', {value:10})} name='vp' id='vp10' defaultChecked/><Label for='vp10' check>10</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => changeOption('vp', {value:14})} name='vp' id='vp14'/><Label for='vp14' check>14</Label>
                            </FormGroup>
                        </div>
                    </CardBody>}
                    <CardBody style={{display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
                        <div>
                            
                            {prematchInfo.players && 
                            <Container style={{fontSize: '90%'}}>{prematchInfo.players.map((p, i) =>{
                                return <Row key={i} style={{ minHeight: '2.5rem'}}>
                                    <Col xs='1' style={{padding: 0}}><div style={{backgroundColor: trueColors[colors[i]][0], width: '2rem', height: '2rem', borderRadius: '50%'}}></div></Col>
                                    {p.name && p.isConnected && <Col xs='4' style={{alignSelf: 'center', color: p.data && p.data.ready ? 'lime' : 'none'}}>{p.name}</Col>}
                                    {p.name && !p.isConnected && <Col xs='4' style={{alignSelf: 'center', color: 'yellow'}}>{'[ ' + t('lobby.connecting') + '... ]'}</Col>}
                                    {!p.name && playerName && prematchID === prematchInfo.matchID && String(playerID) === String(p.id) && <Col xs='4' style={{alignSelf: 'center', color: 'yellow'}}>{'[ ' + t('lobby.connecting') + '... ]'}</Col>}
                                    {!p.name && <Col xs='4' style={{alignSelf: 'center'}}>{'[ ' + t('lobby.open') + ' ]'}</Col>}
                                    {p.name && <Col xs='7' style={{alignSelf: 'center', color: p.data && p.data.ready ? 'lime' : 'none'}}>
                                        {String(playerID) === String(p.id) && <Input style={{color: 'inherit', fontSize: 'inherit'}} disabled={p.data && p.data.ready} type='select' onChange={(e) => updatePlayerInfo({race: e.target.value})}>
                                            <option value='0'>{'--' + t('lobby.random_race') + '--'}</option>
                                            {sortedRacesList.map(([idx, label]) => <option key={idx} value={idx}>{label}</option>)}
                                        </Input>}
                                        {p.data && String(playerID) !== String(p.id) && <span style={{paddingLeft: '1.5rem'}}>
                                            {p.data.race === '0' ? t('lobby.random_race'): t('races.' + p.data.race + '.name')}
                                        </span>}
                                    </Col>}
                                    {!p.name && <Col xs='7' style={{alignSelf: 'center', padding: '0.5rem 0rem 0.5rem 1.5rem'}}></Col>}
                                </Row>})}
                            </Container>}
                        </div>
                        {playerCreds && <PrematchApp playerID={playerID} matchID={prematchID} credentials={playerCreds}/>}
                    </CardBody>
                    <CardFooter style={{display: 'flex', justifyContent: 'space-between'}}>
                        {!playerCreds && !prematchInfo.players && <button className='styledButton yellow' onClick={createPrematch}>{t('lobby.create_game')} <b className='bi-caret-right-square-fill' ></b></button>}
                        {!playerCreds && !playerID && prematchInfo && prematchInfo.players && cookie.matchID === prematchID &&
                            <button className='styledButton yellow' onClick={()=>reconnect()}>{t('lobby.reconnect')} <b className='bi-caret-right-square-fill' ></b></button>}
                        {!playerCreds && !playerID && prematchInfo && prematchInfo.players && !autoJoinPrematch &&
                             <button className='styledButton yellow' disabled={prematchInfo.gameName !== 'prematch' || !prematchInfo.players.find(p => !p || !p.name)} onClick={()=>joinPrematch()}>{t('lobby.join_game')} <b className='bi-caret-right-square-fill' ></b></button>}
                        {playerCreds && <button className='styledButton yellow' style={{minWidth: '7rem'}} onClick={leavePrematch}><b className='bi-caret-left-square-fill' ></b> {t('lobby.leave')}</button>}
                       
                    </CardFooter>
                </Card>}
                {playerCreds && prematchInfo && prematchInfo.players && <Card className='borderedPanel' style={{flex: 'auto', overflowY: 'hidden', maxWidth: '42%', margin: '4rem 4rem 5% 0', padding: '2rem'}}>
                    {playerID === '0' && <MapOptions visible={true} useProphecyOfKings={true} currentRaces={currentRaces} excludedTiles={[]} includedTiles={[]} lockedTiles={[]}
                        numberOfPlayers={prematchInfo.players.length} updateTiles={runGame} updateRaces={()=>{}} toggleProphecyOfKings={()=>{}}
                        currentPlayerNames={[]} updatePlayerNames={()=>{}} playerID={playerID} updateMapOptionsCallback={updateMapOptionsCallback}/>}
                    {playerID && playerID !== '0' && prematchInfo.players[0] && prematchInfo.players[0].data && 
                        <MapOptionsRO {...prematchInfo.players[0].data.mapOptions}/>}
                </Card>}
                </div>
                <div id='bottomPanel'>
                    <button onClick={() => setAboutVisible(true)}>{t('lobby.about')}</button>
                    <div id='about' className={aboutVisible ? 'active':'inactive'} onClick={() => setAboutVisible(false)}>
                        <div style={{display: 'flex', padding: '8rem'}}>
                            <div style={{flexBasis: '33%'}}>
                                <h3 style={{margin: '3rem 0'}}>{t('lobby.team')}</h3>

                                <h6>this is Изотов</h6>
                                <h6>Aleksey Lola</h6>
                                <h6>Владислав Б</h6>
                                <h6>Дмитрий Харитонов</h6>
                                <h6>Андрей Мостовых</h6>
                                <h6>Глеб Гаврилов</h6>
                                <h6>Ксюша Нисютина</h6>
                                <h6>Владислав Коровин</h6>
                                <h6>Николай Андриянов</h6>
                                <h6>shadow azray</h6>
                            </div>
                            <div style={{flexBasis: '67%'}}>
                                <h3 style={{margin: '3rem 0'}}>{t('lobby.about')}</h3>
                                <p>{t('lobby.mission')}</p>
                                <p>{t('lobby.mission_github') + ' '}<a onClick={(e)=>e.stopPropagation()} href='https://github.com/f3rret/tio'>GitHub</a></p>
                                <p>{t('lobby.mission_vk') + ' '}<a onClick={(e)=>e.stopPropagation()} href='https://vk.com/twionline'>Вконтакте</a></p>
                            </div>
                        </div>
                    </div>
                </div>
            </>}
        </>;
}
// {playerID && playerID !== '0' && !iAmReady &&  <button className='styledButton green' onClick={() => updatePlayerInfo({ready: true})}>{t('lobby.ready_to_play')} <b className='bi-check-square-fill' ></b></button>}