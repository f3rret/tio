import { LobbyClient } from 'boardgame.io/client';
import { useState } from 'react';
import { Card, CardBody, CardTitle, CardText, CardFooter, Container, Row, Col, 
    Input, Button, FormFeedback, FormGroup, Label } from 'reactstrap';
import { produce } from 'immer';
import './scss/custom.scss';

export const Lobby = ()=> {
    const [gameList, setGameList] = useState();
    const [matchInfo, setMatchInfo] = useState();
    const [matchID, setMatchID] = useState();
    const lobbyClient = new LobbyClient({ server: 'http://localhost:8000' });

    const refreshMatchList = () => {
        lobbyClient.listMatches('prematch')
        .then(data => { console.log(data); data.matches && setGameList(data.matches) } )
        .catch(console.error)
    }

    const newMatch = () => {
        setMatchInfo({
            numPlayers: 2,
            setupData: {
                matchName: 'New Game',
                edition: 'PoK',
                map: 'random'
            }
        })
    }

    const createMatch = () => {
        lobbyClient.createMatch('prematch', matchInfo)
        .then(console.log, setMatchID)
        .catch(console.err);
    }

    const changeOption = (optName, input) => {
        //console.log(optName, input.value);
        setMatchInfo(produce(matchInfo, draft => {
            if(draft.setupData[optName] !== undefined){
                draft.setupData[optName] = input.value;
            }
        }));
    }

    return <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', height: '100%', 
                        padding: '2rem', fontFamily:'Handel Gothic'}}>
                <Card style={{flex: 'auto', maxWidth: '50%', padding: '2rem', border: 'solid 1px rgba(255,255,255,.25)'}}>
                    <CardTitle style={{display: 'flex'}}>
                        <h3 style={{flex: 'auto'}}>Macthes list</h3>
                        <Button className='bi-repeat' onClick={refreshMatchList}/>
                        <Button color='warning' onClick={newMatch}>Create new</Button>
                    </CardTitle>
                    <CardBody style={{paddingTop: '5rem'}}>
                        <Container style={{overflowY: 'auto'}}>
                            {gameList && gameList.reverse().map( (g, i) => 
                            <Row key={i}>
                                <Col xs='4'>{g.createdAt && (new Date(g.createdAt)).toLocaleString()}</Col>
                                <Col xs='7'>{g.setupData && g.setupData.matchName}</Col>
                                <Col xs='1'>{g.players && g.players.length}</Col>
                            </Row>
                            )}
                        </Container>
                    </CardBody>
                </Card>
                {matchInfo && <Card style={{flex: 'auto', overflowY: 'hidden', maxWidth: '45%', padding: '2rem', border: 'solid 1px rgba(255,255,255,.25)'}}>
                    <CardTitle>
                        <Input valid placeholder={matchInfo.setupData.matchName} onChange={(e) => changeOption('matchName', e.target)}/>
                        <FormFeedback valid>that name acceptable</FormFeedback>
                    </CardTitle>
                    <CardBody>
                        <FormGroup>
                            <Input type='select' name='edition'><option>Prophecy of Kings</option></Input>
                        </FormGroup>
                        <FormGroup>
                            <Input type='select' name='map'><option>random map</option></Input>
                        </FormGroup>
                        <div style={{display: 'flex', marginTop: '2rem'}}>
                            Players:
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setMatchInfo({...matchInfo, numPlayers: 2})} name='numPlayers' id='numPlayers2' defaultChecked/><Label for='numPlayers2' check>2</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setMatchInfo({...matchInfo, numPlayers: 3})} name='numPlayers' id='numPlayers3'/><Label for='numPlayers3' check>3</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setMatchInfo({...matchInfo, numPlayers: 4})} name='numPlayers' id='numPlayers4' /><Label for='numPlayers4' check>4</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setMatchInfo({...matchInfo, numPlayers: 5})} name='numPlayers' id='numPlayers5' /><Label for='numPlayers5' check>5</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setMatchInfo({...matchInfo, numPlayers: 6})} name='numPlayers' id='numPlayers6' /><Label for='numPlayers6' check>6</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setMatchInfo({...matchInfo, numPlayers: 7})} name='numPlayers' id='numPlayers7' /><Label for='numPlayers7' check>7</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' onClick={() => setMatchInfo({...matchInfo, numPlayers: 8})} name='numPlayers' id='numPlayers8' /><Label for='numPlayers8' check>8</Label>
                            </FormGroup>
                        </div>
                    </CardBody>
                    <CardFooter style={{display: 'flex', justifyContent: 'flex-end'}}>
                        <Button color='success' onClick={createMatch}>Create match <b className='bi-forward-fill' ></b></Button>
                    </CardFooter>
                </Card>}
            </div>;
}