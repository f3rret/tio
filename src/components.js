import { useContext, useMemo, useState, useCallback } from 'react'
import { LocalizationContext, StateContext, UNITS_LIMIT } from './utils';
import { Badge, Card, CardText, CardImg, ButtonGroup, ListGroup, ListGroupItem, UncontrolledAccordion, AccordionItem, AccordionHeader, AccordionBody, Nav, NavItem, Row, Col } from 'reactstrap';
import { produce } from 'immer';

export const CARD_STYLE = { background: 'none', border: 'solid 1px rgba(255, 255, 255, 0.2)', padding: '1rem', marginBottom: '1rem' }
export const TOKENS_STYLE = { display: 'flex', width: '30%', alignItems: 'center', textAlign: 'center', flexFlow: 'column', padding: '.15rem', background: 'none', margin: '.5rem', border: '1px solid rgba(255, 255, 255, 0.42)', color: 'white'}

export const Persons = () => {
    
    const { G, playerID, moves, ctx, prevStages } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const [agentVisible, setAgentVisible] = useState('agent');

    const race = useMemo(() => G.races[playerID], [G.races, playerID]);
    const agentAbilityIsActive = useMemo(() => {
        if(race.exhaustedCards.indexOf('AGENT') === -1){
          if(race.rid === 1 || race.rid === 2){
            return true;
          }
        }
        return false;
    }, [race.rid, race.exhaustedCards]);

    const commanderAbilityIsActive = useMemo(() => {
        if(race.exhaustedCards.indexOf('COMMANDER') === -1){
          if(race.rid === 1 || race.rid === 2){
            return true;
          }
        }
        return false;
    }, [race.rid, race.exhaustedCards]);

    const useHeroAbility = useCallback(() => {
      if(race.rid === 1){
        moves.useHeroAbility()
      }
      else if(race.rid === 2){
        if(ctx.activePlayers && ctx.activePlayers[playerID] && (!prevStages || !prevStages[playerID] || prevStages[playerID].length > 1)){
          moves.useHeroAbility();
        }
      }
    //eslint-disable-next-line
    }, [race])

    return <><Card style={{...CARD_STYLE, paddingRight: '2rem', minHeight: '14rem', marginBottom: 0, backgroundColor: race.color[1], display: 'flex', fontSize: '.8rem'}}>
        {agentVisible === 'agent' && <Card style={{...CARD_STYLE, padding: '1rem 0', margin: 0, border: 'none', display: 'flex', flexFlow: 'row'}}>
            <CardImg src={'race/agent/'+race.rid+'.png'} style={{width: '100px', height: '130px', opacity: '.75', marginRight: '1rem'}}/>
            <div>
                <CardText>{t('races.' + race.rid + '.agentAbility')}</CardText>
            </div>
        </Card>}
        {agentVisible === 'commander' && <Card style={{...CARD_STYLE, padding: '1rem 0', margin: 0, border: 'none', display: 'flex', flexFlow: 'row'}}>
            <CardImg src={'race/commander/'+race.rid+'.png'} style={{width: '100px', height: '130px', opacity: '.75', marginRight: '1rem'}}/>
            <div>
                <CardText>{t('races.' + race.rid + '.commanderAbility')}</CardText>
                {!race.commanderIsUnlocked && <CardText><b>{t('board.unlock') + ': '}</b> {t('races.' + race.rid + '.commanderUnlock')}</CardText>}
            </div>
        </Card>}
        {agentVisible === 'hero' && <Card style={{...CARD_STYLE, padding: '1rem 0', margin: 0, border: 'none', display: 'flex', flexFlow: 'row'}}>
            <CardImg src={'race/hero/'+race.rid+'.png'} style={{width: '100px', height: '130px', opacity: '.75', marginRight: '1rem'}}/>
            <div>
                <CardText><b>{race.heroAbilityType ? t('board.' + race.heroAbilityType).toUpperCase() : ''}</b>{' ' + t('races.' + race.rid + '.heroAbility')}</CardText>
                {!race.heroIsUnlocked && <CardText><b>{t('board.unlock') + ': '}</b> {t('board.complete_3_objectives')}</CardText>}
                {race.heroIsUnlocked && !race.heroIsExhausted && <button onClick={useHeroAbility} className='styledButton green'>{t('board.activate')}</button>}
            </div>
        </Card>}
    </Card>
    <ButtonGroup style={{fontFamily: 'Handel Gothic'}}>
        <button onClick={()=>setAgentVisible('agent')} className={'styledButton ' + (agentVisible === 'agent' ? 'white':'black')} style={{flexBasis: '33%', position: 'relative'}}>
            {t('board.agent').toUpperCase()}
            <Badge pill style={{position: 'absolute', right: '1rem', height: '1rem', top: '.75rem', border: 'solid 1px lightgray'}} color={agentAbilityIsActive ? 'success':'danger'}>{' '}</Badge>
        </button>
        <button onClick={()=>setAgentVisible('commander')} className={'styledButton ' + (agentVisible === 'commander' ? 'white':'black')} style={{flexBasis: '33%', position: 'relative'}}>
            {t('board.commander').toUpperCase()}
            <Badge pill style={{position: 'absolute', right: '1rem', height: '1rem', top: '.75rem', border: 'solid 1px lightgray'}} color={!race.commanderIsUnlocked ? 'light': commanderAbilityIsActive ? 'success':'danger'}>{' '}</Badge>
        </button>
        <button onClick={()=>setAgentVisible('hero')} className={'styledButton ' + (agentVisible === 'hero' ? 'white':'black')} style={{flexBasis: '33%', position: 'relative'}}>
            {t('board.hero').toUpperCase()}
            <Badge pill style={{position: 'absolute', right: '1rem', height: '1rem', top: '.75rem', border: 'solid 1px lightgray'}} color={!race.heroIsUnlocked ? 'light': race.heroIsExhausted ? 'danger':'success'}>{' '}</Badge>
        </button>
    </ButtonGroup>
    </>
}

