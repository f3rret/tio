import { useTick, Sprite } from '@pixi/react';
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
            <Sprite rotation={sc*.9} x={x} y={y} cacheAsBitmap={true} image={'active.png'} anchor={.5} scale={.6 + -sc/7} alpha={.45 - sc}/>
            </>

};