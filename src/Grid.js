import { defineHex, Grid, spiral, ring, Orientation } from 'honeycomb-grid';

const Hex = defineHex({dimensions: 190, orientation: Orientation.FLAT});
const mapArr = [18, 77, 80, 28, 50, 45, 70, 67, 20, 38, 23, 21, 66, 27, 29, 72, 46, 71, 48, 15, 40, 73, 54, 41, 24, 7, 30, 36, 9, 79, 25, 57, 39, 68, 55, 61, 76].reverse();

export const HexGrid = new Grid(Hex, spiral({ start: [0, 0], radius: 3 }));
HexGrid.forEach(hex => hex.tileId = mapArr.pop());

export const neighbors = (c) => {
    const ringTraverser = ring({ center: c, radius: 1, bail: true })
    return HexGrid.traverse(ringTraverser);
}