export const Stuff = ({tempCt, R_UNITS, groundUnitSelected, advUnitView, payloadCursor, dispatch}) => {

    const { G, playerID, moves, ctx, UNITS, exhaustedCards } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const [midPanelInfo, setMidPanelInfo] = useState('tokens');
    const race = useMemo(() => G.races[playerID], [G.races, playerID]);
    const [purgingFragments, setPurgingFragments] = useState({c: 0, h: 0, i: 0, u: 0});

    const setTempCt = (pl) => dispatch({type: 'temp_ct', payload: pl})
    const IncrToken = ({tag}) => {
        let clickFn = ()=>{if(race.tokens.new){ moves.adjustToken(tag) }};
        if(exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1){
          clickFn = ()=>{
            if(tempCt.new){ setTempCt(produce(tempCt, draft => {
            draft[tag]++; 
            draft.new--;
          }))}
          };
        }
        return (<button className='styledButton green' onClick={()=>clickFn()} style={{position: 'absolute', top: 0, right: 0, width:'2rem', padding: 0, boxShadow: '-2px 0px 10px gold'}}>
          <h5 style={{margin: '0'}}>+</h5></button>);
      }
    
    const DecrToken = ({tag}) => {
    let clickFn = ()=>{
        if((tempCt[tag] === 0 && race.tokens[tag]>0) || tempCt[tag] > -race.tokens[tag]){ setTempCt(produce(tempCt, draft => {
        draft[tag]--; 
        draft.new++;
    }))}
    };
    return (<button className='styledButton red' onClick={()=>clickFn()} style={{position: 'absolute', top: '3rem', right: 0, width:'2rem', padding: 0, boxShadow: '-2px 0px 10px gold'}}>
        <h5 style={{margin: '.25rem .5rem'}}>-</h5></button>);
    }

    const purgeFragment = useCallback((tag) => {
        setPurgingFragments(produce(purgingFragments, draft => {
          if(draft.c + draft.i + draft.h + draft.u >= 3 ){
            draft.c = 0; draft.i = 0; draft.h = 0; draft.u = 0;
          }
          else{
            draft[tag]++;
            if(race.fragments[tag] < draft[tag]){
              draft[tag] = 0;
            }
          }
          
        }));
      }, [purgingFragments, race])

    const moveToReinforcement = () => {
      if(advUnitView && advUnitView.unit && payloadCursor){
        dispatch({type: 'adv_unit_view'});
      }

      moves.moveToReinforcements({groundUnitSelected, advUnitView, payloadCursor})
    }

    return <>
        <Card style={{...CARD_STYLE, minHeight: '14rem', marginBottom: 0}}>
            {midPanelInfo === 'tokens' && <>
            {<h6 style={{textAlign: 'right', marginRight: '1rem'}}>{race.tokens.new + tempCt.new || 0} {t('board.unused')}</h6>}
            
            <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center'}}>
                <ListGroupItem className={race.tokens.new ? 'hoverable':''} style={TOKENS_STYLE} >
                <h6 style={{fontSize: 50}}>{race.tokens.t + tempCt.t}</h6>
                {ctx.phase === 'acts' && <>
                    {(race.tokens.new > 0 || exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1) && <IncrToken tag={'t'}/>}
                    {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && <DecrToken tag={'t'}/>}
                </>}
                <b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.tactic')}</b>
                </ListGroupItem>
                <ListGroupItem className={race.tokens.new ? 'hoverable':''} style={TOKENS_STYLE}>
                <h6 style={{fontSize: 50}}>{race.tokens.f + tempCt.f}</h6>
                {ctx.phase === 'acts' && <>
                    {(race.tokens.new > 0 || exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1) && <IncrToken tag={'f'}/>}
                    {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && <DecrToken tag={'f'}/>}
                </>}
                <b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.fleet')}</b>
                </ListGroupItem>
                <ListGroupItem className={race.tokens.new ? 'hoverable':''} style={TOKENS_STYLE}>
                <h6 style={{fontSize: 50}}>{race.tokens.s + tempCt.s}</h6>
                {ctx.phase === 'acts' && <>
                    {(race.tokens.new > 0 || exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1) && <IncrToken tag={'s'}/>}
                    {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && <DecrToken tag={'s'}/>}
                </>}
                <b style={{backgroundColor: race.color[1], width: '100%'}}>{t('board.strategic')}</b>
                </ListGroupItem>
            </ListGroup>

            {exhaustedCards.indexOf('PREDICTIVE_INTELLIGENCE') > -1 && 
                <button className='styledButton green' style={{alignSelf: 'center', width: 'fit-content'}} 
                onClick={() => moves.redistTokens(tempCt, exhaustedCards)}>{t('board.confirm_changes')}</button>}
            </>}
            {midPanelInfo === 'fragments' && <>
            
            <ListGroup horizontal style={{border: 'none', display: 'flex', alignItems: 'center'}}>
            <ListGroupItem tag='button' className='hoverable' onClick={()=>purgeFragment('c')} style={{...TOKENS_STYLE, width: '22%'}}>
                <img alt='fragment' src='icons/cultural_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{race.fragments.c - purgingFragments.c}</h6>
                <b style={{backgroundColor: race.color[1], width: '100%', wordWrap: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '.9rem'}}>
                {t('board.cultural')}</b>
            </ListGroupItem>
            <ListGroupItem tag='button' className='hoverable' onClick={()=>purgeFragment('h')} style={{...TOKENS_STYLE, width: '22%'}}>
                <img alt='fragment' src='icons/hazardous_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{race.fragments.h - purgingFragments.h}</h6>
                <b style={{backgroundColor: race.color[1], width: '100%', wordWrap: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '.9rem'}}>
                {t('board.hazardous')}</b>
            </ListGroupItem>
            <ListGroupItem tag='button' className='hoverable' onClick={()=>purgeFragment('i')} style={{...TOKENS_STYLE, width: '22%'}}>
                <img alt='fragment' src='icons/industrial_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{race.fragments.i - purgingFragments.i}</h6>
                <b style={{backgroundColor: race.color[1], width: '100%', wordWrap: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '.9rem'}}>
                {t('board.industrial')}</b>
            </ListGroupItem>
            <ListGroupItem tag='button' className='hoverable' onClick={()=>purgeFragment('u')} style={{...TOKENS_STYLE, width: '22%'}}>
                <img alt='fragment' src='icons/unknown_fragment.png' style={{position: 'absolute', opacity: 0.8}}/>
                <h6 style={{fontSize: 50, zIndex: 1, margin: '.5rem 0 0 0', alignSelf: 'flex-end'}}>{race.fragments.u - purgingFragments.u}</h6>
                <b style={{backgroundColor: race.color[1], width: '100%', wordWrap: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '.9rem'}}>
                {t('board.unknown')}</b>
            </ListGroupItem>
            </ListGroup>
            <div style={{alignSelf: 'flex-end', margin: '0 1rem'}}>
            <span style={{padding: '0 1rem'}}>
                {Object.keys(purgingFragments).map(k => {
                const result = [];
                for(var i=0; i<purgingFragments[k]; i++){
                    const type = k === 'c' ? 'cultural': k === 'i' ? 'industrial': k === 'h' ? 'hazardous': 'unknown';
                    result.push(<img key={k+i} alt='fragment' src={'icons/' + type + '_fragment.png'} style={{width: '1.5rem'}}/>);
                }
                return result;
                })}
            </span>
            <button className='styledButton yellow' disabled={purgingFragments.c + purgingFragments.i + purgingFragments.h + purgingFragments.u < 3} style={{maxWidth: 'fit-content'}}
                onClick={()=>{moves.purgeFragments(purgingFragments); setPurgingFragments({c:0,i:0,h:0,u:0})}}>{t('board.purge')}</button>
            </div>
            </>}
            {midPanelInfo === 'reinforce' && <div style={{padding: '0.5rem 0'}}>
                <div style={{border: 'none', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start'}}>
                {R_UNITS.map((u,ui) => {
                    return <div key={ui} style={{width: '4.25rem', marginRight: '.5rem', position: 'relative'}}>
                    <img alt={u} src={'units/'+ u.id.toUpperCase() +'.png'} style={{width: '4rem'}}/>
                    <div style={{fontSize: '30px', fontFamily: 'Handel Gothic', position: 'absolute', bottom: 0, right: 0, textShadow: '-2px 2px 3px black'}}>
                        {UNITS_LIMIT[u.id.toLowerCase()] - (UNITS[u.id.toLowerCase()] || 0)}</div>
                    </div>}
                )}
                </div>
                <div style={{display: 'flex', flexDirection: 'row', height: '2.25rem', marginTop: '.5rem', alignItems: 'center'}}>
                  <button className='styledButton red' style={{margin: '0 1rem', fontWeight: 'bold'}} disabled={!(groundUnitSelected && groundUnitSelected.unit) && !(advUnitView && advUnitView.unit)} onClick={moveToReinforcement}>{' ' + t('board.remove_selected_from_board') + ' : '}</button>
                  {groundUnitSelected && groundUnitSelected.unit && 
                      <div style={{fontSize: '1.25rem', fontFamily: 'Handel Gothic'}}>{t('cards.techno.' + groundUnitSelected.unit.toUpperCase() + '.label')}</div>
                  }
                  {!(groundUnitSelected && groundUnitSelected.unit) && advUnitView && advUnitView.unit && 
                      <div style={{fontSize: '1.25rem', fontFamily: 'Handel Gothic'}}>{t('cards.techno.' + advUnitView.unit.toUpperCase() + '.label')}</div>
                  }
                </div>
            </div>}
        </Card>
        
        <ButtonGroup style={{fontFamily: 'Handel Gothic'}}>
            <button size='sm' onClick={()=>setMidPanelInfo('tokens')} className={ 'styledButton ' + (midPanelInfo === 'tokens' ? 'white':'black')} style={{flexBasis: '33%'}}>{t('board.tokens').toUpperCase()}</button>
            <button size='sm' onClick={()=>setMidPanelInfo('fragments')} className={ 'styledButton ' + (midPanelInfo === 'fragments' ? 'white':'black')} style={{flexBasis: '33%'}}>{t('board.fragments').toUpperCase()}</button>
            <button size='sm' onClick={()=>setMidPanelInfo('reinforce')} className={ 'styledButton ' + (midPanelInfo === 'reinforce' ? 'white':'black')} style={{flexBasis: '33%'}}>{t('board.reinforce').toUpperCase()}</button>
        </ButtonGroup>
    </>
}

export const MyNavbar = ({leftPanel, setLeftPanel, undo, activeTile, isMyTurn}) => {
    const { G, ctx, moves, playerID } = useContext(StateContext);
    const { t } = useContext(LocalizationContext);
    const isInTrade = ctx.activePlayers && ['trade', 'trade2'].includes(ctx.activePlayers[playerID]);

    const leftPanelClick = useCallback((label) => {
        if(leftPanel === label){
          setLeftPanel(null);
        }
        else{
          if(label !== 'trade' || (G.races.length > 1)){
            setLeftPanel(label);
          }
        }
      //eslint-disable-next-line
      }, [leftPanel]);

    return <div style={{ position: 'fixed', height: 0, width: '100%', zIndex: '2', display: 'flex', justifyContent: 'space-between', padding: '0'}}>
      <ButtonGroup className='borderedPanel' style={{minHeight: '3rem', margin: '2.5rem 0 0 2.5rem', fontFamily:'Handel Gothic'}}>
        <button className={'styledButton ' + (leftPanel === 'objectives' ? 'white':'black')} style={{width: '8rem'}} onClick={()=>leftPanelClick('objectives')}>{t("board.nav.objectives")}</button>
        <button className={'styledButton ' + (leftPanel === 'planets' ? 'white':'black')} style={{width: '8rem'}} onClick={()=>leftPanelClick('planets')}>{t("board.nav.planets")}</button>
        <button className={'styledButton ' + (leftPanel === 'units' ? 'white':'black')} style={{width: '8rem'}} onClick={()=>leftPanelClick('units')}>{t("board.nav.units")}</button>
        <button className={'styledButton ' + (leftPanel === 'techno' ? 'white':'black')} style={{width: '8rem'}} onClick={()=>leftPanelClick('techno')}>{t("board.nav.technologies")}</button>
        <button className={'styledButton ' + (leftPanel === 'trade' ? 'white':'black')} style={{width: '8rem'}} onClick={()=>leftPanelClick('trade')}>{t("board.nav.trade")}</button>
      </ButtonGroup>

      <div style={{marginTop: '2rem', marginRight: 0, display: 'flex'}}>
        <Nav className='comboPanel-left' style={{height: '5.5rem', marginTop: '-1rem', padding: '1.5rem 3rem 1rem 2rem'}}>
          <UncontrolledAccordion open='0' defaultOpen='0' id='turnLine' style={{width: '30rem', opacity: '.9', marginTop: '.5rem', background: 'transparent'}}>
            <AccordionItem style={{border: 'none', background: 'transparent'}}>
              <AccordionHeader targetId='1' style={{border: 'none', background: 'transparent'}}>
                <span style={{display: 'flex', width: '100%', background: 'transparent'}}>
                  <CardImg style={{width: '2rem', maxHeight: '2rem', marginRight: '1rem'}} src={'race/icons/'+G.races[ctx.currentPlayer].rid+'.png'} />
                  <h5 style={{margin: 0, alignSelf: 'center', flex: 'auto'}}>{t('races.' + G.races[ctx.currentPlayer].rid + '.name')}
                  {G.speaker === G.races[ctx.currentPlayer].rid ? ' (' + t('board.speaker') + ')': ''}
                  </h5>
                </span>
              </AccordionHeader>
              <AccordionBody style={{padding: '1rem', overflow: 'hidden', background: '0% 0% / 100% auto url(/bg1.png)', backgroundColor: 'rgba(33, 37, 41, 1)', marginTop: '1rem', marginRight: '-1rem', border: 'solid 5px #424242'}} accordionId='1'>
                {[...ctx.playOrder.slice(ctx.playOrderPos+1), ...ctx.playOrder.slice(0, ctx.playOrderPos)].map((pid, idx) => 
                  <Row key={idx} style={{background: 'transparent'}}>
                    <Col xs='1' style={{}}>
                      <CardImg style={{width: '2rem', maxHeight: '2rem', margin: '.5rem'}} src={'race/icons/'+G.races[pid].rid+'.png'} />
                    </Col>
                    <Col xs='8' style={{padding: '1rem 1rem 0 2rem', fontFamily: 'Handel Gothic', textDecoration: G.passedPlayers.includes(''+pid) ? 'line-through':''}}>
                      {t('races.' + G.races[pid].rid + '.name')} {G.speaker === G.races[pid].rid ? ' (' + t('board.speaker') + ')': ''}</Col>
                    <Col xs='3' style={{padding: '.5rem 0'}}>
                      {G.races[pid].strategy.map((s, i) => 
                        <p key={i} style={{fontSize: '75%', margin: 0, textDecoration: s.exhausted ? 'line-through':''}}>
                          {t('cards.strategy.' + s.id + '.label') + ' [' + (s.init+1) + ']'}</p>)}
                    </Col>
                  </Row>
                )}
              </AccordionBody>
            </AccordionItem>
          </UncontrolledAccordion>
        </Nav>

        <Nav className='comboPanel-right' style={{height: '3.5rem', zIndex: 1, padding: '.5rem 2.75em 0 .5rem', minWidth: '30rem', display: 'flex', justifyContent: 'flex-end'}}>
          <NavItem style={{}}>
            {ctx.phase === 'acts' && !isInTrade && <>
              <button className='styledButton black' style={{}} disabled={ctx.numMoves === 0 || !isMyTurn} onClick={() => undo()}><h5 style={{margin: '.5rem'}}>{t("board.nav.undo")}</h5></button>
              {!G.spaceCannons && <>
                {!(activeTile && activeTile.tdata.attacker) && <button className='styledButton yellow' style={{}} disabled={!isMyTurn} onClick={()=>moves.endTurn()}><h5 style={{margin: '.5rem'}}>{t("board.nav.end_turn")}</h5></button>}
                {activeTile && activeTile.tdata.attacker && <button className='styledButton yellow' style={{}} disabled={!isMyTurn} onClick={()=>moves.antiFighterBarrage()}><h5 style={{margin: '.5rem'}}>{t("board.nav.space_combat")}</h5></button>}
                </>
              }
              {isMyTurn && G.spaceCannons && <button className='styledButton yellow' style={{}} onClick={()=>moves.spaceCannonAttack()}><h5 style={{margin: '.5rem'}}>{t("board.nav.space_cannon")}</h5></button>}
            </>}
            {isMyTurn && isInTrade && <button className='styledButton black' style={{}} disabled={ctx.numMoves === 0 || !isMyTurn} onClick={() => moves.decline()}><h5 style={{margin: '.5rem'}}>{t("board.nav.decline_trade")}</h5></button>}
            {!isInTrade && ctx.phase !== 'strat' && ctx.phase !== 'agenda' && <button className='styledButton red' style={{}} disabled={!isMyTurn} onClick={()=>moves.pass()}><h5 style={{margin: '.5rem'}}>{t("board.nav.pass")}</h5></button>}
          </NavItem>
        </Nav>
      </div>
    </div>;
}

export const GlobalPayment = ({globalPayment, GP, dispatch}) => {

    const decrTg = useCallback(() => {
      dispatch({type: 'global_payment', payload: {tg: -1}});
    }, [dispatch])

    const cancel = useCallback((c) => {
      dispatch({type: 'global_payment', payload: {cancel: c}});
    }, [dispatch])

    return <div style={{fontSize: '1.5rem', marginRight: '1rem'}}>
        {globalPayment && <Row>
            {GP.resources > 0 && <Col className='GPcol' xs='1' onClick={() => cancel('resources')} style={{backgroundImage: 'url(icons/resources_bg.png)'}}><b style={{paddingLeft: '0.1rem'}}>{GP.resources}</b></Col>}
            {GP.influence > 0 && <Col className='GPcol' xs='1' onClick={() => cancel('influence')} style={{backgroundImage: 'url(icons/influence_bg.png)'}}><b style={{paddingLeft: '0.1rem'}}>{GP.influence}</b></Col>}
            {GP.propulsion > 0 && <Col className='GPcol' xs='1' onClick={() => cancel('propulsion')} style={{backgroundImage: 'url(icons/propulsion.png)'}}><b style={{paddingLeft: '0.1rem'}}>{GP.propulsion}</b></Col>}
            {GP.biotic > 0 && <Col className='GPcol' xs='1' onClick={() => cancel('biotic')} style={{backgroundImage: 'url(icons/biotic.png)'}}><b style={{paddingLeft: '0.1rem'}}>{GP.biotic}</b></Col>}
            {GP.cybernetic > 0 && <Col className='GPcol' xs='1' onClick={() => cancel('cybernetic')} style={{backgroundImage: 'url(icons/cybernetic.png)'}}><b style={{paddingLeft: '0.1rem'}}>{GP.cybernetic}</b></Col>}
            {GP.warfare > 0 && <Col className='GPcol' xs='1' onClick={() => cancel('warfare')} style={{backgroundImage: 'url(icons/warfare.png)'}}><b style={{paddingLeft: '0.1rem'}}>{GP.warfare}</b></Col>}
            {GP.tg > 0 && <Col className='GPcol' xs='1' onClick={() => decrTg()} style={{backgroundImage: 'url(icons/trade_good_3.png)'}}><b style={{paddingLeft: '0.1rem'}}>{GP.tg + (GP.tgMultiplier &&  GP.tgMultiplier !== 1 ? '(' + (GP.tg * GP.tgMultiplier) + ')' : '')}</b></Col>}
        </Row>}
    </div>

}