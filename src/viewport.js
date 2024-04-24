import { forwardRef } from "react";
import { PixiComponent, useApp/*, useTick*/ } from "@pixi/react";
import { Viewport } from "pixi-viewport";
// eslint-disable-next-line
import { EventSystem } from "@pixi/events";

const WORLD_WIDTH = window.innerWidth;
const WORLD_HEIGHT = window.innerHeight;


const PixiViewportComponent = PixiComponent("Viewport", {
  create(props) {
    const { app, home, ...viewportProps } = props;
    const [firstCorner] = home.corners;
    const viewport = new Viewport({
      screenWidth: WORLD_WIDTH,
      screenHeight: WORLD_HEIGHT,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      ticker: props.app.ticker,
      events: props.app.renderer.events,
      scale: .5,
      //interaction: props.app.renderer.plugins.interaction,
      ...viewportProps
    });

    // activate plugins
    (props.plugins || []).forEach((plugin) => {
      viewport[plugin]();
    });

    viewport
    .drag()
    .pinch()
    .wheel()
    //.decelerate();

    let deltaX = firstCorner.x;
    deltaX -= (home.q * 50);
    if(home.q <= 0) deltaX += 200;

    let deltaY = firstCorner.y;
    deltaY -= (home.r * 100);
    if(home.r >= 0) deltaY += 300;

    viewport.fit();
    viewport.moveCenter((WORLD_WIDTH / 2) + deltaX, (WORLD_HEIGHT / 2) + deltaY);
    viewport.setZoom(1, true);

    return viewport;
  },
  applyProps(viewport, _oldProps, _newProps) {
    const { plugins: oldPlugins, children: oldChildren, ...oldProps } = _oldProps;
    const { plugins: newPlugins, children: newChildren, ...newProps } = _newProps;

    Object.keys(newProps).forEach((p) => {
      if (oldProps[p] !== newProps[p]) {
        viewport[p] = newProps[p];
      }
    });
  },
  didMount() {
    
    console.log("viewport mounted");
  }
});

export const PixiViewport = forwardRef((props, ref) => (
  <PixiViewportComponent ref={ref} app={useApp()} {...props} />
));

PixiViewport.displayName = 'PixiViewport';