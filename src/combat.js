import { Card, CardBody, CardTitle } from 'reactstrap'; 
import { useContext } from 'react';
import { StateContext } from './utils';
import { neighbors } from './Grid';

export const SpaceCombat = () => {

    const { G, ctx/*, playerID*/ } = useContext(StateContext);
    const activeTile = G.tiles.find(t => t.active === true);

    let spaceCannons = {};
    //enemy's pds at same tile
    if(activeTile.tdata.planets){
        activeTile.tdata.planets.forEach(p =>{ 
            if(p.occupied !== undefined && p.occupied !== ctx.currentPlayer && p.units && p.units.pds){
            spaceCannons[p.occupied] = 'spaceCannonAttack';
            }
        });
    }

    //cannon in adjacent systems
    const races = G.races.filter((r, i) => i !== ctx.currentPlayer && r.technologies.find(t => t.id === 'PDS').spaceCannon.range > 1).map(r => r.rid);

    if(races.length > 0){
        const neighs = neighbors([activeTile.q, activeTile.r]).toArray();
        neighs.forEach(n => {
            if(n.tdata.planets){
            n.tdata.planets.forEach(p =>{ 
                if(races.indexOf(p.occupied) > -1 && p.units && p.units.pds){
                spaceCannons[p.occupied] = 'spaceCannonAttack';
                }
            });
            }
        });
    }



    return (
    <Card style={{border: 'solid 1px rgba(74, 111, 144, 0.42)', maxWidth: '60%', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, .85)', position: 'absolute', margin: '5rem'}}>
        <CardTitle style={{ color: 'black'}}><h3>{}</h3></CardTitle>
        <CardBody style={{display: 'flex', color: 'black' }}>
        </CardBody>
    </Card>);

}