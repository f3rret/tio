import { useTick, Sprite, Container, Text } from '@pixi/react';
import { useState } from 'react';

export const SelectedHex = ({x, y}) => {

    const [rot, setRot] = useState(0);

    useTick(delta => setRot(r => r + (0.001 * delta)));

    return <>
            <Sprite rotation={rot} x={x} y={y} cacheAsBitmap={true} image={'selected.png'} anchor={.5} scale={.65} alpha={.75}/>
            <Sprite rotation={-rot/2} x={x} y={y} cacheAsBitmap={true} image={'selected2.png'} anchor={.5} scale={.65} alpha={.75}/>
            </>

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

const Landing = ({x, y, pointerdown, png}) => {

    const [sc, setSc] = useState(0);
    const [sign, setSign] = useState(1);

    useTick(delta => setSc(r => {
        if(sc <= -0.5) setSign(1);
        else if(sc >= 0.5) setSign(-1);

        return r + (0.1 * delta * sign);
    }));

    return <Sprite zIndex={4} pointerdown={pointerdown} interactive={true} image={png} x={x} y={y + sc} scale={.5} alpha={.85}/>
}

export const LandingGreen = (args) => {
    return <Landing {...args} png='icons/landing-green.png'/>
}

export const LandingRed = (args) => {
    return <Landing {...args} png='icons/landing-red.png'/>
}


export const MoveDialog = ({x, y, pointerdown, canMoveThatPath, distanceInfo, buttonLabel}) => {
    //interactive={true} pointerdown={pointerdown} alpha={canMoveThatPath ? 1:.5} 

    return <Container y={y} x={x}>
                <Sprite scale={.5} image={'move_dialog.png'} />
                {distanceInfo && distanceInfo.length > 2 && <Container x={40} y={30}>
                <Text text={distanceInfo[0]} y={0} style={{fontSize: 20, fontFamily:'system-ui', fill: '#faebd7'}}/>
                <Text text={distanceInfo[1]} y={30} style={{fontSize: 20, fontFamily:'system-ui', fill: '#faebd7'}}/>
                <Text text={distanceInfo[2]} y={60} style={{fontSize: 20, fontFamily:'system-ui', fill: '#faebd7'}}/>
                </Container>}
                {buttonLabel && canMoveThatPath && <PixiButton pointerdown={pointerdown} label={buttonLabel} x={10} y={120} width={300}/>}
            </Container>
    
}

const PixiButton = (args) => {

    return <Container alpha={.9} interactive={true} {...args} cursor='pointer' mouseover={(e) => e.target.alpha = 1} mouseout={(e) => e.target.alpha = .9}>
        <Sprite scale={.7} width={args.width} image={'pixi-button.png'}/>
        <Text text={args.label} y={15} x={args.width / 4}  
            style={{fontSize: 20, fontFamily:'system-ui', fill: '#ffac00'}}/>
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

    return <Sprite interactive={true} cursor='pointer' alpha={.9} mouseover={(e) => e.target.alpha = 1} mouseout={(e) => e.target.alpha = .9}
                pointerdown={pointerdown} scale={.7 + sc/10} y={y} x={x} image={'move_step.png'}>
                <Text text={text} x={text && text.length > 1 ? 30:50} y={25} style={{fontSize: 50, fontFamily:'system-ui', fill: '#faebd7'}}/>
            </Sprite>

}