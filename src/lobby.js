import { LobbyClient } from 'boardgame.io/client';
import { useState } from 'react';
import { Card, CardBody, CardTitle, CardText, CardFooter, Container, Row, Col, 
    Input, Button, FormFeedback, FormGroup, Label } from 'reactstrap';
import './scss/custom.scss';

export const Lobby = ()=> {
    const [gameList, setGameList] = useState();
    const [matchInfo, setMatchInfo] = useState();
    const [matchID, setMatchID] = useState();
    const lobbyClient = new LobbyClient({ server: 'http://localhost:8000' });

    const refreshMatchList = () => {
        lobbyClient.listMatches('default')
        .then(data => { console.log(data); data.matches && setGameList(data.matches) } )
        .catch(console.error)
    }

    const newMatch = () => {
        setMatchInfo({
            numPlayers: 2,
            setupData: {
                matchName: 'New Game'
            }
        })
    }

    const createMatch = () => {
        lobbyClient.createMatch('default', matchInfo)
        .then(console.log, setMatchID)
        .catch(console.err);
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
                        <Container>
                            {gameList && gameList.map( (g, i) => 
                            <Row key={i}>
                                <Col xs='4'>{g.createdAt && (new Date(g.createdAt)).toLocaleString()}</Col>
                                <Col xs='7'>{g.setupData && g.setupData.matchName}</Col>
                                <Col xs='1'>{g.players && g.players.length}</Col>
                            </Row>
                            )}
                        </Container>
                    </CardBody>
                </Card>
                {matchInfo && <Card style={{flex: 'auto', maxWidth: '45%', padding: '2rem', border: 'solid 1px rgba(255,255,255,.25)'}}>
                    <CardTitle>
                        <Input valid placeholder={matchInfo.setupData.matchName}/>
                        <FormFeedback valid>that name acceptable</FormFeedback>
                    </CardTitle>
                    <CardBody>
                        <FormGroup>
                            <Input type='select'><option>Prophecy of Kings</option></Input>
                        </FormGroup>
                        <FormGroup>
                            <Input type='select'><option>random map</option></Input>
                        </FormGroup>
                        <div style={{display: 'flex', marginTop: '2rem'}}>
                            Players:
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' name='numPlayers' defaultChecked/><Label for='numPlayers' check>2</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' name='numPlayers'/><Label for='numPlayers' check>3</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' name='numPlayers'/><Label for='numPlayers' check>4</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' name='numPlayers'/><Label for='numPlayers' check>5</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' name='numPlayers'/><Label for='numPlayers' check>6</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' name='numPlayers'/><Label for='numPlayers' check>7</Label>
                            </FormGroup>
                            <FormGroup check style={{marginLeft: '1rem'}}>
                                <Input type='radio' name='numPlayers'/><Label for='numPlayers' check>8</Label>
                            </FormGroup>
                        </div>
                    </CardBody>
                    <CardFooter style={{display: 'flex', justifyContent: 'flex-end'}}>
                        <Button color='success' onClick={createMatch}>Create match <b className='bi-forward-fill' ></b></Button>
                    </CardFooter>
                </Card>}
            </div>;
}