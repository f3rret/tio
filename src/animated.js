import { useTick, Sprite, Container, Text } from '@pixi/react';
import { useCallback, useState } from 'react';

let dialog_pos = 1;

export const SelectedHex = ({x, y}) => {

    const [rot, setRot] = useState(0);

    useTick(delta => setRot(r => r + (0.001 * delta)));

    return <>
            <Sprite rotation={rot} x={x} y={y} cacheAsBitmap={true} image={'selected.png'} anchor={.5} scale={.65} alpha={.75}/>
            <Sprite rotation={-rot/2} x={x} y={y} cacheAsBitmap={true} image={'selected2.png'} anchor={.5} scale={.65} alpha={.75}/>
            </>

};

export const SelectedPlanet = ({radius}) => {

    const [sc, setSc] = useState(0);
    const [sign, setSign] = useState(1);

    useTick(delta => setSc(r => {
        if(sc <= -0.5) setSign(1);
        else if(sc >= 0.5) setSign(-1);

        return r + (0.01 * delta * sign);
    }));

    return <Sprite zIndex={4} image={'selected_planet.png'} anchor={.5} x={radius} y={radius} width={radius*3 + sc*10} height={radius*3 + sc*10} alpha={.5}/>

};

export const ActiveHex = ({x, y}) => {

    //const [rot, setRot] = useState(0);
    const [sc, setSc] = useState(0);
    const [sign, setSign] = useState(1);

    //useTick(delta => setRot(r => r + (0.005 * delta)));
    useTick(delta => setSc(r => {
        if(sc <= -0.5) setSign(1);
        else if(sc >= 0.5) setSign(-1);

        return r + (0.001 * delta * sign);
    }));

    return <>
            <Sprite rotation={sc} x={x} y={y} cacheAsBitmap={true} image={'active.png'} anchor={.5} scale={.6 + sc/10} alpha={.75}/>
            <Sprite rotation={sc*.9} x={x} y={y} cacheAsBitmap={true} image={'active.png'} anchor={.5} scale={.6 + -sc/7} alpha={.35}/>
            </>

};

const Landing = ({pointerdown, fill, children, x, y, width}) => {

    const [sc, setSc] = useState(0);
    const [sign, setSign] = useState(1);

    useTick(delta => setSc(r => {
        if(sc <= -0.5) setSign(1);
        else if(sc >= 0.5) setSign(-1);

        return r + (0.1 * delta * sign);
    }));


    return <Container zIndex={4} x={x} y={y + sc} width={width} alpha={.9} interactive={true} pointerdown={(e) => pointerdown(e)} cursor='pointer' mouseover={(e) => e.target.alpha = 1} mouseout={(e) => e.target.alpha = .9}>
        {children}
        <Text text={'⯆'} y={0} x={0}
            style={{fontSize: 80, fontFamily:'Handel Gothic', fill: fill, dropShadow: true, dropShadowDistance: 5}}/>
    </Container>
}

export const LandingGreen = (args) => {
    return <Landing {...args} fill='green'/>
}

export const LandingRed = (args) => {
    return <Landing {...args} fill='red'/>
}


export const MoveDialog = ({x, y, pointerdown, canMoveThatPath, distanceInfo, buttonLabel}) => {

    const [dpos, setDpos] = useState(dialog_pos);

    return <Container y={y} x={x*dpos} interactive={true} pointerdown={() => {dialog_pos = -dialog_pos; setDpos(dialog_pos)}}>
                <Sprite scale={.5} image={'move_dialog.png'} tint='gold'/>
                {distanceInfo && distanceInfo.length > 2 && <Container x={40} y={30}>
                <Text text={distanceInfo[0]} y={10} style={{fontSize: 15, fontFamily:'Handel Gothic', fill: '#faebd7'}}/>
                <Text text={distanceInfo[1]} y={40} style={{fontSize: 15, fontFamily:'Handel Gothic', fill: '#faebd7'}}/>
                <Text text={distanceInfo[2]} y={70} style={{fontSize: 15, fontFamily:'Handel Gothic', fill: '#faebd7'}}/>
                </Container>}
                {buttonLabel && canMoveThatPath && <PixiButton pointerdown={pointerdown} label={buttonLabel} x={50} y={150} width={175}/>}
            </Container>
    
}

export const PixiButton = (args) => {
    const pointerdown = (e) => {
        e.stopImmediatePropagation();
        if(args.pointerdown) args.pointerdown(e);
    }

    return <Container alpha={.9} interactive={true} {...args} pointerdown={(e) => pointerdown(e)} cursor='pointer' mouseover={(e) => e.target.alpha = 1} mouseout={(e) => e.target.alpha = .9}>
        <Sprite scale={.3} width={args.width} image={'pixi-button.png'}/>
        <Text text={args.label} y={10} x={args.width / 4}  
            style={{fontSize: 15, fontFamily:'Handel Gothic', fill: '#faebd7'}}/>
    </Container>

}

export const SimplePixiButton = (args) => {
    const pointerdown = useCallback((e) => {
        e.stopImmediatePropagation();
        if(args.pointerdown) args.pointerdown(e);
    }, [args]);

    const [sc, setSc] = useState(0);
    const [sign, setSign] = useState(1);

    useTick(delta => setSc(r => {
        if(sc <= -0.5) setSign(1);
        else if(sc >= 0.5) setSign(-1);

        return r + (0.1 * delta * sign);
    }));

    return <Container alpha={.9} interactive={true} {...args} pointerdown={(e) => pointerdown(e)} cursor='pointer' mouseover={(e) => e.target.alpha = 1} mouseout={(e) => e.target.alpha = .9}>
        <Text text={args.label} y={0 + sc} x={0}
            style={{fontSize: 80, fontFamily:'Handel Gothic', fill: 'gold', dropShadow: true, dropShadowDistance: 5}}/>
    </Container>

}

export const MoveStep = ({pointerdown, x, y, text, tint}) => {

    const [sc, setSc] = useState(0);
    const [sign, setSign] = useState(1);

    useTick(delta => setSc(r => {
        if(sc <= -0.5) setSign(1);
        else if(sc >= 0.5) setSign(-1);

        return r + (0.01 * delta * sign);
    }));

    return <Container interactive={true} cursor='pointer' pointerdown={pointerdown} y={y} x={x} scale={.5 + sc/20} anchor={.5}>
            <Sprite tint={tint} image={'icons/unit_pl_bg.png'} alpha={.9}/>
            <Text tint={tint} text={text} x={70} y={50} style={{fontSize: 70, fontFamily:'Handel Gothic', fill: '#faebd7'}}/>
            </Container>

}

export const PlanetUnderAttack = ({w, x, y, text, rname, rid, fleet, color}) => {

    return  <Container x={x} y={y}>
                <Sprite scale={.5} image='underattack.png' alpha={0.95} tint='red'/>
                <Text x={40} y={40} style={{fontSize: 20, fontFamily:'Handel Gothic', fill: 'white'}} text={text} />
                <Sprite x={40} y={80} image={'race/icons/'+ rid +'.png'} scale={.5}/>
                <Text x={80} y={85} style={{fontSize: 15, fontFamily:'Handel Gothic', fill: 'white'}} text={rname} />

                <Container y={75} x={100}>
                    <InvasionForce fleet={fleet} color={color}/>
                </Container>
            </Container>

}

const InvasionForce = ({fleet, color}) => {
  
    if(fleet){
      return Object.keys(fleet).map((f, i) => {
        const y = 40;
        const x = -50 + i*55;
        let text = fleet[f].length;
        if(text === 1) text = ' 1';
  
        return <Container key={f} x={x} y={y}>
                    <Sprite tint={color} scale={.3} image={'icons/unit_inf_bg.png'}/>
                    <Sprite image={'units/' + f.toUpperCase() + '.png'} x={5} y={0} scale={.25}/>
                                <Text style={{fontSize: 15, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} 
                                    x={25} y={50} text={text}/>
                </Container>
                        
      })
    }
}

export const SectorUnderAttack = ({w, rid, fleet, text, color, rname}) => {
    
    const [dpos, setDpos] = useState(dialog_pos);
    const x = dpos * (w-150);

    return  <Container x={x} y={-350 * dpos} interactive={true} pointerdown={() => {dialog_pos = -dialog_pos; setDpos(dialog_pos)}}>
                <Sprite scale={0.85} image='underattack.png' alpha={0.85} tint='red'/>
                <Text x={70} y={40} style={{fontSize: 30, fontFamily:'Handel Gothic', fill: 'white'}} text={text} />
                <Sprite x={70} y={80} image={'race/icons/'+ rid +'.png'} scale={.5}/>
                <Text x={110} y={80} style={{fontSize: 20, fontFamily:'Handel Gothic', fill: 'white'}} text={rname} />

                <Container y={135} x={70}>
                    <AttackerForce fleet={fleet} color={color}/>
                </Container>
            </Container>
}

const AttackerForce = ({fleet, color}) => {

    const payload = {infantry: [], fighter: [], mech: []}
  
    Object.keys(fleet).forEach(tag => {
      fleet[tag].forEach(ship => {
        ship.payload && ship.payload.forEach(p => {
          if(p && p.id) payload[p.id].push({});
        });
      })
    });
  
    Object.keys(payload).forEach(k => {if(!payload[k].length) delete payload[k]});
    const rowLength = 5;

    const f = Object.keys(fleet).map((f, i) => {

      const y = ( i<rowLength ? 0:70 );
      const x = ( i<rowLength ? i*85 : (i-rowLength)*85 );
      let text = fleet[f].length;
      if(text === 1) text = ' 1';
  
      return    <Container key={f} x={x} y={y} >
                    <Sprite tint={color} scale={.2} image={'icons/unit_bg.png'}/>
                    <Sprite image={'units/' + f.toUpperCase() + '.png'} x={20} y={5} scale={.25}/>
                                <Text style={{fontSize: 20, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} 
                                    x={50} y={42} text={text}/>
                </Container>
                
           
    });

    const p =   <Container key={'payloads'} y={(Math.abs(Object.keys(fleet).length / rowLength) + 1) * 60}>
                    {Object.keys(payload).map((f, i) => {
                    
                    const y = ( i<rowLength ? 0:70 );
                    const x = ( i<rowLength ? i*60 : (i-rowLength)*60 );
                    let text = payload[f].length;
                    if(text === 1) text = ' 1';
                
                    return    <Container key={f} x={x} y={y} >
                                <Sprite tint={color} scale={.3} image={'icons/unit_inf_bg.png'}/>
                                <Sprite image={'units/' + f.toUpperCase() + '.png'} x={5} y={0} scale={.25}/>
                                            <Text style={{fontSize: 15, fontFamily:'Handel Gothic', fill: 'white', dropShadow: true, dropShadowDistance: 1}} 
                                                x={25} y={50} text={text}/>
                            </Container>
                            
                        
                    })}
                </Container>

      return [...f, p]
  };